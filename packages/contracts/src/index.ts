import { z } from 'zod';

/** Shared health payload — infrastructure only, not a business domain contract. */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string().min(1),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const HEALTH_PATH = '/health' as const;
