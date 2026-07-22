import { z } from 'zod';

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key' as const;
export const IDEMPOTENCY_REPLAYED_HEADER = 'idempotency-replayed' as const;

export const IDEMPOTENCY_KEY_MIN_LENGTH = 1 as const;
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128 as const;
export const IDEMPOTENCY_DEFAULT_TTL_HOURS = 24 as const;

export const idempotencyKeyHeaderSchema = z
  .string()
  .min(IDEMPOTENCY_KEY_MIN_LENGTH)
  .max(IDEMPOTENCY_KEY_MAX_LENGTH)
  .regex(/^[\x21-\x7E]+$/);

export const metaIdempotentEchoRequestSchema = z.object({
  message: z.string().min(1).max(500),
});

export type MetaIdempotentEchoRequest = z.infer<typeof metaIdempotentEchoRequestSchema>;

export const metaIdempotentEchoResponseSchema = z.object({
  message: z.string().min(1),
  echoId: z.string().min(1),
  timestamp: z.string().datetime(),
  service: z.literal('api'),
});

export type MetaIdempotentEchoResponse = z.infer<typeof metaIdempotentEchoResponseSchema>;
