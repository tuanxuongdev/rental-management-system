import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { MembershipStatus, SessionStatus, UserStatus } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.module';

@Injectable()
export class AuthUserValidator {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertActiveUser(
    userId: string,
    tokenVersion: number,
    sessionId: string,
    tokenOrganizationId: string | null,
    tokenMembershipId: string | null,
  ): Promise<{
    email: string;
    organizationId: string | null;
    membershipId: string | null;
  }> {
    const [user, session] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.userSession.findUnique({ where: { id: sessionId } }),
    ]);

    if (
      user === null ||
      user.status === UserStatus.DISABLED ||
      user.tokenVersion !== tokenVersion ||
      session === null ||
      session.userId !== userId ||
      session.status !== SessionStatus.ACTIVE
    ) {
      throw new UnauthorizedException({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    // Prefer live session org context over JWT claims (suspension clears session org).
    let organizationId = session.currentTenantId;
    let membershipId = session.currentMembershipId;

    // If JWT still carries org claims that the session no longer has, drop them.
    if (
      tokenMembershipId !== null &&
      (membershipId === null || membershipId !== tokenMembershipId)
    ) {
      organizationId = null;
      membershipId = null;
    }

    if (membershipId !== null) {
      const membership = await this.prisma.tenantMembership.findUnique({
        where: { id: membershipId },
      });
      if (
        membership === null ||
        membership.status !== MembershipStatus.ACTIVE ||
        (organizationId !== null && membership.tenantId !== organizationId) ||
        (tokenOrganizationId !== null &&
          membershipId === tokenMembershipId &&
          membership.tenantId !== tokenOrganizationId)
      ) {
        organizationId = null;
        membershipId = null;
      }
    }

    return { email: user.email, organizationId, membershipId };
  }
}
