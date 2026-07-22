import {
  ConflictException,
  GoneException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InvitationPurpose, InvitationStatus, MembershipStatus, UserStatus } from '@prisma/client';

import {
  type AcceptInvitationRequest,
  type CreateInvitationRequest,
  type InvitationAcceptanceResponse,
  type InvitationResponse,
} from '@rpm/contracts';

import {
  normalizeEmail,
  PasswordHasherService,
  TokenHashService,
} from '../../../infrastructure/crypto/crypto.services';
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
    @Inject(PasswordHasherService) private readonly passwords: PasswordHasherService,
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
    authenticatedUserId: string | null,
    authenticatedEmail: string | null,
  ): Promise<InvitationAcceptanceResponse> {
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

    if (invitation.status !== InvitationStatus.PENDING || invitation.expiresAt <= new Date()) {
      throw new GoneException({ message: 'Invitation has expired', code: 'TOKEN_EXPIRED' });
    }

    if (invitation.purpose !== InvitationPurpose.WORKFORCE) {
      throw new ConflictException({
        message: 'Invitation type is not supported',
        code: 'INVITATION_SCOPE_INVALID',
      });
    }

    let userId = authenticatedUserId;

    if (userId === null) {
      if (body.password === undefined) {
        throw new UnauthorizedException({
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
      }

      const policy = this.passwords.validatePolicy(body.password);
      if (!policy.valid) {
        throw new HttpException(
          { message: policy.message, code: 'PASSWORD_POLICY_VIOLATION' },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const passwordHash = await this.passwords.hashPassword(body.password);
      const createdUser = await this.transactions.run(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: invitation.email,
            normalizedEmail: invitation.normalizedEmail,
            displayName: body.displayName ?? invitation.email.split('@')[0] ?? 'User',
            status: UserStatus.ACTIVE,
            emailVerifiedAt: new Date(),
          },
        });

        await tx.userCredential.create({
          data: { userId: user.id, provider: 'LOCAL', passwordHash },
        });

        return user;
      });
      userId = createdUser.id;
    } else if (
      authenticatedEmail !== null &&
      normalizeEmail(authenticatedEmail) !== invitation.normalizedEmail
    ) {
      throw new ConflictException({
        message: 'Signed-in email does not match the invited email',
        code: 'INVITED_EMAIL_MISMATCH',
      });
    }

    const membership = await this.transactions.run(async (tx) => {
      const existing = await tx.tenantMembership.findFirst({
        where: {
          tenantId: invitation.tenantId,
          userId,
          membershipType: 'WORKFORCE',
        },
      });

      const activeMembership =
        existing ??
        (await tx.tenantMembership.create({
          data: {
            tenantId: invitation.tenantId,
            userId,
            membershipType: 'WORKFORCE',
            status: MembershipStatus.ACTIVE,
          },
        }));

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
      });

      return activeMembership;
    });

    await this.audit.record({
      tenantId: invitation.tenantId,
      actorUserId: userId,
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
