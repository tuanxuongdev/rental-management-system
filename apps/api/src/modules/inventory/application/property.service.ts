import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type InventoryHistoryTargetType, type Property, PropertyStatus } from '@prisma/client';

import {
  type CreatePropertyRequest,
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  type PatchPropertyRequest,
  type PropertiesCollection,
  type PropertyResponse,
} from '@rpm/contracts';

import { throwVersionMismatch } from '../../../common/auth/if-match';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';
import { AuthorizationService } from '../../tenancy/application/authorization.service';

@Injectable()
export class PropertyService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listProperties(
    organizationId: string,
    membershipId: string,
    options?: { limit?: number; after?: string; status?: string; q?: string },
  ): Promise<PropertiesCollection> {
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);
    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );

    if (accessible !== null && accessible.length === 0) {
      return {
        data: [],
        page: { nextCursor: null, previousCursor: null, limit },
        meta: {},
      };
    }

    const idFilter =
      accessible !== null && options?.after !== undefined
        ? { id: { in: accessible, gt: options.after } }
        : accessible !== null
          ? { id: { in: accessible } }
          : options?.after !== undefined
            ? { id: { gt: options.after } }
            : {};

    const properties = await this.prisma.property.findMany({
      where: {
        tenantId: organizationId,
        deletedAt: null,
        ...idFilter,
        ...(options?.status !== undefined ? { status: options.status as PropertyStatus } : {}),
        ...(options?.q !== undefined
          ? {
              OR: [
                { code: { contains: options.q, mode: 'insensitive' } },
                { name: { contains: options.q, mode: 'insensitive' } },
                { addressLine1: { contains: options.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });

    const pageItems = properties.slice(0, limit);
    const hasMore = properties.length > limit;
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

  async getProperty(
    organizationId: string,
    membershipId: string,
    propertyId: string,
  ): Promise<PropertyResponse> {
    await this.authorization.assertPropertyAccess(membershipId, organizationId, propertyId);
    const property = await this.findActive(organizationId, propertyId);
    return this.toResponse(property);
  }

  async createProperty(
    organizationId: string,
    actorUserId: string,
    membershipId: string,
    body: CreatePropertyRequest,
    correlationId?: string,
  ): Promise<PropertyResponse> {
    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );

    const created = await this.transactions.run(async (tx) => {
      const property = await tx.property.create({
        data: {
          tenantId: organizationId,
          code: body.code,
          name: body.name,
          propertyType: body.propertyType,
          addressLine1: body.addressLine1,
          addressLine2: body.addressLine2 ?? null,
          city: body.city,
          region: body.region ?? null,
          postalCode: body.postalCode ?? null,
          countryCode: body.countryCode,
          timeZone: body.timeZone,
          defaultCurrency: body.defaultCurrency,
          status: PropertyStatus.ACTIVE,
        },
      });

      await tx.inventoryStatusHistory.create({
        data: {
          tenantId: organizationId,
          targetType: 'PROPERTY' as InventoryHistoryTargetType,
          propertyId: property.id,
          status: PropertyStatus.ACTIVE,
          actorUserId,
        },
      });

      // Property-scoped actors (SELECTED_PROPERTIES) must receive an explicit grant
      // so the newly created property is visible under non-disclosure rules.
      if (accessible !== null) {
        await tx.propertyAccessGrant.create({
          data: {
            tenantId: organizationId,
            membershipId,
            propertyId: property.id,
            scopeType: 'SELECTED_PROPERTIES',
          },
        });
      }

      return property;
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'property.create',
      outcome: 'SUCCESS',
      targetType: 'property',
      targetId: created.id,
      correlationId,
      changeSummary: { code: created.code, name: created.name },
    });

    return this.toResponse(created);
  }

  async patchProperty(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    propertyId: string,
    body: PatchPropertyRequest,
    ifMatchVersion: number,
    correlationId?: string,
  ): Promise<PropertyResponse> {
    await this.authorization.assertPropertyAccess(membershipId, organizationId, propertyId);
    const existing = await this.findActive(organizationId, propertyId);

    if (existing.version !== ifMatchVersion) {
      throwVersionMismatch('Property version mismatch');
    }

    const updated = await this.transactions.run(async (tx) => {
      const property = await tx.property.update({
        where: { id: propertyId },
        data: {
          ...(body.code !== undefined ? { code: body.code } : {}),
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.propertyType !== undefined ? { propertyType: body.propertyType } : {}),
          ...(body.addressLine1 !== undefined ? { addressLine1: body.addressLine1 } : {}),
          ...(body.addressLine2 !== undefined ? { addressLine2: body.addressLine2 } : {}),
          ...(body.city !== undefined ? { city: body.city } : {}),
          ...(body.region !== undefined ? { region: body.region } : {}),
          ...(body.postalCode !== undefined ? { postalCode: body.postalCode } : {}),
          ...(body.countryCode !== undefined ? { countryCode: body.countryCode } : {}),
          ...(body.timeZone !== undefined ? { timeZone: body.timeZone } : {}),
          ...(body.defaultCurrency !== undefined ? { defaultCurrency: body.defaultCurrency } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          version: { increment: 1 },
        },
      });

      if (body.status !== undefined && body.status !== existing.status) {
        await tx.inventoryStatusHistory.create({
          data: {
            tenantId: organizationId,
            targetType: 'PROPERTY',
            propertyId,
            status: body.status,
            actorUserId,
          },
        });
      }

      return property;
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'property.update',
      outcome: 'SUCCESS',
      targetType: 'property',
      targetId: propertyId,
      correlationId,
      changeSummary: body as Record<string, unknown>,
    });

    return this.toResponse(updated);
  }

  async archiveProperty(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    propertyId: string,
    correlationId?: string,
  ): Promise<void> {
    await this.authorization.assertPropertyAccess(membershipId, organizationId, propertyId);
    const existing = await this.findActive(organizationId, propertyId);

    const activeUnits = await this.prisma.unit.count({
      where: {
        tenantId: organizationId,
        propertyId,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    if (activeUnits > 0) {
      throw new ConflictException({
        message: 'Cannot archive property with active units',
        code: 'PROPERTY_HAS_ACTIVE_UNITS',
      });
    }

    await this.transactions.run(async (tx) => {
      await tx.property.update({
        where: { id: propertyId },
        data: {
          status: PropertyStatus.ARCHIVED,
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });
      await tx.inventoryStatusHistory.create({
        data: {
          tenantId: organizationId,
          targetType: 'PROPERTY',
          propertyId,
          status: PropertyStatus.ARCHIVED,
          actorUserId,
          reason: 'archive',
        },
      });
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'property.archive',
      outcome: 'SUCCESS',
      targetType: 'property',
      targetId: propertyId,
      correlationId,
      changeSummary: { previousStatus: existing.status },
    });
  }

  async restoreProperty(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    propertyId: string,
    reason: string,
    correlationId?: string,
  ): Promise<PropertyResponse> {
    await this.authorization.assertPropertyAccess(membershipId, organizationId, propertyId, {
      includeDeleted: true,
    });
    const existing = await this.prisma.property.findFirst({
      where: { id: propertyId, tenantId: organizationId },
    });
    if (existing === null) {
      throw new NotFoundException({
        message: 'Property not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    if (existing.deletedAt === null && existing.status !== PropertyStatus.ARCHIVED) {
      throw new ConflictException({
        message: 'Property is not archived',
        code: 'PROPERTY_NOT_RESTORABLE',
      });
    }

    const restored = await this.transactions.run(async (tx) => {
      const property = await tx.property.update({
        where: { id: propertyId },
        data: {
          status: PropertyStatus.ACTIVE,
          deletedAt: null,
          version: { increment: 1 },
        },
      });
      await tx.inventoryStatusHistory.create({
        data: {
          tenantId: organizationId,
          targetType: 'PROPERTY',
          propertyId,
          status: PropertyStatus.ACTIVE,
          actorUserId,
          reason,
        },
      });
      return property;
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'property.restore',
      outcome: 'SUCCESS',
      targetType: 'property',
      targetId: propertyId,
      correlationId,
      changeSummary: { reason },
    });

    return this.toResponse(restored);
  }

  private async findActive(organizationId: string, propertyId: string): Promise<Property> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, tenantId: organizationId, deletedAt: null },
    });
    if (property === null) {
      throw new NotFoundException({
        message: 'Property not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    return property;
  }

  toResponse(property: Property): PropertyResponse {
    return {
      id: property.id,
      organizationId: property.tenantId,
      code: property.code,
      name: property.name,
      propertyType: property.propertyType,
      addressLine1: property.addressLine1,
      addressLine2: property.addressLine2,
      city: property.city,
      region: property.region,
      postalCode: property.postalCode,
      countryCode: property.countryCode,
      timeZone: property.timeZone,
      defaultCurrency: property.defaultCurrency,
      status: property.status,
      version: property.version,
      createdAt: property.createdAt.toISOString(),
      updatedAt: property.updatedAt.toISOString(),
    };
  }
}
