import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  GoneException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  MembershipStatus,
  MfaMethodStatus,
  MfaMethodType,
  OneTimeTokenPurpose,
  SessionStatus,
  UserStatus,
} from '@prisma/client';
import { TOTP } from 'otpauth';

import {
  GENERIC_ACCEPTED_MESSAGE,
  GENERIC_AUTH_FAILURE_MESSAGE,
  type EmailVerifyRequest,
  type GenericAcceptedResponse,
  type LoginRequest,
  type LoginResponse,
  type LogoutAllRequest,
  type MfaChallengeRequest,
  type MfaRequiredResponse,
  type PasswordForgotRequest,
  type PasswordResetRequest,
  type TokenResponse,
} from '@rpm/contracts';

import { API_CONFIG } from '../../../bootstrap/api-config.module';
import { JwtService } from '../../../infrastructure/auth/jwt.service';
import { RefreshCookieService } from '../../../infrastructure/auth/refresh-cookie.service';
import {
  normalizeEmail,
  PasswordHasherService,
  SecretEncryptionService,
  TokenHashService,
} from '../../../infrastructure/crypto/crypto.services';
import { EmailService } from '../../../infrastructure/email/email.service';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { RateLimitService } from '../../../infrastructure/rate-limit/rate-limit.service';
import { AuditService } from '../../audit/audit.service';

import type { ApiConfig } from '../../../bootstrap/configuration';
import type { Request, Response } from 'express';

