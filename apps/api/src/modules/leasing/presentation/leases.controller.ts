import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import {
  activateLeaseRequestSchema,
  completeMoveOutRequestSchema,
  createLeaseRequestSchema,
  LEASE_PERMISSION_KEYS,
  moveInRequestSchema,
  noticeLeaseRequestSchema,
  paginationQuerySchema,
  patchLeaseRequestSchema,
  patchMoveOutRequestSchema,
  renewLeaseRequestSchema,
  setLeaseAllocationRequestSchema,
  startMoveOutRequestSchema,
  terminateLeaseRequestSchema,
  transferLeaseRequestSchema,
} from '@rpm/contracts';

import { CurrentActor } from '../../../common/auth/current-actor.decorator';
import { requireIfMatchVersion } from '../../../common/auth/if-match';
import { OrganizationPathGuard } from '../../../common/auth/organization.guards';
import { PermissionsGuard } from '../../../common/auth/permissions.guard';
import { RequirePermissions } from '../../../common/auth/require-permissions.decorator';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { LeaseLifecycleService } from '../application/lease-lifecycle.service';
import { LeaseService } from '../application/lease.service';

import type { AuthActor } from '../../../common/auth/auth.types';
import type { RequestWithCorrelation } from '../../../common/context/correlation-id.middleware';
import type { Request, Response } from 'express';

