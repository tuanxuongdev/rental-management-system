import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  clearDoNotRentRequestSchema,
  createResidentRequestSchema,
  createWaitlistEntryRequestSchema,
  paginationQuerySchema,
  patchResidentRequestSchema,
  patchWaitlistEntryRequestSchema,
  PERMISSION_KEYS,
  removeWaitlistEntryRequestSchema,
  residentDuplicateCheckRequestSchema,
  setDoNotRentRequestSchema,
} from '@rpm/contracts';

import { CurrentActor } from '../../../common/auth/current-actor.decorator';
import { requireIfMatchVersion } from '../../../common/auth/if-match';
import { OrganizationPathGuard } from '../../../common/auth/organization.guards';
import { PermissionsGuard } from '../../../common/auth/permissions.guard';
import { RequirePermissions } from '../../../common/auth/require-permissions.decorator';
import { ResidentService } from '../application/resident.service';
import { WaitlistService } from '../application/waitlist.service';

import type { AuthActor } from '../../../common/auth/auth.types';
import type { RequestWithCorrelation } from '../../../common/context/correlation-id.middleware';

@Controller('organizations/:organizationId')
@UseGuards(OrganizationPathGuard, PermissionsGuard)
export class ResidentsController {
  constructor(
    @Inject(ResidentService) private readonly residents: ResidentService,
    @Inject(WaitlistService) private readonly waitlist: WaitlistService,
  ) {}

  @Get('residents')
  @RequirePermissions(PERMISSION_KEYS.RESIDENTS_LIST)
  async listResidents(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    const flags = await this.residents.resolveSensitiveFlags(actor.membershipId!, organizationId);
    return this.residents.listResidents(organizationId, actor.membershipId!, {
      limit: parsed.limit,
      after: parsed.after,
      q: typeof query.q === 'string' ? query.q : undefined,
      status: typeof query.status === 'string' ? query.status : undefined,
      preferredPropertyId:
        typeof query.preferredPropertyId === 'string'
          ? query.preferredPropertyId
          : typeof query.propertyId === 'string'
            ? query.propertyId
            : undefined,
      ...flags,
    });
  }

  @Post('residents/duplicate-check')
  @RequirePermissions(PERMISSION_KEYS.RESIDENTS_CREATE)
  duplicateCheck(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Body() body: unknown,
  ) {
    const parsed = residentDuplicateCheckRequestSchema.parse(body);
    return this.residents.duplicateCheck(organizationId, actor.membershipId!, parsed);
  }

  @Post('residents')
  @RequirePermissions(PERMISSION_KEYS.RESIDENTS_CREATE)
  createResident(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = createResidentRequestSchema.parse(body);
    return this.residents.createResident(
      organizationId,
      actor.membershipId!,
      actor.userId,
      parsed,
      request.correlationId,
    );
  }

  @Get('residents/:residentId')
  @RequirePermissions(PERMISSION_KEYS.RESIDENTS_VIEW)
  async getResident(
    @Param('organizationId') organizationId: string,
    @Param('residentId') residentId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    const flags = await this.residents.resolveSensitiveFlags(actor.membershipId!, organizationId);
    return this.residents.getResident(organizationId, actor.membershipId!, residentId, flags);
  }

  @Patch('residents/:residentId')
  @RequirePermissions(PERMISSION_KEYS.RESIDENTS_UPDATE)
  async patchResident(
    @Param('organizationId') organizationId: string,
    @Param('residentId') residentId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = patchResidentRequestSchema.parse(body);
    const flags = await this.residents.resolveSensitiveFlags(actor.membershipId!, organizationId);
    return this.residents.patchResident(
      organizationId,
      actor.membershipId!,
      actor.userId,
      residentId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
      flags,
    );
  }

  @Delete('residents/:residentId')
  @HttpCode(204)
  @RequirePermissions(PERMISSION_KEYS.RESIDENTS_ARCHIVE)
  async archiveResident(
    @Param('organizationId') organizationId: string,
    @Param('residentId') residentId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
  ) {
    await this.residents.archiveResident(
      organizationId,
      actor.membershipId!,
      actor.userId,
      residentId,
      request.correlationId,
    );
  }

  @Post('residents/:residentId/do-not-rent')
  @RequirePermissions(PERMISSION_KEYS.RESIDENTS_DO_NOT_RENT_MANAGE)
  setDoNotRent(
    @Param('organizationId') organizationId: string,
    @Param('residentId') residentId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = setDoNotRentRequestSchema.parse(body);
    return this.residents.setDoNotRent(
      organizationId,
      actor.membershipId!,
      actor.userId,
      residentId,
      parsed,
      request.correlationId,
    );
  }

  @Delete('residents/:residentId/do-not-rent')
  @RequirePermissions(PERMISSION_KEYS.RESIDENTS_DO_NOT_RENT_MANAGE)
  clearDoNotRent(
    @Param('organizationId') organizationId: string,
    @Param('residentId') residentId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = clearDoNotRentRequestSchema.parse(body ?? {});
    return this.residents.clearDoNotRent(
      organizationId,
      actor.membershipId!,
      actor.userId,
      residentId,
      parsed,
      request.correlationId,
    );
  }

  @Get('waitlist-entries')
  @RequirePermissions(PERMISSION_KEYS.WAITLIST_LIST)
  listWaitlist(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.waitlist.listEntries(organizationId, actor.membershipId!, {
      limit: parsed.limit,
      after: parsed.after,
      propertyId: typeof query.propertyId === 'string' ? query.propertyId : undefined,
      partyId: typeof query.partyId === 'string' ? query.partyId : undefined,
      status: typeof query.status === 'string' ? query.status : undefined,
    });
  }

  @Post('waitlist-entries')
  @RequirePermissions(PERMISSION_KEYS.WAITLIST_CREATE)
  createWaitlist(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = createWaitlistEntryRequestSchema.parse(body);
    return this.waitlist.createEntry(
      organizationId,
      actor.membershipId!,
      actor.userId,
      parsed,
      request.correlationId,
    );
  }

  @Get('waitlist-entries/:entryId')
  @RequirePermissions(PERMISSION_KEYS.WAITLIST_VIEW)
  getWaitlist(
    @Param('organizationId') organizationId: string,
    @Param('entryId') entryId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.waitlist.getEntry(organizationId, actor.membershipId!, entryId);
  }

  @Patch('waitlist-entries/:entryId')
  @RequirePermissions(PERMISSION_KEYS.WAITLIST_UPDATE)
  patchWaitlist(
    @Param('organizationId') organizationId: string,
    @Param('entryId') entryId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = patchWaitlistEntryRequestSchema.parse(body);
    return this.waitlist.patchEntry(
      organizationId,
      actor.membershipId!,
      actor.userId,
      entryId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }

  @Post('waitlist-entries/:entryId/remove')
  @RequirePermissions(PERMISSION_KEYS.WAITLIST_REMOVE)
  removeWaitlist(
    @Param('organizationId') organizationId: string,
    @Param('entryId') entryId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = removeWaitlistEntryRequestSchema.parse(body);
    return this.waitlist.removeEntry(
      organizationId,
      actor.membershipId!,
      actor.userId,
      entryId,
      parsed,
      request.correlationId,
    );
  }
}
