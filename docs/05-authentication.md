# Authentication

## 1. Purpose and scope

This document defines authentication and session-security requirements for the Rental Property Management SaaS. The platform supports organizations managing boarding houses and apartments ranging from 30 to more than 10,000 rooms.

An **organization** is the tenant boundary. A **property** contains units and, where applicable, beds. An **occupant/resident** is a person living in a unit or bed. A **lease** is the contractual occupancy agreement.

Authentication establishes identity. Authorization, including organization and property scope, is defined in [06-permission-system.md](./06-permission-system.md).

## 2. Security principles

- Use short-lived, tenant- and audience-scoped access JWTs.
- Use opaque, rotating refresh tokens; never use refresh JWTs.
- Store refresh tokens only in `Secure`, `HttpOnly`, `SameSite` cookies.
- Store only a cryptographic hash of each refresh token server-side.
- Deny access when identity, tenant, audience, session, or account state is ambiguous.
- Revoke sessions after credential compromise or security-sensitive account changes.
- Keep secrets and tokens out of URLs, browser storage, analytics, and application logs.
- Record authentication and session-security events in an immutable audit trail.
- Design all authentication flows to support MFA without changing the core identity model.

## 3. Actors and identity types

### 3.1 Workforce users

Platform administrators, organization owners, organization administrators, property managers, accountants, maintenance staff, and read-only auditors authenticate through the administrative application.

### 3.2 Residents

Residents authenticate through the resident-facing experience. A resident identity may be linked to multiple leases or organizations, but each authorization context remains explicitly scoped to one organization.

### 3.3 Service identities

Machine-to-machine integrations and payment-provider webhook connections use separately managed service credentials and audiences. They do not use browser refresh cookies or human user sessions. Each credential has a distinct service identity, organization/connection binding, narrow scopes, expiry, and audit attribution. API secrets are generated with cryptographic randomness, shown once, and stored only as a salted password-style hash or keyed digest; signing secrets are encrypted when the original value is needed for verification. Credentials support overlap-based rotation and immediate revocation. Optional IP/CIDR allowlists are defense in depth and never replace signature, audience, scope, or replay validation.

## 4. Login flow

### 4.1 Password login

1. The client submits the normalized email address and password over TLS.
2. The API applies layered rate limits before performing expensive password verification.
3. The API looks up the identity without revealing whether the account exists.
4. The password is verified using the approved adaptive password-hashing algorithm.
5. Account status, lockout state, email-verification policy, and organization membership are evaluated.
6. If MFA is required, the API returns a short-lived, single-purpose challenge rather than a full session.
7. The user selects an organization when more than one eligible membership exists.
8. The API creates a server-side session and refresh-token family.
9. The API returns a short-lived access JWT and sets the opaque refresh token in a secure cookie.
10. The login event and relevant security context are audited.

The response must be indistinguishable for an unknown email, incorrect password, disabled account, or ineligible membership unless the user has already proved control of the account through another trusted channel.

### 4.2 Organization context

An access token represents exactly one active organization context. Switching organizations requires a token exchange against the current authenticated session. It produces a new access token scoped to the selected organization and does not broaden the user's memberships.

The chosen model keeps the same server-side session and refresh-token family across organization switches. `POST /auth/organizations/{organizationId}/token-exchange` verifies current session state and active target membership, updates the session's current organization atomically, and issues a **new** access token whose single `org_id` is the target. The old access token never changes context and is not accepted as proof for the target organization. Refresh uses the session's current organization only after rechecking membership. Clients replace the access token, cancel or partition in-flight requests, and purge all organization-derived caches, stores, query keys, subscriptions, and optimistic state before rendering the target organization. Concurrent switch/refresh requests are serialized server-side or rejected on a session-version precondition.

Platform administration uses a separate platform audience and explicit platform context. A platform administrator must not receive implicit access to organization data merely because the identity has a platform role.

## 5. Token model

### 5.1 Access JWT

Access JWTs are signed by the NestJS API using an asymmetric key. Resource services validate the signature, issuer, audience, expiration, and tenant context on every request.

Required claims:

