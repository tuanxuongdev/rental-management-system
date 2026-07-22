import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { IdentityModule } from '../../modules/identity/identity.module';

import { AuthUserValidator } from './auth-user.validator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OrganizationHeaderGuard } from './organization.guards';

@Module({
  imports: [PrismaModule, IdentityModule],
  providers: [
    OrganizationHeaderGuard,
    AuthUserValidator,
    {
      provide: APP_GUARD,
      useClass: OrganizationHeaderGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthUserValidator],
})
export class AuthModule {}
