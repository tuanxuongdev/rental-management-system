import { describe, expect, it } from 'vitest';

import {
  AUTH_ORGANIZATION_SWITCH_PATH,
  createRoleRequestSchema,
  invitationsCollectionSchema,
  meResponseSchema,
  organizationSettingsSchema,
  organizationSwitchRequestSchema,
  organizationSwitchResponseSchema,
  patchMemberRequestSchema,
  patchRoleRequestSchema,
  PERMISSION_KEYS,
  SYSTEM_ROLE_KEYS,
} from './index';

describe('@rpm/contracts Sprint-04 RBAC', () => {
  it('exposes organization switch path and validates request/response', () => {
    expect(AUTH_ORGANIZATION_SWITCH_PATH).toBe('/v1/auth/organization-switch');

    const request = organizationSwitchRequestSchema.parse({
      organizationId: '00000000-0000-4000-8000-000000000010',
    });
    expect(request.organizationId).toBe('00000000-0000-4000-8000-000000000010');

    const response = organizationSwitchResponseSchema.parse({
      accessToken: 'token',
      expiresIn: 900,
      organizationId: '00000000-0000-4000-8000-000000000010',
      membershipId: '00000000-0000-4000-8000-000000000011',
    });
    expect(response.membershipId).toBe('00000000-0000-4000-8000-000000000011');
  });

  it('validates me response with memberships and permission keys', () => {
    const parsed = meResponseSchema.parse({
      user: {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'owner@example.com',
        displayName: 'Owner',
        emailVerified: true,
        status: 'ACTIVE',
      },
      membership: {
        id: '00000000-0000-4000-8000-000000000002',
        organizationId: '00000000-0000-4000-8000-000000000003',
        membershipType: 'WORKFORCE',
        status: 'ACTIVE',
        seedRole: 'OWNER',
      },
      organization: {
        id: '00000000-0000-4000-8000-000000000003',
        displayName: 'Acme',
        slug: 'acme',
      },
      memberships: [
        {
          id: '00000000-0000-4000-8000-000000000002',
          organizationId: '00000000-0000-4000-8000-000000000003',
          organizationDisplayName: 'Acme',
          organizationSlug: 'acme',
          status: 'ACTIVE',
          roles: [SYSTEM_ROLE_KEYS.OWNER],
        },
      ],
      roles: [SYSTEM_ROLE_KEYS.OWNER],
      permissionKeys: [PERMISSION_KEYS.MEMBERS_LIST, PERMISSION_KEYS.ROLES_CREATE],
      isReadOnly: false,
      assurance: { level: '1', validUntil: new Date().toISOString() },
    });

    expect(parsed.permissionKeys.length).toBeGreaterThan(0);
    expect(parsed.memberships).toHaveLength(1);
  });

  it('validates member/role/settings write schemas', () => {
    expect(
      patchMemberRequestSchema.parse({
        status: 'SUSPENDED',
        reason: 'Left the company',
      }).status,
    ).toBe('SUSPENDED');

    expect(
      createRoleRequestSchema.parse({
        key: 'custom_ops',
        name: 'Custom Ops',
        permissionKeys: [PERMISSION_KEYS.MEMBERS_LIST],
      }).key,
    ).toBe('custom_ops');

    expect(
      patchRoleRequestSchema.parse({
        name: 'Updated',
        permissionKeys: [PERMISSION_KEYS.ROLES_LIST],
      }).name,
    ).toBe('Updated');

    expect(
      organizationSettingsSchema.parse({
        organizationId: '00000000-0000-4000-8000-000000000003',
        displayName: 'Acme',
        legalName: 'Acme LLC',
        defaultLocale: 'en-US',
        timeZone: 'UTC',
        defaultCurrency: 'USD',
        version: 1,
      }).version,
    ).toBe(1);
  });

  it('validates invitations collection envelope', () => {
    const parsed = invitationsCollectionSchema.parse({
      data: [
        {
          id: '00000000-0000-4000-8000-000000000020',
          email: 'invitee@example.com',
          purpose: 'WORKFORCE',
          status: 'PENDING',
          expiresAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          proposedRoleIds: ['00000000-0000-4000-8000-000000000021'],
        },
      ],
      page: { nextCursor: null, previousCursor: null, limit: 25 },
      meta: {},
    });
    expect(parsed.data[0]?.proposedRoleIds).toHaveLength(1);
  });
});
