import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type Lease,
  type LeaseAllocation,
  type LeaseParty,
  type LeaseStatus,
  type LeaseTerm,
  type Party,
  Prisma,
  type RentCadence,
} from '@prisma/client';

import {
  type ActivateLeaseRequest,
  type CreateLeaseRequest,
  LEASE_ACTIVATED_EVENT_TYPE,
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  type PatchLeaseRequest,
  PERMISSION_KEYS,
  type RecurringChargeInput,
  type LeaseAllocationWrite,
  type LeaseHistoryCollection,
  type LeaseResponse,
  type LeaseReviewResponse,
  type LeasesCollection,
  type SetLeaseAllocationRequest,
} from '@rpm/contracts';

import { throwVersionMismatch } from '../../../common/auth/if-match';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service';
import { actorScopeFromOrganization } from '../../../infrastructure/persistence/organization-context';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { isPrismaUniqueViolation } from '../../../infrastructure/prisma/prisma-errors';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';
import { DepositService } from '../../billing/application/deposit.service';
import { AuthorizationService } from '../../tenancy/application/authorization.service';
import {
  assertAllocationModeMatch,
  decimalToString,
  formatDateOnly,
  generateLeaseNumber,
  LEASE_DEPOSIT_DISPOSITION_NOTE,
  mapPrismaExclusionError,
  occupancyNoteForState,
  parseDateOnly,
  rangesOverlap,
} from '../domain/lease.rules';

type LeaseRecord = Lease & {
  terms: LeaseTerm[];
  parties: (LeaseParty & { party: Party })[];
  allocations: LeaseAllocation[];
};

