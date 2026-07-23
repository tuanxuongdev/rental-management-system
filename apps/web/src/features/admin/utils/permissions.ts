import {
  DANGEROUS_PERMISSION_COMBINATION,
  PERMISSION_KEYS,
  type MeResponse,
  type PermissionKey,
} from '@rpm/contracts';

export function hasPermission(
  me: MeResponse | null | undefined,
  key: PermissionKey | string,
): boolean {
  if (!me) {
    return false;
  }
  return me.permissionKeys.includes(key);
}

export function canMutate(me: MeResponse | null | undefined, key: PermissionKey | string): boolean {
  if (!me || me.isReadOnly) {
    return false;
  }
  return hasPermission(me, key);
}

export function hasDangerousPermissionCombination(selectedKeys: readonly string[]): boolean {
  const selected = new Set(selectedKeys);
  return DANGEROUS_PERMISSION_COMBINATION.every((key) => selected.has(key));
}

export const ADMIN_PERMISSIONS = {
  membersList: PERMISSION_KEYS.MEMBERS_LIST,
  membersView: PERMISSION_KEYS.MEMBERS_VIEW,
  membersUpdate: PERMISSION_KEYS.MEMBERS_UPDATE,
  membersSuspend: PERMISSION_KEYS.MEMBERS_SUSPEND,
  membersRolesAssign: PERMISSION_KEYS.MEMBERS_ROLES_ASSIGN,
  membersInvite: PERMISSION_KEYS.MEMBERS_INVITE,
  rolesList: PERMISSION_KEYS.ROLES_LIST,
  rolesView: PERMISSION_KEYS.ROLES_VIEW,
  rolesCreate: PERMISSION_KEYS.ROLES_CREATE,
  rolesUpdate: PERMISSION_KEYS.ROLES_UPDATE,
  organizationProfileView: PERMISSION_KEYS.ORGANIZATION_PROFILE_VIEW,
  organizationProfileUpdate: PERMISSION_KEYS.ORGANIZATION_PROFILE_UPDATE,
  propertiesAssignStaff: PERMISSION_KEYS.PROPERTIES_ASSIGN_STAFF,
} as const;

export const SOD_WARNING_TEXT =
  'Warning: this permission set combines role administration, security update, and refund capabilities (separation of duties risk).';
