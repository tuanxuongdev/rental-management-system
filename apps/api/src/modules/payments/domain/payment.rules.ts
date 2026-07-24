import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { roundMoney } from '../../billing/domain/billing.rules';

export function assertPositiveMoney(amount: Prisma.Decimal, code = 'AMOUNT_INVALID'): void {
  if (roundMoney(amount).lte(0)) {
    throw new UnprocessableEntityException({
      message: 'Amount must be positive',
      code,
    });
  }
}

export function assertCurrencyMatch(left: string, right: string, code = 'CURRENCY_MISMATCH'): void {
  if (left !== right) {
    throw new UnprocessableEntityException({
      message: 'Currency must match invoice/payment currency',
      code,
    });
  }
}

export function sumAllocationAmounts(
  allocations: Array<{ amount: string | Prisma.Decimal }>,
): Prisma.Decimal {
  return allocations.reduce(
    (acc, row) => acc.plus(roundMoney(new Prisma.Decimal(row.amount))),
    new Prisma.Decimal(0),
  );
}

export function invoiceStatusAfterAllocation(
  balanceAfter: Prisma.Decimal,
): 'PAID' | 'PARTIALLY_PAID' | 'POSTED' {
  if (balanceAfter.lte(0)) {
    return 'PAID';
  }
  return 'PARTIALLY_PAID';
}

export function cashAccountChannel(channel: string): 'CASH' | 'BANK' {
  return channel === 'CASH' ? 'CASH' : 'BANK';
}

export function parseWebhookTimestamp(raw: string | undefined): Date {
  if (raw === undefined || raw.trim() === '') {
    throw new BadRequestException({
      message: 'Webhook timestamp header required',
      code: 'WEBHOOK_TIMESTAMP_REQUIRED',
    });
  }
  const asNumber = Number(raw);
  if (!Number.isFinite(asNumber)) {
    throw new BadRequestException({
      message: 'Webhook timestamp invalid',
      code: 'WEBHOOK_TIMESTAMP_INVALID',
    });
  }
  // Support seconds or milliseconds epoch.
  const ms = asNumber > 1_000_000_000_000 ? asNumber : asNumber * 1000;
  return new Date(ms);
}

export function assertWebhookTimestampWindow(
  timestamp: Date,
  now = new Date(),
  windowMs = 5 * 60 * 1000,
): void {
  const delta = Math.abs(now.getTime() - timestamp.getTime());
  if (delta > windowMs) {
    throw new BadRequestException({
      message: 'Webhook timestamp outside allowed window',
      code: 'WEBHOOK_TIMESTAMP_EXPIRED',
    });
  }
}
