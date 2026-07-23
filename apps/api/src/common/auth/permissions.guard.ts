import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { type Reflector } from '@nestjs/core';

import { type AuthorizationService } from '../../modules/tenancy/application/authorization.service';

import {
  REQUIRED_ANY_PERMISSIONS_KEY,
  REQUIRED_PERMISSIONS_KEY,
} from './require-permissions.decorator';

import type { AuthActor } from './auth.types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredAll = this.reflector.getAllAndOverride<string[] | undefined>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredAny = this.reflector.getAllAndOverride<string[] | undefined>(
      REQUIRED_ANY_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<{
      actor?: AuthActor;
      params?: Record<string, string>;
    }>();

    const hasOrganizationPath = request.params?.organizationId !== undefined;
    const hasAll = requiredAll !== undefined && requiredAll.length > 0;
    const hasAny = requiredAny !== undefined && requiredAny.length > 0;

    // Deny-by-default on org-scoped routes: missing @RequirePermissions is a hole.
    if (!hasAll && !hasAny) {
      if (hasOrganizationPath) {
        throw new ForbiddenException({
          message: 'Insufficient permissions',
          code: 'FORBIDDEN',
        });
      }
      return true;
    }

    const actor = request.actor;

    if (actor === undefined) {
      throw new ForbiddenException({
        message: 'Insufficient permissions',
        code: 'FORBIDDEN',
      });
    }

    if (hasAll) {
      for (const permission of requiredAll!) {
        await this.authorization.assertPermission(
          actor.membershipId,
          actor.organizationId,
          permission,
        );
      }
    }

    if (hasAny) {
      await this.authorization.assertAnyPermission(
        actor.membershipId,
        actor.organizationId,
        requiredAny!,
      );
    }

    return true;
  }
}
