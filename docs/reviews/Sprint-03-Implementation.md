# Sprint-03 Implementation Summary

**Sprint ID:** Sprint-03 — Authentication and Invitations  
**Implementation date:** 2026-07-22  
**Scope:** Sprint-03 only (auth, sessions, invitations, org bootstrap)  
**Baseline:** [Sprint-03.md](../sprints/Sprint-03.md) · [Sprint-01-Review.md](./Sprint-01-Review.md) · [Sprint-02-Review.md](./Sprint-02-Review.md)

---

## Features Implemented

| # | Feature | Status |
|---|---|---|
| 1 | User identity, credentials, sessions, refresh-token families | Done |
| 2 | Login with generic failure messages; optional MFA challenge (TOTP) | Done |
| 3 | Refresh rotation and reuse detection (family revoke) | Done |
| 4 | Logout (current session) and logout-all | Done |
| 5 | Forgot / reset password with generic responses and single-use tokens | Done |
| 6 | Email verification and resend (console email delivery) | Done |
| 7 | Organization bootstrap + first Owner membership | Done |
| 8 | Workforce invitations: create, accept, expire, revoke | Done |
| 9 | Immutable `audit_events` for auth and invitation lifecycle | Done |
| 10 | Rate limiting (in-memory) for login, forgot-password, resend | Done |
| 11 | Global JWT auth guard + organization path/token alignment (404 on mismatch) | Done |
| 12 | `/me` bootstrap (permissions array empty until Sprint-04) | Done |
| 13 | Auth UI: login, forgot, reset, verify, MFA, invitation accept, org onboarding | Done |
| 14 | Web client: access token in memory (Zustand); refresh via HttpOnly cookie | Done |
| 15 | Sprint-02 meta mutating demo locked down when `META_DEMO_ENABLED=false` | Done |

---

## Files Created

### Prisma / database

- `prisma/schema/identity.prisma`
- `prisma/schema/tenancy.prisma`
- `prisma/schema/audit.prisma`
- `prisma/schema/migrations/20260722110000_sprint_03_identity_tenancy_audit/migration.sql`

### Contracts (`@rpm/contracts`)

- `packages/contracts/src/auth.ts`
- `packages/contracts/src/tenancy.ts`
- `packages/contracts/src/sprint-03.contracts.spec.ts`

### API — infrastructure

- `apps/api/src/infrastructure/crypto/crypto.services.ts`
- `apps/api/src/infrastructure/auth/jwt.service.ts`
- `apps/api/src/infrastructure/auth/refresh-cookie.service.ts`
- `apps/api/src/infrastructure/rate-limit/rate-limit.service.ts`
- `apps/api/src/infrastructure/email/email.service.ts`

### API — modules

- `apps/api/src/modules/audit/audit.module.ts`
- `apps/api/src/modules/audit/audit.service.ts`
- `apps/api/src/modules/identity/identity.module.ts`
- `apps/api/src/modules/identity/application/auth.service.ts`
- `apps/api/src/modules/identity/application/me.service.ts`
- `apps/api/src/modules/identity/presentation/auth.controller.ts`
- `apps/api/src/modules/identity/identity.integration.spec.ts`
- `apps/api/src/modules/tenancy/tenancy.module.ts`
- `apps/api/src/modules/tenancy/application/organization.service.ts`
- `apps/api/src/modules/tenancy/application/invitation.service.ts`
- `apps/api/src/modules/tenancy/presentation/organizations.controller.ts`
- `apps/api/src/modules/tenancy/presentation/invitations.controller.ts`

### API — auth guards

- `apps/api/src/common/auth/auth.types.ts`
- `apps/api/src/common/auth/auth-user.validator.ts`
- `apps/api/src/common/auth/jwt-auth.guard.ts`
- `apps/api/src/common/auth/organization.guards.ts`
- `apps/api/src/common/auth/public.decorator.ts`
- `apps/api/src/common/auth/current-actor.decorator.ts`

### Web (`apps/web`)

- `src/state/auth-store.ts`
- `src/lib/auth-api.ts`
- `src/features/identity/components/login-form.tsx`
- `src/features/identity/components/auth-guard.tsx`
- `src/app/(public)/login/page.tsx`
- `src/app/(public)/forgot-password/page.tsx`
- `src/app/(public)/reset-password/page.tsx`
- `src/app/(public)/verify-email/page.tsx`
- `src/app/(public)/mfa/page.tsx`
- `src/app/(public)/onboarding/organization/page.tsx`
- `src/app/(public)/invitations/[token]/accept/page.tsx`

---

## Files Modified

