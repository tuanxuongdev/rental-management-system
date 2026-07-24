import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  PAYMENT_ALLOCATED_EVENT_TYPE,
  PAYMENT_RECORDED_EVENT_TYPE,
  RECEIPT_ISSUED_EVENT_TYPE,
  type AllocationCreate,
  type ManualPaymentCreate,
  type PaymentAllocationResponse,
  type PaymentsCollection,
  type PaymentTransactionResponse,
} from '@rpm/contracts';

import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service';
import { actorScopeFromOrganization } from '../../../infrastructure/persistence/organization-context';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';
import { LedgerService } from '../../billing/application/ledger.service';
import { decimalToString, nextReceiptNumber, roundMoney } from '../../billing/domain/billing.rules';
import { PeriodService } from '../../reconciliation/application/period.service';
import { AuthorizationService } from '../../tenancy/application/authorization.service';
import {
  assertCurrencyMatch,
  assertPositiveMoney,
  invoiceStatusAfterAllocation,
  sumAllocationAmounts,
} from '../domain/payment.rules';

type PaymentRow = Prisma.PaymentTransactionGetPayload<{
  include: { allocations: true; receipt: true };
}>;

@Injectable()
export class PaymentService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(LedgerService) private readonly ledger: LedgerService,
    @Inject(PeriodService) private readonly periods: PeriodService,
  ) {}

  async listPayments(
    organizationId: string,
    membershipId: string,
    options?: {
      limit?: number;
      after?: string;
      leaseId?: string;
      propertyId?: string;
      status?: string;
      channel?: string;
    },
  ): Promise<PaymentsCollection> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.payments.list',
    );
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

    const rows = await this.prisma.paymentTransaction.findMany({
      where: {
        tenantId: organizationId,
        ...propertyScope,
        ...(options?.leaseId !== undefined ? { leaseId: options.leaseId } : {}),
        ...(options?.status !== undefined
          ? { status: options.status as PaymentTransactionResponse['status'] }
          : {}),
        ...(options?.channel !== undefined
          ? { channel: options.channel as PaymentTransactionResponse['channel'] }
          : {}),
      },
      include: { allocations: true, receipt: true },
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(options?.after !== undefined ? { cursor: { id: options.after }, skip: 1 } : {}),
    });

    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      data: page.map((row) => this.toResponse(row, true)),
      page: {
        nextCursor: rows.length > limit && last !== undefined ? last.id : null,
        previousCursor: null,
        limit,
      },
      meta: {},
    };
  }

  async getPayment(
    organizationId: string,
    membershipId: string,
    paymentId: string,
  ): Promise<PaymentTransactionResponse> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.payments.view',
    );
    const row = await this.prisma.paymentTransaction.findFirst({
      where: { id: paymentId, tenantId: organizationId },
      include: { allocations: true, receipt: true },
    });
    if (row === null) {
      throw new NotFoundException({ message: 'Payment not found', code: 'PAYMENT_NOT_FOUND' });
    }
    if (row.propertyId !== null) {
      await this.authorization.assertPropertyAccess(membershipId, organizationId, row.propertyId);
    }
    return this.toResponse(row, true);
  }

  async recordManual(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    body: ManualPaymentCreate,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: PaymentTransactionResponse }> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.payments.record',
    );
    await this.authorization.assertPropertyAccess(membershipId, organizationId, body.propertyId);

    const amount = roundMoney(new Prisma.Decimal(body.amount));
    assertPositiveMoney(amount);
    const allocationTotal = sumAllocationAmounts(body.allocations);
    if (allocationTotal.gt(amount)) {
      throw new UnprocessableEntityException({
        message: 'Allocation exceeds payment amount',
        code: 'ALLOCATION_EXCEEDS_AVAILABLE',
      });
    }

    const operation = `POST /v1/organizations/${organizationId}/payments`;
    const actorScope = actorScopeFromOrganization(organizationId);
    const existing = await this.idempotency.findExisting(
      organizationId,
      actorScope,
      operation,
      idempotencyKey,
    );
    if (existing !== null && existing.requestHash === requestHash) {
      return {
        replayed: true,
        body: existing.responseBody as PaymentTransactionResponse,
      };
    }

    const result = await this.transactions.run(async (tx) => {
      const lease = await tx.lease.findFirst({
        where: { id: body.leaseId, tenantId: organizationId, deletedAt: null },
      });
      if (lease === null || lease.propertyId !== body.propertyId) {
        throw new NotFoundException({ message: 'Lease not found', code: 'LEASE_NOT_FOUND' });
      }

      assertCurrencyMatch(lease.currency, body.currency);

      if (body.externalReference !== undefined && body.externalReference.trim().length > 0) {
        const duplicate = await tx.paymentTransaction.findFirst({
          where: {
            tenantId: organizationId,
            externalReference: body.externalReference.trim(),
            status: { in: ['SETTLED', 'PENDING'] },
          },
          select: { id: true },
        });
        if (duplicate !== null) {
          throw new ConflictException({
            message: 'External reference already used for another payment',
            code: 'DUPLICATE_EXTERNAL_REFERENCE',
          });
        }
      }

      const paymentId = randomUUID();
      const receivedAt = new Date(body.receivedAt);
      await this.periods.assertPeriodOpen(organizationId, receivedAt, tx);
      // Seed full amount; applyAllocationsInTx reduces unallocatedAmount by allocated total.
      await tx.paymentTransaction.create({
        data: {
          id: paymentId,
          tenantId: organizationId,
          leaseId: body.leaseId,
          propertyId: body.propertyId,
          payerPartyId: body.payerPartyId,
          amount,
          unallocatedAmount: amount,
          currency: body.currency,
          channel: body.channel,
          status: 'SETTLED',
          externalReference: body.externalReference?.trim() || null,
          receivedAt,
          accountingAt: receivedAt,
          notes: body.notes ?? null,
          evidenceDocumentId: body.evidenceDocumentId ?? null,
          recordedByUserId: actorUserId,
        },
      });

      const applied = await this.applyAllocationsInTx(tx, {
        organizationId,
        paymentId,
        currency: body.currency,
        leaseId: body.leaseId,
        allocations: body.allocations,
        effectiveAt: receivedAt,
        availableUnallocated: amount,
      });

      if (applied.allocatedTotal.gt(0) || amount.gt(0)) {
        await this.ledger.postPaymentSettlementJournal(tx, {
          tenantId: organizationId,
          paymentTransactionId: paymentId,
          leaseId: body.leaseId,
          currency: body.currency,
          amount: applied.allocatedTotal,
          cashAmount: amount,
          effectiveAt: receivedAt,
          channel: body.channel,
          postingBatchId: paymentId,
        });
      }

      const receiptNumber = await nextReceiptNumber(
        tx,
        organizationId,
        receivedAt.getUTCFullYear(),
      );
      const receiptId = randomUUID();
      await tx.paymentReceipt.create({
        data: {
          id: receiptId,
          tenantId: organizationId,
          paymentTransactionId: paymentId,
          receiptNumber,
          issuedAt: receivedAt,
          currency: body.currency,
          amount,
          summary: {
            channel: body.channel,
            leaseId: body.leaseId,
            allocationCount: applied.allocations.length,
          },
        },
      });

      await this.outbox.appendInTransaction(tx, {
        aggregateType: 'payment_transaction',
        aggregateId: paymentId,
        eventType: PAYMENT_RECORDED_EVENT_TYPE,
        payload: {
          tenantId: organizationId,
          paymentTransactionId: paymentId,
          amount: decimalToString(amount),
          currency: body.currency,
          channel: body.channel,
        },
        correlationId,
        tenantId: organizationId,
      });

      if (applied.allocations.length > 0) {
        await this.outbox.appendInTransaction(tx, {
          aggregateType: 'payment_transaction',
          aggregateId: paymentId,
          eventType: PAYMENT_ALLOCATED_EVENT_TYPE,
          payload: {
            tenantId: organizationId,
            paymentTransactionId: paymentId,
            allocationIds: applied.allocations.map((row) => row.id),
          },
          correlationId,
          tenantId: organizationId,
        });
      }

      await this.outbox.appendInTransaction(tx, {
        aggregateType: 'payment_receipt',
        aggregateId: receiptId,
        eventType: RECEIPT_ISSUED_EVENT_TYPE,
        payload: {
          tenantId: organizationId,
          receiptId,
          paymentTransactionId: paymentId,
          receiptNumber,
        },
        correlationId,
        tenantId: organizationId,
      });

      const refreshed = await tx.paymentTransaction.findFirstOrThrow({
        where: { id: paymentId, tenantId: organizationId },
        include: { allocations: true, receipt: true },
      });
      const responseBody = this.toResponse(refreshed, true);

      const idem = await this.idempotency.resolveOrCreate(tx, {
        tenantId: organizationId,
        actorScope,
        operation,
        key: idempotencyKey,
        requestHash,
        responseStatus: 201,
        responseBody,
      });
      if (idem.replayed) {
        return {
          replayed: true as const,
          body: idem.body as PaymentTransactionResponse,
        };
      }

      return { replayed: false as const, body: responseBody };
    });

    if (!result.replayed) {
      await this.audit.record({
        tenantId: organizationId,
        actorUserId,
        action: 'payment.record_manual',
        outcome: 'SUCCESS',
        targetType: 'payment_transaction',
        targetId: result.body.id,
        correlationId,
      });
    }

    return result;
  }

  async allocate(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    paymentTransactionId: string,
    body: AllocationCreate,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: PaymentTransactionResponse }> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.payments.allocate',
    );

    const operation = `POST /v1/organizations/${organizationId}/payment-transactions/${paymentTransactionId}/allocations`;
    const actorScope = actorScopeFromOrganization(organizationId);
    const existing = await this.idempotency.findExisting(
      organizationId,
      actorScope,
      operation,
      idempotencyKey,
    );
    if (existing !== null && existing.requestHash === requestHash) {
      return {
        replayed: true,
        body: existing.responseBody as PaymentTransactionResponse,
      };
    }

    const result = await this.transactions.run(async (tx) => {
      await tx.$queryRaw`SELECT id FROM payment_transactions WHERE id = ${paymentTransactionId}::uuid AND tenant_id = ${organizationId}::uuid FOR UPDATE`;

      const payment = await tx.paymentTransaction.findFirst({
        where: { id: paymentTransactionId, tenantId: organizationId },
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
          message: 'Payment is not allocatable',
          code: 'PAYMENT_NOT_ALLOCATABLE',
        });
      }

      const effectiveAt = body.effectiveAt !== undefined ? new Date(body.effectiveAt) : new Date();
      await this.periods.assertPeriodOpen(organizationId, effectiveAt, tx);
      const applied = await this.applyAllocationsInTx(tx, {
        organizationId,
        paymentId: payment.id,
        currency: payment.currency,
        leaseId: payment.leaseId,
        allocations: body.allocations,
        effectiveAt,
        availableUnallocated: payment.unallocatedAmount,
      });

      if (applied.allocatedTotal.gt(0)) {
        const batchId = randomUUID();
        await this.ledger.postPaymentSettlementJournal(tx, {
          tenantId: organizationId,
          paymentTransactionId: payment.id,
          leaseId: payment.leaseId,
          currency: payment.currency,
          amount: applied.allocatedTotal,
          effectiveAt,
          channel: payment.channel,
          description: 'Payment allocation settlement',
          postingBatchId: batchId,
          fromUnapplied: true,
        });
      }

      await this.outbox.appendInTransaction(tx, {
        aggregateType: 'payment_transaction',
        aggregateId: payment.id,
        eventType: PAYMENT_ALLOCATED_EVENT_TYPE,
        payload: {
          tenantId: organizationId,
          paymentTransactionId: payment.id,
          allocationIds: applied.allocations.map((row) => row.id),
        },
        correlationId,
        tenantId: organizationId,
      });

      const refreshed = await tx.paymentTransaction.findFirstOrThrow({
        where: { id: payment.id, tenantId: organizationId },
        include: { allocations: true, receipt: true },
      });
      const responseBody = this.toResponse(refreshed, true);

      const idem = await this.idempotency.resolveOrCreate(tx, {
        tenantId: organizationId,
        actorScope,
        operation,
        key: idempotencyKey,
        requestHash,
        responseStatus: 201,
        responseBody,
      });
      if (idem.replayed) {
        return {
          replayed: true as const,
          body: idem.body as PaymentTransactionResponse,
        };
      }

      return { replayed: false as const, body: responseBody };
    });

    if (!result.replayed) {
      await this.audit.record({
        tenantId: organizationId,
        actorUserId,
        action: 'payment.allocate',
        outcome: 'SUCCESS',
        targetType: 'payment_transaction',
        targetId: paymentTransactionId,
        correlationId,
      });
    }

    return result;
  }

  /**
   * Used by webhook settlement path after intent confirmation.
   */
  async settleFromIntentInTx(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      intentId: string;
      providerPaymentId: string;
      amount: Prisma.Decimal;
      currency: string;
      channel: PaymentTransactionResponse['channel'];
      leaseId: string | null;
      propertyId: string | null;
      payerPartyId: string | null;
      invoiceId: string | null;
      receivedAt: Date;
      correlationId?: string;
    },
  ): Promise<PaymentTransactionResponse> {
    const existing = await tx.paymentTransaction.findFirst({
      where: {
        tenantId: input.organizationId,
        provider: 'sandbox',
        providerPaymentId: input.providerPaymentId,
      },
      include: { allocations: true, receipt: true },
    });
    if (existing !== null) {
      return this.toResponse(existing, true);
    }

    const paymentId = randomUUID();
    const amount = roundMoney(input.amount);
    const allocations =
      input.invoiceId !== null
        ? [{ invoiceId: input.invoiceId, amount: decimalToString(amount) }]
        : [];

    await tx.paymentTransaction.create({
      data: {
        id: paymentId,
        tenantId: input.organizationId,
        intentId: input.intentId,
        leaseId: input.leaseId,
        propertyId: input.propertyId,
        payerPartyId: input.payerPartyId,
        amount,
        unallocatedAmount: amount,
        currency: input.currency,
        channel: input.channel,
        status: 'SETTLED',
        provider: 'sandbox',
        providerPaymentId: input.providerPaymentId,
        receivedAt: input.receivedAt,
        accountingAt: input.receivedAt,
      },
    });

    const applied = await this.applyAllocationsInTx(tx, {
      organizationId: input.organizationId,
      paymentId,
      currency: input.currency,
      leaseId: input.leaseId,
      allocations,
      effectiveAt: input.receivedAt,
      availableUnallocated: amount,
    });

    if (applied.allocatedTotal.gt(0) || amount.gt(0)) {
      await this.ledger.postPaymentSettlementJournal(tx, {
        tenantId: input.organizationId,
        paymentTransactionId: paymentId,
        leaseId: input.leaseId,
        currency: input.currency,
        amount: applied.allocatedTotal,
        cashAmount: amount,
        effectiveAt: input.receivedAt,
        channel: input.channel,
      });
    }

    const receiptNumber = await nextReceiptNumber(
      tx,
      input.organizationId,
      input.receivedAt.getUTCFullYear(),
    );
    const receiptId = randomUUID();
    await tx.paymentReceipt.create({
      data: {
        id: receiptId,
        tenantId: input.organizationId,
        paymentTransactionId: paymentId,
        receiptNumber,
        issuedAt: input.receivedAt,
        currency: input.currency,
        amount,
        summary: { source: 'webhook', intentId: input.intentId },
      },
    });

    await this.outbox.appendInTransaction(tx, {
      aggregateType: 'payment_transaction',
      aggregateId: paymentId,
      eventType: PAYMENT_RECORDED_EVENT_TYPE,
      payload: {
        tenantId: input.organizationId,
        paymentTransactionId: paymentId,
        intentId: input.intentId,
      },
      correlationId: input.correlationId,
      tenantId: input.organizationId,
    });

    await this.outbox.appendInTransaction(tx, {
      aggregateType: 'payment_receipt',
      aggregateId: receiptId,
      eventType: RECEIPT_ISSUED_EVENT_TYPE,
      payload: {
        tenantId: input.organizationId,
        receiptId,
        paymentTransactionId: paymentId,
        receiptNumber,
      },
      correlationId: input.correlationId,
      tenantId: input.organizationId,
    });

    const refreshed = await tx.paymentTransaction.findFirstOrThrow({
      where: { id: paymentId, tenantId: input.organizationId },
      include: { allocations: true, receipt: true },
    });
    return this.toResponse(refreshed, true);
  }

  private async applyAllocationsInTx(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      paymentId: string;
      currency: string;
      leaseId: string | null;
      allocations: Array<{ invoiceId: string; amount: string }>;
      effectiveAt: Date;
      availableUnallocated: Prisma.Decimal;
    },
  ): Promise<{
    allocatedTotal: Prisma.Decimal;
    allocations: PaymentAllocationResponse[];
  }> {
    const requested = sumAllocationAmounts(input.allocations);
    if (requested.gt(roundMoney(input.availableUnallocated))) {
      throw new UnprocessableEntityException({
        message: 'Allocation exceeds available unallocated amount',
        code: 'ALLOCATION_EXCEEDS_AVAILABLE',
      });
    }

    const created: PaymentAllocationResponse[] = [];
    let allocatedTotal = new Prisma.Decimal(0);

    for (const line of input.allocations) {
      const lineAmount = roundMoney(new Prisma.Decimal(line.amount));
      assertPositiveMoney(lineAmount);

      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${line.invoiceId}::uuid AND tenant_id = ${input.organizationId}::uuid FOR UPDATE`;
      const invoice = await tx.invoice.findFirst({
        where: { id: line.invoiceId, tenantId: input.organizationId },
      });
      if (invoice === null) {
        throw new NotFoundException({ message: 'Invoice not found', code: 'INVOICE_NOT_FOUND' });
      }
      if (invoice.status !== 'POSTED' && invoice.status !== 'PARTIALLY_PAID') {
        throw new ConflictException({
          message: 'Invoice is not allocatable',
          code: 'INVOICE_NOT_ALLOCATABLE',
        });
      }
      assertCurrencyMatch(invoice.currency, input.currency);
      if (input.leaseId !== null && invoice.leaseId !== input.leaseId) {
        throw new UnprocessableEntityException({
          message: 'Invoice lease does not match payment lease',
          code: 'ALLOCATION_LEASE_MISMATCH',
        });
      }
      if (lineAmount.gt(invoice.balanceAmount)) {
        throw new UnprocessableEntityException({
          message: 'Allocation exceeds invoice balance',
          code: 'ALLOCATION_EXCEEDS_AVAILABLE',
        });
      }

      const allocationId = randomUUID();
      await tx.paymentAllocation.create({
        data: {
          id: allocationId,
          tenantId: input.organizationId,
          paymentTransactionId: input.paymentId,
          invoiceId: invoice.id,
          amount: lineAmount,
          currency: input.currency,
          effectiveAt: input.effectiveAt,
        },
      });

      const balanceAfter = roundMoney(invoice.balanceAmount.minus(lineAmount));
      const nextStatus = invoiceStatusAfterAllocation(balanceAfter);
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          balanceAmount: balanceAfter.lt(0) ? new Prisma.Decimal(0) : balanceAfter,
          status: nextStatus,
          version: { increment: 1 },
        },
      });
      await tx.invoiceStatusHistory.create({
        data: {
          tenantId: input.organizationId,
          invoiceId: invoice.id,
          fromStatus: invoice.status,
          toStatus: nextStatus,
          reason: 'Payment allocation',
        },
      });

      allocatedTotal = allocatedTotal.plus(lineAmount);
      created.push({
        id: allocationId,
        paymentTransactionId: input.paymentId,
        invoiceId: invoice.id,
        amount: decimalToString(lineAmount),
        currency: input.currency,
        effectiveAt: input.effectiveAt.toISOString(),
        reversedAt: null,
        createdAt: new Date().toISOString(),
      });
    }

    const payment = await tx.paymentTransaction.findFirstOrThrow({
      where: { id: input.paymentId, tenantId: input.organizationId },
    });
    await tx.paymentTransaction.update({
      where: { id: payment.id },
      data: {
        unallocatedAmount: roundMoney(payment.unallocatedAmount.minus(allocatedTotal)),
        version: { increment: 1 },
      },
    });

    return { allocatedTotal: roundMoney(allocatedTotal), allocations: created };
  }

  toResponse(row: PaymentRow, includeAllocations: boolean): PaymentTransactionResponse {
    return {
      id: row.id,
      organizationId: row.tenantId,
      intentId: row.intentId,
      leaseId: row.leaseId,
      propertyId: row.propertyId,
      payerPartyId: row.payerPartyId,
      amount: decimalToString(row.amount),
      unallocatedAmount: decimalToString(row.unallocatedAmount),
      currency: row.currency,
      channel: row.channel,
      status: row.status,
      reconciliationStatus: row.reconciliationStatus ?? 'UNRECONCILED',
      externalReference: row.externalReference,
      provider: row.provider,
      providerPaymentId: row.providerPaymentId,
      receivedAt: row.receivedAt.toISOString(),
      accountingAt: row.accountingAt.toISOString(),
      notes: row.notes,
      evidenceDocumentId: row.evidenceDocumentId,
      receiptId: row.receipt?.id ?? null,
      version: row.version,
      ...(includeAllocations
        ? {
            allocations: row.allocations.map((allocation) => ({
              id: allocation.id,
              paymentTransactionId: allocation.paymentTransactionId,
              invoiceId: allocation.invoiceId,
              amount: decimalToString(allocation.amount),
              currency: allocation.currency,
              effectiveAt: allocation.effectiveAt.toISOString(),
              reversedAt: allocation.reversedAt?.toISOString() ?? null,
              createdAt: allocation.createdAt.toISOString(),
            })),
          }
        : {}),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
