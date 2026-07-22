import 'reflect-metadata';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  EMPTY_PAGINATION_EXAMPLE,
  metaPaginationExampleResponseSchema,
  operationsCollectionSchema,
} from '@rpm/contracts';

import { ApiConfigModule, API_CONFIG } from './bootstrap/api-config.module';
import { AuthModule } from './common/auth/auth.module';
import { CorrelationIdMiddleware } from './common/context/correlation-id.middleware';
import { ProblemDetailsFilter } from './common/errors/problem-details.filter';
import { HealthModule } from './health/health.module';
import { DependencyCheckService } from './infrastructure/platform/dependency-check.service';
import { IdentityModule } from './modules/identity/identity.module';
import { MetaModule } from './modules/meta/meta.module';

const testApiConfig = {
  nodeEnv: 'test' as const,
  host: '0.0.0.0',
  port: 3001,
  appVersion: '0.0.0',
  gitSha: 'test-sha',
  databaseUrl: 'postgresql://rpm:rpm@localhost:5433/rpm?schema=public',
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
    cookieSameSite: 'lax' as const,
    emailDeliveryMode: 'console' as const,
  },
  metaDemoEnabled: false,
};

async function createApp(
  config = testApiConfig,
  options?: { withAuth?: boolean },
): Promise<INestApplication> {
  const imports =
    options?.withAuth === false
      ? [ApiConfigModule, AuthModule, HealthModule, MetaModule, IdentityModule]
      : [ApiConfigModule, AuthModule, HealthModule, MetaModule, IdentityModule];

  const moduleRef = await Test.createTestingModule({
    imports,
  })
    .overrideProvider(API_CONFIG)
    .useValue(config)
    .overrideProvider(DependencyCheckService)
    .useValue({
      buildReadinessChecks: async () => ({
        configuration:
          config.appVersion.length > 0 && config.host.length > 0 && config.port > 0
            ? ('ok' as const)
            : ('failed' as const),
        database: config.databaseUrl ? ('ok' as const) : ('failed' as const),
        redis: 'skipped' as const,
      }),
    })
    .compile();

  const app = moduleRef.createNestApplication();
  const correlationMiddleware = new CorrelationIdMiddleware();
  app.use(correlationMiddleware.use.bind(correlationMiddleware));
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.setGlobalPrefix('v1', { exclude: ['health', 'ready'] });
  await app.init();
  return app;
}

describe('App HTTP (Sprint-01)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp(testApiConfig, { withAuth: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it('T01-05: GET /health returns 200 without sensitive fields', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      service: 'api',
      timestamp: expect.any(String),
    });
    expect(response.body).not.toHaveProperty('databaseUrl');
    expect(response.body).not.toHaveProperty('password');
  });

  it('T01-06: GET /ready returns not_ready when configuration is invalid', async () => {
    const invalidApp = await createApp({
      ...testApiConfig,
      host: '',
      appVersion: '',
    });

    const response = await request(invalidApp.getHttpServer()).get('/ready').expect(503);

    expect(response.body.status).toBe('not_ready');
    expect(response.body.checks.configuration).toBe('failed');

    await invalidApp.close();
  });

  it('T01-07: GET /v1/meta/ping echoes correlation ID', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/meta/ping')
      .set('X-Request-ID', 'review-correlation-id')
      .expect(200);

    expect(response.body.message).toBe('pong');
    expect(response.body.correlationId).toBe('review-correlation-id');
    expect(response.headers['x-request-id']).toBe('review-correlation-id');
    expect(response.headers['x-trace-id']).toEqual(expect.any(String));
  });

  it('GET /v1/meta/version returns build metadata', async () => {
    const response = await request(app.getHttpServer()).get('/v1/meta/version').expect(200);

    expect(response.body).toEqual({
      version: '0.0.0',
      gitSha: 'test-sha',
      service: 'api',
    });
  });

  it('rejects X-Tenant-ID with 400 ORGANIZATION_HEADER_FORBIDDEN', async () => {
    const authedApp = await createApp(testApiConfig, { withAuth: true });
    const response = await request(authedApp.getHttpServer())
      .get('/v1/meta/ping')
      .set('X-Tenant-ID', 'forbidden')
      .expect(400);

    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body.code).toBe('ORGANIZATION_HEADER_FORBIDDEN');
    expect(response.body.status).toBe(400);
    await authedApp.close();
  });

  it('rejects X-Organization-ID with 400 ORGANIZATION_HEADER_FORBIDDEN', async () => {
    const authedApp = await createApp(testApiConfig, { withAuth: true });
    const response = await request(authedApp.getHttpServer())
      .get('/health')
      .set('X-Organization-ID', 'forbidden')
      .expect(400);

    expect(response.body.code).toBe('ORGANIZATION_HEADER_FORBIDDEN');
    await authedApp.close();
  });
});

describe('App HTTP (Sprint-02)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp(testApiConfig, { withAuth: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it('T02-09: GET /v1/meta/pagination-example returns cursor envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/meta/pagination-example')
      .query({ limit: 25 })
      .expect(200);

    expect(metaPaginationExampleResponseSchema.parse(response.body)).toEqual({
      ...EMPTY_PAGINATION_EXAMPLE,
      page: {
        ...EMPTY_PAGINATION_EXAMPLE.page,
        limit: 25,
      },
    });
  });

  it('GET /v1/meta/operations returns empty operations skeleton', async () => {
    const response = await request(app.getHttpServer()).get('/v1/meta/operations').expect(200);

    expect(operationsCollectionSchema.parse(response.body)).toEqual({
      data: [],
      page: {
        nextCursor: null,
        previousCursor: null,
        limit: 25,
      },
      meta: {},
    });
  });

  it('POST /v1/meta/idempotent-echo is locked down when demo disabled', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/meta/idempotent-echo')
      .set('Idempotency-Key', 'review-key')
      .send({ message: 'hello' })
      .expect(404);

    expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('T02-12: GET /ready returns not_ready when database check fails', async () => {
    const dbDownApp = await createApp({
      ...testApiConfig,
      databaseUrl: '',
    });

    const response = await request(dbDownApp.getHttpServer()).get('/ready').expect(503);

    expect(response.body.status).toBe('not_ready');
    expect(response.body.checks.database).toBe('failed');

    await dbDownApp.close();
  });
});
