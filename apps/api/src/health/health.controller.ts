import { Controller, Get, Inject } from '@nestjs/common';

import { HEALTH_PATH, type HealthResponse } from '@rpm/contracts';

import { Public } from '../common/auth/public.decorator';

import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Public()
  @Get('health')
  health(): HealthResponse {
    return this.healthService.getLiveness();
  }

  /** Expose contract constant for route registration checks. */
  static readonly healthPath = HEALTH_PATH;
}
