import { Inject, Injectable } from '@nestjs/common';

import { type HealthResponse } from '@rpm/contracts';

import { DependencyCheckService } from '../infrastructure/platform/dependency-check.service';

@Injectable()
export class HealthService {
  constructor(
    @Inject(DependencyCheckService) private readonly dependencyChecks: DependencyCheckService,
  ) {}

  getLiveness(): HealthResponse {
    return {
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness() {
    const checks = await this.dependencyChecks.buildReadinessChecks();
    const ready = Object.entries(checks).every(
      ([, value]) => value === 'ok' || value === 'skipped',
    );

    return {
      status: ready ? ('ok' as const) : ('not_ready' as const),
      service: 'api' as const,
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
