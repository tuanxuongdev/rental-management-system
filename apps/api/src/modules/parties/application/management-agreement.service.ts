import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type ManagementAgreement } from '@prisma/client';

import {
  type ActivateAgreementRequest,
  type CreateManagementAgreementRequest,
  type ManagementAgreementResponse,
  type ManagementAgreementsCollection,
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  type PatchManagementAgreementRequest,
  type TerminateAgreementRequest,
} from '@rpm/contracts';

import { throwVersionMismatch } from '../../../common/auth/if-match';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';
import { AuthorizationService } from '../../tenancy/application/authorization.service';

type AgreementWithParties = ManagementAgreement & {
  parties: { partyId: string }[];
};

@Injectable()
export class ManagementAgreementService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listAgreements(
    organizationId: string,
    membershipId: string,
    options?: { limit?: number; after?: string; propertyId?: string },
  ): Promise<ManagementAgreementsCollection> {
    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);

    if (accessible !== null && accessible.length === 0) {
      return {
        data: [],
        page: { nextCursor: null, previousCursor: null, limit },
        meta: {},
      };
    }

    if (options?.propertyId !== undefined) {
      await this.authorization.assertPropertyAccess(
        membershipId,
        organizationId,
        options.propertyId,
      );
    }

    const scopedPropertyFilter =
      options?.propertyId !== undefined
        ? { propertyId: options.propertyId }
        : accessible !== null
          ? { propertyId: { in: accessible } }
          : {};

    const agreements = await this.prisma.managementAgreement.findMany({
      where: {
        tenantId: organizationId,
        ...scopedPropertyFilter,
        ...(options?.after !== undefined ? { id: { gt: options.after } } : {}),
      },
      include: { parties: true },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });

    const pageItems = agreements.slice(0, limit);
    const hasMore = agreements.length > limit;
    const last = pageItems.at(-1);

    return {
      data: pageItems.map((item) => this.toResponse(item)),
      page: {
        nextCursor: hasMore && last !== undefined ? last.id : null,
        previousCursor: null,
        limit,
      },
      meta: {},
    };
  }

  async getAgreement(
    organizationId: string,
    membershipId: string,
    agreementId: string,
  ): Promise<ManagementAgreementResponse> {
    const agreement = await this.findAgreement(organizationId, agreementId);
    await this.authorization.assertPropertyAccess(
      membershipId,
      organizationId,
      agreement.propertyId,
    );
    return this.toResponse(agreement);
  }

  /**
   * Creates a management agreement draft. Does NOT create memberships or login access.
   */
  async createAgreement(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    body: CreateManagementAgreementRequest,
    correlationId?: string,
  ): Promise<ManagementAgreementResponse> {
    await this.authorization.assertPropertyAccess(membershipId, organizationId, body.propertyId);

    const property = await this.prisma.property.findFirst({
      where: { id: body.propertyId, tenantId: organizationId, deletedAt: null },
    });
    if (property === null) {
      throw new NotFoundException({
        message: 'Property not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const membershipCountBefore = await this.prisma.tenantMembership.count({
      where: { tenantId: organizationId },
    });

    if (body.partyIds !== undefined && body.partyIds.length > 0) {
      const parties = await this.prisma.party.findMany({
        where: {
          tenantId: organizationId,
          id: { in: body.partyIds },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (parties.length !== body.partyIds.length) {
        throw new UnprocessableEntityException({
          message: 'Agreement party not found in organization',
          code: 'AGREEMENT_PARTY_INVALID',
        });
      }
    }

    const created = await this.transactions.run(async (tx) => {
      const agreement = await tx.managementAgreement.create({
        data: {
          tenantId: organizationId,
          propertyId: body.propertyId,
          agreementNumber: body.agreementNumber,
          status: 'DRAFT',
          effectiveFrom: new Date(body.effectiveFrom),
          effectiveTo: body.effectiveTo !== undefined ? new Date(body.effectiveTo) : null,
          notes: body.notes ?? null,
          ...(body.partyIds !== undefined && body.partyIds.length > 0
            ? {
                parties: {
                  create: body.partyIds.map((partyId) => ({
                    tenantId: organizationId,
                    partyId,
                    role: 'PARTY',
                  })),
                },
              }
            : {}),
        },
        include: { parties: true },
      });
      return agreement;
    });

    const membershipCountAfter = await this.prisma.tenantMembership.count({
      where: { tenantId: organizationId },
    });
    if (membershipCountAfter !== membershipCountBefore) {
      throw new ConflictException({
        message: 'Management agreement must not create memberships',
        code: 'AGREEMENT_MUST_NOT_GRANT_ACCESS',
      });
    }

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'management_agreement.create',
      outcome: 'SUCCESS',
      targetType: 'management_agreement',
      targetId: created.id,
      correlationId,
      changeSummary: {
        propertyId: body.propertyId,
        grantsLoginAccess: false,
      },
    });

    return this.toResponse(created);
  }

  async patchAgreement(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    agreementId: string,
    body: PatchManagementAgreementRequest,
    ifMatchVersion: number,
    correlationId?: string,
  ): Promise<ManagementAgreementResponse> {
    const existing = await this.findAgreement(organizationId, agreementId);
    await this.authorization.assertPropertyAccess(
      membershipId,
      organizationId,
      existing.propertyId,
    );

    if (existing.version !== ifMatchVersion) {
      throwVersionMismatch('Agreement version mismatch');
    }

    if (existing.status === 'ACTIVE') {
      throw new ConflictException({
        message: 'Active agreement fields are immutable; terminate or create a replacement',
        code: 'ACTIVE_AGREEMENT_FIELD_IMMUTABLE',
      });
    }

    const updated = await this.prisma.managementAgreement.update({
      where: { id: agreementId },
      data: {
        ...(body.agreementNumber !== undefined ? { agreementNumber: body.agreementNumber } : {}),
        ...(body.effectiveFrom !== undefined
          ? { effectiveFrom: new Date(body.effectiveFrom) }
          : {}),
        ...(body.effectiveTo !== undefined
          ? { effectiveTo: body.effectiveTo === null ? null : new Date(body.effectiveTo) }
          : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        version: { increment: 1 },
      },
      include: { parties: true },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'management_agreement.update',
      outcome: 'SUCCESS',
      targetType: 'management_agreement',
      targetId: agreementId,
      correlationId,
      changeSummary: body as Record<string, unknown>,
    });

    return this.toResponse(updated);
  }

  async activateAgreement(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    agreementId: string,
    body: ActivateAgreementRequest,
    ifMatchVersion: number,
    correlationId?: string,
  ): Promise<ManagementAgreementResponse> {
    const existing = await this.findAgreement(organizationId, agreementId);
    await this.authorization.assertPropertyAccess(
      membershipId,
      organizationId,
      existing.propertyId,
    );

    if (existing.version !== ifMatchVersion) {
      throwVersionMismatch('Agreement version mismatch');
    }

    if (existing.status !== 'DRAFT') {
      throw new ConflictException({
        message: 'Only draft agreements can be activated',
        code: 'AGREEMENT_INCOMPLETE',
      });
    }

    const effectiveFrom =
      body.effectiveFrom !== undefined ? new Date(body.effectiveFrom) : existing.effectiveFrom;
    const effectiveTo = existing.effectiveTo;

    const overlapping = await this.prisma.managementAgreement.findFirst({
      where: {
        tenantId: organizationId,
        propertyId: existing.propertyId,
        status: 'ACTIVE',
        id: { not: agreementId },
        effectiveFrom: { lte: effectiveTo ?? new Date('9999-12-31T00:00:00.000Z') },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
      },
    });
    if (overlapping !== null) {
      throw new ConflictException({
        message: 'An active management agreement already covers this period',
        code: 'AGREEMENT_OVERLAP',
      });
    }

    const updated = await this.prisma.managementAgreement.update({
      where: { id: agreementId },
      data: {
        status: 'ACTIVE',
        ...(body.effectiveFrom !== undefined
          ? { effectiveFrom: new Date(body.effectiveFrom) }
          : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        version: { increment: 1 },
      },
      include: { parties: true },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'management_agreement.activate',
      outcome: 'SUCCESS',
      targetType: 'management_agreement',
      targetId: agreementId,
      correlationId,
    });

    return this.toResponse(updated);
  }

  async terminateAgreement(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    agreementId: string,
    body: TerminateAgreementRequest,
    ifMatchVersion: number,
    correlationId?: string,
  ): Promise<ManagementAgreementResponse> {
    const existing = await this.findAgreement(organizationId, agreementId);
    await this.authorization.assertPropertyAccess(
      membershipId,
      organizationId,
      existing.propertyId,
    );

    if (existing.version !== ifMatchVersion) {
      throwVersionMismatch('Agreement version mismatch');
    }

    if (existing.status === 'TERMINATED') {
      throw new ConflictException({
        message: 'Agreement already terminated',
        code: 'AGREEMENT_ALREADY_TERMINATED',
      });
    }

    const updated = await this.prisma.managementAgreement.update({
      where: { id: agreementId },
      data: {
        status: 'TERMINATED',
        effectiveTo: new Date(body.effectiveTo),
        version: { increment: 1 },
      },
      include: { parties: true },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'management_agreement.terminate',
      outcome: 'SUCCESS',
      targetType: 'management_agreement',
      targetId: agreementId,
      correlationId,
      changeSummary: { reason: body.reason },
    });

    return this.toResponse(updated);
  }

  private async findAgreement(
    organizationId: string,
    agreementId: string,
  ): Promise<AgreementWithParties> {
    const agreement = await this.prisma.managementAgreement.findFirst({
      where: { id: agreementId, tenantId: organizationId },
      include: { parties: true },
    });
    if (agreement === null) {
      throw new NotFoundException({
        message: 'Management agreement not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    return agreement;
  }

  toResponse(agreement: AgreementWithParties): ManagementAgreementResponse {
    return {
      id: agreement.id,
      organizationId: agreement.tenantId,
      propertyId: agreement.propertyId,
      agreementNumber: agreement.agreementNumber,
      status: agreement.status,
      effectiveFrom: agreement.effectiveFrom.toISOString(),
      effectiveTo: agreement.effectiveTo?.toISOString() ?? null,
      notes: agreement.notes,
      version: agreement.version,
      grantsLoginAccess: false,
      partyIds: agreement.parties.map((party) => party.partyId),
      createdAt: agreement.createdAt.toISOString(),
      updatedAt: agreement.updatedAt.toISOString(),
    };
  }
}
