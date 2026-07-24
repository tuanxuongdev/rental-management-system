import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  type CompleteMoveOutRequest,
  type DashboardHomeSummary,
  type MoveInRequest,
  type NoticeLeaseRequest,
  type OccupancyEventsCollection,
  type PatchMoveOutRequest,
  type PendingLeaseAction,
  type PendingLeaseActionsResponse,
  type RenewLeaseRequest,
  type StartMoveOutRequest,
  type TerminateLeaseRequest,
  type TransferLeaseRequest,
  LEASE_MOVE_OUT_COMPLETED_EVENT_TYPE,
  LEASE_MOVED_IN_EVENT_TYPE,
  LEASE_NOTICE_RECORDED_EVENT_TYPE,
  LEASE_RENEWED_EVENT_TYPE,
  LEASE_TERMINATED_EVENT_TYPE,
  LEASE_TRANSFERRED_EVENT_TYPE,
  type LeaseResponse,
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  PERMISSION_KEYS,
} from '@rpm/contracts';

import { throwVersionMismatch } from '../../../common/auth/if-match';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service';
import { actorScopeFromOrganization } from '../../../infrastructure/persistence/organization-context';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';
import { AuthorizationService } from '../../tenancy/application/authorization.service';
import { formatDateOnly, mapPrismaExclusionError, parseDateOnly } from '../domain/lease.rules';

import { LeaseService } from './lease.service';

const EXPIRY_WINDOW_DAYS = 60;
const FINANCE_NOTE =
  'Rent billing and invoices are available in Finance; payment collection begins in Sprint-11.' as const;

