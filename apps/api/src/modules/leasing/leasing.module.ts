import { Module } from '@nestjs/common';

import { PlatformInfrastructureModule } from '../../infrastructure/platform/platform-infrastructure.module';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { RbacModule } from '../tenancy/rbac.module';

import { LeaseLifecycleService } from './application/lease-lifecycle.service';
import { LeaseService } from './application/lease.service';
import { LeasesController } from './presentation/leases.controller';

@Module({
  imports: [PrismaModule, PlatformInfrastructureModule, AuditModule, RbacModule, BillingModule],
  controllers: [LeasesController],
  providers: [LeaseService, LeaseLifecycleService],
  exports: [LeaseService, LeaseLifecycleService],
})
export class LeasingModule {}
