import { Module } from '@nestjs/common';

import { PlatformInfrastructureModule } from '../../infrastructure/platform/platform-infrastructure.module';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { RbacModule } from '../tenancy/rbac.module';

import { ResidentService } from './application/resident.service';
import { WaitlistService } from './application/waitlist.service';
import { ResidentsController } from './presentation/residents.controller';

@Module({
  imports: [PrismaModule, PlatformInfrastructureModule, AuditModule, RbacModule],
  controllers: [ResidentsController],
  providers: [ResidentService, WaitlistService],
  exports: [ResidentService, WaitlistService],
})
export class ResidentsModule {}
