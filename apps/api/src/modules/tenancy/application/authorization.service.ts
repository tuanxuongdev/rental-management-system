import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus } from '@prisma/client';

import {
  DANGEROUS_PERMISSION_COMBINATION,
  OWNER_ONLY_PERMISSION_KEYS,
  PLATFORM_PERMISSION_KEYS,
  SYSTEM_ROLE_KEYS,
} from '@rpm/contracts';

import { PrismaService } from '../../../infrastructure/prisma/prisma.module';

import { isReadOnlyPermissionSet } from './permission-catalog';

@Injectable()
export class AuthorizationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getEffectivePermissionKeys(membershipId: string): Promise<string[]> {
    const now = new Date();
    const assignments = await this.prisma.membershipRole.findMany({
      where: {
        membershipId,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        role: { status: 'ACTIVE' },
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              where: {
                effectiveFrom: { lte: now },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
              },
              include: { permission: true },
            },
          },
        },
      },
    });

    const keys = new Set<string>();
    for (const assignment of assignments) {
      for (const rolePermission of assignment.role.rolePermissions) {
        keys.add(rolePermission.permission.key);
      }
    }
    return [...keys].sort();
  }

  async getEffectiveRoleKeys(membershipId: string): Promise<string[]> {
    const now = new Date();
    const assignments = await this.prisma.membershipRole.findMany({
      where: {
        membershipId,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        role: { status: 'ACTIVE' },
      },
      include: { role: true },
    });
    return assignments.map((item) => item.role.key).sort();
  }

  async assertPermission(
    membershipId: string | null | undefined,
    organizationId: string | null | undefined,
    permissionKey: string,
  ): Promise<void> {
    if (
      membershipId === null ||
      membershipId === undefined ||
      organizationId === null ||
      organizationId === undefined
    ) {
      throw new ForbiddenException({
        message: 'Insufficient permissions',
        code: 'FORBIDDEN',
      });
    }

    const membership = await this.prisma.tenantMembership.findFirst({
      where: {
        id: membershipId,
        tenantId: organizationId,
        status: MembershipStatus.ACTIVE,
      },
    });

    if (membership === null) {
      throw new ForbiddenException({
        message: 'Insufficient permissions',
        code: 'FORBIDDEN',
      });
    }

    const keys = await this.getEffectivePermissionKeys(membershipId);
    if (!keys.includes(permissionKey)) {
      throw new ForbiddenException({
        message: 'Insufficient permissions',
        code: 'FORBIDDEN',
        missingPermission: permissionKey,
      });
    }
  }

  async assertAnyPermission(
    membershipId: string | null | undefined,
    organizationId: string | null | undefined,
    permissionKeys: readonly string[],
  ): Promise<void> {
    if (
      membershipId === null ||
      membershipId === undefined ||
      organizationId === null ||
      organizationId === undefined ||
      permissionKeys.length === 0
    ) {
      throw new ForbiddenException({
        message: 'Insufficient permissions',
        code: 'FORBIDDEN',
      });
    }

    const membership = await this.prisma.tenantMembership.findFirst({
      where: {
        id: membershipId,
        tenantId: organizationId,
        status: MembershipStatus.ACTIVE,
      },
    });

    if (membership === null) {
      throw new ForbiddenException({
        message: 'Insufficient permissions',
        code: 'FORBIDDEN',
      });
    }

    const keys = await this.getEffectivePermissionKeys(membershipId);
    if (!permissionKeys.some((key) => keys.includes(key))) {
      throw new ForbiddenException({
        message: 'Insufficient permissions',
        code: 'FORBIDDEN',
        missingPermission: permissionKeys[0],
      });
    }
  }

  async isReadOnly(membershipId: string): Promise<boolean> {
    const keys = await this.getEffectivePermissionKeys(membershipId);
    return isReadOnlyPermissionSet(keys);
  }

  /** Custom role create/update: ban platform + owner-only; require actor subset. */
  validateCustomRolePermissionKeys(
    actorPermissionKeys: readonly string[],
    requestedKeys: readonly string[],
    options?: { actorIsOwner?: boolean },
  ): { warnings: string[] } {
    const platform = new Set<string>(PLATFORM_PERMISSION_KEYS);
    const ownerOnly = new Set<string>(OWNER_ONLY_PERMISSION_KEYS);
    const actor = new Set(actorPermissionKeys);
    const actorIsOwner = options?.actorIsOwner === true;

    for (const key of requestedKeys) {
      if (platform.has(key) || key.startsWith('platform.') || key === 'support.elevate') {
        throw new ForbiddenException({
          message: 'Custom roles cannot include platform permissions',
          code: 'PLATFORM_PERMISSION_FORBIDDEN',
        });
      }
      if (ownerOnly.has(key)) {
        throw new ForbiddenException({
          message: 'Custom roles cannot include owner-only permissions',
          code: 'OWNER_ONLY_PERMISSION_FORBIDDEN',
        });
      }
      if (!actor.has(key)) {
        throw new ForbiddenException({
          message: 'Cannot grant a permission you do not possess',
          code: 'DELEGATION_NOT_ALLOWED',
        });
      }
    }

    return this.evaluateDangerousCombination(requestedKeys, actorIsOwner);
  }

  /**
   * Role assignment: actor must possess every permission on the role (delegation),
   * except system Owner template may be assigned by an Owner even though it contains
   * owner-only keys the assignee will receive.
   */
  validateAssignableRolePermissionKeys(
    actorPermissionKeys: readonly string[],
    rolePermissionKeys: readonly string[],
    options: { actorIsOwner: boolean; isSystemOwnerRole: boolean },
  ): { warnings: string[] } {
    const platform = new Set<string>(PLATFORM_PERMISSION_KEYS);
    const ownerOnly = new Set<string>(OWNER_ONLY_PERMISSION_KEYS);
    const actor = new Set(actorPermissionKeys);

    for (const key of rolePermissionKeys) {
      if (platform.has(key) || key.startsWith('platform.') || key === 'support.elevate') {
        throw new ForbiddenException({
          message: 'Cannot assign a role that includes platform permissions',
          code: 'PLATFORM_PERMISSION_FORBIDDEN',
        });
      }

      if (ownerOnly.has(key)) {
        if (!(options.actorIsOwner && options.isSystemOwnerRole)) {
          throw new ForbiddenException({
            message: 'Cannot assign owner-only permissions',
            code: 'OWNER_ONLY_PERMISSION_FORBIDDEN',
          });
        }
        continue;
      }

      if (!actor.has(key)) {
        throw new ForbiddenException({
          message: 'Cannot grant a permission you do not possess',
          code: 'DELEGATION_NOT_ALLOWED',
        });
      }
    }

    return this.evaluateDangerousCombination(rolePermissionKeys, options.actorIsOwner);
  }

  private evaluateDangerousCombination(
    permissionKeys: readonly string[],
    actorIsOwner: boolean,
  ): { warnings: string[] } {
    const requested = new Set(permissionKeys);
    const hasDangerousTriple = DANGEROUS_PERMISSION_COMBINATION.every((key) => requested.has(key));
    if (!hasDangerousTriple) {
      return { warnings: [] };
    }

    const warning =
      'Dangerous combination: role administration, security update, and refund permissions';

    // Docs §7: non-Owners must not hold the SoD triple (warn-only is insufficient).
    if (!actorIsOwner) {
      throw new ForbiddenException({
        message: warning,
        code: 'ROLE_COMBINATION_FORBIDDEN',
      });
    }

    return { warnings: [warning] };
  }

  async assertCanAssignRoles(
    actorMembershipId: string,
    targetRoleIds: readonly string[],
    organizationId: string,
  ): Promise<void> {
    await this.assertPermission(actorMembershipId, organizationId, 'members.roles.assign');
    const actorKeys = await this.getEffectivePermissionKeys(actorMembershipId);
    const roles = await this.prisma.role.findMany({
      where: {
        id: { in: [...targetRoleIds] },
        OR: [{ tenantId: null, isSystem: true }, { tenantId: organizationId }],
      },
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });

    if (roles.length !== targetRoleIds.length) {
      throw new NotFoundException({
        message: 'Role not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const actorRoleKeys = await this.getEffectiveRoleKeys(actorMembershipId);
    const actorIsOwner = actorRoleKeys.includes(SYSTEM_ROLE_KEYS.OWNER);

    for (const role of roles) {
      const roleKeys = role.rolePermissions.map((rp) => rp.permission.key);
      const isSystemOwnerRole = role.isSystem && role.key === SYSTEM_ROLE_KEYS.OWNER;

      if (role.key === SYSTEM_ROLE_KEYS.OWNER && !actorIsOwner) {
        throw new ForbiddenException({
          message: 'Only an Organization Owner can assign the Owner role',
          code: 'DELEGATION_NOT_ALLOWED',
        });
      }

      this.validateAssignableRolePermissionKeys(actorKeys, roleKeys, {
        actorIsOwner,
        isSystemOwnerRole,
      });
    }
  }

  /** Ensure role IDs are system templates or owned by the organization (accept-time check). */
  async assertRolesBelongToOrganization(
    organizationId: string,
    roleIds: readonly string[],
  ): Promise<void> {
    if (roleIds.length === 0) {
      return;
    }

    const roles = await this.prisma.role.findMany({
      where: {
        id: { in: [...roleIds] },
        OR: [{ tenantId: null, isSystem: true }, { tenantId: organizationId }],
      },
    });

    if (roles.length !== roleIds.length) {
      throw new NotFoundException({
        message: 'Role not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
  }

  /**
   * Resolve property scope for a membership.
   * `null` = all properties in the organization (org-scoped roles or ALL_PROPERTIES grant).
   * `string[]` = explicitly granted property IDs (may be empty → no property access).
   */
  async resolveAccessiblePropertyIds(
    membershipId: string,
    organizationId: string,
  ): Promise<string[] | null> {
    const now = new Date();
    const assignments = await this.prisma.membershipRole.findMany({
      where: {
        membershipId,
        tenantId: organizationId,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        role: { status: 'ACTIVE' },
      },
      include: { role: true },
    });

    if (assignments.some((item) => item.role.maximumScope === 'ORGANIZATION')) {
      return null;
    }

    const grants = await this.prisma.propertyAccessGrant.findMany({
      where: {
        membershipId,
        tenantId: organizationId,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
    });

    if (grants.some((grant) => grant.scopeType === 'ALL_PROPERTIES')) {
      return null;
    }

    const propertyIds = [
      ...new Set(
        grants
          .filter((grant) => grant.scopeType === 'SELECTED_PROPERTIES' && grant.propertyId !== null)
          .map((grant) => grant.propertyId as string),
      ),
    ];
    return propertyIds;
  }

  /**
   * Non-disclosure: out-of-scope or cross-org property reads/writes surface as 404.
   * Pass `includeDeleted: true` for restore/archive recovery paths.
   */
  async assertPropertyAccess(
    membershipId: string,
    organizationId: string,
    propertyId: string,
    options?: { includeDeleted?: boolean },
  ): Promise<void> {
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        tenantId: organizationId,
        ...(options?.includeDeleted === true ? {} : { deletedAt: null }),
      },
      select: { id: true },
    });
    if (property === null) {
      throw new NotFoundException({
        message: 'Property not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const accessible = await this.resolveAccessiblePropertyIds(membershipId, organizationId);
    if (accessible === null) {
      return;
    }
    if (!accessible.includes(propertyId)) {
      throw new NotFoundException({
        message: 'Property not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
  }
}
