import { z } from 'zod';

import {
  ORGANIZATION_INVITATIONS_PATH,
  ORGANIZATION_INVITATION_REVOKE_PATH,
  ORGANIZATION_MEMBERS_PATH,
  ORGANIZATION_MEMBER_BY_ID_PATH,
  ORGANIZATION_MEMBER_PROPERTY_ACCESS_GRANTS_PATH,
  ORGANIZATION_MEMBER_PROPERTY_ACCESS_GRANT_END_PATH,
  ORGANIZATION_PERMISSIONS_PATH,
  ORGANIZATION_ROLES_PATH,
  ORGANIZATION_ROLE_BY_ID_PATH,
  ORGANIZATION_SETTINGS_PATH,
  createPropertyAccessGrantRequestSchema,
  createRoleRequestSchema,
  endPropertyAccessGrantRequestSchema,
  invitationsCollectionSchema,
  memberSummarySchema,
  membersCollectionSchema,
  organizationSettingsSchema,
  patchMemberRequestSchema,
  patchOrganizationSettingsRequestSchema,
  patchRoleRequestSchema,
  permissionsCollectionSchema,
  propertyAccessGrantResponseSchema,
  propertyAccessGrantsCollectionSchema,
  roleSummarySchema,
  rolesCollectionSchema,
  type CreatePropertyAccessGrantRequest,
  type CreateRoleRequest,
  type EndPropertyAccessGrantRequest,
  type InvitationsCollection,
  type MemberSummary,
  type MembersCollection,
  type OrganizationSettings,
  type PatchMemberRequest,
  type PatchOrganizationSettingsRequest,
  type PatchRoleRequest,
  type PermissionsCollection,
  type PropertyAccessGrantResponse,
  type PropertyAccessGrantsCollection,
  type RoleSummary,
  type RolesCollection,
} from '@rpm/contracts';

import { authFetch } from './auth-api';

function orgPath(
  template: string,
  organizationId: string,
  extra: Record<string, string> = {},
): string {
  let path = template.replace('{organizationId}', encodeURIComponent(organizationId));
  for (const [key, value] of Object.entries(extra)) {
    path = path.replace(`{${key}}`, encodeURIComponent(value));
  }
  return path;
}

function withCursorQuery(path: string, options?: { limit?: number; after?: string }): string {
  const params = new URLSearchParams();
  if (options?.limit !== undefined) {
    params.set('limit', String(options.limit));
  }
  if (options?.after !== undefined) {
    params.set('after', options.after);
  }
  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function ifMatchHeaders(version?: number): HeadersInit | undefined {
  if (version === undefined) {
    return undefined;
  }
  return { 'If-Match': String(version) };
}

const roleWriteResponseSchema = roleSummarySchema.extend({
  warnings: z.array(z.string()).optional(),
});

export type RoleWriteResponse = z.infer<typeof roleWriteResponseSchema>;

export async function listMembers(
  accessToken: string,
  organizationId: string,
  options?: { limit?: number; after?: string },
): Promise<MembersCollection> {
  const path = withCursorQuery(orgPath(ORGANIZATION_MEMBERS_PATH, organizationId), options);
  const response = await authFetch(path, {}, accessToken);
  return membersCollectionSchema.parse(await response.json());
}

export async function getMember(
  accessToken: string,
  organizationId: string,
  membershipId: string,
): Promise<MemberSummary> {
  const path = orgPath(ORGANIZATION_MEMBER_BY_ID_PATH, organizationId, { membershipId });
  const response = await authFetch(path, {}, accessToken);
  return memberSummarySchema.parse(await response.json());
}

export async function patchMember(
  accessToken: string,
  organizationId: string,
  membershipId: string,
  body: PatchMemberRequest,
  version?: number,
): Promise<MemberSummary> {
  patchMemberRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_MEMBER_BY_ID_PATH, organizationId, { membershipId });
  const response = await authFetch(
    path,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: ifMatchHeaders(version),
    },
    accessToken,
  );
  return memberSummarySchema.parse(await response.json());
}

export async function listPropertyAccessGrants(
  accessToken: string,
  organizationId: string,
  membershipId: string,
  options?: { limit?: number; after?: string },
): Promise<PropertyAccessGrantsCollection> {
  const path = withCursorQuery(
    orgPath(ORGANIZATION_MEMBER_PROPERTY_ACCESS_GRANTS_PATH, organizationId, { membershipId }),
    options,
  );
  const response = await authFetch(path, {}, accessToken);
  return propertyAccessGrantsCollectionSchema.parse(await response.json());
}