@Controller('organizations/:organizationId')
@UseGuards(OrganizationPathGuard, PermissionsGuard)
export class LeasesController {
  constructor(
    @Inject(LeaseService) private readonly leases: LeaseService,
    @Inject(LeaseLifecycleService) private readonly lifecycle: LeaseLifecycleService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  @Get('dashboard/home')
  @RequirePermissions(LEASE_PERMISSION_KEYS.LIST)
  homeDashboard(@Param('organizationId') organizationId: string, @CurrentActor() actor: AuthActor) {
    return this.lifecycle.getHomeDashboard(organizationId, actor.membershipId!);
  }

  @Get('leases/pending-actions')
  @RequirePermissions(LEASE_PERMISSION_KEYS.LIST)
  pendingActions(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.lifecycle.listPendingActions(organizationId, actor.membershipId!);
  }

  @Get('leases')
  @RequirePermissions(LEASE_PERMISSION_KEYS.LIST)
  listLeases(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.leases.listLeases(organizationId, actor.membershipId!, {
      limit: parsed.limit,
      after: parsed.after,
      q: typeof query.q === 'string' ? query.q : undefined,
      status: typeof query.status === 'string' ? query.status : undefined,
      propertyId: typeof query.propertyId === 'string' ? query.propertyId : undefined,
      residentId: typeof query.residentId === 'string' ? query.residentId : undefined,
      partyId: typeof query.partyId === 'string' ? query.partyId : undefined,
    });
  }

  @Post('leases')
  @RequirePermissions(LEASE_PERMISSION_KEYS.CREATE)
  createLease(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = createLeaseRequestSchema.parse(body);
    return this.leases.createLease(
      organizationId,
      actor.membershipId!,
      actor.userId,
      parsed,
      request.correlationId,
    );
  }

  @Get('leases/:leaseId')
  @RequirePermissions(LEASE_PERMISSION_KEYS.VIEW)
  getLease(
    @Param('organizationId') organizationId: string,
    @Param('leaseId') leaseId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.leases.getLease(organizationId, actor.membershipId!, leaseId);
  }

  @Patch('leases/:leaseId')
  @RequirePermissions(LEASE_PERMISSION_KEYS.UPDATE)
  patchLease(
    @Param('organizationId') organizationId: string,
    @Param('leaseId') leaseId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = patchLeaseRequestSchema.parse(body);
    return this.leases.patchLease(
      organizationId,
      actor.membershipId!,
      actor.userId,
      leaseId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }

  @Post('leases/:leaseId/allocations')
  @RequirePermissions(LEASE_PERMISSION_KEYS.UPDATE)
  async setAllocation(
    @Param('organizationId') organizationId: string,
    @Param('leaseId') leaseId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = setLeaseAllocationRequestSchema.parse(body);
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.leases.setAllocation(
      organizationId,
      actor.membershipId!,
      actor.userId,
      leaseId,
      parsed,
      requireIfMatchVersion(ifMatch),
      key,
      requestHash,
      request.correlationId,
    );
    this.idempotency.writeReplayHeader(response, result.replayed);
    return result.body;
  }

  @Post('leases/:leaseId/review')
  @RequirePermissions(LEASE_PERMISSION_KEYS.VIEW)
  reviewLease(
    @Param('organizationId') organizationId: string,
    @Param('leaseId') leaseId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.leases.reviewLease(organizationId, actor.membershipId!, leaseId);
  }

  @Post('leases/:leaseId/activate')
  @RequirePermissions(LEASE_PERMISSION_KEYS.ACTIVATE)
  async activateLease(
    @Param('organizationId') organizationId: string,
    @Param('leaseId') leaseId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = activateLeaseRequestSchema.parse(body);
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.leases.activateLease(
      organizationId,
      actor.membershipId!,
      actor.userId,
      leaseId,
      parsed,
      requireIfMatchVersion(ifMatch),
      key,
      requestHash,
      request.correlationId,
    );
    this.idempotency.writeReplayHeader(response, result.replayed);
    return result.body;
  }

  @Post('leases/:leaseId/move-in')
  @RequirePermissions(LEASE_PERMISSION_KEYS.MOVE_IN)
  async moveIn(
    @Param('organizationId') organizationId: string,
    @Param('leaseId') leaseId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = moveInRequestSchema.parse(body);
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.lifecycle.moveIn(
      organizationId,
      actor.membershipId!,
      actor.userId,
      leaseId,
      parsed,
      requireIfMatchVersion(ifMatch),
      key,
      requestHash,
      request.correlationId,
    );
    this.idempotency.writeReplayHeader(response, result.replayed);
    return result.body;
  }

  @Post('leases/:leaseId/renew')
  @RequirePermissions(LEASE_PERMISSION_KEYS.RENEW)
  renew(
    @Param('organizationId') organizationId: string,
    @Param('leaseId') leaseId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = renewLeaseRequestSchema.parse(body);
    return this.lifecycle.renew(
      organizationId,
      actor.membershipId!,
      actor.userId,
      leaseId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }

  @Post('leases/:leaseId/transfer')
  @RequirePermissions(LEASE_PERMISSION_KEYS.TRANSFER)
  transfer(
    @Param('organizationId') organizationId: string,
    @Param('leaseId') leaseId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = transferLeaseRequestSchema.parse(body);
    return this.lifecycle.transfer(
      organizationId,
      actor.membershipId!,
      actor.userId,
      leaseId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }

  @Post('leases/:leaseId/notice')
  @RequirePermissions(LEASE_PERMISSION_KEYS.UPDATE)
  notice(
    @Param('organizationId') organizationId: string,
    @Param('leaseId') leaseId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = noticeLeaseRequestSchema.parse(body);
    return this.lifecycle.recordNotice(
      organizationId,
      actor.membershipId!,
      actor.userId,
      leaseId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }

  @Post('leases/:leaseId/move-out/start')
  @RequirePermissions(LEASE_PERMISSION_KEYS.MOVE_OUT)
  startMoveOut(
    @Param('organizationId') organizationId: string,
    @Param('leaseId') leaseId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = startMoveOutRequestSchema.parse(body);
    return this.lifecycle.startMoveOut(
      organizationId,
      actor.membershipId!,
      actor.userId,
      leaseId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }

  @Patch('leases/:leaseId/move-out')
  @RequirePermissions(LEASE_PERMISSION_KEYS.MOVE_OUT)
  patchMoveOut(
    @Param('organizationId') organizationId: string,
    @Param('leaseId') leaseId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = patchMoveOutRequestSchema.parse(body);
    return this.lifecycle.patchMoveOut(
      organizationId,
      actor.membershipId!,
      actor.userId,
      leaseId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }

  @Post('leases/:leaseId/move-out/complete')
  @RequirePermissions(LEASE_PERMISSION_KEYS.MOVE_OUT)
  async completeMoveOut(
    @Param('organizationId') organizationId: string,
    @Param('leaseId') leaseId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = completeMoveOutRequestSchema.parse(body);
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.lifecycle.completeMoveOut(
      organizationId,
      actor.membershipId!,
      actor.userId,
      leaseId,
      parsed,
      requireIfMatchVersion(ifMatch),
      key,
      requestHash,
      request.correlationId,
    );
    this.idempotency.writeReplayHeader(response, result.replayed);
    return result.body;
  }

  @Post('leases/:leaseId/terminate')
  @RequirePermissions(LEASE_PERMISSION_KEYS.TERMINATE)
  async terminate(
    @Param('organizationId') organizationId: string,
    @Param('leaseId') leaseId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = terminateLeaseRequestSchema.parse(body);
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.lifecycle.terminate(
      organizationId,
      actor.membershipId!,
      actor.userId,
      leaseId,
      parsed,
      requireIfMatchVersion(ifMatch),
      key,
      requestHash,
      request.correlationId,
    );
    this.idempotency.writeReplayHeader(response, result.replayed);
    return result.body;
  }

  @Get('leases/:leaseId/occupancy-events')
  @RequirePermissions(LEASE_PERMISSION_KEYS.VIEW)
  occupancyEvents(
    @Param('organizationId') organizationId: string,
    @Param('leaseId') leaseId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.lifecycle.listOccupancyEvents(organizationId, actor.membershipId!, leaseId, {
      limit: parsed.limit,
      after: parsed.after,
    });
  }

  @Get('leases/:leaseId/history')
  @RequirePermissions(LEASE_PERMISSION_KEYS.VIEW)
  getHistory(
    @Param('organizationId') organizationId: string,
    @Param('leaseId') leaseId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.leases.getHistory(organizationId, actor.membershipId!, leaseId, {
      limit: parsed.limit,
      after: parsed.after,
    });
  }
}