| Claim | Purpose |
|---|---|
| `iss` | Stable token issuer |
| `sub` | Immutable user identifier |
| `aud` | Intended API or application audience |
| `exp` | Expiration time |
| `iat` | Issued-at time |
| `nbf` | Optional not-before time |
| `jti` | Unique token identifier |
| `sid` | Server-side session identifier |
| `org_id` | Active organization tenant boundary |
| `membership_id` | Active organization membership |
| `auth_time` | Time of primary authentication |
| `amr` | Authentication methods used, such as password or MFA |
| `acr` | Authentication assurance level |
| `token_version` | Version used for forced invalidation |

Permissions may be represented by compact role or entitlement references when needed for performance, but the token must not be the sole source of truth for high-risk authorization. Permission changes, disabled memberships, and revoked sessions must take effect promptly through server-side checks and short token lifetimes.

Access tokens must not contain passwords, password hashes, refresh tokens, secrets, unnecessary personal information, or data from another organization.

### 5.2 Lifetime

- Default access-token lifetime: **5 to 15 minutes**.
- Default refresh-session lifetime: **30 days** with inactivity and absolute-expiry controls.
- Privileged platform sessions: shorter refresh lifetime and stricter reauthentication.
- Password reset, email verification, invitation, and MFA challenge tokens: single-purpose and short-lived.

Production values are configuration owned by security operations. Increasing a lifetime requires a documented risk review.

### 5.3 Client storage

- Keep the access token in application memory.
- Do not store access or refresh tokens in `localStorage`, `sessionStorage`, IndexedDB, service-worker caches, or non-HttpOnly cookies.
- Deliver the refresh token in a cookie with `Secure`, `HttpOnly`, a restrictive `Path`, and an explicit `SameSite` policy.
- For split SPA/API hosting, set the refresh cookie on the API host only: omit `Domain` to create a host-only cookie and set `Path=/api/v1/auth`. Never set `Domain=.example.com`, because sibling subdomains must not receive or overwrite the cookie. If refresh and logout cannot share that path, use the narrowest common authentication path and document it.
- Prefer `SameSite=Strict` for same-site deployments. Use `Lax` only when required by a documented navigation flow.
- If cross-site deployment requires `SameSite=None`, require `Secure`, exact Origin/Referer validation, credentialed CORS with an explicit origin allowlist, and a double-submit anti-CSRF cookie/token or server-issued token sent in a custom header. The CSRF value is unavailable to cross-site forms and is bound to the session.
- Clear sensitive in-memory state on logout, session failure, or organization switch.

## 6. Refresh-token rotation

Each successful login creates a **token family** associated with one server-side session and device context.

For every refresh:

1. Read the opaque token from the secure cookie.
2. Hash it using a server-side keyed or collision-resistant construction.
3. Locate the matching active token record.
4. Validate session, user, membership, expiry, and revocation state.
5. Atomically mark the presented token as consumed.
6. Issue a new opaque token in the same family.
7. Store only the new token hash and set the new cookie.
8. Return a new access JWT.

The consume-and-rotate operation must be transactional or otherwise atomic to prevent concurrent replay.

Browser clients implement refresh as a per-session **single-flight** operation: concurrent requests await one refresh promise and retry only after it succeeds. They must not send parallel refresh tokens, because rotation would make a valid sibling request appear as reuse. The server still enforces atomic rotation and does not rely on client coordination.

### 6.1 Reuse detection

Presentation of a previously consumed refresh token indicates likely theft or replay, except for a narrowly controlled idempotency grace mechanism if one is explicitly implemented.

On confirmed reuse:

- Revoke the entire refresh-token family.
- Invalidate the associated session.
- Deny further refresh attempts.
- Emit a high-severity security event and audit record.
- Notify the user when notification risk and delivery policy allow.
- Require a new login and consider step-up verification.

Raw refresh tokens must never be retained for investigation.

## 7. Logout, revocation, and invalidation

### 7.1 Logout current session

Logout revokes the current server-side session and all active refresh-token records in its family, clears the refresh cookie, and removes access tokens from client memory. Existing access JWTs may remain cryptographically valid until expiration, so sensitive endpoints must consult revocation or account-state controls where immediate invalidation is required.

