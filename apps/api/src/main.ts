import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { loadApiConfig } from './bootstrap/configuration';

async function bootstrap(): Promise<void> {
  const config = loadApiConfig();
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.setGlobalPrefix('v1', {
    exclude: ['health', 'ready'],
  });

  await app.listen(config.port, config.host);
  console.info(`API listening on http://${config.host}:${config.port}`);
}

void bootstrap();
