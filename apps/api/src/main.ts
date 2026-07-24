import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { loadApiConfig } from './bootstrap/configuration';
import { ProblemDetailsFilter } from './common/errors/problem-details.filter';

import type { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap(): Promise<void> {
  const config = loadApiConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
    // Preserve provider webhook bytes for HMAC verification (fail-closed).
    rawBody: true,
  });

  app.use(cookieParser());
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalFilters(new ProblemDetailsFilter());

  app.setGlobalPrefix('v1', {
    exclude: ['health', 'ready'],
  });

  await app.listen(config.port, config.host);
  console.info(
    JSON.stringify({
      level: 'info',
      message: 'api.started',
      service: 'api',
      host: config.host,
      port: config.port,
      version: config.appVersion,
      gitSha: config.gitSha,
      timestamp: new Date().toISOString(),
    }),
  );
}

void bootstrap();