### 7.2 Logout all sessions

The user can revoke all sessions. This operation:

- Revokes all refresh-token families for the identity.
- Increments or invalidates the relevant token version.
- Clears the current browser cookie.
- Audits the initiator and affected sessions.
- Requires recent authentication for a user-initiated request.

### 7.3 Administrative revocation

Authorized administrators can revoke sessions after account suspension, membership removal, suspected compromise, or role changes. Organization administrators may revoke sessions only for memberships in their organization. Platform-wide identity revocation requires a platform-level privileged action.

### 7.4 Automatic invalidation triggers

Revoke appropriate sessions following:

- Password change or password reset.
- MFA reset or recovery-factor replacement.
- Account disablement or deletion.
- Organization membership suspension or removal.
- High-risk role or permission reduction.
- Refresh-token reuse.
- Confirmed credential compromise.

## 8. Password security

### 8.1 Password policy

- Minimum length: **12 characters** for normal users and **14 characters** for privileged platform users.
- Maximum accepted length: at least **128 characters**.
- Allow spaces, Unicode, and password-manager-generated values.
- Do not impose composition rules such as mandatory uppercase, digits, or symbols.
- Reject passwords found in common or breached-password lists.
- Do not require periodic password changes without evidence of compromise.
- Permit paste and password-manager autofill.
- Compare passwords only through the approved adaptive hash.

Use Argon2id with parameters calibrated for the production environment. If bcrypt is required for compatibility, use a reviewed work factor and plan migration through rehash-on-login.

### 8.2 Password reset

1. Accept the email and always return a generic response.
2. Apply per-IP, per-identity, and delivery-rate limits.
3. Send a single-use, random reset token through the verified email channel.
4. Store only a hash of the reset token.
5. Expire the token within **15 to 30 minutes**.
6. Invalidate the token immediately after use and invalidate older reset requests.
7. Require a password meeting the current policy.
8. Revoke existing sessions by default.
9. Notify the account owner after completion.

Reset links must not include organization-sensitive information and must land only on approved application origins.

The reset URL host and return target are selected from a server-side allowlist; neither `Host`, `Forwarded`, query parameters, nor request-origin values may construct an arbitrary reset destination. A deployment may additionally bind the reset attempt to a coarse user-agent hash as a risk signal, but strict user-agent binding is not required because legitimate browser upgrades, privacy features, and device handoff can lock users out. A binder mismatch triggers additional verification rather than revealing token validity.

## 9. Email verification

- Send a single-use verification link after registration or email change.
- Store only a hash of the verification token.
- Bind the token to the identity, target email, purpose, and expiry.
- Expire verification links within a configured period, normally 24 hours.
- Rate-limit resends and invalidate superseded tokens.
- Do not treat email verification alone as authentication for sensitive operations.
- A change to a verified email requires recent authentication and notification to the previous address.

Whether unverified users may sign in is a product policy. Regardless, unverified identities must not gain access to sensitive organization data unless an explicitly approved onboarding flow requires it.

## 10. Invitations

Workforce and resident invitations are separate token purposes, endpoints, templates, and acceptance policies. Workforce invitations create an organization membership with a proposed staff role. Resident invitations can only link an authenticated identity to a specific resident/lease/household relationship and can never grant workforce roles. Tokens are not interchangeable between these flows.

- Invitation tokens are random, single-use, hashed at rest, and time-limited.
- Workforce invitations bind the intended email, organization, proposed role, inviter, purpose, and expiry. Resident invitations bind the intended email, organization, resident relationship, lease/household context, inviter, purpose, and expiry.
- Accepting an invitation requires authentication or account creation with control of the invited email.
- If the signed-in email does not match, require an explicit account switch; do not silently attach the membership.
- If the invited email already belongs to an identity, the flow must require that existing identity to authenticate and confirm acceptance; it must never create a second account, reset/replace credentials, change the owned email, or allow possession of the invitation alone to take over the account. If no identity exists, account creation requires independent email control verification or an invitation policy that explicitly treats the single-use invitation as that proof.
- The accepting user sees the organization name and requested access before confirming.
- Expired, revoked, or already-used invitations fail safely.
- Role changes after invitation issuance must be reflected before acceptance or require reissuance.
- Invitation creation, resend, revocation, acceptance, and expiration are audited.

