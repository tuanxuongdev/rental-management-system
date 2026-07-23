import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ApiConfigModule } from './bootstrap/api-config.module';
import { AuthModule } from './common/auth/auth.module';
import { CorrelationIdMiddleware } from './common/context/correlation-id.middleware';
import { ObservabilityModule } from './common/observability/observability.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { IdentityModule } from './modules/identity/identity.module';
import { ImportsModule } from './modules/imports/imports.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { MetaModule } from './modules/meta/meta.module';
import { PartiesModule } from './modules/parties/parties.module';
import { ResidentsModule } from './modules/residents/residents.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ApiConfigModule,
    ObservabilityModule,
    PrismaModule,
    AuthModule,
    HealthModule,
    MetaModule,
    IdentityModule,
    TenancyModule,
    InventoryModule,
    PartiesModule,
    ImportsModule,
    ResidentsModule,
    DocumentsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
