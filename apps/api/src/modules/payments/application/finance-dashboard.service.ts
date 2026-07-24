import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { FinanceDashboardSummary } from '@rpm/contracts';

import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { decimalToString, roundMoney } from '../../billing/domain/billing.rules';
import { AuthorizationService } from '../../tenancy/application/authorization.service';

import { PaymentService } from './payment.service';

@Injectable()
export class FinanceDashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(PaymentService) private readonly payments: PaymentService,
  ) {}

  async getSummary(organizationId: string, membershipId: string): Promise<FinanceDashboardSummary> {
    await this.authorization.assertAnyPermission(membershipId, organizationId, [
      'finance.payments.list',
      'finance.invoices.list',
      'finance.reports.view',
    ]);

    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );
    const propertyFilter =
      accessible === null
        ? {}
        : {
            propertyId: {
              in: accessible.length > 0 ? accessible : ['00000000-0000-4000-8000-000000000000'],
            },
          };

    const unpaid = await this.prisma.invoice.findMany({
      where: {
        tenantId: organizationId,
        status: { in: ['POSTED', 'PARTIALLY_PAID'] },
        balanceAmount: { gt: 0 },
        ...propertyFilter,
      },
      select: { balanceAmount: true, currency: true },
    });

    const currency = unpaid[0]?.currency ?? 'USD';
    let outstanding = new Prisma.Decimal(0);
    for (const row of unpaid) {
      if (row.currency === currency) {
        outstanding = outstanding.plus(row.balanceAmount);
      }
    }

    const periodStart = new Date();
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);

    const collectedRows = await this.prisma.paymentTransaction.findMany({
      where: {
        tenantId: organizationId,
        status: 'SETTLED',
        receivedAt: { gte: periodStart },
        currency,
        ...propertyFilter,
      },
      select: { amount: true },
    });
    let collected = new Prisma.Decimal(0);
    for (const row of collectedRows) {
      collected = collected.plus(row.amount);
    }

    const deposits = await this.prisma.securityDeposit.findMany({
      where: {
        tenantId: organizationId,
        status: { in: ['HELD', 'PARTIALLY_DISPOSED'] },
        currency,
        lease: { deletedAt: null, ...propertyFilter },
      },
      select: { amountHeld: true },
    });
    let depositsHeld = new Prisma.Decimal(0);
    for (const row of deposits) {
      depositsHeld = depositsHeld.plus(row.amountHeld);
    }

    const recent = await this.prisma.paymentTransaction.findMany({
      where: { tenantId: organizationId, ...propertyFilter },
      include: { allocations: true, receipt: true },
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      take: 5,
    });

    return {
      organizationId,
      asOf: new Date().toISOString(),
      outstandingTotal: decimalToString(roundMoney(outstanding)),
      unpaidInvoiceCount: unpaid.length,
      collectedThisPeriod: decimalToString(roundMoney(collected)),
      depositsHeldTotal: decimalToString(roundMoney(depositsHeld)),
      currency,
      recentPayments: recent.map((row) => this.payments.toResponse(row, false)),
      financeNote:
        'Staff-only payment collection (Sprint-11). Portal pay deferred — no resident↔user linkage assumed. Reconciliation workspace is Sprint-12.',
    };
  }
}
