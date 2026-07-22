import { describe, expect, it } from 'vitest';

import {
  GENERIC_AUTH_FAILURE_MESSAGE,
  loginRequestSchema,
  loginResponseSchema,
  meResponseSchema,
  organizationResponseSchema,
} from './index';

describe('@rpm/contracts Sprint-03 auth', () => {
  it('validates login request', () => {
    const parsed = loginRequestSchema.parse({
      email: 'user@example.com',
      password: 'ValidPassword123!',
    });
    expect(parsed.email).toBe('user@example.com');
  });

  it('validates login response shape', () => {
    const parsed = loginResponseSchema.parse({
      accessToken: 'token',
      expiresIn: 900,
      session: {
        id: '00000000-0000-4000-8000-000000000001',
        deviceName: null,
        lastActiveAt: new Date().toISOString(),
        current: true,
      },
      organization: null,
    });
    expect(parsed.expiresIn).toBe(900);
  });

  it('validates me response skeleton', () => {
    const parsed = meResponseSchema.parse({
      user: {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'user@example.com',
        displayName: 'User',
        emailVerified: true,
        status: 'ACTIVE',
      },
      membership: null,
      organization: null,
      roles: [],
      permissionKeys: [],
      assurance: { level: '1', validUntil: null },
    });
    expect(parsed.permissionKeys).toEqual([]);
  });

  it('validates organization response', () => {
    const parsed = organizationResponseSchema.parse({
      id: '00000000-0000-4000-8000-000000000002',
      slug: 'acme',
      displayName: 'Acme',
      legalName: 'Acme LLC',
      status: 'ACTIVE',
      defaultCurrency: 'USD',
      defaultLocale: 'en-US',
      timeZone: 'UTC',
    });
    expect(parsed.slug).toBe('acme');
  });

  it('exposes generic auth failure copy', () => {
    expect(GENERIC_AUTH_FAILURE_MESSAGE).toContain('incorrect');
  });
});
