import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  InventoryLifecycleStatus,
  InventoryOperationalStatus,
  type AllocationMode,
  type Unit,
} from '@prisma/client';

import {
  type CreateUnitRequest,
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  type PatchUnitRequest,
  type UnitResponse,
  type UnitsCollection,
  type UnitStatusRequest,
} from '@rpm/contracts';

import { throwVersionMismatch } from '../../../common/auth/if-match';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';
import { AuthorizationService } from '../../tenancy/application/authorization.service';

@Injectable()
export class UnitService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listUnits(
    organizationId: string,
    membershipId: string,
    propertyId: string,
    options?: {
      limit?: number;
      after?: string;
      status?: string;
      buildingId?: string;
      q?: string;
    },
  ): Promise<UnitsCollection> {
    await this.authorization.assertPropertyAccess(membershipId, organizationId, propertyId);
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);

    const units = await this.prisma.unit.findMany({
      where: {
        tenantId: organizationId,
        propertyId,
        deletedAt: null,
        ...(options?.status !== undefined
          ? { status: options.status as InventoryLifecycleStatus }
          : {}),
        ...(options?.buildingId !== undefined ? { buildingId: options.buildingId } : {}),
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

    const pageItems = units.slice(0, limit);
    const hasMore = units.length > limit;
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

  async listUnitsOrgWide(
    organizationId: string,
    membershipId: string,
    options?: {
      limit?: number;
      after?: string;
      propertyId?: string;
      status?: string;
      q?: string;
      unitType?: string;
      operationalStatus?: string;
    },
  ): Promise<UnitsCollection> {
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

    if (options?.propertyId !== undefined) {
      if (accessible !== null && !accessible.includes(options.propertyId)) {
        throw new NotFoundException({
          message: 'Property not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }
    }

    const propertyFilter =
      options?.propertyId !== undefined
        ? { propertyId: options.propertyId }
        : accessible !== null
          ? { propertyId: { in: accessible } }
          : {};

    const units = await this.prisma.unit.findMany({
      where: {
        tenantId: organizationId,
        deletedAt: null,
        ...propertyFilter,
        ...(options?.status !== undefined
          ? { status: options.status as InventoryLifecycleStatus }
          : {}),
        ...(options?.unitType !== undefined
          ? { unitType: options.unitType as Unit['unitType'] }
          : {}),
        ...(options?.operationalStatus !== undefined
          ? { operationalStatus: options.operationalStatus as InventoryOperationalStatus }
          : {}),
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

    const pageItems = units.slice(0, limit);
    const hasMore = units.length > limit;
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

  async getUnit(
    organizationId: string,
    membershipId: string,
    unitId: string,
  ): Promise<UnitResponse> {
    const unit = await this.findActive(organizationId, unitId);
    await this.authorization.assertPropertyAccess(membershipId, organizationId, unit.propertyId);
    return this.toResponse(unit);
  }

  async createUnit(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    propertyId: string,
    body: CreateUnitRequest,
    correlationId?: string,
  ): Promise<UnitResponse> {
    await this.authorization.assertPropertyAccess(membershipId, organizationId, propertyId);
    await this.assertPropertyExists(organizationId, propertyId);

    const duplicate = await this.prisma.unit.findFirst({
      where: {
        tenantId: organizationId,
        propertyId,
        code: body.code,
        deletedAt: null,
        status: InventoryLifecycleStatus.ACTIVE,
      },
    });
    if (duplicate !== null) {
      throw new ConflictException({
        message: 'Unit code already exists for this property',
        code: 'DUPLICATE_RESOURCE',
      });
    }

    if (body.buildingId !== undefined) {
      const building = await this.prisma.building.findFirst({
        where: {
          id: body.buildingId,
          tenantId: organizationId,
          propertyId,
          deletedAt: null,
        },
      });
      if (building === null) {
        throw new UnprocessableEntityException({
          message: 'Building does not belong to property',
          code: 'BUILDING_PROPERTY_MISMATCH',
        });
      }
    }

    const created = await this.transactions.run(async (tx) => {
      const unit = await tx.unit.create({
        data: {
          tenantId: organizationId,
          propertyId,
          code: body.code,
          name: body.name,
          unitType: body.unitType,
          allocationMode: body.allocationMode as AllocationMode,
          capacity: body.capacity,
          buildingId: body.buildingId ?? null,
          floorId: body.floorId ?? null,
          unitTypeId: body.unitTypeId ?? null,
        },
      });
      await tx.inventoryStatusHistory.create({
        data: {
          tenantId: organizationId,
          targetType: 'UNIT',
          propertyId,
          unitId: unit.id,
          status: InventoryOperationalStatus.ACTIVE,
          actorUserId,
        },
      });
      return unit;
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'unit.create',
      outcome: 'SUCCESS',
      targetType: 'unit',
      targetId: created.id,
      correlationId,
      changeSummary: { propertyId, code: body.code },
    });

    return this.toResponse(created);
  }

  async patchUnit(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    unitId: string,
    body: PatchUnitRequest,
    ifMatchVersion: number,
    correlationId?: string,
  ): Promise<UnitResponse> {
    const existing = await this.findActive(organizationId, unitId);
    await this.authorization.assertPropertyAccess(
      membershipId,
      organizationId,
      existing.propertyId,
    );

    if (existing.version !== ifMatchVersion) {
      throwVersionMismatch('Unit version mismatch');
    }

    if (body.code !== undefined && body.code !== existing.code) {
      const duplicate = await this.prisma.unit.findFirst({
        where: {
          tenantId: organizationId,
          propertyId: existing.propertyId,
          code: body.code,
          deletedAt: null,
          status: InventoryLifecycleStatus.ACTIVE,
          NOT: { id: unitId },
        },
      });
      if (duplicate !== null) {
        throw new ConflictException({
          message: 'Unit code already exists for this property',
          code: 'DUPLICATE_RESOURCE',
        });
      }
    }

    const nextAllocationMode = body.allocationMode ?? existing.allocationMode;
    if (
      body.allocationMode !== undefined &&
      body.allocationMode !== 'BED' &&
      existing.allocationMode === 'BED'
    ) {
      const activeBeds = await this.prisma.bed.count({
        where: {
          tenantId: organizationId,
          unitId,
          deletedAt: null,
          status: InventoryLifecycleStatus.ACTIVE,
        },
      });
      if (activeBeds > 0) {
        throw new ConflictException({
          message: 'Cannot change allocation mode while active beds exist',
          code: 'ALLOCATION_MODE_HAS_CONFLICTING_HISTORY',
        });
      }
    }

    const updated = await this.transactions.run(async (tx) => {
      const unit = await tx.unit.update({
        where: { id: unitId },
        data: {
          ...(body.code !== undefined ? { code: body.code } : {}),
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.unitType !== undefined ? { unitType: body.unitType } : {}),
          ...(body.allocationMode !== undefined
            ? { allocationMode: nextAllocationMode as AllocationMode }
            : {}),
          ...(body.capacity !== undefined ? { capacity: body.capacity } : {}),
          ...(body.buildingId !== undefined ? { buildingId: body.buildingId } : {}),
          ...(body.floorId !== undefined ? { floorId: body.floorId } : {}),
          ...(body.unitTypeId !== undefined ? { unitTypeId: body.unitTypeId } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          version: { increment: 1 },
        },
      });

      if (body.status !== undefined && body.status !== existing.status) {
        await tx.inventoryStatusHistory.create({
          data: {
            tenantId: organizationId,
            targetType: 'UNIT',
            propertyId: existing.propertyId,
            unitId,
            status: body.status,
            actorUserId,
          },
        });
      }

      return unit;
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'unit.update',
      outcome: 'SUCCESS',
      targetType: 'unit',
      targetId: unitId,
      correlationId,
      changeSummary: body as Record<string, unknown>,
    });

    return this.toResponse(updated);
  }

  async archiveUnit(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    unitId: string,
    correlationId?: string,
  ): Promise<void> {
    const existing = await this.findActive(organizationId, unitId);
    await this.authorization.assertPropertyAccess(
      membershipId,
      organizationId,
      existing.propertyId,
    );

    await this.transactions.run(async (tx) => {
      await tx.unit.update({
        where: { id: unitId },
        data: {
          status: InventoryLifecycleStatus.ARCHIVED,
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });
      await tx.inventoryStatusHistory.create({
        data: {
          tenantId: organizationId,
          targetType: 'UNIT',
          propertyId: existing.propertyId,
          unitId,
          status: InventoryLifecycleStatus.ARCHIVED,
          actorUserId,
          reason: 'archive',
        },
      });
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'unit.archive',
      outcome: 'SUCCESS',
      targetType: 'unit',
      targetId: unitId,
      correlationId,
    });
  }

  async restoreUnit(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    unitId: string,
    reason: string,
    correlationId?: string,
  ): Promise<UnitResponse> {
    const existing = await this.prisma.unit.findFirst({
      where: { id: unitId, tenantId: organizationId },
    });
    if (existing === null) {
      throw new NotFoundException({
        message: 'Unit not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    await this.authorization.assertPropertyAccess(
      membershipId,
      organizationId,
      existing.propertyId,
    );

    const duplicate = await this.prisma.unit.findFirst({
      where: {
        tenantId: organizationId,
        propertyId: existing.propertyId,
        code: existing.code,
        deletedAt: null,
        status: InventoryLifecycleStatus.ACTIVE,
        NOT: { id: unitId },
      },
    });
    if (duplicate !== null) {
      throw new ConflictException({
        message: 'Unit code already exists for this property',
        code: 'DUPLICATE_RESOURCE',
      });
    }

    const restored = await this.transactions.run(async (tx) => {
      const unit = await tx.unit.update({
        where: { id: unitId },
        data: {
          status: InventoryLifecycleStatus.ACTIVE,
          deletedAt: null,
          version: { increment: 1 },
        },
      });
      await tx.inventoryStatusHistory.create({
        data: {
          tenantId: organizationId,
          targetType: 'UNIT',
          propertyId: existing.propertyId,
          unitId,
          status: InventoryLifecycleStatus.ACTIVE,
          actorUserId,
          reason,
        },
      });
      return unit;
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'unit.restore',
      outcome: 'SUCCESS',
      targetType: 'unit',
      targetId: unitId,
      correlationId,
      changeSummary: { reason },
    });

    return this.toResponse(restored);
  }

  async updateOperationalStatus(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    unitId: string,
    body: UnitStatusRequest,
    ifMatchVersion: number,
    correlationId?: string,
  ): Promise<UnitResponse> {
    const existing = await this.findActive(organizationId, unitId);
    await this.authorization.assertPropertyAccess(
      membershipId,
      organizationId,
      existing.propertyId,
    );

    if (existing.version !== ifMatchVersion) {
      throwVersionMismatch('Unit version mismatch');
    }

    const updated = await this.transactions.run(async (tx) => {
      const unit = await tx.unit.update({
        where: { id: unitId },
        data: {
          operationalStatus: body.status as InventoryOperationalStatus,
          version: { increment: 1 },
        },
      });
      await tx.inventoryStatusHistory.create({
        data: {
          tenantId: organizationId,
          targetType: 'UNIT',
          propertyId: existing.propertyId,
          unitId,
          status: body.status,
          actorUserId,
          reason: body.reason,
          effectiveFrom:
            body.effectiveFrom !== undefined ? new Date(body.effectiveFrom) : new Date(),
        },
      });
      return unit;
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'unit.status',
      outcome: 'SUCCESS',
      targetType: 'unit',
      targetId: unitId,
      correlationId,
      changeSummary: { status: body.status, reason: body.reason },
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

  private async findActive(organizationId: string, unitId: string): Promise<Unit> {
    const unit = await this.prisma.unit.findFirst({
      where: { id: unitId, tenantId: organizationId, deletedAt: null },
    });
    if (unit === null) {
      throw new NotFoundException({
        message: 'Unit not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    return unit;
  }

  toResponse(unit: Unit): UnitResponse {
    return {
      id: unit.id,
      organizationId: unit.tenantId,
      propertyId: unit.propertyId,
      buildingId: unit.buildingId,
      floorId: unit.floorId,
      unitTypeId: unit.unitTypeId,
      code: unit.code,
      name: unit.name,
      unitType: unit.unitType,
      allocationMode: unit.allocationMode,
      capacity: unit.capacity,
      operationalStatus: unit.operationalStatus,
      status: unit.status,
      version: unit.version,
      createdAt: unit.createdAt.toISOString(),
      updatedAt: unit.updatedAt.toISOString(),
    };
  }
}
