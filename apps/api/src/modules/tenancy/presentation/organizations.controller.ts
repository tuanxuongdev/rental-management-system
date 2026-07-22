import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';

import { createInvitationRequestSchema, createOrganizationRequestSchema } from '@rpm/contracts';

import { CurrentActor } from '../../../common/auth/current-actor.decorator';
import { OrganizationPathGuard } from '../../../common/auth/organization.guards';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuthService } from '../../identity/application/auth.service';
import { InvitationService } from '../application/invitation.service';
import { OrganizationService } from '../application/organization.service';

import type { AuthActor } from '../../../common/auth/auth.types';
import type { RequestWithCorrelation } from '../../../common/context/correlation-id.middleware';

@Controller('organizations')
export class OrganizationsController {
  constructor(
    @Inject(OrganizationService) private readonly organizations: OrganizationService,
    @Inject(InvitationService) private readonly invitations: InvitationService,
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
  @UseGuards(OrganizationPathGuard)
  getOrganization(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.organizations.getOrganization(organizationId, actor.organizationId);
  }

  @Post(':organizationId/invitations')
  @UseGuards(OrganizationPathGuard)
  async createInvitation(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = createInvitationRequestSchema.parse(body);
    await this.organizations.assertCanInvite(organizationId, actor.userId);
    return this.invitations.createInvitation(
      organizationId,
      actor.userId,
      parsed,
      request.correlationId,
    );
  }
}
