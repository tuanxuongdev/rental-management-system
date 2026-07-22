import { Body, Controller, Inject, Param, Post, Req } from '@nestjs/common';

import { acceptInvitationRequestSchema } from '@rpm/contracts';

import { Public } from '../../../common/auth/public.decorator';
import { JwtService } from '../../../infrastructure/auth/jwt.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { InvitationService } from '../application/invitation.service';

import type { Request } from 'express';

@Controller('invitations')
export class InvitationsController {
  constructor(
    @Inject(InvitationService) private readonly invitations: InvitationService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post(':token/accept')
  async acceptInvitation(
    @Param('token') token: string,
    @Body() body: unknown,
    @Req() request: Request,
  ) {
    const parsed = acceptInvitationRequestSchema.parse(body);

    let authenticatedUserId: string | null = null;
    let authenticatedEmail: string | null = null;
    const authHeader = request.header('authorization');

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const claims = await this.jwt.verifyAccessToken(authHeader.slice('Bearer '.length));
        const user = await this.prisma.user.findUnique({ where: { id: claims.sub } });
        authenticatedUserId = claims.sub;
        authenticatedEmail = user?.email ?? null;
      } catch {
        authenticatedUserId = null;
        authenticatedEmail = null;
      }
    }

    return this.invitations.acceptInvitation(
      token,
      parsed,
      authenticatedUserId,
      authenticatedEmail,
    );
  }
}
