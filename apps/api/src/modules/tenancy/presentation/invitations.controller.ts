import { Body, Controller, Inject, Param, Post, Req } from '@nestjs/common';

import { acceptInvitationRequestSchema } from '@rpm/contracts';

import { CurrentActor } from '../../../common/auth/current-actor.decorator';
import { TokenHashService } from '../../../infrastructure/crypto/crypto.services';
import { RateLimitService } from '../../../infrastructure/rate-limit/rate-limit.service';
import { AuthService } from '../../identity/application/auth.service';
import { InvitationService } from '../application/invitation.service';

import type { AuthActor } from '../../../common/auth/auth.types';
import type { Request } from 'express';

@Controller('invitations')
export class InvitationsController {
  constructor(
    @Inject(InvitationService) private readonly invitations: InvitationService,
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
    @Inject(TokenHashService) private readonly tokenHash: TokenHashService,
  ) {}

  @Post(':token/accept')
  async acceptInvitation(
    @Param('token') token: string,
    @Body() body: unknown,
    @CurrentActor() actor: AuthActor,
    @Req() request: Request,
  ) {
    const ipHash = this.tokenHash.hashIp(request.ip) ?? 'unknown';
    this.rateLimit.assertWithinLimit(`invite-accept:ip:${ipHash}`, 20, 60_000);
    this.rateLimit.assertWithinLimit(`invite-accept:user:${actor.userId}`, 10, 60_000);

    const parsed = acceptInvitationRequestSchema.parse(body);
    const accepted = await this.invitations.acceptInvitation(
      token,
      parsed,
      actor.userId,
      actor.email,
    );

    const tokenResponse = await this.authService.attachOrganizationToSession(
      actor.sessionId,
      accepted.membership.organizationId,
      accepted.membership.id,
    );

    return {
      ...accepted,
      accessToken: tokenResponse.accessToken,
      expiresIn: tokenResponse.expiresIn,
    };
  }
}
