import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type Prisma, type WaitlistEntry, type WaitlistEntryStatus } from '@prisma/client';

import {
  type CreateWaitlistEntryRequest,
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  type PatchWaitlistEntryRequest,
  type RemoveWaitlistEntryRequest,
  type WaitlistEntriesCollection,
  type WaitlistEntryResponse,
} from '@rpm/contracts';

import { throwVersionMismatch } from '../../../common/auth/if-match';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';
import { AuthorizationService } from '../../tenancy/application/authorization.service';

@Injectable()
export class WaitlistService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listEntries(
    organizationId: string,
    membershipId: string,
    options?: {
      limit?: number;
      after?: string;
      propertyId?: string;
      partyId?: string;
      status?: string;
    },
  ): Promise<WaitlistEntriesCollection> {
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);
    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );

    if (options?.propertyId !== undefined) {
      await this.authorization.assertPropertyAccess(
        membershipId,
        organizationId,
        options.propertyId,
      );
    }

    const propertyScope =
      accessible === null
        ? options?.propertyId !== undefined
          ? { propertyId: options.propertyId }
          : {}
        : {
            propertyId: options?.propertyId !== undefined ? options.propertyId : { in: accessible },
          };

    let cursorFilter: Prisma.WaitlistEntryWhereInput = {};
    if (options?.after !== undefined) {
      const anchor = await this.prisma.waitlistEntry.findFirst({
        where: { id: options.after, tenantId: organizationId },
      });
      if (anchor !== null) {
        cursorFilter = {
          OR: [
            { priority: { gt: anchor.priority } },
            {
              priority: anchor.priority,
              createdAt: { gt: anchor.createdAt },
            },
            {
              priority: anchor.priority,
              createdAt: anchor.createdAt,
              id: { gt: anchor.id },
            },
          ],
        };
      }
    }

    const entries = await this.prisma.waitlistEntry.findMany({
      where: {
        tenantId: organizationId,
        ...propertyScope,
        ...(options?.partyId !== undefined ? { partyId: options.partyId } : {}),
        ...(options?.status !== undefined ? { status: options.status as WaitlistEntryStatus } : {}),
        ...cursorFilter,
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });

    const pageItems = entries.slice(0, limit);
    const hasMore = entries.length > limit;
    const last = pageItems.at(-1);

    return {
      data: pageItems.map((item) => this.toResponse(item)),
      page: {
        nextCursor: hasMore && last !== undefined ? last.id : null,
        previousCursor: null,
        limit,
      },
      meta: {},
    };
  }

  async getEntry(
    organizationId: string,
    membershipId: string,
    entryId: string,
  ): Promise<WaitlistEntryResponse> {
    const entry = await this.findEntry(organizationId, membershipId, entryId);
    return this.toResponse(entry);
  }

  async createEntry(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    body: CreateWaitlistEntryRequest,
    correlationId?: string,
  ): Promise<WaitlistEntryResponse> {
    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );

    if (accessible !== null && body.propertyId === undefined) {
      throw new UnprocessableEntityException({
        message: 'propertyId is required for property-scoped actors',
        code: 'PROPERTY_REQUIRED',
      });
    }

    if (body.propertyId !== undefined) {
      await this.authorization.assertPropertyAccess(membershipId, organizationId, body.propertyId);
    }

    const party = await this.prisma.party.findFirst({
      where: {
        id: body.partyId,
        tenantId: organizationId,
        deletedAt: null,
        residentProfile: { isNot: null },
      },
    });
    if (party === null) {
      throw new NotFoundException({
        message: 'Resident not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (body.unitId !== undefined) {
      const unit = await this.prisma.unit.findFirst({
        where: {
          id: body.unitId,
          tenantId: organizationId,
          deletedAt: null,
          ...(body.propertyId !== undefined ? { propertyId: body.propertyId } : {}),
        },
      });
      if (unit === null) {
        throw new NotFoundException({
          message: 'Unit not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }
      if (body.propertyId === undefined) {
        await this.authorization.assertPropertyAccess(
          membershipId,
          organizationId,
          unit.propertyId,
        );
      }
    }

    const created = await this.prisma.waitlistEntry.create({
      data: {
        tenantId: organizationId,
        partyId: body.partyId,
        propertyId: body.propertyId ?? null,
        unitId: body.unitId ?? null,
        priority: body.priority ?? 100,
        criteria: (body.criteria ?? {}) as Prisma.InputJsonValue,
        notes: body.notes ?? null,
        consentAt: body.consentAt !== undefined ? new Date(body.consentAt) : new Date(),
        expiresAt: body.expiresAt !== undefined ? new Date(body.expiresAt) : null,
      },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'waitlist.create',
      outcome: 'SUCCESS',
      targetType: 'waitlist_entry',
      targetId: created.id,
      correlationId,
      changeSummary: { partyId: body.partyId, propertyId: body.propertyId ?? null },
    });

    return this.toResponse(created);
  }

  async patchEntry(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    entryId: string,
    body: PatchWaitlistEntryRequest,
    ifMatchVersion: number,
    correlationId?: string,
  ): Promise<WaitlistEntryResponse> {
    const existing = await this.findEntry(organizationId, membershipId, entryId);
    if (existing.version !== ifMatchVersion) {
      throwVersionMismatch('Waitlist entry version mismatch');
    }
    if (existing.status === 'REMOVED' || existing.status === 'CLOSED') {
      throw new UnprocessableEntityException({
        message: 'Waitlist entry is closed',
        code: 'WAITLIST_ENTRY_CLOSED',
      });
    }

    if (body.propertyId !== undefined && body.propertyId !== null) {
      await this.authorization.assertPropertyAccess(membershipId, organizationId, body.propertyId);
    }

    const updated = await this.prisma.waitlistEntry.update({
      where: { id: entryId },
      data: {
        ...(body.propertyId !== undefined ? { propertyId: body.propertyId } : {}),
        ...(body.unitId !== undefined ? { unitId: body.unitId } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.criteria !== undefined
          ? { criteria: body.criteria as Prisma.InputJsonValue }
          : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.expiresAt !== undefined
          ? { expiresAt: body.expiresAt === null ? null : new Date(body.expiresAt) }
          : {}),
        ...(body.status !== undefined ? { status: body.status as WaitlistEntryStatus } : {}),
        version: { increment: 1 },
      },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'waitlist.update',
      outcome: 'SUCCESS',
      targetType: 'waitlist_entry',
      targetId: entryId,
      correlationId,
      changeSummary: body as Record<string, unknown>,
    });

    return this.toResponse(updated);
  }

  async removeEntry(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    entryId: string,
    body: RemoveWaitlistEntryRequest,
    correlationId?: string,
  ): Promise<WaitlistEntryResponse> {
    const existing = await this.findEntry(organizationId, membershipId, entryId);
    if (existing.status === 'REMOVED') {
      return this.toResponse(existing);
    }

    const updated = await this.prisma.waitlistEntry.update({
      where: { id: entryId },
      data: {
        status: 'REMOVED',
        removedAt: new Date(),
        removeReason: body.reason,
        version: { increment: 1 },
      },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'waitlist.remove',
      outcome: 'SUCCESS',
      targetType: 'waitlist_entry',
      targetId: entryId,
      correlationId,
      changeSummary: { reason: body.reason },
    });

    return this.toResponse(updated);
  }

  private async findEntry(
    organizationId: string,
    membershipId: string,
    entryId: string,
  ): Promise<WaitlistEntry> {
    const entry = await this.prisma.waitlistEntry.findFirst({
      where: { id: entryId, tenantId: organizationId },
    });
    if (entry === null) {
      throw new NotFoundException({
        message: 'Waitlist entry not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    if (entry.propertyId !== null) {
      await this.authorization.assertPropertyAccess(membershipId, organizationId, entry.propertyId);
    } else {
      const accessible = await this.authorization.resolveAccessiblePropertyIds(
        membershipId,
        organizationId,
      );
      if (accessible !== null) {
        throw new NotFoundException({
          message: 'Waitlist entry not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }
    }
    return entry;
  }

  private toResponse(entry: WaitlistEntry): WaitlistEntryResponse {
    return {
      id: entry.id,
      organizationId: entry.tenantId,
      partyId: entry.partyId,
      propertyId: entry.propertyId,
      unitId: entry.unitId,
      status: entry.status,
      priority: entry.priority,
      criteria: (entry.criteria ?? {}) as Record<string, unknown>,
      notes: entry.notes,
      consentAt: entry.consentAt?.toISOString() ?? null,
      expiresAt: entry.expiresAt?.toISOString() ?? null,
      removedAt: entry.removedAt?.toISOString() ?? null,
      removeReason: entry.removeReason,
      version: entry.version,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    };
  }
}
