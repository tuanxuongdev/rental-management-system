import { z } from 'zod';

import { createCursorCollectionSchema } from './pagination';
import { permissionDefinitionSchema } from './permissions';

export const AUTH_ORGANIZATION_SWITCH_PATH = '/v1/auth/organization-switch' as const;

export const ORGANIZATION_MEMBERS_PATH = '/v1/organizations/{organizationId}/members' as const;
export const ORGANIZATION_MEMBER_BY_ID_PATH =
  '/v1/organizations/{organizationId}/members/{membershipId}' as const;
export const ORGANIZATION_MEMBER_PROPERTY_ACCESS_GRANTS_PATH =
  '/v1/organizations/{organizationId}/members/{membershipId}/property-access-grants' as const;
export const ORGANIZATION_MEMBER_PROPERTY_ACCESS_GRANT_BY_ID_PATH =
  '/v1/organizations/{organizationId}/members/{membershipId}/property-access-grants/{grantId}' as const;
export const ORGANIZATION_MEMBER_PROPERTY_ACCESS_GRANT_END_PATH =
  '/v1/organizations/{organizationId}/members/{membershipId}/property-access-grants/{grantId}/end' as const;
export const ORGANIZATION_ROLES_PATH = '/v1/organizations/{organizationId}/roles' as const;
export const ORGANIZATION_ROLE_BY_ID_PATH =
  '/v1/organizations/{organizationId}/roles/{roleId}' as const;
export const ORGANIZATION_PERMISSIONS_PATH =
  '/v1/organizations/{organizationId}/permissions' as const;
export const ORGANIZATION_SETTINGS_PATH = '/v1/organizations/{organizationId}/settings' as const;
export const ORGANIZATION_INVITATION_REVOKE_PATH =
  '/v1/organizations/{organizationId}/invitations/{invitationId}/revoke' as const;

export const organizationSwitchRequestSchema = z.object({
  organizationId: z.string().uuid(),
});

export type OrganizationSwitchRequest = z.infer<typeof organizationSwitchRequestSchema>;

export const organizationSwitchResponseSchema = z.object({
  accessToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
  organizationId: z.string().uuid(),
  membershipId: z.string().uuid(),
});

export type OrganizationSwitchResponse = z.infer<typeof organizationSwitchResponseSchema>;

export const roleSummarySchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  status: z.enum(['ACTIVE', 'RETIRED', 'INACTIVE']),
  maximumScope: z.enum(['ORGANIZATION', 'PROPERTY', 'SELF']),
  permissionKeys: z.array(z.string()).optional(),
  version: z.number().int().positive(),
});

export type RoleSummary = z.infer<typeof roleSummarySchema>;

export const memberSummarySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  membershipType: z.enum(['WORKFORCE', 'RESIDENT']),
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']),
  roles: z.array(
    z.object({
      id: z.string().uuid(),
      key: z.string(),
      name: z.string(),
    }),
  ),
  seedRole: z.enum(['OWNER', 'ADMIN']).nullable(),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
});

export type MemberSummary = z.infer<typeof memberSummarySchema>;

export const membersCollectionSchema = createCursorCollectionSchema(memberSummarySchema);
export type MembersCollection = z.infer<typeof membersCollectionSchema>;

export const patchMemberRequestSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  roleIds: z.array(z.string().uuid()).min(1).optional(),
  reason: z.string().min(1).max(500).optional(),
});

export type PatchMemberRequest = z.infer<typeof patchMemberRequestSchema>;

export const propertyAccessScopeTypeSchema = z.enum(['ALL_PROPERTIES', 'SELECTED_PROPERTIES']);

export const propertyAccessGrantResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  membershipId: z.string().uuid(),
  propertyId: z.string().uuid().nullable(),
  scopeType: propertyAccessScopeTypeSchema,
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PropertyAccessGrantResponse = z.infer<typeof propertyAccessGrantResponseSchema>;

export const propertyAccessGrantsCollectionSchema = createCursorCollectionSchema(
  propertyAccessGrantResponseSchema,
);
export type PropertyAccessGrantsCollection = z.infer<typeof propertyAccessGrantsCollectionSchema>;

export const createPropertyAccessGrantRequestSchema = z
  .object({
    scopeType: propertyAccessScopeTypeSchema.default('SELECTED_PROPERTIES'),
    propertyId: z.string().uuid().optional(),
    effectiveFrom: z.string().datetime().optional(),
    effectiveTo: z.string().datetime().optional(),
    reason: z.string().min(1).max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.scopeType === 'SELECTED_PROPERTIES' && data.propertyId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'propertyId is required for SELECTED_PROPERTIES grants',
        path: ['propertyId'],
      });
    }
    if (data.scopeType === 'ALL_PROPERTIES' && data.propertyId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'propertyId must be omitted for ALL_PROPERTIES grants',
        path: ['propertyId'],
      });
    }
  });

export type CreatePropertyAccessGrantRequest = z.infer<
  typeof createPropertyAccessGrantRequestSchema
>;

export const endPropertyAccessGrantRequestSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
  effectiveTo: z.string().datetime().optional(),
});

export type EndPropertyAccessGrantRequest = z.infer<typeof endPropertyAccessGrantRequestSchema>;

export const createRoleRequestSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  permissionKeys: z.array(z.string().min(1)).min(1),
  maximumScope: z.enum(['ORGANIZATION', 'PROPERTY', 'SELF']).optional(),
});

export type CreateRoleRequest = z.infer<typeof createRoleRequestSchema>;

export const patchRoleRequestSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  permissionKeys: z.array(z.string().min(1)).min(1).optional(),
  maximumScope: z.enum(['ORGANIZATION', 'PROPERTY', 'SELF']).optional(),
});

export type PatchRoleRequest = z.infer<typeof patchRoleRequestSchema>;

export const rolesCollectionSchema = createCursorCollectionSchema(roleSummarySchema);
export type RolesCollection = z.infer<typeof rolesCollectionSchema>;

export const permissionsCollectionSchema = createCursorCollectionSchema(permissionDefinitionSchema);
export type PermissionsCollection = z.infer<typeof permissionsCollectionSchema>;

export const organizationSettingsSchema = z.object({
  organizationId: z.string().uuid(),
  displayName: z.string(),
  legalName: z.string(),
  defaultLocale: z.string(),
  timeZone: z.string(),
  defaultCurrency: z.string().length(3),
  displayPreferences: z.record(z.unknown()).optional(),
  version: z.number().int().positive(),
});

export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>;

export const patchOrganizationSettingsRequestSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  legalName: z.string().min(1).max(200).optional(),
  defaultLocale: z.string().min(2).max(20).optional(),
  timeZone: z.string().min(1).max(64).optional(),
  displayPreferences: z.record(z.unknown()).optional(),
});

export type PatchOrganizationSettingsRequest = z.infer<
  typeof patchOrganizationSettingsRequestSchema
>;

export const invitationsCollectionSchema = createCursorCollectionSchema(
  z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    purpose: z.enum(['WORKFORCE', 'RESIDENT_PORTAL']),
    status: z.enum(['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED']),
    expiresAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    proposedRoleIds: z.array(z.string().uuid()),
  }),
);

export type InvitationsCollection = z.infer<typeof invitationsCollectionSchema>;
