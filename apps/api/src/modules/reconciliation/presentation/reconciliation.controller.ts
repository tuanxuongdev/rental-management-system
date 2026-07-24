import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import {
  closeAccountingPeriodRequestSchema,
  completeReconciliationRunRequestSchema,
  createReconciliationRunRequestSchema,
  financeExportRequestSchema,
  ingestSettlementsRequestSchema,
  paginationQuerySchema,
  parallelBillingComparisonRequestSchema,
  paymentReverseRequestSchema,
  reopenAccountingPeriodRequestSchema,
  RECONCILIATION_PERMISSION_KEYS,
  resolveReconciliationItemRequestSchema,
} from '@rpm/contracts';

import { CurrentActor } from '../../../common/auth/current-actor.decorator';
import { OrganizationPathGuard } from '../../../common/auth/organization.guards';
import { PermissionsGuard } from '../../../common/auth/permissions.guard';
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../../common/auth/require-permissions.decorator';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { AgingService } from '../application/aging.service';
import { FinanceExportService } from '../application/finance-export.service';
import { ParallelComparisonService } from '../application/parallel-comparison.service';
import { PaymentReversalService } from '../application/payment-reversal.service';
import { PeriodService } from '../application/period.service';
import { ReconciliationService } from '../application/reconciliation.service';

import type { AuthActor } from '../../../common/auth/auth.types';
import type { RequestWithCorrelation } from '../../../common/context/correlation-id.middleware';
import type { Request, Response } from 'express';

