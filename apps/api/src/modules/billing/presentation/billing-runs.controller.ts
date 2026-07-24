import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import {
  approveBillingRunRequestSchema,
  billingRunPreviewRequestSchema,
  commitBillingRunRequestSchema,
  createBillingRunRequestSchema,
  FINANCE_PERMISSION_KEYS,
  paginationQuerySchema,
  retryBillingRunRequestSchema,
} from '@rpm/contracts';

import { CurrentActor } from '../../../common/auth/current-actor.decorator';
import { requireIfMatchVersion } from '../../../common/auth/if-match';
import { OrganizationPathGuard } from '../../../common/auth/organization.guards';
import { PermissionsGuard } from '../../../common/auth/permissions.guard';
import { RequirePermissions } from '../../../common/auth/require-permissions.decorator';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { BillingRunService } from '../application/billing-run.service';

import type { AuthActor } from '../../../common/auth/auth.types';
import type { RequestWithCorrelation } from '../../../common/context/correlation-id.middleware';
import type { Request, Response } from 'express';

@Controller('organizations/:organizationId/billing-runs')
@UseGuards(OrganizationPathGuard, PermissionsGuard)
export class BillingRunsController {
  constructor(
    @Inject(BillingRunService) private readonly billingRuns: BillingRunService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  @Get()
  @RequirePermissions(FINANCE_PERMISSION_KEYS.BILLING_RUN_PREVIEW)
  list(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.billingRuns.listBillingRuns(organizationId, actor.membershipId!, {
      limit: parsed.limit,
      after: parsed.after,
      status: typeof query.status === 'string' ? query.status : undefined,
      periodKey: typeof query.periodKey === 'string' ? query.periodKey : undefined,
    });
  }

  @Post()
  @RequirePermissions(FINANCE_PERMISSION_KEYS.BILLING_RUN_PREVIEW)
  create(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = createBillingRunRequestSchema.parse(body);
    return this.billingRuns.createBillingRun(
      organizationId,
      actor.membershipId!,
      actor.userId,
      parsed,
      request.correlationId,
    );
  }

  @Get(':billingRunId')
  @RequirePermissions(FINANCE_PERMISSION_KEYS.BILLING_RUN_PREVIEW)
  get(
    @Param('organizationId') organizationId: string,
    @Param('billingRunId') billingRunId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.billingRuns.getBillingRun(organizationId, actor.membershipId!, billingRunId);
  }

  @Post(':billingRunId/preview')
  @RequirePermissions(FINANCE_PERMISSION_KEYS.BILLING_RUN_PREVIEW)
  preview(
    @Param('organizationId') organizationId: string,
    @Param('billingRunId') billingRunId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = billingRunPreviewRequestSchema.parse(body ?? {});
    return this.billingRuns.previewBillingRun(
      organizationId,
      actor.membershipId!,
      actor.userId,
      billingRunId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }

  @Post(':billingRunId/approve')
  @RequirePermissions(FINANCE_PERMISSION_KEYS.BILLING_RUN_COMMIT)
  approve(
    @Param('organizationId') organizationId: string,
    @Param('billingRunId') billingRunId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = approveBillingRunRequestSchema.parse(body ?? {});
    return this.billingRuns.approveBillingRun(
      organizationId,
      actor.membershipId!,
      actor.userId,
      billingRunId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }

  @Post(':billingRunId/commit')
  @RequirePermissions(FINANCE_PERMISSION_KEYS.BILLING_RUN_COMMIT)
  async commit(
    @Param('organizationId') organizationId: string,
    @Param('billingRunId') billingRunId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = commitBillingRunRequestSchema.parse(body ?? {});
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.billingRuns.commitBillingRun(
      organizationId,
      actor.membershipId!,
      actor.userId,
      billingRunId,
      parsed,
      requireIfMatchVersion(ifMatch),
      key,
      requestHash,
      request.correlationId,
    );
    this.idempotency.writeReplayHeader(response, result.replayed);
    return result.body;
  }

  @Post(':billingRunId/retry')
  @RequirePermissions(FINANCE_PERMISSION_KEYS.BILLING_RUN_COMMIT)
  async retry(
    @Param('organizationId') organizationId: string,
    @Param('billingRunId') billingRunId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = retryBillingRunRequestSchema.parse(body ?? {});
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.billingRuns.retryBillingRun(
      organizationId,
      actor.membershipId!,
      actor.userId,
      billingRunId,
      parsed,
      requireIfMatchVersion(ifMatch),
      key,
      requestHash,
      request.correlationId,
    );
    this.idempotency.writeReplayHeader(response, result.replayed);
    return result.body;
  }
}
