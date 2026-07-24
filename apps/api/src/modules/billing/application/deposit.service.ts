import { randomUUID } from 'node:crypto';

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Lease, type LeaseParty, type LeaseTerm } from '@prisma/client';

import {
  DEPOSIT_RECORDED_EVENT_TYPE,
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  type DepositsCollection,
  type SecurityDepositResponse,
} from '@rpm/contracts';

import { OutboxService } from '../../../infrastructure/outbox/outbox.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuthorizationService } from '../../tenancy/application/authorization.service';
import { decimalToString, roundMoney } from '../domain/billing.rules';

type LeaseForDeposit = Lease & {
  terms?: LeaseTerm[];
  parties?: LeaseParty[];
};

@Injectable()
export class DepositService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
  ) {}

  async listDeposits(
    organizationId: string,
    membershipId: string,
    options?: { limit?: number; after?: string; leaseId?: string; propertyId?: string },
  ): Promise<DepositsCollection> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.deposits.view',
    );
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

    const rows = await this.prisma.securityDeposit.findMany({
      where: {
        tenantId: organizationId,
        ...(options?.leaseId !== undefined ? { leaseId: options.leaseId } : {}),
        lease: { deletedAt: null, ...propertyScope },
      },
      include: { lease: { select: { propertyId: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(options?.after !== undefined
        ? {
            cursor: { id: options.after },
            skip: 1,
          }
        : {}),
    });

    const page = rows.slice(0, limit);
    const last = page.at(-1);

    return {
      data: page.map((row) => this.toResponse(row, row.lease.propertyId)),
      page: {
        nextCursor: rows.length > limit && last !== undefined ? last.id : null,
        previousCursor: null,
        limit,
      },
      meta: {},
    };
  }

  async getDeposit(
    organizationId: string,
    membershipId: string,
    depositId: string,
  ): Promise<SecurityDepositResponse> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.deposits.view',
    );
    const row = await this.prisma.securityDeposit.findFirst({
      where: { id: depositId, tenantId: organizationId },
      include: { lease: { select: { propertyId: true, deletedAt: true } } },
    });
    if (row === null || row.lease.deletedAt !== null) {
      throw new NotFoundException({ message: 'Deposit not found', code: 'DEPOSIT_NOT_FOUND' });
    }
    await this.authorization.assertPropertyAccess(
      membershipId,
      organizationId,
      row.lease.propertyId,
    );
    return this.toResponse(row, row.lease.propertyId);
  }

  /**
   * Upserts security_deposits + default billing schedule/RENT rule inside an existing TX.
   * Emits DEPOSIT_RECORDED_EVENT_TYPE only when a deposit row is newly created.
   */
  async ensureDepositForActivatedLease(
    tx: Prisma.TransactionClient,
    organizationId: string,
    lease: LeaseForDeposit,
    correlationId?: string,
  ): Promise<{ depositCreated: boolean; depositId: string | null }> {
    const currentTerm =
      lease.terms?.find((term) => term.isCurrent) ??
      (await tx.leaseTerm.findFirst({
        where: { tenantId: organizationId, leaseId: lease.id, isCurrent: true },
      }));

    const parties =
      lease.parties ??
      (await tx.leaseParty.findMany({
        where: { tenantId: organizationId, leaseId: lease.id },
      }));

    const payer =
      parties.find((party) => party.isPrimary || party.role === 'PRIMARY_LEASEHOLDER') ??
      parties[0];

    if (currentTerm === null || payer === undefined) {
      await this.ensureBillingScheduleForLease(tx, organizationId, lease);
      return { depositCreated: false, depositId: null };
    }

    const amountDue = roundMoney(currentTerm.depositAmount);
    const existing = await tx.securityDeposit.findFirst({
      where: { tenantId: organizationId, leaseId: lease.id },
    });

    let depositId: string;
    let depositCreated = false;

    if (existing === null) {
      depositId = randomUUID();
      await tx.securityDeposit.create({
        data: {
          id: depositId,
          tenantId: organizationId,
          leaseId: lease.id,
          payerPartyId: payer.partyId,
          currency: currentTerm.currency,
          amountDue,
          amountHeld: new Prisma.Decimal(0),
          status: 'DUE',
        },
      });
      depositCreated = true;

      await this.outbox.appendInTransaction(tx, {
        aggregateType: 'security_deposit',
        aggregateId: depositId,
        eventType: DEPOSIT_RECORDED_EVENT_TYPE,
        payload: {
          tenantId: organizationId,
          depositId,
          leaseId: lease.id,
          propertyId: lease.propertyId,
          requiredAmount: decimalToString(amountDue),
          currency: currentTerm.currency,
        },
        correlationId,
        tenantId: organizationId,
      });
    } else {
      depositId = existing.id;
      if (existing.status === 'DUE') {
        await tx.securityDeposit.update({
          where: { id: existing.id },
          data: {
            amountDue,
            currency: currentTerm.currency,
            payerPartyId: payer.partyId,
            version: { increment: 1 },
          },
        });
      }
    }

    await this.ensureBillingScheduleForLease(tx, organizationId, lease, currentTerm);
    return { depositCreated, depositId };
  }

  /** Alias used by billing-run preview/create when lease already active. */
  async ensureDepositForLease(
    tx: Prisma.TransactionClient,
    organizationId: string,
    lease: LeaseForDeposit,
  ): Promise<void> {
    await this.ensureDepositForActivatedLease(tx, organizationId, lease);
  }

  async ensureBillingScheduleForLease(
    tx: Prisma.TransactionClient,
    organizationId: string,
    lease: LeaseForDeposit,
    currentTerm?: LeaseTerm | null,
  ): Promise<{ scheduleId: string }> {
    const term =
      currentTerm ??
      lease.terms?.find((item) => item.isCurrent) ??
      (await tx.leaseTerm.findFirst({
        where: { tenantId: organizationId, leaseId: lease.id, isCurrent: true },
      }));

    const property = await tx.property.findFirstOrThrow({
      where: { id: lease.propertyId, tenantId: organizationId },
      select: { timeZone: true },
    });

    const existing = await tx.billingSchedule.findFirst({
      where: { tenantId: organizationId, leaseId: lease.id, status: 'ACTIVE' },
    });

    let scheduleId: string;
    if (existing === null) {
      scheduleId = randomUUID();
      await tx.billingSchedule.create({
        data: {
          id: scheduleId,
          tenantId: organizationId,
          leaseId: lease.id,
          propertyId: lease.propertyId,
          name: 'Default rent schedule',
          cadence: term?.rentCadence ?? 'MONTHLY',
          timeZone: property.timeZone,
          status: 'ACTIVE',
          effectiveFrom: lease.startDate,
          effectiveTo: lease.endDate,
        },
      });
    } else {
      scheduleId = existing.id;
    }

    if (term !== null && term !== undefined) {
      const rentRule = await tx.chargeRule.findFirst({
        where: {
          tenantId: organizationId,
          scheduleId,
          chargeKey: 'rent',
          active: true,
        },
      });
      if (rentRule === null) {
        await tx.chargeRule.create({
          data: {
            tenantId: organizationId,
            scheduleId,
            ruleType: 'RENT',
            chargeKey: 'rent',
            description: 'Monthly rent',
            amount: roundMoney(term.rentAmount),
            currency: term.currency,
            active: true,
            versionNumber: 1,
          },
        });
      }
    }

    return { scheduleId };
  }

  private toResponse(
    row: {
      id: string;
      tenantId: string;
      leaseId: string;
      payerPartyId: string;
      status: SecurityDepositResponse['status'];
      currency: string;
      amountDue: Prisma.Decimal;
      amountHeld: Prisma.Decimal;
      createdAt: Date;
      updatedAt: Date;
    },
    propertyId: string,
  ): SecurityDepositResponse {
    return {
      id: row.id,
      organizationId: row.tenantId,
      leaseId: row.leaseId,
      propertyId,
      payerPartyId: row.payerPartyId,
      status: row.status,
      currency: row.currency,
      requiredAmount: decimalToString(row.amountDue),
      heldAmount: decimalToString(row.amountHeld),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
