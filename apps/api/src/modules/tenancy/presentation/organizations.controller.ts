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
  UseGuards,
} from '@nestjs/common';

import {
  createInvitationRequestSchema,
  createOrganizationRequestSchema,
  createPropertyAccessGrantRequestSchema,
  createRoleRequestSchema,
  endPropertyAccessGrantRequestSchema,
  paginationQuerySchema,
  patchMemberRequestSchema,
  patchOrganizationSettingsRequestSchema,
  patchRoleRequestSchema,
  PERMISSION_KEYS,
} from '@rpm/contracts';

import { CurrentActor } from '../../../common/auth/current-actor.decorator';
import { requireIfMatchVersion } from '../../../common/auth/if-match';
import { OrganizationPathGuard } from '../../../common/auth/organization.guards';
import { PermissionsGuard } from '../../../common/auth/permissions.guard';
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../../common/auth/require-permissions.decorator';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuthService } from '../../identity/application/auth.service';
import { InvitationService } from '../application/invitation.service';
import { MembershipAdminService } from '../application/membership-admin.service';
import { OrganizationSettingsService } from '../application/organization-settings.service';
import { OrganizationService } from '../application/organization.service';
import { PropertyAccessGrantService } from '../application/property-access-grant.service';
import { RoleAdminService } from '../application/role-admin.service';

import type { AuthActor } from '../../../common/auth/auth.types';
import type { RequestWithCorrelation } from '../../../common/context/correlation-id.middleware';

