import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { WorkerHealthService } from './health/worker-health.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
  ],
  providers: [WorkerHealthService],
})
export class AppModule {}
