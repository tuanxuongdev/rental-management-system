# Sprint-03 — Authentication and Invitations

**Sprint ID:** Sprint-03  
**Roadmap alignment:** [10-development-roadmap.md](../10-development-roadmap.md) Sprint 3 · Phase 2 start toward **M2**  
**Program references:** [project-roadmap.md](../project-roadmap.md) · [dependency-map.md](../dependency-map.md) · [05-authentication.md](../05-authentication.md) · [06-permission-system.md](../06-permission-system.md)  
**UI references:** [ui/auth/login.md](../ui/auth/login.md) · [ui/auth/forgot-password.md](../ui/auth/forgot-password.md) · [ui/auth/reset-password.md](../ui/auth/reset-password.md) · [ui/auth/invitation-accept.md](../ui/auth/invitation-accept.md) · [ui/auth/email-verify.md](../ui/auth/email-verify.md) · [ui/auth/mfa-challenge.md](../ui/auth/mfa-challenge.md) · [ui/cross-cutting-patterns.md](../ui/cross-cutting-patterns.md)  
**Duration:** 2 weeks  
**Status:** Ready for planning  
**Builds on:** [Sprint-01.md](./Sprint-01.md) · [Sprint-02.md](./Sprint-02.md)

---

## Goal

Deliver secure authentication, session lifecycle, password recovery, email verification, workforce invitation acceptance, Organization bootstrap, memberships, and immutable audit foundations so a new Organization administrator can activate an account and invite a user—on the Sprint-02 platform—without yet completing full RBAC administration (**M2** completes in Sprint-04).

---

## Business Value

- First customer-facing security capability: real users and Organizations exist.
- Enables controlled onboarding of pilot operators and internal staff.
- Establishes session, cookie, and audit patterns required by every later module.
- Reduces account-takeover and invitation-abuse risk before portfolio data exists.
- Independently deployable: auth + invite works even while inventory/finance are absent.

---

## Scope

### In scope

- User identity, credentials, sessions, refresh-token families.
- Login, logout, session refresh (single-flight client rules per UX patterns).
- Password reset request/confirm; email verification.
- MFA challenge **hook** (TOTP challenge path for users who already have a factor; full enrollment UX may be thin if timeboxed—challenge + recovery-code consumption must not be fake).
- Organizations (`tenants`) create/bootstrap for first owner/admin.
- Memberships linking users to Organizations.
- Workforce invitations: create, accept, expire, revoke.
- Immutable `audit_events` for auth and invitation lifecycle.
- Rate limiting, lockout/cooldown-safe messaging (no account enumeration).
- Sensitive log redaction.
- Auth UI screens listed above (workforce); resident portal auth may share login shell but resident self-scope APIs are later.
- Organization-scoped JWT access token after membership resolution (single-org token).
- HttpOnly refresh cookie; access token memory-only on web.

### Out of scope

- Full deny-by-default permission catalog enforcement and role admin UI (Sprint-04 / M2).
- Organization switcher multi-membership exchange hardening beyond selecting membership at login if multiple exist (basic selection OK; atomic cache purge patterns required if switch exists).
- Platform support elevation.
- Property inventory, residents, leases, finance.
- SSO/SCIM.
- Resident-only invitation product polish beyond not conflating with workforce invites.

---

## Features

1. Sign-in with generic failure messages; optional MFA challenge step.
2. Refresh rotation and reuse detection (family revoke on reuse).
3. Logout and session revocation for current session.
4. Forgot/reset password with generic responses and single-use tokens.
5. Email verification flow.
6. Create Organization + first membership (Owner/Admin seed role record may be stubbed until Sprint-04 permission rows exist—membership must still be durable).
7. Invite user by email to an Organization; accept invitation after auth.
8. Audit events for login success/failure (careful), logout, invite, accept, password reset, verification.
9. Auth pages: login, forgot, reset, verify, invitation accept, MFA challenge.
10. `/me` bootstrap returning user + active membership summary (permissions array may be empty/minimal until Sprint-04).

---

## User Stories

1. **As a new Organization administrator**, I can verify email, set a password, and access my Organization so onboarding works without engineering help.
2. **As an Organization administrator**, I can invite a colleague by email so the team can join securely.
3. **As an invitee**, I can accept an invitation only with the invited email identity so invitations cannot take over arbitrary accounts.
4. **As a user**, I can reset a forgotten password without the system revealing whether an email is registered.
5. **As a user**, I can sign out and expect the refresh session to be revoked.
6. **As a security engineer**, failed auth is rate-limited and logs never store raw tokens or passwords.
7. **As a multi-org user**, at login I explicitly choose an eligible Organization so the access token contains exactly one `org_id`.

---

## Database Changes

