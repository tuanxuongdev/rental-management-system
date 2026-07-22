import { z } from 'zod';

export const ORGANIZATIONS_PATH = '/v1/organizations' as const;
export const ORGANIZATION_BY_ID_PATH = '/v1/organizations/{organizationId}' as const;
export const ORGANIZATION_INVITATIONS_PATH =
  '/v1/organizations/{organizationId}/invitations' as const;
export const INVITATION_ACCEPT_PATH = '/v1/invitations/{token}/accept' as const;

export const createOrganizationRequestSchema = z.object({
  displayName: z.string().min(1).max(200),
  legalName: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  defaultCurrency: z.string().length(3).optional(),
  defaultLocale: z.string().min(2).max(20).optional(),
  timeZone: z.string().min(1).max(64).optional(),
});

export type CreateOrganizationRequest = z.infer<typeof createOrganizationRequestSchema>;

export const organizationResponseSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  displayName: z.string(),
  legalName: z.string(),
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  defaultCurrency: z.string().length(3),
  defaultLocale: z.string(),
  timeZone: z.string(),
});

export type OrganizationResponse = z.infer<typeof organizationResponseSchema>;

export const createInvitationRequestSchema = z.object({
  email: z.string().email().max(320),
  message: z.string().max(500).optional(),
  expiresInHours: z.number().int().min(1).max(168).optional(),
});

export type CreateInvitationRequest = z.infer<typeof createInvitationRequestSchema>;

export const invitationResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  purpose: z.enum(['WORKFORCE', 'RESIDENT_PORTAL']),
  status: z.enum(['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED']),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export type InvitationResponse = z.infer<typeof invitationResponseSchema>;

export const acceptInvitationRequestSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  password: z.string().min(12).max(128).optional(),
});

export type AcceptInvitationRequest = z.infer<typeof acceptInvitationRequestSchema>;

export const invitationAcceptanceResponseSchema = z.object({
  membership: z.object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']),
  }),
  organizationSummary: z.object({
    id: z.string().uuid(),
    displayName: z.string(),
    slug: z.string(),
  }),
});

export type InvitationAcceptanceResponse = z.infer<typeof invitationAcceptanceResponseSchema>;
