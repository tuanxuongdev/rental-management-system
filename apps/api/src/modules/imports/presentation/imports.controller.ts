import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import {
  bulkUnitStatusRequestSchema,
  createExportRequestSchema,
  createImportRequestSchema,
  IMPORT_PERMISSION_KEYS,
  paginationQuerySchema,
  PERMISSION_KEYS,
} from '@rpm/contracts';

import { CurrentActor } from '../../../common/auth/current-actor.decorator';
import { OrganizationPathGuard } from '../../../common/auth/organization.guards';
import { PermissionsGuard } from '../../../common/auth/permissions.guard';
import { RequirePermissions } from '../../../common/auth/require-permissions.decorator';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { BulkStatusService } from '../application/bulk-status.service';
import { ExportService } from '../application/export.service';
import { ImportService } from '../application/import.service';
import { OperationsService } from '../application/operations.service';

import type { AuthActor } from '../../../common/auth/auth.types';
import type { RequestWithCorrelation } from '../../../common/context/correlation-id.middleware';
import type { Request, Response } from 'express';

@Controller('organizations/:organizationId')
@UseGuards(OrganizationPathGuard, PermissionsGuard)
export class ImportsController {
  constructor(
    @Inject(ImportService) private readonly imports: ImportService,
    @Inject(BulkStatusService) private readonly bulkStatus: BulkStatusService,
    @Inject(ExportService) private readonly exports: ExportService,
    @Inject(OperationsService) private readonly operations: OperationsService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  @Get('imports/templates/inventory')
  @RequirePermissions(IMPORT_PERMISSION_KEYS.IMPORTS_INVENTORY)
  getInventoryTemplate(@Res({ passthrough: true }) response: Response) {
    const template = this.imports.getInventoryTemplate();
    response.setHeader('Content-Type', template.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${template.filename}"`);
    return template.body;
  }

  @Post('imports')
  @RequirePermissions(IMPORT_PERMISSION_KEYS.IMPORTS_INVENTORY)
  createImport(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = createImportRequestSchema.parse(body);
    return this.imports.createImport(
      organizationId,
      actor.membershipId!,
      actor.userId,
      parsed,
      request.correlationId,
    );
  }

  @Post('imports/:importId/dry-run')
  @RequirePermissions(IMPORT_PERMISSION_KEYS.IMPORTS_INVENTORY)
  dryRun(
    @Param('organizationId') organizationId: string,
    @Param('importId') importId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
  ) {
    return this.imports.dryRun(
      organizationId,
      actor.membershipId!,
      actor.userId,
      importId,
      request.correlationId,
    );
  }

  @Post('imports/:importId/commit')
  @RequirePermissions(IMPORT_PERMISSION_KEYS.IMPORTS_INVENTORY)
  async commit(
    @Param('organizationId') organizationId: string,
    @Param('importId') importId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation & Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const key = this.idempotency.parseHeader(request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, {
      importId,
    });
    const result = await this.imports.commit(
      organizationId,
      actor.membershipId!,
      actor.userId,
      importId,
      key,
      requestHash,
      request.correlationId,
    );
    this.idempotency.writeReplayHeader(response, result.replayed);
    response.status(202);
    return result.body;
  }

  @Get('imports/:importId')
  @RequirePermissions(IMPORT_PERMISSION_KEYS.IMPORTS_INVENTORY)
  getImport(
    @Param('organizationId') organizationId: string,
    @Param('importId') importId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.imports.getImport(organizationId, actor.membershipId!, importId);
  }

  @Get('imports/:importId/errors')
  @RequirePermissions(IMPORT_PERMISSION_KEYS.IMPORTS_INVENTORY)
  async getErrors(
    @Param('organizationId') organizationId: string,
    @Param('importId') importId: string,
    @CurrentActor() actor: AuthActor,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.imports.getErrorsCsv(organizationId, actor.membershipId!, importId);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    return file.body;
  }

  @Post('units/bulk-status')
  @RequirePermissions(PERMISSION_KEYS.UNITS_UPDATE)
  bulkUnitStatus(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = bulkUnitStatusRequestSchema.parse(body);
    return this.bulkStatus.previewOrCommit(
      organizationId,
      actor.membershipId!,
      actor.userId,
      parsed,
      request.correlationId,
    );
  }

  @Get('operations')
  @RequirePermissions(IMPORT_PERMISSION_KEYS.OPERATIONS_READ)
  listOperations(
    @Param('organizationId') organizationId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.operations.listOperations(organizationId, {
      limit: parsed.limit,
      after: parsed.after,
    });
  }

  @Post('exports')
  @RequirePermissions(IMPORT_PERMISSION_KEYS.EXPORTS_INVENTORY)
  createExport(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = createExportRequestSchema.parse(body);
    return this.exports.createExport(
      organizationId,
      actor.membershipId!,
      actor.userId,
      parsed,
      request.correlationId,
    );
  }
}
