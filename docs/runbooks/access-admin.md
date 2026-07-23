# Access Administration Runbook

**Status:** Sprint-04  
**Owner:** Platform / on-call engineering  
**Related:** [incident.md](./incident.md)

## Revoke membership / force re-login

Use when a workforce member must lose Organization access immediately (leaver, compromised account, mistaken invite accept).

### 1. Suspend membership (preferred)

1. Confirm actor has `members.suspend` in the target Organization.
2. `PATCH /v1/organizations/{organizationId}/members/{membershipId}` with body `{ "status": "SUSPENDED", "reason": "..." }` and matching `If-Match` version.
3. Active sessions that pointed at that membership have org context cleared (`currentTenantId` / `currentMembershipId` null). Refresh will not re-attach the suspended membership (T04-07).
4. Verify via audit: `membership.update` with before/after status.

### 2. Force re-login for a user (all sessions)

1. Have the user (or an admin with sufficient access) call `POST /v1/auth/logout-all` with a reason, **or** increment `tokenVersion` via password reset / account disable flows already implemented.
2. Refresh tokens for revoked sessions fail; client must login again.
3. After re-login, suspended memberships do not appear as switch targets and cannot be selected.

### 3. Revoke a pending invitation

1. `POST /v1/organizations/{organizationId}/invitations/{invitationId}/revoke` (`members.invite`).
2. Accepting the old token returns gone/invalid; audit action `invitation.revoke`.

### 4. Verification checklist

- [ ] Suspended user cannot switch into the Organization (`POST /v1/auth/organization-switch` → forbidden).
- [ ] Refresh after suspension does not include `org_id` for that membership.
- [ ] Audit trail contains actor, organization, and reason/summary.
- [ ] If incident-related, attach `X-Request-ID` / `correlationId` to the incident ticket ([incident.md](./incident.md)).
