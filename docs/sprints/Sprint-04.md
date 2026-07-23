# Sprint-04 — Authorization and Organization Administration

**Sprint ID:** Sprint-04  
**Roadmap alignment:** [10-development-roadmap.md](../10-development-roadmap.md) Sprint 4 · Phase 2 exit **M2**  
**Program references:** [project-roadmap.md](../project-roadmap.md) · [dependency-map.md](../dependency-map.md) · [06-permission-system.md](../06-permission-system.md) · [05-authentication.md](../05-authentication.md)  
**UI references:** [ui/shell/organization-switcher.md](../ui/shell/organization-switcher.md) · [ui/admin/users-list.md](../ui/admin/users-list.md) · [ui/admin/user-detail.md](../ui/admin/user-detail.md) · [ui/admin/invitations-list.md](../ui/admin/invitations-list.md) · [ui/admin/roles-list.md](../ui/admin/roles-list.md) · [ui/admin/role-editor.md](../ui/admin/role-editor.md) · [ui/admin/organization-settings.md](../ui/admin/organization-settings.md) · [ui/cross-cutting-patterns.md](../ui/cross-cutting-patterns.md)  
**Duration:** 2 weeks  
**Status:** Implemented / Reviewed — see docs/reviews/Sprint-04-Review.md  
**Builds on:** [Sprint-03.md](./Sprint-03.md)

---

## Goal

Implement deny-by-default RBAC, membership and role administration, Organization settings, authorized Organization switching with atomic client isolation, and a passing Organization-isolation authorization test suite so identity and administration are production-safe (**M2**).

---

## Business Value

- Makes multi-user Organizations operable without engineering intervention.
- Prevents privilege escalation and cross-Organization leakage before inventory or money exists.
- Establishes the permission and org-switch patterns every later domain must reuse.
- Unlocks property inventory work (Sprint-05) on a trusted access boundary.
- Independently deployable: admin + RBAC ships without portfolio/finance modules.

---

## Scope

### In scope

- Permission catalog seed for administration and foundation domains (org, members, roles, settings, audit read as granted).
- System roles: Organization Owner, Organization Administrator (minimum); stubs for Property Manager / Accountant / etc. as inactive or limited until domain modules exist.
- `role_permissions`, `membership_roles`, optional `property_access_grants` schema (grants enforced when properties exist in Sprint-05).
- Deny-by-default authorization middleware/guards on all org-scoped routes.
- Membership list/detail, invite management UI (extends Sprint-03), role assign/revoke.
- Custom role editor constraints: no platform/owner-only perms; no broader delegation than actor; dangerous combination warnings (SoD prep).
- Organization settings (profile, locale/timezone defaults—not full billing).
- Organization switcher: token exchange, cancel in-flight requests, purge prior-org client state, reset property scope.
- Propagate Organization/actor context through API, worker jobs, cache keys, storage prefixes, logs, and audits.
- Cross-Organization negative tests for every implemented repository and endpoint.
- Platform support-access **skeleton** only if required (reason + enhanced audit); full elevation UX may remain thin—must not allow silent impersonation.
- Read-only auditor role recognition (mutation affordances hidden).
- MFA enrollment completion for privileged paths if deferred from Sprint-03.

### Out of scope

- Property/Unit/Bed CRUD (Sprint-05).
- Finance dual-control execution (later).
- Full platform admin console.
- SSO/SCIM.
- Resident portal IA.
- SaaS subscription billing to the platform vendor.

---

## Features

1. Deny-by-default permission checks on org-scoped APIs.
2. `/me` returns effective permissions and memberships for the active org.
3. Users & memberships administration.
4. Invitations list/revoke/resend (workforce).
5. Roles list + role editor (system cloneable; custom within constraints).
6. Organization settings page.
7. Organization switcher with security isolation.
8. Authorization matrix automated test suite (positive + negative).
9. Audit events for role assign, permission changes, org settings updates, org switch.
10. Persistent read-only and (if implemented) support-access banner hooks in shell.

