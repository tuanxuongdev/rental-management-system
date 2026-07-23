import { Module } from '@nestjs/common';

import { PlatformInfrastructureModule } from '../../infrastructure/platform/platform-infrastructure.module';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { RbacModule } from '../tenancy/rbac.module';

import { ManagementAgreementService } from './application/management-agreement.service';
import { OwnershipService } from './application/ownership.service';
import { PropertyOwnerService } from './application/property-owner.service';
import { PartiesController } from './presentation/parties.controller';

@Module({
  imports: [PrismaModule, PlatformInfrastructureModule, AuditModule, RbacModule],
  controllers: [PartiesController],
  providers: [PropertyOwnerService, OwnershipService, ManagementAgreementService],
  exports: [PropertyOwnerService, OwnershipService, ManagementAgreementService],
})
export class PartiesModule {}
