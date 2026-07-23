import { randomUUID } from 'node:crypto';

import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus } from '@prisma/client';

import {
  type MemberSummary,
  type MembersCollection,
  normalizePaginationLimit,
  type PatchMemberRequest,
  PAGINATION_DEFAULT_LIMIT,
  SYSTEM_ROLE_KEYS,
} from '@rpm/contracts';

import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';

import { AuthorizationService } from './authorization.service';

@Injectable()
export class MembershipAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listMembers(
    organizationId: string,
    options?: { limit?: number; after?: string },
  ): Promise<MembersCollection> {
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);
    const members = await this.prisma.tenantMembership.findMany({
      where: {
        tenantId: organizationId,
        membershipType: 'WORKFORCE',
        ...(options?.after !== undefined ? { id: { gt: options.after } } : {}),
      },
      include: {
        user: true,
        membershipRoles: {
          where: {
            effectiveFrom: { lte: new Date() },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
          },
          include: { role: true },
        },
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });

    const pageItems = members.slice(0, limit);
    const hasMore = members.length > limit;
    const last = pageItems.at(-1);

    return {
      data: pageItems.map((item) => this.toMemberSummary(item)),
      page: {
        nextCursor: hasMore && last !== undefined ? last.id : null,
        previousCursor: null,
        limit,
      },
      meta: {},
    };
  }

  async getMember(organizationId: string, membershipId: string): Promise<MemberSummary> {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { id: membershipId, tenantId: organizationId, membershipType: 'WORKFORCE' },
      include: {
        user: true,
        membershipRoles: {
          where: {
            effectiveFrom: { lte: new Date() },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
          },
          include: { role: true },
        },
      },
    });

    if (membership === null) {
      throw new NotFoundException({
        message: 'Membership not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    return this.toMemberSummary(membership);
  }

  async patchMember(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    actorMembershipId: string,
    body: PatchMemberRequest,
    ifMatchVersion: number,
    correlationId?: string,
  ): Promise<MemberSummary> {
    const now = new Date();
    const existing = await this.prisma.tenantMembership.findFirst({
      where: { id: membershipId, tenantId: organizationId },
      include: {
        membershipRoles: {
          where: {
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          },
          include: { role: true },
        },
      },
    });

    if (existing === null) {
      throw new NotFoundException({
        message: 'Membership not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (existing.version !== ifMatchVersion) {
      throw new ConflictException({
        message: 'Membership version mismatch',
        code: 'VERSION_MISMATCH',
      });
    }

    if (body.roleIds !== undefined) {
      await this.authorization.assertCanAssignRoles(
        actorMembershipId,
        body.roleIds,
        organizationId,
      );

      const nextRoles = await this.prisma.role.findMany({
        where: { id: { in: body.roleIds } },
      });
      const nextRoleKeys = nextRoles.map((role) => role.key);
      const currentlyOwner = existing.membershipRoles.some(
        (item) => item.role.key === SYSTEM_ROLE_KEYS.OWNER,
      );
      if (currentlyOwner && !nextRoleKeys.includes(SYSTEM_ROLE_KEYS.OWNER)) {
        const wouldRemoveLastOwner = await this.wouldRemoveLastOwner(
          organizationId,
          membershipId,
          existing.membershipRoles.map((r) => r.role.key),
        );
        if (wouldRemoveLastOwner) {
          throw new ConflictException({
            message: 'Cannot remove the last Organization Owner role',
            code: 'LAST_ORGANIZATION_OWNER',
          });
        }
      }
    }

    if (body.status === 'SUSPENDED') {
      await this.authorization.assertPermission(
        actorMembershipId,
        organizationId,
        'members.suspend',
      );
      const wouldRemoveLastOwner = await this.wouldRemoveLastOwner(
        organizationId,
        membershipId,
        existing.membershipRoles.map((r) => r.role.key),
      );
      if (wouldRemoveLastOwner) {
        throw new ConflictException({
          message: 'Cannot suspend the last Organization Owner',
          code: 'LAST_ORGANIZATION_OWNER',
        });
      }
    }

    const before = {
      status: existing.status,
      roleIds: existing.membershipRoles.map((item) => item.roleId),
    };

    await this.transactions.run(async (tx) => {
      if (body.status !== undefined) {
        await tx.tenantMembership.update({
          where: { id: membershipId },
          data: {
            status: body.status as MembershipStatus,
            version: { increment: 1 },
          },
        });

        if (body.status === 'SUSPENDED') {
          await tx.userSession.updateMany({
            where: {
              currentMembershipId: membershipId,
              status: 'ACTIVE',
            },
            data: {
              currentTenantId: null,
              currentMembershipId: null,
              sessionVersion: { increment: 1 },
            },
          });
        }
      }

      if (body.roleIds !== undefined) {
        const now = new Date();
        await tx.membershipRole.updateMany({
          where: {
            membershipId,
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          },
          data: { effectiveTo: now },
        });

        for (const roleId of body.roleIds) {
          await tx.membershipRole.create({
            data: {
              id: randomUUID(),
              tenantId: organizationId,
              membershipId,
              roleId,
              assignedByUserId: actorUserId,
            },
          });
        }

        await tx.tenantMembership.update({
          where: { id: membershipId },
          data: { version: { increment: 1 } },
        });
      }
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'membership.update',
      outcome: 'SUCCESS',
      targetType: 'membership',
      targetId: membershipId,
      correlationId,
      changeSummary: {
        before,
        after: { status: body.status ?? existing.status, roleIds: body.roleIds ?? before.roleIds },
        reason: body.reason,
      },
    });

    return this.getMember(organizationId, membershipId);
  }

  private async wouldRemoveLastOwner(
    organizationId: string,
    membershipId: string,
    currentRoleKeys: string[],
  ): Promise<boolean> {
    if (!currentRoleKeys.includes(SYSTEM_ROLE_KEYS.OWNER)) {
      return false;
    }

    const ownerAssignments = await this.prisma.membershipRole.findMany({
      where: {
        tenantId: organizationId,
        role: { key: SYSTEM_ROLE_KEYS.OWNER },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
        membership: { status: MembershipStatus.ACTIVE },
      },
    });

    const otherOwners = ownerAssignments.filter((item) => item.membershipId !== membershipId);
    return otherOwners.length === 0;
  }

  private toMemberSummary(membership: {
    id: string;
    userId: string;
    membershipType: 'WORKFORCE' | 'RESIDENT';
    status: MembershipStatus;
    seedRole: 'OWNER' | 'ADMIN' | null;
    version: number;
    createdAt: Date;
    user: { email: string; displayName: string | null };
    membershipRoles: Array<{ role: { id: string; key: string; name: string } }>;
  }): MemberSummary {
    return {
      id: membership.id,
      userId: membership.userId,
      email: membership.user.email,
      displayName: membership.user.displayName,
      membershipType: membership.membershipType,
      status: membership.status,
      roles: membership.membershipRoles.map((item) => ({
        id: item.role.id,
        key: item.role.key,
        name: item.role.name,
      })),
      seedRole: membership.seedRole,
      version: membership.version,
      createdAt: membership.createdAt.toISOString(),
    };
  }
}
