import { z } from 'zod';

const apiConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  APP_VERSION: z.string().min(1).default('0.0.0'),
  GIT_SHA: z.string().min(1).default('unknown'),
  DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),
  S3_ENDPOINT: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  JWT_SECRET: z.string().min(32).default('dev-only-change-me-in-production-32chars-min'),
  JWT_ISSUER: z.string().min(1).default('rpm-api'),
  JWT_AUDIENCE: z.string().min(1).default('rpm-api'),
  TOKEN_HASH_PEPPER: z.string().min(16).default('dev-token-pepper-change-me'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  REFRESH_COOKIE_PATH: z.string().min(1).default('/v1/auth'),
  AUTH_COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),
  AUTH_EMAIL_DELIVERY_MODE: z.enum(['console', 'disabled']).default('console'),
  META_DEMO_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type ApiConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  appVersion: string;
  gitSha: string;
  databaseUrl: string | undefined;
  redisUrl: string | undefined;
  s3: {
    endpoint: string | undefined;
    bucket: string | undefined;
    accessKeyId: string | undefined;
    secretAccessKey: string | undefined;
    region: string;
  };
  auth: {
    jwtSecret: string;
    jwtIssuer: string;
    jwtAudience: string;
    tokenHashPepper: string;
    accessTokenTtlSeconds: number;
    refreshTokenTtlDays: number;
    refreshCookiePath: string;
    cookieSameSite: 'strict' | 'lax' | 'none';
    emailDeliveryMode: 'console' | 'disabled';
  };
  metaDemoEnabled: boolean;
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
    appVersion: parsed.data.APP_VERSION,
    gitSha: parsed.data.GIT_SHA,
    databaseUrl: parsed.data.DATABASE_URL,
    redisUrl: parsed.data.REDIS_URL,
    s3: {
      endpoint: parsed.data.S3_ENDPOINT,
      bucket: parsed.data.S3_BUCKET,
      accessKeyId: parsed.data.S3_ACCESS_KEY_ID,
      secretAccessKey: parsed.data.S3_SECRET_ACCESS_KEY,
      region: parsed.data.S3_REGION,
    },
    auth: {
      jwtSecret: parsed.data.JWT_SECRET,
      jwtIssuer: parsed.data.JWT_ISSUER,
      jwtAudience: parsed.data.JWT_AUDIENCE,
      tokenHashPepper: parsed.data.TOKEN_HASH_PEPPER,
      accessTokenTtlSeconds: parsed.data.ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenTtlDays: parsed.data.REFRESH_TOKEN_TTL_DAYS,
      refreshCookiePath: parsed.data.REFRESH_COOKIE_PATH,
      cookieSameSite: parsed.data.AUTH_COOKIE_SAME_SITE,
      emailDeliveryMode: parsed.data.AUTH_EMAIL_DELIVERY_MODE,
    },
    metaDemoEnabled: parsed.data.META_DEMO_ENABLED,
  };
}

export function isConfigurationReady(config: ApiConfig): boolean {
  return (
    config.appVersion.length > 0 &&
    config.host.length > 0 &&
    config.port > 0 &&
    config.databaseUrl !== undefined
  );
}

export function redactConfigForLogs(config: ApiConfig): Record<string, unknown> {
  return {
    nodeEnv: config.nodeEnv,
    host: config.host,
    port: config.port,
    appVersion: config.appVersion,
    gitSha: config.gitSha,
    databaseConfigured: config.databaseUrl !== undefined,
    redisConfigured: config.redisUrl !== undefined,
    s3Configured:
      config.s3.bucket !== undefined &&
      config.s3.endpoint !== undefined &&
      config.s3.accessKeyId !== undefined,
  };
}
