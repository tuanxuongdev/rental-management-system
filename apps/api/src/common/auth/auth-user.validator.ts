import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { SessionStatus, UserStatus } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.module';

@Injectable()
export class AuthUserValidator {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertActiveUser(
    userId: string,
    tokenVersion: number,
    sessionId: string,
  ): Promise<{ email: string }> {
    const [user, session] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.userSession.findUnique({ where: { id: sessionId } }),
    ]);

    if (
      user === null ||
      user.status === UserStatus.DISABLED ||
      user.tokenVersion !== tokenVersion ||
      session === null ||
      session.userId !== userId ||
      session.status !== SessionStatus.ACTIVE
    ) {
      throw new UnauthorizedException({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    return { email: user.email };
  }
}
