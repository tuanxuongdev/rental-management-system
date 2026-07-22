import { z } from 'zod';

export const AUTH_LOGIN_PATH = '/v1/auth/login' as const;
export const AUTH_MFA_CHALLENGE_PATH = '/v1/auth/mfa/challenge' as const;
export const AUTH_REFRESH_PATH = '/v1/auth/refresh' as const;
export const AUTH_LOGOUT_PATH = '/v1/auth/logout' as const;
export const AUTH_LOGOUT_ALL_PATH = '/v1/auth/logout-all' as const;
export const AUTH_PASSWORD_FORGOT_PATH = '/v1/auth/password/forgot' as const;
export const AUTH_PASSWORD_RESET_PATH = '/v1/auth/password/reset' as const;
export const AUTH_EMAIL_VERIFY_PATH = '/v1/auth/email/verify' as const;
export const AUTH_EMAIL_RESEND_PATH = '/v1/auth/email/verification/resend' as const;
export const ME_PATH = '/v1/me' as const;

export const REFRESH_COOKIE_NAME = 'rpm_refresh' as const;

export const loginRequestSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
  organizationId: z.string().uuid().optional(),
  deviceName: z.string().max(128).optional(),
  rememberMe: z.boolean().optional(),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const sessionSummarySchema = z.object({
  id: z.string().uuid(),
  deviceName: z.string().nullable(),
  lastActiveAt: z.string().datetime(),
  current: z.boolean(),
});

export type SessionSummary = z.infer<typeof sessionSummarySchema>;

export const organizationSummarySchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  slug: z.string(),
});

export type OrganizationSummary = z.infer<typeof organizationSummarySchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
  session: sessionSummarySchema,
  organization: organizationSummarySchema.nullable(),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const mfaRequiredResponseSchema = z.object({
  challengeId: z.string().uuid(),
  methods: z.array(z.enum(['TOTP', 'RECOVERY_CODE'])),
  expiresAt: z.string().datetime(),
  loginTransactionId: z.string().uuid(),
});

export type MfaRequiredResponse = z.infer<typeof mfaRequiredResponseSchema>;

export const loginResultSchema = z.union([loginResponseSchema, mfaRequiredResponseSchema]);

export type LoginResult = z.infer<typeof loginResultSchema>;

export const mfaChallengeRequestSchema = z.object({
  challengeId: z.string().uuid(),
  loginTransactionId: z.string().uuid(),
  method: z.enum(['TOTP', 'RECOVERY_CODE']),
  proof: z.string().min(1).max(128),
});

export type MfaChallengeRequest = z.infer<typeof mfaChallengeRequestSchema>;

export const tokenResponseSchema = z.object({
  accessToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
  organizationId: z.string().uuid().nullable(),
});

export type TokenResponse = z.infer<typeof tokenResponseSchema>;

export const genericAcceptedResponseSchema = z.object({
  accepted: z.literal(true),
  message: z.string(),
});

export type GenericAcceptedResponse = z.infer<typeof genericAcceptedResponseSchema>;

export const passwordForgotRequestSchema = z.object({
  email: z.string().email().max(320),
  returnUri: z.string().url().optional(),
});

export type PasswordForgotRequest = z.infer<typeof passwordForgotRequestSchema>;

export const passwordResetRequestSchema = z.object({
  token: z.string().min(1).max(256),
  newPassword: z.string().min(12).max(128),
});

export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;

export const emailVerifyRequestSchema = z.object({
  token: z.string().min(1).max(256),
  password: z.string().min(12).max(128).optional(),
});

export type EmailVerifyRequest = z.infer<typeof emailVerifyRequestSchema>;

export const emailResendRequestSchema = z.object({
  email: z.string().email().max(320),
  returnUri: z.string().url().optional(),
});

export type EmailResendRequest = z.infer<typeof emailResendRequestSchema>;

export const logoutAllRequestSchema = z.object({
  reason: z.string().min(1).max(500),
  exceptCurrent: z.boolean().optional(),
});

export type LogoutAllRequest = z.infer<typeof logoutAllRequestSchema>;

export const userSummarySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  emailVerified: z.boolean(),
  status: z.enum(['PENDING_VERIFICATION', 'ACTIVE', 'DISABLED']),
});

export type UserSummary = z.infer<typeof userSummarySchema>;

export const membershipSummarySchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  membershipType: z.enum(['WORKFORCE', 'RESIDENT']),
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']),
  seedRole: z.enum(['OWNER', 'ADMIN']).nullable(),
});

export type MembershipSummary = z.infer<typeof membershipSummarySchema>;

export const meResponseSchema = z.object({
  user: userSummarySchema,
  membership: membershipSummarySchema.nullable(),
  organization: organizationSummarySchema.nullable(),
  roles: z.array(z.string()),
  permissionKeys: z.array(z.string()),
  assurance: z.object({
    level: z.string(),
    validUntil: z.string().datetime().nullable(),
  }),
});

export type MeResponse = z.infer<typeof meResponseSchema>;

export const GENERIC_AUTH_FAILURE_MESSAGE =
  'The email or password you entered is incorrect.' as const;

export const GENERIC_ACCEPTED_MESSAGE =
  'If an account exists for that email, further instructions will be sent.' as const;
