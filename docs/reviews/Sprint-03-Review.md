# Sprint-03 Implementation Review

**Review ID:** RPM-REVIEW-SPRINT-03  
**Review date:** 2026-07-22  
**Reviewer role:** Principal Software Architect / Senior Code Reviewer  
**Scope:** Implementation of [Sprint-03](../sprints/Sprint-03.md) only — no Sprint-04+ features evaluated  
**Normative baselines:** [00-overview](../00-overview.md) · [02-system-architecture](../02-system-architecture.md) · [03-database-design](../03-database-design.md) · [04-api-specification](../04-api-specification.md) · [05-authentication](../05-authentication.md) · [08-folder-structure](../08-folder-structure.md) · [09-coding-standard](../09-coding-standard.md) · [CODING_RULES.md](../../CODING_RULES.md) · [CLAUDE.md](../../CLAUDE.md) · [Sprint-02-Review.md](./Sprint-02-Review.md) · [Sprint-03-Implementation.md](./Sprint-03-Implementation.md)

---

## Summary

Sprint-03 delivers the **authentication and invitations foundation** toward M2: identity/credential/session/refresh tables, JWT access + HttpOnly refresh cookies, login/MFA challenge, password reset, email verification, Organization bootstrap, workforce invitations, immutable audit events, rate limiting, and workforce auth UI.

During this review, **critical and high security defects** were found and corrected:

1. **Unauthenticated invitation accept** allowed anyone with an invite token to create an ACTIVE account (account takeover).
2. **Invalid Bearer tokens were ignored** on accept, silently falling through to the anonymous signup path.
3. **MFA `loginTransactionId` was placed in the browser URL** (history/Referer leak).
4. **Access JWTs remained valid after logout** because session revocation was not checked on each request.
5. **Console email delivery logged raw tokens**; MFA secrets were stored as plaintext; recovery codes were advertised but fake; accept did not re-issue an org-scoped access token.

After review fixes, **all local quality gates pass**: **34/34** unit tests, **9/9** integration tests, lint (zero warnings), typecheck, build, and Prettier format check.

The implementation **substantially meets Sprint-03 technical acceptance criteria** for the auth demo path (activate → create org → invite → accept → `/me`). Residual gaps are primarily **test coverage for remaining T03 cases**, **ops/runbooks**, **Redis-backed rate limiting**, and **full recovery-code enrollment** (deferred honestly rather than faked).

**Note:** Angular best practices are **not applicable** — the web stack is React/Next.js per project documentation.

---

## Issues Found

### Critical (fixed during review)

| ID | Area | Issue | Severity |
|---|---|---|---|
| C1 | Invitations | `POST /v1/invitations/{token}/accept` was `@Public()` and created ACTIVE users from a password body without prior auth — violated Sprint-03 “Authenticated invited user” and enabled invite-token account takeover. | Critical |
| C2 | Invitations | Invalid/expired Bearer tokens were caught and cleared to `null`, then fell through to anonymous signup. | Critical |
| C3 | Web / MFA | `loginTransactionId` (proof password already passed) was put in `/mfa?…` query string — leaked via history, Referer, analytics. | Critical |

### High (fixed during review)

| ID | Area | Issue | Severity |
|---|---|---|---|
| H1 | Auth guard | `JwtAuthGuard` / `AuthUserValidator` did not check `user_sessions.status`; logout revoked refresh but access JWT stayed valid until TTL. | High |
| H2 | Email | Console email delivery logged `bodyPreview` containing raw reset/verify/invite tokens (T03-13). | High |
| H3 | Invitations | Accept created membership but did not attach org to session or return a new access token — invitee remained org-less in `/me`. | High |
| H4 | Invitations | No rate limit on invite accept (Sprint validation rule 4). | High |
| H5 | MFA | TOTP secrets stored as plaintext under `encryptedSecret`; recovery codes advertised in contracts but product path was incomplete/fake. | High |

### Medium (fixed during review)

| ID | Area | Issue | Severity |
|---|---|---|---|
| M1 | Password reset | Client could set `revokeAllSessions: false` and keep old sessions after reset. | Medium |
| M2 | Email verify resend | Unknown emails created `PENDING_VERIFICATION` users (pre-registration abuse). | Medium |
| M3 | Password reset | Multiple concurrent reset tokens remained valid; prior tokens not revoked on re-request. | Medium |
| M4 | MFA | Challenge consume was not compare-and-set; parallel completes could double-issue sessions. | Medium |
| M5 | Invitations | Accept race: invitation status not re-asserted inside transaction. | Medium |
| M6 | Cookies | `Secure` flag only when `NODE_ENV === 'production'` (staging HTTPS risk). | Medium |
| M7 | Org guard | `OrganizationPathGuard` returned `true` if actor missing (fail-open). | Medium |
| M8 | Contracts | Accept schema allowed optional `password`, encouraging the unsafe API. | Medium |

### Medium / High (open — document / defer)