Invitations never establish lease occupancy. Resident access is linked separately to the relevant resident record and lease.

## 11. Lockout and rate limiting

Use progressive controls rather than a permanent hard lockout that can be abused for denial of service.

Apply Redis-backed limits to:

- Login attempts by IP, account identifier, device signal, and organization where known.
- Password-reset and email-verification requests.
- Invitation acceptance.
- Refresh attempts.
- MFA challenges and recovery flows.

Controls include exponential delay, temporary challenge, temporary account cooldown, and alerting for anomalous distributed attacks. Responses must not disclose account existence. Security staff need a documented recovery procedure for legitimate users.

Risk thresholds must account for NAT, shared property-office networks, accessibility needs, and automated attacks. Rate-limit decisions and overrides are audited without logging submitted credentials.

Authentication fails closed when Redis or the authoritative login/refresh limiter is unavailable. New password logins, refreshes, password-reset issuance, invitation acceptance, and MFA verification return a generic temporary-unavailable response and do not proceed without rate-limit and replay-state enforcement. Already issued access tokens remain governed by their normal short lifetime and required server-side checks. Operational readiness requires redundant Redis and tested recovery; there is no unmetered degraded authentication mode.

## 12. Session and device management

Users can view active sessions with:

- Friendly device and browser description.
- Approximate location derived from IP, clearly labeled as approximate.
- Session creation and last-active times.
- Current-session indicator.
- Authentication methods and assurance level.

Users can revoke an individual session or all other sessions. Sensitive session-management actions require recent authentication and, when enabled, MFA.

Server-side session records include the session ID, user ID, active organization context where applicable, token-family state, creation and activity times, expiry, revocation reason, coarse device metadata, and security-event references. Avoid invasive fingerprinting and document retention periods.

## 13. Reauthentication and step-up authentication

Require recent authentication or a higher assurance level before:

- Changing password, email, or MFA factors.
- Viewing or rotating recovery codes.
- Managing organization ownership.
- Assigning high-risk roles.
- Exporting large volumes of resident, lease, financial, or identity data.
- Changing payout, billing, or financial configuration.
- Deleting an organization or property.
- Impersonation or support-access workflows.

The API, not only the UI, enforces the required `auth_time`, `amr`, or `acr`.

Support elevation always requires step-up authentication by the platform actor, an approved support-access grant, a reason/case reference, bounded organization and duration, and a visibly elevated session. Silent impersonation is prohibited. If a documented break-glass path exists, it is time-limited, separately alerted and reviewed, and every audit event records both the real platform actor and the effective/target identity; the effective identity can never replace the actor in logs.

## 14. MFA requirements and roadmap

The identity and session model must support multiple factors from initial release.

Recommended delivery order:

1. TOTP authenticator applications with one-time recovery codes.
2. WebAuthn/passkeys as the preferred phishing-resistant factor.
3. Configurable enforcement for organization roles.
4. Risk-based step-up for unusual devices, locations, or sensitive actions.

At general availability, MFA is mandatory for every Platform Administrator and cannot be disabled by organization or user preference. Enrollment is required before privileged platform access. MFA is strongly recommended for Organization Owners and is configurable as an organization-wide or role-based requirement; owner enrollment is prompted during onboarding and may become mandatory under plan, compliance, or platform minimum policy.

SMS should not be the preferred factor and, if supported for recovery, requires explicit risk acceptance. Recovery codes are generated once, stored hashed, individually consumable, and protected by recent authentication.

MFA enrollment, challenge, reset, factor removal, and recovery use are audited. Help-desk MFA reset requires strong identity verification and separation from ordinary profile support.

## 15. Enterprise SSO roadmap

Support enterprise federation without coupling user identities to one organization:

