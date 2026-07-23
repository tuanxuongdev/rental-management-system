import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  GoneException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvitationPurpose, InvitationStatus, MembershipStatus, type Prisma } from '@prisma/client';

import {
  type AcceptInvitationRequest,
  type CreateInvitationRequest,
  type InvitationAcceptanceResponse,
  type InvitationResponse,
  type InvitationsCollection,
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  SYSTEM_ROLE_KEYS,
} from '@rpm/contracts';

import { normalizeEmail, TokenHashService } from '../../../infrastructure/crypto/crypto.services';
import { EmailService } from '../../../infrastructure/email/email.service';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';

import { AuthorizationService } from './authorization.service';
import { RbacSeedService } from './rbac-seed.service';

function parseProposedRoleIds(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

@Injectable()
export class InvitationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(TokenHashService) private readonly tokenHash: TokenHashService,
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(RbacSeedService) private readonly rbacSeed: RbacSeedService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
  ) {}

  async createInvitation(
    organizationId: string,
    inviterUserId: string,
    inviterMembershipId: string,
    body: CreateInvitationRequest,
    correlationId?: string,
  ): Promise<InvitationResponse> {
    const normalizedEmail = normalizeEmail(body.email);
    const expiresInHours = body.expiresInHours ?? 72;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    const rawToken = this.tokenHash.generateOpaqueToken();
    const tokenHash = this.tokenHash.hashToken(rawToken);

    const existingPending = await this.prisma.invitation.findFirst({
      where: {
        tenantId: organizationId,
        normalizedEmail,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingPending !== null) {
      throw new ConflictException({
        message: 'An invitation is already pending for this email',
        code: 'INVITATION_ALREADY_PENDING',
      });
    }

    const proposedRoleIds =
      body.proposedRoleIds !== undefined && body.proposedRoleIds.length > 0
        ? body.proposedRoleIds
        : [await this.rbacSeed.getSystemRoleId(SYSTEM_ROLE_KEYS.ADMIN)];

    // Invitees receive these roles on accept — same delegation rules as role assign.
    await this.authorization.assertCanAssignRoles(
      inviterMembershipId,
      proposedRoleIds,
      organizationId,
    );

    const invitation = await this.prisma.invitation.create({
      data: {
        tenantId: organizationId,
        email: body.email.trim(),
        normalizedEmail,
        purpose: InvitationPurpose.WORKFORCE,
        tokenHash,
        inviterUserId,
        expiresAt,
        message: body.message ?? null,
        proposedRoleIds,
      },
    });

    await this.email.send({
      to: normalizedEmail,
      subject: 'Organization invitation',
      body: `Invitation token (dev): ${rawToken}`,
      correlationId,
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId: inviterUserId,
      action: 'invitation.create',
      outcome: 'SUCCESS',
      targetType: 'invitation',
      targetId: invitation.id,
      correlationId,
      changeSummary: { email: normalizedEmail, proposedRoleIds },
    });

    return this.toInvitationResponse(invitation);
  }

  async listInvitations(
    organizationId: string,
    options?: { limit?: number; after?: string },
  ): Promise<InvitationsCollection> {
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);
    const invitations = await this.prisma.invitation.findMany({
      where: {
        tenantId: organizationId,
        ...(options?.after !== undefined ? { id: { gt: options.after } } : {}),
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });

    const pageItems = invitations.slice(0, limit);
    const hasMore = invitations.length > limit;
    const last = pageItems.at(-1);

    return {
      data: pageItems.map((invitation) => ({
        ...this.toInvitationResponse(invitation),
        proposedRoleIds: parseProposedRoleIds(invitation.proposedRoleIds),
      })),
      page: {
        nextCursor: hasMore && last !== undefined ? last.id : null,
        previousCursor: null,
        limit,
      },
      meta: {},
    };
  }

  async revokeInvitation(
    organizationId: string,
    invitationId: string,
    actorUserId: string,
    correlationId?: string,
  ): Promise<InvitationResponse> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, tenantId: organizationId },
    });

    if (invitation === null) {
      throw new NotFoundException({
        message: 'Invitation not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictException({
        message: 'Only pending invitations can be revoked',
        code: 'INVITATION_NOT_PENDING',
      });
    }

    const updated = await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.REVOKED },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'invitation.revoke',
      outcome: 'SUCCESS',
      targetType: 'invitation',
      targetId: invitationId,
      correlationId,
    });

    return this.toInvitationResponse(updated);
  }

  async resendInvitation(
    organizationId: string,
    invitationId: string,
    actorUserId: string,
    correlationId?: string,
  ): Promise<InvitationResponse> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, tenantId: organizationId },
    });

    if (invitation === null) {
      throw new NotFoundException({
        message: 'Invitation not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (invitation.status !== InvitationStatus.PENDING || invitation.expiresAt <= new Date()) {
      throw new ConflictException({
        message: 'Only pending, unexpired invitations can be resent',
        code: 'INVITATION_NOT_PENDING',
      });
    }

    const rawToken = this.tokenHash.generateOpaqueToken();
    const updated = await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { tokenHash: this.tokenHash.hashToken(rawToken) },
    });

    await this.email.send({
      to: invitation.normalizedEmail,
      subject: 'Organization invitation (resent)',
      body: `Invitation token (dev): ${rawToken}`,
      correlationId,
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'invitation.resend',
      outcome: 'SUCCESS',
      targetType: 'invitation',
      targetId: invitationId,
      correlationId,
    });

    return this.toInvitationResponse(updated);
  }

  async acceptInvitation(
    token: string,
    body: AcceptInvitationRequest,
    authenticatedUserId: string,
    authenticatedEmail: string,
  ): Promise<Omit<InvitationAcceptanceResponse, 'accessToken' | 'expiresIn'>> {
    const tokenHash = this.tokenHash.hashToken(token);
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
      include: { tenant: true },
    });

    if (invitation === null) {
      throw new HttpException(
        { message: 'Invitation token is invalid', code: 'TOKEN_INVALID' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new ConflictException({
        message: 'Invitation has already been used',
        code: 'INVITATION_ALREADY_USED',
      });
    }

    if (
      invitation.status === InvitationStatus.REVOKED ||
      invitation.status !== InvitationStatus.PENDING ||
      invitation.expiresAt <= new Date()
    ) {
      throw new GoneException({ message: 'Invitation has expired', code: 'TOKEN_EXPIRED' });
    }

    if (invitation.purpose !== InvitationPurpose.WORKFORCE) {
      throw new ConflictException({
        message: 'Invitation type is not supported',
        code: 'INVITATION_SCOPE_INVALID',
      });
    }

    if (normalizeEmail(authenticatedEmail) !== invitation.normalizedEmail) {
      throw new ConflictException({
        message:
          'Signed-in email does not match the invited email. Sign out and use the invited account.',
        code: 'INVITED_EMAIL_MISMATCH',
      });
    }

    let proposedRoleIds = parseProposedRoleIds(invitation.proposedRoleIds);
    if (proposedRoleIds.length === 0) {
      proposedRoleIds = [await this.rbacSeed.getSystemRoleId(SYSTEM_ROLE_KEYS.ADMIN)];
    }

    // Re-validate role IDs belong to this org / system templates (no cross-tenant grants).
    await this.authorization.assertRolesBelongToOrganization(invitation.tenantId, proposedRoleIds);

    const membership = await this.transactions.run(async (tx) => {
      const claimed = await tx.invitation.updateMany({
        where: {
          id: invitation.id,
          status: InvitationStatus.PENDING,
          expiresAt: { gt: new Date() },
        },
        data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
      });

      if (claimed.count !== 1) {
        throw new ConflictException({
          message: 'Invitation has already been used',
          code: 'INVITATION_ALREADY_USED',
        });
      }

      const existing = await tx.tenantMembership.findFirst({
        where: {
          tenantId: invitation.tenantId,
          userId: authenticatedUserId,
          membershipType: 'WORKFORCE',
        },
      });

      let membershipRecord;
      if (existing !== null) {
        if (existing.status === MembershipStatus.SUSPENDED) {
          throw new ConflictException({
            message: 'Membership is suspended and cannot accept this invitation',
            code: 'MEMBERSHIP_SUSPENDED',
          });
        }

        if (existing.status !== MembershipStatus.ACTIVE) {
          membershipRecord = await tx.tenantMembership.update({
            where: { id: existing.id },
            data: { status: MembershipStatus.ACTIVE },
          });
        } else {
          membershipRecord = existing;
        }
      } else {
        if (body.displayName !== undefined) {
          await tx.user.update({
            where: { id: authenticatedUserId },
            data: { displayName: body.displayName },
          });
        }

        membershipRecord = await tx.tenantMembership.create({
          data: {
            tenantId: invitation.tenantId,
            userId: authenticatedUserId,
            membershipType: 'WORKFORCE',
            status: MembershipStatus.ACTIVE,
          },
        });
      }

      const now = new Date();
      await tx.membershipRole.updateMany({
        where: {
          membershipId: membershipRecord.id,
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        },
        data: { effectiveTo: now },
      });

      for (const roleId of proposedRoleIds) {
        await tx.membershipRole.create({
          data: {
            id: randomUUID(),
            tenantId: invitation.tenantId,
            membershipId: membershipRecord.id,
            roleId,
            assignedByUserId: invitation.inviterUserId,
          },
        });
      }

      return membershipRecord;
    });

    await this.audit.record({
      tenantId: invitation.tenantId,
      actorUserId: authenticatedUserId,
      action: 'invitation.accept',
      outcome: 'SUCCESS',
      targetType: 'invitation',
      targetId: invitation.id,
      changeSummary: { membershipId: membership.id, proposedRoleIds },
    });

    return {
      membership: {
        id: membership.id,
        organizationId: membership.tenantId,
        status: membership.status,
      },
      organizationSummary: {
        id: invitation.tenant.id,
        displayName: invitation.tenant.displayName,
        slug: invitation.tenant.slug,
      },
    };
  }

  private toInvitationResponse(invitation: {
    id: string;
    email: string;
    purpose: InvitationPurpose;
    status: InvitationStatus;
    expiresAt: Date;
    createdAt: Date;
  }): InvitationResponse {
    return {
      id: invitation.id,
      email: invitation.email,
      purpose: invitation.purpose,
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    };
  }
}
