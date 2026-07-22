import { Module } from '@nestjs/common';

import { ApiConfigModule } from '../../bootstrap/api-config.module';
import { PlatformInfrastructureModule } from '../../infrastructure/platform/platform-infrastructure.module';

import { MetaController } from './meta.controller';
import { MetaService } from './meta.service';

@Module({
  imports: [ApiConfigModule, PlatformInfrastructureModule],
  controllers: [MetaController],
  providers: [MetaService],
})
export class MetaModule {}
