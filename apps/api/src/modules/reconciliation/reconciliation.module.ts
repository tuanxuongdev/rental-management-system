import { Module } from '@nestjs/common';

import { PlatformInfrastructureModule } from '../../infrastructure/platform/platform-infrastructure.module';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { RbacModule } from '../tenancy/rbac.module';

import { AgingService } from './application/aging.service';
import { FinanceExportService } from './application/finance-export.service';
import { ParallelComparisonService } from './application/parallel-comparison.service';
import { PaymentReversalService } from './application/payment-reversal.service';
import { PeriodService } from './application/period.service';
import { ReconciliationService } from './application/reconciliation.service';
import { ReconciliationController } from './presentation/reconciliation.controller';

@Module({
  imports: [PrismaModule, PlatformInfrastructureModule, AuditModule, RbacModule, BillingModule],
  controllers: [ReconciliationController],
  providers: [
    PeriodService,
    AgingService,
    ReconciliationService,
    ParallelComparisonService,
    FinanceExportService,
    PaymentReversalService,
  ],
  exports: [PeriodService, AgingService, ReconciliationService, PaymentReversalService],
})
export class ReconciliationModule {}
