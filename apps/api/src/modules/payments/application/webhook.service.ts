import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import {
  Inject,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';

import type { ProviderWebhookAcceptedResponse } from '@rpm/contracts';

import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { roundMoney } from '../../billing/domain/billing.rules';
import { assertWebhookTimestampWindow, parseWebhookTimestamp } from '../domain/payment.rules';
import { SandboxPaymentAdapter } from '../infrastructure/sandbox.adapter';

import { PaymentService } from './payment.service';

import type { Prisma } from '@prisma/client';

const DEFAULT_WEBHOOK_SECRET = 'sandbox-secret';

function resolveWebhookSecret(): string {
  const configured = process.env.PAYMENTS_WEBHOOK_SECRET?.trim();
  if (configured !== undefined && configured.length > 0) {
    return configured;
  }
  const allowDefault =
    process.env.NODE_ENV === 'test' || process.env.PAYMENTS_WEBHOOK_ALLOW_DEFAULT_SECRET === 'true';
  if (allowDefault) {
    return DEFAULT_WEBHOOK_SECRET;
  }
  throw new UnauthorizedException({
    message: 'Payment webhook secret is not configured',
    code: 'WEBHOOK_SECRET_UNCONFIGURED',
  });
}

@Injectable()
export class WebhookService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(PaymentService) private readonly payments: PaymentService,
  ) {}

  async handleProviderWebhook(
    provider: string,
    rawBody: string,
    headers: {
      signature?: string;
      timestamp?: string;
      externalEventId?: string;
      eventType?: string;
    },
  ): Promise<ProviderWebhookAcceptedResponse> {
    if (provider !== 'sandbox') {
      throw new UnprocessableEntityException({
        message: 'Unsupported payment provider',
        code: 'PROVIDER_UNSUPPORTED',
      });
    }

    const secret = resolveWebhookSecret();
    const signature = headers.signature ?? '';
    const timestamp = parseWebhookTimestamp(headers.timestamp);
    assertWebhookTimestampWindow(timestamp);

    const signedPayload = `${Math.floor(timestamp.getTime() / 1000)}.${rawBody}`;
    const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');
    const signatureValid = this.signaturesMatch(signature, expected);
    if (!signatureValid) {
      throw new UnauthorizedException({
        message: 'Invalid webhook signature',
        code: 'WEBHOOK_SIGNATURE_INVALID',
      });
    }

    let payload: Prisma.InputJsonValue;
    try {
      payload = JSON.parse(rawBody) as Prisma.InputJsonValue;
    } catch {
      throw new UnprocessableEntityException({
        message: 'Webhook payload must be JSON',
        code: 'WEBHOOK_PAYLOAD_INVALID',
      });
    }

    const payloadRecord =
      payload !== null && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};

    const externalEventId =
      headers.externalEventId ??
      (typeof payloadRecord.externalEventId === 'string'
        ? payloadRecord.externalEventId
        : undefined) ??
      (typeof payloadRecord.id === 'string' ? payloadRecord.id : undefined);
    if (externalEventId === undefined) {
      throw new UnprocessableEntityException({
        message: 'externalEventId required',
        code: 'WEBHOOK_EVENT_ID_REQUIRED',
      });
    }

    const eventType =
      headers.eventType ??
      (typeof payloadRecord.eventType === 'string'
        ? payloadRecord.eventType
        : 'payment_intent.succeeded');

    const payloadHash = createHmac('sha256', 'payload').update(rawBody).digest('hex');

    const existing = await this.prisma.providerWebhookEvent.findFirst({
      where: { provider, externalEventId },
    });
    if (existing !== null) {
      return {
        accepted: true,
        eventId: existing.id,
        processingStatus: existing.processingStatus,
        replayed: true,
      };
    }

    return this.transactions.run(async (tx) => {
      const eventId = randomUUID();
      try {
        await tx.providerWebhookEvent.create({
          data: {
            id: eventId,
            provider,
            externalEventId,
            eventType,
            signatureValid: true,
            payloadHash,
            payload,
            processingStatus: 'RECEIVED',
          },
        });
      } catch {
        const raced = await tx.providerWebhookEvent.findFirst({
          where: { provider, externalEventId },
        });
        if (raced !== null) {
          return {
            accepted: true,
            eventId: raced.id,
            processingStatus: raced.processingStatus,
            replayed: true,
          };
        }
        throw new UnprocessableEntityException({
          message: 'Unable to persist webhook event',
          code: 'WEBHOOK_PERSIST_FAILED',
        });
      }

      try {
        if (eventType === 'payment_intent.succeeded' || eventType === 'payment.succeeded') {
          const providerIntentId =
            typeof payloadRecord.providerIntentId === 'string'
              ? payloadRecord.providerIntentId
              : typeof payloadRecord.intentId === 'string'
                ? payloadRecord.intentId
                : null;
          if (providerIntentId === null) {
            throw new UnprocessableEntityException({
              message: 'providerIntentId required for success event',
              code: 'WEBHOOK_INTENT_REQUIRED',
            });
          }

          const intent = await tx.paymentIntent.findFirst({
            where: { provider: 'sandbox', providerIntentId },
          });
          if (intent === null) {
            await tx.providerWebhookEvent.update({
              where: { id: eventId },
              data: {
                processingStatus: 'IGNORED',
                processedAt: new Date(),
                errorMessage: 'Unknown payment intent',
              },
            });
            return {
              accepted: true,
              eventId,
              processingStatus: 'IGNORED' as const,
              replayed: false,
            };
          }

          const metadata =
            intent.metadata !== null &&
            typeof intent.metadata === 'object' &&
            !Array.isArray(intent.metadata)
              ? (intent.metadata as Record<string, unknown>)
              : {};
          const propertyId = typeof metadata.propertyId === 'string' ? metadata.propertyId : null;

          await tx.paymentIntent.update({
            where: { id: intent.id },
            data: { status: 'SUCCEEDED', version: { increment: 1 } },
          });

          const providerPaymentId =
            typeof payloadRecord.providerPaymentId === 'string'
              ? payloadRecord.providerPaymentId
              : SandboxPaymentAdapter.newProviderPaymentId();

          await this.payments.settleFromIntentInTx(tx, {
            organizationId: intent.tenantId,
            intentId: intent.id,
            providerPaymentId,
            amount: roundMoney(intent.amount),
            currency: intent.currency,
            channel: intent.channel,
            leaseId: intent.leaseId,
            propertyId,
            payerPartyId: intent.payerPartyId,
            invoiceId: intent.invoiceId,
            receivedAt: new Date(),
          });

          await tx.providerWebhookEvent.update({
            where: { id: eventId },
            data: {
              tenantId: intent.tenantId,
              processingStatus: 'PROCESSED',
              processedAt: new Date(),
            },
          });

          return {
            accepted: true,
            eventId,
            processingStatus: 'PROCESSED' as const,
            replayed: false,
          };
        }

        await tx.providerWebhookEvent.update({
          where: { id: eventId },
          data: {
            processingStatus: 'IGNORED',
            processedAt: new Date(),
            errorMessage: `Unhandled event type ${eventType}`,
          },
        });
        return {
          accepted: true,
          eventId,
          processingStatus: 'IGNORED' as const,
          replayed: false,
        };
      } catch (error) {
        await tx.providerWebhookEvent.update({
          where: { id: eventId },
          data: {
            processingStatus: 'FAILED',
            processedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : 'Webhook processing failed',
          },
        });
        throw error;
      }
    });
  }

  private signaturesMatch(provided: string, expected: string): boolean {
    try {
      const a = Buffer.from(provided, 'utf8');
      const b = Buffer.from(expected, 'utf8');
      if (a.length !== b.length) {
        return false;
      }
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }
}
