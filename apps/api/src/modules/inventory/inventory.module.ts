import { Module } from '@nestjs/common';

import { PlatformInfrastructureModule } from '../../infrastructure/platform/platform-infrastructure.module';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { RbacModule } from '../tenancy/rbac.module';

import { AmenityService } from './application/amenity.service';
import { AvailabilityService } from './application/availability.service';
import { BedService } from './application/bed.service';
import { BuildingService } from './application/building.service';
import { PropertyService } from './application/property.service';
import { UnitService } from './application/unit.service';
import { InventoryController } from './presentation/inventory.controller';

@Module({
  imports: [PrismaModule, PlatformInfrastructureModule, AuditModule, RbacModule],
  controllers: [InventoryController],
  providers: [
    PropertyService,
    BuildingService,
    UnitService,
    BedService,
    AmenityService,
    AvailabilityService,
  ],
  exports: [
    PropertyService,
    BuildingService,
    UnitService,
    BedService,
    AmenityService,
    AvailabilityService,
  ],
})
export class InventoryModule {}