- OpenID Connect first; SAML 2.0 where customer demand requires it.
- Organization-specific identity-provider configuration and verified domains.
- Just-in-time membership only when explicitly enabled and mapped to a safe default role.
- SCIM provisioning for lifecycle management in a later phase.
- IdP-initiated and service-provider-initiated flows subject to protocol risk review.
- Enforced SSO with a controlled break-glass owner recovery path.
- Domain discovery that does not expose organization membership to unauthenticated users.

Federated login still creates the same server-side session and tenant-scoped access-token model. Local password fallback for SSO-enforced users is disabled except for approved break-glass accounts.

## 16. Threats and mitigations

| Threat | Required mitigation |
|---|---|
| Credential stuffing | Breached-password screening, layered rate limits, anomaly detection, MFA |
| User enumeration | Generic responses, consistent status behavior, bounded timing differences |
| Password-database compromise | Argon2id, unique salts, protected server-side secret where adopted |
| Access-token theft | Short lifetime, memory-only storage, TLS, strict CSP, audience and tenant scoping |
| Refresh-token theft | HttpOnly secure cookie, opaque random value, hashing at rest, rotation and reuse detection |
| CSRF | SameSite cookies, origin validation, anti-CSRF tokens where cross-site cookies are required |
| XSS | Output encoding, strict CSP, dependency controls, no tokens in browser storage |
| Session fixation | New session and token family after primary authentication; privilege elevation uses a newly issued, explicit elevated access context |
| Organization-switch fixation | Keep the session family but require membership-checked token exchange, atomically update session context, issue a new access JWT with exactly one `org_id`, and purge organization caches |
| Replay | One-time refresh rotation, `jti`, nonce/state validation in federated flows |
| Cross-tenant access | Required `org_id`, server-side membership checks, database tenant isolation |
| Privilege persistence | Short access lifetime, token versioning, immediate session and membership revocation |
| Reset-link interception | Short-lived single-use tokens, HTTPS, no secrets in logs or referrers |
| Open redirect | Allowlisted application return URLs |
| Clickjacking | CSP `frame-ancestors` and frame protection |
| Stolen refresh cookie plus XSS on a sibling subdomain | Host-only refresh cookie with narrow auth `Path`, no parent-domain cookie, strict CSP and subdomain isolation, exact CORS/origin checks, and anti-CSRF token when `SameSite=None` |

## 17. Audit and observability

Audit at minimum:

- Login success and failure category.
- Logout and session revocation.
- Token refresh reuse detection.
- Password reset requested and completed.
- Password, email, and MFA changes.
- Email verification.
- Invitation lifecycle.
- Account lockout, cooldown, and administrative unlock.
- Organization switch.
- SSO configuration and federated-login outcomes.

Each record includes timestamp, actor or anonymous correlation ID, target identity, organization when applicable, session ID, action, outcome, reason code, source IP, user-agent summary, and request correlation ID. Never record passwords, raw tokens, MFA secrets, recovery codes, or reset links.

Security metrics should identify spikes and trends without creating high-cardinality or sensitive labels. Alerts must cover token reuse, privileged-account anomalies, distributed login attacks, and unusual reset activity.

## 18. Operational requirements

- Signing keys are stored in a managed secret or key-management system and rotated through versioned key identifiers.
- Verifiers tolerate planned key overlap but reject unknown algorithms and keys.
- Clocks are synchronized; accepted clock skew is small and documented.
- Authentication dependencies fail closed for protected operations.
- Redis outages fail closed for login, refresh, reset, invitation, and MFA flows; they must not disable rate limiting, refresh rotation/reuse detection, or revocation controls.
- PostgreSQL contains session and token-family records with tenant-safe access patterns.
- Backups and log exports preserve secret-handling and retention requirements.

## 19. Acceptance criteria

- A stolen access JWT cannot be refreshed without the opaque cookie token.
- A stolen refresh token cannot be used repeatedly without revoking its token family.
- Tokens for one audience or organization are rejected by another.
- Raw refresh, reset, verification, and invitation tokens are absent from databases and logs.
- Logout and administrative revocation prevent future refresh.
- Password and account-recovery responses do not reveal account existence.
- Every privileged authentication event is attributable through audit records.
- MFA and SSO can be added without replacing the identity, membership, or session models.
