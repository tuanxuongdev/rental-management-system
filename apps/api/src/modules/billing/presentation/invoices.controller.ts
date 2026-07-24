import {
  Body,
  Controller,
  Delete,
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
  FINANCE_PERMISSION_KEYS,
  paginationQuerySchema,
  postInvoiceRequestSchema,
  voidInvoiceRequestSchema,
} from '@rpm/contracts';

import { CurrentActor } from '../../../common/auth/current-actor.decorator';
import { requireIfMatchVersion } from '../../../common/auth/if-match';
import { OrganizationPathGuard } from '../../../common/auth/organization.guards';
import { PermissionsGuard } from '../../../common/auth/permissions.guard';
import { RequirePermissions } from '../../../common/auth/require-permissions.decorator';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { InvoiceService } from '../application/invoice.service';

import type { AuthActor } from '../../../common/auth/auth.types';
import type { RequestWithCorrelation } from '../../../common/context/correlation-id.middleware';
import type { Request, Response } from 'express';

@Controller('organizations/:organizationId/invoices')
@UseGuards(OrganizationPathGuard, PermissionsGuard)
export class InvoicesController {
  constructor(
    @Inject(InvoiceService) private readonly invoices: InvoiceService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  @Get()
  @RequirePermissions(FINANCE_PERMISSION_KEYS.INVOICES_LIST)
  list(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.invoices.listInvoices(organizationId, actor.membershipId!, {
      limit: parsed.limit,
      after: parsed.after,
      status: typeof query.status === 'string' ? query.status : undefined,
      leaseId: typeof query.leaseId === 'string' ? query.leaseId : undefined,
      propertyId: typeof query.propertyId === 'string' ? query.propertyId : undefined,
      periodKey: typeof query.periodKey === 'string' ? query.periodKey : undefined,
    });
  }

  @Get(':invoiceId')
  @RequirePermissions(FINANCE_PERMISSION_KEYS.INVOICES_VIEW)
  get(
    @Param('organizationId') organizationId: string,
    @Param('invoiceId') invoiceId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.invoices.getInvoice(organizationId, actor.membershipId!, invoiceId);
  }

  @Post(':invoiceId/post')
  @RequirePermissions(FINANCE_PERMISSION_KEYS.INVOICES_ISSUE)
  async post(
    @Param('organizationId') organizationId: string,
    @Param('invoiceId') invoiceId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = postInvoiceRequestSchema.parse(body);
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.invoices.postInvoice(
      organizationId,
      actor.membershipId!,
      actor.userId,
      invoiceId,
      parsed,
      requireIfMatchVersion(ifMatch),
      key,
      requestHash,
      request.correlationId,
    );
    this.idempotency.writeReplayHeader(response, result.replayed);
    return result.body;
  }

  @Post(':invoiceId/void')
  @RequirePermissions(FINANCE_PERMISSION_KEYS.CHARGES_VOID)
  async void(
    @Param('organizationId') organizationId: string,
    @Param('invoiceId') invoiceId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = voidInvoiceRequestSchema.parse(body);
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.invoices.voidInvoice(
      organizationId,
      actor.membershipId!,
      actor.userId,
      invoiceId,
      parsed,
      requireIfMatchVersion(ifMatch),
      key,
      requestHash,
      request.correlationId,
    );
    this.idempotency.writeReplayHeader(response, result.replayed);
    return result.body;
  }

  @Delete(':invoiceId/lines/:lineId')
  @RequirePermissions(FINANCE_PERMISSION_KEYS.INVOICES_VIEW)
  deleteLine(
    @Param('organizationId') organizationId: string,
    @Param('invoiceId') invoiceId: string,
    @Param('lineId') lineId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.invoices.rejectDeletePostedLine(
      organizationId,
      actor.membershipId!,
      invoiceId,
      lineId,
    );
  }
}
