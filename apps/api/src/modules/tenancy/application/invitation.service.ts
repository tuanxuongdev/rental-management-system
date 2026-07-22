import {
  ConflictException,
  GoneException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InvitationPurpose, InvitationStatus, MembershipStatus } from '@prisma/client';

import {
  type AcceptInvitationRequest,
  type CreateInvitationRequest,
  type InvitationAcceptanceResponse,
  type InvitationResponse,
} from '@rpm/contracts';

import { normalizeEmail, TokenHashService } from '../../../infrastructure/crypto/crypto.services';
import { EmailService } from '../../../infrastructure/email/email.service';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class InvitationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(TokenHashService) private readonly tokenHash: TokenHashService,
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async createInvitation(
    organizationId: string,
    inviterUserId: string,
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
      changeSummary: { email: normalizedEmail },
    });

    return this.toInvitationResponse(invitation);
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

      if (existing !== null) {
        if (existing.status === MembershipStatus.SUSPENDED) {
          throw new ConflictException({
            message: 'Membership is suspended and cannot accept this invitation',
            code: 'MEMBERSHIP_SUSPENDED',
          });
        }

        if (existing.status !== MembershipStatus.ACTIVE) {
          return tx.tenantMembership.update({
            where: { id: existing.id },
            data: { status: MembershipStatus.ACTIVE },
          });
        }

        return existing;
      }

      if (body.displayName !== undefined) {
        await tx.user.update({
          where: { id: authenticatedUserId },
          data: { displayName: body.displayName },
        });
      }

      return tx.tenantMembership.create({
        data: {
          tenantId: invitation.tenantId,
          userId: authenticatedUserId,
          membershipType: 'WORKFORCE',
          status: MembershipStatus.ACTIVE,
        },
      });
    });

    await this.audit.record({
      tenantId: invitation.tenantId,
      actorUserId: authenticatedUserId,
      action: 'invitation.accept',
      outcome: 'SUCCESS',
      targetType: 'invitation',
      targetId: invitation.id,
      changeSummary: { membershipId: membership.id },
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
