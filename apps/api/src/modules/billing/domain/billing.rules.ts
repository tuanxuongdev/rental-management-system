import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { isPrismaUniqueViolation } from '../../../infrastructure/prisma/prisma-errors';

export {
  decimalToAmountString,
  decimalToString,
  formatDateOnly,
  parseDateOnly,
} from '../../leasing/domain/lease.rules';

export const INVOICE_SEQUENCE_SETTING_KEY = 'finance.invoice_sequence' as const;
export const CREDIT_NOTE_SEQUENCE_SETTING_KEY = 'finance.credit_note_sequence' as const;

export const DEFAULT_AR_ACCOUNT_CODE = '1100' as const;
export const DEFAULT_REVENUE_ACCOUNT_CODE = '4000' as const;
export const DEFAULT_DEPOSIT_LIABILITY_ACCOUNT_CODE = '2200' as const;
export const DEFAULT_CASH_ACCOUNT_CODE = '1000' as const;
export const DEFAULT_BANK_ACCOUNT_CODE = '1010' as const;
/** Unapplied cash liability (O1 Sprint-12). */
export const DEFAULT_UNAPPLIED_ACCOUNT_CODE = '1200' as const;

export const RECEIPT_SEQUENCE_SETTING_KEY = 'finance.receipt_sequence' as const;

export function formatReceiptNumber(year: number, seq: number): string {
  return `RCP-${year}-${String(seq).padStart(6, '0')}`;
}

export const DUE_DAYS_AFTER_ISSUE = 5 as const;

const PERIOD_KEY_RE = /^(\d{4})-(\d{2})$/;

export function assertPeriodKey(periodKey: string): { year: number; month: number } {
  const match = PERIOD_KEY_RE.exec(periodKey);
  if (match === null) {
    throw new BadRequestException({
      message: 'periodKey must be YYYY-MM',
      code: 'BILLING_PERIOD_INVALID',
    });
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new BadRequestException({
      message: 'periodKey month must be 01-12',
      code: 'BILLING_PERIOD_INVALID',
    });
  }
  return { year, month };
}

