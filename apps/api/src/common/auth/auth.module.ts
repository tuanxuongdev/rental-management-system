import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Module,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';

/** Skeleton actor — no real authentication yet. */
export type AuthActor = {
  userId: string | null;
  organizationId: string | null;
};

export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthActor => {
    const request = ctx.switchToHttp().getRequest<{ actor?: AuthActor }>();
    return request.actor ?? { userId: null, organizationId: null };
  },
);

/**
 * Placeholder guard. Always allows in foundation builds.
 * Later sprints replace this with JWT session validation.
 * Access tokens must never be read from localStorage.
 */
@Injectable()
export class AuthSkeletonGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ actor?: AuthActor; headers: Record<string, unknown> }>();
    request.actor = { userId: null, organizationId: null };

    // Reject forbidden tenancy header pattern early (confused-deputy prevention).
    if (request.headers['x-tenant-id'] !== undefined) {
      throw new UnauthorizedException('X-Tenant-ID is not supported');
    }

    return true;
  }
}

@Module({
  providers: [AuthSkeletonGuard],
  exports: [AuthSkeletonGuard],
})
export class AuthModule {}
