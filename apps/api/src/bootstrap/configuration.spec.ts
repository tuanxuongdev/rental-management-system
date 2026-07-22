import { describe, expect, it } from 'vitest';

import { isConfigurationReady, loadApiConfig, redactConfigForLogs } from './configuration';

describe('loadApiConfig', () => {
  it('loads defaults for development', () => {
    const config = loadApiConfig({
      NODE_ENV: 'development',
      API_HOST: '0.0.0.0',
      API_PORT: '3001',
      APP_VERSION: '0.0.0',
      GIT_SHA: 'abc1234',
      DATABASE_URL: 'postgresql://rpm:rpm@localhost:5433/rpm?schema=public',
    });

    expect(config.port).toBe(3001);
    expect(config.appVersion).toBe('0.0.0');
    expect(config.databaseUrl).toContain('postgresql://');
  });

  it('throws on invalid port', () => {
    expect(() =>
      loadApiConfig({
        API_PORT: '0',
      }),
    ).toThrow(/Invalid API configuration/);
  });
});

describe('isConfigurationReady', () => {
  it('returns true when required fields are present', () => {
    const config = loadApiConfig({
      APP_VERSION: '0.0.0',
      API_HOST: '0.0.0.0',
      API_PORT: '3001',
      DATABASE_URL: 'postgresql://rpm:rpm@localhost:5433/rpm?schema=public',
    });

    expect(isConfigurationReady(config)).toBe(true);
  });

  it('returns false when database url is missing', () => {
    expect(
      isConfigurationReady({
        nodeEnv: 'test',
        host: '0.0.0.0',
        port: 3001,
        appVersion: '0.0.0',
        gitSha: 'abc',
        databaseUrl: undefined,
        redisUrl: undefined,
        s3: {
          endpoint: undefined,
          bucket: undefined,
          accessKeyId: undefined,
          secretAccessKey: undefined,
          region: 'us-east-1',
        },
        auth: {
          jwtSecret: 'test-secret-test-secret-test-secret-test',
          jwtIssuer: 'rpm-api',
          jwtAudience: 'rpm-api',
          tokenHashPepper: 'test-pepper-value',
          accessTokenTtlSeconds: 900,
          refreshTokenTtlDays: 30,
          refreshCookiePath: '/v1/auth',
          cookieSameSite: 'lax',
          emailDeliveryMode: 'console',
        },
        metaDemoEnabled: false,
      }),
    ).toBe(false);
  });
});

describe('redactConfigForLogs', () => {
  it('never includes secret material', () => {
    const redacted = redactConfigForLogs(
      loadApiConfig({
        DATABASE_URL: 'postgresql://rpm:rpm@localhost:5433/rpm?schema=public',
        S3_SECRET_ACCESS_KEY: 'super-secret',
      }),
    );

    expect(JSON.stringify(redacted)).not.toContain('super-secret');
    expect(redacted.databaseConfigured).toBe(true);
  });
});
