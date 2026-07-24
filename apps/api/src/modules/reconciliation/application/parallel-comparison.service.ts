import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  DEFAULT_RECONCILIATION_TOLERANCE,
  type ParallelBillingComparisonRequest,
  type ParallelBillingComparisonResponse,
} from '@rpm/contracts';

import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { decimalToString, roundMoney } from '../../billing/domain/billing.rules';
import { AuthorizationService } from '../../tenancy/application/authorization.service';

@Injectable()
export class ParallelComparisonService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
  ) {}

  async compare(
    organizationId: string,
    membershipId: string,
    body: ParallelBillingComparisonRequest,
  ): Promise<ParallelBillingComparisonResponse> {
    await this.authorization.assertAnyPermission(membershipId, organizationId, [
      'finance.reconciliation.perform',
      'finance.reports.view',
      'finance.billing_run.preview',
    ]);

    const run = await this.prisma.billingRun.findFirst({
      where: { id: body.billingRunId, tenantId: organizationId },
    });
    if (run === null) {
      throw new NotFoundException({
        message: 'Billing run not found',
        code: 'BILLING_RUN_NOT_FOUND',
      });
    }

    const billingTotal = roundMoney(run.totalsAmount ?? new Prisma.Decimal(0));
    const currency = run.currency ?? body.sourceTotals[0]?.currency ?? 'USD';
    const tolerance = roundMoney(
      new Prisma.Decimal(body.toleranceAmount ?? DEFAULT_RECONCILIATION_TOLERANCE),
    );

    const variances = body.sourceTotals.map((source) => {
      const sourceAmount = roundMoney(new Prisma.Decimal(source.amount));
      const varianceAmount = roundMoney(sourceAmount.minus(billingTotal));
      return {
        label: source.label,
        sourceAmount: decimalToString(sourceAmount),
        billingAmount: decimalToString(billingTotal),
        varianceAmount: decimalToString(varianceAmount),
        currency: source.currency || currency,
        withinTolerance: varianceAmount.abs().lte(tolerance),
      };
    });

    return {
      billingRunId: run.id,
      billingTotal: decimalToString(billingTotal),
      currency,
      toleranceAmount: decimalToString(tolerance),
      withinTolerance: variances.every((row) => row.withinTolerance),
      variances,
    };
  }
}
