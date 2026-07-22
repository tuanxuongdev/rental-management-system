import { Inject, Injectable } from '@nestjs/common';

import type { ReadinessResponse } from '@rpm/contracts';

import { API_CONFIG } from '../../bootstrap/api-config.module';
import { PrismaService } from '../prisma/prisma.module';

import type { ApiConfig } from '../../bootstrap/configuration';

export type DependencyCheckName = 'configuration' | 'database' | 'redis';

@Injectable()
export class DependencyCheckService {
  constructor(
    @Inject(API_CONFIG) private readonly config: ApiConfig,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async checkDatabase(): Promise<'ok' | 'failed'> {
    if (this.config.databaseUrl === undefined) {
      return 'failed';
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'failed';
    }
  }

  checkRedis(): 'ok' | 'failed' | 'skipped' {
    if (this.config.redisUrl === undefined) {
      return 'skipped';
    }
    return 'skipped';
  }

  async buildReadinessChecks(): Promise<ReadinessResponse['checks']> {
    const configurationReady =
      this.config.appVersion.length > 0 &&
      this.config.host.length > 0 &&
      this.config.port > 0 &&
      this.config.databaseUrl !== undefined;

    const database = await this.checkDatabase();
    const redis = this.checkRedis();

    return {
      configuration: configurationReady ? 'ok' : 'failed',
      database,
      redis,
    };
  }
}
