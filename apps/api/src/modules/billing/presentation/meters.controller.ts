import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';

import {
  METERS_PERMISSION_KEYS,
  meterReadingBulkRequestSchema,
  meterWriteSchema,
  paginationQuerySchema,
  PERMISSION_KEYS,
  utilityAllocationCommitRequestSchema,
  utilityAllocationPreviewRequestSchema,
} from '@rpm/contracts';

import { CurrentActor } from '../../../common/auth/current-actor.decorator';
import { OrganizationPathGuard } from '../../../common/auth/organization.guards';
import { PermissionsGuard } from '../../../common/auth/permissions.guard';
import { RequirePermissions } from '../../../common/auth/require-permissions.decorator';
import { MeterService } from '../application/meter.service';
import { UtilityAllocationService } from '../application/utility-allocation.service';

import type { AuthActor } from '../../../common/auth/auth.types';
import type { RequestWithCorrelation } from '../../../common/context/correlation-id.middleware';

@Controller('organizations/:organizationId')
@UseGuards(OrganizationPathGuard, PermissionsGuard)
export class MetersController {
  constructor(
    @Inject(MeterService) private readonly meters: MeterService,
    @Inject(UtilityAllocationService)
    private readonly utilityAllocation: UtilityAllocationService,
  ) {}

  @Get('meters')
  @RequirePermissions(METERS_PERMISSION_KEYS.LIST)
  listMeters(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.meters.listMeters(organizationId, actor.membershipId!, {
      limit: parsed.limit,
      after: parsed.after,
      propertyId: typeof query.propertyId === 'string' ? query.propertyId : undefined,
    });
  }

  @Post('meters')
  @RequirePermissions(METERS_PERMISSION_KEYS.CREATE)
  createMeter(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = meterWriteSchema.parse(body);
    return this.meters.createMeter(
      organizationId,
      actor.membershipId!,
      actor.userId,
      parsed,
      request.correlationId,
    );
  }

  @Get('meters/:meterId')
  @RequirePermissions(METERS_PERMISSION_KEYS.VIEW)
  getMeter(
    @Param('organizationId') organizationId: string,
    @Param('meterId') meterId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.meters.getMeter(organizationId, actor.membershipId!, meterId);
  }

  @Post('meter-readings/bulk')
  @RequirePermissions(METERS_PERMISSION_KEYS.READINGS_BULK)
  bulkReadings(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = meterReadingBulkRequestSchema.parse(body);
    return this.meters.bulkUpsertReadings(
      organizationId,
      actor.membershipId!,
      actor.userId,
      parsed,
      request.correlationId,
    );
  }

  @Post('utility-allocation-runs/preview')
  @RequirePermissions(PERMISSION_KEYS.UTILITIES_ALLOCATE)
  previewAllocation(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = utilityAllocationPreviewRequestSchema.parse(body);
    return this.utilityAllocation.preview(
      organizationId,
      actor.membershipId!,
      actor.userId,
      parsed,
      request.correlationId,
    );
  }

  @Post('utility-allocation-runs/:runId/commit')
  @RequirePermissions(PERMISSION_KEYS.UTILITIES_ALLOCATE)
  commitAllocation(
    @Param('organizationId') organizationId: string,
    @Param('runId') runId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = utilityAllocationCommitRequestSchema.parse(body ?? {});
    return this.utilityAllocation.commit(
      organizationId,
      actor.membershipId!,
      actor.userId,
      runId,
      parsed,
      request.correlationId,
    );
  }

  @Get('utility-allocation-runs/:runId')
  @RequirePermissions(PERMISSION_KEYS.UTILITIES_USAGE_VIEW)
  getAllocation(
    @Param('organizationId') organizationId: string,
    @Param('runId') runId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.utilityAllocation.getRun(organizationId, actor.membershipId!, runId);
  }
}
