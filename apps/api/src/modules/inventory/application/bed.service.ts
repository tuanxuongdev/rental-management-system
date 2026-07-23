import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AllocationMode, InventoryLifecycleStatus, type Bed } from '@prisma/client';

import {
  type BedResponse,
  type BedsCollection,
  type CreateBedRequest,
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  type PatchBedRequest,
} from '@rpm/contracts';

import { throwVersionMismatch } from '../../../common/auth/if-match';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';
import { AuthorizationService } from '../../tenancy/application/authorization.service';

@Injectable()
export class BedService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listBeds(
    organizationId: string,
    membershipId: string,
    unitId: string,
    options?: { limit?: number; after?: string },
  ): Promise<BedsCollection> {
    const unit = await this.findUnit(organizationId, unitId);
    await this.authorization.assertPropertyAccess(membershipId, organizationId, unit.propertyId);

    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);
    const beds = await this.prisma.bed.findMany({
      where: {
        tenantId: organizationId,
        unitId,
        deletedAt: null,
        ...(options?.after !== undefined ? { id: { gt: options.after } } : {}),
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });

    const pageItems = beds.slice(0, limit);
    const hasMore = beds.length > limit;
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

  async getBed(organizationId: string, membershipId: string, bedId: string): Promise<BedResponse> {
    const bed = await this.findActive(organizationId, bedId);
    const unit = await this.findUnit(organizationId, bed.unitId);
    await this.authorization.assertPropertyAccess(membershipId, organizationId, unit.propertyId);
    return this.toResponse(bed);
  }

  async createBed(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    unitId: string,
    body: CreateBedRequest,
    correlationId?: string,
  ): Promise<BedResponse> {
    const unit = await this.findUnit(organizationId, unitId);
    await this.authorization.assertPropertyAccess(membershipId, organizationId, unit.propertyId);

    if (unit.allocationMode !== AllocationMode.BED) {
      throw new UnprocessableEntityException({
        message: 'Beds are only allowed on units with allocationMode BED',
        code: 'UNIT_NOT_BED_MODE',
      });
    }

    const duplicate = await this.prisma.bed.findFirst({
      where: {
        tenantId: organizationId,
        unitId,
        code: body.code,
        deletedAt: null,
        status: InventoryLifecycleStatus.ACTIVE,
      },
    });
    if (duplicate !== null) {
      throw new ConflictException({
        message: 'Bed code already exists for this unit',
        code: 'DUPLICATE_RESOURCE',
      });
    }

    const created = await this.transactions.run(async (tx) => {
      const bed = await tx.bed.create({
        data: {
          tenantId: organizationId,
          unitId,
          code: body.code,
          label: body.label,
        },
      });
      await tx.inventoryStatusHistory.create({
        data: {
          tenantId: organizationId,
          targetType: 'BED',
          propertyId: unit.propertyId,
          unitId,
          bedId: bed.id,
          status: 'ACTIVE',
          actorUserId,
        },
      });
      return bed;
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'bed.create',
      outcome: 'SUCCESS',
      targetType: 'bed',
      targetId: created.id,
      correlationId,
      changeSummary: { unitId, code: body.code },
    });

    return this.toResponse(created);
  }

  async patchBed(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    bedId: string,
    body: PatchBedRequest,
    ifMatchVersion: number,
    correlationId?: string,
  ): Promise<BedResponse> {
    const existing = await this.findActive(organizationId, bedId);
    const unit = await this.findUnit(organizationId, existing.unitId);
    await this.authorization.assertPropertyAccess(membershipId, organizationId, unit.propertyId);

    if (existing.version !== ifMatchVersion) {
      throwVersionMismatch('Bed version mismatch');
    }

    const updated = await this.transactions.run(async (tx) => {
      const bed = await tx.bed.update({
        where: { id: bedId },
        data: {
          ...(body.code !== undefined ? { code: body.code } : {}),
          ...(body.label !== undefined ? { label: body.label } : {}),
          ...(body.operationalStatus !== undefined
            ? { operationalStatus: body.operationalStatus }
            : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          version: { increment: 1 },
        },
      });

      if (
        (body.operationalStatus !== undefined &&
          body.operationalStatus !== existing.operationalStatus) ||
        (body.status !== undefined && body.status !== existing.status)
      ) {
        await tx.inventoryStatusHistory.create({
          data: {
            tenantId: organizationId,
            targetType: 'BED',
            propertyId: unit.propertyId,
            unitId: existing.unitId,
            bedId,
            status: body.operationalStatus ?? body.status ?? existing.operationalStatus,
            actorUserId,
          },
        });
      }

      return bed;
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'bed.update',
      outcome: 'SUCCESS',
      targetType: 'bed',
      targetId: bedId,
      correlationId,
      changeSummary: body as Record<string, unknown>,
    });

    return this.toResponse(updated);
  }

  async archiveBed(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    bedId: string,
    correlationId?: string,
  ): Promise<void> {
    const existing = await this.findActive(organizationId, bedId);
    const unit = await this.findUnit(organizationId, existing.unitId);
    await this.authorization.assertPropertyAccess(membershipId, organizationId, unit.propertyId);

    await this.transactions.run(async (tx) => {
      await tx.bed.update({
        where: { id: bedId },
        data: {
          status: InventoryLifecycleStatus.ARCHIVED,
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });
      await tx.inventoryStatusHistory.create({
        data: {
          tenantId: organizationId,
          targetType: 'BED',
          propertyId: unit.propertyId,
          unitId: existing.unitId,
          bedId,
          status: InventoryLifecycleStatus.ARCHIVED,
          actorUserId,
          reason: 'archive',
        },
      });
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'bed.archive',
      outcome: 'SUCCESS',
      targetType: 'bed',
      targetId: bedId,
      correlationId,
    });
  }

  private async findUnit(organizationId: string, unitId: string) {
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

  private async findActive(organizationId: string, bedId: string): Promise<Bed> {
    const bed = await this.prisma.bed.findFirst({
      where: { id: bedId, tenantId: organizationId, deletedAt: null },
    });
    if (bed === null) {
      throw new NotFoundException({
        message: 'Bed not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    return bed;
  }

  toResponse(bed: Bed): BedResponse {
    return {
      id: bed.id,
      organizationId: bed.tenantId,
      unitId: bed.unitId,
      code: bed.code,
      label: bed.label,
      operationalStatus: bed.operationalStatus,
      status: bed.status,
      version: bed.version,
      createdAt: bed.createdAt.toISOString(),
      updatedAt: bed.updatedAt.toISOString(),
    };
  }
}
