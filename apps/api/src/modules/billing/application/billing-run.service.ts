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
  BILLING_RUN_COMMIT_EVENT_TYPE,
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  type ApproveBillingRunRequest,
  type BillingRunPreviewLine,
  type BillingRunPreviewRequest,
  type BillingRunPreviewResponse,
  type BillingRunResponse,
  type BillingRunsCollection,
  type CommitBillingRunRequest,
  type CreateBillingRunRequest,
  type RetryBillingRunRequest,
} from '@rpm/contracts';

import { throwVersionMismatch } from '../../../common/auth/if-match';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service';
import {
  actorScopeFromOrganization,
  type ActorScope,
} from '../../../infrastructure/persistence/organization-context';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';
import { AuthorizationService } from '../../tenancy/application/authorization.service';
import {
  assertPeriodKey,
  billingAdvisoryLockKey,
  decimalToString,
  formatDateOnly,
  parseDateOnly,
  periodBounds,
  priorPeriodKey,
  rentChargeKey,
  roundMoney,
} from '../domain/billing.rules';

import { DepositService } from './deposit.service';
import { InvoiceService } from './invoice.service';

type PreviewPayload = {
  generatedAt: string;
  currency: string | null;
  totalsAmount: string | null;
  priorPeriodTotalsAmount: string | null;
  lineCount: number;
  lines: BillingRunPreviewLine[];
};