@Injectable()
export class LeaseLifecycleService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(LeaseService) private readonly leases: LeaseService,
  ) {}

  async moveIn(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    leaseId: string,
    body: MoveInRequest,
    expectedVersion: number,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: LeaseResponse }> {
    const lease = await this.leases.requireLease(organizationId, membershipId, leaseId);
    if (lease.status !== 'ACTIVE' && lease.status !== 'NOTICE') {
      throw new ConflictException({
        message: 'Lease must be active before move-in',
        code: 'LEASE_NOT_ACTIVE_OR_SCHEDULED',
      });
    }
    if (lease.occupancyState === 'OCCUPIED' || lease.occupancyState === 'MOVED_OUT') {
      throw new ConflictException({
        message: 'Move-in already recorded',
        code: 'MOVE_IN_ALREADY_RECORDED',
      });
    }
    if (lease.version !== expectedVersion) {
      throwVersionMismatch('Lease version mismatch');
    }

    const movedInAt = body.movedInAt !== undefined ? new Date(body.movedInAt) : new Date();
    if ((body.assetCheckouts?.length ?? 0) > 0) {
      await this.authorization.assertPermission(
        membershipId,
        organizationId,
        PERMISSION_KEYS.ASSETS_KEYS_MANAGE,
      );
    }
    const operation = `POST /v1/organizations/${organizationId}/leases/${leaseId}/move-in`;
    const actorScope = actorScopeFromOrganization(organizationId);

    const result = await this.transactions.run(async (tx) => {
      const existingIdem = await tx.idempotencyKey.findFirst({
        where: { tenantId: organizationId, actorScope, operation, key: idempotencyKey },
      });
      if (existingIdem !== null && existingIdem.requestHash === requestHash) {
        return { replayed: true as const, body: existingIdem.responseBody as LeaseResponse };
      }

      const claimed = await tx.lease.updateMany({
        where: {
          id: leaseId,
          tenantId: organizationId,
          deletedAt: null,
          occupancyState: 'NOT_MOVED_IN',
          version: expectedVersion,
          status: { in: ['ACTIVE', 'NOTICE'] },
        },
        data: {
          occupancyState: 'OCCUPIED',
          movedInAt,
          moveInChecklist: {
            checklist: body.checklist ?? [],
            meterReadings: body.meterReadings ?? [],
            documentIds: body.documentIds ?? [],
            notes: body.notes ?? null,
            acknowledged: true,
          } as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      });
      if (claimed.count === 0) {
        throwVersionMismatch('Lease version mismatch');
      }

      const primary = lease.parties.find((p) => p.isPrimary) ?? lease.parties[0];
      await tx.occupancyEvent.create({
        data: {
          id: randomUUID(),
          tenantId: organizationId,
          leaseId,
          partyId: primary?.partyId ?? null,
          eventType: 'MOVED_IN',
          occurredAt: movedInAt,
          actorUserId,
          payload: { documentIds: body.documentIds ?? [] },
        },
      });

      for (const key of body.assetCheckouts ?? []) {
        await tx.assetKey.create({
          data: {
            id: randomUUID(),
            tenantId: organizationId,
            leaseId,
            unitId: key.unitId ?? lease.allocations[0]?.unitId ?? null,
            label: key.label,
            code: key.code ?? null,
            status: 'ISSUED',
            issuedAt: movedInAt,
            notes: key.notes ?? null,
          },
        });
      }

      const activeAlloc = lease.allocations.filter((a) => a.status === 'ACTIVE');
      for (const alloc of activeAlloc) {
        await tx.unit.updateMany({
          where: { id: alloc.unitId, tenantId: organizationId },
          data: { version: { increment: 1 } },
        });
      }

      const refreshed = await tx.lease.findFirstOrThrow({
        where: { id: leaseId, tenantId: organizationId },
        include: {
          terms: true,
          parties: { include: { party: true } },
          allocations: { where: { status: 'ACTIVE' } },
        },
      });
      const responseBody = this.leases.toLeaseResponse(refreshed);

      await this.outbox.appendInTransaction(tx, {
        aggregateType: 'lease',
        aggregateId: leaseId,
        eventType: LEASE_MOVED_IN_EVENT_TYPE,
        payload: {
          tenantId: organizationId,
          leaseId,
          propertyId: lease.propertyId,
          movedInAt: movedInAt.toISOString(),
        },
        correlationId,
        tenantId: organizationId,
      });

      await this.idempotency.resolveOrCreate(tx, {
        tenantId: organizationId,
        actorScope,
        operation,
        key: idempotencyKey,
        requestHash,
        responseStatus: 200,
        responseBody,
      });

      return { replayed: false as const, body: responseBody };
    });

    if (!result.replayed) {
      await this.audit.record({
        tenantId: organizationId,
        actorUserId,
        action: 'lease.move_in',
        outcome: 'SUCCESS',
        targetType: 'lease',
        targetId: leaseId,
        correlationId,
      });
    }
    return result;
  }

  async renew(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    leaseId: string,
    body: RenewLeaseRequest,
    expectedVersion: number,
    correlationId?: string,
  ): Promise<LeaseResponse> {
    const prior = await this.leases.requireLease(organizationId, membershipId, leaseId);
    if (prior.status !== 'ACTIVE' && prior.status !== 'NOTICE') {
      throw new ConflictException({
        message: 'Only active leases can be renewed',
        code: 'LEASE_TRANSITION_CONFLICT',
      });
    }
    if (prior.version !== expectedVersion) {
      throwVersionMismatch('Lease version mismatch');
    }

    const startDate = parseDateOnly(body.startDate);
    const endDate =
      body.endDate === undefined || body.endDate === null ? null : parseDateOnly(body.endDate);
    if (endDate !== null && endDate <= startDate) {
      throw new UnprocessableEntityException({
        message: 'endDate must be after startDate',
        code: 'LEASE_DATE_INVALID',
      });
    }
    if (prior.endDate !== null && startDate < prior.endDate) {
      throw new UnprocessableEntityException({
        message: 'Renewal startDate must be on or after the prior lease endDate',
        code: 'LEASE_DATE_INVALID',
      });
    }

    const currentTerm = prior.terms.find((t) => t.isCurrent);
    if (currentTerm === undefined) {
      throw new ConflictException({
        message: 'Lease has no current term',
        code: 'LEASE_INCOMPLETE',
      });
    }

    const rentAmount = body.rentAmount ?? currentTerm.rentAmount.toFixed();
    const depositAmount = body.depositAmount ?? currentTerm.depositAmount.toFixed();
    const copyParties = body.copyParties !== false;
    const copyAllocation = body.copyAllocation !== false;

    try {
      const created = await this.transactions.run(async (tx) => {
        const claimed = await tx.lease.updateMany({
          where: {
            id: leaseId,
            tenantId: organizationId,
            version: expectedVersion,
            deletedAt: null,
            status: { in: ['ACTIVE', 'NOTICE'] },
          },
          data: { version: { increment: 1 } },
        });
        if (claimed.count === 0) {
          throwVersionMismatch('Lease version mismatch');
        }

        const existingRenewal = await tx.lease.findFirst({
          where: {
            tenantId: organizationId,
            renewedFromLeaseId: leaseId,
            deletedAt: null,
            status: { in: ['DRAFT', 'ACTIVE', 'NOTICE'] },
          },
        });
        if (existingRenewal !== null) {
          throw new ConflictException({
            message: 'A renewal draft already exists for this lease',
            code: 'RENEWAL_ALREADY_EXISTS',
          });
        }

        const draftId = randomUUID();
        const termId = randomUUID();
        await tx.lease.create({
          data: {
            id: draftId,
            tenantId: organizationId,
            propertyId: prior.propertyId,
            status: 'DRAFT',
            occupancyState: 'NOT_MOVED_IN',
            currency: prior.currency,
            startDate,
            endDate,
            notes: body.notes ?? `Renewal of ${prior.leaseNumber ?? prior.id}`,
            renewedFromLeaseId: leaseId,
            terms: {
              create: {
                id: termId,
                tenantId: organizationId,
                versionNumber: 1,
                isCurrent: true,
                currency: prior.currency,
                rentAmount: new Prisma.Decimal(rentAmount),
                depositAmount: new Prisma.Decimal(depositAmount),
                rentCadence: currentTerm.rentCadence,
                effectiveFrom: startDate,
                effectiveTo: endDate,
                recurringCharges: currentTerm.recurringCharges as Prisma.InputJsonValue,
              },
            },
            parties: copyParties
              ? {
                  create: prior.parties.map((party) => ({
                    id: randomUUID(),
                    tenantId: organizationId,
                    partyId: party.partyId,
                    role: party.role,
                    isPrimary: party.isPrimary,
                    effectiveFrom: startDate,
                    effectiveTo: endDate,
                  })),
                }
              : undefined,
            statusHistory: {
              create: {
                id: randomUUID(),
                tenantId: organizationId,
                fromStatus: null,
                toStatus: 'DRAFT',
                reason: 'Renewal draft created',
                actorUserId,
              },
            },
          },
        });

        if (copyAllocation) {
          const active = prior.allocations.find((a) => a.status === 'ACTIVE');
          if (active !== undefined) {
            const draftLease = await tx.lease.findFirstOrThrow({
              where: { id: draftId, tenantId: organizationId },
            });
            await this.leases.applyAllocationForLifecycle(tx, {
              organizationId,
              lease: draftLease,
              allocation: {
                unitId: active.unitId,
                allocationType: active.allocationType as 'WHOLE_UNIT' | 'BED' | 'CAPACITY',
                ...(active.bedId !== null ? { bedId: active.bedId } : {}),
                ...(active.allocationType === 'CAPACITY'
                  ? { capacityQuantity: active.capacityQuantity }
                  : {}),
              },
              startDate,
              endDate,
            });
          }
        }

        await tx.occupancyEvent.create({
          data: {
            id: randomUUID(),
            tenantId: organizationId,
            leaseId,
            eventType: 'RENEWED',
            occurredAt: new Date(),
            actorUserId,
            payload: { successorLeaseId: draftId },
          },
        });

        await this.outbox.appendInTransaction(tx, {
          aggregateType: 'lease',
          aggregateId: leaseId,
          eventType: LEASE_RENEWED_EVENT_TYPE,
          payload: {
            tenantId: organizationId,
            priorLeaseId: leaseId,
            successorLeaseId: draftId,
          },
          correlationId,
          tenantId: organizationId,
        });

        return tx.lease.findFirstOrThrow({
          where: { id: draftId, tenantId: organizationId },
          include: {
            terms: true,
            parties: { include: { party: true } },
            allocations: { where: { status: 'ACTIVE' } },
          },
        });
      });

      await this.audit.record({
        tenantId: organizationId,
        actorUserId,
        action: 'lease.renew',
        outcome: 'SUCCESS',
        targetType: 'lease',
        targetId: created.id,
        correlationId,
        changeSummary: { renewedFromLeaseId: leaseId },
      });

      return this.leases.toLeaseResponse(created);
    } catch (error) {
      mapPrismaExclusionError(error);
    }
  }

  async transfer(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    leaseId: string,
    body: TransferLeaseRequest,
    expectedVersion: number,
    correlationId?: string,
  ): Promise<LeaseResponse> {
    const lease = await this.leases.requireLease(organizationId, membershipId, leaseId);
    if (lease.status !== 'ACTIVE' && lease.status !== 'NOTICE') {
      throw new ConflictException({
        message: 'Only active leases can transfer allocation',
        code: 'LEASE_TRANSITION_CONFLICT',
      });
    }
    if (lease.version !== expectedVersion) {
      throwVersionMismatch('Lease version mismatch');
    }

    const effectiveAt = body.effectiveAt !== undefined ? new Date(body.effectiveAt) : new Date();

    try {
      const updated = await this.transactions.run(async (tx) => {
        const claimed = await tx.lease.updateMany({
          where: {
            id: leaseId,
            tenantId: organizationId,
            deletedAt: null,
            status: { in: ['ACTIVE', 'NOTICE'] },
            version: expectedVersion,
          },
          data: { version: { increment: 1 } },
        });
        if (claimed.count === 0) {
          throwVersionMismatch('Lease version mismatch');
        }

        await tx.leaseAllocation.updateMany({
          where: { tenantId: organizationId, leaseId, status: 'ACTIVE' },
          data: { status: 'ENDED', effectiveTo: effectiveAt },
        });

        const current = await tx.lease.findFirstOrThrow({
          where: { id: leaseId, tenantId: organizationId },
        });
        await this.leases.applyAllocationForLifecycle(tx, {
          organizationId,
          lease: current,
          allocation: body.allocation,
          startDate: effectiveAt,
          endDate: current.endDate,
        });

        await tx.occupancyEvent.create({
          data: {
            id: randomUUID(),
            tenantId: organizationId,
            leaseId,
            eventType: 'TRANSFERRED',
            occurredAt: effectiveAt,
            actorUserId,
            payload: { reason: body.reason, allocation: body.allocation },
          },
        });

        await this.outbox.appendInTransaction(tx, {
          aggregateType: 'lease',
          aggregateId: leaseId,
          eventType: LEASE_TRANSFERRED_EVENT_TYPE,
          payload: {
            tenantId: organizationId,
            leaseId,
            reason: body.reason,
            allocation: body.allocation,
          },
          correlationId,
          tenantId: organizationId,
        });

        return tx.lease.findFirstOrThrow({
          where: { id: leaseId, tenantId: organizationId },
          include: {
            terms: true,
            parties: { include: { party: true } },
            allocations: { where: { status: 'ACTIVE' } },
          },
        });
      });

      await this.audit.record({
        tenantId: organizationId,
        actorUserId,
        action: 'lease.transfer',
        outcome: 'SUCCESS',
        targetType: 'lease',
        targetId: leaseId,
        correlationId,
        changeSummary: { reason: body.reason },
      });

      return this.leases.toLeaseResponse(updated);
    } catch (error) {
      mapPrismaExclusionError(error);
    }
  }

  async recordNotice(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    leaseId: string,
    body: NoticeLeaseRequest,
    expectedVersion: number,
    correlationId?: string,
  ): Promise<LeaseResponse> {
    const lease = await this.leases.requireLease(organizationId, membershipId, leaseId);
    if (lease.status !== 'ACTIVE' && lease.status !== 'NOTICE') {
      throw new ConflictException({
        message: 'Notice requires an active lease',
        code: 'LEASE_TRANSITION_CONFLICT',
      });
    }
    if (lease.version !== expectedVersion) {
      throwVersionMismatch('Lease version mismatch');
    }

    const noticeDate = parseDateOnly(body.noticeDate);
    const proposedEnd = parseDateOnly(body.proposedEndDate);
    if (proposedEnd < noticeDate) {
      throw new UnprocessableEntityException({
        message: 'proposedEndDate must be on or after noticeDate',
        code: 'NOTICE_PERIOD_INVALID',
      });
    }

    const updated = await this.transactions.run(async (tx) => {
      const claimed = await tx.lease.updateMany({
        where: {
          id: leaseId,
          tenantId: organizationId,
          deletedAt: null,
          version: expectedVersion,
          status: { in: ['ACTIVE', 'NOTICE'] },
        },
        data: {
          status: 'NOTICE',
          noticeDate,
          noticeEffectiveEnd: proposedEnd,
          version: { increment: 1 },
        },
      });
      if (claimed.count === 0) {
        throwVersionMismatch('Lease version mismatch');
      }

      await tx.leaseStatusHistory.create({
        data: {
          id: randomUUID(),
          tenantId: organizationId,
          leaseId,
          fromStatus: lease.status,
          toStatus: 'NOTICE',
          reason: body.reason,
          actorUserId,
          metadata: { serviceMethod: body.serviceMethod ?? null },
        },
      });

      await tx.occupancyEvent.create({
        data: {
          id: randomUUID(),
          tenantId: organizationId,
          leaseId,
          eventType: 'NOTICE_RECORDED',
          occurredAt: noticeDate,
          actorUserId,
          payload: { proposedEndDate: body.proposedEndDate, reason: body.reason },
        },
      });

      await this.outbox.appendInTransaction(tx, {
        aggregateType: 'lease',
        aggregateId: leaseId,
        eventType: LEASE_NOTICE_RECORDED_EVENT_TYPE,
        payload: {
          tenantId: organizationId,
          leaseId,
          noticeDate: body.noticeDate,
          proposedEndDate: body.proposedEndDate,
        },
        correlationId,
        tenantId: organizationId,
      });

      return tx.lease.findFirstOrThrow({
        where: { id: leaseId, tenantId: organizationId },
        include: {
          terms: true,
          parties: { include: { party: true } },
          allocations: { where: { status: 'ACTIVE' } },
        },
      });
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'lease.notice',
      outcome: 'SUCCESS',
      targetType: 'lease',
      targetId: leaseId,
      correlationId,
    });

    return this.leases.toLeaseResponse(updated);
  }

  async startMoveOut(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    leaseId: string,
    body: StartMoveOutRequest,
    expectedVersion: number,
    correlationId?: string,
  ): Promise<LeaseResponse> {
    const lease = await this.leases.requireLease(organizationId, membershipId, leaseId);
    if (lease.occupancyState !== 'OCCUPIED') {
      throw new ConflictException({
        message: 'Move-out requires an occupied lease',
        code: 'LEASE_TRANSITION_CONFLICT',
      });
    }
    if (lease.moveOutStatus === 'COMPLETED') {
      throw new ConflictException({
        message: 'Move-out already completed',
        code: 'MOVE_OUT_ALREADY_RECORDED',
      });
    }
    if (lease.version !== expectedVersion) {
      throwVersionMismatch('Lease version mismatch');
    }

    const startedAt = body.startedAt !== undefined ? new Date(body.startedAt) : new Date();

    const updated = await this.transactions.run(async (tx) => {
      const claimed = await tx.lease.updateMany({
        where: {
          id: leaseId,
          tenantId: organizationId,
          deletedAt: null,
          occupancyState: 'OCCUPIED',
          version: expectedVersion,
        },
        data: {
          moveOutStatus: 'IN_PROGRESS',
          moveOutChecklist: {
            startedAt: startedAt.toISOString(),
            notes: body.notes ?? null,
            checklist: [
              { key: 'condition', label: 'Unit/bed condition reviewed', completed: false },
              { key: 'keys', label: 'Keys returned or reconciled', completed: false },
              {
                key: 'readings',
                label: 'Final meter reading values captured (checklist)',
                completed: false,
              },
              {
                key: 'deposit_preview',
                label: 'Deposit disposition preview recorded (pending finance)',
                completed: false,
              },
            ],
            meterReadings: [],
            documentIds: [],
            depositDispositionPreview: {
              outcome: 'PENDING_FINANCE',
              notes: 'Pending finance disposition (Sprint-10)',
            },
          } as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      });
      if (claimed.count === 0) {
        throwVersionMismatch('Lease version mismatch');
      }
      return tx.lease.findFirstOrThrow({
        where: { id: leaseId, tenantId: organizationId },
        include: {
          terms: true,
          parties: { include: { party: true } },
          allocations: { where: { status: 'ACTIVE' } },
        },
      });
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'lease.move_out.start',
      outcome: 'SUCCESS',
      targetType: 'lease',
      targetId: leaseId,
      correlationId,
    });

    return this.leases.toLeaseResponse(updated);
  }

  async patchMoveOut(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    leaseId: string,
    body: PatchMoveOutRequest,
    expectedVersion: number,
    correlationId?: string,
  ): Promise<LeaseResponse> {
    const lease = await this.leases.requireLease(organizationId, membershipId, leaseId);
    if (lease.moveOutStatus !== 'IN_PROGRESS') {
      throw new ConflictException({
        message: 'Move-out checkout is not in progress',
        code: 'LEASE_TRANSITION_CONFLICT',
      });
    }
    if (lease.version !== expectedVersion) {
      throwVersionMismatch('Lease version mismatch');
    }

    if ((body.assetReturns?.length ?? 0) > 0 || body.returnAllIssuedKeys === true) {
      await this.authorization.assertPermission(
        membershipId,
        organizationId,
        PERMISSION_KEYS.ASSETS_KEYS_MANAGE,
      );
    }

    const prior =
      (lease.moveOutChecklist as Record<string, unknown> | null) ?? ({} as Record<string, unknown>);

    const updated = await this.transactions.run(async (tx) => {
      if (body.returnAllIssuedKeys === true) {
        await tx.assetKey.updateMany({
          where: { tenantId: organizationId, leaseId, status: 'ISSUED' },
          data: { status: 'RETURNED', returnedAt: new Date() },
        });
      }
      for (const ret of body.assetReturns ?? []) {
        await tx.assetKey.updateMany({
          where: {
            id: ret.assetKeyId,
            tenantId: organizationId,
            leaseId,
          },
          data: {
            status: ret.status,
            returnedAt: new Date(),
            notes: ret.notes ?? undefined,
          },
        });
      }

      const claimed = await tx.lease.updateMany({
        where: {
          id: leaseId,
          tenantId: organizationId,
          moveOutStatus: 'IN_PROGRESS',
          version: expectedVersion,
        },
        data: {
          moveOutChecklist: {
            ...prior,
            ...(body.checklist !== undefined ? { checklist: body.checklist } : {}),
            ...(body.meterReadings !== undefined ? { meterReadings: body.meterReadings } : {}),
            ...(body.documentIds !== undefined ? { documentIds: body.documentIds } : {}),
            ...(body.depositDispositionPreview !== undefined
              ? { depositDispositionPreview: body.depositDispositionPreview }
              : {}),
            ...(body.notes !== undefined ? { notes: body.notes } : {}),
          } as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      });
      if (claimed.count === 0) {
        throwVersionMismatch('Lease version mismatch');
      }

      return tx.lease.findFirstOrThrow({
        where: { id: leaseId, tenantId: organizationId },
        include: {
          terms: true,
          parties: { include: { party: true } },
          allocations: { where: { status: 'ACTIVE' } },
        },
      });
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'lease.move_out.update',
      outcome: 'SUCCESS',
      targetType: 'lease',
      targetId: leaseId,
      correlationId,
    });

    return this.leases.toLeaseResponse(updated);
  }

  async completeMoveOut(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    leaseId: string,
    body: CompleteMoveOutRequest,
    expectedVersion: number,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: LeaseResponse }> {
    const lease = await this.leases.requireLease(organizationId, membershipId, leaseId);
    if (lease.moveOutStatus !== 'IN_PROGRESS') {
      throw new ConflictException({
        message: 'Move-out checkout is not in progress',
        code: 'LEASE_TRANSITION_CONFLICT',
      });
    }
    if (lease.version !== expectedVersion) {
      throwVersionMismatch('Lease version mismatch');
    }

    const checklist = (lease.moveOutChecklist ?? {}) as {
      checklist?: Array<{ key: string; completed: boolean }>;
    };
    const items = checklist.checklist ?? [];
    if (items.length === 0 || items.some((item) => !item.completed)) {
      throw new UnprocessableEntityException({
        message: 'All mandatory move-out checklist items must be completed',
        code: 'CHECKLIST_INCOMPLETE',
      });
    }

    const openKeys = await this.prisma.assetKey.count({
      where: { tenantId: organizationId, leaseId, status: 'ISSUED' },
    });
    if (openKeys > 0) {
      throw new ConflictException({
        message: 'Issued keys must be returned or marked lost/damaged before completing move-out',
        code: 'ASSETS_UNRECONCILED',
      });
    }
    if (body.keysReconciled !== true) {
      throw new UnprocessableEntityException({
        message: 'Key reconciliation must be acknowledged',
        code: 'CHECKLIST_INCOMPLETE',
      });
    }

    const movedOutAt = body.movedOutAt !== undefined ? new Date(body.movedOutAt) : new Date();
    const operation = `POST /v1/organizations/${organizationId}/leases/${leaseId}/move-out/complete`;
    const actorScope = actorScopeFromOrganization(organizationId);

    const result = await this.transactions.run(async (tx) => {
      const existingIdem = await tx.idempotencyKey.findFirst({
        where: { tenantId: organizationId, actorScope, operation, key: idempotencyKey },
      });
      if (existingIdem !== null && existingIdem.requestHash === requestHash) {
        return { replayed: true as const, body: existingIdem.responseBody as LeaseResponse };
      }

      const claimed = await tx.lease.updateMany({
        where: {
          id: leaseId,
          tenantId: organizationId,
          moveOutStatus: 'IN_PROGRESS',
          version: expectedVersion,
        },
        data: {
          moveOutStatus: 'COMPLETED',
          occupancyState: 'MOVED_OUT',
          movedOutAt,
          version: { increment: 1 },
        },
      });
      if (claimed.count === 0) {
        throwVersionMismatch('Lease version mismatch');
      }

      await tx.occupancyEvent.create({
        data: {
          id: randomUUID(),
          tenantId: organizationId,
          leaseId,
          eventType: 'MOVED_OUT',
          occurredAt: movedOutAt,
          actorUserId,
          payload: { keysReconciled: true },
        },
      });

      const refreshed = await tx.lease.findFirstOrThrow({
        where: { id: leaseId, tenantId: organizationId },
        include: {
          terms: true,
          parties: { include: { party: true } },
          allocations: { where: { status: 'ACTIVE' } },
        },
      });
      const responseBody = this.leases.toLeaseResponse(refreshed);

      await this.outbox.appendInTransaction(tx, {
        aggregateType: 'lease',
        aggregateId: leaseId,
        eventType: LEASE_MOVE_OUT_COMPLETED_EVENT_TYPE,
        payload: {
          tenantId: organizationId,
          leaseId,
          movedOutAt: movedOutAt.toISOString(),
          depositDisposition: 'PENDING_FINANCE',
        },
        correlationId,
        tenantId: organizationId,
      });

      await this.idempotency.resolveOrCreate(tx, {
        tenantId: organizationId,
        actorScope,
        operation,
        key: idempotencyKey,
        requestHash,
        responseStatus: 200,
        responseBody,
      });

      return { replayed: false as const, body: responseBody };
    });

    if (!result.replayed) {
      await this.audit.record({
        tenantId: organizationId,
        actorUserId,
        action: 'lease.move_out.complete',
        outcome: 'SUCCESS',
        targetType: 'lease',
        targetId: leaseId,
        correlationId,
      });
    }
    return result;
  }

  async terminate(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    leaseId: string,
    body: TerminateLeaseRequest,
    expectedVersion: number,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: LeaseResponse }> {
    const lease = await this.leases.requireLease(organizationId, membershipId, leaseId);
    if (lease.status === 'ENDED' || lease.status === 'CANCELLED') {
      throw new ConflictException({
        message: 'Lease already ended',
        code: 'LEASE_TRANSITION_CONFLICT',
      });
    }
    if (lease.occupancyState === 'OCCUPIED' && lease.moveOutStatus !== 'COMPLETED') {
      throw new ConflictException({
        message: 'Complete move-out checkout before terminating an occupied lease',
        code: 'OPEN_MOVE_OUT_REQUIRED',
      });
    }
    if (lease.version !== expectedVersion) {
      throwVersionMismatch('Lease version mismatch');
    }

    const effectiveAt = body.effectiveAt !== undefined ? new Date(body.effectiveAt) : new Date();
    const operation = `POST /v1/organizations/${organizationId}/leases/${leaseId}/terminate`;
    const actorScope = actorScopeFromOrganization(organizationId);

    const result = await this.transactions.run(async (tx) => {
      const existingIdem = await tx.idempotencyKey.findFirst({
        where: { tenantId: organizationId, actorScope, operation, key: idempotencyKey },
      });
      if (existingIdem !== null && existingIdem.requestHash === requestHash) {
        return { replayed: true as const, body: existingIdem.responseBody as LeaseResponse };
      }

      const claimed = await tx.lease.updateMany({
        where: {
          id: leaseId,
          tenantId: organizationId,
          deletedAt: null,
          version: expectedVersion,
          status: { in: ['ACTIVE', 'NOTICE', 'DRAFT'] },
        },
        data: {
          status: lease.status === 'DRAFT' ? 'CANCELLED' : 'ENDED',
          terminationReason: body.reason,
          terminatedAt: effectiveAt,
          cancelledAt: lease.status === 'DRAFT' ? effectiveAt : lease.cancelledAt,
          version: { increment: 1 },
        },
      });
      if (claimed.count === 0) {
        throwVersionMismatch('Lease version mismatch');
      }

      if (body.inventoryRelease !== false) {
        await tx.leaseAllocation.updateMany({
          where: { tenantId: organizationId, leaseId, status: 'ACTIVE' },
          data: { status: 'ENDED', effectiveTo: effectiveAt },
        });
      }

      const toStatus = lease.status === 'DRAFT' ? 'CANCELLED' : 'ENDED';
      await tx.leaseStatusHistory.create({
        data: {
          id: randomUUID(),
          tenantId: organizationId,
          leaseId,
          fromStatus: lease.status,
          toStatus,
          reason: body.reason,
          actorUserId,
          effectiveAt,
        },
      });

      await tx.occupancyEvent.create({
        data: {
          id: randomUUID(),
          tenantId: organizationId,
          leaseId,
          eventType: 'TERMINATED',
          occurredAt: effectiveAt,
          actorUserId,
          payload: { reason: body.reason },
        },
      });

      const refreshed = await tx.lease.findFirstOrThrow({
        where: { id: leaseId, tenantId: organizationId },
        include: {
          terms: true,
          parties: { include: { party: true } },
          allocations: { where: { status: 'ACTIVE' } },
        },
      });
      const responseBody = this.leases.toLeaseResponse(refreshed);

      await this.outbox.appendInTransaction(tx, {
        aggregateType: 'lease',
        aggregateId: leaseId,
        eventType: LEASE_TERMINATED_EVENT_TYPE,
        payload: {
          tenantId: organizationId,
          leaseId,
          reason: body.reason,
          effectiveAt: effectiveAt.toISOString(),
        },
        correlationId,
        tenantId: organizationId,
      });

      await this.idempotency.resolveOrCreate(tx, {
        tenantId: organizationId,
        actorScope,
        operation,
        key: idempotencyKey,
        requestHash,
        responseStatus: 200,
        responseBody,
      });

      return { replayed: false as const, body: responseBody };
    });

    if (!result.replayed) {
      await this.audit.record({
        tenantId: organizationId,
        actorUserId,
        action: 'lease.terminate',
        outcome: 'SUCCESS',
        targetType: 'lease',
        targetId: leaseId,
        correlationId,
        changeSummary: { reason: body.reason },
      });
    }
    return result;
  }

  async listOccupancyEvents(
    organizationId: string,
    membershipId: string,
    leaseId: string,
    options?: { limit?: number; after?: string },
  ): Promise<OccupancyEventsCollection> {
    await this.leases.requireLease(organizationId, membershipId, leaseId);
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);

    let afterAnchor: { occurredAt: Date; id: string } | null = null;
    if (options?.after !== undefined) {
      afterAnchor = await this.prisma.occupancyEvent.findFirst({
        where: { id: options.after, tenantId: organizationId, leaseId },
        select: { occurredAt: true, id: true },
      });
    }

    const rows = await this.prisma.occupancyEvent.findMany({
      where: {
        tenantId: organizationId,
        leaseId,
        ...(afterAnchor !== null
          ? {
              OR: [
                { occurredAt: { lt: afterAnchor.occurredAt } },
                { occurredAt: afterAnchor.occurredAt, id: { lt: afterAnchor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const pageItems = rows.slice(0, limit);
    const last = pageItems.at(-1);
    return {
      data: pageItems.map((row) => ({
        id: row.id,
        leaseId: row.leaseId,
        partyId: row.partyId,
        eventType: row.eventType,
        occurredAt: row.occurredAt.toISOString(),
        recordedAt: row.recordedAt.toISOString(),
        actorUserId: row.actorUserId,
        payload: (row.payload ?? {}) as Record<string, unknown>,
      })),
      page: {
        nextCursor: rows.length > limit && last !== undefined ? last.id : null,
        previousCursor: null,
        limit,
      },
      meta: {},
    };
  }

  async listPendingActions(
    organizationId: string,
    membershipId: string,
    options?: { expiryWindowDays?: number },
  ): Promise<PendingLeaseActionsResponse> {
    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );
    const expiryWindowDays = options?.expiryWindowDays ?? EXPIRY_WINDOW_DAYS;
    const asOf = new Date();
    const windowEnd = new Date(asOf);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + expiryWindowDays);

    const propertyFilter =
      accessible === null
        ? {}
        : {
            propertyId: {
              in: accessible.length > 0 ? accessible : ['00000000-0000-0000-0000-000000000000'],
            },
          };

    const leases = await this.prisma.lease.findMany({
      where: {
        tenantId: organizationId,
        deletedAt: null,
        ...propertyFilter,
        status: { in: ['ACTIVE', 'NOTICE'] },
      },
      include: {
        parties: {
          where: { isPrimary: true },
          include: { party: true },
          take: 1,
        },
      },
      take: 500,
    });

    const actions: PendingLeaseAction[] = [];
    const today = parseDateOnly(formatDateOnly(asOf));
    const soonEnd = new Date(today);
    soonEnd.setUTCDate(soonEnd.getUTCDate() + 7);
    const windowEndDate = parseDateOnly(formatDateOnly(windowEnd));

    for (const lease of leases) {
      const primaryName = lease.parties[0]?.party.displayName ?? null;
      const end = lease.endDate;
      const noticeEnd = lease.noticeEffectiveEnd;

      if (lease.occupancyState === 'NOT_MOVED_IN') {
        actions.push({
          leaseId: lease.id,
          leaseNumber: lease.leaseNumber,
          propertyId: lease.propertyId,
          status: lease.status,
          occupancyState: lease.occupancyState,
          kind: 'MOVE_IN_DUE',
          dueDate: formatDateOnly(lease.startDate),
          primaryPartyName: primaryName,
        });
      }

      if (lease.moveOutStatus === 'IN_PROGRESS') {
        actions.push({
          leaseId: lease.id,
          leaseNumber: lease.leaseNumber,
          propertyId: lease.propertyId,
          status: lease.status,
          occupancyState: lease.occupancyState,
          kind: 'CHECKOUT_IN_PROGRESS',
          dueDate:
            noticeEnd !== null
              ? formatDateOnly(noticeEnd)
              : end !== null
                ? formatDateOnly(end)
                : null,
          primaryPartyName: primaryName,
        });
      }

      const dueEnd = noticeEnd ?? end;
      if (
        lease.occupancyState === 'OCCUPIED' &&
        dueEnd !== null &&
        lease.moveOutStatus !== 'COMPLETED'
      ) {
        const dueDay = parseDateOnly(formatDateOnly(dueEnd));
        if (dueDay < today) {
          actions.push({
            leaseId: lease.id,
            leaseNumber: lease.leaseNumber,
            propertyId: lease.propertyId,
            status: lease.status,
            occupancyState: lease.occupancyState,
            kind: 'HOLDOVER',
            dueDate: formatDateOnly(dueEnd),
            primaryPartyName: primaryName,
          });
        } else if (dueDay <= soonEnd) {
          actions.push({
            leaseId: lease.id,
            leaseNumber: lease.leaseNumber,
            propertyId: lease.propertyId,
            status: lease.status,
            occupancyState: lease.occupancyState,
            kind: 'MOVE_OUT_DUE',
            dueDate: formatDateOnly(dueEnd),
            primaryPartyName: primaryName,
          });
        } else if (dueDay <= windowEndDate) {
          actions.push({
            leaseId: lease.id,
            leaseNumber: lease.leaseNumber,
            propertyId: lease.propertyId,
            status: lease.status,
            occupancyState: lease.occupancyState,
            kind: 'EXPIRING_SOON',
            dueDate: formatDateOnly(dueEnd),
            primaryPartyName: primaryName,
          });
        }
      }
    }

    return {
      data: actions.slice(0, 100),
      meta: { asOf: asOf.toISOString(), expiryWindowDays },
    };
  }

  async getHomeDashboard(
    organizationId: string,
    membershipId: string,
  ): Promise<DashboardHomeSummary> {
    const pending = await this.listPendingActions(organizationId, membershipId);
    const counts = {
      moveInsDue: 0,
      expiringSoon: 0,
      moveOutsDue: 0,
      holdovers: 0,
      checkoutsInProgress: 0,
    };
    for (const action of pending.data) {
      switch (action.kind) {
        case 'MOVE_IN_DUE':
          counts.moveInsDue += 1;
          break;
        case 'EXPIRING_SOON':
          counts.expiringSoon += 1;
          break;
        case 'MOVE_OUT_DUE':
          counts.moveOutsDue += 1;
          break;
        case 'HOLDOVER':
          counts.holdovers += 1;
          break;
        case 'CHECKOUT_IN_PROGRESS':
          counts.checkoutsInProgress += 1;
          break;
      }
    }

    return {
      asOf: pending.meta.asOf,
      ...counts,
      actions: pending.data.slice(0, 25),
      financeNote: FINANCE_NOTE,
    };
  }
}