| ID | Area | Issue | Severity |
|---|---|---|---|
| H6 | Testing | T03-03/04/05/06/11/12/13/16 lack dedicated automated tests (rotation, reuse, rate limit, IDOR, log redaction). | High (soft) |
| H7 | Rate limit | In-memory limiter is process-local; auth doc prefers fail-closed Redis for multi-instance. | High (soft) |
| H8 | Delivery | Staging auth smoke journey not proven in CI; acceptance criterion 9 remains process/ops. | High (process) |
| H9 | MFA | Recovery-code enrollment and multi-code consumption deferred; method rejected until real store exists. | High (soft) |
| M9 | Docs / Ops | Auth runbooks (lockout, session revoke, email outage) not expanded beyond Sprint-02 skeletons. | Medium |
| M10 | Invites | No invitation **revoke** API endpoint (schema supports `REVOKED`). | Medium |
| M11 | A11y | Auth pages have labels/alerts but no automated WCAG / component tests. | Medium |
| M12 | Token in path | Invite token remains in URL path (Sprint-03 path shape); increases access-log leak surface. | Medium |

### Low (open)

| ID | Area | Issue | Severity |
|---|---|---|---|
| L1 | MFA | Legacy plaintext MFA secrets still decryptable via fallback for migration; new writes should use `SecretEncryptionService.encrypt`. | Low |
| L2 | Email | Dev still embeds tokens in email **body** (not logged); console mode only — production needs real provider. | Low |
| L3 | RBAC | Seed roles stored; permission catalog enforcement is Sprint-04 (intentional). | Low |

---

## Changes Made

| Fix | What changed |
|---|---|
| C1/C2 | Removed `@Public()` from invite accept; require `CurrentActor`; deleted anonymous password-create path |
| C3 | MFA challenge state kept in Zustand memory (`pendingMfa`); `/mfa` no longer uses query secrets |
| H1 | `AuthUserValidator` now requires `user_sessions.status === ACTIVE`; actor email populated from DB |
| H2 | `EmailService` logs metadata only (`to`, `subject`, `bodyLength`) — never token bodies |
| H3 | Accept attaches org via `attachOrganizationToSession` and returns `accessToken` + `expiresIn` |
| H4 | Rate limits on invite accept by IP + user id |
| H5 | `SecretEncryptionService` (AES-256-GCM); TOTP decrypt on verify; `RECOVERY_CODE` rejected as unsupported |
| M1 | Password reset always bumps `tokenVersion` and revokes sessions; removed client opt-out |
| M2 | Resend verification only for existing unverified users |
| M3 | Forgot-password revokes prior unconsumed reset tokens |
| M4 | MFA challenge consume uses `updateMany` with `consumedAt: null` precondition |
| M5 | Invitation claim uses transactional `updateMany` where `status = PENDING` |
| M6 | Refresh cookie `Secure` outside `development`/`test` (and when `SameSite=none`) |
| M7 | `OrganizationPathGuard` fails closed with 401 when path org present but actor missing |
| M8 | Removed `password` from accept request schema; response requires access token fields |
| Tests | Extended identity integration: T03-09 email mismatch, T03-15 logout revoke, encrypted MFA seed |
| Ops | Expanded `.env.example` with JWT/auth env vars |

---

## Architecture Compliance

| Criterion | Status | Notes |
|---|---|---|
| Modular monolith modules (`identity`, `tenancy`, `audit`) | ✅ Pass | Under `apps/api/src/modules/` |
| Clean Architecture layering (presentation / application / infra) | ✅ Pass | Controllers thin; services hold use cases; crypto/JWT/email infra |
| Prisma split schema + forward-only migration | ✅ Pass | `identity` / `tenancy` / `audit` + `20260722110000_…` |
| Access token memory-only; refresh HttpOnly cookie | ✅ Pass (post-fix) | Zustand; no localStorage tokens; MFA secrets not in URL |
| Single-org JWT + path/token org equality → 404 | ✅ Pass | `OrganizationPathGuard` |
| Never authorize via `X-Tenant-ID` | ✅ Pass | Header guard retained |
| Sprint-02 meta mutating demo locked down | ✅ Pass | 404 when `META_DEMO_ENABLED=false` |
| No Sprint-04 RBAC / portfolio domains | ✅ Pass | `permissionKeys: []` intentional |
| SOLID / DRY | ⚠️ Partial | Shared crypto/JWT/rate-limit; invite accept previously duplicated JWT verify (fixed by guard reuse) |

---

## Business Requirements Compliance

