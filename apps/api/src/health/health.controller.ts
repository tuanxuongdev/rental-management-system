import { Controller, Get } from '@nestjs/common';

import { HEALTH_PATH, type HealthResponse } from '@rpm/contracts';

@Controller()
export class HealthController {
  @Get('health')
  health(): HealthResponse {
    return {
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  ready(): HealthResponse {
    return {
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
    };
  }

  /** Expose contract constant for future route registration checks. */
  static readonly healthPath = HEALTH_PATH;
}
