import { Inject, Injectable } from '@nestjs/common';

import {
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  type OperationsJobsCollection,
} from '@rpm/contracts';

import { PrismaService } from '../../../infrastructure/prisma/prisma.module';

import type { ImportJobStatus } from '@prisma/client';

type OpsRow = {
  id: string;
  type: string;
  kind: 'IMPORT' | 'EXPORT';
  status: ImportJobStatus;
  createdAt: Date;
  updatedAt: Date;
  counts?: Record<string, number>;
};

@Injectable()
export class OperationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listOperations(
    organizationId: string,
    options?: { limit?: number; after?: string },
  ): Promise<OperationsJobsCollection> {
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);

    let cursorCreatedAt: Date | undefined;
    let cursorId: string | undefined;
    if (options?.after !== undefined) {
      const [importAnchor, exportAnchor] = await Promise.all([
        this.prisma.importJob.findFirst({
          where: { id: options.after, tenantId: organizationId, deletedAt: null },
          select: { id: true, createdAt: true },
        }),
        this.prisma.exportJob.findFirst({
          where: { id: options.after, tenantId: organizationId },
          select: { id: true, createdAt: true },
        }),
      ]);
      const anchor = importAnchor ?? exportAnchor;
      if (anchor !== null) {
        cursorCreatedAt = anchor.createdAt;
        cursorId = anchor.id;
      }
    }

    // Keyset on (createdAt desc, id desc). Fetch limit+1 from each side then merge.
    const createdAtFilter =
      cursorCreatedAt !== undefined && cursorId !== undefined
        ? {
            OR: [
              { createdAt: { lt: cursorCreatedAt } },
              { createdAt: cursorCreatedAt, id: { lt: cursorId } },
            ],
          }
        : {};

    const [importJobs, exportJobs] = await Promise.all([
      this.prisma.importJob.findMany({
        where: {
          tenantId: organizationId,
          deletedAt: null,
          ...createdAtFilter,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      }),
      this.prisma.exportJob.findMany({
        where: {
          tenantId: organizationId,
          ...createdAtFilter,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      }),
    ]);

    const merged: OpsRow[] = [
      ...importJobs.map((job) => ({
        id: job.id,
        type: `import.${job.type.toLowerCase()}`,
        kind: 'IMPORT' as const,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        counts:
          job.counts !== null && typeof job.counts === 'object' && !Array.isArray(job.counts)
            ? (job.counts as Record<string, number>)
            : undefined,
      })),
      ...exportJobs.map((job) => ({
        id: job.id,
        type: `export.${job.type.toLowerCase()}`,
        kind: 'EXPORT' as const,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        counts:
          job.counts !== null && typeof job.counts === 'object' && !Array.isArray(job.counts)
            ? (job.counts as Record<string, number>)
            : undefined,
      })),
    ].sort((a, b) => {
      const byTime = b.createdAt.getTime() - a.createdAt.getTime();
      if (byTime !== 0) {
        return byTime;
      }
      return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
    });

    const pageItems = merged.slice(0, limit);
    const hasMore = merged.length > limit;
    const last = pageItems.at(-1);

    return {
      data: pageItems.map((item) => ({
        id: item.id,
        type: item.type,
        kind: item.kind,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        ...(item.counts !== undefined ? { counts: item.counts } : {}),
      })),
      page: {
        nextCursor: hasMore && last !== undefined ? last.id : null,
        previousCursor: null,
        limit,
      },
      meta: {},
    };
  }
}
