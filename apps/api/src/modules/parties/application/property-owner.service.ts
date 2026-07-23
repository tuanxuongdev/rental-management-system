import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type OwnerCategory, type Party, type PartyType } from '@prisma/client';

import {
  type CreatePropertyOwnerRequest,
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  type PatchPropertyOwnerRequest,
  type PropertyOwnerResponse,
  type PropertyOwnersCollection,
} from '@rpm/contracts';

import { throwVersionMismatch } from '../../../common/auth/if-match';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';

type PartyWithOwner = Party & {
  ownerProfile: { ownerCategory: OwnerCategory; notes: string | null } | null;
};

@Injectable()
export class PropertyOwnerService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listOwners(
    organizationId: string,
    options?: { limit?: number; after?: string; q?: string },
  ): Promise<PropertyOwnersCollection> {
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);
    const parties = await this.prisma.party.findMany({
      where: {
        tenantId: organizationId,
        deletedAt: null,
        ownerProfile: { isNot: null },
        ...(options?.q !== undefined
          ? {
              OR: [
                { displayName: { contains: options.q, mode: 'insensitive' } },
                { legalName: { contains: options.q, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(options?.after !== undefined ? { id: { gt: options.after } } : {}),
      },
      include: { ownerProfile: true },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });

    const pageItems = parties.slice(0, limit);
    const hasMore = parties.length > limit;
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

  async getOwner(organizationId: string, ownerId: string): Promise<PropertyOwnerResponse> {
    const party = await this.findOwner(organizationId, ownerId);
    return this.toResponse(party);
  }

  /**
   * Creates a Party + OwnerProfile only. Never creates User, Membership, or login credentials.
   * Property ownership ≠ application access.
   */
  async createOwner(
    organizationId: string,
    actorUserId: string,
    body: CreatePropertyOwnerRequest,
    correlationId?: string,
  ): Promise<PropertyOwnerResponse> {
    const created = await this.transactions.run(async (tx) => {
      const party = await tx.party.create({
        data: {
          tenantId: organizationId,
          partyType: body.partyType as PartyType,
          displayName: body.displayName,
          legalName: body.legalName ?? null,
          ownerProfile: {
            create: {
              tenantId: organizationId,
              ownerCategory: body.ownerCategory as OwnerCategory,
              notes: body.notes ?? null,
            },
          },
          ...(body.contacts !== undefined && body.contacts.length > 0
            ? {
                contacts: {
                  create: body.contacts.map((contact) => ({
                    tenantId: organizationId,
                    type: contact.type,
                    value: contact.value,
                    purpose: contact.purpose ?? null,
                    isPreferred: contact.isPreferred ?? false,
                  })),
                },
              }
            : {}),
        },
        include: { ownerProfile: true },
      });
      return party;
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'property_owner.create',
      outcome: 'SUCCESS',
      targetType: 'party',
      targetId: created.id,
      correlationId,
      changeSummary: {
        displayName: body.displayName,
        grantsLoginAccess: false,
      },
    });

    return this.toResponse(created);
  }

  async patchOwner(
    organizationId: string,
    actorUserId: string,
    ownerId: string,
    body: PatchPropertyOwnerRequest,
    ifMatchVersion: number,
    correlationId?: string,
  ): Promise<PropertyOwnerResponse> {
    const existing = await this.findOwner(organizationId, ownerId);
    if (existing.version !== ifMatchVersion) {
      throwVersionMismatch('Property owner version mismatch');
    }

    const updated = await this.transactions.run(async (tx) => {
      await tx.party.update({
        where: { id: ownerId },
        data: {
          ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
          ...(body.legalName !== undefined ? { legalName: body.legalName } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          version: { increment: 1 },
        },
      });

      if (body.ownerCategory !== undefined || body.notes !== undefined) {
        await tx.ownerProfile.update({
          where: { partyId: ownerId },
          data: {
            ...(body.ownerCategory !== undefined
              ? { ownerCategory: body.ownerCategory as OwnerCategory }
              : {}),
            ...(body.notes !== undefined ? { notes: body.notes } : {}),
          },
        });
      }

      return tx.party.findFirstOrThrow({
        where: { id: ownerId },
        include: { ownerProfile: true },
      });
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'property_owner.update',
      outcome: 'SUCCESS',
      targetType: 'party',
      targetId: ownerId,
      correlationId,
      changeSummary: body as Record<string, unknown>,
    });

    return this.toResponse(updated);
  }

  async archiveOwner(
    organizationId: string,
    actorUserId: string,
    ownerId: string,
    correlationId?: string,
  ): Promise<void> {
    await this.findOwner(organizationId, ownerId);

    const activeOwnership = await this.prisma.propertyOwnership.count({
      where: {
        tenantId: organizationId,
        ownerPartyId: ownerId,
        status: 'ACTIVE',
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
      },
    });
    if (activeOwnership > 0) {
      throw new ConflictException({
        message: 'Owner has active ownership interests',
        code: 'OWNER_HAS_ACTIVE_INTEREST',
      });
    }

    await this.prisma.party.update({
      where: { id: ownerId },
      data: {
        status: 'ARCHIVED',
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'property_owner.archive',
      outcome: 'SUCCESS',
      targetType: 'party',
      targetId: ownerId,
      correlationId,
    });
  }

  private async findOwner(organizationId: string, ownerId: string): Promise<PartyWithOwner> {
    const party = await this.prisma.party.findFirst({
      where: {
        id: ownerId,
        tenantId: organizationId,
        deletedAt: null,
        ownerProfile: { isNot: null },
      },
      include: { ownerProfile: true },
    });
    if (party === null) {
      throw new NotFoundException({
        message: 'Property owner not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    return party;
  }

  toResponse(party: PartyWithOwner): PropertyOwnerResponse {
    return {
      id: party.id,
      organizationId: party.tenantId,
      partyType: party.partyType,
      displayName: party.displayName,
      legalName: party.legalName,
      status: party.status,
      ownerCategory: party.ownerProfile?.ownerCategory ?? 'INDIVIDUAL',
      notes: party.ownerProfile?.notes ?? null,
      version: party.version,
      grantsLoginAccess: false,
      createdAt: party.createdAt.toISOString(),
      updatedAt: party.updatedAt.toISOString(),
    };
  }
}
