import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { isPrismaUniqueViolation } from '../../../infrastructure/prisma/prisma-errors';

import type { AllocationMode, LeaseAllocationType } from '@prisma/client';

export const LEASE_OCCUPANCY_NOTE_VACANT =
  'Physical occupancy is vacant until move-in is recorded; lease status is contractual.' as const;
export const LEASE_OCCUPANCY_NOTE_OCCUPIED =
  'Resident has moved in; contractual allocation remains the availability source of truth until termination.' as const;
export const LEASE_OCCUPANCY_NOTE_MOVED_OUT =
  'Move-out completed; inventory release follows termination and allocation end.' as const;
export const LEASE_DEPOSIT_DISPOSITION_NOTE =
  'Deposit disposition is checklist/preview only until Sprint-10 finance ledger execution.' as const;

/** @deprecated Use occupancy-state-aware notes from lease response. */
export const LEASE_OCCUPANCY_NOTE = LEASE_OCCUPANCY_NOTE_VACANT;

export function occupancyNoteForState(state: 'NOT_MOVED_IN' | 'OCCUPIED' | 'MOVED_OUT'): string {
  switch (state) {
    case 'OCCUPIED':
      return LEASE_OCCUPANCY_NOTE_OCCUPIED;
    case 'MOVED_OUT':
      return LEASE_OCCUPANCY_NOTE_MOVED_OUT;
    default:
      return LEASE_OCCUPANCY_NOTE_VACANT;
  }
}

export function decimalToAmountString(value: Prisma.Decimal | string): string {
  if (typeof value === 'string') {
    return value;
  }
  return value.toFixed();
}

/** Alias for contract-facing amount strings (ADR-0004). */
export const decimalToString = decimalToAmountString;

export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function rangesOverlap(
  aFrom: Date,
  aTo: Date | null,
  bFrom: Date,
  bTo: Date | null,
): boolean {
  const aEnd = aTo ?? new Date('9999-12-31T23:59:59.999Z');
  const bEnd = bTo ?? new Date('9999-12-31T23:59:59.999Z');
  return aFrom < bEnd && bFrom < aEnd;
}

export function assertAllocationModeMatch(
  unitMode: AllocationMode,
  allocationType: LeaseAllocationType,
): void {
  if (unitMode !== allocationType) {
    throw new ConflictException({
      message: `Allocation type ${allocationType} does not match unit mode ${unitMode}`,
      code: 'ALLOCATION_MODE_INVALID',
    });
  }
}

export function isPostgresExclusionViolation(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Prisma may wrap exclusion as P2002 or raw; also check meta/cause
    const meta = error.meta as
      { code?: string; driverAdapterError?: { cause?: { code?: string } } } | undefined;
    if (meta?.code === '23P01') {
      return true;
    }
    if (meta?.driverAdapterError?.cause?.code === '23P01') {
      return true;
    }
  }
  if (typeof error === 'object' && error !== null) {
    const record = error as { code?: string; message?: string; meta?: { code?: string } };
    if (record.code === '23P01' || record.meta?.code === '23P01') {
      return true;
    }
    if (typeof record.message === 'string' && record.message.includes('23P01')) {
      return true;
    }
    if (
      typeof record.message === 'string' &&
      (record.message.includes('lease_allocations_whole_unit_excl') ||
        record.message.includes('lease_allocations_bed_excl') ||
        record.message.includes('conflicting key value violates exclusion'))
    ) {
      return true;
    }
  }
  return false;
}

export function throwInventoryOverbooked(detail?: string): never {
  throw new ConflictException({
    message: detail ?? 'Inventory allocation overlaps an existing active allocation',
    code: 'INVENTORY_OVERBOOKED',
  });
}

export function throwCapacityExceeded(detail?: string): never {
  throw new ConflictException({
    message: detail ?? 'Capacity allocation would exceed unit capacity',
    code: 'CAPACITY_EXCEEDED',
  });
}

export function generateLeaseNumber(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `L-${y}${m}${d}-${suffix}`;
}

export function mapPrismaExclusionError(error: unknown, options?: { capacity?: boolean }): never {
  if (options?.capacity === true) {
    throwCapacityExceeded();
  }
  if (isPostgresExclusionViolation(error)) {
    throwInventoryOverbooked();
  }
  if (isPrismaUniqueViolation(error)) {
    throw new ConflictException({
      message: 'A conflicting unique constraint was violated',
      code: 'INVENTORY_OVERBOOKED',
    });
  }
  throw error;
}
