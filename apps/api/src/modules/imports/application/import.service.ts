import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ImportJobRowStatus, ImportJobStatus, ImportJobType, type Prisma } from '@prisma/client';

import {
  type CreateImportRequest,
  type DryRunSummary,
  type ImportJobCounts,
  type ImportJobResponse,
  INVENTORY_IMPORT_COMMIT_EVENT_TYPE,
  INVENTORY_IMPORT_CSV_HEADERS,
} from '@rpm/contracts';

import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service';
import { actorScopeFromOrganization } from '../../../infrastructure/persistence/organization-context';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { S3StorageClient } from '../../../infrastructure/storage/s3-storage.client';
import { AuditService } from '../../audit/audit.service';
import { AuthorizationService } from '../../tenancy/application/authorization.service';
import {
  inventoryImportTemplateCsv,
  type InventoryImportRowDto,
  validateInventoryCsv,
} from '../domain/inventory-import.rules';

const EMPTY_COUNTS: ImportJobCounts = {
  total: 0,
  accepted: 0,
  rejected: 0,
  skipped: 0,
  applied: 0,
};

function asCounts(value: Prisma.JsonValue): ImportJobCounts {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ...EMPTY_COUNTS };
  }
  const record = value as Record<string, unknown>;
  return {
    total: typeof record.total === 'number' ? record.total : 0,
    accepted: typeof record.accepted === 'number' ? record.accepted : 0,
    rejected: typeof record.rejected === 'number' ? record.rejected : 0,
    skipped: typeof record.skipped === 'number' ? record.skipped : 0,
    applied: typeof record.applied === 'number' ? record.applied : 0,
  };
}

function asMapping(value: Prisma.JsonValue): Record<string, string> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'string') {
      out[key] = entry;
    }
  }
  return out;
}

