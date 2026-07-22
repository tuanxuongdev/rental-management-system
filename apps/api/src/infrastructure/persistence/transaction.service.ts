import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.module';

import type { Prisma } from '@prisma/client';

@Injectable()
export class TransactionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  run<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
