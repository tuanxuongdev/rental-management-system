import { Inject, Injectable } from '@nestjs/common';
import { AuditOutcome } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.module';

export type RecordAuditInput = {
  tenantId?: string | null;
  actorUserId?: string | null;
  sessionId?: string | null;
  action: string;
  outcome: 'SUCCESS' | 'FAILURE';
  reasonCode?: string | undefined;
  targetType?: string | undefined;
  targetId?: string | undefined;
  correlationId?: string | undefined;
  ipHash?: string | undefined;
  userAgentSummary?: string | undefined;
  changeSummary?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(input: RecordAuditInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        tenantId: input.tenantId ?? null,
        actorUserId: input.actorUserId ?? null,
        sessionId: input.sessionId ?? null,
        action: input.action,
        outcome: input.outcome === 'SUCCESS' ? AuditOutcome.SUCCESS : AuditOutcome.FAILURE,
        reasonCode: input.reasonCode ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        correlationId: input.correlationId ?? null,
        ipHash: input.ipHash ?? null,
        userAgentSummary: input.userAgentSummary ?? null,
        changeSummary: (input.changeSummary ?? {}) as object,
      },
    });
  }
}
