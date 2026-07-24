import { randomUUID } from 'node:crypto';

import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { type ActivateLeaseRequest, DEPOSIT_RECORDED_EVENT_TYPE } from '@rpm/contracts';
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
import { PropertyService } from '../inventory/application/property.service';
import { UnitService } from '../inventory/application/unit.service';
import { LeaseService } from '../leasing/application/lease.service';
import { ResidentService } from '../residents/application/resident.service';
import { AuthorizationService } from '../tenancy/application/authorization.service';
import { OrganizationService } from '../tenancy/application/organization.service';
import { RbacSeedService } from '../tenancy/application/rbac-seed.service';

import { BillingRunService } from './application/billing-run.service';
import { CreditNoteService } from './application/credit-note.service';
import { DepositService } from './application/deposit.service';
import { InvoiceService } from './application/invoice.service';
import { LedgerService } from './application/ledger.service';

const databaseAvailable = await isDatabaseReachable();

describe.skipIf(!databaseAvailable)('Billing foundation (Sprint-10)', () => {
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
  const ledger = new LedgerService(prisma as never);
  const invoices = new InvoiceService(
    prisma as never,
    transactions,
    authorization,
    audit,
    outbox,
    idempotency,
    ledger,
  );
  const creditNotes = new CreditNoteService(
    prisma as never,
    transactions,
    authorization,
    audit,
    idempotency,
    ledger,
  );
  const billingRuns = new BillingRunService(
    prisma as never,
    transactions,
    authorization,
    audit,
    outbox,
    idempotency,
    deposits,
    invoices,
  );

  beforeAll(async () => {
    await resetPlatformTables(prisma);
    await rbacSeed.ensureCatalog();
  });

  beforeEach(async () => {
    await resetPlatformTables(prisma);
    await rbacSeed.ensureCatalog();
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
      name: 'Billing House',
      propertyType: 'BOARDING_HOUSE',
      addressLine1: '10 Bill St',
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
      displayName: 'Bill Resident',
      preferredPropertyId: property.id,
      contacts: [{ type: 'email', value: `bill-${randomUUID().slice(0, 8)}@example.com` }],
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

    // Prefer OCCUPIED for billing preview preference path.
    await prisma.lease.update({
      where: { id: created.id },
      data: { occupancyState: 'OCCUPIED', movedInAt: new Date('2026-01-05T00:00:00.000Z') },
    });

    return { property, unit, resident, lease: activated.body };
  }

  it('T10-01 preview does not write invoices', async () => {
    const { user, org, membership } = await createOwnerOrg(
      `t10-01-${randomUUID()}@example.com`,
      'T10-01 Org',
    );
    const { property, lease } = await seedActiveLease(org.id, user.id, membership.id);

    const depositEvent = await prisma.outboxEvent.findFirst({
      where: { tenantId: org.id, eventType: DEPOSIT_RECORDED_EVENT_TYPE },
    });
    expect(depositEvent).not.toBeNull();

    const run = await billingRuns.createBillingRun(org.id, membership.id, user.id, {
      propertyId: property.id,
      periodKey: '2026-07',
      timeZone: 'UTC',
      periodStart: '2026-07-01',
      periodEnd: '2026-08-01',
      currency: 'USD',
    });

    const preview = await billingRuns.previewBillingRun(
      org.id,
      membership.id,
      user.id,
      run.id,
      { sampleLimit: 10 },
      run.version,
    );

    expect(preview.lineCount).toBeGreaterThanOrEqual(1);
    expect(preview.sampleLines.some((line) => line.leaseId === lease.id)).toBe(true);

    const invoiceCount = await prisma.invoice.count({ where: { tenantId: org.id } });
    expect(invoiceCount).toBe(0);
  });

  it('T10-02 commit creates posted invoice + ledger', async () => {
    const { user, org, membership } = await createOwnerOrg(
      `t10-02-${randomUUID()}@example.com`,
      'T10-02 Org',
    );
    const { property } = await seedActiveLease(org.id, user.id, membership.id);

    let run = await billingRuns.createBillingRun(org.id, membership.id, user.id, {
      propertyId: property.id,
      periodKey: '2026-07',
      timeZone: 'UTC',
      periodStart: '2026-07-01',
      periodEnd: '2026-08-01',
      currency: 'USD',
    });
    const preview = await billingRuns.previewBillingRun(
      org.id,
      membership.id,
      user.id,
      run.id,
      {},
      run.version,
    );
    run = await billingRuns.getBillingRun(org.id, membership.id, run.id);
    await billingRuns.approveBillingRun(org.id, membership.id, user.id, run.id, {}, run.version);
    run = await billingRuns.getBillingRun(org.id, membership.id, run.id);

    const committed = await billingRuns.commitBillingRun(
      org.id,
      membership.id,
      user.id,
      run.id,
      {},
      run.version,
      randomUUID(),
      randomUUID(),
    );

    expect(committed.body.status).toBe('COMPLETED');
    expect(preview.lineCount).toBeGreaterThanOrEqual(1);

    const invoice = await prisma.invoice.findFirst({
      where: { tenantId: org.id, periodKey: '2026-07' },
      include: { lines: true },
    });
    expect(invoice?.status).toBe('POSTED');
    expect(invoice?.invoiceNumber).toMatch(/^INV-2026-\d+$/);
    expect(invoice?.lines.length).toBeGreaterThanOrEqual(1);

    const ledgerCount = await prisma.ledgerEntry.count({
      where: { tenantId: org.id, sourceType: 'INVOICE', sourceId: invoice!.id },
    });
    expect(ledgerCount).toBe(2);
  });

  it('T10-03 re-commit does not duplicate charges', async () => {
    const { user, org, membership } = await createOwnerOrg(
      `t10-03-${randomUUID()}@example.com`,
      'T10-03 Org',
    );
    const { property } = await seedActiveLease(org.id, user.id, membership.id);

    let run = await billingRuns.createBillingRun(org.id, membership.id, user.id, {
      propertyId: property.id,
      periodKey: '2026-07',
      timeZone: 'UTC',
      periodStart: '2026-07-01',
      periodEnd: '2026-08-01',
      currency: 'USD',
    });
    await billingRuns.previewBillingRun(org.id, membership.id, user.id, run.id, {}, run.version);
    run = await billingRuns.getBillingRun(org.id, membership.id, run.id);
    await billingRuns.approveBillingRun(org.id, membership.id, user.id, run.id, {}, run.version);
    run = await billingRuns.getBillingRun(org.id, membership.id, run.id);

    await billingRuns.commitBillingRun(
      org.id,
      membership.id,
      user.id,
      run.id,
      {},
      run.version,
      randomUUID(),
      randomUUID(),
    );

    run = await billingRuns.getBillingRun(org.id, membership.id, run.id);
    await billingRuns.retryBillingRun(
      org.id,
      membership.id,
      user.id,
      run.id,
      { retryFailedOnly: true },
      run.version,
      randomUUID(),
      randomUUID(),
    );

    const invoicesForPeriod = await prisma.invoice.findMany({
      where: { tenantId: org.id, periodKey: '2026-07', status: 'POSTED' },
      include: { lines: true },
    });
    const lineCount = invoicesForPeriod.reduce((sum, inv) => sum + inv.lines.length, 0);
    expect(invoicesForPeriod.length).toBe(1);
    expect(lineCount).toBe(1);

    const ledgerCount = await prisma.ledgerEntry.count({
      where: { tenantId: org.id, sourceType: 'INVOICE' },
    });
    expect(ledgerCount).toBe(2);
  });

  it('T10-08 credit note posts and reduces balance', async () => {
    const { user, org, membership } = await createOwnerOrg(
      `t10-08-${randomUUID()}@example.com`,
      'T10-08 Org',
    );
    const { property } = await seedActiveLease(org.id, user.id, membership.id);

    let run = await billingRuns.createBillingRun(org.id, membership.id, user.id, {
      propertyId: property.id,
      periodKey: '2026-07',
      timeZone: 'UTC',
      periodStart: '2026-07-01',
      periodEnd: '2026-08-01',
      currency: 'USD',
    });
    await billingRuns.previewBillingRun(org.id, membership.id, user.id, run.id, {}, run.version);
    run = await billingRuns.getBillingRun(org.id, membership.id, run.id);
    await billingRuns.approveBillingRun(org.id, membership.id, user.id, run.id, {}, run.version);
    run = await billingRuns.getBillingRun(org.id, membership.id, run.id);
    await billingRuns.commitBillingRun(
      org.id,
      membership.id,
      user.id,
      run.id,
      {},
      run.version,
      randomUUID(),
      randomUUID(),
    );

    const invoice = await prisma.invoice.findFirstOrThrow({
      where: { tenantId: org.id, status: 'POSTED' },
      include: { lines: true },
    });

    const credit = await creditNotes.createCreditNote(org.id, membership.id, user.id, {
      invoiceId: invoice.id,
      reason: 'Goodwill adjustment',
      currency: 'USD',
      lines: [
        {
          invoiceLineId: invoice.lines[0]?.id,
          description: 'Partial credit',
          amount: '100.0000',
        },
      ],
    });

    const posted = await creditNotes.postCreditNote(
      org.id,
      membership.id,
      user.id,
      credit.id,
      { postedAt: new Date().toISOString() },
      credit.version,
      randomUUID(),
      randomUUID(),
    );

    expect(posted.body.status).toBe('POSTED');
    expect(posted.body.creditNoteNumber).toMatch(/^CN-2026-\d+$/);

    const refreshed = await prisma.invoice.findFirstOrThrow({ where: { id: invoice.id } });
    expect(refreshed.balanceAmount.toFixed(4)).toBe('900.0000');
    expect(refreshed.status).toBe('PARTIALLY_PAID');

    const cnLedger = await prisma.ledgerEntry.count({
      where: { tenantId: org.id, sourceType: 'CREDIT_NOTE', sourceId: credit.id },
    });
    expect(cnLedger).toBe(2);
  });

  it('T10-10 cross-org invoice id returns 404', async () => {
    const a = await createOwnerOrg(`t10-10a-${randomUUID()}@example.com`, 'Org A');
    const b = await createOwnerOrg(`t10-10b-${randomUUID()}@example.com`, 'Org B');
    const { property } = await seedActiveLease(a.org.id, a.user.id, a.membership.id);

    let run = await billingRuns.createBillingRun(a.org.id, a.membership.id, a.user.id, {
      propertyId: property.id,
      periodKey: '2026-07',
      timeZone: 'UTC',
      periodStart: '2026-07-01',
      periodEnd: '2026-08-01',
      currency: 'USD',
    });
    await billingRuns.previewBillingRun(
      a.org.id,
      a.membership.id,
      a.user.id,
      run.id,
      {},
      run.version,
    );
    run = await billingRuns.getBillingRun(a.org.id, a.membership.id, run.id);
    await billingRuns.approveBillingRun(
      a.org.id,
      a.membership.id,
      a.user.id,
      run.id,
      {},
      run.version,
    );
    run = await billingRuns.getBillingRun(a.org.id, a.membership.id, run.id);
    await billingRuns.commitBillingRun(
      a.org.id,
      a.membership.id,
      a.user.id,
      run.id,
      {},
      run.version,
      randomUUID(),
      randomUUID(),
    );

    const invoice = await prisma.invoice.findFirstOrThrow({
      where: { tenantId: a.org.id },
    });

    await expect(invoices.getInvoice(b.org.id, b.membership.id, invoice.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('T10-12 void works and posted line delete is rejected', async () => {
    const { user, org, membership } = await createOwnerOrg(
      `t10-12-${randomUUID()}@example.com`,
      'T10-12 Org',
    );
    const { property } = await seedActiveLease(org.id, user.id, membership.id);

    let run = await billingRuns.createBillingRun(org.id, membership.id, user.id, {
      propertyId: property.id,
      periodKey: '2026-07',
      timeZone: 'UTC',
      periodStart: '2026-07-01',
      periodEnd: '2026-08-01',
      currency: 'USD',
    });
    await billingRuns.previewBillingRun(org.id, membership.id, user.id, run.id, {}, run.version);
    run = await billingRuns.getBillingRun(org.id, membership.id, run.id);
    await billingRuns.approveBillingRun(org.id, membership.id, user.id, run.id, {}, run.version);
    run = await billingRuns.getBillingRun(org.id, membership.id, run.id);
    await billingRuns.commitBillingRun(
      org.id,
      membership.id,
      user.id,
      run.id,
      {},
      run.version,
      randomUUID(),
      randomUUID(),
    );

    const invoice = await prisma.invoice.findFirstOrThrow({
      where: { tenantId: org.id, status: 'POSTED' },
      include: { lines: true },
    });

    await expect(
      invoices.rejectDeletePostedLine(org.id, membership.id, invoice.id, invoice.lines[0]!.id),
    ).rejects.toBeInstanceOf(ConflictException);

    const voided = await invoices.voidInvoice(
      org.id,
      membership.id,
      user.id,
      invoice.id,
      {
        reason: 'Posted in error',
        effectiveAt: new Date().toISOString(),
      },
      invoice.version,
      randomUUID(),
      randomUUID(),
    );

    expect(voided.body.status).toBe('VOID');
    const voidLedger = await prisma.ledgerEntry.count({
      where: { tenantId: org.id, sourceType: 'INVOICE_VOID', sourceId: invoice.id },
    });
    expect(voidLedger).toBe(2);
  });
});