| Sprint-03 requirement | Status | Evidence |
|---|---|---|
| Login + generic failures | ✅ | T03-02 integration |
| MFA challenge hook (non-fake TOTP) | ✅ | T03-14; recovery deferred honestly |
| Refresh rotation + reuse detection | ✅ Code / ⚠️ Tests | Implemented; T03-03/04 tests missing (H6) |
| Logout revokes session | ✅ (post-fix) | Session status checked on JWT; T03-15 |
| Forgot/reset + email verify | ✅ | Generic messaging; always revoke on reset |
| Create Organization + Owner membership | ✅ | T03-01/07 |
| Invite + accept email-bound | ✅ (post-fix) | Auth required; T03-08/09/10 |
| Audit events | ✅ | Login, org create, invite create/accept, reset, verify |
| Auth UI screens | ✅ | Login, forgot, reset, verify, MFA, invite accept, onboarding |
| `/me` bootstrap | ✅ | Permissions empty until Sprint-04 |
| Abuse/rate limit | ⚠️ Partial | Login/forgot/MFA/accept limited; in-memory only (H7) |
| Staging demo green | ⚠️ Process | Local gates green; staging smoke not evidenced (H8) |

---

## Database Implementation

| Check | Status |
|---|---|
| Tables match Sprint-03 list | ✅ |
| Email unique/normalized | ✅ |
| Refresh/OTT hashed at rest | ✅ |
| Invitation single-use + expiry | ✅ (post race fix) |
| Soft-delete uniqueness patterns | ✅ Partial indexes where defined |
| No portfolio FKs | ✅ |
| MFA secret encryption | ✅ Service + encrypt on write path for new enrollments; legacy plaintext readable |

---

## API Implementation

| Check | Status |
|---|---|
| Auth endpoints per Sprint-03 table | ✅ |
| Invite accept requires auth | ✅ (post-fix) |
| Org path mismatch → 404 | ✅ |
| Zod validation via `@rpm/contracts` | ✅ |
| Problem Details errors | ✅ |
| Idempotency on invite create | ⚠️ Not wired (acceptable if API §7 does not mandate for this subset) |

---

## UI Implementation

| Check | Status |
|---|---|
| Screens present | ✅ |
| Access token memory-only | ✅ |
| MFA secrets not in URL | ✅ (post-fix) |
| Labels + `role="alert"` on errors | ✅ Basic |
| WCAG 2.2 AA evidence | ⚠️ Manual only (M11) |
| Invite accept requires sign-in | ✅ |

---

## Security / AuthN / AuthZ

| Check | Status |
|---|---|
| Argon2id passwords | ✅ (`@node-rs/argon2`) |
| Refresh rotation + family revoke on reuse | ✅ |
| Session dead after logout (access + refresh) | ✅ (post-fix) |
| Invite OWNER/ADMIN gate | ✅ `assertCanInvite` |
| Email match on accept | ✅ |
| Enumeration-safe login/forgot | ✅ |
| Sensitive log redaction (email body) | ✅ (post-fix) |
| CSRF | ⚠️ SameSite=Lax strategy; no explicit CSRF token (acceptable for same-site subset) |

---

## Testing

| Gate | Result |
|---|---|
| `pnpm lint` | Pass |
| `pnpm typecheck` | Pass |
| `pnpm unit` | **34/34** |
| `pnpm integration` | **9/9** |
| `pnpm build` | Pass |
| `pnpm format:check` | Pass |

Covered after review: T03-01/02/07/08/09/10/14/15 (partial), contracts, meta lockdown.  
Gaps: T03-03/04/05/06/11/12/13/16 automation.

---

## Technical Debt

1. In-memory rate limiter (replace with Redis + fail-closed before multi-replica production).
2. Recovery-code enrollment productization (Sprint-04+).
3. Invitation revoke endpoint + distinct revoked error code.
4. Prefer opaque invitation id in path + token in body for access-log hygiene (API-spec alignment).
5. Expand auth runbooks and staging smoke CI.
6. Complete remaining T03 automated abuse/isolation tests.

---

## Remaining Risks

1. **Multi-instance auth abuse** until shared rate limiting exists.
2. **Staging/production email** still console/disabled — invites/reset undeliverable without provider.
3. **Incomplete automated abuse suite** — some IDOR/rate-limit/redaction cases are code-proven but not CI-proven.
4. **Invite token in URL** remains a log/Referer exposure vector by design of Sprint-03 path.
5. **M2 incomplete by design** — claiming full permission isolation would be false; Sprint-04 owns deny-by-default RBAC.

---

## Overall Score

**8.2 / 10**

Strong auth foundation with correct architecture alignment after review fixes. Score held back by incomplete automated T03 abuse coverage, in-memory rate limiting, and ops/staging evidence gaps — not by remaining critical auth defects.

---

## Recommendation

**Approve Sprint-03 with conditions:**

1. Treat post-review security fixes as **must-merge** before any staging auth demo.
2. Track H6–H8 and M9–M12 as explicit Sprint-03 follow-ups or early Sprint-04 hardening (without expanding into full RBAC).
3. Do **not** start Sprint-04 portfolio/RBAC work until invite accept + logout session death are verified on staging once.
4. Keep M2 sign-off blocked until Sprint-04 permission matrix enforcement lands.

**Do not implement Sprint-04 in this review cycle.**
