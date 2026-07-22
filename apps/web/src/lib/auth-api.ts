import {
  AUTH_EMAIL_RESEND_PATH,
  AUTH_EMAIL_VERIFY_PATH,
  AUTH_LOGIN_PATH,
  AUTH_LOGOUT_PATH,
  AUTH_MFA_CHALLENGE_PATH,
  AUTH_PASSWORD_FORGOT_PATH,
  AUTH_PASSWORD_RESET_PATH,
  AUTH_REFRESH_PATH,
  INVITATION_ACCEPT_PATH,
  ME_PATH,
  ORGANIZATIONS_PATH,
  REFRESH_COOKIE_NAME,
  REQUEST_ID_HEADER,
  loginRequestSchema,
  loginResultSchema,
  loginResponseSchema,
  meResponseSchema,
  problemDetailsSchema,
  type LoginRequest,
  type LoginResponse,
  type LoginResult,
  type MeResponse,
} from '@rpm/contracts';

import { createRequestId } from './request-id';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

let refreshPromise: Promise<string | null> | null = null;

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

async function parseProblem(response: Response): Promise<AuthApiError> {
  const payload: unknown = await response.json().catch(() => null);
  const problem = payload !== null ? problemDetailsSchema.safeParse(payload) : undefined;
  return new AuthApiError(
    problem?.success
      ? (problem.data.detail ?? problem.data.title)
      : `Request failed (${response.status})`,
    response.status,
    problem?.success ? problem.data.code : undefined,
  );
}

async function authFetch(path: string, init: RequestInit = {}, accessToken?: string | null) {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set(REQUEST_ID_HEADER, createRequestId());
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw await parseProblem(response);
  }

  return response;
}

export async function loginRequest(body: LoginRequest): Promise<LoginResult> {
  loginRequestSchema.parse(body);
  const response = await authFetch(AUTH_LOGIN_PATH, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json();
  return loginResultSchema.parse(payload);
}

export async function completeMfaChallenge(body: {
  challengeId: string;
  loginTransactionId: string;
  method: 'TOTP' | 'RECOVERY_CODE';
  proof: string;
}): Promise<LoginResponse> {
  const response = await authFetch(AUTH_MFA_CHALLENGE_PATH, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return loginResponseSchema.parse(await response.json());
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await authFetch(AUTH_REFRESH_PATH, { method: 'POST' });
      const payload = (await response.json()) as { accessToken: string };
      return payload.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function logoutRequest(accessToken: string | null): Promise<void> {
  await authFetch(AUTH_LOGOUT_PATH, { method: 'POST' }, accessToken);
}

export async function fetchMe(accessToken: string): Promise<MeResponse> {
  const response = await authFetch(ME_PATH, {}, accessToken);
  return meResponseSchema.parse(await response.json());
}

export async function forgotPasswordRequest(email: string): Promise<void> {
  await authFetch(AUTH_PASSWORD_FORGOT_PATH, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPasswordRequest(token: string, newPassword: string): Promise<void> {
  await authFetch(AUTH_PASSWORD_RESET_PATH, {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export async function verifyEmailRequest(token: string, password?: string): Promise<void> {
  await authFetch(AUTH_EMAIL_VERIFY_PATH, {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

export async function resendVerificationRequest(email: string): Promise<void> {
  await authFetch(AUTH_EMAIL_RESEND_PATH, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function createOrganizationRequest(
  accessToken: string,
  body: { displayName: string; slug?: string },
): Promise<{ organization: { id: string; displayName: string }; accessToken: string }> {
  const response = await authFetch(
    ORGANIZATIONS_PATH,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  return response.json() as Promise<{
    organization: { id: string; displayName: string };
    accessToken: string;
  }>;
}

export async function acceptInvitationRequest(
  token: string,
  body: { displayName?: string; password?: string },
  accessToken?: string | null,
): Promise<unknown> {
  const path = INVITATION_ACCEPT_PATH.replace('{token}', encodeURIComponent(token));
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken ?? null,
  );
  return response.json();
}

export { REFRESH_COOKIE_NAME, apiBaseUrl };
