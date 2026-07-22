import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthActor } from './auth.types';

export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthActor => {
    const request = ctx.switchToHttp().getRequest<{ actor: AuthActor }>();
    return request.actor;
  },
);
