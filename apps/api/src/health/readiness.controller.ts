import { Controller, Get, HttpCode, HttpStatus, Inject, Res } from '@nestjs/common';

import { type ReadinessResponse } from '@rpm/contracts';

import { Public } from '../common/auth/public.decorator';

import { HealthService } from './health.service';

import type { Response } from 'express';

@Controller()
export class ReadinessController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Public()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async ready(@Res({ passthrough: true }) res: Response): Promise<ReadinessResponse> {
    const readiness = await this.healthService.getReadiness();

    if (readiness.status === 'not_ready') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return readiness;
  }
}