@Controller('organizations')
export class OrganizationsController {
  constructor(
    @Inject(OrganizationService) private readonly organizations: OrganizationService,
    @Inject(InvitationService) private readonly invitations: InvitationService,
    @Inject(MembershipAdminService) private readonly members: MembershipAdminService,
    @Inject(RoleAdminService) private readonly roles: RoleAdminService,
    @Inject(OrganizationSettingsService) private readonly settings: OrganizationSettingsService,
    @Inject(PropertyAccessGrantService)
    private readonly propertyAccessGrants: PropertyAccessGrantService,
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Post()
  async createOrganization(
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = createOrganizationRequestSchema.parse(body);
    const organization = await this.organizations.createOrganization(
      actor.userId,
      parsed,
      request.correlationId,
    );

    const membership = await this.prisma.tenantMembership.findFirstOrThrow({
      where: { tenantId: organization.id, userId: actor.userId },
    });

    const token = await this.authService.attachOrganizationToSession(
      actor.sessionId,
      organization.id,
      membership.id,
    );

    return { organization, ...token };
  }

  @Get(':organizationId')
  @UseGuards(OrganizationPathGuard, PermissionsGuard)
  @RequirePermissions(PERMISSION_KEYS.ORGANIZATION_PROFILE_VIEW)
  getOrganization(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.organizations.getOrganization(organizationId, actor.organizationId);
  }

  @Get(':organizationId/members')
  @UseGuards(OrganizationPathGuard, PermissionsGuard)
  @RequirePermissions(PERMISSION_KEYS.MEMBERS_LIST)
  listMembers(
    @Param('organizationId') organizationId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.members.listMembers(organizationId, {
      limit: parsed.limit,
      after: parsed.after,
    });
  }

  @Get(':organizationId/members/:membershipId')
  @UseGuards(OrganizationPathGuard, PermissionsGuard)
  @RequirePermissions(PERMISSION_KEYS.MEMBERS_VIEW)
  getMember(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.members.getMember(organizationId, membershipId);
  }

  @Patch(':organizationId/members/:membershipId')
  @UseGuards(OrganizationPathGuard, PermissionsGuard)
  @RequirePermissions(PERMISSION_KEYS.MEMBERS_UPDATE)
  patchMember(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = patchMemberRequestSchema.parse(body);
    return this.members.patchMember(
      organizationId,
      membershipId,
      actor.userId,
      actor.membershipId!,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }

  @Get(':organizationId/members/:membershipId/property-access-grants')
  @UseGuards(OrganizationPathGuard, PermissionsGuard)
  @RequireAnyPermissions(
    PERMISSION_KEYS.PROPERTIES_ASSIGN_STAFF,
    PERMISSION_KEYS.MEMBERS_ROLES_ASSIGN,
  )
  listPropertyAccessGrants(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.propertyAccessGrants.listGrants(organizationId, membershipId, {
      limit: parsed.limit,
      after: parsed.after,
    });
  }

  @Post(':organizationId/members/:membershipId/property-access-grants')
  @UseGuards(OrganizationPathGuard, PermissionsGuard)
  @RequireAnyPermissions(
    PERMISSION_KEYS.PROPERTIES_ASSIGN_STAFF,
    PERMISSION_KEYS.MEMBERS_ROLES_ASSIGN,
  )
  createPropertyAccessGrant(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = createPropertyAccessGrantRequestSchema.parse(body);
    return this.propertyAccessGrants.createGrant(
      organizationId,
      membershipId,
      actor.userId,
      parsed,
      request.correlationId,
    );
  }

  @Post(':organizationId/members/:membershipId/property-access-grants/:grantId/end')
  @UseGuards(OrganizationPathGuard, PermissionsGuard)
  @RequireAnyPermissions(
    PERMISSION_KEYS.PROPERTIES_ASSIGN_STAFF,
    PERMISSION_KEYS.MEMBERS_ROLES_ASSIGN,
  )
  endPropertyAccessGrant(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Param('grantId') grantId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = endPropertyAccessGrantRequestSchema.parse(body ?? {});
    return this.propertyAccessGrants.endGrant(
      organizationId,
      membershipId,
      grantId,
      actor.userId,
      parsed,
      request.correlationId,
    );
  }

  @Get(':organizationId/roles')
  @UseGuards(OrganizationPathGuard, PermissionsGuard)
  @RequirePermissions(PERMISSION_KEYS.ROLES_LIST)
  listRoles(
    @Param('organizationId') organizationId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.roles.listRoles(organizationId, {
      limit: parsed.limit,
      after: parsed.after,
    });
  }

  @Post(':organizationId/roles')
  @UseGuards(OrganizationPathGuard, PermissionsGuard)
  @RequirePermissions(PERMISSION_KEYS.ROLES_CREATE)
  createRole(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = createRoleRequestSchema.parse(body);
    return this.roles.createRole(
      organizationId,
      actor.membershipId!,
      actor.userId,
      parsed,
      request.correlationId,
    );
  }

  @Patch(':organizationId/roles/:roleId')
  @UseGuards(OrganizationPathGuard, PermissionsGuard)
  @RequirePermissions(PERMISSION_KEYS.ROLES_UPDATE)
  patchRole(
    @Param('organizationId') organizationId: string,
    @Param('roleId') roleId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = patchRoleRequestSchema.parse(body);
    return this.roles.patchRole(
      organizationId,
      roleId,
      actor.membershipId!,
      actor.userId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }

  @Get(':organizationId/permissions')
  @UseGuards(OrganizationPathGuard, PermissionsGuard)
  @RequirePermissions(PERMISSION_KEYS.ROLES_LIST)
  listPermissions(@Param('organizationId') organizationId: string) {
    return this.roles.listPermissions(organizationId);
  }

  @Get(':organizationId/settings')
  @UseGuards(OrganizationPathGuard, PermissionsGuard)
  @RequirePermissions(PERMISSION_KEYS.ORGANIZATION_PROFILE_VIEW)
  getSettings(@Param('organizationId') organizationId: string) {
    return this.settings.getSettings(organizationId);
  }

  @Patch(':organizationId/settings')
  @UseGuards(OrganizationPathGuard, PermissionsGuard)
  @RequirePermissions(PERMISSION_KEYS.ORGANIZATION_PROFILE_UPDATE)
  patchSettings(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = patchOrganizationSettingsRequestSchema.parse(body);
    return this.settings.patchSettings(
      organizationId,
      actor.userId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }

  @Post(':organizationId/invitations')
  @UseGuards(OrganizationPathGuard, PermissionsGuard)
  @RequirePermissions(PERMISSION_KEYS.MEMBERS_INVITE)
  createInvitation(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = createInvitationRequestSchema.parse(body);
    return this.invitations.createInvitation(
      organizationId,
      actor.userId,
      actor.membershipId!,
      parsed,
      request.correlationId,
    );
  }

  @Get(':organizationId/invitations')
  @UseGuards(OrganizationPathGuard, PermissionsGuard)
  @RequirePermissions(PERMISSION_KEYS.MEMBERS_INVITE)
  listInvitations(
    @Param('organizationId') organizationId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.invitations.listInvitations(organizationId, {
      limit: parsed.limit,
      after: parsed.after,
    });
  }

  @Post(':organizationId/invitations/:invitationId/revoke')
  @UseGuards(OrganizationPathGuard, PermissionsGuard)
  @RequirePermissions(PERMISSION_KEYS.MEMBERS_INVITE)
  revokeInvitation(
    @Param('organizationId') organizationId: string,
    @Param('invitationId') invitationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
  ) {
    return this.invitations.revokeInvitation(
      organizationId,
      invitationId,
      actor.userId,
      request.correlationId,
    );
  }

  @Post(':organizationId/invitations/:invitationId/resend')
  @UseGuards(OrganizationPathGuard, PermissionsGuard)
  @RequirePermissions(PERMISSION_KEYS.MEMBERS_INVITE)
  resendInvitation(
    @Param('organizationId') organizationId: string,
    @Param('invitationId') invitationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
  ) {
    return this.invitations.resendInvitation(
      organizationId,
      invitationId,
      actor.userId,
      request.correlationId,
    );
  }
}
