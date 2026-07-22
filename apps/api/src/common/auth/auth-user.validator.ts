import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.module';

@Injectable()
export class AuthUserValidator {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertActiveUser(userId: string, tokenVersion: number): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      user === null ||
      user.status === UserStatus.DISABLED ||
      user.tokenVersion !== tokenVersion
    ) {
      throw new UnauthorizedException({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }
  }
}
