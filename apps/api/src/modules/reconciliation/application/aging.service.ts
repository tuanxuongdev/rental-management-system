import { Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  type AgingAccount,
  type AgingBucketKey,
  type AgingBucketTotal,
  type InvoiceAgingResponse,
} from '@rpm/contracts';

import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import {
  decimalToString,
  formatDateOnly,
  parseDateOnly,
  roundMoney,
} from '../../billing/domain/billing.rules';
import { AuthorizationService } from '../../tenancy/application/authorization.service';
import { classifyAgingBucket } from '../domain/reconciliation.rules';

const EMPTY_BUCKETS: AgingBucketKey[] = [
  'CURRENT',
  'DAYS_1_30',
  'DAYS_31_60',
  'DAYS_61_90',
  'DAYS_90_PLUS',
];

@Injectable()
export class AgingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
  ) {}

  async getInvoiceAging(
    organizationId: string,
    membershipId: string,
    options: {
      asOf: string;
      currency?: string;
      propertyId?: string;
      limit?: number;
      after?: string;
    },
  ): Promise<InvoiceAgingResponse> {
    await this.authorization.assertAnyPermission(membershipId, organizationId, [
      'finance.reports.view',
      'finance.payments.list',
      'finance.invoices.list',
    ]);

    let asOf: Date;
    try {
      asOf = parseDateOnly(options.asOf);
    } catch {
      throw new UnprocessableEntityException({
        message: 'asOf must be a date-only YYYY-MM-DD',
        code: 'AS_OF_INVALID',
      });
    }

    const currency = options.currency?.toUpperCase();
    if (currency === undefined || currency.length !== 3) {
      throw new UnprocessableEntityException({
        message: 'currency is required for aging totals',
        code: 'CURRENCY_FILTER_REQUIRED_FOR_TOTAL',
      });
    }

    if (options.propertyId !== undefined) {
      await this.authorization.assertPropertyAccess(
        membershipId,
        organizationId,
        options.propertyId,
      );
    }

    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);

    const propertyFilter =
      accessible === null
        ? options.propertyId !== undefined
          ? { propertyId: options.propertyId }
          : undefined
        : {
            propertyId:
              options.propertyId !== undefined
                ? accessible.includes(options.propertyId)
                  ? options.propertyId
                  : '00000000-0000-4000-8000-000000000000'
                : { in: accessible },
          };

    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId: organizationId,
        status: { in: ['POSTED', 'PARTIALLY_PAID'] },
        currency,
        balanceAmount: { gt: 0 },
        ...(propertyFilter !== undefined ? { lease: { ...propertyFilter, deletedAt: null } } : {}),
      },
      include: { lease: { select: { propertyId: true } } },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      take: 500,
    });

    const bucketTotals = new Map<AgingBucketKey, { count: number; amount: Prisma.Decimal }>();
    for (const key of EMPTY_BUCKETS) {
      bucketTotals.set(key, { count: 0, amount: new Prisma.Decimal(0) });
    }

    const accounts: AgingAccount[] = [];
    for (const invoice of invoices) {
      const { bucket, daysPastDue } = classifyAgingBucket(invoice.dueDate, asOf);
      const entry = bucketTotals.get(bucket)!;
      entry.count += 1;
      entry.amount = entry.amount.plus(invoice.balanceAmount);
      accounts.push({
        invoiceId: invoice.id,
        leaseId: invoice.leaseId,
        propertyId: invoice.lease.propertyId,
        invoiceNumber: invoice.invoiceNumber,
        currency: invoice.currency,
        balanceAmount: decimalToString(invoice.balanceAmount),
        dueDate: invoice.dueDate !== null ? formatDateOnly(invoice.dueDate) : null,
        daysPastDue,
        bucket,
        status: invoice.status as 'POSTED' | 'PARTIALLY_PAID',
      });
    }

    const buckets: AgingBucketTotal[] = EMPTY_BUCKETS.map((bucket) => {
      const entry = bucketTotals.get(bucket)!;
      return {
        bucket,
        count: entry.count,
        amount: decimalToString(roundMoney(entry.amount)),
      };
    });

    let start = 0;
    if (options.after !== undefined) {
      const idx = accounts.findIndex((row) => row.invoiceId === options.after);
      start = idx >= 0 ? idx + 1 : 0;
    }
    const pageAccounts = accounts.slice(start, start + limit);
    const next = start + limit < accounts.length ? (pageAccounts.at(-1)?.invoiceId ?? null) : null;

    return {
      asOf: options.asOf,
      currency,
      buckets,
      accounts: pageAccounts,
      page: {
        nextCursor: next,
        previousCursor: null,
        limit,
      },
      meta: { totalAccounts: accounts.length },
    };
  }
}
