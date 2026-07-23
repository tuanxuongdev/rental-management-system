import { z } from 'zod';

/** Canonical permission keys seeded for Sprint-04/05 administration and inventory domains. */
export const PERMISSION_KEYS = {
  ORGANIZATION_PROFILE_VIEW: 'organization.profile.view',
  ORGANIZATION_PROFILE_UPDATE: 'organization.profile.update',
  ORGANIZATION_SECURITY_VIEW: 'organization.security.view',
  ORGANIZATION_SECURITY_UPDATE: 'organization.security.update',
  ORGANIZATION_OWNERSHIP_TRANSFER: 'organization.ownership.transfer',
  ORGANIZATION_DELETE: 'organization.delete',
  MEMBERS_LIST: 'members.list',
  MEMBERS_VIEW: 'members.view',
  MEMBERS_INVITE: 'members.invite',
  MEMBERS_UPDATE: 'members.update',
  MEMBERS_SUSPEND: 'members.suspend',
  MEMBERS_REMOVE: 'members.remove',
  MEMBERS_ROLES_ASSIGN: 'members.roles.assign',
  ROLES_LIST: 'roles.list',
  ROLES_VIEW: 'roles.view',
  ROLES_CREATE: 'roles.create',
  ROLES_UPDATE: 'roles.update',
  ROLES_DELETE: 'roles.delete',
  AUDIT_EVENTS_VIEW: 'audit.events.view',
  // Sprint-05 portfolio / inventory (docs/06 canonical keys)
  PROPERTIES_LIST: 'properties.list',
  PROPERTIES_VIEW: 'properties.view',
  PROPERTIES_CREATE: 'properties.create',
  PROPERTIES_UPDATE: 'properties.update',
  PROPERTIES_ARCHIVE: 'properties.archive',
  PROPERTIES_ASSIGN_STAFF: 'properties.assign_staff',
  UNITS_LIST: 'units.list',
  UNITS_VIEW: 'units.view',
  UNITS_CREATE: 'units.create',
  UNITS_UPDATE: 'units.update',
  UNITS_ARCHIVE: 'units.archive',
  BEDS_LIST: 'beds.list',
  BEDS_VIEW: 'beds.view',
  BEDS_CREATE: 'beds.create',
  BEDS_UPDATE: 'beds.update',
  BEDS_ARCHIVE: 'beds.archive',
  PROPERTY_OWNERS_LIST: 'property_owners.list',
  PROPERTY_OWNERS_VIEW: 'property_owners.view',
  PROPERTY_OWNERS_CREATE: 'property_owners.create',
  PROPERTY_OWNERS_UPDATE: 'property_owners.update',
  PROPERTY_OWNERSHIPS_VIEW: 'property_ownerships.view',
  PROPERTY_OWNERSHIPS_CREATE: 'property_ownerships.create',
  PROPERTY_OWNERSHIPS_END: 'property_ownerships.end',
  MANAGEMENT_AGREEMENTS_LIST: 'management_agreements.list',
  MANAGEMENT_AGREEMENTS_VIEW: 'management_agreements.view',
  MANAGEMENT_AGREEMENTS_CREATE: 'management_agreements.create',
  MANAGEMENT_AGREEMENTS_UPDATE: 'management_agreements.update',
  MANAGEMENT_AGREEMENTS_ACTIVATE: 'management_agreements.activate',
  MANAGEMENT_AGREEMENTS_TERMINATE: 'management_agreements.terminate',
  OCCUPANCY_VIEW: 'occupancy.view',
  // Sprint-06 import / export / operations
  IMPORTS_INVENTORY: 'imports.inventory',
  EXPORTS_INVENTORY: 'exports.inventory',
  OPERATIONS_READ: 'operations.read',
  // Platform-only (never on custom org roles)
  PLATFORM_ORGANIZATIONS_LIST: 'platform.organizations.list',
  PLATFORM_SUPPORT_ACCESS_USE: 'platform.support_access.use',
  SUPPORT_ELEVATE: 'support.elevate',
} as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[keyof typeof PERMISSION_KEYS];

export const OWNER_ONLY_PERMISSION_KEYS = [
  PERMISSION_KEYS.ORGANIZATION_OWNERSHIP_TRANSFER,
  PERMISSION_KEYS.ORGANIZATION_DELETE,
] as const;

export const PLATFORM_PERMISSION_KEYS = [
  PERMISSION_KEYS.PLATFORM_ORGANIZATIONS_LIST,
  PERMISSION_KEYS.PLATFORM_SUPPORT_ACCESS_USE,
  PERMISSION_KEYS.SUPPORT_ELEVATE,
] as const;

/** Dangerous combination warned for SoD prep (roles admin + refund). */
export const DANGEROUS_PERMISSION_COMBINATION = [
  PERMISSION_KEYS.MEMBERS_ROLES_ASSIGN,
  'organization.security.update',
  'finance.payments.refund',
] as const;

export const SYSTEM_ROLE_KEYS = {
  OWNER: 'organization_owner',
  ADMIN: 'organization_administrator',
  PROPERTY_MANAGER: 'property_manager',
  ACCOUNTANT: 'accountant',
  MAINTENANCE: 'maintenance_staff',
  AUDITOR: 'read_only_auditor',
} as const;

export const permissionDefinitionSchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(1),
  domain: z.string().min(1),
  description: z.string(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  isPlatform: z.boolean(),
  isOwnerOnly: z.boolean(),
  assignable: z.boolean(),
});

export type PermissionDefinition = z.infer<typeof permissionDefinitionSchema>;
