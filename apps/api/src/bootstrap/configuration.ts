import { z } from 'zod';

const apiConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1).optional(),
});

export type ApiConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  databaseUrl: string | undefined;
};

export function loadApiConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = apiConfigSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid API configuration: ${parsed.error.message}`);
  }

  return {
    nodeEnv: parsed.data.NODE_ENV,
    host: parsed.data.API_HOST,
    port: parsed.data.API_PORT,
    databaseUrl: parsed.data.DATABASE_URL,
  };
}
