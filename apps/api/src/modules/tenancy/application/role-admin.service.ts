import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  type CreateRoleRequest,
  normalizePaginationLimit,
  type PatchRoleRequest,
  PAGINATION_DEFAULT_LIMIT,
  type PermissionsCollection,
  type RoleSummary,
  type RolesCollection,
  SYSTEM_ROLE_KEYS,
} from '@rpm/contracts';

import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';

import { AuthorizationService } from './authorization.service';

@Injectable()
export class RoleAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listRoles(
    organizationId: string,
    options?: { limit?: number; after?: string },
  ): Promise<RolesCollection> {
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);
    const roles = await this.prisma.role.findMany({
      where: {
        OR: [{ tenantId: null, isSystem: true }, { tenantId: organizationId }],
        ...(options?.after !== undefined ? { id: { gt: options.after } } : {}),
      },
      include: {
        rolePermissions: { include: { permission: true } },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });

    const pageItems = roles.slice(0, limit);
    const hasMore = roles.length > limit;
    const last = pageItems.at(-1);

    return {
      data: pageItems.map((role) => this.toRoleSummary(role)),
      page: {
        nextCursor: hasMore && last !== undefined ? last.id : null,
        previousCursor: null,
        limit,
      },
      meta: {},
    };
  }

  async getRole(organizationId: string, roleId: string): Promise<RoleSummary> {
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        OR: [{ tenantId: null, isSystem: true }, { tenantId: organizationId }],
      },
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });

    if (role === null) {
      throw new NotFoundException({ message: 'Role not found', code: 'RESOURCE_NOT_FOUND' });
    }

    return this.toRoleSummary(role);
  }

  async createRole(
    organizationId: string,
    actorMembershipId: string,
    actorUserId: string,
    body: CreateRoleRequest,
    correlationId?: string,
  ): Promise<RoleSummary & { warnings: string[] }> {
    const actorKeys = await this.authorization.getEffectivePermissionKeys(actorMembershipId);
    const actorRoleKeys = await this.authorization.getEffectiveRoleKeys(actorMembershipId);
    const { warnings } = this.authorization.validateCustomRolePermissionKeys(
      actorKeys,
      body.permissionKeys,
      { actorIsOwner: actorRoleKeys.includes(SYSTEM_ROLE_KEYS.OWNER) },
    );

    const duplicate = await this.prisma.role.findFirst({
      where: { tenantId: organizationId, key: body.key },
    });
    if (duplicate !== null) {
      throw new ConflictException({
        message: 'Role key already exists',
        code: 'DUPLICATE_RESOURCE',
      });
    }

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: body.permissionKeys } },
    });
    if (permissions.length !== body.permissionKeys.length) {
      throw new ForbiddenException({
        message: 'Unknown permission key',
        code: 'VALIDATION_FAILED',
      });
    }

    const role = await this.transactions.run(async (tx) => {
      const created = await tx.role.create({
        data: {
          id: randomUUID(),
          tenantId: organizationId,
          key: body.key,
          name: body.name,
          description: body.description ?? null,
          isSystem: false,
          status: 'ACTIVE',
          maximumScope: body.maximumScope ?? 'ORGANIZATION',
        },
      });

      for (const permission of permissions) {
        await tx.rolePermission.create({
          data: {
            id: randomUUID(),
            roleId: created.id,
            permissionId: permission.id,
          },
        });
      }

      return created;
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'role.create',
      outcome: 'SUCCESS',
      targetType: 'role',
      targetId: role.id,
      correlationId,
      changeSummary: { key: body.key, permissionKeys: body.permissionKeys, warnings },
    });

    const summary = await this.getRole(organizationId, role.id);
    return { ...summary, warnings };
  }

  async patchRole(
    organizationId: string,
    roleId: string,
    actorMembershipId: string,
    actorUserId: string,
    body: PatchRoleRequest,
    ifMatchVersion: number,
    correlationId?: string,
  ): Promise<RoleSummary & { warnings: string[] }> {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId: organizationId, isSystem: false },
      include: { rolePermissions: { include: { permission: true } } },
    });

    if (role === null) {
      const system = await this.prisma.role.findFirst({
        where: { id: roleId, isSystem: true },
      });
      if (system !== null) {
        throw new ConflictException({
          message: 'System roles are immutable; clone instead',
          code: 'SYSTEM_ROLE_IMMUTABLE',
        });
      }
      throw new NotFoundException({ message: 'Role not found', code: 'RESOURCE_NOT_FOUND' });
    }

    if (role.version !== ifMatchVersion) {
      throw new ConflictException({
        message: 'Role version mismatch',
        code: 'VERSION_MISMATCH',
      });
    }

    const nextPermissionKeys =
      body.permissionKeys ?? role.rolePermissions.map((rp) => rp.permission.key);
    const actorKeys = await this.authorization.getEffectivePermissionKeys(actorMembershipId);
    const actorRoleKeys = await this.authorization.getEffectiveRoleKeys(actorMembershipId);
    const { warnings } = this.authorization.validateCustomRolePermissionKeys(
      actorKeys,
      nextPermissionKeys,
      { actorIsOwner: actorRoleKeys.includes(SYSTEM_ROLE_KEYS.OWNER) },
    );

    if (body.permissionKeys !== undefined) {
      const permissions = await this.prisma.permission.findMany({
        where: { key: { in: body.permissionKeys } },
      });
      if (permissions.length !== body.permissionKeys.length) {
        throw new ForbiddenException({
          message: 'Unknown permission key',
          code: 'VALIDATION_FAILED',
        });
      }
    }

    const before = {
      name: role.name,
      permissionKeys: role.rolePermissions.map((rp) => rp.permission.key),
    };

    await this.transactions.run(async (tx) => {
      await tx.role.update({
        where: { id: roleId },
        data: {
          name: body.name ?? role.name,
          description: body.description === undefined ? role.description : body.description,
          maximumScope: body.maximumScope ?? role.maximumScope,
          version: { increment: 1 },
        },
      });

      if (body.permissionKeys !== undefined) {
        await tx.rolePermission.deleteMany({ where: { roleId } });
        const permissions = await tx.permission.findMany({
          where: { key: { in: body.permissionKeys } },
        });
        for (const permission of permissions) {
          await tx.rolePermission.create({
            data: {
              id: randomUUID(),
              roleId,
              permissionId: permission.id,
            },
          });
        }
      }
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'role.update',
      outcome: 'SUCCESS',
      targetType: 'role',
      targetId: roleId,
      correlationId,
      changeSummary: {
        before,
        after: { name: body.name ?? role.name, permissionKeys: nextPermissionKeys },
        warnings,
      },
    });

    const summary = await this.getRole(organizationId, roleId);
    return { ...summary, warnings };
  }

  async listPermissions(organizationId: string): Promise<PermissionsCollection> {
    void organizationId;
    const permissions = await this.prisma.permission.findMany({
      where: { isPlatform: false },
      orderBy: { key: 'asc' },
    });

    return {
      data: permissions.map((permission) => ({
        id: permission.id,
        key: permission.key,
        domain: permission.domain,
        description: permission.description,
        riskLevel: permission.riskLevel,
        isPlatform: permission.isPlatform,
        isOwnerOnly: permission.isOwnerOnly,
        assignable: permission.assignable,
      })),
      page: {
        nextCursor: null,
        previousCursor: null,
        limit: permissions.length || PAGINATION_DEFAULT_LIMIT,
      },
      meta: {},
    };
  }

  private toRoleSummary(role: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    status: 'ACTIVE' | 'RETIRED' | 'INACTIVE';
    maximumScope: 'ORGANIZATION' | 'PROPERTY' | 'SELF';
    version: number;
    rolePermissions: Array<{ permission: { key: string } }>;
  }): RoleSummary {
    return {
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      status: role.status,
      maximumScope: role.maximumScope,
      permissionKeys: role.rolePermissions.map((rp) => rp.permission.key).sort(),
      version: role.version,
    };
  }
}
