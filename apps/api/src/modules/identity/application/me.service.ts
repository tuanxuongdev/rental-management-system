import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus, SessionStatus, UserStatus } from '@prisma/client';

import { type MeResponse } from '@rpm/contracts';

import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuthorizationService } from '../../tenancy/application/authorization.service';

@Injectable()
export class MeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
  ) {}

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
    let roles: string[] = [];
    let permissionKeys: string[] = [];
    let isReadOnly = false;

    if (session.currentMembershipId !== null) {
      const current = await this.prisma.tenantMembership.findUnique({
        where: { id: session.currentMembershipId },
        include: { tenant: true },
      });

      // Suspended (or missing) membership: treat as no active org context
      if (current !== null && current.status === MembershipStatus.ACTIVE) {
        membership = current;
        organization = {
          id: current.tenant.id,
          displayName: current.tenant.displayName,
          slug: current.tenant.slug,
        };
        roles = await this.authorization.getEffectiveRoleKeys(current.id);
        permissionKeys = await this.authorization.getEffectivePermissionKeys(current.id);
        isReadOnly = await this.authorization.isReadOnly(current.id);
      }
    }

    const activeMemberships = await this.prisma.tenantMembership.findMany({
      where: {
        userId,
        membershipType: 'WORKFORCE',
        status: MembershipStatus.ACTIVE,
      },
      include: {
        tenant: true,
        membershipRoles: {
          where: {
            effectiveFrom: { lte: new Date() },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
          },
          include: { role: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

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
      memberships: activeMemberships.map((item) => ({
        id: item.id,
        organizationId: item.tenantId,
        organizationDisplayName: item.tenant.displayName,
        organizationSlug: item.tenant.slug,
        status: item.status,
        roles: item.membershipRoles.map((assignment) => assignment.role.key),
      })),
      roles,
      permissionKeys,
      isReadOnly,
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
