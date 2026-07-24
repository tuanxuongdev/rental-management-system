import { Module, forwardRef } from '@nestjs/common';

import { PlatformInfrastructureModule } from '../../infrastructure/platform/platform-infrastructure.module';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';
import { RbacModule } from '../tenancy/rbac.module';

import { ArrearsService } from './application/arrears.service';
import { DepositDispositionService } from './application/deposit-disposition.service';
import { FinanceDashboardService } from './application/finance-dashboard.service';
import { PaymentIntentService } from './application/payment-intent.service';
import { PaymentService } from './application/payment.service';
import { ReceiptService } from './application/receipt.service';
import { RefundService } from './application/refund.service';
import { WebhookService } from './application/webhook.service';
import { PaymentsController } from './presentation/payments.controller';
import { ProviderWebhooksController } from './presentation/provider-webhooks.controller';

@Module({
  imports: [
    PrismaModule,
    PlatformInfrastructureModule,
    AuditModule,
    RbacModule,
    BillingModule,
    forwardRef(() => ReconciliationModule),
  ],
  controllers: [PaymentsController, ProviderWebhooksController],
  providers: [
    PaymentService,
    PaymentIntentService,
    ReceiptService,
    RefundService,
    WebhookService,
    ArrearsService,
    FinanceDashboardService,
    DepositDispositionService,
  ],
  exports: [PaymentService, DepositDispositionService, RefundService],
})
export class PaymentsModule {}
