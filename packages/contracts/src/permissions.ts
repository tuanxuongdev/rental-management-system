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
  // Sprint-07 residents / waitlist / documents (docs/06 + Sprint-07)
  RESIDENTS_LIST: 'residents.list',
  RESIDENTS_VIEW: 'residents.view',
  RESIDENTS_CREATE: 'residents.create',
  RESIDENTS_UPDATE: 'residents.update',
  RESIDENTS_ARCHIVE: 'residents.archive',
  RESIDENTS_SENSITIVE_DATA_VIEW: 'residents.sensitive_data.view',
  RESIDENTS_DO_NOT_RENT_MANAGE: 'residents.do_not_rent.manage',
  WAITLIST_LIST: 'waitlist.list',
  WAITLIST_VIEW: 'waitlist.view',
  WAITLIST_CREATE: 'waitlist.create',
  WAITLIST_UPDATE: 'waitlist.update',
  WAITLIST_REMOVE: 'waitlist.remove',
  DOCUMENTS_LIST: 'documents.list',
  DOCUMENTS_VIEW: 'documents.view',
  DOCUMENTS_UPLOAD: 'documents.upload',
  DOCUMENTS_DELETE: 'documents.delete',
  // Sprint-08 leases
  LEASES_LIST: 'leases.list',
  LEASES_VIEW: 'leases.view',
  LEASES_CREATE: 'leases.create',
  LEASES_UPDATE: 'leases.update',
  LEASES_ACTIVATE: 'leases.activate',
  LEASES_OVERRIDE_DO_NOT_RENT: 'leases.override_do_not_rent',
  // Sprint-09 lease lifecycle
  LEASES_MOVE_IN: 'leases.move_in',
  LEASES_RENEW: 'leases.renew',
  LEASES_TRANSFER: 'leases.transfer',
  LEASES_MOVE_OUT: 'leases.move_out',
  LEASES_TERMINATE: 'leases.terminate',
  ASSETS_KEYS_MANAGE: 'assets.keys.manage',
  // Sprint-10 billing / finance (docs/06 §15–16, Sprint-10)
  FINANCE_CHARGES_CREATE: 'finance.charges.create',
  FINANCE_CHARGES_UPDATE: 'finance.charges.update',
  FINANCE_CHARGES_VOID: 'finance.charges.void',
  FINANCE_INVOICES_LIST: 'finance.invoices.list',
  FINANCE_INVOICES_VIEW: 'finance.invoices.view',
  FINANCE_INVOICES_ISSUE: 'finance.invoices.issue',
  FINANCE_BILLING_RUN_PREVIEW: 'finance.billing_run.preview',
  FINANCE_BILLING_RUN_COMMIT: 'finance.billing_run.commit',
  FINANCE_DEPOSITS_VIEW: 'finance.deposits.view',
  FINANCE_DEPOSITS_RECORD: 'finance.deposits.record',
  FINANCE_CREDIT_NOTES_CREATE: 'finance.credit_notes.create',
  FINANCE_CREDIT_NOTES_POST: 'finance.credit_notes.post',
  FINANCE_REPORTS_VIEW: 'finance.reports.view',
  // Sprint-11 payments / receipts / deposit disposition (docs/06 §15–16)
  FINANCE_PAYMENTS_LIST: 'finance.payments.list',
  FINANCE_PAYMENTS_VIEW: 'finance.payments.view',
  FINANCE_PAYMENTS_RECORD: 'finance.payments.record',
  FINANCE_PAYMENTS_ALLOCATE: 'finance.payments.allocate',
  /** Refund request; same key used in SoD dangerous combination. */
  FINANCE_REFUNDS_REQUEST: 'finance.payments.refund',
  FINANCE_REFUNDS_APPROVE: 'finance.payments.refund.approve',
  FINANCE_REFUNDS_EXECUTE: 'finance.payments.refund.execute',
  FINANCE_DEPOSITS_DISPOSITION: 'finance.deposits.disposition',
  FINANCE_DEPOSITS_DISPOSITION_APPROVE: 'finance.deposits.disposition.approve',
  FINANCE_DEPOSITS_DISPOSE: 'finance.deposits.disposition.execute',
  // Sprint-12 reconciliation / controls (docs/06 wins over sprint synonyms)
  FINANCE_RECONCILIATION_VIEW: 'finance.reconciliation.view',
  FINANCE_RECONCILIATION_PERFORM: 'finance.reconciliation.perform',
  FINANCE_RECONCILIATION_APPROVE: 'finance.reconciliation.approve',
  FINANCE_PERIOD_CLOSE: 'finance.period.close',
  /** Canonical export key in docs/06 (sprint synonym exports.finance not used). */
  FINANCE_EXPORTS_CREATE: 'finance.exports.create',
  METERS_LIST: 'meters.list',
  METERS_VIEW: 'meters.view',
  METERS_CREATE: 'meters.create',
  METERS_UPDATE: 'meters.update',
  METERS_READINGS_RECORD: 'meters.readings.record',
  METERS_READINGS_BULK: 'meters.readings.bulk',
  UTILITIES_ALLOCATE: 'utilities.allocate',
  UTILITIES_USAGE_VIEW: 'utilities.usage.view',
  UTILITIES_TARIFFS_VIEW: 'utilities.tariffs.view',
  UTILITIES_TARIFFS_MANAGE: 'utilities.tariffs.manage',
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
  PERMISSION_KEYS.ORGANIZATION_SECURITY_UPDATE,
  PERMISSION_KEYS.FINANCE_REFUNDS_REQUEST,
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
