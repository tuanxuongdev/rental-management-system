import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { AuthActor } from './auth.types';

@Injectable()
export class OrganizationHeaderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>();

    for (const header of ['x-tenant-id', 'x-organization-id']) {
      if (request.headers[header] !== undefined) {
        throw new BadRequestException({
          message: 'Caller-selected Organization headers are forbidden',
          code: 'ORGANIZATION_HEADER_FORBIDDEN',
        });
      }
    }

    return true;
  }
}

@Injectable()
export class OrganizationPathGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ actor?: AuthActor; params: Record<string, string> }>();

    const actor = request.actor;
    const pathOrganizationId = request.params.organizationId;

    if (pathOrganizationId === undefined || actor === undefined) {
      return true;
    }

    if (actor.organizationId !== pathOrganizationId) {
      throw new NotFoundException({
        message: 'Organization not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    return true;
  }
}
