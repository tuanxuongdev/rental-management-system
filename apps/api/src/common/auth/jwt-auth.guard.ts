import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { JwtService } from '../../infrastructure/auth/jwt.service';

import { AuthUserValidator } from './auth-user.validator';
import { IS_PUBLIC_KEY } from './public.decorator';

import type { AuthActor } from './auth.types';
import type { Request } from 'express';

type AuthenticatedRequest = Request & { actor?: AuthActor; authToken?: string };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(AuthUserValidator) private readonly authUserValidator: AuthUserValidator,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

    if (token === undefined || token.length === 0) {
      throw new UnauthorizedException({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    try {
      const claims = await this.jwt.verifyAccessToken(token);
      const user = await this.authUserValidator.assertActiveUser(
        claims.sub,
        claims.token_version,
        claims.sid,
        claims.org_id,
        claims.membership_id,
      );

      request.actor = {
        userId: claims.sub,
        sessionId: claims.sid,
        organizationId: user.organizationId,
        membershipId: user.membershipId,
        tokenVersion: claims.token_version,
        email: user.email,
      };
      request.authToken = token;

      return true;
    } catch {
      throw new UnauthorizedException({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }
  }
}
