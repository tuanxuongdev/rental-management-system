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
  allocationCreateSchema,
  createDepositDispositionRequestSchema,
  dispositionDecisionRequestSchema,
  executeDepositDispositionRequestSchema,
  manualPaymentCreateSchema,
  paginationQuerySchema,
  PAYMENT_PERMISSION_KEYS,
  paymentIntentCreateSchema,
  refundCreateSchema,
  refundDecisionRequestSchema,
  refundExecuteRequestSchema,
} from '@rpm/contracts';

import { CurrentActor } from '../../../common/auth/current-actor.decorator';
import { OrganizationPathGuard } from '../../../common/auth/organization.guards';
import { PermissionsGuard } from '../../../common/auth/permissions.guard';
import { RequirePermissions } from '../../../common/auth/require-permissions.decorator';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { ArrearsService } from '../application/arrears.service';
import { DepositDispositionService } from '../application/deposit-disposition.service';
import { FinanceDashboardService } from '../application/finance-dashboard.service';
import { PaymentIntentService } from '../application/payment-intent.service';
import { PaymentService } from '../application/payment.service';
import { ReceiptService } from '../application/receipt.service';
import { RefundService } from '../application/refund.service';

import type { AuthActor } from '../../../common/auth/auth.types';
import type { RequestWithCorrelation } from '../../../common/context/correlation-id.middleware';
import type { Request, Response } from 'express';

