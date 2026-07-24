import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  UTILITIES_ALLOCATION_ENABLED,
  type UtilityAllocationCommitRequest,
  type UtilityAllocationPreviewRequest,
  type UtilityAllocationRunResponse,
} from '@rpm/contracts';

import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';
import { AuthorizationService } from '../../tenancy/application/authorization.service';
import {
  assertPeriodKey,
  billingAdvisoryLockKey,
  decimalToString,
  periodBounds,
  roundMoney,
  utilityChargeKey,
} from '../domain/billing.rules';

import { InvoiceService } from './invoice.service';

@Injectable()
export class UtilityAllocationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(InvoiceService) private readonly invoices: InvoiceService,
  ) {}

  async preview(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    body: UtilityAllocationPreviewRequest,
    correlationId?: string,
  ): Promise<UtilityAllocationRunResponse & { allocations: Array<Record<string, unknown>> }> {
    this.assertEnabled();
    await this.authorization.assertPermission(membershipId, organizationId, 'utilities.allocate');
    await this.authorization.assertPropertyAccess(membershipId, organizationId, body.propertyId);
    assertPeriodKey(body.servicePeriod);

    const tariff = await this.prisma.tariff.findFirst({
      where: {
        id: body.tariffId,
        tenantId: organizationId,
        propertyId: body.propertyId,
        active: true,
      },
    });
    if (tariff === null) {
      throw new NotFoundException({ message: 'Tariff not found', code: 'TARIFF_NOT_FOUND' });
    }

    const occupiedLeases = await this.prisma.lease.findMany({
      where: {
        tenantId: organizationId,
        propertyId: body.propertyId,
        deletedAt: null,
        status: { in: ['ACTIVE', 'NOTICE'] },
        occupancyState: 'OCCUPIED',
      },
      include: { parties: true, terms: { where: { isCurrent: true } } },
    });

    const shareCount = Math.max(occupiedLeases.length, 1);
    // MVP equal-split: fixedCharge + rate * 1 unit placeholder consumption when no readings.
    const total = roundMoney(tariff.fixedCharge.plus(tariff.ratePerUnit));
    const perLease = roundMoney(total.div(shareCount));

    const allocations = occupiedLeases.map((lease) => ({
      leaseId: lease.id,
      propertyId: body.propertyId,
      amount: decimalToString(perLease),
      currency: tariff.currency,
      method: body.method,
    }));

    const run = await this.prisma.utilityAllocationRun.create({
      data: {
        tenantId: organizationId,
        propertyId: body.propertyId,
        periodKey: body.servicePeriod,
        status: 'PREVIEWED',
        methodVersion: 'equal_split_v1',
        previewPayload: {
          utilityType: body.utilityType,
          method: body.method,
          tariffId: body.tariffId,
          allocations,
          totalAllocatedAmount: decimalToString(roundMoney(perLease.mul(occupiedLeases.length))),
        },
        totalsAmount: roundMoney(perLease.mul(occupiedLeases.length)),
        currency: tariff.currency,
      },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'utility_allocation.preview',
      outcome: 'SUCCESS',
      targetType: 'utility_allocation_run',
      targetId: run.id,
      correlationId,
    });

    return {
      ...this.toResponse(run, body),
      allocations,
    };
  }

  async commit(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    runId: string,
    _body: UtilityAllocationCommitRequest,
    correlationId?: string,
  ): Promise<UtilityAllocationRunResponse> {
    this.assertEnabled();
    await this.authorization.assertPermission(membershipId, organizationId, 'utilities.allocate');

    const result = await this.transactions.run(async (tx) => {
      this.assertEnabled();

      const run = await tx.utilityAllocationRun.findFirst({
        where: { id: runId, tenantId: organizationId },
      });
      if (run === null) {
        throw new NotFoundException({
          message: 'Utility allocation run not found',
          code: 'UTILITY_ALLOCATION_NOT_FOUND',
        });
      }
      await this.authorization.assertPropertyAccess(membershipId, organizationId, run.propertyId);
      if (run.status === 'COMMITTED') {
        return run;
      }
      if (run.status !== 'PREVIEWED') {
        throw new ConflictException({
          message: 'Utility allocation run must be previewed',
          code: 'UTILITY_ALLOCATION_NOT_PREVIEWED',
        });
      }

      const lockKey = billingAdvisoryLockKey(organizationId, run.periodKey);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const payload = run.previewPayload;
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new ConflictException({
          message: 'Missing allocation preview payload',
          code: 'UTILITY_ALLOCATION_EMPTY',
        });
      }
      const record = payload as Record<string, unknown>;
      const allocations = Array.isArray(record.allocations) ? record.allocations : [];
      const utilityType =
        typeof record.utilityType === 'string' ? record.utilityType : 'ELECTRICITY';
      const method = typeof record.method === 'string' ? record.method : 'EQUAL_SHARE';
      const bounds = periodBounds(run.periodKey, 'UTC');
      const postedAt = new Date();

      for (const item of allocations) {
        if (item === null || typeof item !== 'object') {
          continue;
        }
        const alloc = item as Record<string, unknown>;
        const leaseId = typeof alloc.leaseId === 'string' ? alloc.leaseId : null;
        const amountStr = typeof alloc.amount === 'string' ? alloc.amount : null;
        const currency = typeof alloc.currency === 'string' ? alloc.currency : run.currency;
        if (leaseId === null || amountStr === null || currency === null) {
          continue;
        }

        const lease = await tx.lease.findFirst({
          where: { id: leaseId, tenantId: organizationId, deletedAt: null },
          include: { parties: true },
        });
        if (lease === null) {
          continue;
        }
        const billTo =
          lease.parties.find((party) => party.isPrimary || party.role === 'PRIMARY_LEASEHOLDER') ??
          lease.parties[0];
        if (billTo === undefined) {
          continue;
        }

        const amount = roundMoney(new Prisma.Decimal(amountStr));
        const chargeKey = utilityChargeKey(leaseId, run.periodKey, utilityType);
        const existing = await tx.invoiceLine.findFirst({
          where: {
            tenantId: organizationId,
            chargeKey,
            invoice: { leaseId, tenantId: organizationId, status: { in: ['POSTED', 'DRAFT'] } },
          },
        });
        if (existing !== null) {
          continue;
        }

        const invoiceId = randomUUID();
        await tx.invoice.create({
          data: {
            id: invoiceId,
            tenantId: organizationId,
            leaseId,
            propertyId: lease.propertyId,
            billToPartyId: billTo.partyId,
            status: 'DRAFT',
            currency,
            periodKey: run.periodKey,
            subtotalAmount: amount,
            taxAmount: new Prisma.Decimal(0),
            totalAmount: amount,
            balanceAmount: amount,
            notes: `Utility allocation ${method}`,
            lines: {
              create: {
                id: randomUUID(),
                tenantId: organizationId,
                lineNumber: 1,
                description: `Utility allocation (${utilityType}) ${run.periodKey}`,
                chargeKey,
                periodKey: run.periodKey,
                quantity: new Prisma.Decimal(1),
                unitPrice: amount,
                taxAmount: new Prisma.Decimal(0),
                lineTotal: amount,
                currency,
                servicePeriodStart: bounds.start,
                servicePeriodEnd: bounds.end,
                sourceType: 'UTILITY_ALLOCATION',
                sourceId: run.id,
              },
            },
          },
        });

        await this.invoices.postDraftInvoiceInTransaction(
          tx,
          organizationId,
          invoiceId,
          actorUserId,
          postedAt,
        );
      }

      return tx.utilityAllocationRun.update({
        where: { id: run.id },
        data: { status: 'COMMITTED', committedAt: postedAt },
      });
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'utility_allocation.commit',
      outcome: 'SUCCESS',
      targetType: 'utility_allocation_run',
      targetId: runId,
      correlationId,
    });

    const preview = result.previewPayload;
    const method =
      preview !== null &&
      typeof preview === 'object' &&
      !Array.isArray(preview) &&
      typeof (preview as Record<string, unknown>).method === 'string'
        ? String((preview as Record<string, unknown>).method)
        : 'EQUAL_SHARE';
    const utilityType =
      preview !== null &&
      typeof preview === 'object' &&
      !Array.isArray(preview) &&
      typeof (preview as Record<string, unknown>).utilityType === 'string'
        ? String((preview as Record<string, unknown>).utilityType)
        : 'ELECTRICITY';
    const tariffId =
      preview !== null &&
      typeof preview === 'object' &&
      !Array.isArray(preview) &&
      typeof (preview as Record<string, unknown>).tariffId === 'string'
        ? String((preview as Record<string, unknown>).tariffId)
        : '00000000-0000-4000-8000-000000000000';

    return this.toResponse(result, {
      utilityType: utilityType as UtilityAllocationPreviewRequest['utilityType'],
      method: method as UtilityAllocationPreviewRequest['method'],
      tariffId,
      propertyId: result.propertyId,
      servicePeriod: result.periodKey,
    });
  }

  async getRun(
    organizationId: string,
    membershipId: string,
    runId: string,
  ): Promise<UtilityAllocationRunResponse> {
    await this.authorization.assertPermission(membershipId, organizationId, 'utilities.usage.view');
    const run = await this.prisma.utilityAllocationRun.findFirst({
      where: { id: runId, tenantId: organizationId },
    });
    if (run === null) {
      throw new NotFoundException({
        message: 'Utility allocation run not found',
        code: 'UTILITY_ALLOCATION_NOT_FOUND',
      });
    }
    await this.authorization.assertPropertyAccess(membershipId, organizationId, run.propertyId);
    const preview = run.previewPayload;
    return this.toResponse(run, {
      utilityType:
        preview !== null &&
        typeof preview === 'object' &&
        !Array.isArray(preview) &&
        typeof (preview as Record<string, unknown>).utilityType === 'string'
          ? ((preview as Record<string, unknown>)
              .utilityType as UtilityAllocationPreviewRequest['utilityType'])
          : 'ELECTRICITY',
      method:
        preview !== null &&
        typeof preview === 'object' &&
        !Array.isArray(preview) &&
        typeof (preview as Record<string, unknown>).method === 'string'
          ? ((preview as Record<string, unknown>)
              .method as UtilityAllocationPreviewRequest['method'])
          : 'EQUAL_SHARE',
      tariffId:
        preview !== null &&
        typeof preview === 'object' &&
        !Array.isArray(preview) &&
        typeof (preview as Record<string, unknown>).tariffId === 'string'
          ? String((preview as Record<string, unknown>).tariffId)
          : '00000000-0000-4000-8000-000000000000',
      propertyId: run.propertyId,
      servicePeriod: run.periodKey,
    });
  }

  private assertEnabled(): void {
    if (!UTILITIES_ALLOCATION_ENABLED) {
      throw new ServiceUnavailableException({
        message: 'Utility allocation is disabled',
        code: 'UTILITIES_ALLOCATION_DISABLED',
      });
    }
  }

  private toResponse(
    run: {
      id: string;
      tenantId: string;
      propertyId: string;
      periodKey: string;
      status: UtilityAllocationRunResponse['status'];
      currency: string | null;
      totalsAmount: Prisma.Decimal | null;
      createdAt: Date;
      updatedAt: Date;
      committedAt: Date | null;
    },
    meta: {
      utilityType: UtilityAllocationPreviewRequest['utilityType'];
      method: UtilityAllocationPreviewRequest['method'];
      tariffId: string;
      propertyId: string;
      servicePeriod: string;
    },
  ): UtilityAllocationRunResponse {
    return {
      id: run.id,
      organizationId: run.tenantId,
      propertyId: meta.propertyId,
      utilityType: meta.utilityType,
      servicePeriod: meta.servicePeriod,
      method: meta.method,
      tariffId: meta.tariffId,
      status: run.status,
      currency: run.currency ?? 'USD',
      totalAllocatedAmount:
        run.totalsAmount !== null ? decimalToString(run.totalsAmount) : '0.0000',
      operationId: null,
      asOf: (run.committedAt ?? run.updatedAt).toISOString(),
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    };
  }
}