export async function createPropertyAccessGrant(
  accessToken: string,
  organizationId: string,
  membershipId: string,
  body: CreatePropertyAccessGrantRequest,
): Promise<PropertyAccessGrantResponse> {
  createPropertyAccessGrantRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_MEMBER_PROPERTY_ACCESS_GRANTS_PATH, organizationId, {
    membershipId,
  });
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  return propertyAccessGrantResponseSchema.parse(await response.json());
}

export async function endPropertyAccessGrant(
  accessToken: string,
  organizationId: string,
  membershipId: string,
  grantId: string,
  body: EndPropertyAccessGrantRequest = {},
): Promise<PropertyAccessGrantResponse> {
  endPropertyAccessGrantRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_MEMBER_PROPERTY_ACCESS_GRANT_END_PATH, organizationId, {
    membershipId,
    grantId,
  });
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  return propertyAccessGrantResponseSchema.parse(await response.json());
}

export async function listInvitations(
  accessToken: string,
  organizationId: string,
  options?: { limit?: number; after?: string },
): Promise<InvitationsCollection> {
  const path = withCursorQuery(orgPath(ORGANIZATION_INVITATIONS_PATH, organizationId), options);
  const response = await authFetch(path, {}, accessToken);
  return invitationsCollectionSchema.parse(await response.json());
}

export async function revokeInvitation(
  accessToken: string,
  organizationId: string,
  invitationId: string,
): Promise<void> {
  const path = orgPath(ORGANIZATION_INVITATION_REVOKE_PATH, organizationId, { invitationId });
  await authFetch(path, { method: 'POST' }, accessToken);
}

export async function listRoles(
  accessToken: string,
  organizationId: string,
  options?: { limit?: number; after?: string },
): Promise<RolesCollection> {
  const path = withCursorQuery(orgPath(ORGANIZATION_ROLES_PATH, organizationId), options);
  const response = await authFetch(path, {}, accessToken);
  return rolesCollectionSchema.parse(await response.json());
}

export async function getRole(
  accessToken: string,
  organizationId: string,
  roleId: string,
): Promise<RoleSummary> {
  const path = orgPath(ORGANIZATION_ROLE_BY_ID_PATH, organizationId, { roleId });
  const response = await authFetch(path, {}, accessToken);
  return roleSummarySchema.parse(await response.json());
}

export async function createRole(
  accessToken: string,
  organizationId: string,
  body: CreateRoleRequest,
): Promise<RoleWriteResponse> {
  createRoleRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_ROLES_PATH, organizationId);
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  return roleWriteResponseSchema.parse(await response.json());
}

export async function patchRole(
  accessToken: string,
  organizationId: string,
  roleId: string,
  body: PatchRoleRequest,
  version?: number,
): Promise<RoleWriteResponse> {
  patchRoleRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_ROLE_BY_ID_PATH, organizationId, { roleId });
  const response = await authFetch(
    path,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: ifMatchHeaders(version),
    },
    accessToken,
  );
  return roleWriteResponseSchema.parse(await response.json());
}

export async function listPermissions(
  accessToken: string,
  organizationId: string,
  options?: { limit?: number; after?: string },
): Promise<PermissionsCollection> {
  const path = withCursorQuery(orgPath(ORGANIZATION_PERMISSIONS_PATH, organizationId), options);
  const response = await authFetch(path, {}, accessToken);
  return permissionsCollectionSchema.parse(await response.json());
}

export async function getOrganizationSettings(
  accessToken: string,
  organizationId: string,
): Promise<OrganizationSettings> {
  const path = orgPath(ORGANIZATION_SETTINGS_PATH, organizationId);
  const response = await authFetch(path, {}, accessToken);
  return organizationSettingsSchema.parse(await response.json());
}

export async function patchOrganizationSettings(
  accessToken: string,
  organizationId: string,
  body: PatchOrganizationSettingsRequest,
  version?: number,
): Promise<OrganizationSettings> {
  patchOrganizationSettingsRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_SETTINGS_PATH, organizationId);
  const response = await authFetch(
    path,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: ifMatchHeaders(version),
    },
    accessToken,
  );
  return organizationSettingsSchema.parse(await response.json());
}