@Controller('organizations/:organizationId')
@UseGuards(OrganizationPathGuard, PermissionsGuard)
export class PaymentsController {
  constructor(
    @Inject(PaymentService) private readonly payments: PaymentService,
    @Inject(PaymentIntentService) private readonly intents: PaymentIntentService,
    @Inject(ReceiptService) private readonly receipts: ReceiptService,
    @Inject(RefundService) private readonly refunds: RefundService,
    @Inject(ArrearsService) private readonly arrears: ArrearsService,
    @Inject(FinanceDashboardService) private readonly dashboard: FinanceDashboardService,
    @Inject(DepositDispositionService)
    private readonly dispositions: DepositDispositionService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  @Get('payments')
  @RequirePermissions(PAYMENT_PERMISSION_KEYS.LIST)
  listPayments(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.payments.listPayments(organizationId, actor.membershipId!, {
      limit: parsed.limit,
      after: parsed.after,
      leaseId: typeof query.leaseId === 'string' ? query.leaseId : undefined,
      propertyId: typeof query.propertyId === 'string' ? query.propertyId : undefined,
      status: typeof query.status === 'string' ? query.status : undefined,
      channel: typeof query.channel === 'string' ? query.channel : undefined,
    });
  }

  @Get('payments/:paymentId')
  @RequirePermissions(PAYMENT_PERMISSION_KEYS.VIEW)
  getPayment(
    @Param('organizationId') organizationId: string,
    @Param('paymentId') paymentId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.payments.getPayment(organizationId, actor.membershipId!, paymentId);
  }

  @Post('payments')
  @RequirePermissions(PAYMENT_PERMISSION_KEYS.RECORD)
  async recordPayment(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = manualPaymentCreateSchema.parse(body);
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.payments.recordManual(
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

  @Post('payment-transactions/:paymentTransactionId/allocations')
  @RequirePermissions(PAYMENT_PERMISSION_KEYS.ALLOCATE)
  async allocate(
    @Param('organizationId') organizationId: string,
    @Param('paymentTransactionId') paymentTransactionId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = allocationCreateSchema.parse(body);
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.payments.allocate(
      organizationId,
      actor.membershipId!,
      actor.userId,
      paymentTransactionId,
      parsed,
      key,
      requestHash,
      request.correlationId,
    );
    this.idempotency.writeReplayHeader(response, result.replayed);
    response.status(result.replayed ? 200 : 201);
    return result.body;
  }

  @Post('payment-intents')
  @RequirePermissions(PAYMENT_PERMISSION_KEYS.RECORD)
  async createIntent(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = paymentIntentCreateSchema.parse(body);
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.intents.createIntent(
      organizationId,
      actor.membershipId!,
      parsed,
      key,
      requestHash,
    );
    this.idempotency.writeReplayHeader(response, result.replayed);
    response.status(result.replayed ? 200 : 201);
    return result.body;
  }

  @Post('refunds')
  @RequirePermissions(PAYMENT_PERMISSION_KEYS.REFUNDS_REQUEST)
  async createRefund(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = refundCreateSchema.parse(body);
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.refunds.requestRefund(
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

  @Post('refunds/:refundId/approve')
  @RequirePermissions(PAYMENT_PERMISSION_KEYS.REFUNDS_APPROVE)
  async approveRefund(
    @Param('organizationId') organizationId: string,
    @Param('refundId') refundId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = refundDecisionRequestSchema.parse(body);
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.refunds.approveRefund(
      organizationId,
      actor.membershipId!,
      actor.userId,
      refundId,
      parsed,
      key,
      requestHash,
      request.correlationId,
    );
    this.idempotency.writeReplayHeader(response, result.replayed);
    return result.body;
  }

  @Post('refunds/:refundId/execute')
  @RequirePermissions(PAYMENT_PERMISSION_KEYS.REFUNDS_EXECUTE)
  async executeRefund(
    @Param('organizationId') organizationId: string,
    @Param('refundId') refundId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = refundExecuteRequestSchema.parse(body ?? {});
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.refunds.executeRefund(
      organizationId,
      actor.membershipId!,
      actor.userId,
      refundId,
      parsed,
      key,
      requestHash,
      request.correlationId,
    );
    this.idempotency.writeReplayHeader(response, result.replayed);
    return result.body;
  }

  @Get('receipts/:receiptId')
  @RequirePermissions(PAYMENT_PERMISSION_KEYS.VIEW)
  getReceipt(
    @Param('organizationId') organizationId: string,
    @Param('receiptId') receiptId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.receipts.getReceipt(organizationId, actor.membershipId!, receiptId);
  }

  @Get('arrears')
  @RequirePermissions(PAYMENT_PERMISSION_KEYS.LIST)
  listArrears(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.arrears.listArrears(organizationId, actor.membershipId!, {
      limit: parsed.limit,
      after: parsed.after,
      propertyId: typeof query.propertyId === 'string' ? query.propertyId : undefined,
    });
  }

  @Get('dashboard/finance')
  @RequirePermissions(PAYMENT_PERMISSION_KEYS.LIST)
  financeDashboard(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.dashboard.getSummary(organizationId, actor.membershipId!);
  }

  @Post('deposits/:depositId/dispositions')
  @RequirePermissions(PAYMENT_PERMISSION_KEYS.DEPOSITS_DISPOSITION)
  async createDispositions(
    @Param('organizationId') organizationId: string,
    @Param('depositId') depositId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = createDepositDispositionRequestSchema.parse(body);
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.dispositions.createDispositions(
      organizationId,
      actor.membershipId!,
      actor.userId,
      depositId,
      parsed,
      key,
      requestHash,
      request.correlationId,
    );
    this.idempotency.writeReplayHeader(response, result.replayed);
    response.status(result.replayed ? 200 : 201);
    return result.body;
  }

  @Post('deposit-dispositions/:dispositionId/approve')
  @RequirePermissions(PAYMENT_PERMISSION_KEYS.DEPOSITS_DISPOSITION_APPROVE)
  async approveDisposition(
    @Param('organizationId') organizationId: string,
    @Param('dispositionId') dispositionId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = dispositionDecisionRequestSchema.parse(body);
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.dispositions.approveDisposition(
      organizationId,
      actor.membershipId!,
      actor.userId,
      dispositionId,
      parsed,
      key,
      requestHash,
      request.correlationId,
    );
    this.idempotency.writeReplayHeader(response, result.replayed);
    return result.body;
  }

  @Post('dispositions/:dispositionId/execute')
  @RequirePermissions(PAYMENT_PERMISSION_KEYS.DEPOSITS_DISPOSE)
  async executeDisposition(
    @Param('organizationId') organizationId: string,
    @Param('dispositionId') dispositionId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = executeDepositDispositionRequestSchema.parse(body ?? {});
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.dispositions.executeDisposition(
      organizationId,
      actor.membershipId!,
      actor.userId,
      dispositionId,
      parsed,
      key,
      requestHash,
      request.correlationId,
    );
    this.idempotency.writeReplayHeader(response, result.replayed);
    return result.body;
  }
}