@Injectable()
export class ImportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(S3StorageClient) private readonly storage: S3StorageClient,
  ) {}

  getInventoryTemplate(): { filename: string; contentType: string; body: string } {
    return {
      filename: 'inventory-import-template.csv',
      contentType: 'text/csv; charset=utf-8',
      body: inventoryImportTemplateCsv(),
    };
  }

  async createImport(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    body: CreateImportRequest,
    correlationId?: string,
  ): Promise<ImportJobResponse> {
    if (body.type !== 'INVENTORY') {
      throw new UnprocessableEntityException({
        message: 'Only inventory imports are supported',
        code: 'IMPORT_TYPE_UNSUPPORTED',
      });
    }

    if (body.csvText === undefined && body.objectKey === undefined) {
      throw new UnprocessableEntityException({
        message: 'csvText or objectKey is required',
        code: 'IMPORT_SOURCE_REQUIRED',
      });
    }

    // Scope check: membership must be active in org (permission guard already ran).
    await this.authorization.resolveAccessiblePropertyIds(membershipId, organizationId);

    let objectKey = body.objectKey ?? null;
    if (body.csvText !== undefined) {
      const put = await this.storage.putObject({
        organizationId,
        relativePath: `imports/${randomUUID()}.csv`,
        body: new TextEncoder().encode(body.csvText),
        contentType: 'text/csv; charset=utf-8',
      });
      objectKey = put.key;
    } else if (objectKey !== null) {
      this.assertOwnedObjectKey(organizationId, objectKey);
    }

    const mapping = body.mapping ?? {};
    const created = await this.prisma.importJob.create({
      data: {
        tenantId: organizationId,
        type: ImportJobType.INVENTORY,
        status: ImportJobStatus.QUEUED,
        actorUserId,
        mapping: mapping as Prisma.InputJsonValue,
        objectKey,
        counts: EMPTY_COUNTS as unknown as Prisma.InputJsonValue,
      },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'import.create',
      outcome: 'SUCCESS',
      targetType: 'import_job',
      targetId: created.id,
      correlationId,
      changeSummary: { type: body.type, objectKey },
    });

    return this.toResponse(created);
  }

  async dryRun(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    importId: string,
    correlationId?: string,
  ): Promise<DryRunSummary> {
    const job = await this.findActiveJob(organizationId, importId);
    if (
      job.status === ImportJobStatus.PROCESSING ||
      job.status === ImportJobStatus.COMPLETED ||
      job.status === ImportJobStatus.PARTIALLY_COMPLETED ||
      job.status === ImportJobStatus.CANCELLED
    ) {
      throw new ConflictException({
        message: 'Import job cannot be dry-run in its current status',
        code: 'IMPORT_NOT_VALIDATABLE',
      });
    }

    const csvText = await this.loadCsv(organizationId, job.objectKey);
    const mapping = asMapping(job.mapping);
    const results = validateInventoryCsv(csvText, mapping);
    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );

    const existingProperties = await this.prisma.property.findMany({
      where: { tenantId: organizationId, deletedAt: null },
      select: { id: true, code: true },
    });
    const propertyIdByCode = new Map(existingProperties.map((p) => [p.code, p.id]));

    const amenities = await this.prisma.amenity.findMany({
      where: { tenantId: organizationId, status: 'ACTIVE' },
      select: { code: true },
    });
    const amenityCodes = new Set(amenities.map((a) => a.code));

    const seenUnitKeys = new Set<string>();
    const rowCreates: Array<{
      rowNumber: number;
      status: ImportJobRowStatus;
      reason: string | null;
      payload: Prisma.InputJsonValue;
    }> = [];

    let accepted = 0;
    let rejected = 0;
    let skipped = 0;
    const sampleAccepted: Record<string, unknown>[] = [];
    const warnings: string[] = [];

    for (const result of results) {
      if (!result.ok) {
        rejected += 1;
        rowCreates.push({
          rowNumber: result.rowNumber,
          status: ImportJobRowStatus.REJECTED,
          reason: `${result.code}: ${result.reason}`,
          payload: result.raw as Prisma.InputJsonValue,
        });
        continue;
      }

      const dto = result.dto;
      const unitKey = `${dto.propertyCode}::${dto.unitCode}`;
      if (seenUnitKeys.has(unitKey) && dto.allocationMode !== 'BED') {
        rejected += 1;
        rowCreates.push({
          rowNumber: result.rowNumber,
          status: ImportJobRowStatus.REJECTED,
          reason: 'DUPLICATE_IN_FILE: duplicate unit_code for property in file',
          payload: dto as unknown as Prisma.InputJsonValue,
        });
        continue;
      }
      seenUnitKeys.add(unitKey);

      const existingPropertyId = propertyIdByCode.get(dto.propertyCode);
      if (accessible !== null) {
        // Scoped actors may only touch properties already in grant; never create new codes.
        if (existingPropertyId === undefined || !accessible.includes(existingPropertyId)) {
          skipped += 1;
          rowCreates.push({
            rowNumber: result.rowNumber,
            status: ImportJobRowStatus.SKIPPED,
            reason:
              existingPropertyId === undefined
                ? 'PROPERTY_SCOPE_DENIED: scoped actors cannot create new properties via import'
                : 'PROPERTY_SCOPE_DENIED: existing property is outside actor scope',
            payload: dto as unknown as Prisma.InputJsonValue,
          });
          continue;
        }
      }

      const unknownAmenities = dto.amenityCodes.filter((code) => !amenityCodes.has(code));
      if (unknownAmenities.length > 0) {
        rejected += 1;
        rowCreates.push({
          rowNumber: result.rowNumber,
          status: ImportJobRowStatus.REJECTED,
          reason: `UNKNOWN_AMENITY: ${unknownAmenities.join(', ')}`,
          payload: dto as unknown as Prisma.InputJsonValue,
        });
        continue;
      }

      accepted += 1;
      rowCreates.push({
        rowNumber: result.rowNumber,
        status: ImportJobRowStatus.ACCEPTED,
        reason: null,
        payload: dto as unknown as Prisma.InputJsonValue,
      });
      if (sampleAccepted.length < 5) {
        sampleAccepted.push(dto as unknown as Record<string, unknown>);
      }
    }

    if (accessible !== null) {
      warnings.push(
        'Property-scoped actor: rows for unknown or out-of-scope property codes are skipped; new properties cannot be created via import.',
      );
    }

    const counts: ImportJobCounts = {
      total: results.length,
      accepted,
      rejected,
      skipped,
      applied: 0,
    };

    const errorCsv = this.buildErrorsCsv(
      rowCreates.filter((r) => r.status !== ImportJobRowStatus.ACCEPTED),
    );
    let errorObjectKey: string | null = null;
    if (errorCsv.length > 0) {
      const put = await this.storage.putObject({
        organizationId,
        relativePath: `imports/${importId}/errors.csv`,
        body: new TextEncoder().encode(errorCsv),
        contentType: 'text/csv; charset=utf-8',
      });
      errorObjectKey = put.key;
    }

    await this.transactions.run(async (tx) => {
      await tx.importJobRow.deleteMany({
        where: { tenantId: organizationId, jobId: importId },
      });
      if (rowCreates.length > 0) {
        await tx.importJobRow.createMany({
          data: rowCreates.map((row) => ({
            tenantId: organizationId,
            jobId: importId,
            rowNumber: row.rowNumber,
            status: row.status,
            reason: row.reason,
            payload: row.payload,
          })),
        });
      }

      await tx.importJob.update({
        where: { id: importId },
        data: {
          status: ImportJobStatus.QUEUED,
          counts: counts as unknown as Prisma.InputJsonValue,
          errorObjectKey,
          version: { increment: 1 },
        },
      });
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'import.dry_run',
      outcome: 'SUCCESS',
      targetType: 'import_job',
      targetId: importId,
      correlationId,
      changeSummary: counts,
    });

    return {
      importId,
      status: 'QUEUED',
      counts,
      warnings,
      sampleAccepted,
    };
  }

  async commit(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    importId: string,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: ImportJobResponse }> {
    const job = await this.findActiveJob(organizationId, importId);
    const counts = asCounts(job.counts);
    if (counts.total === 0 && counts.accepted === 0) {
      throw new ConflictException({
        message: 'Import must be dry-run before commit',
        code: 'IMPORT_NOT_VALIDATED',
      });
    }

    if (
      job.status === ImportJobStatus.COMPLETED ||
      job.status === ImportJobStatus.PARTIALLY_COMPLETED ||
      job.status === ImportJobStatus.PROCESSING
    ) {
      return { replayed: true, body: this.toResponse(job) };
    }

    // Re-apply property scope at commit so grant changes after dry-run cannot widen writes.
    await this.reapplyPropertyScopeAtCommit(organizationId, membershipId, importId);

    const operation = `POST /v1/organizations/${organizationId}/imports/${importId}/commit`;
    const actorScope = actorScopeFromOrganization(organizationId);

    const result = await this.transactions.run(async (tx) => {
      const responseBody = this.toResponse({
        ...job,
        status: ImportJobStatus.PROCESSING,
      });

      const idempotencyResult = await this.idempotency.resolveOrCreate(tx, {
        tenantId: organizationId,
        actorScope,
        operation,
        key: idempotencyKey,
        requestHash,
        responseStatus: 202,
        responseBody,
      });

      if (idempotencyResult.replayed) {
        return idempotencyResult;
      }

      // Claim QUEUED|FAILED → PROCESSING so dry-run is blocked and duplicate outbox is prevented.
      const claimed = await tx.importJob.updateMany({
        where: {
          id: importId,
          tenantId: organizationId,
          status: { in: [ImportJobStatus.QUEUED, ImportJobStatus.FAILED] },
        },
        data: {
          status: ImportJobStatus.PROCESSING,
          version: { increment: 1 },
        },
      });

      if (claimed.count === 0) {
        const current = await tx.importJob.findFirst({
          where: { id: importId, tenantId: organizationId, deletedAt: null },
        });
        return {
          replayed: true as const,
          body: current !== null ? this.toResponse(current) : responseBody,
        };
      }

      await this.outbox.appendInTransaction(tx, {
        aggregateType: 'import_job',
        aggregateId: importId,
        eventType: INVENTORY_IMPORT_COMMIT_EVENT_TYPE,
        payload: {
          tenantId: organizationId,
          organizationId,
          importJobId: importId,
          actorUserId,
          actorMembershipId: membershipId,
        },
        correlationId,
        tenantId: organizationId,
      });

      return idempotencyResult;
    });

    const refreshed = await this.findActiveJob(organizationId, importId);

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'import.commit',
      outcome: 'SUCCESS',
      targetType: 'import_job',
      targetId: importId,
      correlationId,
      changeSummary: { replayed: result.replayed, counts: asCounts(refreshed.counts) },
    });

    return {
      replayed: result.replayed,
      body: result.replayed ? (result.body as ImportJobResponse) : this.toResponse(refreshed),
    };
  }

  async getImport(
    organizationId: string,
    _membershipId: string,
    importId: string,
  ): Promise<ImportJobResponse> {
    const job = await this.findActiveJob(organizationId, importId);
    return this.toResponse(job);
  }

  async getErrorsCsv(
    organizationId: string,
    _membershipId: string,
    importId: string,
  ): Promise<{ filename: string; contentType: string; body: string }> {
    const job = await this.findActiveJob(organizationId, importId);
    if (job.errorObjectKey !== null) {
      const object = await this.storage.getObject(job.errorObjectKey);
      if (object !== null) {
        return {
          filename: `import-${importId}-errors.csv`,
          contentType: 'text/csv; charset=utf-8',
          body: new TextDecoder().decode(object.body),
        };
      }
    }

    const rows = await this.prisma.importJobRow.findMany({
      where: {
        tenantId: organizationId,
        jobId: importId,
        status: { in: [ImportJobRowStatus.REJECTED, ImportJobRowStatus.SKIPPED] },
      },
      orderBy: { rowNumber: 'asc' },
    });

    const body = this.buildErrorsCsv(
      rows.map((row) => ({
        rowNumber: row.rowNumber,
        status: row.status,
        reason: row.reason,
        payload: row.payload,
      })),
    );

    return {
      filename: `import-${importId}-errors.csv`,
      contentType: 'text/csv; charset=utf-8',
      body,
    };
  }

  private async reapplyPropertyScopeAtCommit(
    organizationId: string,
    membershipId: string,
    importId: string,
  ): Promise<void> {
    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );
    if (accessible === null) {
      return;
    }

    const properties = await this.prisma.property.findMany({
      where: { tenantId: organizationId, deletedAt: null },
      select: { id: true, code: true },
    });
    const propertyIdByCode = new Map(properties.map((p) => [p.code, p.id]));

    const acceptedRows = await this.prisma.importJobRow.findMany({
      where: {
        tenantId: organizationId,
        jobId: importId,
        status: ImportJobRowStatus.ACCEPTED,
      },
    });

    let demoted = 0;
    for (const row of acceptedRows) {
      const payload = row.payload;
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        continue;
      }
      const propertyCode = (payload as Record<string, unknown>).propertyCode;
      if (typeof propertyCode !== 'string') {
        continue;
      }
      const propertyId = propertyIdByCode.get(propertyCode);
      if (propertyId === undefined || !accessible.includes(propertyId)) {
        await this.prisma.importJobRow.update({
          where: { id: row.id },
          data: {
            status: ImportJobRowStatus.SKIPPED,
            reason:
              propertyId === undefined
                ? 'PROPERTY_SCOPE_DENIED: scoped actors cannot create new properties via import'
                : 'PROPERTY_SCOPE_DENIED: existing property is outside actor scope',
          },
        });
        demoted += 1;
      }
    }

    if (demoted === 0) {
      return;
    }

    const job = await this.findActiveJob(organizationId, importId);
    const counts = asCounts(job.counts);
    await this.prisma.importJob.update({
      where: { id: importId },
      data: {
        counts: {
          ...counts,
          accepted: Math.max(0, counts.accepted - demoted),
          skipped: counts.skipped + demoted,
        } as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    });
  }

  private assertOwnedObjectKey(organizationId: string, objectKey: string): void {
    try {
      this.storage.assertOrganizationObjectKey(organizationId, objectKey);
    } catch {
      throw new UnprocessableEntityException({
        message: 'objectKey must belong to the organization',
        code: 'IMPORT_OBJECT_KEY_FORBIDDEN',
      });
    }
  }

  private async loadCsv(organizationId: string, objectKey: string | null): Promise<string> {
    if (objectKey === null) {
      throw new UnprocessableEntityException({
        message: 'Import source is missing',
        code: 'IMPORT_SOURCE_REQUIRED',
      });
    }
    this.assertOwnedObjectKey(organizationId, objectKey);
    const object = await this.storage.getObject(objectKey);
    if (object === null) {
      throw new UnprocessableEntityException({
        message: 'Import source object not found',
        code: 'IMPORT_SOURCE_NOT_FOUND',
      });
    }
    const text = new TextDecoder().decode(object.body);
    if (text.length > 5 * 1024 * 1024) {
      throw new UnprocessableEntityException({
        message: 'Import CSV exceeds 5MB limit',
        code: 'IMPORT_SOURCE_TOO_LARGE',
      });
    }
    return text;
  }

  private async findActiveJob(organizationId: string, importId: string) {
    const job = await this.prisma.importJob.findFirst({
      where: { id: importId, tenantId: organizationId, deletedAt: null },
    });
    if (job === null) {
      throw new NotFoundException({
        message: 'Import job not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    return job;
  }

  private buildErrorsCsv(
    rows: Array<{
      rowNumber: number;
      status: ImportJobRowStatus | string;
      reason: string | null;
      payload: unknown;
    }>,
  ): string {
    const header = ['row_number', 'status', 'reason', ...INVENTORY_IMPORT_CSV_HEADERS].join(',');
    if (rows.length === 0) {
      return `${header}\n`;
    }

    const lines = rows.map((row) => {
      const payload =
        row.payload !== null && typeof row.payload === 'object' && !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : {};
      const dto = payload as Partial<InventoryImportRowDto> & Record<string, unknown>;
      const cells = [
        String(row.rowNumber),
        String(row.status),
        this.csvEscape(row.reason ?? ''),
        this.csvEscape(String(dto.propertyCode ?? dto.property_code ?? '')),
        this.csvEscape(String(dto.propertyName ?? dto.property_name ?? '')),
        this.csvEscape(String(dto.propertyType ?? dto.property_type ?? '')),
        this.csvEscape(String(dto.addressLine1 ?? dto.address_line1 ?? '')),
        this.csvEscape(String(dto.city ?? '')),
        this.csvEscape(String(dto.region ?? '')),
        this.csvEscape(String(dto.postalCode ?? dto.postal_code ?? '')),
        this.csvEscape(String(dto.countryCode ?? dto.country_code ?? '')),
        this.csvEscape(String(dto.timeZone ?? dto.time_zone ?? '')),
        this.csvEscape(String(dto.defaultCurrency ?? dto.default_currency ?? '')),
        this.csvEscape(String(dto.buildingCode ?? dto.building_code ?? '')),
        this.csvEscape(String(dto.unitCode ?? dto.unit_code ?? '')),
        this.csvEscape(String(dto.unitName ?? dto.unit_name ?? '')),
        this.csvEscape(String(dto.unitType ?? dto.unit_type ?? '')),
        this.csvEscape(String(dto.allocationMode ?? dto.allocation_mode ?? '')),
        this.csvEscape(String(dto.capacity ?? '')),
        this.csvEscape(String(dto.bedCode ?? dto.bed_code ?? '')),
        this.csvEscape(String(dto.bedLabel ?? dto.bed_label ?? '')),
        this.csvEscape(
          Array.isArray(dto.amenityCodes)
            ? dto.amenityCodes.join('|')
            : String(dto.amenity_codes ?? ''),
        ),
      ];
      return cells.join(',');
    });

    return `${header}\n${lines.join('\n')}\n`;
  }

  private csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  toResponse(job: {
    id: string;
    tenantId: string;
    type: ImportJobType;
    status: ImportJobStatus;
    actorUserId: string;
    mapping: Prisma.JsonValue;
    objectKey: string | null;
    errorObjectKey: string | null;
    counts: Prisma.JsonValue;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): ImportJobResponse {
    return {
      id: job.id,
      organizationId: job.tenantId,
      type: job.type,
      status: job.status,
      actorUserId: job.actorUserId,
      mapping:
        job.mapping !== null && typeof job.mapping === 'object' && !Array.isArray(job.mapping)
          ? (job.mapping as Record<string, unknown>)
          : {},
      objectKey: job.objectKey,
      errorObjectKey: job.errorObjectKey,
      counts: asCounts(job.counts),
      version: job.version,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }
}
