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
  createCreditNoteRequestSchema,
  FINANCE_PERMISSION_KEYS,
  paginationQuerySchema,
  postCreditNoteRequestSchema,
} from '@rpm/contracts';

import { CurrentActor } from '../../../common/auth/current-actor.decorator';
import { requireIfMatchVersion } from '../../../common/auth/if-match';
import { OrganizationPathGuard } from '../../../common/auth/organization.guards';
import { PermissionsGuard } from '../../../common/auth/permissions.guard';
import { RequirePermissions } from '../../../common/auth/require-permissions.decorator';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { CreditNoteService } from '../application/credit-note.service';

import type { AuthActor } from '../../../common/auth/auth.types';
import type { RequestWithCorrelation } from '../../../common/context/correlation-id.middleware';
import type { Request, Response } from 'express';

@Controller('organizations/:organizationId/credit-notes')
@UseGuards(OrganizationPathGuard, PermissionsGuard)
export class CreditNotesController {
  constructor(
    @Inject(CreditNoteService) private readonly creditNotes: CreditNoteService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  @Get()
  @RequirePermissions(FINANCE_PERMISSION_KEYS.CREDIT_NOTES_CREATE)
  list(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.creditNotes.listCreditNotes(organizationId, actor.membershipId!, {
      limit: parsed.limit,
      after: parsed.after,
      invoiceId: typeof query.invoiceId === 'string' ? query.invoiceId : undefined,
    });
  }

  @Post()
  @RequirePermissions(FINANCE_PERMISSION_KEYS.CREDIT_NOTES_CREATE)
  create(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = createCreditNoteRequestSchema.parse(body);
    return this.creditNotes.createCreditNote(
      organizationId,
      actor.membershipId!,
      actor.userId,
      parsed,
      request.correlationId,
    );
  }

  @Post(':creditNoteId/post')
  @RequirePermissions(FINANCE_PERMISSION_KEYS.CREDIT_NOTES_POST)
  async post(
    @Param('organizationId') organizationId: string,
    @Param('creditNoteId') creditNoteId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = postCreditNoteRequestSchema.parse(body);
    const key = this.idempotency.parseHeader(request as Request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, parsed);
    const result = await this.creditNotes.postCreditNote(
      organizationId,
      actor.membershipId!,
      actor.userId,
      creditNoteId,
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
