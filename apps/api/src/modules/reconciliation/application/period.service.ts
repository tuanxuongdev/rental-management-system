import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type Prisma } from '@prisma/client';

import {
  ACCOUNTING_PERIOD_CLOSED_EVENT_TYPE,
  type AccountingPeriodResponse,
  type AccountingPeriodsCollection,
  type CloseAccountingPeriodRequest,
  type ReopenAccountingPeriodRequest,
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
} from '@rpm/contracts';

import { OutboxService } from '../../../infrastructure/outbox/outbox.service';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';
import { assertPeriodKey } from '../../billing/domain/billing.rules';
import { AuthorizationService } from '../../tenancy/application/authorization.service';
import { computePeriodKeyFromDate } from '../domain/reconciliation.rules';

@Injectable()
export class PeriodService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
  ) {}

  async listPeriods(
    organizationId: string,
    membershipId: string,
    options?: { limit?: number; after?: string },
  ): Promise<AccountingPeriodsCollection> {
    await this.authorization.assertAnyPermission(membershipId, organizationId, [
      'finance.period.close',
      'finance.reconciliation.view',
      'finance.reports.view',
    ]);
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);
    const rows = await this.prisma.accountingPeriod.findMany({
      where: { tenantId: organizationId },
      orderBy: [{ periodKey: 'desc' }],
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

  async ensureOpenPeriod(
    organizationId: string,
    periodKey: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<AccountingPeriodResponse> {
    assertPeriodKey(periodKey);
    const existing = await tx.accountingPeriod.findUnique({
      where: { tenantId_periodKey: { tenantId: organizationId, periodKey } },
    });
    if (existing !== null) {
      return this.toResponse(existing);
    }
    const created = await tx.accountingPeriod.create({
      data: {
        id: randomUUID(),
        tenantId: organizationId,
        periodKey,
        status: 'OPEN',
      },
    });
    return this.toResponse(created);
  }

  /**
   * Rejects money posts into a CLOSED accounting period (T12-08).
   */
  async assertPeriodOpen(
    tenantId: string,
    accountingDate: Date,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const periodKey = computePeriodKeyFromDate(accountingDate);
    const period = await tx.accountingPeriod.findUnique({
      where: { tenantId_periodKey: { tenantId, periodKey } },
    });
    if (period !== null && period.status === 'CLOSED') {
      throw new UnprocessableEntityException({
        message: `Accounting period ${periodKey} is closed`,
        code: 'PERIOD_CLOSED',
      });
    }
  }

  async closePeriod(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    periodKey: string,
    body: CloseAccountingPeriodRequest,
    correlationId?: string,
  ): Promise<AccountingPeriodResponse> {
    await this.authorization.assertPermission(membershipId, organizationId, 'finance.period.close');
    assertPeriodKey(periodKey);

    const result = await this.transactions.run(async (tx) => {
      await this.ensureOpenPeriod(organizationId, periodKey, tx);
      const period = await tx.accountingPeriod.findUniqueOrThrow({
        where: { tenantId_periodKey: { tenantId: organizationId, periodKey } },
      });
      if (period.status === 'CLOSED') {
        throw new ConflictException({
          message: 'Period already closed',
          code: 'PERIOD_ALREADY_CLOSED',
        });
      }
      const updated = await tx.accountingPeriod.update({
        where: { id: period.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedByUserId: actorUserId,
          version: { increment: 1 },
        },
      });
      await this.outbox.appendInTransaction(tx, {
        aggregateType: 'accounting_period',
        aggregateId: updated.id,
        eventType: ACCOUNTING_PERIOD_CLOSED_EVENT_TYPE,
        payload: {
          tenantId: organizationId,
          periodKey,
          closedByUserId: actorUserId,
          reason: body.reason ?? null,
        },
        correlationId,
        tenantId: organizationId,
      });
      return this.toResponse(updated);
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'accounting_period.close',
      outcome: 'SUCCESS',
      targetType: 'accounting_period',
      targetId: result.id,
      correlationId,
    });
    return result;
  }

  async reopenPeriod(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    periodKey: string,
    body: ReopenAccountingPeriodRequest,
    correlationId?: string,
  ): Promise<AccountingPeriodResponse> {
    await this.authorization.assertPermission(membershipId, organizationId, 'finance.period.close');
    // Owner-only reopen: ownership transfer key as proxy for Owner role presence.
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'organization.ownership.transfer',
    );
    assertPeriodKey(periodKey);

    const result = await this.transactions.run(async (tx) => {
      const period = await tx.accountingPeriod.findUnique({
        where: { tenantId_periodKey: { tenantId: organizationId, periodKey } },
      });
      if (period === null) {
        throw new ConflictException({
          message: 'Period not found',
          code: 'PERIOD_NOT_FOUND',
        });
      }
      if (period.status !== 'CLOSED') {
        throw new ConflictException({
          message: 'Period is not closed',
          code: 'PERIOD_NOT_CLOSED',
        });
      }
      const updated = await tx.accountingPeriod.update({
        where: { id: period.id },
        data: {
          status: 'OPEN',
          closedAt: null,
          closedByUserId: null,
          reopenReason: body.reason,
          version: { increment: 1 },
        },
      });
      return this.toResponse(updated);
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'accounting_period.reopen',
      outcome: 'SUCCESS',
      targetType: 'accounting_period',
      targetId: result.id,
      correlationId,
    });
    return result;
  }

  private toResponse(row: {
    id: string;
    tenantId: string;
    periodKey: string;
    status: AccountingPeriodResponse['status'];
    closedAt: Date | null;
    closedByUserId: string | null;
    reopenReason: string | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): AccountingPeriodResponse {
    return {
      id: row.id,
      organizationId: row.tenantId,
      periodKey: row.periodKey,
      status: row.status,
      closedAt: row.closedAt?.toISOString() ?? null,
      closedByUserId: row.closedByUserId,
      reopenReason: row.reopenReason,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
