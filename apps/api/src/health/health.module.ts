import { Module } from '@nestjs/common';

import { ApiConfigModule } from '../bootstrap/api-config.module';
import { PlatformInfrastructureModule } from '../infrastructure/platform/platform-infrastructure.module';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { ReadinessController } from './readiness.controller';

@Module({
  imports: [ApiConfigModule, PlatformInfrastructureModule],
  controllers: [HealthController, ReadinessController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
