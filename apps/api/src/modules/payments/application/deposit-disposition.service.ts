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
  DEPOSIT_DISPOSITION_EXECUTED_EVENT_TYPE,
  type CreateDepositDispositionRequest,
  type DepositDispositionResponse,
  type DepositDispositionsBatchResponse,
  type DispositionDecisionRequest,
  type ExecuteDepositDispositionRequest,
} from '@rpm/contracts';

import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service';
import { actorScopeFromOrganization } from '../../../infrastructure/persistence/organization-context';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { AuditService } from '../../audit/audit.service';
import { LedgerService } from '../../billing/application/ledger.service';
import { decimalToString, roundMoney } from '../../billing/domain/billing.rules';
import { PeriodService } from '../../reconciliation/application/period.service';
import { assertActorsDistinct } from '../../reconciliation/domain/reconciliation.rules';
import { AuthorizationService } from '../../tenancy/application/authorization.service';
import {
  assertCurrencyMatch,
  assertPositiveMoney,
  sumAllocationAmounts,
} from '../domain/payment.rules';

@Injectable()
export class DepositDispositionService {
  constructor(
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(LedgerService) private readonly ledger: LedgerService,
    @Inject(PeriodService) private readonly periods: PeriodService,
  ) {}

  async createDispositions(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    depositId: string,
    body: CreateDepositDispositionRequest,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: DepositDispositionsBatchResponse }> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.deposits.disposition',
    );

    const operation = `POST /v1/organizations/${organizationId}/deposits/${depositId}/dispositions`;
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
          body: begin.body as DepositDispositionsBatchResponse,
        };
      }

      await tx.$queryRaw`SELECT id FROM security_deposits WHERE id = ${depositId}::uuid AND tenant_id = ${organizationId}::uuid FOR UPDATE`;

      const deposit = await tx.securityDeposit.findFirst({
        where: { id: depositId, tenantId: organizationId },
        include: {
          lease: { select: { propertyId: true, deletedAt: true } },
          dispositionLines: {
            where: { status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] } },
            select: { amount: true },
          },
        },
      });
      if (deposit === null || deposit.lease.deletedAt !== null) {
        throw new NotFoundException({ message: 'Deposit not found', code: 'DEPOSIT_NOT_FOUND' });
      }
      await this.authorization.assertPropertyAccess(
        membershipId,
        organizationId,
        deposit.lease.propertyId,
      );

      const reserved = deposit.dispositionLines.reduce(
        (acc, line) => acc.plus(line.amount),
        new Prisma.Decimal(0),
      );
      const available = roundMoney(deposit.amountHeld.minus(reserved));
      const total = sumAllocationAmounts(body.lines.map((line) => ({ amount: line.amount })));
      if (total.gt(available)) {
        throw new UnprocessableEntityException({
          message: 'Disposition exceeds available held deposit amount',
          code: 'DEPOSIT_INSUFFICIENT',
        });
      }

      const effectiveAt = new Date(body.effectiveAt);
      const lines: DepositDispositionResponse[] = [];

      for (const line of body.lines) {
        const amount = roundMoney(new Prisma.Decimal(line.amount));
        assertPositiveMoney(amount);
        assertCurrencyMatch(deposit.currency, deposit.currency);
        const id = randomUUID();
        await tx.securityDepositDispositionLine.create({
          data: {
            id,
            tenantId: organizationId,
            depositId: deposit.id,
            dispositionType: line.dispositionType,
            amount,
            currency: deposit.currency,
            reason: line.reason,
            status: 'PENDING_APPROVAL',
            effectiveAt,
            requestedByUserId: actorUserId,
          },
        });
        const created = await tx.securityDepositDispositionLine.findFirstOrThrow({
          where: { id },
        });
        lines.push(this.toResponse(created));
      }

      const responseBody = { depositId: deposit.id, lines };
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
        action: 'deposit.disposition.create',
        outcome: 'SUCCESS',
        targetType: 'security_deposit',
        targetId: depositId,
        correlationId,
      });
    }

    return result;
  }

  async approveDisposition(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    dispositionId: string,
    body: DispositionDecisionRequest,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: DepositDispositionResponse }> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.deposits.disposition.approve',
    );

    const operation = `POST /v1/organizations/${organizationId}/deposit-dispositions/${dispositionId}/approve`;
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
          body: begin.body as DepositDispositionResponse,
        };
      }

      const line = await tx.securityDepositDispositionLine.findFirst({
        where: { id: dispositionId, tenantId: organizationId },
      });
      if (line === null) {
        throw new NotFoundException({
          message: 'Disposition not found',
          code: 'DISPOSITION_NOT_FOUND',
        });
      }
      if (line.status !== 'PENDING_APPROVAL') {
        throw new ConflictException({
          message: 'Disposition is not pending approval',
          code: 'DISPOSITION_NOT_PENDING',
        });
      }
      assertActorsDistinct([
        { role: 'requester', userId: line.requestedByUserId },
        { role: 'approver', userId: actorUserId },
      ]);

      const nextStatus = body.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const updated = await tx.securityDepositDispositionLine.update({
        where: { id: line.id },
        data: {
          status: nextStatus,
          approvedByUserId: actorUserId,
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
        action: 'deposit.disposition.approve',
        outcome: 'SUCCESS',
        targetType: 'security_deposit_disposition',
        targetId: dispositionId,
        correlationId,
        changeSummary: { decision: body.decision, reason: body.reason },
      });
    }
    return result;
  }

  async executeDisposition(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    dispositionId: string,
    body: ExecuteDepositDispositionRequest,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: DepositDispositionResponse }> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.deposits.disposition.execute',
    );

    const operation = `POST /v1/organizations/${organizationId}/dispositions/${dispositionId}/execute`;
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
          body: begin.body as DepositDispositionResponse,
        };
      }

      await tx.$queryRaw`SELECT id FROM security_deposit_disposition_lines WHERE id = ${dispositionId}::uuid AND tenant_id = ${organizationId}::uuid FOR UPDATE`;

      const line = await tx.securityDepositDispositionLine.findFirst({
        where: { id: dispositionId, tenantId: organizationId },
      });
      if (line === null) {
        throw new NotFoundException({
          message: 'Disposition not found',
          code: 'DISPOSITION_NOT_FOUND',
        });
      }
      if (line.status === 'EXECUTED') {
        const responseBody = this.toResponse(line);
        await this.idempotency.complete(tx, {
          tenantId: organizationId,
          actorScope,
          operation,
          key: idempotencyKey,
          responseStatus: 200,
          responseBody,
        });
        return { replayed: true as const, body: responseBody };
      }
      if (line.status !== 'APPROVED') {
        throw new ConflictException({
          message: 'Disposition is not executable',
          code: 'DISPOSITION_NOT_APPROVED',
        });
      }
      assertActorsDistinct([
        { role: 'requester', userId: line.requestedByUserId },
        { role: 'approver', userId: line.approvedByUserId },
        { role: 'executor', userId: actorUserId },
      ]);

      await tx.$queryRaw`SELECT id FROM security_deposits WHERE id = ${line.depositId}::uuid AND tenant_id = ${organizationId}::uuid FOR UPDATE`;
      const deposit = await tx.securityDeposit.findFirst({
        where: { id: line.depositId, tenantId: organizationId },
        include: { lease: { select: { propertyId: true, id: true } } },
      });
      if (deposit === null) {
        throw new NotFoundException({ message: 'Deposit not found', code: 'DEPOSIT_NOT_FOUND' });
      }
      await this.authorization.assertPropertyAccess(
        membershipId,
        organizationId,
        deposit.lease.propertyId,
      );

      if (line.amount.gt(deposit.amountHeld)) {
        throw new UnprocessableEntityException({
          message: 'Disposition exceeds held deposit amount',
          code: 'DEPOSIT_INSUFFICIENT',
        });
      }

      const executedAt = body.executedAt !== undefined ? new Date(body.executedAt) : new Date();
      await this.periods.assertPeriodOpen(organizationId, executedAt, tx);

      const heldAfter = roundMoney(deposit.amountHeld.minus(line.amount));
      const nextStatus = heldAfter.lte(0) ? 'CLOSED' : 'PARTIALLY_DISPOSED';

      await tx.securityDeposit.update({
        where: { id: deposit.id },
        data: {
          amountHeld: heldAfter.lt(0) ? new Prisma.Decimal(0) : heldAfter,
          status: nextStatus,
          version: { increment: 1 },
        },
      });

      await this.ledger.postDepositDispositionJournal(tx, {
        tenantId: organizationId,
        dispositionId: line.id,
        leaseId: deposit.leaseId,
        currency: line.currency,
        amount: line.amount,
        effectiveAt: executedAt,
        dispositionType: line.dispositionType,
      });

      await tx.securityDepositDispositionLine.update({
        where: { id: line.id },
        data: {
          status: 'EXECUTED',
          executedAt,
          executedByUserId: actorUserId,
          version: { increment: 1 },
        },
      });

      await this.outbox.appendInTransaction(tx, {
        aggregateType: 'security_deposit_disposition',
        aggregateId: line.id,
        eventType: DEPOSIT_DISPOSITION_EXECUTED_EVENT_TYPE,
        payload: {
          tenantId: organizationId,
          dispositionId: line.id,
          depositId: deposit.id,
          amount: decimalToString(line.amount),
          dispositionType: line.dispositionType,
        },
        correlationId,
        tenantId: organizationId,
      });

      const refreshed = await tx.securityDepositDispositionLine.findFirstOrThrow({
        where: { id: line.id },
      });
      const responseBody = this.toResponse(refreshed);

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
        action: 'deposit.disposition.execute',
        outcome: 'SUCCESS',
        targetType: 'security_deposit_disposition',
        targetId: dispositionId,
        correlationId,
      });
    }

    return result;
  }

  private toResponse(row: {
    id: string;
    tenantId: string;
    depositId: string;
    dispositionType: DepositDispositionResponse['dispositionType'];
    amount: Prisma.Decimal;
    currency: string;
    reason: string;
    status: DepositDispositionResponse['status'];
    effectiveAt: Date;
    executedAt: Date | null;
    requestedByUserId: string | null;
    approvedByUserId: string | null;
    executedByUserId?: string | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): DepositDispositionResponse {
    return {
      id: row.id,
      organizationId: row.tenantId,
      depositId: row.depositId,
      dispositionType: row.dispositionType,
      amount: decimalToString(row.amount),
      currency: row.currency,
      reason: row.reason,
      status: row.status,
      effectiveAt: row.effectiveAt.toISOString(),
      executedAt: row.executedAt?.toISOString() ?? null,
      requestedByUserId: row.requestedByUserId,
      approvedByUserId: row.approvedByUserId,
      executedByUserId: row.executedByUserId ?? null,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
