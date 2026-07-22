import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { loadWorkerConfig } from './bootstrap/configuration';

async function bootstrap(): Promise<void> {
  const config = loadWorkerConfig();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  console.info(
    JSON.stringify({
      level: 'info',
      message: 'worker.started',
      service: 'worker',
      env: config.nodeEnv,
      healthPort: config.healthPort,
      timestamp: new Date().toISOString(),
    }),
  );

  const shutdown = async (): Promise<void> => {
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
}

void bootstrap();
