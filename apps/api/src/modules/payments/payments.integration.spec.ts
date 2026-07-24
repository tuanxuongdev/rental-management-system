import { createHmac, randomUUID } from 'node:crypto';

import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { type ActivateLeaseRequest } from '@rpm/contracts';
import {
  createIntegrationPrismaClient,
  isDatabaseReachable,
  resetPlatformTables,
} from '@rpm/testing';

import { PasswordHasherService } from '../../infrastructure/crypto/crypto.services';
import { IdempotencyService } from '../../infrastructure/idempotency/idempotency.service';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { TransactionService } from '../../infrastructure/persistence/transaction.service';
import { AuditService } from '../audit/audit.service';
import { DepositService } from '../billing/application/deposit.service';
import { InvoiceService } from '../billing/application/invoice.service';
import { LedgerService } from '../billing/application/ledger.service';
import { PropertyService } from '../inventory/application/property.service';
import { UnitService } from '../inventory/application/unit.service';
import { LeaseService } from '../leasing/application/lease.service';
import { PeriodService } from '../reconciliation/application/period.service';
import { ResidentService } from '../residents/application/resident.service';
import { AuthorizationService } from '../tenancy/application/authorization.service';
import { OrganizationService } from '../tenancy/application/organization.service';
import { RbacSeedService } from '../tenancy/application/rbac-seed.service';

import { DepositDispositionService } from './application/deposit-disposition.service';
import { PaymentIntentService } from './application/payment-intent.service';
import { PaymentService } from './application/payment.service';
import { WebhookService } from './application/webhook.service';

const databaseAvailable = await isDatabaseReachable();

