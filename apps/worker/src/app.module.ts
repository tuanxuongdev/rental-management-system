import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { WorkerHealthServer } from './health/worker-health-server';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { OutboxConsumerService } from './outbox/outbox-consumer.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
  ],
  providers: [WorkerHealthServer, OutboxConsumerService],
})
export class AppModule {}