/** Half-up to 4 fractional digits (ADR-0006). */
export function roundMoney(value: Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

export function priorPeriodKey(periodKey: string): string {
  const { year, month } = assertPeriodKey(periodKey);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}

/**
 * Half-open [start, end) UTC bounds for calendar month `periodKey` in `timeZone`.
 */
export function periodBounds(periodKey: string, timeZone: string): { start: Date; end: Date } {
  const { year, month } = assertPeriodKey(periodKey);
  const start = zonedLocalMidnightToUtc(year, month, 1, timeZone);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = zonedLocalMidnightToUtc(nextYear, nextMonth, 1, timeZone);
  return { start, end };
}

export function addCalendarDays(dateOnly: Date, days: number): Date {
  const next = new Date(dateOnly.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function formatInvoiceNumber(year: number, seq: number): string {
  return `INV-${year}-${String(seq).padStart(6, '0')}`;
}

export function formatCreditNoteNumber(year: number, seq: number): string {
  return `CN-${year}-${String(seq).padStart(6, '0')}`;
}

export function rentChargeKey(leaseId: string, periodKey: string): string {
  return `rent:${leaseId}:${periodKey}`;
}

export function utilityChargeKey(leaseId: string, periodKey: string, meterType: string): string {
  return `utility:${leaseId}:${periodKey}:${meterType}`;
}

export function invoicePostingKey(invoiceId: string, side: 'ar' | 'revenue'): string {
  return `invoice:${invoiceId}:${side}`;
}

export function invoiceVoidPostingKey(invoiceId: string, side: 'ar' | 'revenue'): string {
  return `invoice:${invoiceId}:void:${side}`;
}

export function creditNotePostingKey(creditNoteId: string, side: 'ar' | 'revenue'): string {
  return `credit_note:${creditNoteId}:${side}`;
}

export function billingAdvisoryLockKey(tenantId: string, periodKey: string): string {
  return `billing:${tenantId}:${periodKey}`;
}

/**
 * Convert local calendar midnight in `timeZone` to a UTC Date.
 * Uses iterative offset correction (no external TZ library).
 */
function zonedLocalMidnightToUtc(year: number, month: number, day: number, timeZone: string): Date {
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  let instant = utcGuess;
  for (let i = 0; i < 3; i += 1) {
    const parts = getZonedParts(new Date(instant), timeZone);
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const desired = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    const delta = desired - asUtc;
    if (delta === 0) {
      break;
    }
    instant += delta;
  }
  return new Date(instant);
}

function getZonedParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = dtf.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    return value !== undefined ? Number(value) : 0;
  };
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

export type SequenceSettingValue = {
  year: number;
  seq: number;
};

export function parseSequenceSetting(
  value: Prisma.JsonValue | null | undefined,
): SequenceSettingValue {
  if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const year = typeof record.year === 'number' ? record.year : new Date().getUTCFullYear();
    const seq = typeof record.seq === 'number' ? record.seq : 0;
    return { year, seq };
  }
  return { year: new Date().getUTCFullYear(), seq: 0 };
}

/**
 * Allocate next document number using tenant_settings counter (ADR-0006).
 */
export async function allocateDocumentNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  settingKey: string,
  year: number,
  format: (y: number, seq: number) => string,
): Promise<string> {
  let existing = await tx.tenantSetting.findFirst({
    where: { tenantId, settingKey },
    orderBy: { effectiveFrom: 'desc' },
  });

  if (existing !== null) {
    await tx.$queryRaw`SELECT id FROM tenant_settings WHERE id = ${existing.id}::uuid FOR UPDATE`;
    existing = await tx.tenantSetting.findFirst({
      where: { id: existing.id },
    });
  }

  if (existing === null) {
    const settingValue = { year, seq: 1 } satisfies SequenceSettingValue;
    try {
      await tx.tenantSetting.create({
        data: {
          tenantId,
          settingKey,
          settingValue,
          effectiveFrom: new Date(),
        },
      });
      return format(year, 1);
    } catch (error) {
      if (!isPrismaUniqueViolation(error)) {
        throw error;
      }
      existing = await tx.tenantSetting.findFirst({
        where: { tenantId, settingKey },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (existing === null) {
        throw error;
      }
      await tx.$queryRaw`SELECT id FROM tenant_settings WHERE id = ${existing.id}::uuid FOR UPDATE`;
      existing = await tx.tenantSetting.findFirstOrThrow({
        where: { id: existing.id },
      });
    }
  }

  const current = parseSequenceSetting(existing.settingValue);
  const nextSeq = current.year === year ? current.seq + 1 : 1;
  const settingValue = { year, seq: nextSeq } satisfies SequenceSettingValue;

  await tx.tenantSetting.update({
    where: { id: existing.id },
    data: { settingValue },
  });

  return format(year, nextSeq);
}

export async function nextInvoiceNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  year = new Date().getUTCFullYear(),
): Promise<string> {
  return allocateDocumentNumber(
    tx,
    tenantId,
    INVOICE_SEQUENCE_SETTING_KEY,
    year,
    formatInvoiceNumber,
  );
}

export async function nextCreditNoteNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  year = new Date().getUTCFullYear(),
): Promise<string> {
  return allocateDocumentNumber(
    tx,
    tenantId,
    CREDIT_NOTE_SEQUENCE_SETTING_KEY,
    year,
    formatCreditNoteNumber,
  );
}

export async function nextReceiptNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  year = new Date().getUTCFullYear(),
): Promise<string> {
  return allocateDocumentNumber(
    tx,
    tenantId,
    RECEIPT_SEQUENCE_SETTING_KEY,
    year,
    formatReceiptNumber,
  );
}
