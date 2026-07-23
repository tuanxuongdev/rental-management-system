import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { type OrganizationSettings, type PatchOrganizationSettingsRequest } from '@rpm/contracts';

import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';

const DISPLAY_PREFS_KEY = 'display.preferences';

@Injectable()
export class OrganizationSettingsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async getSettings(organizationId: string): Promise<OrganizationSettings> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: organizationId } });
    if (tenant === null) {
      throw new NotFoundException({
        message: 'Organization not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const displaySetting = await this.prisma.tenantSetting.findFirst({
      where: { tenantId: organizationId, settingKey: DISPLAY_PREFS_KEY },
      orderBy: { effectiveFrom: 'desc' },
    });

    return {
      organizationId: tenant.id,
      displayName: tenant.displayName,
      legalName: tenant.legalName,
      defaultLocale: tenant.defaultLocale,
      timeZone: tenant.timeZone,
      defaultCurrency: tenant.defaultCurrency,
      displayPreferences:
        displaySetting?.settingValue !== null &&
        displaySetting?.settingValue !== undefined &&
        typeof displaySetting.settingValue === 'object'
          ? (displaySetting.settingValue as Record<string, unknown>)
          : {},
      version: tenant.version,
    };
  }

  async patchSettings(
    organizationId: string,
    actorUserId: string,
    body: PatchOrganizationSettingsRequest,
    ifMatchVersion: number,
    correlationId?: string,
  ): Promise<OrganizationSettings> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: organizationId } });
    if (tenant === null) {
      throw new NotFoundException({
        message: 'Organization not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (tenant.version !== ifMatchVersion) {
      throw new ConflictException({
        message: 'Organization version mismatch',
        code: 'VERSION_MISMATCH',
      });
    }

    const before = {
      displayName: tenant.displayName,
      legalName: tenant.legalName,
      defaultLocale: tenant.defaultLocale,
      timeZone: tenant.timeZone,
    };

    await this.prisma.tenant.update({
      where: { id: organizationId },
      data: {
        displayName: body.displayName ?? tenant.displayName,
        legalName: body.legalName ?? tenant.legalName,
        defaultLocale: body.defaultLocale ?? tenant.defaultLocale,
        timeZone: body.timeZone ?? tenant.timeZone,
        version: { increment: 1 },
      },
    });

    if (body.displayPreferences !== undefined) {
      await this.prisma.tenantSetting.create({
        data: {
          tenantId: organizationId,
          settingKey: DISPLAY_PREFS_KEY,
          settingValue: body.displayPreferences as object,
          effectiveFrom: new Date(),
        },
      });
    }

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'organization.settings.update',
      outcome: 'SUCCESS',
      targetType: 'tenant',
      targetId: organizationId,
      correlationId,
      changeSummary: {
        before,
        after: {
          displayName: body.displayName ?? tenant.displayName,
          legalName: body.legalName ?? tenant.legalName,
          defaultLocale: body.defaultLocale ?? tenant.defaultLocale,
          timeZone: body.timeZone ?? tenant.timeZone,
          displayPreferences: body.displayPreferences,
        },
      },
    });

    return this.getSettings(organizationId);
  }
}
