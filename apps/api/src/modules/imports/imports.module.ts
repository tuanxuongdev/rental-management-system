import { Module } from '@nestjs/common';

import { PlatformInfrastructureModule } from '../../infrastructure/platform/platform-infrastructure.module';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { RbacModule } from '../tenancy/rbac.module';

import { BulkStatusService } from './application/bulk-status.service';
import { ExportService } from './application/export.service';
import { ImportService } from './application/import.service';
import { OperationsService } from './application/operations.service';
import { ImportsController } from './presentation/imports.controller';

@Module({
  imports: [PrismaModule, PlatformInfrastructureModule, AuditModule, RbacModule],
  controllers: [ImportsController],
  providers: [ImportService, BulkStatusService, ExportService, OperationsService],
  exports: [ImportService, BulkStatusService, ExportService, OperationsService],
})
export class ImportsModule {}
