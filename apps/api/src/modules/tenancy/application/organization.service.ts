import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipStatus, SeedRoleKey } from '@prisma/client';

import { type CreateOrganizationRequest, type OrganizationResponse } from '@rpm/contracts';

import { slugifyOrganizationName } from '../../../infrastructure/crypto/crypto.services';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class OrganizationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async createOrganization(
    userId: string,
    body: CreateOrganizationRequest,
    correlationId?: string,
  ): Promise<OrganizationResponse> {
    const existingMembership = await this.prisma.tenantMembership.findFirst({
      where: { userId, status: MembershipStatus.ACTIVE },
    });

    if (existingMembership !== null) {
      throw new ConflictException({
        message: 'User already belongs to an active Organization',
        code: 'MEMBERSHIP_EXISTS',
      });
    }

    const baseSlug = body.slug ?? slugifyOrganizationName(body.displayName);
    let slug = baseSlug;
    let suffix = 1;

    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const tenant = await this.transactions.run(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          slug,
          legalName: body.legalName ?? body.displayName,
          displayName: body.displayName,
          defaultCurrency: body.defaultCurrency ?? 'USD',
          defaultLocale: body.defaultLocale ?? 'en-US',
          timeZone: body.timeZone ?? 'UTC',
        },
      });

      await tx.tenantSetting.create({
        data: {
          tenantId: created.id,
          settingKey: 'bootstrap.completed',
          settingValue: { at: new Date().toISOString() },
        },
      });

      await tx.tenantMembership.create({
        data: {
          tenantId: created.id,
          userId,
          membershipType: 'WORKFORCE',
          status: MembershipStatus.ACTIVE,
          seedRole: SeedRoleKey.OWNER,
        },
      });

      return created;
    });

    await this.audit.record({
      tenantId: tenant.id,
      actorUserId: userId,
      action: 'organization.create',
      outcome: 'SUCCESS',
      targetType: 'tenant',
      targetId: tenant.id,
      correlationId,
      changeSummary: { displayName: tenant.displayName, slug: tenant.slug },
    });

    return this.toOrganizationResponse(tenant);
  }

  async getOrganization(
    organizationId: string,
    tokenOrganizationId: string | null,
  ): Promise<OrganizationResponse> {
    if (tokenOrganizationId !== organizationId) {
      throw new NotFoundException({
        message: 'Organization not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: organizationId } });
    if (tenant === null) {
      throw new NotFoundException({
        message: 'Organization not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    return this.toOrganizationResponse(tenant);
  }

  async assertCanInvite(organizationId: string, userId: string): Promise<void> {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: {
        tenantId: organizationId,
        userId,
        status: MembershipStatus.ACTIVE,
        seedRole: { in: [SeedRoleKey.OWNER, SeedRoleKey.ADMIN] },
      },
    });

    if (membership === null) {
      throw new ForbiddenException({
        message: 'Insufficient permissions to invite members',
        code: 'FORBIDDEN',
      });
    }
  }

  private toOrganizationResponse(tenant: {
    id: string;
    slug: string;
    displayName: string;
    legalName: string;
    status: 'ACTIVE' | 'SUSPENDED';
    defaultCurrency: string;
    defaultLocale: string;
    timeZone: string;
  }): OrganizationResponse {
    return {
      id: tenant.id,
      slug: tenant.slug,
      displayName: tenant.displayName,
      legalName: tenant.legalName,
      status: tenant.status,
      defaultCurrency: tenant.defaultCurrency,
      defaultLocale: tenant.defaultLocale,
      timeZone: tenant.timeZone,
    };
  }
}
