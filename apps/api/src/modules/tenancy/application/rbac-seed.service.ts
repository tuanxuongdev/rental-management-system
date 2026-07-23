import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.module';

import { PERMISSION_CATALOG, SYSTEM_ROLE_CATALOG } from './permission-catalog';

@Injectable()
export class RbacSeedService implements OnModuleInit {
  private readonly logger = new Logger(RbacSeedService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    if (process.env.RBAC_SEED_ON_BOOT === 'false') {
      return;
    }

    try {
      await this.ensureCatalog();
    } catch (error) {
      this.logger.warn(
        `RBAC catalog seed skipped or failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async ensureCatalog(): Promise<void> {
    for (const permission of PERMISSION_CATALOG) {
      await this.prisma.permission.upsert({
        where: { key: permission.key },
        create: {
          id: randomUUID(),
          key: permission.key,
          domain: permission.domain,
          description: permission.description,
          riskLevel: permission.riskLevel,
          isPlatform: permission.isPlatform,
          isOwnerOnly: permission.isOwnerOnly,
          assignable: permission.assignable,
        },
        update: {
          domain: permission.domain,
          description: permission.description,
          riskLevel: permission.riskLevel,
          isPlatform: permission.isPlatform,
          isOwnerOnly: permission.isOwnerOnly,
          assignable: permission.assignable,
        },
      });
    }

    const permissions = await this.prisma.permission.findMany();
    const permissionByKey = new Map(permissions.map((item) => [item.key, item]));

    for (const roleSeed of SYSTEM_ROLE_CATALOG) {
      const existing = await this.prisma.role.findFirst({
        where: { tenantId: null, key: roleSeed.key },
      });

      const role =
        existing ??
        (await this.prisma.role.create({
          data: {
            id: randomUUID(),
            tenantId: null,
            key: roleSeed.key,
            name: roleSeed.name,
            description: roleSeed.description,
            isSystem: true,
            status: roleSeed.status,
            maximumScope: roleSeed.maximumScope,
          },
        }));

      if (existing !== null) {
        await this.prisma.role.update({
          where: { id: role.id },
          data: {
            name: roleSeed.name,
            description: roleSeed.description,
            status: roleSeed.status,
            maximumScope: roleSeed.maximumScope,
          },
        });
      }

      for (const permissionKey of roleSeed.permissionKeys) {
        const permission = permissionByKey.get(permissionKey);
        if (permission === undefined) {
          continue;
        }

        await this.prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          create: {
            id: randomUUID(),
            roleId: role.id,
            permissionId: permission.id,
          },
          update: {},
        });
      }
    }

    this.logger.log('RBAC permission catalog and system roles ensured');
  }

  async getSystemRoleId(roleKey: string): Promise<string> {
    await this.ensureCatalog();
    const role = await this.prisma.role.findFirst({
      where: { tenantId: null, key: roleKey, isSystem: true },
    });
    if (role === null) {
      throw new Error(`System role ${roleKey} is not seeded`);
    }
    return role.id;
  }
}
