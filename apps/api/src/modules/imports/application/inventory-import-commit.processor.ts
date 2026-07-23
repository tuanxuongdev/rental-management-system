import {
  type AllocationMode,
  ImportJobRowStatus,
  ImportJobStatus,
  InventoryLifecycleStatus,
  InventoryOperationalStatus,
  PropertyStatus,
  type PropertyType,
  type UnitTypeKind,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';

import type { InventoryImportRowDto } from './inventory-import.types';

export const INVENTORY_IMPORT_COMMIT_EVENT = 'inventory.import.commit' as const;

export type InventoryImportCommitPayload = {
  tenantId: string;
  organizationId?: string;
  importJobId: string;
  actorUserId: string;
};

function isDto(value: unknown): value is InventoryImportRowDto {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as InventoryImportRowDto).propertyCode === 'string' &&
    typeof (value as InventoryImportRowDto).unitCode === 'string'
  );
}

function asCounts(value: Prisma.JsonValue): {
  total: number;
  accepted: number;
  rejected: number;
  skipped: number;
  applied: number;
} {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { total: 0, accepted: 0, rejected: 0, skipped: 0, applied: 0 };
  }
  const record = value as Record<string, unknown>;
  return {
    total: typeof record.total === 'number' ? record.total : 0,
    accepted: typeof record.accepted === 'number' ? record.accepted : 0,
    rejected: typeof record.rejected === 'number' ? record.rejected : 0,
    skipped: typeof record.skipped === 'number' ? record.skipped : 0,
    applied: typeof record.applied === 'number' ? record.applied : 0,
  };
}

/**
 * Resume-safe inventory import commit.
 * Upserts by natural keys; unique partial indexes prevent duplicate active units/beds.
 */
export async function processInventoryImportCommit(
  prisma: PrismaClient,
  payload: InventoryImportCommitPayload,
): Promise<{ applied: number; status: ImportJobStatus }> {
  const tenantId = payload.tenantId;
  const job = await prisma.importJob.findFirst({
    where: { id: payload.importJobId, tenantId, deletedAt: null },
  });

  if (job === null) {
    return { applied: 0, status: ImportJobStatus.FAILED };
  }

  if (
    job.status === ImportJobStatus.COMPLETED ||
    job.status === ImportJobStatus.PARTIALLY_COMPLETED
  ) {
    return { applied: asCounts(job.counts).applied, status: job.status };
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: { status: ImportJobStatus.PROCESSING },
  });

  const rows = await prisma.importJobRow.findMany({
    where: {
      tenantId,
      jobId: job.id,
      status: ImportJobRowStatus.ACCEPTED,
    },
    orderBy: { rowNumber: 'asc' },
  });

  let applied = 0;
  const propertyCache = new Map<string, string>();
  const buildingCache = new Map<string, string>();
  const unitCache = new Map<string, string>();

  try {
    for (const row of rows) {
      if (!isDto(row.payload)) {
        continue;
      }
      const dto = row.payload;

      const propertyId = await upsertProperty(prisma, tenantId, dto, propertyCache);
      let buildingId: string | null = null;
      if (dto.buildingCode) {
        buildingId = await upsertBuilding(
          prisma,
          tenantId,
          propertyId,
          dto.buildingCode,
          buildingCache,
        );
      }

      const unitId = await upsertUnit(
        prisma,
        tenantId,
        propertyId,
        buildingId,
        dto,
        payload.actorUserId,
        unitCache,
      );

      if (dto.allocationMode === 'BED' && dto.bedCode && dto.bedLabel) {
        await upsertBed(prisma, tenantId, unitId, dto, payload.actorUserId);
      }

      if (dto.amenityCodes.length > 0) {
        await linkAmenities(prisma, tenantId, propertyId, unitId, dto.amenityCodes);
      }

      applied += 1;
      const progressCounts = { ...asCounts(job.counts), applied };
      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          counts: progressCounts as Prisma.InputJsonValue,
        },
      });
    }

    const counts = asCounts(job.counts);
    const finalCounts = { ...counts, applied };
    const hasRejects = counts.rejected > 0 || counts.skipped > 0;
    const status =
      counts.accepted > 0 && applied === 0
        ? ImportJobStatus.FAILED
        : hasRejects
          ? ImportJobStatus.PARTIALLY_COMPLETED
          : ImportJobStatus.COMPLETED;

    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status,
        counts: finalCounts as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    });

    return { applied, status };
  } catch {
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: ImportJobStatus.FAILED,
        counts: { ...asCounts(job.counts), applied } as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    });
    throw new Error(`inventory.import.commit failed for job ${job.id}`);
  }
}