@Injectable()
export class LeaseService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(DepositService) private readonly deposits: DepositService,
  ) {}

  async listLeases(
    organizationId: string,
    membershipId: string,
    options?: {
      limit?: number;
      after?: string;
      q?: string;
      status?: string;
      propertyId?: string;
      residentId?: string;
      partyId?: string;
    },
  ): Promise<LeasesCollection> {
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

    const partyFilter = options?.partyId ?? options?.residentId;

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

    const leases = await this.prisma.lease.findMany({
      where: {
        tenantId: organizationId,
        deletedAt: null,
        ...propertyScope,
        ...(options?.status !== undefined ? { status: options.status as LeaseStatus } : {}),
        ...(partyFilter !== undefined ? { parties: { some: { partyId: partyFilter } } } : {}),
        ...(options?.q !== undefined
          ? {
              OR: [
                { leaseNumber: { contains: options.q, mode: 'insensitive' } },
                {
                  parties: {
                    some: {
                      party: {
                        OR: [
                          { displayName: { contains: options.q, mode: 'insensitive' } },
                          { legalName: { contains: options.q, mode: 'insensitive' } },
                        ],
                      },
                    },
                  },
                },
              ],
            }
          : {}),
        ...(options?.after !== undefined ? { id: { gt: options.after } } : {}),
      },
      include: this.leaseInclude(),
      orderBy: { id: 'asc' },
      take: limit + 1,
    });

    const pageItems = leases.slice(0, limit);
    const hasMore = leases.length > limit;
    const last = pageItems.at(-1);

    return {
      data: pageItems.map((item) => this.toResponse(item)),
      page: {
        nextCursor: hasMore && last !== undefined ? last.id : null,
        previousCursor: null,
        limit,
      },
      meta: {},
    };
  }

  async getLease(
    organizationId: string,
    membershipId: string,
    leaseId: string,
  ): Promise<LeaseResponse> {
    const record = await this.findLease(organizationId, membershipId, leaseId);
    return this.toResponse(record);
  }

  async createLease(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    body: CreateLeaseRequest,
    correlationId?: string,
  ): Promise<LeaseResponse> {
    await this.authorization.assertPropertyAccess(membershipId, organizationId, body.propertyId);

    const property = await this.prisma.property.findFirst({
      where: { id: body.propertyId, tenantId: organizationId, deletedAt: null },
    });
    if (property === null) {
      throw new NotFoundException({
        message: 'Property not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    if (property.defaultCurrency !== body.currency) {
      throw new UnprocessableEntityException({
        message: 'Lease currency must match property default currency',
        code: 'CURRENCY_MISMATCH',
      });
    }

    await this.assertPartiesValid(
      organizationId,
      body.parties.map((item) => item.partyId),
    );

    const startDate = parseDateOnly(body.startDate);
    const endDate =
      body.endDate !== undefined && body.endDate !== null ? parseDateOnly(body.endDate) : null;

    const leaseId = randomUUID();
    const termId = randomUUID();

    let created: LeaseRecord;
    try {
      created = await this.transactions.run(async (tx) => {
        const lease = await tx.lease.create({
          data: {
            id: leaseId,
            tenantId: organizationId,
            propertyId: body.propertyId,
            status: 'DRAFT',
            currency: body.currency,
            startDate,
            endDate,
            notes: body.notes ?? null,
            terms: {
              create: {
                id: termId,
                tenantId: organizationId,
                versionNumber: 1,
                isCurrent: true,
                currency: body.currency,
                rentAmount: new Prisma.Decimal(body.rentAmount),
                depositAmount: new Prisma.Decimal(body.depositAmount),
                rentCadence: (body.rentCadence ?? 'MONTHLY') as RentCadence,
                effectiveFrom: startDate,
                effectiveTo: endDate,
                recurringCharges: (body.recurringCharges ?? []) as Prisma.InputJsonValue,
              },
            },
            parties: {
              create: body.parties.map((party) => ({
                id: randomUUID(),
                tenantId: organizationId,
                partyId: party.partyId,
                role: party.role,
                isPrimary: party.isPrimary === true || party.role === 'PRIMARY_LEASEHOLDER',
                effectiveFrom: startDate,
              })),
            },
            statusHistory: {
              create: {
                id: randomUUID(),
                tenantId: organizationId,
                fromStatus: null,
                toStatus: 'DRAFT',
                reason: 'Draft created',
                actorUserId,
                metadata: {},
              },
            },
          },
          include: this.leaseInclude(),
        });

        if (body.allocation !== undefined) {
          await this.applyAllocationInTransaction(tx, {
            organizationId,
            lease,
            allocation: body.allocation,
            startDate,
            endDate,
          });
        }

        return tx.lease.findFirstOrThrow({
          where: { id: leaseId, tenantId: organizationId },
          include: this.leaseInclude(),
        });
      });
    } catch (error) {
      mapPrismaExclusionError(error);
    }

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'lease.create',
      outcome: 'SUCCESS',
      targetType: 'lease',
      targetId: created.id,
      correlationId,
      changeSummary: { propertyId: body.propertyId, status: 'DRAFT' },
    });

    return this.toResponse(created);
  }

  async patchLease(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    leaseId: string,
    body: PatchLeaseRequest,
    expectedVersion: number,
    correlationId?: string,
  ): Promise<LeaseResponse> {
    const existing = await this.findLease(organizationId, membershipId, leaseId);
    if (existing.status !== 'DRAFT') {
      throw new ConflictException({
        message: 'Only draft leases can be updated',
        code: 'LEASE_NOT_DRAFT',
      });
    }
    if (existing.version !== expectedVersion) {
      throwVersionMismatch('Lease version mismatch');
    }

    const property = await this.prisma.property.findFirstOrThrow({
      where: { id: existing.propertyId, tenantId: organizationId },
    });
    const nextCurrency = body.currency ?? existing.currency;
    if (property.defaultCurrency !== nextCurrency) {
      throw new UnprocessableEntityException({
        message: 'Lease currency must match property default currency',
        code: 'CURRENCY_MISMATCH',
      });
    }

    const nextStart =
      body.startDate !== undefined ? parseDateOnly(body.startDate) : existing.startDate;
    const nextEnd =
      body.endDate !== undefined
        ? body.endDate === null
          ? null
          : parseDateOnly(body.endDate)
        : existing.endDate;
    if (nextEnd !== null && nextEnd <= nextStart) {
      throw new UnprocessableEntityException({
        message: 'endDate must be after startDate',
        code: 'LEASE_DATE_INVALID',
      });
    }

    const currentTerm = existing.terms.find((term) => term.isCurrent);
    if (currentTerm === undefined) {
      throw new ConflictException({
        message: 'Lease has no current term',
        code: 'LEASE_INCOMPLETE',
      });
    }

    const updated = await this.transactions.run(async (tx) => {
      const claimed = await tx.lease.updateMany({
        where: {
          id: leaseId,
          tenantId: organizationId,
          deletedAt: null,
          status: 'DRAFT',
          version: expectedVersion,
        },
        data: {
          ...(body.startDate !== undefined ? { startDate: nextStart } : {}),
          ...(body.endDate !== undefined ? { endDate: nextEnd } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          ...(body.currency !== undefined ? { currency: body.currency } : {}),
          version: { increment: 1 },
        },
      });
      if (claimed.count === 0) {
        throwVersionMismatch('Lease version mismatch');
      }

      await tx.leaseTerm.update({
        where: { id: currentTerm.id },
        data: {
          ...(body.currency !== undefined ? { currency: body.currency } : {}),
          ...(body.rentAmount !== undefined
            ? { rentAmount: new Prisma.Decimal(body.rentAmount) }
            : {}),
          ...(body.depositAmount !== undefined
            ? { depositAmount: new Prisma.Decimal(body.depositAmount) }
            : {}),
          ...(body.rentCadence !== undefined
            ? { rentCadence: body.rentCadence as RentCadence }
            : {}),
          ...(body.recurringCharges !== undefined
            ? { recurringCharges: body.recurringCharges as Prisma.InputJsonValue }
            : {}),
          ...(body.startDate !== undefined ? { effectiveFrom: nextStart } : {}),
          ...(body.endDate !== undefined ? { effectiveTo: nextEnd } : {}),
        },
      });

      if (body.startDate !== undefined || body.endDate !== undefined) {
        await this.syncAllocationWindowsInTransaction(tx, {
          organizationId,
          leaseId,
          propertyId: existing.propertyId,
          startDate: nextStart,
          endDate: nextEnd,
        });
      }

      return tx.lease.findFirstOrThrow({
        where: { id: leaseId, tenantId: organizationId, deletedAt: null },
        include: this.leaseInclude(),
      });
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'lease.update',
      outcome: 'SUCCESS',
      targetType: 'lease',
      targetId: leaseId,
      correlationId,
      changeSummary: { fields: Object.keys(body) },
    });

    return this.toResponse(updated);
  }

  async setAllocation(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    leaseId: string,
    body: SetLeaseAllocationRequest,
    expectedVersion: number,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: LeaseResponse }> {
    const existing = await this.findLease(organizationId, membershipId, leaseId);
    if (existing.status !== 'DRAFT') {
      throw new ConflictException({
        message: 'Only draft leases can change allocation',
        code: 'LEASE_NOT_DRAFT',
      });
    }
    if (existing.version !== expectedVersion) {
      throwVersionMismatch('Lease version mismatch');
    }

    const operation = `POST /v1/organizations/${organizationId}/leases/${leaseId}/allocations`;
    const actorScope = actorScopeFromOrganization(organizationId);

    try {
      const result = await this.transactions.run(async (tx) => {
        const existingIdem = await tx.idempotencyKey.findFirst({
          where: {
            tenantId: organizationId,
            actorScope,
            operation,
            key: idempotencyKey,
          },
        });
        if (existingIdem !== null && existingIdem.requestHash === requestHash) {
          return {
            replayed: true as const,
            body: existingIdem.responseBody as LeaseResponse,
          };
        }

        const claimed = await tx.lease.updateMany({
          where: {
            id: leaseId,
            tenantId: organizationId,
            deletedAt: null,
            status: 'DRAFT',
            version: expectedVersion,
          },
          data: { version: { increment: 1 } },
        });
        if (claimed.count === 0) {
          throwVersionMismatch('Lease version mismatch');
        }

        const lease = await tx.lease.findFirstOrThrow({
          where: { id: leaseId, tenantId: organizationId, deletedAt: null },
        });
        await this.applyAllocationInTransaction(tx, {
          organizationId,
          lease,
          allocation: body,
          startDate: lease.startDate,
          endDate: lease.endDate,
        });
        const refreshed = await tx.lease.findFirstOrThrow({
          where: { id: leaseId, tenantId: organizationId },
          include: this.leaseInclude(),
        });
        const responseBody = this.toResponse(refreshed);

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
          action: 'lease.allocation.set',
          outcome: 'SUCCESS',
          targetType: 'lease',
          targetId: leaseId,
          correlationId,
          changeSummary: { unitId: body.unitId, allocationType: body.allocationType },
        });
      }

      return result;
    } catch (error) {
      mapPrismaExclusionError(error);
    }
  }

  async reviewLease(
    organizationId: string,
    membershipId: string,
    leaseId: string,
  ): Promise<LeaseReviewResponse> {
    const lease = await this.findLease(organizationId, membershipId, leaseId);
    return this.buildReview(organizationId, lease);
  }

  async activateLease(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    leaseId: string,
    body: ActivateLeaseRequest,
    expectedVersion: number,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: LeaseResponse }> {
    if (body.checklistAcknowledged !== true) {
      throw new UnprocessableEntityException({
        message: 'Activation checklist must be acknowledged',
        code: 'LEASE_INCOMPLETE',
      });
    }

    const operation = `POST /v1/organizations/${organizationId}/leases/${leaseId}/activate`;
    const actorScope = actorScopeFromOrganization(organizationId);

    const pre = await this.findLease(organizationId, membershipId, leaseId);
    if (pre.status === 'ACTIVE') {
      const existingIdem = await this.idempotency.findExisting(
        organizationId,
        actorScope,
        operation,
        idempotencyKey,
      );
      if (existingIdem !== null && existingIdem.requestHash === requestHash) {
        return {
          replayed: true,
          body: existingIdem.responseBody as LeaseResponse,
        };
      }
      throw new ConflictException({
        message: 'Lease is not in draft status',
        code: 'LEASE_NOT_DRAFT',
      });
    }
    if (pre.version !== expectedVersion) {
      throwVersionMismatch('Lease version mismatch');
    }

    // review.ready is false when DNR ERROR is present; activate still allows DNR when
    // overrideDoNotRent + leases.override_do_not_rent are satisfied (non-DNR ERRORs block).
    const review = await this.buildReview(organizationId, pre);
    const blockingIssues = review.issues.filter(
      (issue) => issue.severity === 'ERROR' && issue.code !== 'DO_NOT_RENT_ACTIVE',
    );
    if (blockingIssues.length > 0) {
      throw new ConflictException({
        message: blockingIssues[0]?.message ?? 'Lease is not ready for activation',
        code: blockingIssues[0]?.code ?? 'LEASE_INCOMPLETE',
      });
    }

    const overrideRequested =
      body.overrideDoNotRent === true &&
      body.overrideReason !== undefined &&
      body.overrideReason.trim().length >= 3;
    if (overrideRequested) {
      await this.authorization.assertPermission(
        membershipId,
        organizationId,
        PERMISSION_KEYS.LEASES_OVERRIDE_DO_NOT_RENT,
      );
    }

    const partyIds = pre.parties.map((item) => item.partyId);
    const activeDnr = await this.prisma.doNotRentFlag.findMany({
      where: { tenantId: organizationId, partyId: { in: partyIds }, status: 'ACTIVE' },
    });
    if (activeDnr.length > 0 && !overrideRequested) {
      throw new ConflictException({
        message: 'A party has an active do-not-rent flag',
        code: 'DO_NOT_RENT_BLOCKED',
      });
    }

    const effectiveAt = body.effectiveAt !== undefined ? new Date(body.effectiveAt) : new Date();

    try {
      const result = await this.transactions.run(async (tx) => {
        const existingIdem = await tx.idempotencyKey.findFirst({
          where: {
            tenantId: organizationId,
            actorScope,
            operation,
            key: idempotencyKey,
          },
        });
        if (existingIdem !== null && existingIdem.requestHash === requestHash) {
          return {
            replayed: true as const,
            body: existingIdem.responseBody as LeaseResponse,
          };
        }

        // Re-check DNR under the same transaction as the DRAFT→ACTIVE claim.
        const dnrInTx = await tx.doNotRentFlag.findMany({
          where: { tenantId: organizationId, partyId: { in: partyIds }, status: 'ACTIVE' },
        });
        if (dnrInTx.length > 0 && !overrideRequested) {
          throw new ConflictException({
            message: 'A party has an active do-not-rent flag',
            code: 'DO_NOT_RENT_BLOCKED',
          });
        }

        const draftLease = await tx.lease.findFirstOrThrow({
          where: { id: leaseId, tenantId: organizationId, deletedAt: null, status: 'DRAFT' },
          include: this.leaseInclude(),
        });
        await this.revalidateActiveAllocationsInTransaction(tx, organizationId, draftLease);

        const claimed = await tx.lease.updateMany({
          where: {
            id: leaseId,
            tenantId: organizationId,
            deletedAt: null,
            status: 'DRAFT',
            version: expectedVersion,
          },
          data: {
            status: 'ACTIVE',
            leaseNumber: generateLeaseNumber(effectiveAt),
            activatedAt: effectiveAt,
            version: { increment: 1 },
          },
        });

        if (claimed.count === 0) {
          const current = await tx.lease.findFirst({
            where: { id: leaseId, tenantId: organizationId, deletedAt: null },
            include: this.leaseInclude(),
          });
          if (current?.status === 'ACTIVE') {
            const racedIdem = await tx.idempotencyKey.findFirst({
              where: {
                tenantId: organizationId,
                actorScope,
                operation,
                key: idempotencyKey,
              },
            });
            if (racedIdem !== null && racedIdem.requestHash === requestHash) {
              return {
                replayed: true as const,
                body: racedIdem.responseBody as LeaseResponse,
              };
            }
            throw new ConflictException({
              message: 'Lease is not in draft status',
              code: 'LEASE_NOT_DRAFT',
            });
          }
          throwVersionMismatch('Lease version mismatch');
        }

        const currentTerm = await tx.leaseTerm.findFirst({
          where: { leaseId, tenantId: organizationId, isCurrent: true },
        });
        if (currentTerm !== null) {
          await tx.leaseTerm.update({
            where: { id: currentTerm.id },
            data: { lockedAt: effectiveAt },
          });
        }

        await tx.leaseStatusHistory.create({
          data: {
            id: randomUUID(),
            tenantId: organizationId,
            leaseId,
            fromStatus: 'DRAFT',
            toStatus: 'ACTIVE',
            reason: 'Lease activated',
            actorUserId,
            effectiveAt,
            metadata: {
              overrideDoNotRent: body.overrideDoNotRent ?? false,
              overrideReason: body.overrideReason ?? null,
            },
          },
        });

        const refreshed = await tx.lease.findFirstOrThrow({
          where: { id: leaseId, tenantId: organizationId },
          include: this.leaseInclude(),
        });

        await this.deposits.ensureDepositForActivatedLease(
          tx,
          organizationId,
          refreshed,
          correlationId,
        );

        const responseBody = this.toResponse(refreshed);

        await this.outbox.appendInTransaction(tx, {
          aggregateType: 'lease',
          aggregateId: leaseId,
          eventType: LEASE_ACTIVATED_EVENT_TYPE,
          payload: {
            tenantId: organizationId,
            leaseId,
            propertyId: refreshed.propertyId,
            leaseNumber: refreshed.leaseNumber,
            activatedAt: effectiveAt.toISOString(),
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
          action: 'lease.activate',
          outcome: 'SUCCESS',
          targetType: 'lease',
          targetId: leaseId,
          correlationId,
          changeSummary: { leaseNumber: result.body.leaseNumber },
        });
      }

      return result;
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        throw new ConflictException({
          message: 'Lease number conflict; retry activation',
          code: 'LEASE_NUMBER_CONFLICT',
        });
      }
      mapPrismaExclusionError(error);
    }
  }

  async getHistory(
    organizationId: string,
    membershipId: string,
    leaseId: string,
    options?: { limit?: number; after?: string },
  ): Promise<LeaseHistoryCollection> {
    await this.findLease(organizationId, membershipId, leaseId);
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);

    let afterAnchor: { recordedAt: Date; id: string } | null = null;
    if (options?.after !== undefined) {
      afterAnchor = await this.prisma.leaseStatusHistory.findFirst({
        where: { id: options.after, tenantId: organizationId, leaseId },
        select: { recordedAt: true, id: true },
      });
    }

    const events = await this.prisma.leaseStatusHistory.findMany({
      where: {
        tenantId: organizationId,
        leaseId,
        ...(afterAnchor !== null
          ? {
              OR: [
                { recordedAt: { lt: afterAnchor.recordedAt } },
                { recordedAt: afterAnchor.recordedAt, id: { lt: afterAnchor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const pageItems = events.slice(0, limit);
    const hasMore = events.length > limit;
    const last = pageItems.at(-1);

    return {
      data: pageItems.map((event) => ({
        id: event.id,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        reason: event.reason,
        actorUserId: event.actorUserId,
        recordedAt: event.recordedAt.toISOString(),
        effectiveAt: event.effectiveAt.toISOString(),
        metadata: (event.metadata ?? {}) as Record<string, unknown>,
      })),
      page: {
        nextCursor: hasMore && last !== undefined ? last.id : null,
        previousCursor: null,
        limit,
      },
      meta: {},
    };
  }

  private leaseInclude() {
    return {
      terms: { where: { isCurrent: true }, take: 1 },
      parties: { include: { party: true } },
      allocations: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' as const } },
    } satisfies Prisma.LeaseInclude;
  }

  private async findLease(
    organizationId: string,
    membershipId: string,
    leaseId: string,
  ): Promise<LeaseRecord> {
    const lease = await this.prisma.lease.findFirst({
      where: { id: leaseId, tenantId: organizationId, deletedAt: null },
      include: this.leaseInclude(),
    });
    if (lease === null) {
      throw new NotFoundException({
        message: 'Lease not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    await this.authorization.assertPropertyAccess(membershipId, organizationId, lease.propertyId);

    return lease;
  }

  private async assertPartiesValid(organizationId: string, partyIds: string[]): Promise<void> {
    const parties = await this.prisma.party.findMany({
      where: {
        id: { in: partyIds },
        tenantId: organizationId,
        deletedAt: null,
        residentProfile: { isNot: null },
      },
    });
    if (parties.length !== partyIds.length) {
      throw new NotFoundException({
        message: 'Resident party not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
  }

  private allocationEffectiveRange(
    allocation: LeaseAllocationWrite,
    startDate: Date,
    endDate: Date | null,
  ): { effectiveFrom: Date; effectiveTo: Date | null } {
    const effectiveFrom =
      allocation.effectiveFrom !== undefined
        ? new Date(allocation.effectiveFrom)
        : new Date(startDate.toISOString());
    let effectiveTo: Date | null;
    if (allocation.effectiveTo !== undefined) {
      effectiveTo = allocation.effectiveTo === null ? null : new Date(allocation.effectiveTo);
    } else if (endDate !== null) {
      effectiveTo = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
    } else {
      effectiveTo = null;
    }
    return { effectiveFrom, effectiveTo };
  }

  private async syncAllocationWindowsInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      leaseId: string;
      propertyId: string;
      startDate: Date;
      endDate: Date | null;
    },
  ): Promise<void> {
    const active = await tx.leaseAllocation.findMany({
      where: {
        tenantId: input.organizationId,
        leaseId: input.leaseId,
        status: 'ACTIVE',
      },
    });

    for (const row of active) {
      const write: LeaseAllocationWrite = {
        unitId: row.unitId,
        allocationType: row.allocationType as LeaseAllocationWrite['allocationType'],
        ...(row.bedId !== null ? { bedId: row.bedId } : {}),
        ...(row.allocationType === 'CAPACITY' ? { capacityQuantity: row.capacityQuantity } : {}),
      };
      const { effectiveFrom, effectiveTo } = this.allocationEffectiveRange(
        write,
        input.startDate,
        input.endDate,
      );

      await tx.$queryRaw`
        SELECT id FROM units
        WHERE id = ${row.unitId}::uuid AND tenant_id = ${input.organizationId}::uuid
        FOR UPDATE
      `;

      await this.assertMixedUnitConflicts(tx, {
        organizationId: input.organizationId,
        unitId: row.unitId,
        leaseId: input.leaseId,
        allocationType: write.allocationType,
        effectiveFrom,
        effectiveTo,
      });

      if (write.allocationType === 'CAPACITY') {
        const unit = await tx.unit.findFirst({
          where: {
            id: row.unitId,
            tenantId: input.organizationId,
            propertyId: input.propertyId,
            deletedAt: null,
          },
        });
        if (unit === null) {
          throw new NotFoundException({
            message: 'Unit not found',
            code: 'RESOURCE_NOT_FOUND',
          });
        }
        await this.assertCapacityAvailable(tx, {
          organizationId: input.organizationId,
          unitId: unit.id,
          leaseId: input.leaseId,
          capacity: unit.capacity,
          requestedQty: write.capacityQuantity ?? row.capacityQuantity,
          effectiveFrom,
          effectiveTo,
        });
      }

      try {
        await tx.leaseAllocation.update({
          where: { id: row.id },
          data: { effectiveFrom, effectiveTo },
        });
      } catch (error) {
        mapPrismaExclusionError(error, { capacity: write.allocationType === 'CAPACITY' });
      }
    }
  }

  private async revalidateActiveAllocationsInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    lease: LeaseRecord,
  ): Promise<void> {
    for (const row of lease.allocations) {
      if (row.status !== 'ACTIVE') {
        continue;
      }

      await tx.$queryRaw`
        SELECT id FROM units
        WHERE id = ${row.unitId}::uuid AND tenant_id = ${organizationId}::uuid
        FOR UPDATE
      `;

      await this.assertMixedUnitConflicts(tx, {
        organizationId,
        unitId: row.unitId,
        leaseId: lease.id,
        allocationType: row.allocationType as LeaseAllocationWrite['allocationType'],
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo,
      });

      if (row.allocationType === 'CAPACITY') {
        const unit = await tx.unit.findFirst({
          where: {
            id: row.unitId,
            tenantId: organizationId,
            propertyId: lease.propertyId,
            deletedAt: null,
          },
        });
        if (unit === null) {
          throw new NotFoundException({
            message: 'Unit not found',
            code: 'RESOURCE_NOT_FOUND',
          });
        }
        await this.assertCapacityAvailable(tx, {
          organizationId,
          unitId: unit.id,
          leaseId: lease.id,
          capacity: unit.capacity,
          requestedQty: row.capacityQuantity,
          effectiveFrom: row.effectiveFrom,
          effectiveTo: row.effectiveTo,
        });
      }
    }
  }

  private async assertCapacityAvailable(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      unitId: string;
      leaseId: string;
      capacity: number;
      requestedQty: number;
      effectiveFrom: Date;
      effectiveTo: Date | null;
    },
  ): Promise<void> {
    const overlapping = await tx.leaseAllocation.findMany({
      where: {
        tenantId: input.organizationId,
        unitId: input.unitId,
        status: 'ACTIVE',
        allocationType: 'CAPACITY',
        leaseId: { not: input.leaseId },
      },
    });

    let used = 0;
    for (const row of overlapping) {
      if (
        rangesOverlap(input.effectiveFrom, input.effectiveTo, row.effectiveFrom, row.effectiveTo)
      ) {
        used += row.capacityQuantity;
      }
    }
    if (used + input.requestedQty > input.capacity) {
      mapPrismaExclusionError(new Error('capacity'), { capacity: true });
    }
  }

  private async applyAllocationInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      lease: Lease;
      allocation: LeaseAllocationWrite;
      startDate: Date;
      endDate: Date | null;
    },
  ): Promise<void> {
    const { organizationId, lease, allocation, startDate, endDate } = input;

    const unit = await tx.unit.findFirst({
      where: {
        id: allocation.unitId,
        tenantId: organizationId,
        propertyId: lease.propertyId,
        deletedAt: null,
      },
    });
    if (unit === null) {
      throw new NotFoundException({
        message: 'Unit not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    assertAllocationModeMatch(unit.allocationMode, allocation.allocationType);

    if (allocation.allocationType === 'BED') {
      const bed = await tx.bed.findFirst({
        where: {
          id: allocation.bedId,
          tenantId: organizationId,
          unitId: unit.id,
          deletedAt: null,
        },
      });
      if (bed === null) {
        throw new NotFoundException({
          message: 'Bed not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }
    }

    const { effectiveFrom, effectiveTo } = this.allocationEffectiveRange(
      allocation,
      startDate,
      endDate,
    );

    // Lock unit before mixed / capacity checks so concurrent writers serialize.
    await tx.$queryRaw`
      SELECT id FROM units
      WHERE id = ${unit.id}::uuid AND tenant_id = ${organizationId}::uuid
      FOR UPDATE
    `;

    await tx.leaseAllocation.updateMany({
      where: { tenantId: organizationId, leaseId: lease.id, status: 'ACTIVE' },
      data: { status: 'CANCELLED' },
    });

    await this.assertMixedUnitConflicts(tx, {
      organizationId,
      unitId: unit.id,
      leaseId: lease.id,
      allocationType: allocation.allocationType,
      effectiveFrom,
      effectiveTo,
    });

    if (allocation.allocationType === 'CAPACITY') {
      await this.assertCapacityAvailable(tx, {
        organizationId,
        unitId: unit.id,
        leaseId: lease.id,
        capacity: unit.capacity,
        requestedQty: allocation.capacityQuantity ?? 1,
        effectiveFrom,
        effectiveTo,
      });
    }

    try {
      await tx.leaseAllocation.create({
        data: {
          id: randomUUID(),
          tenantId: organizationId,
          leaseId: lease.id,
          unitId: unit.id,
          bedId: allocation.allocationType === 'BED' ? allocation.bedId! : null,
          allocationType: allocation.allocationType,
          capacityQuantity:
            allocation.allocationType === 'CAPACITY' ? (allocation.capacityQuantity ?? 1) : 1,
          status: 'ACTIVE',
          effectiveFrom,
          effectiveTo,
        },
      });
    } catch (error) {
      mapPrismaExclusionError(error, {
        capacity: allocation.allocationType === 'CAPACITY',
      });
    }
  }

  private async assertMixedUnitConflicts(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      unitId: string;
      leaseId: string;
      allocationType: LeaseAllocationWrite['allocationType'];
      effectiveFrom: Date;
      effectiveTo: Date | null;
    },
  ): Promise<void> {
    const others = await tx.leaseAllocation.findMany({
      where: {
        tenantId: input.organizationId,
        unitId: input.unitId,
        status: 'ACTIVE',
        leaseId: { not: input.leaseId },
      },
    });

    for (const row of others) {
      if (
        !rangesOverlap(input.effectiveFrom, input.effectiveTo, row.effectiveFrom, row.effectiveTo)
      ) {
        continue;
      }
      if (input.allocationType === 'WHOLE_UNIT' || row.allocationType === 'WHOLE_UNIT') {
        mapPrismaExclusionError(new Error('mixed whole unit'));
      }
    }
  }

  private async buildReview(
    organizationId: string,
    lease: LeaseRecord,
  ): Promise<LeaseReviewResponse> {
    const issues: LeaseReviewResponse['issues'] = [];
    const property = await this.prisma.property.findFirst({
      where: { id: lease.propertyId, tenantId: organizationId },
    });

    const primaries = lease.parties.filter(
      (party) => party.isPrimary || party.role === 'PRIMARY_LEASEHOLDER',
    );
    if (primaries.length < 1) {
      issues.push({
        code: 'PRIMARY_LEASEHOLDER_MISSING',
        message: 'At least one primary leaseholder is required',
        severity: 'ERROR',
      });
    }

    if (lease.allocations.length < 1) {
      issues.push({
        code: 'ALLOCATION_MISSING',
        message: 'An active allocation is required before activation',
        severity: 'ERROR',
      });
    }

    if (lease.endDate !== null && lease.endDate <= lease.startDate) {
      issues.push({
        code: 'LEASE_DATE_INVALID',
        message: 'endDate must be after startDate',
        severity: 'ERROR',
      });
    }

    if (property !== null && property.defaultCurrency !== lease.currency) {
      issues.push({
        code: 'CURRENCY_MISMATCH',
        message: 'Lease currency must match property default currency',
        severity: 'ERROR',
      });
    }

    const currentTerm = lease.terms.find((term) => term.isCurrent);
    const partyIds = lease.parties.map((item) => item.partyId);
    const dnrFlags = await this.prisma.doNotRentFlag.findMany({
      where: { tenantId: organizationId, partyId: { in: partyIds }, status: 'ACTIVE' },
    });
    if (dnrFlags.length > 0) {
      issues.push({
        code: 'DO_NOT_RENT_ACTIVE',
        message:
          'One or more parties have an active do-not-rent flag; override is required at activation',
        severity: 'ERROR',
      });
    }

    // ready=false when any ERROR (including DNR). Activate still allows DNR when
    // overrideDoNotRent + leases.override_do_not_rent are satisfied.
    const ready = !issues.some((issue) => issue.severity === 'ERROR');

    return {
      leaseId: lease.id,
      version: lease.version,
      ready,
      issues,
      summary: {
        status: lease.status,
        propertyId: lease.propertyId,
        currency: lease.currency,
        rentAmount: currentTerm !== undefined ? decimalToString(currentTerm.rentAmount) : null,
        depositAmount:
          currentTerm !== undefined ? decimalToString(currentTerm.depositAmount) : null,
        startDate: formatDateOnly(lease.startDate),
        endDate: lease.endDate !== null ? formatDateOnly(lease.endDate) : null,
        primaryPartyIds: primaries.map((item) => item.partyId),
        allocationCount: lease.allocations.length,
      },
    };
  }

  private toResponse(lease: LeaseRecord): LeaseResponse {
    const currentTerm = lease.terms.find((term) => term.isCurrent) ?? null;
    const occupancyState = lease.occupancyState ?? 'NOT_MOVED_IN';
    return {
      id: lease.id,
      organizationId: lease.tenantId,
      propertyId: lease.propertyId,
      leaseNumber: lease.leaseNumber,
      status: lease.status,
      occupancyState,
      moveOutStatus: lease.moveOutStatus ?? 'NONE',
      currency: lease.currency,
      startDate: formatDateOnly(lease.startDate),
      endDate: lease.endDate !== null ? formatDateOnly(lease.endDate) : null,
      activatedAt: lease.activatedAt?.toISOString() ?? null,
      movedInAt: lease.movedInAt?.toISOString() ?? null,
      movedOutAt: lease.movedOutAt?.toISOString() ?? null,
      noticeDate:
        lease.noticeDate !== null && lease.noticeDate !== undefined
          ? formatDateOnly(lease.noticeDate)
          : null,
      noticeEffectiveEnd:
        lease.noticeEffectiveEnd !== null && lease.noticeEffectiveEnd !== undefined
          ? formatDateOnly(lease.noticeEffectiveEnd)
          : null,
      terminationReason: lease.terminationReason ?? null,
      terminatedAt: lease.terminatedAt?.toISOString() ?? null,
      renewedFromLeaseId: lease.renewedFromLeaseId ?? null,
      holdoverFlag: lease.holdoverFlag ?? false,
      notes: lease.notes,
      version: lease.version,
      occupancyNote: occupancyNoteForState(occupancyState),
      depositDispositionNote: LEASE_DEPOSIT_DISPOSITION_NOTE,
      terms:
        currentTerm === null
          ? null
          : {
              id: currentTerm.id,
              versionNumber: currentTerm.versionNumber,
              isCurrent: currentTerm.isCurrent,
              currency: currentTerm.currency,
              rentAmount: decimalToString(currentTerm.rentAmount),
              depositAmount: decimalToString(currentTerm.depositAmount),
              rentCadence: currentTerm.rentCadence,
              effectiveFrom: formatDateOnly(currentTerm.effectiveFrom),
              effectiveTo:
                currentTerm.effectiveTo !== null ? formatDateOnly(currentTerm.effectiveTo) : null,
              recurringCharges: (currentTerm.recurringCharges ?? []) as RecurringChargeInput[],
              lockedAt: currentTerm.lockedAt?.toISOString() ?? null,
            },
      parties: lease.parties.map((party) => ({
        id: party.id,
        partyId: party.partyId,
        displayName: party.party.displayName,
        role: party.role,
        isPrimary: party.isPrimary,
        effectiveFrom: formatDateOnly(party.effectiveFrom),
        effectiveTo: party.effectiveTo !== null ? formatDateOnly(party.effectiveTo) : null,
      })),
      allocations: lease.allocations.map((row) => ({
        id: row.id,
        unitId: row.unitId,
        bedId: row.bedId,
        allocationType: row.allocationType,
        capacityQuantity: row.capacityQuantity,
        status: row.status,
        effectiveFrom: row.effectiveFrom.toISOString(),
        effectiveTo: row.effectiveTo?.toISOString() ?? null,
      })),
      createdAt: lease.createdAt.toISOString(),
      updatedAt: lease.updatedAt.toISOString(),
    };
  }

  /** Shared by lifecycle service for response mapping after mutations. */
  toLeaseResponse(lease: LeaseRecord): LeaseResponse {
    return this.toResponse(lease);
  }

  async requireLease(
    organizationId: string,
    membershipId: string,
    leaseId: string,
  ): Promise<LeaseRecord> {
    return this.findLease(organizationId, membershipId, leaseId);
  }

  async applyAllocationForLifecycle(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      lease: Lease;
      allocation: LeaseAllocationWrite;
      startDate: Date;
      endDate: Date | null;
    },
  ): Promise<void> {
    return this.applyAllocationInTransaction(tx, input);
  }
}
