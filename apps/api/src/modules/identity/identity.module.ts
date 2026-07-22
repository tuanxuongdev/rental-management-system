import { Module } from '@nestjs/common';

import { ApiConfigModule } from '../../bootstrap/api-config.module';
import { JwtService } from '../../infrastructure/auth/jwt.service';
import { RefreshCookieService } from '../../infrastructure/auth/refresh-cookie.service';
import {
  PasswordHasherService,
  TokenHashService,
} from '../../infrastructure/crypto/crypto.services';
import { EmailService } from '../../infrastructure/email/email.service';
import { PlatformInfrastructureModule } from '../../infrastructure/platform/platform-infrastructure.module';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { RateLimitService } from '../../infrastructure/rate-limit/rate-limit.service';
import { AuditModule } from '../audit/audit.module';

import { AuthService } from './application/auth.service';
import { MeService } from './application/me.service';
import { AuthController, MeController } from './presentation/auth.controller';

@Module({
  imports: [ApiConfigModule, PrismaModule, PlatformInfrastructureModule, AuditModule],
  controllers: [AuthController, MeController],
  providers: [
    AuthService,
    MeService,
    JwtService,
    RefreshCookieService,
    PasswordHasherService,
    TokenHashService,
    RateLimitService,
    EmailService,
  ],
  exports: [
    AuthService,
    MeService,
    JwtService,
    PasswordHasherService,
    TokenHashService,
    EmailService,
  ],
})
export class IdentityModule {}