---

## User Stories

1. **As an Organization Owner**, I can invite users and assign roles so my team works within controlled privileges.
2. **As an Organization Administrator**, I can update Organization profile and defaults so operations match our locale and timezone.
3. **As a user with multiple memberships**, I can switch Organization explicitly and never see the previous Organization’s data afterward.
4. **As a security engineer**, every org-owned endpoint denies cross-org access with non-disclosing 404/empty behavior.
5. **As a Read-only Auditor**, I can view permitted records but see no mutation affordances.
6. **As an administrator**, I cannot grant permissions I do not have or create roles with platform/owner-only capabilities.
7. **As a product owner**, **M2** is demonstrably green via the isolation suite.

---

## Database Changes

| Table | Purpose |
|---|---|
| `permissions` | Canonical permission keys |
| `roles` | System and custom roles per org (system roles may be global templates) |
| `role_permissions` | Role→permission mapping |
| `membership_roles` | Membership→role assignment with optional effective dates |
| `property_access_grants` | Property-scoped grants (schema + APIs; little data until Sprint-05) |
| `tenant_settings` | Expand fields: locale, timezone, display prefs |
| Optional | `privileged_access_events` skeleton for support elevation |

**Updates:** Strengthen FKs from Sprint-03 memberships to roles; seed Owner/Admin role_permissions.

---

## API Changes

| Method | Path | Description | AuthZ |
|---|---|---|---|
| `GET` | `/v1/me` | Include effective permissions, roles, memberships | Authenticated |
| `POST` | `/v1/auth/organization-switch` | Token exchange to target membership | Authenticated member |
| `GET` | `/v1/organizations/{organizationId}/members` | List memberships | `members.read` |
| `GET` | `/v1/organizations/{organizationId}/members/{membershipId}` | Detail | `members.read` |
| `PATCH` | `/v1/organizations/{organizationId}/members/{membershipId}` | Update roles/status | `members.update` |
| `GET` | `/v1/organizations/{organizationId}/roles` | List roles | `roles.read` |
| `POST` | `/v1/organizations/{organizationId}/roles` | Create custom role | `roles.create` |
| `PATCH` | `/v1/organizations/{organizationId}/roles/{roleId}` | Update custom role | `roles.update` |
| `GET` | `/v1/organizations/{organizationId}/permissions` | Catalog (readable meta) | Admin-capable |
| `GET/PATCH` | `/v1/organizations/{organizationId}/settings` | Org settings | `organization.settings.*` |
| `GET` | `/v1/organizations/{organizationId}/invitations` | List invites | `members.invite` |
| `POST` | `/v1/organizations/{organizationId}/invitations/{id}/revoke` | Revoke | `members.invite` |

**Rules:** Path `organizationId` == token `org_id` or 404; deny-by-default; no tenant headers; `If-Match` on role/settings updates where specified.

---

## UI Changes

| Screen | Spec |
|---|---|
| Organization switcher | `ui/shell/organization-switcher.md` |
| Users list / user detail | `ui/admin/users-list.md`, `user-detail.md` |
| Invitations list | `ui/admin/invitations-list.md` |
| Roles list / role editor | `ui/admin/roles-list.md`, `role-editor.md` |
| Organization settings | `ui/admin/organization-settings.md` |
| Staff shell | Sidebar with Administration only (+ Home placeholder); Portfolio hidden until Sprint-05 |

Implement atomic org-switch purge per cross-cutting patterns. Show read-only banner when applicable.

---

## Permissions

| Permission domain (seed) | Examples |
|---|---|
| `organization.*` | read, settings.update |
| `members.*` | read, invite, update, suspend |
| `roles.*` | read, create, update, assign |
| `audit.read` | If exposing audit list thin view |
| Owner-only | transfer/delete org — **not executable** this sprint but cannot be granted to custom roles |

Property-scoped permissions defined but unused until inventory exists.

---

## Validation Rules

