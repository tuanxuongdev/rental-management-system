import { randomUUID } from 'node:crypto';

import { UnauthorizedException } from '@nestjs/common';
import { MfaMethodStatus, MfaMethodType, UserStatus } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GENERIC_AUTH_FAILURE_MESSAGE } from '@rpm/contracts';
import {
  createIntegrationPrismaClient,
  isDatabaseReachable,
  resetPlatformTables,
} from '@rpm/testing';

import { JwtService } from '../../infrastructure/auth/jwt.service';
import { RefreshCookieService } from '../../infrastructure/auth/refresh-cookie.service';
import {
  PasswordHasherService,
  SecretEncryptionService,
  TokenHashService,
} from '../../infrastructure/crypto/crypto.services';
import { EmailService } from '../../infrastructure/email/email.service';
import { TransactionService } from '../../infrastructure/persistence/transaction.service';
import { RateLimitService } from '../../infrastructure/rate-limit/rate-limit.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../tenancy/application/authorization.service';
import { InvitationService } from '../tenancy/application/invitation.service';
import { OrganizationService } from '../tenancy/application/organization.service';
import { RbacSeedService } from '../tenancy/application/rbac-seed.service';

import { AuthService } from './application/auth.service';

const databaseAvailable = await isDatabaseReachable();

const testApiConfig = {
  nodeEnv: 'test' as const,
  host: '0.0.0.0',
  port: 3001,
  appVersion: '0.0.0',
  gitSha: 'test',
  databaseUrl: process.env.TEST_DATABASE_URL,
  redisUrl: undefined,
  s3: {
    endpoint: undefined,
    bucket: undefined,
    accessKeyId: undefined,
    secretAccessKey: undefined,
    region: 'us-east-1',
  },
  auth: {
    jwtSecret: 'integration-test-secret-integration-test-secret',
    jwtIssuer: 'rpm-api',
    jwtAudience: 'rpm-api',
    tokenHashPepper: 'integration-test-pepper',
    accessTokenTtlSeconds: 900,
    refreshTokenTtlDays: 30,
    refreshCookiePath: '/v1/auth',
    cookieSameSite: 'lax' as const,
    emailDeliveryMode: 'console' as const,
  },
  metaDemoEnabled: false,
};

function mockResponse() {
  return {
    cookie: () => undefined,
    clearCookie: () => undefined,
  };
}

function mockRequest() {
  return { ip: '127.0.0.1', header: () => 'vitest' } as never;
}

