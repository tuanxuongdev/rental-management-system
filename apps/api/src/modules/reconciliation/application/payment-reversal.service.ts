import { randomUUID } from 'node:crypto';

import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  PAYMENT_REVERSED_EVENT_TYPE,
  type PaymentReverseRequest,
  type PaymentReversalResponse,
  type PaymentTransactionResponse,
} from '@rpm/contracts';

import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service';
import { actorScopeFromOrganization } from '../../../infrastructure/persistence/organization-context';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { AuditService } from '../../audit/audit.service';
import { LedgerService } from '../../billing/application/ledger.service';
import { decimalToString, roundMoney } from '../../billing/domain/billing.rules';
import { AuthorizationService } from '../../tenancy/application/authorization.service';

import { PeriodService } from './period.service';

@Injectable()
export class PaymentReversalService {
  constructor(
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(LedgerService) private readonly ledger: LedgerService,
    @Inject(PeriodService) private readonly periods: PeriodService,
  ) {}

  async reversePayment(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    paymentId: string,
    body: PaymentReverseRequest,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{
    replayed: boolean;
    body: { payment: PaymentTransactionResponse; reversal: PaymentReversalResponse };
  }> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.payments.refund.execute',
    );

    const operation = `POST /v1/organizations/${organizationId}/payments/${paymentId}/reverse`;
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
        return {
          replayed: true as const,
          body: begin.body as {
            payment: PaymentTransactionResponse;
            reversal: PaymentReversalResponse;
          },
        };
      }

      await tx.$queryRaw`SELECT id FROM payment_transactions WHERE id = ${paymentId}::uuid AND tenant_id = ${organizationId}::uuid FOR UPDATE`;

      const payment = await tx.paymentTransaction.findFirst({
        where: { id: paymentId, tenantId: organizationId },
        include: {
          allocations: { where: { reversedAt: null } },
          receipt: true,
        },
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
      if (payment.status === 'REVERSED') {
        throw new ConflictException({
          message: 'Payment already reversed',
          code: 'PAYMENT_ALREADY_REVERSED',
        });
      }
      if (payment.status !== 'SETTLED') {
        throw new ConflictException({
          message: 'Payment cannot be reversed',
          code: 'PAYMENT_REVERSAL_BLOCKED',
        });
      }

      const effectiveAt = body.effectiveAt !== undefined ? new Date(body.effectiveAt) : new Date();
      await this.periods.assertPeriodOpen(organizationId, effectiveAt, tx);

      const allocatedTotal = payment.allocations.reduce(
        (acc, row) => acc.plus(row.amount),
        new Prisma.Decimal(0),
      );

      for (const allocation of payment.allocations) {
        const invoice = await tx.invoice.findFirst({
          where: { id: allocation.invoiceId, tenantId: organizationId },
        });
        if (invoice === null) {
          continue;
        }
        const newBalance = roundMoney(invoice.balanceAmount.plus(allocation.amount));
        const newStatus = newBalance.gte(invoice.totalAmount) ? 'POSTED' : 'PARTIALLY_PAID';
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            balanceAmount: newBalance,
            status: newStatus,
            version: { increment: 1 },
          },
        });
        await tx.paymentAllocation.update({
          where: { id: allocation.id },
          data: { reversedAt: effectiveAt },
        });
        await tx.paymentAllocation.create({
          data: {
            id: randomUUID(),
            tenantId: organizationId,
            paymentTransactionId: payment.id,
            invoiceId: allocation.invoiceId,
            amount: allocation.amount.negated(),
            currency: allocation.currency,
            effectiveAt,
            reversedAt: effectiveAt,
            reversalOfId: allocation.id,
          },
        });
      }

      const reversalId = randomUUID();
      await this.ledger.postPaymentReversalJournal(tx, {
        tenantId: organizationId,
        paymentTransactionId: payment.id,
        reversalId,
        leaseId: payment.leaseId,
        currency: payment.currency,
        allocatedAmount: allocatedTotal,
        unallocatedAmount: payment.unallocatedAmount,
        effectiveAt,
        channel: payment.channel,
      });

      await tx.paymentReversal.create({
        data: {
          id: reversalId,
          tenantId: organizationId,
          paymentTransactionId: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          reason: body.reason,
          status: 'EXECUTED',
          requestedByUserId: actorUserId,
          executedByUserId: actorUserId,
          executedAt: effectiveAt,
          ledgerJournalId: reversalId,
        },
      });

      await tx.paymentTransaction.update({
        where: { id: payment.id },
        data: {
          status: 'REVERSED',
          unallocatedAmount: new Prisma.Decimal(0),
          version: { increment: 1 },
        },
      });

      await this.outbox.appendInTransaction(tx, {
        aggregateType: 'payment_transaction',
        aggregateId: payment.id,
        eventType: PAYMENT_REVERSED_EVENT_TYPE,
        payload: {
          tenantId: organizationId,
          paymentTransactionId: payment.id,
          reversalId,
          reason: body.reason,
        },
        correlationId,
        tenantId: organizationId,
      });

      const refreshed = await tx.paymentTransaction.findFirstOrThrow({
        where: { id: payment.id, tenantId: organizationId },
        include: { allocations: true, receipt: true },
      });
      const reversal = await tx.paymentReversal.findFirstOrThrow({
        where: { id: reversalId },
      });

      const responseBody = {
        payment: {
          id: refreshed.id,
          organizationId: refreshed.tenantId,
          intentId: refreshed.intentId,
          leaseId: refreshed.leaseId,
          propertyId: refreshed.propertyId,
          payerPartyId: refreshed.payerPartyId,
          amount: decimalToString(refreshed.amount),
          unallocatedAmount: decimalToString(refreshed.unallocatedAmount),
          currency: refreshed.currency,
          channel: refreshed.channel,
          status: refreshed.status,
          reconciliationStatus: refreshed.reconciliationStatus,
          externalReference: refreshed.externalReference,
          provider: refreshed.provider,
          providerPaymentId: refreshed.providerPaymentId,
          receivedAt: refreshed.receivedAt.toISOString(),
          accountingAt: refreshed.accountingAt.toISOString(),
          notes: refreshed.notes,
          evidenceDocumentId: refreshed.evidenceDocumentId,
          receiptId: refreshed.receipt?.id ?? null,
          version: refreshed.version,
          createdAt: refreshed.createdAt.toISOString(),
          updatedAt: refreshed.updatedAt.toISOString(),
        } satisfies PaymentTransactionResponse,
        reversal: this.toReversalResponse(reversal),
      };

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
        action: 'payment.reverse',
        outcome: 'SUCCESS',
        targetType: 'payment_transaction',
        targetId: paymentId,
        correlationId,
      });
    }
    return result;
  }

  private toReversalResponse(row: {
    id: string;
    tenantId: string;
    paymentTransactionId: string;
    amount: Prisma.Decimal;
    currency: string;
    reason: string;
    status: PaymentReversalResponse['status'];
    requestedByUserId: string;
    executedByUserId: string | null;
    executedAt: Date | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): PaymentReversalResponse {
    return {
      id: row.id,
      organizationId: row.tenantId,
      paymentTransactionId: row.paymentTransactionId,
      amount: decimalToString(row.amount),
      currency: row.currency,
      reason: row.reason,
      status: row.status,
      requestedByUserId: row.requestedByUserId,
      executedByUserId: row.executedByUserId,
      executedAt: row.executedAt?.toISOString() ?? null,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