async function upsertProperty(
  prisma: PrismaClient,
  tenantId: string,
  dto: InventoryImportRowDto,
  cache: Map<string, string>,
): Promise<string> {
  const cached = cache.get(dto.propertyCode);
  if (cached !== undefined) {
    return cached;
  }

  const existing = await prisma.property.findFirst({
    where: { tenantId, code: dto.propertyCode, deletedAt: null },
  });

  if (existing !== null) {
    const updated = await prisma.property.update({
      where: { id: existing.id },
      data: {
        name: dto.propertyName,
        propertyType: dto.propertyType as PropertyType,
        addressLine1: dto.addressLine1,
        city: dto.city,
        region: dto.region,
        postalCode: dto.postalCode,
        countryCode: dto.countryCode,
        timeZone: dto.timeZone,
        defaultCurrency: dto.defaultCurrency,
        version: { increment: 1 },
      },
    });
    cache.set(dto.propertyCode, updated.id);
    return updated.id;
  }

  const created = await prisma.property.create({
    data: {
      tenantId,
      code: dto.propertyCode,
      name: dto.propertyName,
      propertyType: dto.propertyType as PropertyType,
      addressLine1: dto.addressLine1,
      city: dto.city,
      region: dto.region,
      postalCode: dto.postalCode,
      countryCode: dto.countryCode,
      timeZone: dto.timeZone,
      defaultCurrency: dto.defaultCurrency,
      status: PropertyStatus.ACTIVE,
    },
  });
  cache.set(dto.propertyCode, created.id);
  return created.id;
}

async function upsertBuilding(
  prisma: PrismaClient,
  tenantId: string,
  propertyId: string,
  buildingCode: string,
  cache: Map<string, string>,
): Promise<string> {
  const key = `${propertyId}::${buildingCode}`;
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const existing = await prisma.building.findFirst({
    where: {
      tenantId,
      propertyId,
      code: buildingCode,
      deletedAt: null,
      status: InventoryLifecycleStatus.ACTIVE,
    },
  });

  if (existing !== null) {
    cache.set(key, existing.id);
    return existing.id;
  }

  const created = await prisma.building.create({
    data: {
      tenantId,
      propertyId,
      code: buildingCode,
      name: buildingCode,
    },
  });
  cache.set(key, created.id);
  return created.id;
}

async function upsertUnit(
  prisma: PrismaClient,
  tenantId: string,
  propertyId: string,
  buildingId: string | null,
  dto: InventoryImportRowDto,
  actorUserId: string,
  cache: Map<string, string>,
): Promise<string> {
  const key = `${propertyId}::${dto.unitCode}`;
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const existing = await prisma.unit.findFirst({
    where: {
      tenantId,
      propertyId,
      code: dto.unitCode,
      deletedAt: null,
      status: InventoryLifecycleStatus.ACTIVE,
    },
  });

  if (existing !== null) {
    const updated = await prisma.unit.update({
      where: { id: existing.id },
      data: {
        name: dto.unitName,
        unitType: dto.unitType as UnitTypeKind,
        allocationMode: dto.allocationMode as AllocationMode,
        capacity: dto.capacity,
        buildingId,
        version: { increment: 1 },
      },
    });
    cache.set(key, updated.id);
    return updated.id;
  }

  const created = await prisma.unit.create({
    data: {
      tenantId,
      propertyId,
      buildingId,
      code: dto.unitCode,
      name: dto.unitName,
      unitType: dto.unitType as UnitTypeKind,
      allocationMode: dto.allocationMode as AllocationMode,
      capacity: dto.capacity,
    },
  });

  await prisma.inventoryStatusHistory.create({
    data: {
      tenantId,
      targetType: 'UNIT',
      propertyId,
      unitId: created.id,
      status: InventoryOperationalStatus.ACTIVE,
      actorUserId,
    },
  });

  cache.set(key, created.id);
  return created.id;
}

async function upsertBed(
  prisma: PrismaClient,
  tenantId: string,
  unitId: string,
  dto: InventoryImportRowDto,
  actorUserId: string,
): Promise<void> {
  const existing = await prisma.bed.findFirst({
    where: {
      tenantId,
      unitId,
      code: dto.bedCode!,
      deletedAt: null,
      status: InventoryLifecycleStatus.ACTIVE,
    },
  });

  if (existing !== null) {
    await prisma.bed.update({
      where: { id: existing.id },
      data: {
        label: dto.bedLabel!,
        version: { increment: 1 },
      },
    });
    return;
  }

  const created = await prisma.bed.create({
    data: {
      tenantId,
      unitId,
      code: dto.bedCode!,
      label: dto.bedLabel!,
    },
  });

  const unit = await prisma.unit.findFirstOrThrow({ where: { id: unitId } });
  await prisma.inventoryStatusHistory.create({
    data: {
      tenantId,
      targetType: 'BED',
      propertyId: unit.propertyId,
      unitId,
      bedId: created.id,
      status: InventoryOperationalStatus.ACTIVE,
      actorUserId,
    },
  });
}

async function linkAmenities(
  prisma: PrismaClient,
  tenantId: string,
  propertyId: string,
  unitId: string,
  amenityCodes: string[],
): Promise<void> {
  const amenities = await prisma.amenity.findMany({
    where: { tenantId, code: { in: amenityCodes }, status: InventoryLifecycleStatus.ACTIVE },
  });

  for (const amenity of amenities) {
    await prisma.propertyAmenity.upsert({
      where: {
        propertyId_amenityId: { propertyId, amenityId: amenity.id },
      },
      create: { tenantId, propertyId, amenityId: amenity.id },
      update: {},
    });
    await prisma.unitAmenity.upsert({
      where: {
        unitId_amenityId: { unitId, amenityId: amenity.id },
      },
      create: { tenantId, unitId, amenityId: amenity.id },
      update: {},
    });
  }
}
