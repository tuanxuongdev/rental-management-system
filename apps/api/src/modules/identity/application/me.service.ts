import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus, SessionStatus, UserStatus } from '@prisma/client';

import { type MeResponse } from '@rpm/contracts';

import { PrismaService } from '../../../infrastructure/prisma/prisma.module';

@Injectable()
export class MeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getMe(userId: string, sessionId: string): Promise<MeResponse> {
    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
      include: {
        user: true,
      },
    });

    if (session === null || session.userId !== userId || session.status !== SessionStatus.ACTIVE) {
      throw new NotFoundException({ message: 'Session not found', code: 'RESOURCE_NOT_FOUND' });
    }

    let membership = null;
    let organization = null;

    if (session.currentMembershipId !== null) {
      membership = await this.prisma.tenantMembership.findUnique({
        where: { id: session.currentMembershipId },
        include: { tenant: true },
      });

      if (membership !== null && membership.status === MembershipStatus.ACTIVE) {
        organization = {
          id: membership.tenant.id,
          displayName: membership.tenant.displayName,
          slug: membership.tenant.slug,
        };
      }
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.displayName,
        emailVerified: session.user.emailVerifiedAt !== null,
        status: session.user.status,
      },
      membership:
        membership !== null
          ? {
              id: membership.id,
              organizationId: membership.tenantId,
              membershipType: membership.membershipType,
              status: membership.status,
              seedRole: membership.seedRole,
            }
          : null,
      organization,
      roles:
        membership?.seedRole !== null && membership?.seedRole !== undefined
          ? [membership.seedRole]
          : [],
      permissionKeys: [],
      assurance: {
        level: session.acr,
        validUntil: session.absoluteExpiresAt.toISOString(),
      },
    };
  }

  async assertActiveUser(userId: string, tokenVersion: number): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      user === null ||
      user.status === UserStatus.DISABLED ||
      user.tokenVersion !== tokenVersion
    ) {
      throw new NotFoundException({ message: 'Unauthorized', code: 'AUTH_REQUIRED' });
    }
  }
}
