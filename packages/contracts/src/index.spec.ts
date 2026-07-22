import { describe, expect, it } from 'vitest';

import {
  healthResponseSchema,
  metaPingResponseSchema,
  metaVersionResponseSchema,
  readinessResponseSchema,
} from './index';

describe('contracts', () => {
  it('validates health response', () => {
    const parsed = healthResponseSchema.parse({
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
    });
    expect(parsed.service).toBe('api');
  });

  it('validates readiness response', () => {
    const parsed = readinessResponseSchema.parse({
      status: 'not_ready',
      service: 'api',
      timestamp: new Date().toISOString(),
      checks: { configuration: 'failed' },
    });
    expect(parsed.status).toBe('not_ready');
  });

  it('validates meta version response', () => {
    const parsed = metaVersionResponseSchema.parse({
      version: '0.0.0',
      gitSha: 'abc1234',
      service: 'api',
    });
    expect(parsed.version).toBe('0.0.0');
  });

  it('validates meta ping response', () => {
    const parsed = metaPingResponseSchema.parse({
      message: 'pong',
      correlationId: 'req-123',
      timestamp: new Date().toISOString(),
      service: 'api',
    });
    expect(parsed.message).toBe('pong');
  });
});
