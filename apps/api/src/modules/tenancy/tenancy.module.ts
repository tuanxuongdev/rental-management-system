import { Module } from '@nestjs/common';

import { PlatformInfrastructureModule } from '../../infrastructure/platform/platform-infrastructure.module';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';

import { InvitationService } from './application/invitation.service';
import { MembershipAdminService } from './application/membership-admin.service';
import { OrganizationSettingsService } from './application/organization-settings.service';
import { OrganizationService } from './application/organization.service';
import { PropertyAccessGrantService } from './application/property-access-grant.service';
import { RoleAdminService } from './application/role-admin.service';
import { InvitationsController } from './presentation/invitations.controller';
import { OrganizationsController } from './presentation/organizations.controller';
import { RbacModule } from './rbac.module';

@Module({
  imports: [PrismaModule, PlatformInfrastructureModule, AuditModule, IdentityModule, RbacModule],
  controllers: [OrganizationsController, InvitationsController],
  providers: [
    OrganizationService,
    InvitationService,
    MembershipAdminService,
    RoleAdminService,
    OrganizationSettingsService,
    PropertyAccessGrantService,
  ],
  exports: [
    OrganizationService,
    InvitationService,
    MembershipAdminService,
    RoleAdminService,
    OrganizationSettingsService,
    PropertyAccessGrantService,
    RbacModule,
  ],
})
export class TenancyModule {}
