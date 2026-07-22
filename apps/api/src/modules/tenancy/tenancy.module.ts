import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';

import { InvitationService } from './application/invitation.service';
import { OrganizationService } from './application/organization.service';
import { InvitationsController } from './presentation/invitations.controller';
import { OrganizationsController } from './presentation/organizations.controller';

@Module({
  imports: [PrismaModule, AuditModule, IdentityModule],
  controllers: [OrganizationsController, InvitationsController],
  providers: [OrganizationService, InvitationService],
  exports: [OrganizationService, InvitationService],
})
export class TenancyModule {}
