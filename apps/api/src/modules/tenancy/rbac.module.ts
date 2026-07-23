import { Module } from '@nestjs/common';

import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';

import { AuthorizationService } from './application/authorization.service';
import { RbacSeedService } from './application/rbac-seed.service';

/**
 * Thin shared RBAC module — no Identity/Tenancy imports (avoids circular deps).
 * Imported by IdentityModule (MeService) and TenancyModule (admin APIs / guards).
 */
@Module({
  imports: [PrismaModule],
  providers: [AuthorizationService, RbacSeedService, PermissionsGuard],
  exports: [AuthorizationService, RbacSeedService, PermissionsGuard],
})
export class RbacModule {}