@Controller('organizations/:organizationId')
@UseGuards(OrganizationPathGuard, PermissionsGuard)
export class ReconciliationController {
  constructor(
    @Inject(ReconciliationService) private readonly reconciliation: ReconciliationService,
    @Inject(AgingService) private readonly aging: AgingService,
    @Inject(PeriodService) private readonly periods: PeriodService,
    @Inject(ParallelComparisonService) private readonly comparisons: ParallelComparisonService,
    @Inject(FinanceExportService) private readonly exports: FinanceExportService,
    @Inject(PaymentReversalService) private readonly reversals: PaymentReversalService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  @Post('reconciliation-runs')
  @RequirePermissions(RECONCILIATION_PERMISSION_KEYS.PERFORM)
  async createRun(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = createReconciliationRunRequestSchema.parse(body);
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.reconciliation.createRun(
      organizationId,
      actor.membershipId!,
      actor.userId,
      parsed,
      key,
      requestHash,
      request.correlationId,
    );
    this.idempotency.writeReplayHeader(response, result.replayed);
    response.status(result.replayed ? 200 : 201);
    return result.body;
  }

  @Get('reconciliation-runs')
  @RequirePermissions(RECONCILIATION_PERMISSION_KEYS.VIEW)
  listRuns(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.reconciliation.listRuns(organizationId, actor.membershipId!, {
      limit: parsed.limit,
      after: parsed.after,
      status: typeof query.status === 'string' ? query.status : undefined,
    });
  }

  @Get('reconciliation-runs/:runId')
  @RequirePermissions(RECONCILIATION_PERMISSION_KEYS.VIEW)
  getRun(
    @Param('organizationId') organizationId: string,
    @Param('runId') runId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.reconciliation.getRun(organizationId, actor.membershipId!, runId);
  }

  @Get('reconciliation-runs/:runId/items')
  @RequirePermissions(RECONCILIATION_PERMISSION_KEYS.VIEW)
  listItems(
    @Param('organizationId') organizationId: string,
    @Param('runId') runId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.reconciliation.listItems(organizationId, actor.membershipId!, runId, {
      limit: parsed.limit,
      after: parsed.after,
      status: typeof query.status === 'string' ? query.status : undefined,
    });
  }

  @Post('reconciliation-runs/:runId/ingest-settlements')
  @RequirePermissions(RECONCILIATION_PERMISSION_KEYS.PERFORM)
  async ingest(
    @Param('organizationId') organizationId: string,
    @Param('runId') runId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = ingestSettlementsRequestSchema.parse(body);
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.reconciliation.ingestSettlements(
      organizationId,
      actor.membershipId!,
      actor.userId,
      runId,
      parsed,
      key,
      requestHash,
      request.correlationId,
    );
    this.idempotency.writeReplayHeader(response, result.replayed);
    return result.body;
  }

  @Post('reconciliation-runs/:runId/complete')
  @RequirePermissions(RECONCILIATION_PERMISSION_KEYS.PERFORM)
  async complete(
    @Param('organizationId') organizationId: string,
    @Param('runId') runId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = completeReconciliationRunRequestSchema.parse(body ?? {});
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.reconciliation.completeRun(
      organizationId,
      actor.membershipId!,
      actor.userId,
      runId,
      parsed,
      key,
      requestHash,
      request.correlationId,
    );
    this.idempotency.writeReplayHeader(response, result.replayed);
    return result.body;
  }

  @Post('reconciliation-items/:itemId/resolve')
  @RequirePermissions(RECONCILIATION_PERMISSION_KEYS.PERFORM)
  async resolveItem(
    @Param('organizationId') organizationId: string,
    @Param('itemId') itemId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = resolveReconciliationItemRequestSchema.parse(body);
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.reconciliation.resolveItem(
      organizationId,
      actor.membershipId!,
      actor.userId,
      itemId,
      parsed,
      key,
      requestHash,
      request.correlationId,
    );
    this.idempotency.writeReplayHeader(response, result.replayed);
    return result.body;
  }

  @Get('invoice-aging')
  @RequireAnyPermissions(
    RECONCILIATION_PERMISSION_KEYS.REPORTS_VIEW,
    'finance.payments.list',
    'finance.invoices.list',
  )
  invoiceAging(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    return this.aging.getInvoiceAging(organizationId, actor.membershipId!, {
      asOf: typeof query.asOf === 'string' ? query.asOf : '',
      currency: typeof query.currency === 'string' ? query.currency : undefined,
      propertyId: typeof query.propertyId === 'string' ? query.propertyId : undefined,
      limit: typeof query.limit === 'string' ? Number(query.limit) : undefined,
      after: typeof query.after === 'string' ? query.after : undefined,
    });
  }

  @Get('aging')
  @RequireAnyPermissions(
    RECONCILIATION_PERMISSION_KEYS.REPORTS_VIEW,
    'finance.payments.list',
    'finance.invoices.list',
  )
  agingAlias(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    return this.invoiceAging(organizationId, actor, query);
  }

  @Get('accounting-periods')
  @RequirePermissions(RECONCILIATION_PERMISSION_KEYS.VIEW)
  listPeriods(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.periods.listPeriods(organizationId, actor.membershipId!, {
      limit: parsed.limit,
      after: parsed.after,
    });
  }

  @Post('accounting-periods')
  @RequirePermissions(RECONCILIATION_PERMISSION_KEYS.PERIOD_CLOSE)
  ensurePeriod(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Body() body: unknown,
  ) {
    void actor;
    const periodKey =
      typeof (body as { periodKey?: string })?.periodKey === 'string'
        ? (body as { periodKey: string }).periodKey
        : '';
    return this.periods.ensureOpenPeriod(organizationId, periodKey);
  }

  @Post('accounting-periods/:periodKey/close')
  @RequirePermissions(RECONCILIATION_PERMISSION_KEYS.PERIOD_CLOSE)
  closePeriod(
    @Param('organizationId') organizationId: string,
    @Param('periodKey') periodKey: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = closeAccountingPeriodRequestSchema.parse(body ?? {});
    return this.periods.closePeriod(
      organizationId,
      actor.membershipId!,
      actor.userId,
      periodKey,
      parsed,
      request.correlationId,
    );
  }

  @Post('accounting-periods/:periodKey/reopen')
  @RequirePermissions(RECONCILIATION_PERMISSION_KEYS.PERIOD_CLOSE)
  reopenPeriod(
    @Param('organizationId') organizationId: string,
    @Param('periodKey') periodKey: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = reopenAccountingPeriodRequestSchema.parse(body);
    return this.periods.reopenPeriod(
      organizationId,
      actor.membershipId!,
      actor.userId,
      periodKey,
      parsed,
      request.correlationId,
    );
  }

  @Post('billing-comparisons/parallel')
  @RequirePermissions(RECONCILIATION_PERMISSION_KEYS.PERFORM)
  parallelCompare(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Body() body: unknown,
  ) {
    const parsed = parallelBillingComparisonRequestSchema.parse(body);
    return this.comparisons.compare(organizationId, actor.membershipId!, parsed);
  }

  @Post('exports/finance')
  @RequirePermissions(RECONCILIATION_PERMISSION_KEYS.EXPORTS)
  financeExport(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Body() body: unknown,
  ) {
    const parsed = financeExportRequestSchema.parse(body);
    return this.exports.export(organizationId, actor.membershipId!, parsed);
  }

  @Post('payments/:paymentId/reverse')
  @RequirePermissions(RECONCILIATION_PERMISSION_KEYS.REFUND_EXECUTE)
  async reversePayment(
    @Param('organizationId') organizationId: string,
    @Param('paymentId') paymentId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = paymentReverseRequestSchema.parse(body);
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.reversals.reversePayment(
      organizationId,
      actor.membershipId!,
      actor.userId,
      paymentId,
      parsed,
      key,
      requestHash,
      request.correlationId,
    );
    this.idempotency.writeReplayHeader(response, result.replayed);
    return result.body;
  }
}
