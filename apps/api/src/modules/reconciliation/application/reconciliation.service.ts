import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  DEFAULT_RECONCILIATION_TOLERANCE,
  RECONCILIATION_RUN_COMPLETED_EVENT_TYPE,
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  type CompleteReconciliationRunRequest,
  type CreateReconciliationRunRequest,
  type IngestSettlementsRequest,
  type ReconciliationItemResponse,
  type ReconciliationItemsCollection,
  type ReconciliationRunResponse,
  type ReconciliationRunsCollection,
  type ResolveReconciliationItemRequest,
} from '@rpm/contracts';

import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service';
import { actorScopeFromOrganization } from '../../../infrastructure/persistence/organization-context';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';
import {
  decimalToString,
  formatDateOnly,
  parseDateOnly,
  roundMoney,
} from '../../billing/domain/billing.rules';
import { AuthorizationService } from '../../tenancy/application/authorization.service';
import {
  amountsMatch,
  assertActorsDistinct,
  assertVarianceWithinTolerance,
  DEFAULT_RECONCILIATION_TOLERANCE as DOMAIN_TOLERANCE,
} from '../domain/reconciliation.rules';

@Injectable()
export class ReconciliationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  async createRun(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    body: CreateReconciliationRunRequest,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: ReconciliationRunResponse }> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.reconciliation.perform',
    );

    const operation = `POST /v1/organizations/${organizationId}/reconciliation-runs`;
    const actorScope = actorScopeFromOrganization(organizationId);
    const existing = await this.idempotency.findExisting(
      organizationId,
      actorScope,
      operation,
      idempotencyKey,
    );
    if (existing !== null && existing.requestHash === requestHash) {
      return { replayed: true, body: existing.responseBody as ReconciliationRunResponse };
    }

    const periodStart = parseDateOnly(body.periodStart);
    const periodEnd = parseDateOnly(body.periodEnd);
    const tolerance = roundMoney(
      new Prisma.Decimal(body.toleranceAmount ?? DEFAULT_RECONCILIATION_TOLERANCE),
    );

    const result = await this.transactions.run(async (tx) => {
      const begin = await this.idempotency.begin(tx, {
        tenantId: organizationId,
        actorScope,
        operation,
        key: idempotencyKey,
        requestHash,
      });
      if (begin.replayed) {
        return { replayed: true as const, body: begin.body as ReconciliationRunResponse };
      }

      const runId = randomUUID();
      await tx.reconciliationRun.create({
        data: {
          id: runId,
          tenantId: organizationId,
          sourceType: body.sourceType,
          periodStart,
          periodEnd,
          currency: body.currency,
          status: 'DRAFT',
          provider: body.provider ?? null,
          documentId: body.documentId ?? null,
          controlTotal:
            body.controlTotal !== undefined
              ? roundMoney(new Prisma.Decimal(body.controlTotal))
              : null,
          toleranceAmount: tolerance,
          preparedByUserId: actorUserId,
        },
      });

      const created = await tx.reconciliationRun.findFirstOrThrow({
        where: { id: runId, tenantId: organizationId },
      });
      const responseBody = this.toRunResponse(created);
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
        action: 'reconciliation.run.create',
        outcome: 'SUCCESS',
        targetType: 'reconciliation_run',
        targetId: result.body.id,
        correlationId,
      });
    }
    return result;
  }

  async listRuns(
    organizationId: string,
    membershipId: string,
    options?: { limit?: number; after?: string; status?: string },
  ): Promise<ReconciliationRunsCollection> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.reconciliation.view',
    );
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);
    const rows = await this.prisma.reconciliationRun.findMany({
      where: {
        tenantId: organizationId,
        ...(options?.status !== undefined
          ? { status: options.status as ReconciliationRunResponse['status'] }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(options?.after !== undefined ? { cursor: { id: options.after }, skip: 1 } : {}),
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      data: page.map((row) => this.toRunResponse(row)),
      page: {
        nextCursor: rows.length > limit && last !== undefined ? last.id : null,
        previousCursor: null,
        limit,
      },
      meta: {},
    };
  }

  async getRun(
    organizationId: string,
    membershipId: string,
    runId: string,
  ): Promise<ReconciliationRunResponse> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.reconciliation.view',
    );
    const run = await this.prisma.reconciliationRun.findFirst({
      where: { id: runId, tenantId: organizationId },
    });
    if (run === null) {
      throw new NotFoundException({
        message: 'Reconciliation run not found',
        code: 'RECONCILIATION_RUN_NOT_FOUND',
      });
    }
    return this.toRunResponse(run);
  }

  async listItems(
    organizationId: string,
    membershipId: string,
    runId: string,
    options?: { limit?: number; after?: string; status?: string },
  ): Promise<ReconciliationItemsCollection> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.reconciliation.view',
    );
    const run = await this.prisma.reconciliationRun.findFirst({
      where: { id: runId, tenantId: organizationId },
      select: { id: true },
    });
    if (run === null) {
      throw new NotFoundException({
        message: 'Reconciliation run not found',
        code: 'RECONCILIATION_RUN_NOT_FOUND',
      });
    }
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);
    const rows = await this.prisma.reconciliationItem.findMany({
      where: {
        tenantId: organizationId,
        runId,
        ...(options?.status !== undefined
          ? { status: options.status as ReconciliationItemResponse['status'] }
          : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(options?.after !== undefined ? { cursor: { id: options.after }, skip: 1 } : {}),
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      data: page.map((row) => this.toItemResponse(row)),
      page: {
        nextCursor: rows.length > limit && last !== undefined ? last.id : null,
        previousCursor: null,
        limit,
      },
      meta: {},
    };
  }

  async ingestSettlements(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    runId: string,
    body: IngestSettlementsRequest,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: ReconciliationRunResponse }> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.reconciliation.perform',
    );

    const operation = `POST /v1/organizations/${organizationId}/reconciliation-runs/${runId}/ingest-settlements`;
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
        return { replayed: true as const, body: begin.body as ReconciliationRunResponse };
      }

      const run = await tx.reconciliationRun.findFirst({
        where: { id: runId, tenantId: organizationId },
      });
      if (run === null) {
        throw new NotFoundException({
          message: 'Reconciliation run not found',
          code: 'RECONCILIATION_RUN_NOT_FOUND',
        });
      }
      if (run.status === 'COMPLETED' || run.status === 'CANCELLED') {
        throw new ConflictException({
          message: 'Run is finalized',
          code: 'RECONCILIATION_RUN_FINALIZED',
        });
      }

      for (const line of body.lines) {
        if (line.currency !== run.currency) {
          throw new ConflictException({
            message: 'Settlement currency mismatch',
            code: 'CURRENCY_MISMATCH',
          });
        }
        const amount = roundMoney(new Prisma.Decimal(line.amount));
        const externalDate = parseDateOnly(line.transactionDate);
        const payment = await tx.paymentTransaction.findFirst({
          where: {
            tenantId: organizationId,
            externalReference: line.externalReference,
            currency: line.currency,
            status: 'SETTLED',
            accountingAt: { gte: run.periodStart, lte: run.periodEnd },
          },
        });

        let status: ReconciliationItemResponse['status'] = 'UNMATCHED';
        let paymentTransactionId: string | null = null;
        if (payment !== null && amountsMatch(payment.amount, amount, run.toleranceAmount)) {
          status = 'SUGGESTED';
          paymentTransactionId = payment.id;
        }

        await tx.reconciliationItem.create({
          data: {
            id: randomUUID(),
            tenantId: organizationId,
            runId: run.id,
            status,
            externalReference: line.externalReference,
            externalAmount: amount,
            externalDate,
            paymentTransactionId,
          },
        });
      }

      await this.recomputeRunTotals(tx, organizationId, run.id);
      await tx.reconciliationRun.update({
        where: { id: run.id },
        data: { status: 'IN_PROGRESS', version: { increment: 1 } },
      });

      const refreshed = await tx.reconciliationRun.findFirstOrThrow({
        where: { id: run.id, tenantId: organizationId },
      });
      const responseBody = this.toRunResponse(refreshed);
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
        action: 'reconciliation.run.ingest',
        outcome: 'SUCCESS',
        targetType: 'reconciliation_run',
        targetId: runId,
        correlationId,
      });
    }
    return result;
  }

  async resolveItem(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    itemId: string,
    body: ResolveReconciliationItemRequest,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: ReconciliationItemResponse }> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.reconciliation.perform',
    );

    const operation = `POST /v1/organizations/${organizationId}/reconciliation-items/${itemId}/resolve`;
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
        return { replayed: true as const, body: begin.body as ReconciliationItemResponse };
      }

      const item = await tx.reconciliationItem.findFirst({
        where: { id: itemId, tenantId: organizationId },
        include: { run: true },
      });
      if (item === null) {
        throw new NotFoundException({
          message: 'Reconciliation item not found',
          code: 'RECONCILIATION_ITEM_NOT_FOUND',
        });
      }
      if (
        item.status === 'MATCHED' ||
        item.status === 'RESOLVED' ||
        item.status === 'EXCEPTION_ACCEPTED'
      ) {
        throw new ConflictException({
          message: 'Item already finalized',
          code: 'RECONCILIATION_ITEM_FINALIZED',
        });
      }

      let nextStatus: ReconciliationItemResponse['status'];
      let paymentTransactionId = body.paymentTransactionId ?? item.paymentTransactionId;
      switch (body.resolution) {
        case 'MATCH':
          nextStatus = 'MATCHED';
          break;
        case 'UNMATCH':
          nextStatus = 'UNMATCHED';
          paymentTransactionId = null;
          break;
        case 'EXCEPTION_ACCEPTED':
          nextStatus = 'EXCEPTION_ACCEPTED';
          break;
        case 'ADJUSTMENT_REQUIRED':
          nextStatus = 'DISPUTED';
          break;
      }

      if (nextStatus === 'MATCHED' && paymentTransactionId !== null) {
        await tx.paymentTransaction.updateMany({
          where: { id: paymentTransactionId, tenantId: organizationId },
          data: { reconciliationStatus: 'MATCHED' },
        });
      }
      if (nextStatus === 'EXCEPTION_ACCEPTED' && paymentTransactionId !== null) {
        await tx.paymentTransaction.updateMany({
          where: { id: paymentTransactionId, tenantId: organizationId },
          data: { reconciliationStatus: 'EXCEPTION' },
        });
      }

      await tx.reconciliationItem.update({
        where: { id: item.id },
        data: {
          status: nextStatus,
          paymentTransactionId,
          resolutionCode: body.resolutionCode ?? body.resolution,
          resolutionReason: body.reason,
          assignedToUserId: actorUserId,
          version: { increment: 1 },
        },
      });

      await this.recomputeRunTotals(tx, organizationId, item.runId);

      const refreshed = await tx.reconciliationItem.findFirstOrThrow({
        where: { id: item.id, tenantId: organizationId },
      });
      const responseBody = this.toItemResponse(refreshed);
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
        action: 'reconciliation.item.resolve',
        outcome: 'SUCCESS',
        targetType: 'reconciliation_item',
        targetId: itemId,
        correlationId,
      });
    }
    return result;
  }

  async completeRun(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    runId: string,
    body: CompleteReconciliationRunRequest,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: ReconciliationRunResponse }> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.reconciliation.perform',
    );

    const permissionKeys = await this.authorization.getEffectivePermissionKeys(membershipId);
    const hasApprove = permissionKeys.includes('finance.reconciliation.approve');
    if (!permissionKeys.includes('finance.reconciliation.perform')) {
      await this.authorization.assertPermission(
        membershipId,
        organizationId,
        'finance.reconciliation.perform',
      );
    }

    const operation = `POST /v1/organizations/${organizationId}/reconciliation-runs/${runId}/complete`;
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
        return { replayed: true as const, body: begin.body as ReconciliationRunResponse };
      }

      const run = await tx.reconciliationRun.findFirst({
        where: { id: runId, tenantId: organizationId },
      });
      if (run === null) {
        throw new NotFoundException({
          message: 'Reconciliation run not found',
          code: 'RECONCILIATION_RUN_NOT_FOUND',
        });
      }
      if (run.status === 'COMPLETED') {
        return { replayed: false as const, body: this.toRunResponse(run) };
      }

      await this.recomputeRunTotals(tx, organizationId, run.id);
      const refreshedTotals = await tx.reconciliationRun.findFirstOrThrow({
        where: { id: run.id, tenantId: organizationId },
      });

      const variance = roundMoney(refreshedTotals.varianceAmount);
      const needsOverride = variance.abs().gt(roundMoney(refreshedTotals.toleranceAmount));
      if (needsOverride) {
        if (!hasApprove) {
          throw new ForbiddenException({
            message: 'Approve permission required to force-complete over tolerance',
            code: 'RECONCILIATION_APPROVE_REQUIRED',
          });
        }
        assertActorsDistinct([
          { role: 'preparer', userId: run.preparedByUserId },
          { role: 'approver', userId: actorUserId },
        ]);
      }

      assertVarianceWithinTolerance({
        varianceAmount: variance,
        toleranceAmount: refreshedTotals.toleranceAmount,
        overrideReason: body.overrideReason,
        hasApprovePermission: hasApprove,
      });

      const updated = await tx.reconciliationRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          approvedByUserId: needsOverride || hasApprove ? actorUserId : run.approvedByUserId,
          overrideReason: body.overrideReason ?? null,
          version: { increment: 1 },
        },
      });

      await this.outbox.appendInTransaction(tx, {
        aggregateType: 'reconciliation_run',
        aggregateId: updated.id,
        eventType: RECONCILIATION_RUN_COMPLETED_EVENT_TYPE,
        payload: {
          tenantId: organizationId,
          runId: updated.id,
          varianceAmount: decimalToString(updated.varianceAmount),
        },
        correlationId,
        tenantId: organizationId,
      });

      const responseBody = this.toRunResponse(updated);
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
        action: 'reconciliation.run.complete',
        outcome: 'SUCCESS',
        targetType: 'reconciliation_run',
        targetId: runId,
        correlationId,
      });
    }
    return result;
  }

  private async recomputeRunTotals(
    tx: Prisma.TransactionClient,
    tenantId: string,
    runId: string,
  ): Promise<void> {
    const items = await tx.reconciliationItem.findMany({
      where: { tenantId, runId },
    });
    let matched = new Prisma.Decimal(0);
    let unmatched = new Prisma.Decimal(0);
    for (const item of items) {
      const amt = item.externalAmount ?? new Prisma.Decimal(0);
      if (item.status === 'MATCHED' || item.status === 'SUGGESTED') {
        matched = matched.plus(amt);
      } else if (
        item.status === 'UNMATCHED' ||
        item.status === 'DISPUTED' ||
        item.status === 'EXCEPTION_ACCEPTED'
      ) {
        unmatched = unmatched.plus(amt);
      }
    }
    const run = await tx.reconciliationRun.findFirstOrThrow({
      where: { id: runId, tenantId },
    });
    const control = run.controlTotal ?? matched.plus(unmatched);
    const variance = roundMoney(control.minus(matched));
    await tx.reconciliationRun.update({
      where: { id: runId },
      data: {
        matchedTotal: roundMoney(matched),
        unmatchedTotal: roundMoney(unmatched),
        varianceAmount: variance,
      },
    });
  }

  private toRunResponse(row: {
    id: string;
    tenantId: string;
    sourceType: ReconciliationRunResponse['sourceType'];
    periodStart: Date;
    periodEnd: Date;
    currency: string;
    status: ReconciliationRunResponse['status'];
    provider: string | null;
    documentId: string | null;
    controlTotal: Prisma.Decimal | null;
    matchedTotal: Prisma.Decimal;
    unmatchedTotal: Prisma.Decimal;
    varianceAmount: Prisma.Decimal;
    toleranceAmount: Prisma.Decimal;
    overrideReason: string | null;
    preparedByUserId: string;
    approvedByUserId: string | null;
    completedAt: Date | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): ReconciliationRunResponse {
    return {
      id: row.id,
      organizationId: row.tenantId,
      sourceType: row.sourceType,
      periodStart: formatDateOnly(row.periodStart),
      periodEnd: formatDateOnly(row.periodEnd),
      currency: row.currency,
      status: row.status,
      provider: row.provider,
      documentId: row.documentId,
      controlTotal: row.controlTotal !== null ? decimalToString(row.controlTotal) : null,
      matchedTotal: decimalToString(row.matchedTotal),
      unmatchedTotal: decimalToString(row.unmatchedTotal),
      varianceAmount: decimalToString(row.varianceAmount),
      toleranceAmount: decimalToString(row.toleranceAmount ?? DOMAIN_TOLERANCE),
      overrideReason: row.overrideReason,
      preparedByUserId: row.preparedByUserId,
      approvedByUserId: row.approvedByUserId,
      completedAt: row.completedAt?.toISOString() ?? null,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toItemResponse(row: {
    id: string;
    tenantId: string;
    runId: string;
    status: ReconciliationItemResponse['status'];
    externalReference: string | null;
    externalAmount: Prisma.Decimal | null;
    externalDate: Date | null;
    paymentTransactionId: string | null;
    resolutionCode: string | null;
    resolutionReason: string | null;
    assignedToUserId: string | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): ReconciliationItemResponse {
    return {
      id: row.id,
      organizationId: row.tenantId,
      runId: row.runId,
      status: row.status,
      externalReference: row.externalReference,
      externalAmount: row.externalAmount !== null ? decimalToString(row.externalAmount) : null,
      externalDate: row.externalDate !== null ? formatDateOnly(row.externalDate) : null,
      paymentTransactionId: row.paymentTransactionId,
      resolutionCode: row.resolutionCode,
      resolutionReason: row.resolutionReason,
      assignedToUserId: row.assignedToUserId,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