| Area | Files |
|---|---|
| Prisma | `prisma/schema/base.prisma` (schema composition) |
| Contracts | `packages/contracts/src/index.ts` |
| API config / bootstrap | `apps/api/src/bootstrap/configuration.ts`, `configuration.spec.ts`, `apps/api/src/main.ts`, `apps/api/src/app.module.ts` |
| Auth module wiring | `apps/api/src/common/auth/auth.module.ts` |
| Meta lockdown | `apps/api/src/modules/meta/meta.controller.ts` (`@Public()` + 404 when demo disabled) |
| Health routes | `apps/api/src/health/health.controller.ts`, `readiness.controller.ts` (`@Public()`) |
| HTTP tests | `apps/api/src/app.http.spec.ts` |
| Testing helpers | `packages/testing/src/integration-database.ts` (reset auth tables) |
| Web shell | `apps/web/src/app/(app)/layout.tsx`, `components/layouts/app-shell.tsx` |
| Dependencies | `apps/api/package.json`, `apps/web/package.json`, `pnpm-lock.yaml` |
| Env template | `.env.example` (auth cookie comment) |

---

## Database Changes

### Migration `20260722110000_sprint_03_identity_tenancy_audit`

| Table | Purpose |
|---|---|
| `users` | Global identity (normalized email unique) |
| `user_credentials` | Password hashes (Argon2id) |
| `user_sessions` | Server-side session records |
| `refresh_tokens` | Hashed refresh tokens with rotation family |
| `mfa_methods` | TOTP factors (challenge path) |
| `one_time_tokens` | Password reset, email verify tokens (hashed) |
| `tenants` | Organizations |
| `tenant_settings` | Minimal org settings row |
| `tenant_memberships` | User ↔ Organization membership |
| `invitations` | Workforce invitations (hashed token, expiry) |
| `audit_events` | Immutable auth/invite audit foundation |

### Enums

- `UserStatus`, `CredentialProvider`, `SessionStatus`, `MfaMethodType`, `MfaMethodStatus`
- `OneTimeTokenPurpose`, `MembershipType`, `MembershipStatus`, `SeedRole`
- `InvitationStatus`, `AuditActorType`

### Constraints / rules

- Email normalized and unique per user
- Refresh and one-time tokens stored hashed (peppered SHA-256)
- Invitation single-use with expiry; partial unique indexes for soft-delete patterns where applicable
- No portfolio/business FKs (Sprint-04+)

---