describe.skipIf(!databaseAvailable)('Payments (Sprint-11)', () => {
  const prisma = createIntegrationPrismaClient();
  const transactions = new TransactionService(prisma as never);
  const passwords = new PasswordHasherService();
  const audit = new AuditService(prisma as never);
  const rbacSeed = new RbacSeedService(prisma as never);
  const authorization = new AuthorizationService(prisma as never);
  const organizations = new OrganizationService(prisma as never, transactions, audit, rbacSeed);
  const properties = new PropertyService(prisma as never, transactions, authorization, audit);
  const units = new UnitService(prisma as never, transactions, authorization, audit);
  const residents = new ResidentService(prisma as never, transactions, authorization, audit);
  const outbox = new OutboxService(prisma as never);
  const idempotency = new IdempotencyService(prisma as never);
  const deposits = new DepositService(prisma as never, authorization, outbox);
  const leases = new LeaseService(
    prisma as never,
    transactions,
    authorization,
    audit,
    outbox,
    idempotency,
    deposits,
  );
  const ledger = new LedgerService(prisma as never, authorization);
  const periods = new PeriodService(prisma as never, transactions, authorization, audit, outbox);
  const invoices = new InvoiceService(
    prisma as never,
    transactions,
    authorization,
    audit,
    outbox,
    idempotency,
    ledger,
  );
  const payments = new PaymentService(
    prisma as never,
    transactions,
    authorization,
    audit,
    outbox,
    idempotency,
    ledger,
    periods,
  );
  const intents = new PaymentIntentService(transactions, authorization, idempotency);
  const webhooks = new WebhookService(prisma as never, transactions, payments);
  const dispositions = new DepositDispositionService(
    transactions,
    authorization,
    audit,
    outbox,
    idempotency,
    ledger,
    periods,
  );

  beforeAll(async () => {
    await resetPlatformTables(prisma);
    await rbacSeed.ensureCatalog();
  });

  beforeEach(async () => {
    await resetPlatformTables(prisma);
    await rbacSeed.ensureCatalog();
    process.env.PAYMENTS_WEBHOOK_SECRET = 'sandbox-secret';
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function provisionVerifiedUser(emailAddress: string) {
    const passwordHash = await passwords.hashPassword('ValidPassword123!');
    return prisma.user.create({
      data: {
        email: emailAddress,
        normalizedEmail: emailAddress.toLowerCase(),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        credentials: { create: { provider: 'LOCAL', passwordHash } },
      },
    });
  }

  async function createOwnerOrg(email: string, displayName: string) {
    const user = await provisionVerifiedUser(email);
    const org = await organizations.createOrganization(user.id, { displayName });
    const membership = await prisma.tenantMembership.findFirstOrThrow({
      where: { tenantId: org.id, userId: user.id },
    });
    return { user, org, membership };
  }

  async function seedActiveLease(orgId: string, userId: string, membershipId: string) {
    const property = await properties.createProperty(orgId, userId, membershipId, {
      code: `P-${randomUUID().slice(0, 8)}`,
      name: 'Pay House',
      propertyType: 'BOARDING_HOUSE',
      addressLine1: '11 Pay St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });
    const unit = await units.createUnit(orgId, membershipId, userId, property.id, {
      code: 'U1',
      name: 'Unit 1',
      unitType: 'APARTMENT',
      allocationMode: 'WHOLE_UNIT',
      capacity: 1,
    });
    const resident = await residents.createResident(orgId, membershipId, userId, {
      displayName: 'Pay Resident',
      preferredPropertyId: property.id,
      contacts: [{ type: 'email', value: `pay-${randomUUID().slice(0, 8)}@example.com` }],
    });

    const created = await leases.createLease(orgId, membershipId, userId, {
      propertyId: property.id,
      currency: 'USD',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: '1000.0000',
      depositAmount: '500.0000',
      rentCadence: 'MONTHLY',
      parties: [{ partyId: resident.id, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
      allocation: {
        allocationType: 'WHOLE_UNIT',
        unitId: unit.id,
      },
    });

    const activateBody: ActivateLeaseRequest = { checklistAcknowledged: true };
    const activated = await leases.activateLease(
      orgId,
      membershipId,
      userId,
      created.id,
      activateBody,
      created.version,
      randomUUID(),
      randomUUID(),
    );

    return { property, unit, resident, lease: activated.body };
  }

  async function createPostedInvoice(input: {
    orgId: string;
    membershipId: string;
    userId: string;
    leaseId: string;
    propertyId: string;
    billToPartyId: string;
    total: string;
  }) {
    const invoiceId = randomUUID();
    await prisma.invoice.create({
      data: {
        id: invoiceId,
        tenantId: input.orgId,
        leaseId: input.leaseId,
        propertyId: input.propertyId,
        billToPartyId: input.billToPartyId,
        status: 'DRAFT',
        currency: 'USD',
        subtotalAmount: new Prisma.Decimal(input.total),
        taxAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(input.total),
        balanceAmount: new Prisma.Decimal(input.total),
        lines: {
          create: [
            {
              tenantId: input.orgId,
              lineNumber: 1,
              description: 'Rent',
              chargeKey: 'rent',
              quantity: new Prisma.Decimal(1),
              unitPrice: new Prisma.Decimal(input.total),
              taxAmount: new Prisma.Decimal(0),
              lineTotal: new Prisma.Decimal(input.total),
              currency: 'USD',
            },
          ],
        },
      },
    });

    const posted = await invoices.postInvoice(
      input.orgId,
      input.membershipId,
      input.userId,
      invoiceId,
      { postedAt: '2026-07-01T12:00:00.000Z' },
      1,
      randomUUID(),
      randomUUID(),
    );
    return posted.body;
  }

  function signWebhook(rawBody: string, timestampSeconds: number, secret = 'sandbox-secret') {
    const signedPayload = `${timestampSeconds}.${rawBody}`;
    return createHmac('sha256', secret).update(signedPayload).digest('hex');
  }

  it('T11-05 offline cash records ledger + receipt', async () => {
    const { user, org, membership } = await createOwnerOrg(
      `t11-05-${randomUUID()}@example.com`,
      'T11-05 Org',
    );
    const { property, resident, lease } = await seedActiveLease(org.id, user.id, membership.id);
    const invoice = await createPostedInvoice({
      orgId: org.id,
      membershipId: membership.id,
      userId: user.id,
      leaseId: lease.id,
      propertyId: property.id,
      billToPartyId: resident.id,
      total: '100.0000',
    });

    const result = await payments.recordManual(
      org.id,
      membership.id,
      user.id,
      {
        channel: 'CASH',
        amount: '100.0000',
        currency: 'USD',
        receivedAt: '2026-07-10T15:00:00.000Z',
        leaseId: lease.id,
        payerPartyId: resident.id,
        propertyId: property.id,
        allocations: [{ invoiceId: invoice.id, amount: '100.0000' }],
      },
      randomUUID(),
      randomUUID(),
    );

    expect(result.body.status).toBe('SETTLED');
    expect(result.body.receiptId).not.toBeNull();
    expect(result.body.unallocatedAmount).toBe('0.0000');

    const receipt = await prisma.paymentReceipt.findFirstOrThrow({
      where: { paymentTransactionId: result.body.id },
    });
    expect(receipt.receiptNumber).toMatch(/^RCP-2026-\d{6}$/);

    const ledgerRows = await prisma.ledgerEntry.findMany({
      where: { tenantId: org.id, sourceType: 'PAYMENT', sourceId: result.body.id },
    });
    expect(ledgerRows.length).toBe(2);

    const refreshedInvoice = await prisma.invoice.findFirstOrThrow({ where: { id: invoice.id } });
    expect(refreshedInvoice.status).toBe('PAID');
    expect(refreshedInvoice.balanceAmount.toFixed(4)).toBe('0.0000');
  });

  it('T11-07 partial allocation leaves unallocated credit', async () => {
    const { user, org, membership } = await createOwnerOrg(
      `t11-07-${randomUUID()}@example.com`,
      'T11-07 Org',
    );
    const { property, resident, lease } = await seedActiveLease(org.id, user.id, membership.id);
    const invoice = await createPostedInvoice({
      orgId: org.id,
      membershipId: membership.id,
      userId: user.id,
      leaseId: lease.id,
      propertyId: property.id,
      billToPartyId: resident.id,
      total: '100.0000',
    });

    const recorded = await payments.recordManual(
      org.id,
      membership.id,
      user.id,
      {
        channel: 'BANK_TRANSFER',
        amount: '150.0000',
        currency: 'USD',
        receivedAt: '2026-07-11T12:00:00.000Z',
        leaseId: lease.id,
        payerPartyId: resident.id,
        propertyId: property.id,
        allocations: [{ invoiceId: invoice.id, amount: '100.0000' }],
        externalReference: 'WIRE-150',
      },
      randomUUID(),
      randomUUID(),
    );

    expect(recorded.body.unallocatedAmount).toBe('50.0000');
    const invoiceAfter = await prisma.invoice.findFirstOrThrow({ where: { id: invoice.id } });
    expect(invoiceAfter.status).toBe('PAID');
  });

  it('T11-02 duplicate webhook is idempotent', async () => {
    const { user, org, membership } = await createOwnerOrg(
      `t11-02-${randomUUID()}@example.com`,
      'T11-02 Org',
    );
    const { property, resident, lease } = await seedActiveLease(org.id, user.id, membership.id);
    const invoice = await createPostedInvoice({
      orgId: org.id,
      membershipId: membership.id,
      userId: user.id,
      leaseId: lease.id,
      propertyId: property.id,
      billToPartyId: resident.id,
      total: '80.0000',
    });

    const intent = await intents.createIntent(
      org.id,
      membership.id,
      {
        amount: '80.0000',
        currency: 'USD',
        channel: 'CARD_HOSTED',
        invoiceId: invoice.id,
        leaseId: lease.id,
        payerPartyId: resident.id,
      },
      randomUUID(),
      randomUUID(),
    );

    const externalEventId = `evt_${randomUUID()}`;
    const payload = {
      externalEventId,
      eventType: 'payment_intent.succeeded',
      providerIntentId: intent.body.providerIntentId,
      providerPaymentId: `sandbox_pay_${randomUUID().slice(0, 8)}`,
    };
    const rawBody = JSON.stringify(payload);
    const ts = Math.floor(Date.now() / 1000);
    const signature = signWebhook(rawBody, ts);

    const first = await webhooks.handleProviderWebhook('sandbox', rawBody, {
      signature,
      timestamp: String(ts),
      externalEventId,
      eventType: 'payment_intent.succeeded',
    });
    const second = await webhooks.handleProviderWebhook('sandbox', rawBody, {
      signature,
      timestamp: String(ts),
      externalEventId,
      eventType: 'payment_intent.succeeded',
    });

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.eventId).toBe(first.eventId);

    const txCount = await prisma.paymentTransaction.count({
      where: { tenantId: org.id, intentId: intent.body.id },
    });
    expect(txCount).toBe(1);
  });

  it('T11-04 invalid HMAC is rejected', async () => {
    const rawBody = JSON.stringify({ externalEventId: `evt_${randomUUID()}` });
    const ts = Math.floor(Date.now() / 1000);
    await expect(
      webhooks.handleProviderWebhook('sandbox', rawBody, {
        signature: 'deadbeef',
        timestamp: String(ts),
        externalEventId: `evt_${randomUUID()}`,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('T11-09 cross-org payment id returns 404', async () => {
    const a = await createOwnerOrg(`t11-09a-${randomUUID()}@example.com`, 'T11-09 A');
    const b = await createOwnerOrg(`t11-09b-${randomUUID()}@example.com`, 'T11-09 B');
    const { property, resident, lease } = await seedActiveLease(
      a.org.id,
      a.user.id,
      a.membership.id,
    );

    const recorded = await payments.recordManual(
      a.org.id,
      a.membership.id,
      a.user.id,
      {
        channel: 'CASH',
        amount: '25.0000',
        currency: 'USD',
        receivedAt: '2026-07-12T12:00:00.000Z',
        leaseId: lease.id,
        payerPartyId: resident.id,
        propertyId: property.id,
        allocations: [],
      },
      randomUUID(),
      randomUUID(),
    );

    await expect(
      payments.getPayment(b.org.id, b.membership.id, recorded.body.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deposit execute reduces held amount', async () => {
    const { user, org, membership } = await createOwnerOrg(
      `t11-dep-${randomUUID()}@example.com`,
      'T11-Dep Org',
    );
    const { lease } = await seedActiveLease(org.id, user.id, membership.id);
    const deposit = await prisma.securityDeposit.findFirstOrThrow({
      where: { tenantId: org.id, leaseId: lease.id },
    });
    await prisma.securityDeposit.update({
      where: { id: deposit.id },
      data: {
        amountHeld: new Prisma.Decimal('500.0000'),
        status: 'HELD',
      },
    });

    const created = await dispositions.createDispositions(
      org.id,
      membership.id,
      user.id,
      deposit.id,
      {
        effectiveAt: '2026-07-20T12:00:00.000Z',
        lines: [
          {
            dispositionType: 'REFUND',
            amount: '200.0000',
            reason: 'Partial refund on move-out',
          },
        ],
      },
      randomUUID(),
      randomUUID(),
    );

    const line = created.body.lines[0]!;
    await dispositions.executeDisposition(
      org.id,
      membership.id,
      user.id,
      line.id,
      { executedAt: '2026-07-20T13:00:00.000Z' },
      randomUUID(),
      randomUUID(),
    );

    const refreshed = await prisma.securityDeposit.findFirstOrThrow({ where: { id: deposit.id } });
    expect(refreshed.amountHeld.toFixed(4)).toBe('300.0000');
    expect(refreshed.status).toBe('PARTIALLY_DISPOSED');
  });
});