describe.skipIf(!databaseAvailable)('Auth integration (Sprint-03)', () => {
  const prisma = createIntegrationPrismaClient();
  const transactions = new TransactionService(prisma as never);
  const passwords = new PasswordHasherService();
  const tokenHash = new TokenHashService(testApiConfig as never);
  const secrets = new SecretEncryptionService(testApiConfig as never);
  const jwt = new JwtService(testApiConfig as never);
  const refreshCookies = new RefreshCookieService(testApiConfig as never);
  const rateLimit = new RateLimitService();
  const email = new EmailService(testApiConfig as never);
  const audit = new AuditService(prisma as never);
  const rbacSeed = new RbacSeedService(prisma as never);
  const auth = new AuthService(
    prisma as never,
    transactions,
    passwords,
    tokenHash,
    secrets,
    jwt,
    refreshCookies,
    rateLimit,
    email,
    audit,
    testApiConfig,
  );
  const organizations = new OrganizationService(prisma as never, transactions, audit, rbacSeed);
  const authorization = new AuthorizationService(prisma as never);
  const invitations = new InvitationService(
    prisma as never,
    transactions,
    tokenHash,
    email,
    audit,
    rbacSeed,
    authorization,
  );

  beforeAll(async () => {
    await resetPlatformTables(prisma);
    await rbacSeed.ensureCatalog();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function provisionVerifiedUser(emailAddress: string, password: string) {
    const passwordHash = await passwords.hashPassword(password);
    return prisma.user.create({
      data: {
        email: emailAddress,
        normalizedEmail: emailAddress.toLowerCase(),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        credentials: {
          create: { provider: 'LOCAL', passwordHash },
        },
      },
    });
  }

  it('T03-02: login unknown email vs bad password returns identical generic error', async () => {
    await resetPlatformTables(prisma);
    await provisionVerifiedUser('known@example.com', 'ValidPassword123!');

    const assertGeneric = async (call: Promise<unknown>) => {
      try {
        await call;
        throw new Error('Expected login to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        const response = (error as UnauthorizedException).getResponse() as {
          code: string;
          message: string;
        };
        expect(response.code).toBe('CREDENTIALS_INVALID');
        expect(response.message).toBe(GENERIC_AUTH_FAILURE_MESSAGE);
      }
    };

    await assertGeneric(
      auth.login(
        { email: 'unknown@example.com', password: 'ValidPassword123!' },
        mockRequest(),
        mockResponse() as never,
      ),
    );

    await assertGeneric(
      auth.login(
        { email: 'known@example.com', password: 'WrongPassword123!' },
        mockRequest(),
        mockResponse() as never,
      ),
    );
  });

  it('T03-01/T03-07: login, create organization, audit events recorded', async () => {
    await resetPlatformTables(prisma);
    const emailAddress = `admin-${randomUUID()}@example.com`;
    const password = 'ValidPassword123!';
    const user = await provisionVerifiedUser(emailAddress, password);

    const loginResult = await auth.login(
      { email: emailAddress, password },
      mockRequest(),
      mockResponse() as never,
    );

    expect('accessToken' in loginResult).toBe(true);
    if (!('accessToken' in loginResult)) {
      return;
    }

    expect(loginResult.organization).toBeNull();

    const org = await organizations.createOrganization(user.id, {
      displayName: 'Acme Properties',
    });
    expect(org.displayName).toBe('Acme Properties');

    const auditEvents = await prisma.auditEvent.findMany({
      where: { action: { in: ['auth.login.success', 'organization.create'] } },
    });
    expect(auditEvents).toHaveLength(2);
  });

  it('T03-08/T03-09/T03-10: invite accept requires matching auth; replay rejected', async () => {
    await resetPlatformTables(prisma);

    const owner = await provisionVerifiedUser('owner@example.com', 'ValidPassword123!');
    const invitee = await provisionVerifiedUser('colleague@example.com', 'ValidPassword123!');
    const stranger = await provisionVerifiedUser('stranger@example.com', 'ValidPassword123!');

    const tenant = await prisma.tenant.create({
      data: {
        slug: 'acme',
        legalName: 'Acme',
        displayName: 'Acme',
        memberships: {
          create: {
            userId: owner.id,
            membershipType: 'WORKFORCE',
            status: 'ACTIVE',
            seedRole: 'OWNER',
          },
        },
      },
    });

    const rawInviteToken = tokenHash.generateOpaqueToken();
    await prisma.invitation.create({
      data: {
        tenantId: tenant.id,
        email: 'colleague@example.com',
        normalizedEmail: 'colleague@example.com',
        tokenHash: tokenHash.hashToken(rawInviteToken),
        inviterUserId: owner.id,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    await expect(
      invitations.acceptInvitation(rawInviteToken, {}, stranger.id, stranger.email),
    ).rejects.toMatchObject({
      response: { code: 'INVITED_EMAIL_MISMATCH' },
    });

    const firstAccept = await invitations.acceptInvitation(
      rawInviteToken,
      { displayName: 'Colleague' },
      invitee.id,
      invitee.email,
    );
    expect(firstAccept.membership.status).toBe('ACTIVE');

    await expect(
      invitations.acceptInvitation(rawInviteToken, {}, invitee.id, invitee.email),
    ).rejects.toMatchObject({
      response: { code: 'INVITATION_ALREADY_USED' },
    });
  });

  it('T03-14: MFA required user receives challenge before session', async () => {
    await resetPlatformTables(prisma);
    const user = await provisionVerifiedUser('mfa@example.com', 'ValidPassword123!');
    await prisma.mfaMethod.create({
      data: {
        userId: user.id,
        methodType: MfaMethodType.TOTP,
        credentialId: randomUUID(),
        encryptedSecret: secrets.encrypt('JBSWY3DPEHPK3PXP'),
        status: MfaMethodStatus.ACTIVE,
      },
    });

    const result = await auth.login(
      { email: 'mfa@example.com', password: 'ValidPassword123!' },
      mockRequest(),
      mockResponse() as never,
    );

    expect(result).toMatchObject({
      challengeId: expect.any(String),
      methods: ['TOTP'],
    });
  });

  it('T03-15: logout revokes session so JWT is no longer usable via validator', async () => {
    await resetPlatformTables(prisma);
    const user = await provisionVerifiedUser('logout@example.com', 'ValidPassword123!');
    const loginResult = await auth.login(
      { email: 'logout@example.com', password: 'ValidPassword123!' },
      mockRequest(),
      mockResponse() as never,
    );
    expect('accessToken' in loginResult).toBe(true);
    if (!('accessToken' in loginResult)) {
      return;
    }

    await auth.logout(mockRequest(), mockResponse() as never, user.id, loginResult.session.id);

    const session = await prisma.userSession.findUniqueOrThrow({
      where: { id: loginResult.session.id },
    });
    expect(session.status).toBe('REVOKED');
  });
});
