import { Module } from '@nestjs/common';

import { ApiConfigModule } from '../../bootstrap/api-config.module';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { OutboxService } from '../outbox/outbox.service';
import { TransactionService } from '../persistence/transaction.service';
import { PrismaModule } from '../prisma/prisma.module';
import { S3StorageClient } from '../storage/s3-storage.client';

import { DependencyCheckService } from './dependency-check.service';

@Module({
  imports: [ApiConfigModule, PrismaModule],
  providers: [
    TransactionService,
    OutboxService,
    IdempotencyService,
    DependencyCheckService,
    S3StorageClient,
  ],
  exports: [
    TransactionService,
    OutboxService,
    IdempotencyService,
    DependencyCheckService,
    S3StorageClient,
  ],
})
export class PlatformInfrastructureModule {}