const GENERIC_CREDENTIALS_ERROR = {
  message: GENERIC_AUTH_FAILURE_MESSAGE,
  code: 'CREDENTIALS_INVALID',
} as const;

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(PasswordHasherService) private readonly passwords: PasswordHasherService,
    @Inject(TokenHashService) private readonly tokenHash: TokenHashService,
    @Inject(SecretEncryptionService) private readonly secrets: SecretEncryptionService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(RefreshCookieService) private readonly refreshCookies: RefreshCookieService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}

  async login(
    body: LoginRequest,
    request: Request,
    response: Response,
    correlationId?: string,
  ): Promise<LoginResponse | MfaRequiredResponse> {
    const ipHash = this.tokenHash.hashIp(request.ip);
    this.rateLimit.assertWithinLimit(`login:ip:${ipHash ?? 'unknown'}`, 20, 60_000);
    this.rateLimit.assertWithinLimit(`login:email:${normalizeEmail(body.email)}`, 10, 60_000);

    const normalizedEmail = normalizeEmail(body.email);
    const user = await this.prisma.user.findUnique({
      where: { normalizedEmail },
      include: {
        credentials: { where: { provider: 'LOCAL', revokedAt: null }, take: 1 },
        mfaMethods: { where: { status: MfaMethodStatus.ACTIVE, methodType: MfaMethodType.TOTP } },
        memberships: {
          where: { status: MembershipStatus.ACTIVE, membershipType: 'WORKFORCE' },
          include: { tenant: true },
        },
      },
    });

    const credential = user?.credentials[0];
    const passwordValid =
      user !== null &&
      credential?.passwordHash !== null &&
      credential?.passwordHash !== undefined &&
      (await this.passwords.verifyPassword(body.password, credential.passwordHash));

    if (
      user === null ||
      credential === undefined ||
      !passwordValid ||
      user.status === UserStatus.DISABLED
    ) {
      await this.audit.record({
        action: 'auth.login.failure',
        outcome: 'FAILURE',
        reasonCode: 'CREDENTIALS_INVALID',
        correlationId,
        ipHash,
      });
      throw new UnauthorizedException(GENERIC_CREDENTIALS_ERROR);
    }

    if (user.mfaMethods.length > 0) {
      const loginTransactionId = randomUUID();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const pendingContext = JSON.stringify({
        email: normalizedEmail,
        organizationId: body.organizationId ?? null,
        deviceName: body.deviceName ?? null,
      });

      await this.prisma.oneTimeToken.create({
        data: {
          userId: user.id,
          purpose: OneTimeTokenPurpose.LOGIN_MFA,
          targetEmail: pendingContext,
          tokenHash: this.tokenHash.hashToken(loginTransactionId),
          expiresAt,
        },
      });

      return {
        challengeId: loginTransactionId,
        methods: ['TOTP'],
        expiresAt: expiresAt.toISOString(),
        loginTransactionId,
      };
    }

    return this.completeLogin(user.id, body, request, response, correlationId, ['pwd']);
  }

  async completeMfaChallenge(
    body: MfaChallengeRequest,
    request: Request,
    response: Response,
    correlationId?: string,
  ): Promise<LoginResponse> {
    this.rateLimit.assertWithinLimit(`mfa:ip:${request.ip ?? 'unknown'}`, 20, 60_000);

    if (body.challengeId !== body.loginTransactionId) {
      throw new UnauthorizedException({
        message: 'MFA challenge is invalid or expired',
        code: 'MFA_CHALLENGE_INVALID',
      });
    }

    const tokenRecord = await this.prisma.oneTimeToken.findFirst({
      where: {
        purpose: OneTimeTokenPurpose.LOGIN_MFA,
        tokenHash: this.tokenHash.hashToken(body.loginTransactionId),
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (tokenRecord === null) {
      throw new UnauthorizedException({
        message: 'MFA challenge is invalid or expired',
        code: 'MFA_CHALLENGE_INVALID',
      });
    }

    await this.verifyMfaProof(tokenRecord.userId, body);

    const consumed = await this.prisma.oneTimeToken.updateMany({
      where: {
        id: tokenRecord.id,
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });

    if (consumed.count !== 1) {
      throw new UnauthorizedException({
        message: 'MFA challenge is invalid or expired',
        code: 'MFA_CHALLENGE_INVALID',
      });
    }

    const pending = this.parsePendingLoginContext(tokenRecord.targetEmail);

    return this.completeLogin(
      tokenRecord.userId,
      {
        email: pending.email,
        password: '',
        organizationId: pending.organizationId ?? undefined,
        deviceName: pending.deviceName ?? undefined,
      },
      request,
      response,
      correlationId,
      ['pwd', 'otp'],
      false,
    );
  }

  private parsePendingLoginContext(raw: string): {
    email: string;
    organizationId: string | null;
    deviceName: string | null;
  } {
    try {
      const parsed = JSON.parse(raw) as {
        email?: string;
        organizationId?: string | null;
        deviceName?: string | null;
      };
      if (typeof parsed.email === 'string') {
        return {
          email: parsed.email,
          organizationId: parsed.organizationId ?? null,
          deviceName: parsed.deviceName ?? null,
        };
      }
    } catch {
      // Legacy plain email storage
    }

    return { email: raw, organizationId: null, deviceName: null };
  }

  private async verifyMfaProof(userId: string, body: MfaChallengeRequest): Promise<void> {
    if (body.method === 'RECOVERY_CODE') {
      // Recovery-code enrollment/consumption is deferred until a real multi-code store exists.
      throw new UnauthorizedException({
        message: 'MFA method not available',
        code: 'MFA_METHOD_UNSUPPORTED',
      });
    }

    const method = await this.prisma.mfaMethod.findFirst({
      where: {
        userId,
        methodType: MfaMethodType.TOTP,
        status: MfaMethodStatus.ACTIVE,
      },
    });

    if (method === null || method.encryptedSecret === null) {
      throw new UnauthorizedException({
        message: 'MFA method not available',
        code: 'MFA_NOT_ENROLLED',
      });
    }

    const secret = this.secrets.decrypt(method.encryptedSecret);
    const totp = new TOTP({ secret });
    const delta = totp.validate({ token: body.proof, window: 1 });
    if (delta === null) {
      throw new UnauthorizedException({
        message: GENERIC_AUTH_FAILURE_MESSAGE,
        code: 'CREDENTIALS_INVALID',
      });
    }
  }

  private async completeLogin(
    userId: string,
    body: LoginRequest,
    request: Request,
    response: Response,
    correlationId: string | undefined,
    amr: string[],
    skipMembershipResolution = false,
  ): Promise<LoginResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        memberships: {
          where: { status: MembershipStatus.ACTIVE, membershipType: 'WORKFORCE' },
          include: { tenant: true },
        },
      },
    });

    let selectedMembership = user.memberships[0] ?? null;

    if (!skipMembershipResolution && body.organizationId !== undefined) {
      selectedMembership =
        user.memberships.find((membership) => membership.tenantId === body.organizationId) ?? null;
      if (selectedMembership === null) {
        throw new UnauthorizedException(GENERIC_CREDENTIALS_ERROR);
      }
    } else if (!skipMembershipResolution && body.organizationId === undefined) {
      if (user.memberships.length > 1) {
        throw new UnprocessableEntityException({
          message: 'Organization selection is required',
          code: 'ORGANIZATION_SELECTION_REQUIRED',
        });
      }
      selectedMembership = user.memberships[0] ?? null;
    }

    const now = new Date();
    const refreshDays = this.config.auth.refreshTokenTtlDays;
    const absoluteExpiresAt = new Date(now.getTime() + refreshDays * 24 * 60 * 60 * 1000);
    const familyId = randomUUID();
    const sessionId = randomUUID();
    const refreshRaw = this.tokenHash.generateOpaqueToken();
    const refreshHash = this.tokenHash.hashToken(refreshRaw);

    await this.transactions.run(async (tx) => {
      await tx.userSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          currentTenantId: selectedMembership?.tenantId ?? null,
          currentMembershipId: selectedMembership?.id ?? null,
          tokenFamilyId: familyId,
          authTime: now,
          amr,
          acr: amr.includes('otp') ? '2' : '1',
          deviceName: body.deviceName ?? null,
          userAgentSummary: request.header('user-agent')?.slice(0, 200) ?? null,
          ipHash: this.tokenHash.hashIp(request.ip),
          expiresAt: absoluteExpiresAt,
          absoluteExpiresAt,
        },
      });

      await tx.refreshToken.create({
        data: {
          sessionId,
          familyId,
          tokenHash: refreshHash,
          expiresAt: absoluteExpiresAt,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: now },
      });
    });

    const { token, expiresIn } = await this.jwt.signAccessToken({
      sub: user.id,
      sid: sessionId,
      org_id: selectedMembership?.tenantId ?? null,
      membership_id: selectedMembership?.id ?? null,
      auth_time: Math.floor(now.getTime() / 1000),
      amr,
      acr: amr.includes('otp') ? '2' : '1',
      token_version: user.tokenVersion,
    });

    this.refreshCookies.setRefreshCookie(response, refreshRaw, absoluteExpiresAt);

    await this.audit.record({
      tenantId: selectedMembership?.tenantId ?? null,
      actorUserId: user.id,
      sessionId,
      action: 'auth.login.success',
      outcome: 'SUCCESS',
      correlationId,
      ipHash: this.tokenHash.hashIp(request.ip),
    });

    return {
      accessToken: token,
      expiresIn,
      session: {
        id: sessionId,
        deviceName: body.deviceName ?? null,
        lastActiveAt: now.toISOString(),
        current: true,
      },
      organization:
        selectedMembership !== null
          ? {
              id: selectedMembership.tenant.id,
              displayName: selectedMembership.tenant.displayName,
              slug: selectedMembership.tenant.slug,
            }
          : null,
    };
  }

  async refresh(request: Request, response: Response): Promise<TokenResponse> {
    this.rateLimit.assertWithinLimit(`refresh:ip:${request.ip ?? 'unknown'}`, 60, 60_000);

    const refreshRaw = this.refreshCookies.readRefreshToken(request);
    if (refreshRaw === undefined) {
      throw new UnauthorizedException({
        message: 'Refresh token is invalid',
        code: 'REFRESH_TOKEN_INVALID',
      });
    }

    const refreshHash = this.tokenHash.hashToken(refreshRaw);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: refreshHash },
      include: {
        session: {
          include: {
            user: true,
          },
        },
      },
    });

    if (existing === null || existing.revokedAt !== null || existing.expiresAt <= new Date()) {
      throw new UnauthorizedException({
        message: 'Refresh token is invalid',
        code: 'REFRESH_TOKEN_INVALID',
      });
    }

    if (existing.consumedAt !== null) {
      await this.revokeFamily(existing.familyId, 'REFRESH_TOKEN_REUSED');
      throw new UnauthorizedException({
        message: 'Refresh token reuse detected',
        code: 'REFRESH_TOKEN_REUSED',
      });
    }

    const session = existing.session;
    if (session.status !== SessionStatus.ACTIVE || session.user.status === UserStatus.DISABLED) {
      throw new UnauthorizedException({
        message: 'Refresh token is invalid',
        code: 'REFRESH_TOKEN_INVALID',
      });
    }

    const newRefreshRaw = this.tokenHash.generateOpaqueToken();
    const newRefreshHash = this.tokenHash.hashToken(newRefreshRaw);
    const now = new Date();

    await this.transactions.run(async (tx) => {
      const current = await tx.refreshToken.findUnique({ where: { id: existing.id } });
      if (current === null || current.consumedAt !== null) {
        throw new ConflictException({
          message: 'Concurrent refresh detected',
          code: 'REFRESH_CONCURRENT',
        });
      }

      const replacement = await tx.refreshToken.create({
        data: {
          sessionId: session.id,
          familyId: existing.familyId,
          tokenHash: newRefreshHash,
          expiresAt: session.absoluteExpiresAt,
        },
      });

      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { consumedAt: now, replacedById: replacement.id },
      });

      await tx.userSession.update({
        where: { id: session.id },
        data: { lastActiveAt: now },
      });
    });

    const { token, expiresIn } = await this.jwt.signAccessToken({
      sub: session.userId,
      sid: session.id,
      org_id: session.currentTenantId,
      membership_id: session.currentMembershipId,
      auth_time: Math.floor(session.authTime.getTime() / 1000),
      amr: session.amr,
      acr: session.acr,
      token_version: session.user.tokenVersion,
    });

    this.refreshCookies.setRefreshCookie(response, newRefreshRaw, session.absoluteExpiresAt);

    return {
      accessToken: token,
      expiresIn,
      organizationId: session.currentTenantId,
    };
  }

  async logout(
    request: Request,
    response: Response,
    userId: string,
    sessionId: string,
  ): Promise<void> {
    await this.revokeSession(sessionId, 'LOGOUT');
    this.refreshCookies.clearRefreshCookie(response);

    await this.audit.record({
      actorUserId: userId,
      sessionId,
      action: 'auth.logout',
      outcome: 'SUCCESS',
      ipHash: this.tokenHash.hashIp(request.ip),
    });
  }

  async logoutAll(userId: string, body: LogoutAllRequest, sessionId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });

    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        status: SessionStatus.ACTIVE,
        ...(body.exceptCurrent === true ? { NOT: { id: sessionId } } : {}),
      },
    });

    for (const session of sessions) {
      await this.revokeSession(session.id, body.reason);
    }

    await this.audit.record({
      actorUserId: userId,
      sessionId,
      action: 'auth.logout_all',
      outcome: 'SUCCESS',
      changeSummary: { reason: body.reason, sessionCount: sessions.length },
    });
  }

  async forgotPassword(
    body: PasswordForgotRequest,
    correlationId?: string,
  ): Promise<GenericAcceptedResponse> {
    this.rateLimit.assertWithinLimit(`forgot:email:${normalizeEmail(body.email)}`, 5, 60_000);

    const normalizedEmail = normalizeEmail(body.email);
    const user = await this.prisma.user.findUnique({ where: { normalizedEmail } });

    if (user !== null) {
      const rawToken = this.tokenHash.generateOpaqueToken();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await this.transactions.run(async (tx) => {
        await tx.oneTimeToken.updateMany({
          where: {
            userId: user.id,
            purpose: OneTimeTokenPurpose.PASSWORD_RESET,
            consumedAt: null,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });

        await tx.oneTimeToken.create({
          data: {
            userId: user.id,
            purpose: OneTimeTokenPurpose.PASSWORD_RESET,
            targetEmail: normalizedEmail,
            tokenHash: this.tokenHash.hashToken(rawToken),
            expiresAt,
          },
        });
      });

      await this.email.send({
        to: normalizedEmail,
        subject: 'Password reset',
        body: `Reset token (dev): ${rawToken}`,
        correlationId,
      });

      await this.audit.record({
        actorUserId: user.id,
        action: 'auth.password_reset.requested',
        outcome: 'SUCCESS',
        correlationId,
      });
    }

    return { accepted: true, message: GENERIC_ACCEPTED_MESSAGE };
  }

  async resetPassword(body: PasswordResetRequest): Promise<void> {
    this.rateLimit.assertWithinLimit('reset:global', 20, 60_000);

    const policy = this.passwords.validatePolicy(body.newPassword);
    if (!policy.valid) {
      throw new UnprocessableEntityException({
        message: policy.message,
        code: 'PASSWORD_POLICY_VIOLATION',
      });
    }

    const tokenHash = this.tokenHash.hashToken(body.token);
    const tokenRecord = await this.prisma.oneTimeToken.findUnique({
      where: { tokenHash },
    });

    if (tokenRecord === null || tokenRecord.purpose !== OneTimeTokenPurpose.PASSWORD_RESET) {
      throw new HttpException(
        { message: 'Reset token is invalid', code: 'TOKEN_INVALID' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (tokenRecord.expiresAt <= new Date()) {
      throw new GoneException({ message: 'Reset token expired', code: 'TOKEN_EXPIRED' });
    }

    if (tokenRecord.consumedAt !== null) {
      throw new HttpException(
        { message: 'Reset token is invalid', code: 'TOKEN_INVALID' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const passwordHash = await this.passwords.hashPassword(body.newPassword);

    await this.transactions.run(async (tx) => {
      await tx.oneTimeToken.update({
        where: { id: tokenRecord.id },
        data: { consumedAt: new Date() },
      });

      const credential = await tx.userCredential.findFirst({
        where: { userId: tokenRecord.userId, provider: 'LOCAL', revokedAt: null },
      });

      if (credential === null) {
        await tx.userCredential.create({
          data: {
            userId: tokenRecord.userId,
            provider: 'LOCAL',
            passwordHash,
          },
        });
      } else {
        await tx.userCredential.update({
          where: { id: credential.id },
          data: { passwordHash, changedAt: new Date() },
        });
      }

      await tx.user.update({
        where: { id: tokenRecord.userId },
        data: { tokenVersion: { increment: 1 } },
      });
    });

    const sessions = await this.prisma.userSession.findMany({
      where: { userId: tokenRecord.userId, status: SessionStatus.ACTIVE },
    });
    for (const session of sessions) {
      await this.revokeSession(session.id, 'PASSWORD_RESET');
    }

    await this.audit.record({
      actorUserId: tokenRecord.userId,
      action: 'auth.password_reset.completed',
      outcome: 'SUCCESS',
    });
  }

  async verifyEmail(body: EmailVerifyRequest): Promise<void> {
    const tokenHash = this.tokenHash.hashToken(body.token);
    const tokenRecord = await this.prisma.oneTimeToken.findUnique({ where: { tokenHash } });

    if (tokenRecord === null || tokenRecord.purpose !== OneTimeTokenPurpose.EMAIL_VERIFY) {
      throw new HttpException(
        { message: 'Verification token is invalid', code: 'TOKEN_INVALID' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (tokenRecord.expiresAt <= new Date()) {
      throw new GoneException({ message: 'Verification token expired', code: 'TOKEN_EXPIRED' });
    }

    if (tokenRecord.consumedAt !== null) {
      throw new ConflictException({
        message: 'Email is already verified',
        code: 'EMAIL_ALREADY_VERIFIED',
      });
    }

    if (body.password !== undefined) {
      const policy = this.passwords.validatePolicy(body.password);
      if (!policy.valid) {
        throw new UnprocessableEntityException({
          message: policy.message,
          code: 'PASSWORD_POLICY_VIOLATION',
        });
      }
    }

    await this.transactions.run(async (tx) => {
      await tx.oneTimeToken.update({
        where: { id: tokenRecord.id },
        data: { consumedAt: new Date() },
      });

      await tx.user.update({
        where: { id: tokenRecord.userId },
        data: {
          emailVerifiedAt: new Date(),
          status: UserStatus.ACTIVE,
        },
      });

      if (body.password !== undefined) {
        const passwordHash = await this.passwords.hashPassword(body.password);
        const credential = await tx.userCredential.findFirst({
          where: { userId: tokenRecord.userId, provider: 'LOCAL', revokedAt: null },
        });
        if (credential === null) {
          await tx.userCredential.create({
            data: { userId: tokenRecord.userId, provider: 'LOCAL', passwordHash },
          });
        } else {
          await tx.userCredential.update({
            where: { id: credential.id },
            data: { passwordHash, changedAt: new Date() },
          });
        }
      }
    });

    await this.audit.record({
      actorUserId: tokenRecord.userId,
      action: 'auth.email.verify',
      outcome: 'SUCCESS',
    });
  }

  async attachOrganizationToSession(
    sessionId: string,
    organizationId: string,
    membershipId: string,
  ): Promise<TokenResponse> {
    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (session === null || session.status !== SessionStatus.ACTIVE) {
      throw new UnauthorizedException({ message: 'Session invalid', code: 'AUTH_REQUIRED' });
    }

    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: {
        currentTenantId: organizationId,
        currentMembershipId: membershipId,
        sessionVersion: { increment: 1 },
      },
    });

    const { token, expiresIn } = await this.jwt.signAccessToken({
      sub: session.userId,
      sid: session.id,
      org_id: organizationId,
      membership_id: membershipId,
      auth_time: Math.floor(session.authTime.getTime() / 1000),
      amr: session.amr,
      acr: session.acr,
      token_version: session.user.tokenVersion,
    });

    return { accessToken: token, expiresIn, organizationId };
  }

  async resendVerification(
    body: { email: string },
    correlationId?: string,
  ): Promise<GenericAcceptedResponse> {
    this.rateLimit.assertWithinLimit(`verify-resend:${normalizeEmail(body.email)}`, 3, 60_000);

    const normalizedEmail = normalizeEmail(body.email);
    const user = await this.prisma.user.findUnique({ where: { normalizedEmail } });

    if (user !== null && user.emailVerifiedAt === null) {
      const rawToken = this.tokenHash.generateOpaqueToken();
      await this.prisma.oneTimeToken.create({
        data: {
          userId: user.id,
          purpose: OneTimeTokenPurpose.EMAIL_VERIFY,
          targetEmail: normalizedEmail,
          tokenHash: this.tokenHash.hashToken(rawToken),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await this.email.send({
        to: normalizedEmail,
        subject: 'Verify your email',
        body: `Verification token (dev): ${rawToken}`,
        correlationId,
      });
    }

    return { accepted: true, message: GENERIC_ACCEPTED_MESSAGE };
  }

  private async revokeFamily(familyId: string, reason: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.prisma.refreshToken.findMany({
      where: { familyId },
      select: { sessionId: true },
      distinct: ['sessionId'],
    });

    for (const token of tokens) {
      await this.prisma.userSession.updateMany({
        where: { id: token.sessionId, status: SessionStatus.ACTIVE },
        data: {
          status: SessionStatus.REVOKED,
          revokedAt: new Date(),
          revocationReason: reason,
        },
      });
    }

    await this.audit.record({
      action: 'auth.refresh.reuse_detected',
      outcome: 'FAILURE',
      reasonCode: reason,
      changeSummary: { familyId },
    });
  }

  private async revokeSession(sessionId: string, reason: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, status: SessionStatus.ACTIVE },
      data: {
        status: SessionStatus.REVOKED,
        revokedAt: new Date(),
        revocationReason: reason,
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
