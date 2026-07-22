import { z } from 'zod';

const workerConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  WORKER_HEALTH_HOST: z.string().min(1).default('0.0.0.0'),
  WORKER_HEALTH_PORT: z.coerce.number().int().positive().default(3002),
  DATABASE_URL: z.string().min(1).optional(),
});

export type WorkerConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  healthHost: string;
  healthPort: number;
  databaseUrl: string | undefined;
};

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const parsed = workerConfigSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid worker configuration: ${parsed.error.message}`);
  }

  return {
    nodeEnv: parsed.data.NODE_ENV,
    healthHost: parsed.data.WORKER_HEALTH_HOST,
    healthPort: parsed.data.WORKER_HEALTH_PORT,
    databaseUrl: parsed.data.DATABASE_URL,
  };
}
