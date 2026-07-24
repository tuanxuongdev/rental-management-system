import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type {
  RefundCreate,
  RefundDecisionRequest,
  RefundExecuteRequest,
  RefundResponse,
} from '@rpm/contracts';

import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { actorScopeFromOrganization } from '../../../infrastructure/persistence/organization-context';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { AuditService } from '../../audit/audit.service';
import { LedgerService } from '../../billing/application/ledger.service';
import { decimalToString, roundMoney } from '../../billing/domain/billing.rules';
import { PeriodService } from '../../reconciliation/application/period.service';
import { assertActorsDistinct } from '../../reconciliation/domain/reconciliation.rules';
import { AuthorizationService } from '../../tenancy/application/authorization.service';
import { assertPositiveMoney } from '../domain/payment.rules';

@Injectable()
export class RefundService {
  constructor(
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(LedgerService) private readonly ledger: LedgerService,
    @Inject(PeriodService) private readonly periods: PeriodService,
  ) {}

  async requestRefund(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    body: RefundCreate,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: RefundResponse }> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.payments.refund',
    );

    const amount = roundMoney(new Prisma.Decimal(body.amount));
    assertPositiveMoney(amount);

    const operation = `POST /v1/organizations/${organizationId}/refunds`;
    const actorScope = actorScopeFromOrganization(organizationId);

    const result = await this.transactions.run(async (tx) => {
      const begin = await this.idempotency.begin(tx, {
        tenantId: organizationId,
        actorScope,
        operation,
        key: idempotencyKey,
        requestHash,
      });
      if (begin.replayed) {
        return { replayed: true as const, body: begin.body as RefundResponse };
      }

      await tx.$queryRaw`SELECT id FROM payment_transactions WHERE id = ${body.paymentTransactionId}::uuid AND tenant_id = ${organizationId}::uuid FOR UPDATE`;

      const payment = await tx.paymentTransaction.findFirst({
        where: { id: body.paymentTransactionId, tenantId: organizationId },
        include: { refunds: true },
      });
      if (payment === null) {
        throw new NotFoundException({ message: 'Payment not found', code: 'PAYMENT_NOT_FOUND' });
      }
      if (payment.propertyId !== null) {
        await this.authorization.assertPropertyAccess(
          membershipId,
          organizationId,
          payment.propertyId,
        );
      }
      if (payment.status !== 'SETTLED') {
        throw new ConflictException({
          message: 'Payment is not refundable',
          code: 'PAYMENT_NOT_REFUNDABLE',
        });
      }

      const priorRefunded = payment.refunds
        .filter(
          (row) =>
            row.status === 'PENDING' || row.status === 'APPROVED' || row.status === 'EXECUTED',
        )
        .reduce((acc, row) => acc.plus(row.amount), new Prisma.Decimal(0));
      if (priorRefunded.plus(amount).gt(payment.amount)) {
        throw new UnprocessableEntityException({
          message: 'Refund exceeds refundable amount',
          code: 'REFUND_EXCEEDS_REFUNDABLE',
        });
      }

      const refundId = randomUUID();
      await tx.refund.create({
        data: {
          id: refundId,
          tenantId: organizationId,
          paymentTransactionId: payment.id,
          amount,
          currency: payment.currency,
          reason: body.reason,
          status: 'PENDING',
          requestedByUserId: actorUserId,
        },
      });

      const created = await tx.refund.findFirstOrThrow({
        where: { id: refundId, tenantId: organizationId },
      });
      const responseBody = this.toResponse(created);
      await this.idempotency.complete(tx, {
        tenantId: organizationId,
        actorScope,
        operation,
        key: idempotencyKey,
        responseStatus: 201,
        responseBody,
      });
      return { replayed: false as const, body: responseBody };
    });

    if (!result.replayed) {
      await this.audit.record({
        tenantId: organizationId,
        actorUserId,
        action: 'refund.request',
        outcome: 'SUCCESS',
        targetType: 'refund',
        targetId: result.body.id,
        correlationId,
      });
    }

    return result;
  }

  async approveRefund(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    refundId: string,
    body: RefundDecisionRequest,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: RefundResponse }> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.payments.refund.approve',
    );

    const operation = `POST /v1/organizations/${organizationId}/refunds/${refundId}/approve`;
    const actorScope = actorScopeFromOrganization(organizationId);

    const result = await this.transactions.run(async (tx) => {
      const begin = await this.idempotency.begin(tx, {
        tenantId: organizationId,
        actorScope,
        operation,
        key: idempotencyKey,
        requestHash,
      });
      if (begin.replayed) {
        return { replayed: true as const, body: begin.body as RefundResponse };
      }

      const refund = await tx.refund.findFirst({
        where: { id: refundId, tenantId: organizationId },
      });
      if (refund === null) {
        throw new NotFoundException({ message: 'Refund not found', code: 'REFUND_NOT_FOUND' });
      }
      if (refund.status !== 'PENDING') {
        throw new ConflictException({
          message: 'Refund is not pending approval',
          code: 'REFUND_NOT_PENDING',
        });
      }
      assertActorsDistinct([
        { role: 'requester', userId: refund.requestedByUserId },
        { role: 'approver', userId: actorUserId },
      ]);

      const nextStatus = body.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const updated = await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: nextStatus,
          approvedByUserId: actorUserId,
          approvedAt: new Date(),
          version: { increment: 1 },
        },
      });
      const responseBody = this.toResponse(updated);
      await this.idempotency.complete(tx, {
        tenantId: organizationId,
        actorScope,
        operation,
        key: idempotencyKey,
        responseStatus: 200,
        responseBody,
      });
      return { replayed: false as const, body: responseBody };
    });

    if (!result.replayed) {
      await this.audit.record({
        tenantId: organizationId,
        actorUserId,
        action: 'refund.approve',
        outcome: 'SUCCESS',
        targetType: 'refund',
        targetId: refundId,
        correlationId,
        changeSummary: { decision: body.decision, reason: body.reason },
      });
    }
    return result;
  }

  async executeRefund(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    refundId: string,
    body: RefundExecuteRequest,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: RefundResponse }> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.payments.refund.execute',
    );

    const operation = `POST /v1/organizations/${organizationId}/refunds/${refundId}/execute`;
    const actorScope = actorScopeFromOrganization(organizationId);

    const result = await this.transactions.run(async (tx) => {
      const begin = await this.idempotency.begin(tx, {
        tenantId: organizationId,
        actorScope,
        operation,
        key: idempotencyKey,
        requestHash,
      });
      if (begin.replayed) {
        return { replayed: true as const, body: begin.body as RefundResponse };
      }

      const refund = await tx.refund.findFirst({
        where: { id: refundId, tenantId: organizationId },
      });
      if (refund === null) {
        throw new NotFoundException({ message: 'Refund not found', code: 'REFUND_NOT_FOUND' });
      }
      if (refund.status === 'EXECUTED') {
        return { replayed: false as const, body: this.toResponse(refund) };
      }
      if (refund.status !== 'APPROVED') {
        throw new ConflictException({
          message: 'Refund is not approved',
          code: 'REFUND_NOT_APPROVED',
        });
      }
      assertActorsDistinct([
        { role: 'requester', userId: refund.requestedByUserId },
        { role: 'approver', userId: refund.approvedByUserId },
        { role: 'executor', userId: actorUserId },
      ]);

      await tx.$queryRaw`SELECT id FROM payment_transactions WHERE id = ${refund.paymentTransactionId}::uuid AND tenant_id = ${organizationId}::uuid FOR UPDATE`;
      const payment = await tx.paymentTransaction.findFirst({
        where: { id: refund.paymentTransactionId, tenantId: organizationId },
        include: { allocations: { where: { reversedAt: null } } },
      });
      if (payment === null || payment.status !== 'SETTLED') {
        throw new ConflictException({
          message: 'Payment is not refundable',
          code: 'PAYMENT_NOT_REFUNDABLE',
        });
      }

      const executedAt = body.executedAt !== undefined ? new Date(body.executedAt) : new Date();
      await this.periods.assertPeriodOpen(organizationId, executedAt, tx);

      let remaining = roundMoney(refund.amount);
      const fromUnapplied = Prisma.Decimal.min(payment.unallocatedAmount, remaining);
      remaining = roundMoney(remaining.minus(fromUnapplied));
      const fromAr = remaining;

      if (fromUnapplied.gt(0)) {
        await tx.paymentTransaction.update({
          where: { id: payment.id },
          data: {
            unallocatedAmount: roundMoney(payment.unallocatedAmount.minus(fromUnapplied)),
            version: { increment: 1 },
          },
        });
      }

      if (fromAr.gt(0) && payment.allocations.length > 0) {
        const allocTotal = payment.allocations.reduce(
          (acc, row) => acc.plus(row.amount),
          new Prisma.Decimal(0),
        );
        let left = fromAr;
        for (const allocation of payment.allocations) {
          if (left.lte(0)) {
            break;
          }
          const share = allocTotal.gt(0)
            ? roundMoney(fromAr.mul(allocation.amount).div(allocTotal))
            : new Prisma.Decimal(0);
          const take = Prisma.Decimal.min(share, left, allocation.amount);
          if (take.lte(0)) {
            continue;
          }
          const invoice = await tx.invoice.findFirst({
            where: { id: allocation.invoiceId, tenantId: organizationId },
          });
          if (invoice !== null) {
            const newBalance = roundMoney(invoice.balanceAmount.plus(take));
            await tx.invoice.update({
              where: { id: invoice.id },
              data: {
                balanceAmount: newBalance,
                status: newBalance.gte(invoice.totalAmount) ? 'POSTED' : 'PARTIALLY_PAID',
                version: { increment: 1 },
              },
            });
          }
          left = roundMoney(left.minus(take));
        }
      }

      await this.ledger.postRefundJournal(tx, {
        tenantId: organizationId,
        refundId: refund.id,
        leaseId: payment.leaseId,
        currency: refund.currency,
        amount: refund.amount,
        effectiveAt: executedAt,
        channel: payment.channel,
        fromUnapplied,
        fromAr,
      });

      const updated = await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: 'EXECUTED',
          executedByUserId: actorUserId,
          executedAt,
          version: { increment: 1 },
        },
      });
      const responseBody = this.toResponse(updated);
      await this.idempotency.complete(tx, {
        tenantId: organizationId,
        actorScope,
        operation,
        key: idempotencyKey,
        responseStatus: 200,
        responseBody,
      });
      return { replayed: false as const, body: responseBody };
    });

    if (!result.replayed) {
      await this.audit.record({
        tenantId: organizationId,
        actorUserId,
        action: 'refund.execute',
        outcome: 'SUCCESS',
        targetType: 'refund',
        targetId: refundId,
        correlationId,
      });
    }
    return result;
  }

  private toResponse(row: {
    id: string;
    tenantId: string;
    paymentTransactionId: string;
    amount: Prisma.Decimal;
    currency: string;
    reason: string;
    status: RefundResponse['status'];
    requestedByUserId: string | null;
    approvedByUserId: string | null;
    approvedAt?: Date | null;
    executedByUserId?: string | null;
    executedAt: Date | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): RefundResponse {
    return {
      id: row.id,
      organizationId: row.tenantId,
      paymentTransactionId: row.paymentTransactionId,
      amount: decimalToString(row.amount),
      currency: row.currency,
      reason: row.reason,
      status: row.status,
      requestedByUserId: row.requestedByUserId,
      approvedByUserId: row.approvedByUserId,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      executedByUserId: row.executedByUserId ?? null,
      executedAt: row.executedAt?.toISOString() ?? null,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
