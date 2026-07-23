import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, type PropertyOwnership } from '@prisma/client';

import {
  type CreateOwnershipRequest,
  type EndOwnershipRequest,
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  type PropertyOwnershipResponse,
  type PropertyOwnershipsCollection,
} from '@rpm/contracts';

import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';
import { AuthorizationService } from '../../tenancy/application/authorization.service';

@Injectable()
export class OwnershipService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listOwnerships(
    organizationId: string,
    membershipId: string,
    propertyId: string,
    options?: { limit?: number; after?: string },
  ): Promise<PropertyOwnershipsCollection> {
    await this.authorization.assertPropertyAccess(membershipId, organizationId, propertyId);
    await this.assertPropertyExists(organizationId, propertyId);

    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);
    const ownerships = await this.prisma.propertyOwnership.findMany({
      where: {
        tenantId: organizationId,
        propertyId,
        ...(options?.after !== undefined ? { id: { gt: options.after } } : {}),
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });

    const pageItems = ownerships.slice(0, limit);
    const hasMore = ownerships.length > limit;
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

  /**
   * Records beneficial ownership. Does NOT create memberships or login access.
   */
  async createOwnership(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    propertyId: string,
    body: CreateOwnershipRequest,
    correlationId?: string,
  ): Promise<PropertyOwnershipResponse> {
    await this.authorization.assertPropertyAccess(membershipId, organizationId, propertyId);
    await this.assertPropertyExists(organizationId, propertyId);

    const owner = await this.prisma.party.findFirst({
      where: {
        id: body.ownerPartyId,
        tenantId: organizationId,
        deletedAt: null,
        ownerProfile: { isNot: null },
      },
    });
    if (owner === null) {
      throw new NotFoundException({
        message: 'Property owner not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (body.ownershipPercentage !== undefined) {
      const pct = Number(body.ownershipPercentage);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        throw new UnprocessableEntityException({
          message: 'Ownership percentage must be greater than 0 and at most 100',
          code: 'OWNERSHIP_PERCENTAGE_INVALID',
        });
      }
    }

    const effectiveFrom = new Date(body.effectiveFrom);
    const effectiveTo = body.effectiveTo !== undefined ? new Date(body.effectiveTo) : null;
    if (effectiveTo !== null && effectiveTo <= effectiveFrom) {
      throw new UnprocessableEntityException({
        message: 'Ownership effectiveTo must be after effectiveFrom',
        code: 'EFFECTIVE_DATE_INVALID',
      });
    }

    const overlapping = await this.prisma.propertyOwnership.findFirst({
      where: {
        tenantId: organizationId,
        propertyId,
        ownerPartyId: body.ownerPartyId,
        status: 'ACTIVE',
        effectiveFrom: { lt: effectiveTo ?? new Date('9999-12-31T00:00:00.000Z') },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
      },
    });
    if (overlapping !== null) {
      throw new ConflictException({
        message: 'Ownership period overlaps an existing active interest for this owner',
        code: 'OWNERSHIP_PERIOD_OVERLAP',
      });
    }

    if (body.ownershipPercentage !== undefined) {
      const openInterests = await this.prisma.propertyOwnership.findMany({
        where: {
          tenantId: organizationId,
          propertyId,
          status: 'ACTIVE',
          interestType: body.interestType,
          effectiveFrom: { lt: effectiveTo ?? new Date('9999-12-31T00:00:00.000Z') },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
        },
      });
      const existingTotal = openInterests.reduce(
        (sum, row) =>
          sum + (row.ownershipPercentage !== null ? Number(row.ownershipPercentage) : 0),
        0,
      );
      if (existingTotal + Number(body.ownershipPercentage) > 100.0001) {
        throw new ConflictException({
          message: 'Ownership share exceeds 100% for this property',
          code: 'OWNERSHIP_TOTAL_EXCEEDED',
        });
      }
    }

    const membershipCountBefore = await this.prisma.tenantMembership.count({
      where: { tenantId: organizationId },
    });

    const created = await this.prisma.propertyOwnership.create({
      data: {
        tenantId: organizationId,
        propertyId,
        ownerPartyId: body.ownerPartyId,
        interestType: body.interestType,
        ownershipPercentage:
          body.ownershipPercentage !== undefined
            ? new Prisma.Decimal(body.ownershipPercentage)
            : null,
        effectiveFrom,
        effectiveTo,
        status: 'ACTIVE',
      },
    });

    const membershipCountAfter = await this.prisma.tenantMembership.count({
      where: { tenantId: organizationId },
    });
    if (membershipCountAfter !== membershipCountBefore) {
      throw new ConflictException({
        message: 'Ownership must not create memberships',
        code: 'OWNERSHIP_MUST_NOT_GRANT_ACCESS',
      });
    }

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'property_ownership.create',
      outcome: 'SUCCESS',
      targetType: 'property_ownership',
      targetId: created.id,
      correlationId,
      changeSummary: {
        propertyId,
        ownerPartyId: body.ownerPartyId,
        grantsLoginAccess: false,
      },
    });

    return this.toResponse(created);
  }

  async endOwnership(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    ownershipId: string,
    body: EndOwnershipRequest,
    correlationId?: string,
  ): Promise<PropertyOwnershipResponse> {
    const existing = await this.prisma.propertyOwnership.findFirst({
      where: { id: ownershipId, tenantId: organizationId },
    });
    if (existing === null) {
      throw new NotFoundException({
        message: 'Ownership not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    await this.authorization.assertPropertyAccess(
      membershipId,
      organizationId,
      existing.propertyId,
    );

    if (existing.effectiveTo !== null) {
      throw new ConflictException({
        message: 'Ownership already ended',
        code: 'OWNERSHIP_ALREADY_ENDED',
      });
    }

    const updated = await this.prisma.propertyOwnership.update({
      where: { id: ownershipId },
      data: {
        effectiveTo: new Date(body.effectiveTo),
        status: 'ENDED',
        version: { increment: 1 },
      },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'property_ownership.end',
      outcome: 'SUCCESS',
      targetType: 'property_ownership',
      targetId: ownershipId,
      correlationId,
      changeSummary: { reason: body.reason, effectiveTo: body.effectiveTo },
    });

    return this.toResponse(updated);
  }

  private async assertPropertyExists(organizationId: string, propertyId: string): Promise<void> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, tenantId: organizationId, deletedAt: null },
    });
    if (property === null) {
      throw new NotFoundException({
        message: 'Property not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
  }

  toResponse(ownership: PropertyOwnership): PropertyOwnershipResponse {
    return {
      id: ownership.id,
      organizationId: ownership.tenantId,
      propertyId: ownership.propertyId,
      ownerPartyId: ownership.ownerPartyId,
      interestType: ownership.interestType,
      ownershipPercentage:
        ownership.ownershipPercentage !== null ? ownership.ownershipPercentage.toString() : null,
      effectiveFrom: ownership.effectiveFrom.toISOString(),
      effectiveTo: ownership.effectiveTo?.toISOString() ?? null,
      status: ownership.status,
      version: ownership.version,
      grantsLoginAccess: false,
      createdAt: ownership.createdAt.toISOString(),
      updatedAt: ownership.updatedAt.toISOString(),
    };
  }
}
