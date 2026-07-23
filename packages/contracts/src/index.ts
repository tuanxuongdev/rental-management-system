import { z } from 'zod';

import { createCursorCollectionSchema, PAGINATION_DEFAULT_LIMIT } from './pagination';

/** Inbound/outbound request correlation header per API specification. */
export const REQUEST_ID_HEADER = 'x-request-id' as const;

/** Shared health payload — infrastructure only, not a business domain contract. */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string().min(1),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const readinessCheckStatusSchema = z.enum(['ok', 'failed', 'skipped']);

export const readinessResponseSchema = z.object({
  status: z.enum(['ok', 'not_ready']),
  service: z.string().min(1),
  timestamp: z.string().datetime(),
  checks: z.record(readinessCheckStatusSchema),
});

export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;

export const metaVersionResponseSchema = z.object({
  version: z.string().min(1),
  gitSha: z.string().min(1),
  service: z.literal('api'),
});

export type MetaVersionResponse = z.infer<typeof metaVersionResponseSchema>;

export const metaPingResponseSchema = z.object({
  message: z.literal('pong'),
  correlationId: z.string().min(1),
  timestamp: z.string().datetime(),
  service: z.literal('api'),
});

export type MetaPingResponse = z.infer<typeof metaPingResponseSchema>;

export const problemDetailsErrorItemSchema = z.object({
  pointer: z.string().optional(),
  parameter: z.string().optional(),
  code: z.string().min(1),
  message: z.string().min(1),
});

export type ProblemDetailsErrorItem = z.infer<typeof problemDetailsErrorItemSchema>;

/** RFC 9457 Problem Details per API specification. */
export const problemDetailsSchema = z.object({
  type: z.string().url().or(z.string().min(1)),
  title: z.string().min(1),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: z.string().optional(),
  requestId: z.string().optional(),
  correlationId: z.string().optional(),
  errors: z.array(problemDetailsErrorItemSchema).optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

export const metaPaginationExampleItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export type MetaPaginationExampleItem = z.infer<typeof metaPaginationExampleItemSchema>;

export const metaPaginationExampleResponseSchema = createCursorCollectionSchema(
  metaPaginationExampleItemSchema,
);

export type MetaPaginationExampleResponse = z.infer<typeof metaPaginationExampleResponseSchema>;

export const HEALTH_PATH = '/health' as const;
export const READY_PATH = '/ready' as const;
export const META_VERSION_PATH = '/v1/meta/version' as const;
export const META_PING_PATH = '/v1/meta/ping' as const;
export const META_PAGINATION_EXAMPLE_PATH = '/v1/meta/pagination-example' as const;
export const META_IDEMPOTENT_ECHO_PATH = '/v1/meta/idempotent-echo' as const;
export const META_OPERATIONS_PATH = '/v1/meta/operations' as const;

export const EMPTY_PAGINATION_EXAMPLE: MetaPaginationExampleResponse = {
  data: [],
  page: {
    nextCursor: null,
    previousCursor: null,
    limit: PAGINATION_DEFAULT_LIMIT,
  },
  meta: {},
};

export * from './pagination';
export * from './idempotency';
export * from './operations';
export * from './auth';
export * from './tenancy';
export * from './permissions';
export * from './rbac';
export * from './inventory';
export * from './parties';
export * from './imports';
