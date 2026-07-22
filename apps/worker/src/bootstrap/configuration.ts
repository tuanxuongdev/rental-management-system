import { z } from 'zod';

const workerConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type WorkerConfig = {
  nodeEnv: 'development' | 'test' | 'production';
};

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const parsed = workerConfigSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid worker configuration: ${parsed.error.message}`);
  }

  return { nodeEnv: parsed.data.NODE_ENV };
}
