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
  activateAgreementRequestSchema,
  createManagementAgreementRequestSchema,
  createOwnershipRequestSchema,
  createPropertyOwnerRequestSchema,
  endOwnershipRequestSchema,
  paginationQuerySchema,
  patchManagementAgreementRequestSchema,
  patchPropertyOwnerRequestSchema,
  PERMISSION_KEYS,
  terminateAgreementRequestSchema,
} from '@rpm/contracts';

import { CurrentActor } from '../../../common/auth/current-actor.decorator';
import { requireIfMatchVersion } from '../../../common/auth/if-match';
import { OrganizationPathGuard } from '../../../common/auth/organization.guards';
import { PermissionsGuard } from '../../../common/auth/permissions.guard';
import { RequirePermissions } from '../../../common/auth/require-permissions.decorator';
import { ManagementAgreementService } from '../application/management-agreement.service';
import { OwnershipService } from '../application/ownership.service';
import { PropertyOwnerService } from '../application/property-owner.service';

import type { AuthActor } from '../../../common/auth/auth.types';
import type { RequestWithCorrelation } from '../../../common/context/correlation-id.middleware';

@Controller('organizations/:organizationId')
@UseGuards(OrganizationPathGuard, PermissionsGuard)
export class PartiesController {
  constructor(
    @Inject(PropertyOwnerService) private readonly owners: PropertyOwnerService,
    @Inject(OwnershipService) private readonly ownerships: OwnershipService,
    @Inject(ManagementAgreementService) private readonly agreements: ManagementAgreementService,
  ) {}

  @Get('property-owners')
  @RequirePermissions(PERMISSION_KEYS.PROPERTY_OWNERS_LIST)
  listOwners(
    @Param('organizationId') organizationId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.owners.listOwners(organizationId, {
      limit: parsed.limit,
      after: parsed.after,
      q: typeof query.q === 'string' ? query.q : undefined,
    });
  }

  @Post('property-owners')
  @RequirePermissions(PERMISSION_KEYS.PROPERTY_OWNERS_CREATE)
  createOwner(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = createPropertyOwnerRequestSchema.parse(body);
    return this.owners.createOwner(organizationId, actor.userId, parsed, request.correlationId);
  }

  @Get('property-owners/:ownerId')
  @RequirePermissions(PERMISSION_KEYS.PROPERTY_OWNERS_VIEW)
  getOwner(@Param('organizationId') organizationId: string, @Param('ownerId') ownerId: string) {
    return this.owners.getOwner(organizationId, ownerId);
  }

  @Patch('property-owners/:ownerId')
  @RequirePermissions(PERMISSION_KEYS.PROPERTY_OWNERS_UPDATE)
  patchOwner(
    @Param('organizationId') organizationId: string,
    @Param('ownerId') ownerId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = patchPropertyOwnerRequestSchema.parse(body);
    return this.owners.patchOwner(
      organizationId,
      actor.userId,
      ownerId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }

  @Delete('property-owners/:ownerId')
  @HttpCode(204)
  @RequirePermissions(PERMISSION_KEYS.PROPERTY_OWNERS_UPDATE)
  async archiveOwner(
    @Param('organizationId') organizationId: string,
    @Param('ownerId') ownerId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
  ) {
    await this.owners.archiveOwner(organizationId, actor.userId, ownerId, request.correlationId);
  }

  @Get('properties/:propertyId/ownerships')
  @RequirePermissions(PERMISSION_KEYS.PROPERTY_OWNERSHIPS_VIEW)
  listOwnerships(
    @Param('organizationId') organizationId: string,
    @Param('propertyId') propertyId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.ownerships.listOwnerships(organizationId, actor.membershipId!, propertyId, {
      limit: parsed.limit,
      after: parsed.after,
    });
  }

  @Post('properties/:propertyId/ownerships')
  @RequirePermissions(PERMISSION_KEYS.PROPERTY_OWNERSHIPS_CREATE)
  createOwnership(
    @Param('organizationId') organizationId: string,
    @Param('propertyId') propertyId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = createOwnershipRequestSchema.parse(body);
    return this.ownerships.createOwnership(
      organizationId,
      actor.membershipId!,
      actor.userId,
      propertyId,
      parsed,
      request.correlationId,
    );
  }

  @Post('property-ownerships/:ownershipId/end')
  @RequirePermissions(PERMISSION_KEYS.PROPERTY_OWNERSHIPS_END)
  endOwnership(
    @Param('organizationId') organizationId: string,
    @Param('ownershipId') ownershipId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = endOwnershipRequestSchema.parse(body);
    return this.ownerships.endOwnership(
      organizationId,
      actor.membershipId!,
      actor.userId,
      ownershipId,
      parsed,
      request.correlationId,
    );
  }

  @Get('management-agreements')
  @RequirePermissions(PERMISSION_KEYS.MANAGEMENT_AGREEMENTS_LIST)
  listAgreements(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.agreements.listAgreements(organizationId, actor.membershipId!, {
      limit: parsed.limit,
      after: parsed.after,
      propertyId: typeof query.propertyId === 'string' ? query.propertyId : undefined,
    });
  }

  @Post('management-agreements')
  @RequirePermissions(PERMISSION_KEYS.MANAGEMENT_AGREEMENTS_CREATE)
  createAgreement(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = createManagementAgreementRequestSchema.parse(body);
    return this.agreements.createAgreement(
      organizationId,
      actor.membershipId!,
      actor.userId,
      parsed,
      request.correlationId,
    );
  }

  @Get('management-agreements/:agreementId')
  @RequirePermissions(PERMISSION_KEYS.MANAGEMENT_AGREEMENTS_VIEW)
  getAgreement(
    @Param('organizationId') organizationId: string,
    @Param('agreementId') agreementId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.agreements.getAgreement(organizationId, actor.membershipId!, agreementId);
  }

  @Patch('management-agreements/:agreementId')
  @RequirePermissions(PERMISSION_KEYS.MANAGEMENT_AGREEMENTS_UPDATE)
  patchAgreement(
    @Param('organizationId') organizationId: string,
    @Param('agreementId') agreementId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = patchManagementAgreementRequestSchema.parse(body);
    return this.agreements.patchAgreement(
      organizationId,
      actor.membershipId!,
      actor.userId,
      agreementId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }

  @Post('management-agreements/:agreementId/activate')
  @RequirePermissions(PERMISSION_KEYS.MANAGEMENT_AGREEMENTS_ACTIVATE)
  activateAgreement(
    @Param('organizationId') organizationId: string,
    @Param('agreementId') agreementId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = activateAgreementRequestSchema.parse(body ?? {});
    return this.agreements.activateAgreement(
      organizationId,
      actor.membershipId!,
      actor.userId,
      agreementId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }

  @Post('management-agreements/:agreementId/terminate')
  @RequirePermissions(PERMISSION_KEYS.MANAGEMENT_AGREEMENTS_TERMINATE)
  terminateAgreement(
    @Param('organizationId') organizationId: string,
    @Param('agreementId') agreementId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = terminateAgreementRequestSchema.parse(body);
    return this.agreements.terminateAgreement(
      organizationId,
      actor.membershipId!,
      actor.userId,
      agreementId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }
}
