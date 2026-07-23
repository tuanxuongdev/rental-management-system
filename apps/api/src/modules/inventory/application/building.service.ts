import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type Building, InventoryLifecycleStatus } from '@prisma/client';

import {
  type BuildingResponse,
  type BuildingsCollection,
  type CreateBuildingRequest,
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  type PatchBuildingRequest,
} from '@rpm/contracts';

import { throwVersionMismatch } from '../../../common/auth/if-match';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';
import { AuthorizationService } from '../../tenancy/application/authorization.service';

@Injectable()
export class BuildingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listBuildings(
    organizationId: string,
    membershipId: string,
    propertyId: string,
    options?: { limit?: number; after?: string },
  ): Promise<BuildingsCollection> {
    await this.authorization.assertPropertyAccess(membershipId, organizationId, propertyId);
    await this.assertPropertyExists(organizationId, propertyId);

    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);
    const buildings = await this.prisma.building.findMany({
      where: {
        tenantId: organizationId,
        propertyId,
        deletedAt: null,
        ...(options?.after !== undefined ? { id: { gt: options.after } } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });

    const pageItems = buildings.slice(0, limit);
    const hasMore = buildings.length > limit;
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

  async createBuilding(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    propertyId: string,
    body: CreateBuildingRequest,
    correlationId?: string,
  ): Promise<BuildingResponse> {
    await this.authorization.assertPropertyAccess(membershipId, organizationId, propertyId);
    await this.assertPropertyExists(organizationId, propertyId);

    const created = await this.prisma.building.create({
      data: {
        tenantId: organizationId,
        propertyId,
        code: body.code,
        name: body.name,
        sortOrder: body.sortOrder ?? 0,
      },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'building.create',
      outcome: 'SUCCESS',
      targetType: 'building',
      targetId: created.id,
      correlationId,
      changeSummary: { propertyId, code: body.code },
    });

    return this.toResponse(created);
  }

  async getBuilding(
    organizationId: string,
    membershipId: string,
    buildingId: string,
  ): Promise<BuildingResponse> {
    const building = await this.findActive(organizationId, buildingId);
    await this.authorization.assertPropertyAccess(
      membershipId,
      organizationId,
      building.propertyId,
    );
    return this.toResponse(building);
  }

  async patchBuilding(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    buildingId: string,
    body: PatchBuildingRequest,
    ifMatchVersion: number,
    correlationId?: string,
  ): Promise<BuildingResponse> {
    const existing = await this.findActive(organizationId, buildingId);
    await this.authorization.assertPropertyAccess(
      membershipId,
      organizationId,
      existing.propertyId,
    );

    if (existing.version !== ifMatchVersion) {
      throwVersionMismatch('Building version mismatch');
    }

    const updated = await this.prisma.building.update({
      where: { id: buildingId },
      data: {
        ...(body.code !== undefined ? { code: body.code } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        version: { increment: 1 },
      },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'building.update',
      outcome: 'SUCCESS',
      targetType: 'building',
      targetId: buildingId,
      correlationId,
      changeSummary: body as Record<string, unknown>,
    });

    return this.toResponse(updated);
  }

  async archiveBuilding(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    buildingId: string,
    correlationId?: string,
  ): Promise<void> {
    const existing = await this.findActive(organizationId, buildingId);
    await this.authorization.assertPropertyAccess(
      membershipId,
      organizationId,
      existing.propertyId,
    );

    const activeUnits = await this.prisma.unit.count({
      where: {
        tenantId: organizationId,
        buildingId,
        status: InventoryLifecycleStatus.ACTIVE,
        deletedAt: null,
      },
    });
    if (activeUnits > 0) {
      throw new ConflictException({
        message: 'Cannot archive building with active units',
        code: 'BUILDING_HAS_ACTIVE_UNITS',
      });
    }

    await this.transactions.run(async (tx) => {
      await tx.building.update({
        where: { id: buildingId },
        data: {
          status: InventoryLifecycleStatus.ARCHIVED,
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'building.archive',
      outcome: 'SUCCESS',
      targetType: 'building',
      targetId: buildingId,
      correlationId,
    });
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

  private async findActive(organizationId: string, buildingId: string): Promise<Building> {
    const building = await this.prisma.building.findFirst({
      where: { id: buildingId, tenantId: organizationId, deletedAt: null },
    });
    if (building === null) {
      throw new NotFoundException({
        message: 'Building not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    return building;
  }

  toResponse(building: Building): BuildingResponse {
    return {
      id: building.id,
      organizationId: building.tenantId,
      propertyId: building.propertyId,
      code: building.code,
      name: building.name,
      status: building.status,
      sortOrder: building.sortOrder,
      version: building.version,
      createdAt: building.createdAt.toISOString(),
      updatedAt: building.updatedAt.toISOString(),
    };
  }
}
