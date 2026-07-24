import { Module } from '@nestjs/common';

import { PlatformInfrastructureModule } from '../../infrastructure/platform/platform-infrastructure.module';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { RbacModule } from '../tenancy/rbac.module';

import { BillingRunService } from './application/billing-run.service';
import { CreditNoteService } from './application/credit-note.service';
import { DepositService } from './application/deposit.service';
import { InvoiceService } from './application/invoice.service';
import { LedgerService } from './application/ledger.service';
import { MeterService } from './application/meter.service';
import { UtilityAllocationService } from './application/utility-allocation.service';
import { BillingRunsController } from './presentation/billing-runs.controller';
import { CreditNotesController } from './presentation/credit-notes.controller';
import { DepositsController } from './presentation/deposits.controller';
import { InvoicesController } from './presentation/invoices.controller';
import { LedgerController } from './presentation/ledger.controller';
import { MetersController } from './presentation/meters.controller';

@Module({
  imports: [PrismaModule, PlatformInfrastructureModule, AuditModule, RbacModule],
  controllers: [
    BillingRunsController,
    InvoicesController,
    DepositsController,
    MetersController,
    CreditNotesController,
    LedgerController,
  ],
  providers: [
    LedgerService,
    DepositService,
    InvoiceService,
    CreditNoteService,
    BillingRunService,
    MeterService,
    UtilityAllocationService,
  ],
  exports: [DepositService, BillingRunService, InvoiceService, LedgerService],
})
export class BillingModule {}
