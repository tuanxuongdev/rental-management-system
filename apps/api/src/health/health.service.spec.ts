import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { DependencyCheckService } from '../infrastructure/platform/dependency-check.service';

import { HealthService } from './health.service';

describe('HealthService', () => {
  async function createService(
    checks: Awaited<ReturnType<DependencyCheckService['buildReadinessChecks']>> = {
      configuration: 'ok',
      database: 'ok',
      redis: 'skipped',
    },
  ): Promise<HealthService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: DependencyCheckService,
          useValue: {
            buildReadinessChecks: async () => checks,
          },
        },
      ],
    }).compile();

    return moduleRef.get(HealthService);
  }

  it('returns liveness without sensitive fields', async () => {
    const service = await createService();
    const response = service.getLiveness();

    expect(response.status).toBe('ok');
    expect(response.service).toBe('api');
    expect(response).not.toHaveProperty('databaseUrl');
    expect(response).not.toHaveProperty('password');
  });

  it('returns not_ready when configuration check fails', async () => {
    const service = await createService({
      configuration: 'failed',
      database: 'ok',
      redis: 'skipped',
    });

    const readiness = await service.getReadiness();

    expect(readiness.status).toBe('not_ready');
    expect(readiness.checks.configuration).toBe('failed');
  });

  it('returns not_ready when database check fails', async () => {
    const service = await createService({
      configuration: 'ok',
      database: 'failed',
      redis: 'skipped',
    });

    const readiness = await service.getReadiness();
    expect(readiness.status).toBe('not_ready');
    expect(readiness.checks.database).toBe('failed');
  });
});