@Injectable()
export class BillingRunService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(DepositService) private readonly deposits: DepositService,
    @Inject(InvoiceService) private readonly invoices: InvoiceService,
  ) {}

  async createBillingRun(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    body: CreateBillingRunRequest,
    correlationId?: string,
  ): Promise<BillingRunResponse> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.billing_run.preview',
    );
    assertPeriodKey(body.periodKey);
    if (body.propertyId !== undefined) {
      await this.authorization.assertPropertyAccess(membershipId, organizationId, body.propertyId);
    }

    const bounds = periodBounds(body.periodKey, body.timeZone);
    const periodStart = parseDateOnly(body.periodStart);
    const periodEnd = parseDateOnly(body.periodEnd);

    const run = await this.transactions.run(async (tx) => {
      await this.ensureSchedulesForScope(tx, organizationId, body.propertyId);

      return tx.billingRun.create({
        data: {
          tenantId: organizationId,
          scheduleId: body.scheduleId ?? null,
          propertyId: body.propertyId ?? null,
          periodKey: body.periodKey,
          status: 'DRAFT',
          timeZone: body.timeZone,
          periodStart: bounds.start,
          periodEnd: bounds.end,
          currency: body.currency ?? null,
          // Keep request dates for response mapping when they differ from TZ bounds storage.
          previewPayload: {
            requestPeriodStart: body.periodStart,
            requestPeriodEnd: body.periodEnd,
            computedPeriodStart: formatDateOnly(periodStart),
            computedPeriodEnd: formatDateOnly(periodEnd),
          },
        },
      });
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'billing_run.create',
      outcome: 'SUCCESS',
      targetType: 'billing_run',
      targetId: run.id,
      correlationId,
    });

    return this.toResponse(run);
  }

  async listBillingRuns(
    organizationId: string,
    membershipId: string,
    options?: { limit?: number; after?: string; status?: string; periodKey?: string },
  ): Promise<BillingRunsCollection> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.billing_run.preview',
    );
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);
    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );
    const propertyScope =
      accessible === null
        ? {}
        : {
            propertyId: { in: accessible },
          };

    const rows = await this.prisma.billingRun.findMany({
      where: {
        tenantId: organizationId,
        ...propertyScope,
        ...(options?.status !== undefined
          ? { status: options.status as Prisma.EnumBillingRunStatusFilter['equals'] }
          : {}),
        ...(options?.periodKey !== undefined ? { periodKey: options.periodKey } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(options?.after !== undefined ? { cursor: { id: options.after }, skip: 1 } : {}),
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      data: page.map((row) => this.toResponse(row)),
      page: {
        nextCursor: rows.length > limit && last !== undefined ? last.id : null,
        previousCursor: null,
        limit,
      },
      meta: {},
    };
  }

  async getBillingRun(
    organizationId: string,
    membershipId: string,
    billingRunId: string,
  ): Promise<BillingRunResponse> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.billing_run.preview',
    );
    const run = await this.findRunOrThrow(organizationId, billingRunId);
    if (run.propertyId !== null) {
      await this.authorization.assertPropertyAccess(membershipId, organizationId, run.propertyId);
    }
    return this.toResponse(run);
  }

  /**
   * Preview updates run previewPayload/status only — never writes invoices.
   */
  async previewBillingRun(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    billingRunId: string,
    body: BillingRunPreviewRequest,
    expectedVersion: number,
    correlationId?: string,
  ): Promise<BillingRunPreviewResponse> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.billing_run.preview',
    );

    const run = await this.findRunOrThrow(organizationId, billingRunId);
    if (run.version !== expectedVersion) {
      throwVersionMismatch('Billing run version mismatch');
    }
    if (run.propertyId !== null) {
      await this.authorization.assertPropertyAccess(membershipId, organizationId, run.propertyId);
    }
    if (run.status === 'COMPLETED' || run.status === 'COMMITTING') {
      throw new ConflictException({
        message: 'Cannot preview a committing/completed billing run',
        code: 'BILLING_RUN_LOCKED',
      });
    }

    const preview = await this.buildPreview(organizationId, run, body.sampleLimit ?? 25);

    const updated = await this.prisma.billingRun.update({
      where: { id: run.id },
      data: {
        status: 'PREVIEWED',
        previewPayload: preview as unknown as Prisma.InputJsonValue,
        totalsAmount:
          preview.totalsAmount !== null ? new Prisma.Decimal(preview.totalsAmount) : null,
        currency: preview.currency,
        version: { increment: 1 },
      },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'billing_run.preview',
      outcome: 'SUCCESS',
      targetType: 'billing_run',
      targetId: billingRunId,
      correlationId,
    });

    return {
      billingRunId: updated.id,
      status: updated.status,
      periodKey: updated.periodKey,
      currency: preview.currency,
      totalsAmount: preview.totalsAmount,
      priorPeriodTotalsAmount: preview.priorPeriodTotalsAmount,
      lineCount: preview.lineCount,
      sampleLines: preview.lines.slice(0, body.sampleLimit ?? 25),
      generatedAt: preview.generatedAt,
    };
  }

  async approveBillingRun(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    billingRunId: string,
    _body: ApproveBillingRunRequest,
    expectedVersion: number,
    correlationId?: string,
  ): Promise<BillingRunResponse> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.billing_run.commit',
    );
    const run = await this.findRunOrThrow(organizationId, billingRunId);
    if (run.version !== expectedVersion) {
      throwVersionMismatch('Billing run version mismatch');
    }
    if (run.status !== 'PREVIEWED' && run.status !== 'APPROVED') {
      throw new ConflictException({
        message: 'Billing run must be previewed before approval',
        code: 'BILLING_RUN_NOT_PREVIEWED',
      });
    }

    const updated = await this.prisma.billingRun.update({
      where: { id: run.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedByUserId: actorUserId,
        version: { increment: 1 },
      },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'billing_run.approve',
      outcome: 'SUCCESS',
      targetType: 'billing_run',
      targetId: billingRunId,
      correlationId,
    });

    return this.toResponse(updated);
  }

  async commitBillingRun(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    billingRunId: string,
    body: CommitBillingRunRequest,
    expectedVersion: number,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: BillingRunResponse }> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.billing_run.commit',
    );
    const operation = `POST /v1/organizations/${organizationId}/billing-runs/${billingRunId}/commit`;
    const actorScope = actorScopeFromOrganization(organizationId);

    const existing = await this.idempotency.findExisting(
      organizationId,
      actorScope,
      operation,
      idempotencyKey,
    );
    if (existing !== null && existing.requestHash === requestHash) {
      return { replayed: true, body: existing.responseBody as BillingRunResponse };
    }

    const result = await this.executeCommit(organizationId, billingRunId, {
      actorUserId,
      membershipId,
      expectedVersion,
      correlationId,
      requireApproved: true,
      approvalEvidence: body.approvalEvidence,
      idempotency: {
        tenantId: organizationId,
        actorScope,
        operation,
        key: idempotencyKey,
        requestHash,
        responseStatus: 200,
      },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'billing_run.commit',
      outcome: 'SUCCESS',
      targetType: 'billing_run',
      targetId: billingRunId,
      correlationId,
    });

    return { replayed: false, body: result };
  }

  async retryBillingRun(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    billingRunId: string,
    _body: RetryBillingRunRequest,
    expectedVersion: number,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: BillingRunResponse }> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.billing_run.commit',
    );
    const operation = `POST /v1/organizations/${organizationId}/billing-runs/${billingRunId}/retry`;
    const actorScope = actorScopeFromOrganization(organizationId);

    const existing = await this.idempotency.findExisting(
      organizationId,
      actorScope,
      operation,
      idempotencyKey,
    );
    if (existing !== null && existing.requestHash === requestHash) {
      return { replayed: true, body: existing.responseBody as BillingRunResponse };
    }

    const run = await this.findRunOrThrow(organizationId, billingRunId);
    if (run.status !== 'FAILED' && run.status !== 'PARTIAL' && run.status !== 'COMPLETED') {
      throw new ConflictException({
        message: 'Only failed/partial/completed runs can be retried',
        code: 'BILLING_RUN_RETRY_INVALID',
      });
    }

    const result = await this.executeCommit(organizationId, billingRunId, {
      actorUserId,
      membershipId,
      expectedVersion,
      correlationId,
      requireApproved: false,
    });

    await this.transactions.run(async (tx) => {
      await this.idempotency.resolveOrCreate(tx, {
        tenantId: organizationId,
        actorScope,
        operation,
        key: idempotencyKey,
        requestHash,
        responseStatus: 200,
        responseBody: result,
      });
    });

    return { replayed: false, body: result };
  }

  /**
   * Core commit used by API (sync) and worker (idempotent).
   * Skips already-posted lines with the same charge key.
   */
  async executeCommit(
    organizationId: string,
    billingRunId: string,
    options: {
      actorUserId: string | null;
      membershipId?: string;
      expectedVersion?: number;
      correlationId?: string;
      requireApproved: boolean;
      approvalEvidence?: Record<string, unknown>;
      idempotency?: {
        tenantId: string;
        actorScope: ActorScope;
        operation: string;
        key: string;
        requestHash: string;
        responseStatus: number;
      };
    },
  ): Promise<BillingRunResponse> {
    return this.transactions.run(async (tx) => {
      const run = await tx.billingRun.findFirst({
        where: { id: billingRunId, tenantId: organizationId },
      });
      if (run === null) {
        throw new NotFoundException({
          message: 'Billing run not found',
          code: 'BILLING_RUN_NOT_FOUND',
        });
      }

      if (run.status === 'COMPLETED') {
        const response = this.toResponse(run);
        if (options.idempotency !== undefined) {
          await this.idempotency.resolveOrCreate(tx, {
            ...options.idempotency,
            responseBody: response,
          });
        }
        return response;
      }

      if (options.expectedVersion !== undefined && run.version !== options.expectedVersion) {
        throwVersionMismatch('Billing run version mismatch');
      }

      if (
        options.requireApproved &&
        run.status !== 'APPROVED' &&
        run.status !== 'FAILED' &&
        run.status !== 'PARTIAL'
      ) {
        throw new ConflictException({
          message: 'Billing run must be approved before commit (or failed/partial for retry)',
          code: 'BILLING_RUN_NOT_APPROVED',
        });
      }

      if (options.membershipId !== undefined && run.propertyId !== null) {
        await this.authorization.assertPropertyAccess(
          options.membershipId,
          organizationId,
          run.propertyId,
        );
      }

      const lockKey = billingAdvisoryLockKey(organizationId, run.periodKey);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      await this.ensureSchedulesForScope(tx, organizationId, run.propertyId ?? undefined);

      await tx.billingRun.update({
        where: { id: run.id },
        data: { status: 'COMMITTING', version: { increment: 1 } },
      });

      let preview = this.readPreviewPayload(run.previewPayload);
      if (preview === null || preview.lines.length === 0) {
        preview = await this.buildPreview(organizationId, run, 10_000, tx);
        await tx.billingRun.update({
          where: { id: run.id },
          data: {
            previewPayload: preview as unknown as Prisma.InputJsonValue,
            totalsAmount:
              preview.totalsAmount !== null ? new Prisma.Decimal(preview.totalsAmount) : null,
            currency: preview.currency,
          },
        });
      }

      const postedAt = new Date();
      const failures: Array<{ leaseId: string; error: string }> = [];

      for (const line of preview.lines) {
        try {
          await this.upsertAndPostPreviewLine(
            tx,
            organizationId,
            run,
            line,
            postedAt,
            options.actorUserId,
          );
        } catch (error) {
          failures.push({
            leaseId: line.leaseId,
            error: error instanceof Error ? error.message : 'unknown',
          });
        }
      }

      const finalStatus =
        failures.length === 0
          ? 'COMPLETED'
          : failures.length === preview.lines.length
            ? 'FAILED'
            : 'PARTIAL';

      const updated = await tx.billingRun.update({
        where: { id: run.id },
        data: {
          status: finalStatus,
          committedAt: finalStatus === 'FAILED' ? null : postedAt,
          failureSummary:
            failures.length > 0
              ? ({ failures } as unknown as Prisma.InputJsonValue)
              : Prisma.DbNull,
          version: { increment: 1 },
        },
      });

      await this.outbox.appendInTransaction(tx, {
        aggregateType: 'billing_run',
        aggregateId: run.id,
        eventType: BILLING_RUN_COMMIT_EVENT_TYPE,
        payload: {
          tenantId: organizationId,
          billingRunId: run.id,
          approvalEvidence: options.approvalEvidence ?? null,
        },
        correlationId: options.correlationId,
        tenantId: organizationId,
      });

      const response = this.toResponse(updated);
      if (options.idempotency !== undefined) {
        await this.idempotency.resolveOrCreate(tx, {
          ...options.idempotency,
          responseBody: response,
        });
      }
      return response;
    });
  }

  private async upsertAndPostPreviewLine(
    tx: Prisma.TransactionClient,
    organizationId: string,
    run: { id: string; periodKey: string; periodStart: Date; periodEnd: Date },
    line: BillingRunPreviewLine,
    postedAt: Date,
    actorUserId: string | null,
  ): Promise<void> {
    const existingPostedLine = await tx.invoiceLine.findFirst({
      where: {
        tenantId: organizationId,
        chargeKey: line.chargeKey,
        periodKey: run.periodKey,
        invoice: {
          tenantId: organizationId,
          leaseId: line.leaseId,
          status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] },
        },
      },
    });
    if (existingPostedLine !== null) {
      return;
    }

    const lease = await tx.lease.findFirstOrThrow({
      where: { id: line.leaseId, tenantId: organizationId, deletedAt: null },
      include: { parties: true },
    });
    const billTo =
      lease.parties.find((party) => party.isPrimary || party.role === 'PRIMARY_LEASEHOLDER') ??
      lease.parties[0];
    if (billTo === undefined) {
      throw new UnprocessableEntityException({
        message: 'Lease has no bill-to party',
        code: 'BILL_TO_MISSING',
      });
    }

    let invoice = await tx.invoice.findFirst({
      where: {
        tenantId: organizationId,
        leaseId: line.leaseId,
        billingRunId: run.id,
        periodKey: run.periodKey,
        status: 'DRAFT',
      },
      include: { lines: true },
    });

    const amount = roundMoney(new Prisma.Decimal(line.amount));

    if (invoice === null) {
      const invoiceId = randomUUID();
      invoice = await tx.invoice.create({
        data: {
          id: invoiceId,
          tenantId: organizationId,
          leaseId: line.leaseId,
          propertyId: line.propertyId,
          billingRunId: run.id,
          billToPartyId: billTo.partyId,
          status: 'DRAFT',
          currency: line.currency,
          periodKey: run.periodKey,
          subtotalAmount: amount,
          taxAmount: new Prisma.Decimal(0),
          totalAmount: amount,
          balanceAmount: amount,
          lines: {
            create: {
              id: randomUUID(),
              tenantId: organizationId,
              lineNumber: 1,
              description: line.description,
              chargeKey: line.chargeKey,
              periodKey: run.periodKey,
              quantity: new Prisma.Decimal(1),
              unitPrice: amount,
              taxAmount: new Prisma.Decimal(0),
              lineTotal: amount,
              currency: line.currency,
              servicePeriodStart: run.periodStart,
              servicePeriodEnd: run.periodEnd,
              sourceType: 'BILLING_RUN',
              sourceId: run.id,
            },
          },
        },
        include: { lines: true },
      });
    } else {
      const existingLine = invoice.lines.find((item) => item.chargeKey === line.chargeKey);
      if (existingLine === undefined) {
        const nextLine =
          (invoice.lines.reduce((max, item) => Math.max(max, item.lineNumber), 0) || 0) + 1;
        await tx.invoiceLine.create({
          data: {
            id: randomUUID(),
            tenantId: organizationId,
            invoiceId: invoice.id,
            lineNumber: nextLine,
            description: line.description,
            chargeKey: line.chargeKey,
            periodKey: run.periodKey,
            quantity: new Prisma.Decimal(1),
            unitPrice: amount,
            taxAmount: new Prisma.Decimal(0),
            lineTotal: amount,
            currency: line.currency,
            servicePeriodStart: run.periodStart,
            servicePeriodEnd: run.periodEnd,
            sourceType: 'BILLING_RUN',
            sourceId: run.id,
          },
        });
        const refreshedLines = await tx.invoiceLine.findMany({
          where: { invoiceId: invoice.id, tenantId: organizationId },
        });
        let subtotal = new Prisma.Decimal(0);
        for (const item of refreshedLines) {
          subtotal = subtotal.plus(item.lineTotal);
        }
        subtotal = roundMoney(subtotal);
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            subtotalAmount: subtotal,
            totalAmount: subtotal,
            balanceAmount: subtotal,
          },
        });
      }
    }

    await this.invoices.postDraftInvoiceInTransaction(
      tx,
      organizationId,
      invoice.id,
      actorUserId,
      postedAt,
    );
  }

  private async buildPreview(
    organizationId: string,
    run: {
      id: string;
      periodKey: string;
      propertyId: string | null;
      timeZone: string;
      currency: string | null;
    },
    sampleLimit: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<PreviewPayload> {
    const leases = await tx.lease.findMany({
      where: {
        tenantId: organizationId,
        deletedAt: null,
        status: { in: ['ACTIVE', 'NOTICE'] },
        ...(run.propertyId !== null ? { propertyId: run.propertyId } : {}),
        OR: [{ occupancyState: 'OCCUPIED' }, { billingSchedules: { some: { status: 'ACTIVE' } } }],
      },
      include: {
        terms: { where: { isCurrent: true } },
        parties: true,
        billingSchedules: {
          where: { status: 'ACTIVE' },
          include: { chargeRules: { where: { active: true, ruleType: 'RENT' } } },
        },
      },
    });

    const lines: BillingRunPreviewLine[] = [];
    let totals = new Prisma.Decimal(0);
    let currency: string | null = run.currency;

    for (const lease of leases) {
      const term = lease.terms[0];
      if (term === undefined) {
        continue;
      }
      const amount = roundMoney(term.rentAmount);
      const chargeKey = rentChargeKey(lease.id, run.periodKey);
      if (currency === null) {
        currency = term.currency;
      } else if (currency !== term.currency) {
        throw new UnprocessableEntityException({
          message: 'Billing run contains mixed currencies',
          code: 'CURRENCY_MISMATCH',
        });
      }
      totals = totals.plus(amount);
      lines.push({
        leaseId: lease.id,
        leaseNumber: lease.leaseNumber,
        propertyId: lease.propertyId,
        currency: term.currency,
        amount: decimalToString(amount),
        chargeKey,
        description: `Rent ${run.periodKey}`,
      });
    }

    const priorKey = priorPeriodKey(run.periodKey);
    const priorPosted = await tx.invoice.aggregate({
      where: {
        tenantId: organizationId,
        periodKey: priorKey,
        status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] },
        ...(run.propertyId !== null ? { propertyId: run.propertyId } : {}),
        ...(currency !== null ? { currency } : {}),
      },
      _sum: { totalAmount: true },
    });

    const priorTotal = priorPosted._sum.totalAmount;

    return {
      generatedAt: new Date().toISOString(),
      currency,
      totalsAmount: lines.length > 0 ? decimalToString(roundMoney(totals)) : null,
      priorPeriodTotalsAmount: priorTotal !== null ? decimalToString(roundMoney(priorTotal)) : null,
      lineCount: lines.length,
      lines: lines.slice(0, Math.max(sampleLimit, lines.length)),
    };
  }

  private async ensureSchedulesForScope(
    tx: Prisma.TransactionClient,
    organizationId: string,
    propertyId?: string,
  ): Promise<void> {
    const leases = await tx.lease.findMany({
      where: {
        tenantId: organizationId,
        deletedAt: null,
        status: { in: ['ACTIVE', 'NOTICE'] },
        ...(propertyId !== undefined ? { propertyId } : {}),
      },
      include: { terms: { where: { isCurrent: true } }, parties: true },
    });
    for (const lease of leases) {
      await this.deposits.ensureBillingScheduleForLease(tx, organizationId, lease);
    }
  }

  private readPreviewPayload(value: Prisma.JsonValue | null): PreviewPayload | null {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const record = value as Record<string, unknown>;
    if (!Array.isArray(record.lines)) {
      return null;
    }
    return {
      generatedAt:
        typeof record.generatedAt === 'string' ? record.generatedAt : new Date().toISOString(),
      currency: typeof record.currency === 'string' ? record.currency : null,
      totalsAmount: typeof record.totalsAmount === 'string' ? record.totalsAmount : null,
      priorPeriodTotalsAmount:
        typeof record.priorPeriodTotalsAmount === 'string' ? record.priorPeriodTotalsAmount : null,
      lineCount: typeof record.lineCount === 'number' ? record.lineCount : record.lines.length,
      lines: record.lines as BillingRunPreviewLine[],
    };
  }

  private async findRunOrThrow(organizationId: string, billingRunId: string) {
    const run = await this.prisma.billingRun.findFirst({
      where: { id: billingRunId, tenantId: organizationId },
    });
    if (run === null) {
      throw new NotFoundException({
        message: 'Billing run not found',
        code: 'BILLING_RUN_NOT_FOUND',
      });
    }
    return run;
  }

  toResponse(row: {
    id: string;
    tenantId: string;
    scheduleId: string | null;
    propertyId: string | null;
    periodKey: string;
    status: BillingRunResponse['status'];
    timeZone: string;
    periodStart: Date;
    periodEnd: Date;
    currency: string | null;
    totalsAmount: Prisma.Decimal | null;
    scheduledJobId: string | null;
    approvedAt: Date | null;
    committedAt: Date | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    previewPayload?: Prisma.JsonValue | null;
  }): BillingRunResponse {
    const preview =
      row.previewPayload !== undefined ? this.readPreviewPayload(row.previewPayload ?? null) : null;
    const requestStart =
      preview !== null &&
      row.previewPayload !== null &&
      typeof row.previewPayload === 'object' &&
      !Array.isArray(row.previewPayload) &&
      typeof (row.previewPayload as Record<string, unknown>).requestPeriodStart === 'string'
        ? String((row.previewPayload as Record<string, unknown>).requestPeriodStart)
        : formatDateOnly(row.periodStart);
    const requestEnd =
      row.previewPayload !== null &&
      typeof row.previewPayload === 'object' &&
      !Array.isArray(row.previewPayload) &&
      typeof (row.previewPayload as Record<string, unknown>).requestPeriodEnd === 'string'
        ? String((row.previewPayload as Record<string, unknown>).requestPeriodEnd)
        : formatDateOnly(row.periodEnd);

    return {
      id: row.id,
      organizationId: row.tenantId,
      scheduleId: row.scheduleId,
      propertyId: row.propertyId,
      periodKey: row.periodKey,
      status: row.status,
      timeZone: row.timeZone,
      periodStart: requestStart,
      periodEnd: requestEnd,
      currency: row.currency,
      totalsAmount: row.totalsAmount !== null ? decimalToString(row.totalsAmount) : null,
      scheduledJobId: row.scheduledJobId,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      committedAt: row.committedAt?.toISOString() ?? null,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
