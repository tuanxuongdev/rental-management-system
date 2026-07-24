import { Inject, Injectable } from '@nestjs/common';

import type { FinanceExportRequest, FinanceExportResponse } from '@rpm/contracts';

import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { decimalToString } from '../../billing/domain/billing.rules';
import { AuthorizationService } from '../../tenancy/application/authorization.service';

import { AgingService } from './aging.service';

@Injectable()
export class FinanceExportService {
  constructor(
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AgingService) private readonly aging: AgingService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async export(
    organizationId: string,
    membershipId: string,
    body: FinanceExportRequest,
  ): Promise<FinanceExportResponse> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.exports.create',
    );

    if (body.type === 'aging') {
      const asOf = body.asOf ?? new Date().toISOString().slice(0, 10);
      const currency = body.currency ?? 'USD';
      const aging = await this.aging.getInvoiceAging(organizationId, membershipId, {
        asOf,
        currency,
        propertyId: body.propertyId,
        limit: 100,
      });
      const columns = [
        'invoiceId',
        'invoiceNumber',
        'leaseId',
        'propertyId',
        'currency',
        'balanceAmount',
        'dueDate',
        'daysPastDue',
        'bucket',
        'status',
      ];
      const rows = aging.accounts.map((account) => ({ ...account }));
      return this.finish(body, columns, rows);
    }

    if (body.propertyId !== undefined) {
      await this.authorization.assertPropertyAccess(membershipId, organizationId, body.propertyId);
    }
    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );
    const propertyFilter =
      accessible === null
        ? body.propertyId !== undefined
          ? { propertyId: body.propertyId }
          : undefined
        : {
            propertyId:
              body.propertyId !== undefined
                ? accessible.includes(body.propertyId)
                  ? body.propertyId
                  : '00000000-0000-4000-8000-000000000000'
                : { in: accessible },
          };

    const payments = await this.prisma.paymentTransaction.findMany({
      where: {
        tenantId: organizationId,
        ...(propertyFilter !== undefined ? propertyFilter : {}),
      },
      orderBy: [{ receivedAt: 'desc' }],
      take: 100,
    });
    const columns = [
      'id',
      'amount',
      'unallocatedAmount',
      'currency',
      'channel',
      'status',
      'leaseId',
      'propertyId',
      'receivedAt',
      'externalReference',
    ];
    const rows = payments.map((payment) => ({
      id: payment.id,
      amount: decimalToString(payment.amount),
      unallocatedAmount: decimalToString(payment.unallocatedAmount),
      currency: payment.currency,
      channel: payment.channel,
      status: payment.status,
      leaseId: payment.leaseId,
      propertyId: payment.propertyId,
      receivedAt: payment.receivedAt.toISOString(),
      externalReference: payment.externalReference,
    }));
    return this.finish(body, columns, rows);
  }

  private finish(
    body: FinanceExportRequest,
    columns: string[],
    rows: Array<Record<string, unknown>>,
  ): FinanceExportResponse {
    const format = body.format ?? 'JSON';
    const response: FinanceExportResponse = {
      type: body.type,
      format,
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      columns,
      rows,
    };
    if (format === 'CSV') {
      const header = columns.join(',');
      const lines = rows.map((row) =>
        columns
          .map((col) => {
            const value = row[col];
            const text = value === null || value === undefined ? '' : String(value);
            return `"${text.replaceAll('"', '""')}"`;
          })
          .join(','),
      );
      response.csv = [header, ...lines].join('\n');
    }
    return response;
  }
}