| Table | Purpose |
|---|---|
| `tenants` | Organization / SaaS boundary (`tenant_id`) |
| `tenant_settings` | Minimal settings row for org bootstrap |
| `users` | Global identity |
| `user_credentials` | Password hashes / credential metadata |
| `user_sessions` | Server sessions |
| `refresh_tokens` | Refresh token families / rotation |
| `tenant_memberships` | User↔Organization membership |
| `invitations` | Workforce invitations |
| `mfa_methods` | TOTP (and related) factors |
| `audit_events` | Immutable auth/invite audit foundation |
| Optional seed | Minimal `roles` / `permissions` placeholders for Owner seed—**full RBAC wiring is Sprint-04** |

**Constraints / rules:**

- Email unique per user (normalized).
- Invitation single-use, expiry, org-scoped.
- Refresh token hashed at rest; rotation with family id.
- Soft-delete uniqueness patterns if applicable (partial unique indexes).
- No business portfolio FKs yet.

---

## API Changes

Align with [04-api-specification.md](../04-api-specification.md) Auth / Organizations sections (subset):

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/v1/auth/login` | Start auth; may return MFA challenge | Public |
| `POST` | `/v1/auth/mfa/challenge` | Complete MFA | Challenge token |
| `POST` | `/v1/auth/refresh` | Rotate refresh; issue access token | Refresh cookie |
| `POST` | `/v1/auth/logout` | Revoke current session | Authenticated |
| `POST` | `/v1/auth/password/forgot` | Request reset | Public |
| `POST` | `/v1/auth/password/reset` | Confirm reset | Reset token |
| `POST` | `/v1/auth/email/verify` | Verify email | Token |
| `GET` | `/v1/me` | Current user + membership context | Authenticated |
| `POST` | `/v1/organizations` | Bootstrap Organization + first membership | Authenticated |
| `GET` | `/v1/organizations/{organizationId}` | Basic org profile | Member |
| `POST` | `/v1/organizations/{organizationId}/invitations` | Create workforce invite | Member (admin-capable seed) |
| `POST` | `/v1/invitations/{token}/accept` | Accept invitation | Authenticated invited user |
| `POST` | `/v1/auth/logout-all` | Optional if timeboxed | Authenticated + step-up later |

**Rules:**

- Access token includes exactly one `org_id` when org context established.
- Path `{organizationId}` must equal token `org_id` or 404 (no existence leak)—enforce on org routes.
- Never authorize via body-provided tenant id or `X-Tenant-ID`.
- Idempotency on invite creation where specified.
- Temporary Sprint-02 public meta mutating demos removed or locked down.

---

## UI Changes

| Screen | Spec | Notes |
|---|---|---|
| Login | `ui/auth/login.md` | Generic errors; no enumeration |
| Forgot password | `ui/auth/forgot-password.md` | Same |
| Reset password | `ui/auth/reset-password.md` | Single-use expiry states |
| Email verify | `ui/auth/email-verify.md` | Resend cooldown |
| MFA challenge | `ui/auth/mfa-challenge.md` | Challenge only; enrollment may be minimal |
| Invitation accept | `ui/auth/invitation-accept.md` | Workforce only; email mismatch handling |
| Basic org setup | Thin post-login | Create org name; success → home placeholder |
| Home placeholder | Post-auth | “Organization ready” empty state; no portfolio IA yet |

**Client security (mandatory):**

- Access token in memory only.
- Refresh in HttpOnly Secure cookie.
- No tokens in localStorage/sessionStorage/URL.

---

## Permissions

| Capability | Sprint-03 | Notes |
|---|---|---|
| Authenticated self `/me` | Yes | |
| Create Organization | Yes | First user becomes Owner membership |
| Invite member | Yes | Limited to org admin/owner seed |
| Accept invitation | Yes | Invited email must match |
| Full permission catalog | No | Sprint-04 |
| Property scope grants | No | Sprint-04/05 |
| Platform admin | No | Later |
| Support elevation | No | Later |

UI may hide unavailable admin chrome; server remains authoritative.

---

## Validation Rules

1. Password: minimum 12 characters (14 for future platform privileged users); allow long Unicode; reject breached/common passwords when service available; no mandatory composition theater.
2. Email normalized; invite and verify tokens single-use and time-bounded.
3. Login failures use identical generic messaging for unknown user, bad password, disabled, lockout.
4. Rate limit login, forgot-password, invite accept, and token issuance.
5. Refresh reuse detected → revoke family; force re-login.
6. Invitation acceptance requires authenticated identity controlling the invited email; signed-in mismatch forces switch/reauth.
7. Workforce vs resident invitation types must not be interchangeable (resident type may be unimplemented but must not be faked as workforce).
8. Audit events emitted for invite create/accept, password reset complete, email verify, logout, org create—no raw secrets in audit payload.
9. CSRF strategy applied when cookie `SameSite` requires it (per auth doc).

---

## Test Cases

| ID | Case | Expected |
|---|---|---|
| T03-01 | Register/verify/login happy path | Session + access token; `/me` OK |
| T03-02 | Login unknown email vs bad password | Identical generic error |
| T03-03 | Refresh rotation | New access; old refresh invalid |
| T03-04 | Refresh reuse | Family revoked; re-auth required |
| T03-05 | Forgot password unknown email | Generic success message |
| T03-06 | Reset with expired token | Safe failure |
| T03-07 | Create organization | `tenants` + membership + audit |
| T03-08 | Invite + accept matching email | Membership active |
| T03-09 | Accept with different authenticated email | Blocked with explicit switch path |
| T03-10 | Invite token replay | Rejected |
| T03-11 | Access org B token on org A path | 404 |
| T03-12 | Rate limit login | Cooldown/challenge behavior |
| T03-13 | Logs redaction | No password/refresh/access token plaintext |
| T03-14 | MFA required user | Challenge before session |
| T03-15 | Logout | Refresh cookie cleared; session dead |
| T03-16 | Cross-org invitation IDOR | Denied |

---

## Acceptance Criteria

1. A new Organization administrator can securely activate an account and invite a user (**Sprint 3 demo**).
2. Auth/session/refresh/logout behave per [05-authentication.md](../05-authentication.md) for the implemented subset.
3. Access token is single-Organization; path/token org mismatch yields non-disclosing 404.
4. Invitations are single-use, org-scoped, and email-bound without account takeover.
5. Password reset and email verification flows meet generic-response and expiry rules.
6. Audit events recorded for critical auth and invitation actions.
7. Auth UI screens meet WCAG 2.2 AA for the implemented flows (keyboard, labels, errors).
8. Abuse tests (rate limit, enumeration, IDOR) pass.
9. Deployed to development and staging; smoke auth journey green.
10. Sprint-04 backlog includes full RBAC matrix enforcement and isolation suite expansion for **M2**.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Account enumeration | Security finding | Generic messages; equal timing where practical |
| Invitation account takeover | Critical | Email control + auth required; no credential overwrite |
| Cookie/CSRF misconfiguration | Session theft | Auth ADR; Secure/HttpOnly/`SameSite`; CSRF when needed |
| Shipping full RBAC incomplete while claiming M2 | False milestone | M2 explicitly Sprint-04; this sprint is auth demo only |
| MFA enrollment incomplete | Platform admin later blocked | Timebox challenge path; track enrollment for Sprint-04 |
| Email deliverability | Invites undelivered | SPF/DKIM/DMARC dependency; staging inbox testing |
| Token storage in web storage | XSS impact | Memory-only access token; code review gate |

---

## Dependencies

| Dependency | Type | Required |
|---|---|---|
| Sprint-02 / **M1** | Hard | Yes |
| Email provider + domain DNS | Hard | Invites/verify/reset |
| Auth cookie topology ADR | Hard | Yes |
| Permission matrix document | Soft→Hard soon | Seed roles; full enforcement Sprint-04 |
| UI auth specs | Hard | Yes |
| Sprint-04 | Downstream | RBAC + org switch + isolation suite → **M2** |

---

## Deliverables

1. Auth and invitation APIs on `/v1`.
2. Schema migrations for identity, org, membership, invitation, session, MFA, audit foundations.
3. Workforce auth UI flows deployed.
4. `/me` and Organization bootstrap.
5. Audit event emission + queryable storage for security review.
6. Abuse/enumeration/IDOR test suite for auth.
7. Updated runbooks: account lockout, session revoke, email outage degraded mode.
8. Demo script: activate admin → create org → invite → accept → `/me`.

---

## Estimated Time

| Track | Estimate |
|---|---|
| Schema + auth/session/refresh domain | 3 days |
| Invitations + org bootstrap + audit | 2–3 days |
| Auth API + rate limit/redaction | 2 days |
| Auth UI flows | 2–3 days |
| Security tests + staging harden | 1–2 days |
| **Sprint total** | **10 business days (2 weeks)** |

Pair backend senior (auth) with frontend; security review checkpoint mid-sprint.

---

## Definition of Done

1. Acceptance criteria and demo path pass on **staging**.
2. Unit, integration, and auth abuse/isolation tests pass in CI.
3. Server enforces org path/token equality on org routes.
4. No tokens in browser web storage; cookie flags verified.
5. Audit events asserted in tests for invite/auth critical actions.
6. Coding standards, secret scan, and SCA gates pass.
7. Documentation updated (auth env vars, email templates, known limitations vs Sprint-04 M2).
8. No unresolved critical/high auth defects.
9. Independently deployable: enabling auth feature flag/config does not require inventory or billing modules.
10. Explicit handoff: Sprint-04 owns deny-by-default RBAC, role admin, org switch purge, and **M2** isolation suite sign-off.
