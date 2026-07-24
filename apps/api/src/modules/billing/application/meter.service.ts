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
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  type MeterReadingBulkRequest,
  type MeterResponse,
  type MetersCollection,
  type MeterWrite,
} from '@rpm/contracts';

import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';
import { AuthorizationService } from '../../tenancy/application/authorization.service';
import { decimalToString, roundMoney } from '../domain/billing.rules';

@Injectable()
export class MeterService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listMeters(
    organizationId: string,
    membershipId: string,
    options?: { limit?: number; after?: string; propertyId?: string },
  ): Promise<MetersCollection> {
    await this.authorization.assertPermission(membershipId, organizationId, 'meters.list');
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);

    if (options?.propertyId !== undefined) {
      await this.authorization.assertPropertyAccess(
        membershipId,
        organizationId,
        options.propertyId,
      );
    }

    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );
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

    const rows = await this.prisma.meter.findMany({
      where: { tenantId: organizationId, ...propertyScope },
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

  async getMeter(
    organizationId: string,
    membershipId: string,
    meterId: string,
  ): Promise<MeterResponse> {
    await this.authorization.assertPermission(membershipId, organizationId, 'meters.view');
    const row = await this.prisma.meter.findFirst({
      where: { id: meterId, tenantId: organizationId },
    });
    if (row === null) {
      throw new NotFoundException({ message: 'Meter not found', code: 'METER_NOT_FOUND' });
    }
    await this.authorization.assertPropertyAccess(membershipId, organizationId, row.propertyId);
    return this.toResponse(row);
  }

  async createMeter(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    body: MeterWrite,
    correlationId?: string,
  ): Promise<MeterResponse> {
    await this.authorization.assertPermission(membershipId, organizationId, 'meters.create');
    await this.authorization.assertPropertyAccess(membershipId, organizationId, body.propertyId);

    const code = body.name?.trim() || body.serialNumber;
    const created = await this.prisma.meter.create({
      data: {
        tenantId: organizationId,
        propertyId: body.propertyId,
        unitId: body.unitId ?? null,
        meterType: body.meterType,
        code,
        serialNumber: body.serialNumber,
        unitOfMeasure: body.meterType === 'WATER' ? 'm3' : 'kWh',
        multiplier:
          body.multiplier !== undefined
            ? roundMoney(new Prisma.Decimal(body.multiplier))
            : new Prisma.Decimal(1),
        status: 'ACTIVE',
      },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'meter.create',
      outcome: 'SUCCESS',
      targetType: 'meter',
      targetId: created.id,
      correlationId,
    });

    return this.toResponse(created);
  }

  async bulkUpsertReadings(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    body: MeterReadingBulkRequest,
    correlationId?: string,
  ): Promise<{ accepted: number; rejected: number; results: Array<Record<string, unknown>> }> {
    await this.authorization.assertPermission(membershipId, organizationId, 'meters.readings.bulk');

    const results: Array<Record<string, unknown>> = [];
    let accepted = 0;
    let rejected = 0;

    const applyOne = async (
      item: (typeof body.items)[number],
      db: Prisma.TransactionClient | PrismaService,
    ) => {
      const meter = await db.meter.findFirst({
        where: { id: item.meterId, tenantId: organizationId },
      });
      if (meter === null) {
        rejected += 1;
        results.push({
          clientItemId: item.clientItemId,
          status: 'REJECTED',
          code: 'METER_NOT_FOUND',
        });
        return;
      }
      await this.authorization.assertPropertyAccess(membershipId, organizationId, meter.propertyId);

      if (body.validateOnly === true) {
        accepted += 1;
        results.push({ clientItemId: item.clientItemId, status: 'VALID' });
        return;
      }

      await db.meterReading.upsert({
        where: {
          tenantId_meterId_readAt_source: {
            tenantId: organizationId,
            meterId: item.meterId,
            readAt: new Date(item.readAt),
            source: item.source,
          },
        },
        create: {
          id: randomUUID(),
          tenantId: organizationId,
          meterId: item.meterId,
          readAt: new Date(item.readAt),
          value: roundMoney(new Prisma.Decimal(item.value)),
          quality: item.qualityFlag ?? 'ACTUAL',
          source: item.source,
        },
        update: {
          value: roundMoney(new Prisma.Decimal(item.value)),
          quality: item.qualityFlag ?? 'ACTUAL',
        },
      });
      accepted += 1;
      results.push({ clientItemId: item.clientItemId, status: 'ACCEPTED' });
    };

    if (body.mode === 'ATOMIC') {
      try {
        await this.prisma.$transaction(async (tx) => {
          for (const item of body.items) {
            await applyOne(item, tx);
            if (rejected > 0) {
              throw new UnprocessableEntityException({
                message: 'Atomic bulk reading failed validation',
                code: 'METER_READING_BULK_FAILED',
              });
            }
          }
        });
      } catch (error) {
        if (error instanceof UnprocessableEntityException) {
          throw error;
        }
        throw error;
      }
    } else {
      for (const item of body.items) {
        try {
          await applyOne(item, this.prisma);
        } catch {
          rejected += 1;
          results.push({
            clientItemId: item.clientItemId,
            status: 'REJECTED',
            code: 'METER_READING_UPSERT_FAILED',
          });
        }
      }
    }

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'meter.readings.bulk',
      outcome: rejected > 0 && accepted === 0 ? 'FAILURE' : 'SUCCESS',
      targetType: 'meter_reading',
      correlationId,
      changeSummary: { accepted, rejected },
    });

    if (body.mode === 'ATOMIC' && rejected > 0) {
      throw new ConflictException({
        message: 'Atomic bulk reading had rejections',
        code: 'METER_READING_BULK_FAILED',
      });
    }

    return { accepted, rejected, results };
  }

  private toResponse(row: {
    id: string;
    tenantId: string;
    meterType: MeterResponse['meterType'];
    status: MeterResponse['status'];
    serialNumber: string | null;
    code: string;
    propertyId: string;
    unitId: string | null;
    multiplier: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
  }): MeterResponse {
    return {
      id: row.id,
      organizationId: row.tenantId,
      meterType: row.meterType,
      status: row.status,
      serialNumber: row.serialNumber ?? row.code,
      name: row.code,
      propertyId: row.propertyId,
      unitId: row.unitId,
      multiplier: decimalToString(row.multiplier),
      installedAt: null,
      version: 1,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
