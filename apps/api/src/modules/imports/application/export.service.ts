import { randomUUID } from 'node:crypto';

import { Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ExportJobType, ImportJobStatus, type Prisma } from '@prisma/client';

import {
  type CreateExportRequest,
  type ExportJobResponse,
  INVENTORY_IMPORT_CSV_HEADERS,
} from '@rpm/contracts';

import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { S3StorageClient } from '../../../infrastructure/storage/s3-storage.client';
import { AuditService } from '../../audit/audit.service';
import { AuthorizationService } from '../../tenancy/application/authorization.service';

const SYNC_ROW_BOUND = 5_000;

@Injectable()
export class ExportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(S3StorageClient) private readonly storage: S3StorageClient,
  ) {}

  async createExport(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    body: CreateExportRequest,
    correlationId?: string,
  ): Promise<ExportJobResponse> {
    if (body.type !== 'INVENTORY') {
      throw new UnprocessableEntityException({
        message: 'Only inventory exports are supported',
        code: 'EXPORT_TYPE_UNSUPPORTED',
      });
    }

    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );

    if (body.propertyId !== undefined) {
      await this.authorization.assertPropertyAccess(membershipId, organizationId, body.propertyId);
    }

    const propertyFilter =
      body.propertyId !== undefined
        ? { propertyId: body.propertyId }
        : accessible !== null
          ? { propertyId: { in: accessible } }
          : {};

    const limit = Math.min(body.limit, SYNC_ROW_BOUND);
    const units = await this.prisma.unit.findMany({
      where: {
        tenantId: organizationId,
        deletedAt: null,
        ...propertyFilter,
      },
      include: {
        property: true,
        building: true,
        beds: { where: { deletedAt: null }, orderBy: { code: 'asc' } },
      },
      orderBy: [{ propertyId: 'asc' }, { code: 'asc' }],
      take: limit + 1,
    });

    const truncated = units.length > limit;
    const pageUnits = truncated ? units.slice(0, limit) : units;

    const csvText = this.toCsv(pageUnits);
    const put = await this.storage.putObject({
      organizationId,
      relativePath: `exports/${randomUUID()}.csv`,
      body: new TextEncoder().encode(csvText),
      contentType: 'text/csv; charset=utf-8',
    });

    // Sprint-06: always return bounded CSV inline (async download path deferred).
    void body.sync;
    const sync = true;
    const job = await this.prisma.exportJob.create({
      data: {
        tenantId: organizationId,
        type: ExportJobType.INVENTORY,
        status: ImportJobStatus.COMPLETED,
        actorUserId,
        objectKey: put.key,
        counts: {
          total: pageUnits.length,
          truncated: truncated ? 1 : 0,
        } as Prisma.InputJsonValue,
      },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'export.create',
      outcome: 'SUCCESS',
      targetType: 'export_job',
      targetId: job.id,
      correlationId,
      changeSummary: { total: pageUnits.length, truncated, sync },
    });

    return {
      id: job.id,
      organizationId: job.tenantId,
      type: job.type,
      status: job.status,
      actorUserId: job.actorUserId,
      objectKey: job.objectKey,
      counts: { total: pageUnits.length },
      truncated,
      csvText,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }

  private toCsv(
    units: Array<{
      code: string;
      name: string;
      unitType: string;
      allocationMode: string;
      capacity: number;
      property: {
        code: string;
        name: string;
        propertyType: string;
        addressLine1: string;
        city: string;
        region: string | null;
        postalCode: string | null;
        countryCode: string;
        timeZone: string;
        defaultCurrency: string;
      };
      building: { code: string } | null;
      beds: Array<{ code: string; label: string }>;
    }>,
  ): string {
    const header = INVENTORY_IMPORT_CSV_HEADERS.join(',');
    const lines: string[] = [header];

    for (const unit of units) {
      if (unit.allocationMode === 'BED' && unit.beds.length > 0) {
        for (const bed of unit.beds) {
          lines.push(
            this.row({
              property: unit.property,
              buildingCode: unit.building?.code ?? '',
              unit,
              bedCode: bed.code,
              bedLabel: bed.label,
            }),
          );
        }
      } else {
        lines.push(
          this.row({
            property: unit.property,
            buildingCode: unit.building?.code ?? '',
            unit,
            bedCode: '',
            bedLabel: '',
          }),
        );
      }
    }

    return `${lines.join('\n')}\n`;
  }

  private row(input: {
    property: {
      code: string;
      name: string;
      propertyType: string;
      addressLine1: string;
      city: string;
      region: string | null;
      postalCode: string | null;
      countryCode: string;
      timeZone: string;
      defaultCurrency: string;
    };
    buildingCode: string;
    unit: {
      code: string;
      name: string;
      unitType: string;
      allocationMode: string;
      capacity: number;
    };
    bedCode: string;
    bedLabel: string;
  }): string {
    const cells = [
      input.property.code,
      input.property.name,
      input.property.propertyType,
      input.property.addressLine1,
      input.property.city,
      input.property.region ?? '',
      input.property.postalCode ?? '',
      input.property.countryCode,
      input.property.timeZone,
      input.property.defaultCurrency,
      input.buildingCode,
      input.unit.code,
      input.unit.name,
      input.unit.unitType,
      input.unit.allocationMode,
      String(input.unit.capacity),
      input.bedCode,
      input.bedLabel,
      '',
    ];
    return cells.map((cell) => this.csvEscape(cell)).join(',');
  }

  private csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