## API Changes

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/v1/auth/login` | Start auth; may return MFA challenge | Public |
| `POST` | `/v1/auth/mfa/challenge` | Complete MFA | Public (challenge context) |
| `POST` | `/v1/auth/refresh` | Rotate refresh; issue access token | Refresh cookie |
| `POST` | `/v1/auth/logout` | Revoke current session | Authenticated |
| `POST` | `/v1/auth/logout-all` | Revoke all sessions | Authenticated |
| `POST` | `/v1/auth/password/forgot` | Request reset (generic 202) | Public |
| `POST` | `/v1/auth/password/reset` | Confirm reset | Public (token) |
| `POST` | `/v1/auth/email/verify` | Verify email | Public (token) |
| `POST` | `/v1/auth/email/verification/resend` | Resend verification (generic 202) | Public |
| `GET` | `/v1/me` | Current user + membership context | Authenticated |
| `POST` | `/v1/organizations` | Bootstrap Organization + Owner membership | Authenticated |
| `GET` | `/v1/organizations/{organizationId}` | Basic org profile | Member (org path guard) |
| `POST` | `/v1/organizations/{organizationId}/invitations` | Create workforce invite | Member |
| `POST` | `/v1/invitations/{token}/accept` | Accept invitation | Authenticated invited user |

### Security behavior

- Access JWT includes exactly one `org_id` when membership is established
- Organization path `{organizationId}` must match token `org_id` or returns **404** (no existence leak)
- Global `JwtAuthGuard` with `@Public()` opt-out; `OrganizationHeaderGuard` on org-scoped routes
- Refresh token in HttpOnly cookie (`rpm_refresh`); access token returned in JSON only
- `POST /v1/meta/idempotent-echo` returns **404** when `META_DEMO_ENABLED=false`

### Configuration (env)

- `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`
- `TOKEN_HASH_PEPPER`, `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS`
- `REFRESH_COOKIE_PATH`, `AUTH_COOKIE_SAME_SITE`, `AUTH_EMAIL_DELIVERY_MODE`
- `META_DEMO_ENABLED`, `WEB_ORIGIN` (CORS)

---

## Test Coverage Added

| ID | Case | Coverage |
|---|---|---|
| T03-01 | Register/verify/login happy path | Integration (`identity.integration.spec.ts`) |
| T03-02 | Login unknown email vs bad password | Integration |
| T03-07 | Create organization + audit | Integration |
| T03-08 | Invite + accept matching email | Integration |
| T03-10 | Invite token replay | Integration |
| T03-14 | MFA required user → challenge | Integration |
| — | Auth/tenancy contract schemas | Unit (`sprint-03.contracts.spec.ts`) |
| — | Auth config loading | Unit (`configuration.spec.ts`) |
| — | Meta idempotent-echo lockdown | Unit (`app.http.spec.ts`) |
| — | Sprint-02 platform integration (regression) | Integration (`platform.integration.spec.ts`) |

### Quality gates (local)

| Gate | Result |
|---|---|
| `pnpm lint` | Pass (0 warnings) |
| `pnpm typecheck` | Pass |
| `pnpm unit` | **34/34** pass |
| `pnpm integration` | **8/8** pass |
| `pnpm build` | Pass (api, worker, web) |
| `pnpm format:check` | Pass |

---

## Remaining Work

| Item | Sprint | Notes |
|---|---|---|
| T03-03 / T03-04 refresh rotation and reuse | Sprint-03 | Implemented in service; dedicated integration tests not yet added |
| T03-05 forgot password unknown email | Sprint-03 | Behavior implemented; no automated assertion |
| T03-06 reset with expired token | Sprint-03 | No dedicated test |
| T03-09 accept with mismatched authenticated email | Sprint-03 | Server logic present; no integration test |
| T03-11 org path/token mismatch 404 | Sprint-03 | Guard implemented; no HTTP integration test |
| T03-12 rate limit login cooldown | Sprint-03 | In-memory limiter only; no automated test |
| T03-13 log redaction audit | Sprint-03 | Redaction in structured logger; no automated scan test |
| T03-15 logout cookie cleared | Sprint-03 | Manual / future HTTP test |
| T03-16 cross-org invitation IDOR | Sprint-03 | Partially covered by org guards; explicit IDOR test deferred |
| Full RBAC permission catalog | Sprint-04 | `/me.permissionKeys` intentionally empty |
| MFA enrollment UX | Sprint-04+ | Challenge path only; no self-service enroll UI |
| Redis-backed rate limiting | Later | In-memory acceptable for dev/staging |
| Real email provider (Resend/SES) | Later | Console delivery mode for Sprint-03 |
| `.env.example` full auth vars | Ops | JWT/pepper vars documented in config schema; example partially updated |
| Auth runbook sections (lockout, session revoke, email outage) | Ops | Skeleton exists; Sprint-03-specific procedures not expanded |
| Web component/a11y tests | Later | Auth pages built; no Playwright/component tests yet |
| Staging smoke auth journey | Delivery | CI does not yet run full auth E2E |

---

## Known Limitations

1. **MFA enrollment** — TOTP challenge works for pre-provisioned factors; no end-user enrollment flow. TOTP secret stored as base32 in `encryptedSecret` (dev simplification; production should use envelope encryption).
2. **Rate limiting** — Process-local in-memory buckets; not shared across API replicas.
3. **Permissions** — `permissionKeys` and role admin UI deferred to Sprint-04; membership seed roles (`OWNER`, `ADMIN`) stored but not enforced via catalog.
4. **Multi-org login** — Optional `organizationId` at login; org creation blocked when user already has an active membership (bootstrap path). Organization switcher not implemented.
5. **Invitation accept path** — Uses Sprint-03 path `POST /v1/invitations/{token}/accept` (token in path) rather than API spec variant with `invitationId` + body token.
6. **Email delivery** — `AUTH_EMAIL_DELIVERY_MODE=console` logs links to stdout; suitable for local/dev only.
7. **Recovery codes** — Schema supports `RECOVERY_CODE` method; web MFA page submits TOTP only.
8. **CSRF** — SameSite=Lax cookie strategy per ADR; explicit CSRF token middleware not added (acceptable for same-site SPA subset).
9. **Argon2** — Uses `@node-rs/argon2` (pure Rust binding) for Windows/build-toolchain compatibility vs native `argon2` package.

---

## Sprint-03 Demo Path

1. Verify email / set password (token from console email log in dev).
2. Sign in at `/login`.
3. Create Organization at `/onboarding/organization` if no membership.
4. Invite colleague via API `POST /v1/organizations/{id}/invitations`.
5. Invitee accepts at `/invitations/{token}/accept`.
6. Both users reach authenticated `/app` shell with sign-out and `/me`-backed header context.

---

## Compatibility

- Sprint-01 monorepo scaffold, CI, and Docker parity preserved.
- Sprint-02 platform tables, outbox, idempotency, and `/ready` checks unchanged in behavior.
- Sprint-04+ features (RBAC matrix, property inventory, resident portal) **not** implemented.