1. Deny by default: missing permission → 403/404 per API disclosure rules.
2. Custom roles cannot include platform or owner-only permissions.
3. Actors cannot assign permissions they do not effectively possess.
4. Dangerous combinations (e.g., role admin + refund) warned even if refund unused yet.
5. Org switch requires eligible active membership; failure does not fall back silently.
6. Client must purge prior-org caches/drafts before rendering target org.
7. System roles are cloneable, not editable.
8. Membership suspension immediately blocks new access tokens for that membership on refresh/switch.
9. Audit every role assignment and settings change with actor + org + before/after summary.

---

## Test Cases

| ID | Case | Expected |
|---|---|---|
| T04-01 | Member without `members.read` lists members | Denied |
| T04-02 | Token org A accesses org B members path | 404 |
| T04-03 | Assign role lacking actor permission | Rejected |
| T04-04 | Custom role with owner-only perm | Rejected |
| T04-05 | Org switch success | New token; old org data not returned |
| T04-06 | Org switch failure mid-flight | Recoverable error; no partial UI leak |
| T04-07 | Suspended membership refresh | Blocked |
| T04-08 | Auditor role | Mutations 403; UI read-only |
| T04-09 | Worker job with wrong org context | Rejected / no side effect |
| T04-10 | Isolation suite full matrix for implemented endpoints | Pass → **M2** |
| T04-11 | Invite revoke | Token unusable |
| T04-12 | Concurrent switch + refresh serialized | No cross-org response bleed |

---

## Acceptance Criteria

1. Deny-by-default RBAC enforced server-side on all org-scoped routes.
2. Admins can manage members, invitations, roles, and org settings per specs.
3. Organization switcher meets security isolation requirements.
4. `/me` exposes effective permissions for UI discoverability only.
5. Cross-Organization negative tests pass for every implemented repository and endpoint.
6. **Milestone M2 achieved:** Organization isolation and authorization test suite approved for identity and administration.
7. Deployed to development and staging; admin journey demoed.
8. Property grants schema ready for Sprint-05 without blocking.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Incomplete isolation suite | False M2 | Gate on full endpoint/repo coverage list |
| Org-switch cache leak | Cross-org UX/data bleed | Mandatory purge checklist + e2e |
| Over-permissioned Admin seed | Later SoD pain | Tight catalog; Owner vs Admin split |
| Support elevation half-built | Impersonation risk | Skeleton only or full controls—no silent mode |
| FE hiding as “security” | False safety | Server tests authoritative |

---

## Dependencies

| Dependency | Type | Required |
|---|---|---|
| Sprint-03 auth/invites/orgs | Hard | Yes |
| Approved permission matrix (M0) | Hard | Yes |
| Auth cookie + switch exchange APIs | Hard | Yes |
| UI admin + switcher specs | Hard | Yes |
| Sprint-05 | Downstream | Inventory on M2 boundary |

---

## Deliverables

1. RBAC schema seed + enforcement layer.
2. Admin APIs and UI for users, roles, invitations, settings.
3. Organization switcher with isolation.
4. Authorization/isolation test suite + M2 sign-off.
5. Audit events for access-admin actions.
6. Shell banners for read-only (and support if present).
7. Updated security runbook: revoke membership, force re-login.

---

## Estimated Time

| Track | Estimate |
|---|---|
| Permission model + enforcement | 3 days |
| Admin APIs | 2 days |
| Admin UI + switcher | 3 days |
| Isolation suite + hardening | 2 days |
| **Sprint total** | **10 business days (2 weeks)** |

---

## Definition of Done

1. Acceptance criteria and **M2** sign-off complete.
2. Isolation suite green in CI and required on branch protection (`isolation-tests`).
3. Coding standards, reviews, SCA/secret gates pass.
4. No critical/high authz defects open.
5. Deployed + smoke-tested on staging.
6. Docs updated (permission catalog excerpt, switch behavior).
7. Independently deployable without inventory/finance.
8. Handoff: Sprint-05 consumes `property_access_grants` and org-scoped APIs.
