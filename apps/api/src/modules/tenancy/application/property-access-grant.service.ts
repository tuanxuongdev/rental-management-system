import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type PropertyAccessScopeType } from '@prisma/client';

import {
  type CreatePropertyAccessGrantRequest,
  type EndPropertyAccessGrantRequest,
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  type PropertyAccessGrantResponse,
  type PropertyAccessGrantsCollection,
} from '@rpm/contracts';

import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class PropertyAccessGrantService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listGrants(
    organizationId: string,
    membershipId: string,
    options?: { limit?: number; after?: string },
  ): Promise<PropertyAccessGrantsCollection> {
    await this.assertMembershipInOrg(organizationId, membershipId);
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);
    const now = new Date();

    const grants = await this.prisma.propertyAccessGrant.findMany({
      where: {
        tenantId: organizationId,
        membershipId,
        ...(options?.after !== undefined ? { id: { gt: options.after } } : {}),
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });

    const pageItems = grants.slice(0, limit);
    const hasMore = grants.length > limit;
    const last = pageItems.at(-1);

    return {
      data: pageItems.map((item) => this.toResponse(item)),
      page: {
        nextCursor: hasMore && last !== undefined ? last.id : null,
        previousCursor: null,
        limit,
      },
      meta: { asOf: now.toISOString() },
    };
  }

  async createGrant(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    body: CreatePropertyAccessGrantRequest,
    correlationId?: string,
  ): Promise<PropertyAccessGrantResponse> {
    await this.assertMembershipInOrg(organizationId, membershipId);

    const scopeType = body.scopeType as PropertyAccessScopeType;
    if (scopeType === 'SELECTED_PROPERTIES') {
      if (body.propertyId === undefined) {
        throw new UnprocessableEntityException({
          message: 'propertyId is required for SELECTED_PROPERTIES grants',
          code: 'PROPERTY_SCOPE_INVALID',
        });
      }
      const property = await this.prisma.property.findFirst({
        where: { id: body.propertyId, tenantId: organizationId, deletedAt: null },
        select: { id: true },
      });
      if (property === null) {
        throw new NotFoundException({
          message: 'Property not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }

      const now = new Date();
      const duplicate = await this.prisma.propertyAccessGrant.findFirst({
        where: {
          tenantId: organizationId,
          membershipId,
          propertyId: body.propertyId,
          scopeType: 'SELECTED_PROPERTIES',
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        },
      });
      if (duplicate !== null) {
        throw new ConflictException({
          message: 'Active property access grant already exists',
          code: 'DUPLICATE_RESOURCE',
        });
      }
    }

    const created = await this.prisma.propertyAccessGrant.create({
      data: {
        id: randomUUID(),
        tenantId: organizationId,
        membershipId,
        propertyId: scopeType === 'ALL_PROPERTIES' ? null : (body.propertyId ?? null),
        scopeType,
        effectiveFrom: body.effectiveFrom !== undefined ? new Date(body.effectiveFrom) : new Date(),
        effectiveTo: body.effectiveTo !== undefined ? new Date(body.effectiveTo) : null,
      },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'property_access_grant.create',
      outcome: 'SUCCESS',
      targetType: 'property_access_grant',
      targetId: created.id,
      correlationId,
      changeSummary: {
        membershipId,
        propertyId: created.propertyId,
        scopeType: created.scopeType,
        reason: body.reason,
      },
    });

    return this.toResponse(created);
  }

  async endGrant(
    organizationId: string,
    membershipId: string,
    grantId: string,
    actorUserId: string,
    body: EndPropertyAccessGrantRequest = {},
    correlationId?: string,
  ): Promise<PropertyAccessGrantResponse> {
    await this.assertMembershipInOrg(organizationId, membershipId);

    const existing = await this.prisma.propertyAccessGrant.findFirst({
      where: { id: grantId, tenantId: organizationId, membershipId },
    });
    if (existing === null) {
      throw new NotFoundException({
        message: 'Property access grant not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const now = new Date();
    if (existing.effectiveTo !== null && existing.effectiveTo <= now) {
      throw new ConflictException({
        message: 'Property access grant already ended',
        code: 'GRANT_ALREADY_ENDED',
      });
    }

    const effectiveTo = body.effectiveTo !== undefined ? new Date(body.effectiveTo) : now;
    if (effectiveTo < existing.effectiveFrom) {
      throw new UnprocessableEntityException({
        message: 'effectiveTo must be on or after effectiveFrom',
        code: 'PROPERTY_SCOPE_INVALID',
      });
    }

    const updated = await this.prisma.propertyAccessGrant.update({
      where: { id: grantId },
      data: { effectiveTo },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'property_access_grant.end',
      outcome: 'SUCCESS',
      targetType: 'property_access_grant',
      targetId: grantId,
      correlationId,
      changeSummary: {
        membershipId,
        propertyId: updated.propertyId,
        reason: body.reason,
        effectiveTo: effectiveTo.toISOString(),
      },
    });

    return this.toResponse(updated);
  }

  private async assertMembershipInOrg(organizationId: string, membershipId: string): Promise<void> {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: {
        id: membershipId,
        tenantId: organizationId,
        membershipType: 'WORKFORCE',
      },
      select: { id: true },
    });
    if (membership === null) {
      throw new NotFoundException({
        message: 'Membership not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
  }

  private toResponse(grant: {
    id: string;
    tenantId: string;
    membershipId: string;
    propertyId: string | null;
    scopeType: PropertyAccessScopeType;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): PropertyAccessGrantResponse {
    return {
      id: grant.id,
      organizationId: grant.tenantId,
      membershipId: grant.membershipId,
      propertyId: grant.propertyId,
      scopeType: grant.scopeType,
      effectiveFrom: grant.effectiveFrom.toISOString(),
      effectiveTo: grant.effectiveTo?.toISOString() ?? null,
      createdAt: grant.createdAt.toISOString(),
      updatedAt: grant.updatedAt.toISOString(),
    };
  }
}
