import { describe, expect, it } from 'vitest';

import {
  EMPTY_PAGINATION_EXAMPLE,
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_REPLAYED_HEADER,
  metaIdempotentEchoResponseSchema,
  metaPaginationExampleResponseSchema,
  operationsCollectionSchema,
  problemDetailsSchema,
} from './index';

describe('@rpm/contracts Sprint-02 envelopes', () => {
  it('validates empty pagination example envelope', () => {
    const parsed = metaPaginationExampleResponseSchema.parse(EMPTY_PAGINATION_EXAMPLE);
    expect(parsed.data).toEqual([]);
    expect(parsed.page.limit).toBe(25);
  });

  it('validates operations collection skeleton', () => {
    const parsed = operationsCollectionSchema.parse({
      data: [],
      page: { nextCursor: null, previousCursor: null, limit: 25 },
      meta: {},
    });
    expect(parsed.data).toHaveLength(0);
  });

  it('validates idempotent echo response', () => {
    const parsed = metaIdempotentEchoResponseSchema.parse({
      message: 'hello',
      echoId: 'echo-1',
      timestamp: new Date().toISOString(),
      service: 'api',
    });
    expect(parsed.service).toBe('api');
  });

  it('exposes idempotency header constants', () => {
    expect(IDEMPOTENCY_KEY_HEADER).toBe('idempotency-key');
    expect(IDEMPOTENCY_REPLAYED_HEADER).toBe('idempotency-replayed');
  });

  it('validates problem details with requestId', () => {
    const parsed = problemDetailsSchema.parse({
      type: 'https://rpm.local/problems/409',
      title: 'Conflict',
      status: 409,
      code: 'IDEMPOTENCY_KEY_REUSED',
      requestId: 'req-1',
    });
    expect(parsed.requestId).toBe('req-1');
  });
});
