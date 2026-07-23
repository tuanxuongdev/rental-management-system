import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AllocationMode,
  InventoryLifecycleStatus,
  InventoryOperationalStatus,
} from '@prisma/client';

import {
  type AvailabilityCollection,
  type AvailabilityQuery,
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
} from '@rpm/contracts';

import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuthorizationService } from '../../tenancy/application/authorization.service';

@Injectable()
export class AvailabilityService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
  ) {}

  /**
   * Status-based availability (Sprint-05): ACTIVE operational units/beds only.
   * Full lease occupancy arrives in later sprints.
   */
  async listAvailability(
    organizationId: string,
    membershipId: string,
    query: AvailabilityQuery,
  ): Promise<AvailabilityCollection> {
    await this.authorization.assertPropertyAccess(membershipId, organizationId, query.propertyId);

    const property = await this.prisma.property.findFirst({
      where: { id: query.propertyId, tenantId: organizationId, deletedAt: null },
    });
    if (property === null) {
      throw new NotFoundException({
        message: 'Property not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const limit = normalizePaginationLimit(query.limit ?? PAGINATION_DEFAULT_LIMIT);
    const asOf = new Date().toISOString();

    const units = await this.prisma.unit.findMany({
      where: {
        tenantId: organizationId,
        propertyId: query.propertyId,
        deletedAt: null,
        status: InventoryLifecycleStatus.ACTIVE,
        operationalStatus: InventoryOperationalStatus.ACTIVE,
        ...(query.unitType !== undefined ? { unitType: query.unitType } : {}),
        ...(query.allocationMode !== undefined
          ? { allocationMode: query.allocationMode as AllocationMode }
          : {}),
        ...(query.buildingId !== undefined ? { buildingId: query.buildingId } : {}),
        ...(query.after !== undefined ? { id: { gt: query.after } } : {}),
      },
      include: {
        beds: {
          where: {
            deletedAt: null,
            status: InventoryLifecycleStatus.ACTIVE,
            operationalStatus: InventoryOperationalStatus.ACTIVE,
          },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });

    const pageUnits = units.slice(0, limit);
    const hasMore = units.length > limit;
    const last = pageUnits.at(-1);

    const data: AvailabilityCollection['data'] = [];
    for (const unit of pageUnits) {
      if (unit.allocationMode === AllocationMode.BED) {
        for (const bed of unit.beds) {
          data.push({
            unitId: unit.id,
            bedId: bed.id,
            propertyId: unit.propertyId,
            code: `${unit.code}/${bed.code}`,
            granularity: 'BED',
            operationalStatus: bed.operationalStatus,
            asOf,
          });
        }
      } else {
        data.push({
          unitId: unit.id,
          bedId: null,
          propertyId: unit.propertyId,
          code: unit.code,
          granularity: 'UNIT',
          operationalStatus: unit.operationalStatus,
          asOf,
        });
      }
    }

    return {
      data,
      page: {
        nextCursor: hasMore && last !== undefined ? last.id : null,
        previousCursor: null,
        limit,
      },
      meta: { asOf },
    };
  }
}
