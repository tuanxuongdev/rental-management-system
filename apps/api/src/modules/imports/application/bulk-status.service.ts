import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type InventoryOperationalStatus, type InventoryHistoryTargetType } from '@prisma/client';

import { type BulkUnitStatusRequest, type BulkUnitStatusResponse } from '@rpm/contracts';

import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';
import { AuthorizationService } from '../../tenancy/application/authorization.service';

@Injectable()
export class BulkStatusService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async previewOrCommit(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    body: BulkUnitStatusRequest,
    correlationId?: string,
  ): Promise<BulkUnitStatusResponse> {
    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );

    const units = await this.prisma.unit.findMany({
      where: {
        tenantId: organizationId,
        id: { in: body.unitIds },
        deletedAt: null,
      },
      select: {
        id: true,
        propertyId: true,
        operationalStatus: true,
        status: true,
      },
    });

    const foundIds = new Set(units.map((unit) => unit.id));
    const eligibleUnitIds: string[] = [];
    const exclusions: BulkUnitStatusResponse['exclusions'] = [];

    for (const unitId of body.unitIds) {
      if (!foundIds.has(unitId)) {
        exclusions.push({
          unitId,
          reason: 'Unit not found in organization',
          code: 'NOT_FOUND',
        });
        continue;
      }

      const unit = units.find((item) => item.id === unitId)!;
      if (accessible !== null && !accessible.includes(unit.propertyId)) {
        // Non-disclosure: same code as missing (matches property access style).
        exclusions.push({
          unitId,
          reason: 'Unit not found in organization',
          code: 'NOT_FOUND',
        });
        continue;
      }

      if (unit.status === 'ARCHIVED') {
        exclusions.push({
          unitId,
          reason: 'Archived units cannot change operational status',
          code: 'LIFECYCLE_EXCLUDED',
        });
        continue;
      }

      eligibleUnitIds.push(unitId);
    }

    if (body.mode === 'PREVIEW') {
      return {
        mode: 'PREVIEW',
        status: body.status,
        eligibleUnitIds,
        exclusions,
        updatedCount: 0,
      };
    }

    if (eligibleUnitIds.length === 0) {
      return {
        mode: 'COMMIT',
        status: body.status,
        eligibleUnitIds,
        exclusions,
        updatedCount: 0,
      };
    }

    const eligible = units.filter((unit) => eligibleUnitIds.includes(unit.id));

    await this.transactions.run(async (tx) => {
      for (const unit of eligible) {
        await tx.unit.update({
          where: { id: unit.id },
          data: {
            operationalStatus: body.status as InventoryOperationalStatus,
            version: { increment: 1 },
          },
        });
        await tx.inventoryStatusHistory.create({
          data: {
            tenantId: organizationId,
            targetType: 'UNIT' as InventoryHistoryTargetType,
            propertyId: unit.propertyId,
            unitId: unit.id,
            status: body.status,
            actorUserId,
            reason: body.reason,
            effectiveFrom:
              body.effectiveFrom !== undefined ? new Date(body.effectiveFrom) : new Date(),
          },
        });
      }
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'unit.bulk_status',
      outcome: 'SUCCESS',
      targetType: 'unit',
      correlationId,
      changeSummary: {
        status: body.status,
        reason: body.reason,
        updatedCount: eligibleUnitIds.length,
        excludedCount: exclusions.length,
        unitIds: eligibleUnitIds,
      },
    });

    return {
      mode: 'COMMIT',
      status: body.status,
      eligibleUnitIds,
      exclusions,
      updatedCount: eligibleUnitIds.length,
    };
  }

  /** Non-disclosure helper for wrong-org unit ids (used by tests / callers). */
  async assertOrgExists(organizationId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findFirst({ where: { id: organizationId } });
    if (tenant === null) {
      throw new NotFoundException({
        message: 'Organization not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
  }
}
