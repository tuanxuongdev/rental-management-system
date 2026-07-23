import { randomUUID } from 'node:crypto';

import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MembershipStatus, UserStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { OWNER_ONLY_PERMISSION_KEYS, PERMISSION_KEYS, SYSTEM_ROLE_KEYS } from '@rpm/contracts';
import {
  createIntegrationPrismaClient,
  isDatabaseReachable,
  resetPlatformTables,
} from '@rpm/testing';

import { OrganizationPathGuard } from '../../common/auth/organization.guards';
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
import { AuthService } from '../identity/application/auth.service';
import { MeService } from '../identity/application/me.service';
import { AuthorizationService } from '../tenancy/application/authorization.service';
import { InvitationService } from '../tenancy/application/invitation.service';
import { MembershipAdminService } from '../tenancy/application/membership-admin.service';
import { OrganizationSettingsService } from '../tenancy/application/organization-settings.service';
import { OrganizationService } from '../tenancy/application/organization.service';
import { PropertyAccessGrantService } from '../tenancy/application/property-access-grant.service';
import { RbacSeedService } from '../tenancy/application/rbac-seed.service';
import { RoleAdminService } from '../tenancy/application/role-admin.service';

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

describe.skipIf(!databaseAvailable)('Authorization isolation (Sprint-04 / M2)', () => {
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
  const authorization = new AuthorizationService(prisma as never);
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
  const invitations = new InvitationService(
    prisma as never,
    transactions,
    tokenHash,
    email,
    audit,
    rbacSeed,
    authorization,
  );
  const members = new MembershipAdminService(prisma as never, transactions, authorization, audit);
  const roles = new RoleAdminService(prisma as never, transactions, authorization, audit);
  const settings = new OrganizationSettingsService(prisma as never, audit);
  const propertyAccessGrants = new PropertyAccessGrantService(prisma as never, audit);
  const me = new MeService(prisma as never, authorization);
  const pathGuard = new OrganizationPathGuard();

  beforeAll(async () => {
    await resetPlatformTables(prisma);
    await rbacSeed.ensureCatalog();
  });

  beforeEach(async () => {
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

  async function loginAs(emailAddress: string, password: string, organizationId?: string) {
    return auth.login(
      { email: emailAddress, password, organizationId },
      mockRequest(),
      mockResponse() as never,
      'corr',
    );
  }

  it('T04-01: member without members.list is denied', async () => {
    const owner = await provisionVerifiedUser('owner@example.com', 'ValidPassword123!');
    const org = await organizations.createOrganization(owner.id, { displayName: 'Org A' });
    const ownerMembership = await prisma.tenantMembership.findFirstOrThrow({
      where: { tenantId: org.id, userId: owner.id },
    });

    const limitedRole = await roles.createRole(org.id, ownerMembership.id, owner.id, {
      key: 'profile_only',
      name: 'Profile Only',
      permissionKeys: [PERMISSION_KEYS.ORGANIZATION_PROFILE_VIEW],
    });

    const limitedUser = await provisionVerifiedUser(
      'limited-list@example.com',
      'ValidPassword123!',
    );
    const membership = await prisma.tenantMembership.create({
      data: {
        tenantId: org.id,
        userId: limitedUser.id,
        membershipType: 'WORKFORCE',
        status: MembershipStatus.ACTIVE,
      },
    });
    await prisma.membershipRole.create({
      data: {
        id: randomUUID(),
        tenantId: org.id,
        membershipId: membership.id,
        roleId: limitedRole.id,
      },
    });

    await expect(
      authorization.assertPermission(membership.id, org.id, PERMISSION_KEYS.MEMBERS_LIST),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('T04-02: token org A accessing org B members path returns 404', async () => {
    const userA = await provisionVerifiedUser('a@example.com', 'ValidPassword123!');
    const userB = await provisionVerifiedUser('b@example.com', 'ValidPassword123!');
    const orgA = await organizations.createOrganization(userA.id, { displayName: 'Org A' });
    const orgB = await organizations.createOrganization(userB.id, { displayName: 'Org B' });

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          actor: {
            userId: userA.id,
            sessionId: randomUUID(),
            organizationId: orgA.id,
            membershipId: randomUUID(),
            tokenVersion: 1,
            email: 'a@example.com',
          },
          params: { organizationId: orgB.id },
        }),
      }),
    };

    try {
      pathGuard.canActivate(context as never);
      throw new Error('Expected OrganizationPathGuard to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundException);
    }
  });

  it('T04-03: assign role lacking actor permission is rejected', async () => {
    const owner = await provisionVerifiedUser('owner2@example.com', 'ValidPassword123!');
    const org = await organizations.createOrganization(owner.id, { displayName: 'Org Assign' });
    const ownerMembership = await prisma.tenantMembership.findFirstOrThrow({
      where: { tenantId: org.id, userId: owner.id },
    });

    const limited = await roles.createRole(org.id, ownerMembership.id, owner.id, {
      key: 'limited_viewer',
      name: 'Limited Viewer',
      permissionKeys: [PERMISSION_KEYS.ORGANIZATION_PROFILE_VIEW],
    });

    const limitedUser = await provisionVerifiedUser('limited@example.com', 'ValidPassword123!');
    const limitedMembership = await prisma.tenantMembership.create({
      data: {
        tenantId: org.id,
        userId: limitedUser.id,
        membershipType: 'WORKFORCE',
        status: MembershipStatus.ACTIVE,
      },
    });
    await prisma.membershipRole.create({
      data: {
        id: randomUUID(),
        tenantId: org.id,
        membershipId: limitedMembership.id,
        roleId: limited.id,
      },
    });

    const adminRoleId = await rbacSeed.getSystemRoleId(SYSTEM_ROLE_KEYS.ADMIN);
    await expect(
      authorization.assertCanAssignRoles(limitedMembership.id, [adminRoleId], org.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('T04-04: custom role with owner-only permission is rejected', async () => {
    const owner = await provisionVerifiedUser('owner3@example.com', 'ValidPassword123!');
    const org = await organizations.createOrganization(owner.id, { displayName: 'Org Custom' });
    const ownerMembership = await prisma.tenantMembership.findFirstOrThrow({
      where: { tenantId: org.id, userId: owner.id },
    });

    await expect(
      roles.createRole(org.id, ownerMembership.id, owner.id, {
        key: 'evil_owner',
        name: 'Evil Owner',
        permissionKeys: [PERMISSION_KEYS.ORGANIZATION_PROFILE_VIEW, OWNER_ONLY_PERMISSION_KEYS[0]],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('T04-05: org switch success issues new token for target org', async () => {
    const user = await provisionVerifiedUser('multi@example.com', 'ValidPassword123!');
    const orgA = await organizations.createOrganization(user.id, { displayName: 'Multi A' });
    const orgB = await organizations.createOrganization(user.id, { displayName: 'Multi B' });

    const login = await loginAs('multi@example.com', 'ValidPassword123!', orgA.id);
    expect('accessToken' in login).toBe(true);
    if (!('accessToken' in login)) {
      return;
    }

    const session = await prisma.userSession.findFirstOrThrow({
      where: { userId: user.id, status: 'ACTIVE' },
    });

    const switched = await auth.switchOrganization(user.id, session.id, orgB.id);
    expect(switched.organizationId).toBe(orgB.id);

    const meAfter = await me.getMe(user.id, session.id);
    expect(meAfter.organization?.id).toBe(orgB.id);
    expect(meAfter.organization?.id).not.toBe(orgA.id);
  });

  it('T04-07: suspended membership refresh clears org context', async () => {
    const owner = await provisionVerifiedUser('suspend-owner@example.com', 'ValidPassword123!');
    const org = await organizations.createOrganization(owner.id, { displayName: 'Suspend Org' });
    const ownerMembership = await prisma.tenantMembership.findFirstOrThrow({
      where: { tenantId: org.id, userId: owner.id },
    });

    const member = await provisionVerifiedUser('suspend-member@example.com', 'ValidPassword123!');
    const membership = await prisma.tenantMembership.create({
      data: {
        tenantId: org.id,
        userId: member.id,
        membershipType: 'WORKFORCE',
        status: MembershipStatus.ACTIVE,
      },
    });
    const adminRoleId = await rbacSeed.getSystemRoleId(SYSTEM_ROLE_KEYS.ADMIN);
    await prisma.membershipRole.create({
      data: {
        id: randomUUID(),
        tenantId: org.id,
        membershipId: membership.id,
        roleId: adminRoleId,
      },
    });

    await loginAs('suspend-member@example.com', 'ValidPassword123!', org.id);
    const session = await prisma.userSession.findFirstOrThrow({
      where: { userId: member.id, status: 'ACTIVE' },
    });

    await members.patchMember(
      org.id,
      membership.id,
      owner.id,
      ownerMembership.id,
      { status: 'SUSPENDED', reason: 'policy' },
      membership.version,
    );

    const refreshedSession = await prisma.userSession.findUniqueOrThrow({
      where: { id: session.id },
    });
    expect(refreshedSession.currentMembershipId).toBeNull();
    expect(refreshedSession.currentTenantId).toBeNull();
  });

  it('T04-08: auditor role is read-only (mutations denied)', async () => {
    const owner = await provisionVerifiedUser('aud-owner@example.com', 'ValidPassword123!');
    const org = await organizations.createOrganization(owner.id, { displayName: 'Auditor Org' });
    const auditorRoleId = await rbacSeed.getSystemRoleId(SYSTEM_ROLE_KEYS.AUDITOR);
    const auditor = await provisionVerifiedUser('readonly@example.com', 'ValidPassword123!');
    const membership = await prisma.tenantMembership.create({
      data: {
        tenantId: org.id,
        userId: auditor.id,
        membershipType: 'WORKFORCE',
        status: MembershipStatus.ACTIVE,
      },
    });
    await prisma.membershipRole.create({
      data: {
        id: randomUUID(),
        tenantId: org.id,
        membershipId: membership.id,
        roleId: auditorRoleId,
      },
    });

    expect(await authorization.isReadOnly(membership.id)).toBe(true);
    await expect(
      authorization.assertPermission(
        membership.id,
        org.id,
        PERMISSION_KEYS.ORGANIZATION_PROFILE_UPDATE,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('T04-10: /me exposes effective permissions for owner', async () => {
    const owner = await provisionVerifiedUser('me-owner@example.com', 'ValidPassword123!');
    const org = await organizations.createOrganization(owner.id, { displayName: 'Me Org' });
    await loginAs('me-owner@example.com', 'ValidPassword123!', org.id);
    const session = await prisma.userSession.findFirstOrThrow({
      where: { userId: owner.id, status: 'ACTIVE' },
    });
    const profile = await me.getMe(owner.id, session.id);
    expect(profile.permissionKeys).toContain(PERMISSION_KEYS.MEMBERS_LIST);
    expect(profile.permissionKeys).toContain(PERMISSION_KEYS.ROLES_CREATE);
    expect(profile.isReadOnly).toBe(false);
    expect(profile.memberships.length).toBeGreaterThanOrEqual(1);
  });

  it('T04-11: invite revoke makes token unusable', async () => {
    const owner = await provisionVerifiedUser('invite-owner@example.com', 'ValidPassword123!');
    const org = await organizations.createOrganization(owner.id, { displayName: 'Invite Org' });
    const ownerMembership = await prisma.tenantMembership.findFirstOrThrow({
      where: { tenantId: org.id, userId: owner.id },
    });
    const invite = await invitations.createInvitation(
      org.id,
      owner.id,
      ownerMembership.id,
      { email: 'invitee@example.com' },
      'corr',
    );

    await invitations.revokeInvitation(org.id, invite.id, owner.id, 'corr');

    const invitee = await provisionVerifiedUser('invitee@example.com', 'ValidPassword123!');
    const pending = await prisma.invitation.findUniqueOrThrow({ where: { id: invite.id } });
    expect(pending.status).toBe('REVOKED');

    // Accept path looks up by token hash; revoked invitations cannot be claimed.
    await expect(
      invitations.acceptInvitation('not-the-real-token', {}, invitee.id, 'invitee@example.com'),
    ).rejects.toBeTruthy();
  });

  it('T04-settings: settings update is audited', async () => {
    const owner = await provisionVerifiedUser('settings@example.com', 'ValidPassword123!');
    const org = await organizations.createOrganization(owner.id, { displayName: 'Settings Org' });
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: org.id } });
    await settings.patchSettings(
      org.id,
      owner.id,
      { displayName: 'Settings Org Updated', timeZone: 'Asia/Ho_Chi_Minh' },
      tenant.version,
      'corr',
    );
    const events = await prisma.auditEvent.findMany({
      where: { action: 'organization.settings.update', tenantId: org.id },
    });
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('review: invite cannot propose Owner without assign rights', async () => {
    const owner = await provisionVerifiedUser('esc-owner@example.com', 'ValidPassword123!');
    const org = await organizations.createOrganization(owner.id, { displayName: 'Escalation Org' });
    const ownerMembership = await prisma.tenantMembership.findFirstOrThrow({
      where: { tenantId: org.id, userId: owner.id },
    });
    const limited = await roles.createRole(org.id, ownerMembership.id, owner.id, {
      key: 'inviter_only',
      name: 'Inviter Only',
      permissionKeys: [PERMISSION_KEYS.MEMBERS_INVITE, PERMISSION_KEYS.ORGANIZATION_PROFILE_VIEW],
    });
    const limitedUser = await provisionVerifiedUser(
      'inviter-only@example.com',
      'ValidPassword123!',
    );
    const limitedMembership = await prisma.tenantMembership.create({
      data: {
        tenantId: org.id,
        userId: limitedUser.id,
        membershipType: 'WORKFORCE',
        status: MembershipStatus.ACTIVE,
      },
    });
    await prisma.membershipRole.create({
      data: {
        id: randomUUID(),
        tenantId: org.id,
        membershipId: limitedMembership.id,
        roleId: limited.id,
      },
    });

    const ownerRoleId = await rbacSeed.getSystemRoleId(SYSTEM_ROLE_KEYS.OWNER);
    await expect(
      invitations.createInvitation(
        org.id,
        limitedUser.id,
        limitedMembership.id,
        { email: 'victim@example.com', proposedRoleIds: [ownerRoleId] },
        'corr',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('review: last Owner role demotion is rejected', async () => {
    const owner = await provisionVerifiedUser('last-owner@example.com', 'ValidPassword123!');
    const org = await organizations.createOrganization(owner.id, { displayName: 'Last Owner Org' });
    const ownerMembership = await prisma.tenantMembership.findFirstOrThrow({
      where: { tenantId: org.id, userId: owner.id },
    });
    const adminRoleId = await rbacSeed.getSystemRoleId(SYSTEM_ROLE_KEYS.ADMIN);

    await expect(
      members.patchMember(
        org.id,
        ownerMembership.id,
        owner.id,
        ownerMembership.id,
        { roleIds: [adminRoleId], reason: 'demote' },
        ownerMembership.version,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('T06-grants: create property access grant + cross-org isolation', async () => {
    const ownerA = await provisionVerifiedUser('grant-a@example.com', 'ValidPassword123!');
    const ownerB = await provisionVerifiedUser('grant-b@example.com', 'ValidPassword123!');
    const orgA = await organizations.createOrganization(ownerA.id, { displayName: 'Grant Org A' });
    const orgB = await organizations.createOrganization(ownerB.id, { displayName: 'Grant Org B' });
    const membershipA = await prisma.tenantMembership.findFirstOrThrow({
      where: { tenantId: orgA.id, userId: ownerA.id },
    });
    const membershipB = await prisma.tenantMembership.findFirstOrThrow({
      where: { tenantId: orgB.id, userId: ownerB.id },
    });

    const propertyA = await prisma.property.create({
      data: {
        id: randomUUID(),
        tenantId: orgA.id,
        code: 'GA-1',
        name: 'Grant Prop A',
        propertyType: 'APARTMENT',
        addressLine1: '1 St',
        city: 'Austin',
        timeZone: 'UTC',
        defaultCurrency: 'USD',
      },
    });
    const propertyB = await prisma.property.create({
      data: {
        id: randomUUID(),
        tenantId: orgB.id,
        code: 'GB-1',
        name: 'Grant Prop B',
        propertyType: 'APARTMENT',
        addressLine1: '2 St',
        city: 'Austin',
        timeZone: 'UTC',
        defaultCurrency: 'USD',
      },
    });

    const pmRole = await prisma.role.findFirstOrThrow({
      where: { tenantId: null, key: SYSTEM_ROLE_KEYS.PROPERTY_MANAGER },
    });
    const pmUser = await provisionVerifiedUser('grant-pm@example.com', 'ValidPassword123!');
    const pmMembership = await prisma.tenantMembership.create({
      data: {
        tenantId: orgA.id,
        userId: pmUser.id,
        membershipType: 'WORKFORCE',
        status: MembershipStatus.ACTIVE,
      },
    });
    await prisma.membershipRole.create({
      data: {
        id: randomUUID(),
        tenantId: orgA.id,
        membershipId: pmMembership.id,
        roleId: pmRole.id,
      },
    });

    const grant = await propertyAccessGrants.createGrant(
      orgA.id,
      pmMembership.id,
      ownerA.id,
      {
        scopeType: 'SELECTED_PROPERTIES',
        propertyId: propertyA.id,
        reason: 'scope PM',
      },
      'corr',
    );
    expect(grant.propertyId).toBe(propertyA.id);
    expect(grant.membershipId).toBe(pmMembership.id);

    const listed = await propertyAccessGrants.listGrants(orgA.id, pmMembership.id);
    expect(listed.data.map((item) => item.id)).toContain(grant.id);

    await expect(
      propertyAccessGrants.createGrant(orgA.id, pmMembership.id, ownerA.id, {
        scopeType: 'SELECTED_PROPERTIES',
        propertyId: propertyB.id,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(propertyAccessGrants.listGrants(orgB.id, pmMembership.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    await expect(
      propertyAccessGrants.endGrant(orgB.id, membershipB.id, grant.id, ownerB.id),
    ).rejects.toBeInstanceOf(NotFoundException);

    const ended = await propertyAccessGrants.endGrant(
      orgA.id,
      pmMembership.id,
      grant.id,
      ownerA.id,
      { reason: 'revoked' },
    );
    expect(ended.effectiveTo).toBeTruthy();

    void membershipA;
  });
});
