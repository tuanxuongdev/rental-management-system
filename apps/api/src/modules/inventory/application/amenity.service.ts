import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type Amenity } from '@prisma/client';

import {
  type AmenitiesCollection,
  type AmenityResponse,
  type CreateAmenityRequest,
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  type PropertyResponse,
  type ReplaceAmenitiesRequest,
  type UnitResponse,
} from '@rpm/contracts';

import { throwVersionMismatch } from '../../../common/auth/if-match';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';
import { AuthorizationService } from '../../tenancy/application/authorization.service';

import { PropertyService } from './property.service';
import { UnitService } from './unit.service';

@Injectable()
export class AmenityService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PropertyService) private readonly properties: PropertyService,
    @Inject(UnitService) private readonly units: UnitService,
  ) {}

  async listAmenities(
    organizationId: string,
    options?: { limit?: number; after?: string; q?: string },
  ): Promise<AmenitiesCollection> {
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);
    const amenities = await this.prisma.amenity.findMany({
      where: {
        tenantId: organizationId,
        ...(options?.q !== undefined
          ? {
              OR: [
                { code: { contains: options.q, mode: 'insensitive' } },
                { name: { contains: options.q, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(options?.after !== undefined ? { id: { gt: options.after } } : {}),
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });

    const pageItems = amenities.slice(0, limit);
    const hasMore = amenities.length > limit;
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

  async createAmenity(
    organizationId: string,
    actorUserId: string,
    body: CreateAmenityRequest,
    correlationId?: string,
  ): Promise<AmenityResponse> {
    const duplicate = await this.prisma.amenity.findFirst({
      where: { tenantId: organizationId, code: body.code },
    });
    if (duplicate !== null) {
      throw new ConflictException({
        message: 'Amenity code already exists',
        code: 'DUPLICATE_RESOURCE',
      });
    }

    const created = await this.prisma.amenity.create({
      data: {
        tenantId: organizationId,
        code: body.code,
        name: body.name,
        category: body.category ?? null,
      },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'amenity.create',
      outcome: 'SUCCESS',
      targetType: 'amenity',
      targetId: created.id,
      correlationId,
      changeSummary: { code: body.code },
    });

    return this.toResponse(created);
  }

  async replacePropertyAmenities(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    propertyId: string,
    body: ReplaceAmenitiesRequest,
    ifMatchVersion: number,
    correlationId?: string,
  ): Promise<PropertyResponse> {
    await this.authorization.assertPropertyAccess(membershipId, organizationId, propertyId);
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, tenantId: organizationId, deletedAt: null },
    });
    if (property === null) {
      throw new NotFoundException({
        message: 'Property not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    if (property.version !== ifMatchVersion) {
      throwVersionMismatch('Property version mismatch');
    }

    await this.assertAmenitiesBelongToOrg(organizationId, body.amenityIds);

    await this.transactions.run(async (tx) => {
      await tx.propertyAmenity.deleteMany({
        where: { tenantId: organizationId, propertyId },
      });
      if (body.amenityIds.length > 0) {
        await tx.propertyAmenity.createMany({
          data: body.amenityIds.map((amenityId) => ({
            tenantId: organizationId,
            propertyId,
            amenityId,
          })),
        });
      }
      await tx.property.update({
        where: { id: propertyId },
        data: { version: { increment: 1 } },
      });
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'property.amenities.replace',
      outcome: 'SUCCESS',
      targetType: 'property',
      targetId: propertyId,
      correlationId,
      changeSummary: { amenityIds: body.amenityIds },
    });

    return this.properties.getProperty(organizationId, membershipId, propertyId);
  }

  async replaceUnitAmenities(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    unitId: string,
    body: ReplaceAmenitiesRequest,
    ifMatchVersion: number,
    correlationId?: string,
  ): Promise<UnitResponse> {
    const unit = await this.prisma.unit.findFirst({
      where: { id: unitId, tenantId: organizationId, deletedAt: null },
    });
    if (unit === null) {
      throw new NotFoundException({
        message: 'Unit not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    await this.authorization.assertPropertyAccess(membershipId, organizationId, unit.propertyId);
    if (unit.version !== ifMatchVersion) {
      throwVersionMismatch('Unit version mismatch');
    }

    await this.assertAmenitiesBelongToOrg(organizationId, body.amenityIds);

    await this.transactions.run(async (tx) => {
      await tx.unitAmenity.deleteMany({
        where: { tenantId: organizationId, unitId },
      });
      if (body.amenityIds.length > 0) {
        await tx.unitAmenity.createMany({
          data: body.amenityIds.map((amenityId) => ({
            tenantId: organizationId,
            unitId,
            amenityId,
          })),
        });
      }
      await tx.unit.update({
        where: { id: unitId },
        data: { version: { increment: 1 } },
      });
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'unit.amenities.replace',
      outcome: 'SUCCESS',
      targetType: 'unit',
      targetId: unitId,
      correlationId,
      changeSummary: { amenityIds: body.amenityIds },
    });

    return this.units.getUnit(organizationId, membershipId, unitId);
  }

  private async assertAmenitiesBelongToOrg(
    organizationId: string,
    amenityIds: readonly string[],
  ): Promise<void> {
    if (amenityIds.length === 0) {
      return;
    }
    const count = await this.prisma.amenity.count({
      where: { tenantId: organizationId, id: { in: [...amenityIds] } },
    });
    if (count !== amenityIds.length) {
      throw new NotFoundException({
        message: 'Amenity not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
  }

  toResponse(amenity: Amenity): AmenityResponse {
    return {
      id: amenity.id,
      organizationId: amenity.tenantId,
      code: amenity.code,
      name: amenity.name,
      category: amenity.category,
      status: amenity.status,
      createdAt: amenity.createdAt.toISOString(),
      updatedAt: amenity.updatedAt.toISOString(),
    };
  }
}
