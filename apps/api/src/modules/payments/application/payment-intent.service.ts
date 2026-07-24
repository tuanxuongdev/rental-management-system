import { randomUUID } from 'node:crypto';

import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { PaymentIntentCreate, PaymentIntentResponse } from '@rpm/contracts';

import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { actorScopeFromOrganization } from '../../../infrastructure/persistence/organization-context';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { decimalToString, roundMoney } from '../../billing/domain/billing.rules';
import { AuthorizationService } from '../../tenancy/application/authorization.service';
import { assertPositiveMoney } from '../domain/payment.rules';
import { SandboxPaymentAdapter } from '../infrastructure/sandbox.adapter';

@Injectable()
export class PaymentIntentService {
  private readonly sandbox = new SandboxPaymentAdapter();

  constructor(
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  async createIntent(
    organizationId: string,
    membershipId: string,
    body: PaymentIntentCreate,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<{ replayed: boolean; body: PaymentIntentResponse }> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.payments.record',
    );

    const amount = roundMoney(new Prisma.Decimal(body.amount));
    assertPositiveMoney(amount);

    const operation = `POST /v1/organizations/${organizationId}/payment-intents`;
    const actorScope = actorScopeFromOrganization(organizationId);
    const existing = await this.idempotency.findExisting(
      organizationId,
      actorScope,
      operation,
      idempotencyKey,
    );
    if (existing !== null && existing.requestHash === requestHash) {
      return { replayed: true, body: existing.responseBody as PaymentIntentResponse };
    }

    return this.transactions.run(async (tx) => {
      let propertyId: string | null = null;
      if (body.invoiceId !== undefined) {
        const invoice = await tx.invoice.findFirst({
          where: { id: body.invoiceId, tenantId: organizationId },
        });
        if (invoice === null) {
          throw new NotFoundException({ message: 'Invoice not found', code: 'INVOICE_NOT_FOUND' });
        }
        if (invoice.currency !== body.currency) {
          throw new UnprocessableEntityException({
            message: 'Currency must match invoice',
            code: 'CURRENCY_MISMATCH',
          });
        }
        propertyId = invoice.propertyId;
        await this.authorization.assertPropertyAccess(membershipId, organizationId, propertyId);
      } else if (body.leaseId !== undefined) {
        const lease = await tx.lease.findFirst({
          where: { id: body.leaseId, tenantId: organizationId, deletedAt: null },
        });
        if (lease === null) {
          throw new NotFoundException({ message: 'Lease not found', code: 'LEASE_NOT_FOUND' });
        }
        propertyId = lease.propertyId;
        await this.authorization.assertPropertyAccess(membershipId, organizationId, propertyId);
      } else {
        throw new UnprocessableEntityException({
          message: 'invoiceId or leaseId is required for payment intents',
          code: 'PAYMENT_INTENT_SCOPE_REQUIRED',
        });
      }

      const intentId = randomUUID();
      const checkout = this.sandbox.createCheckout({
        organizationId,
        intentId,
        amount: decimalToString(amount),
        currency: body.currency,
        returnUrl: body.returnUrl,
      });

      await tx.paymentIntent.create({
        data: {
          id: intentId,
          tenantId: organizationId,
          leaseId: body.leaseId ?? null,
          invoiceId: body.invoiceId ?? null,
          payerPartyId: body.payerPartyId ?? null,
          amount,
          currency: body.currency,
          channel: body.channel,
          status: 'REQUIRES_ACTION',
          provider: 'sandbox',
          providerIntentId: checkout.providerIntentId,
          idempotencyKey,
          checkoutUrl: checkout.checkoutUrl,
          metadata: {
            ...(body.metadata ?? {}),
            ...(propertyId !== null ? { propertyId } : {}),
          },
        },
      });

      const created = await tx.paymentIntent.findFirstOrThrow({
        where: { id: intentId, tenantId: organizationId },
      });
      const responseBody = this.toResponse(created);

      await this.idempotency.resolveOrCreate(tx, {
        tenantId: organizationId,
        actorScope,
        operation,
        key: idempotencyKey,
        requestHash,
        responseStatus: 201,
        responseBody,
      });

      return { replayed: false as const, body: responseBody };
    });
  }

  toResponse(row: {
    id: string;
    tenantId: string;
    leaseId: string | null;
    invoiceId: string | null;
    payerPartyId: string | null;
    amount: Prisma.Decimal;
    currency: string;
    channel: PaymentIntentResponse['channel'];
    status: PaymentIntentResponse['status'];
    provider: string;
    providerIntentId: string | null;
    checkoutUrl: string | null;
    failureReason: string | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): PaymentIntentResponse {
    return {
      id: row.id,
      organizationId: row.tenantId,
      leaseId: row.leaseId,
      invoiceId: row.invoiceId,
      payerPartyId: row.payerPartyId,
      amount: decimalToString(row.amount),
      currency: row.currency,
      channel: row.channel,
      status: row.status,
      provider: row.provider,
      providerIntentId: row.providerIntentId,
      checkoutUrl: row.checkoutUrl,
      failureReason: row.failureReason,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
