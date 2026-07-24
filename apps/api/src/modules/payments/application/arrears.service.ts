import { Inject, Injectable } from '@nestjs/common';

import {
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  type ArrearsCollection,
  type ArrearsItem,
} from '@rpm/contracts';

import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { decimalToString, formatDateOnly } from '../../billing/domain/billing.rules';
import { AuthorizationService } from '../../tenancy/application/authorization.service';

import type { Prisma } from '@prisma/client';

@Injectable()
export class ArrearsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
  ) {}

  async listArrears(
    organizationId: string,
    membershipId: string,
    options?: { limit?: number; after?: string; propertyId?: string },
  ): Promise<ArrearsCollection> {
    await this.authorization.assertAnyPermission(membershipId, organizationId, [
      'finance.payments.list',
      'finance.invoices.list',
      'finance.reports.view',
    ]);

    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);
    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );

    if (options?.propertyId !== undefined) {
      await this.authorization.assertPropertyAccess(
        membershipId,
        organizationId,
        options.propertyId,
      );
    }

    const propertyScope =
      accessible === null
        ? options?.propertyId !== undefined
          ? { propertyId: options.propertyId }
          : {}
        : {
            propertyId:
              options?.propertyId !== undefined
                ? accessible.includes(options.propertyId)
                  ? options.propertyId
                  : '00000000-0000-4000-8000-000000000000'
                : { in: accessible },
          };

    const rows = await this.prisma.invoice.findMany({
      where: {
        tenantId: organizationId,
        status: { in: ['POSTED', 'PARTIALLY_PAID'] },
        balanceAmount: { gt: 0 },
        ...propertyScope,
      },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(options?.after !== undefined ? { cursor: { id: options.after }, skip: 1 } : {}),
    });

    const today = formatDateOnly(new Date());
    const page = rows.slice(0, limit);
    const last = page.at(-1);

    return {
      data: page.map((row) => this.toItem(row, today)),
      page: {
        nextCursor: rows.length > limit && last !== undefined ? last.id : null,
        previousCursor: null,
        limit,
      },
      meta: {},
    };
  }

  private toItem(
    row: {
      id: string;
      leaseId: string;
      propertyId: string;
      invoiceNumber: string | null;
      status: 'POSTED' | 'PARTIALLY_PAID' | 'DRAFT' | 'VOID' | 'PAID';
      currency: string;
      balanceAmount: Prisma.Decimal;
      dueDate: Date | null;
    },
    today: string,
  ): ArrearsItem {
    const dueDate = row.dueDate !== null ? formatDateOnly(row.dueDate) : null;
    let daysPastDue: number | null = null;
    if (dueDate !== null && dueDate < today) {
      const dueMs = Date.parse(`${dueDate}T00:00:00.000Z`);
      const todayMs = Date.parse(`${today}T00:00:00.000Z`);
      daysPastDue = Math.floor((todayMs - dueMs) / 86_400_000);
    }

    return {
      invoiceId: row.id,
      leaseId: row.leaseId,
      propertyId: row.propertyId,
      invoiceNumber: row.invoiceNumber,
      status: row.status === 'PARTIALLY_PAID' ? 'PARTIALLY_PAID' : 'POSTED',
      currency: row.currency,
      balanceAmount: decimalToString(row.balanceAmount),
      dueDate,
      daysPastDue,
    };
  }
}
