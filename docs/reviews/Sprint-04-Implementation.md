# Sprint-04 Implementation Summary

**Sprint ID:** Sprint-04 — Authorization and Organization Administration  
**Implementation date:** 2026-07-23  
**Scope:** Sprint-04 only (deny-by-default RBAC, admin APIs/UI, org switch, isolation suite / M2)  
**Baseline:** [Sprint-04.md](../sprints/Sprint-04.md) · [06-permission-system.md](../06-permission-system.md) · [Sprint-03-Review.md](./Sprint-03-Review.md) · [Sprint-03-Implementation.md](./Sprint-03-Implementation.md)

---

## Features Implemented

| # | Feature | Status |
|---|---|---|
| 1 | Permission catalog seed (org, members, roles, settings, audit, inventory stubs, platform-only) | Done |
| 2 | System roles: Owner, Administrator (active); Property Manager / Accountant / Maintenance (inactive stubs); Read-only Auditor | Done |
| 3 | `permissions`, `roles`, `role_permissions`, `membership_roles`, `property_access_grants`, `privileged_access_events` schema | Done |
| 4 | Deny-by-default `PermissionsGuard` + `@RequirePermissions` on org-scoped admin routes | Done |
| 5 | `/me` returns effective permissions, roles, memberships, `isReadOnly` | Done |
| 6 | Members list/detail/patch (roles + suspend) | Done |
| 7 | Invitations list / revoke / resend (+ proposed role IDs) | Done |
| 8 | Roles list + custom role create/update with platform/owner-only/delegation constraints + SoD warnings | Done |
| 9 | Organization settings GET/PATCH (profile, locale, timezone, display prefs) | Done |
| 10 | Organization switch token exchange + audit | Done |
| 11 | Client org-switch purge (cancel queries, clear cache, install new token) | Done |
| 12 | Read-only banner; support-access banner placeholder | Done |
| 13 | Cross-Organization isolation / authorization test suite + CI `isolation-tests` job | Done |
| 14 | Worker tenant-context mismatch rejection (T04-09) | Done |
| 15 | Audit events for role/membership/settings/org-switch | Done |
| 16 | Access-admin runbook (revoke membership / force re-login) | Done |
| 17 | MFA recovery-code enrollment productization | Deferred (honest; TOTP challenge remains from Sprint-03) |

---

## Files Created

### Prisma / database

- `prisma/schema/rbac.prisma`
- `prisma/schema/migrations/20260723120000_sprint_04_rbac/migration.sql`

### Contracts (`@rpm/contracts`)

- `packages/contracts/src/permissions.ts`
- `packages/contracts/src/rbac.ts`
- `packages/contracts/src/sprint-04.contracts.spec.ts`

### API — RBAC / admin

- `apps/api/src/modules/tenancy/rbac.module.ts`
- `apps/api/src/modules/tenancy/application/permission-catalog.ts`
- `apps/api/src/modules/tenancy/application/rbac-seed.service.ts`
- `apps/api/src/modules/tenancy/application/authorization.service.ts`
- `apps/api/src/modules/tenancy/application/membership-admin.service.ts`
- `apps/api/src/modules/tenancy/application/role-admin.service.ts`
- `apps/api/src/modules/tenancy/application/organization-settings.service.ts`
- `apps/api/src/common/auth/require-permissions.decorator.ts`
- `apps/api/src/common/auth/permissions.guard.ts`
- `apps/api/src/common/auth/if-match.ts`
- `apps/api/src/modules/tenancy/authorization.integration.spec.ts`

### Worker

- `apps/worker/src/outbox/tenant-context.ts`
- `apps/worker/src/outbox/tenant-context.spec.ts`

### Web (`apps/web`)

- `src/lib/admin-api.ts`
- `src/features/admin/**` (lists, detail, role editor, settings, switcher, banners, hooks)
- `src/app/(app)/app/admin/users/page.tsx`
- `src/app/(app)/app/admin/users/[membershipId]/page.tsx`
- `src/app/(app)/app/admin/invitations/page.tsx`
- `src/app/(app)/app/admin/roles/page.tsx`
- `src/app/(app)/app/admin/roles/new/page.tsx`
- `src/app/(app)/app/admin/roles/[roleId]/page.tsx`
- `src/app/(app)/app/admin/settings/page.tsx`

### Docs / ops

- `docs/runbooks/access-admin.md`
- `docs/reviews/Sprint-04-Implementation.md` (this file)

---

## Files Modified

| Area | Files |
|---|---|
| Prisma | `prisma/schema/tenancy.prisma` (relations for RBAC) |
| Contracts | `auth.ts` (`memberships`, `isReadOnly`), `tenancy.ts` (`proposedRoleIds`), `index.ts` |
| Identity | `me.service.ts`, `auth.service.ts` (org switch + suspended membership on refresh), `auth.controller.ts`, `identity.module.ts`, `identity.integration.spec.ts` |
| Tenancy | `organization.service.ts`, `invitation.service.ts`, `organizations.controller.ts`, `tenancy.module.ts` |
| Worker | `outbox-consumer.service.ts` |
| Testing | `packages/testing/src/integration-database.ts` |
| Web shell | `app-shell.tsx`, `auth-api.ts`, `auth-store.ts` |
| CI | `.github/workflows/ci.yml` (`isolation-tests` job) |
| Root | `package.json` (`pnpm isolation`) |
| Runbooks | `docs/runbooks/incident.md` (link to access-admin) |

---

## Database Changes

### Migration `20260723120000_sprint_04_rbac`

| Table | Purpose |
|---|---|
| `permissions` | Global permission catalog |
| `roles` | System templates (`tenant_id` null) + org custom roles |
| `role_permissions` | Role → permission grants |
| `membership_roles` | Membership → role assignments with effective dates |
| `property_access_grants` | Property-scoped grants (ready for Sprint-05; `property_id` nullable) |
| `privileged_access_events` | Support elevation skeleton (no silent impersonation) |

### Seeds (boot via `RbacSeedService`)

- Owner / Admin / Auditor (+ inactive domain stubs) system roles and permission mappings
- Existing memberships retain `seed_role` for expand/contract; Owner membership also receives `membership_roles`

---

## API Changes

| Method | Path | AuthZ |
|---|---|---|
| `GET` | `/v1/me` | Authenticated; returns effective permissions/roles/memberships |
| `POST` | `/v1/auth/organization-switch` | Authenticated active member of target org |
| `GET` | `/v1/organizations/{organizationId}/members` | `members.list` |
| `GET` | `/v1/organizations/{organizationId}/members/{membershipId}` | `members.view` |
| `PATCH` | `/v1/organizations/{organizationId}/members/{membershipId}` | `members.update` / `members.suspend` / `members.roles.assign` |
| `GET` | `/v1/organizations/{organizationId}/roles` | `roles.list` |
| `POST` | `/v1/organizations/{organizationId}/roles` | `roles.create` |
| `PATCH` | `/v1/organizations/{organizationId}/roles/{roleId}` | `roles.update` |
| `GET` | `/v1/organizations/{organizationId}/permissions` | `roles.list` (admin-capable catalog) |
| `GET/PATCH` | `/v1/organizations/{organizationId}/settings` | `organization.profile.view` / `organization.profile.update` |
| `GET` | `/v1/organizations/{organizationId}/invitations` | `members.invite` |
| `POST` | `/v1/organizations/{organizationId}/invitations/{id}/revoke` | `members.invite` |
| `POST` | `/v1/organizations/{organizationId}/invitations/{id}/resend` | `members.invite` |

### Security behavior

- Path `organizationId` must equal token `org_id` → **404** on mismatch
- Missing permission → **403 FORBIDDEN** (deny by default)
- Custom roles cannot include platform or owner-only permissions
- Actors cannot assign permissions they do not effectively possess
- System roles are immutable (clone via custom role)
- Membership suspension clears session org context for that membership
- No caller-selected tenant headers

---

## UI Changes

| Screen | Route |
|---|---|
| Users list | `/app/admin/users` |
| User detail | `/app/admin/users/[membershipId]` |
| Invitations list | `/app/admin/invitations` |
| Roles list / editor | `/app/admin/roles`, `/new`, `/[roleId]` |
| Organization settings | `/app/admin/settings` |
| Organization switcher | App shell (when multiple memberships) |
| Read-only banner | App shell when `me.isReadOnly` |

Portfolio navigation remains hidden until Sprint-05.

---

## Test Coverage Added

| ID | Case | Coverage |
|---|---|---|
| T04-01 | Member without `members.list` | Integration |
| T04-02 | Cross-org path → 404 | Integration |
| T04-03 | Assign role lacking actor permission | Integration |
| T04-04 | Custom role with owner-only perm | Integration |
| T04-05 | Org switch success | Integration |
| T04-07 | Suspended membership clears org context | Integration |
| T04-08 | Auditor read-only / mutations denied | Integration |
| T04-09 | Worker wrong org context | Unit (`tenant-context.spec.ts`) |
| T04-10 | `/me` effective permissions | Integration |
| T04-11 | Invite revoke | Integration |
| — | Settings audit | Integration |
| — | Sprint-04 contract schemas | Unit |

### Quality gates (local)

| Gate | Result |
|---|---|
| `pnpm format:check` | Pass |
| `pnpm lint` | Pass |
| `pnpm typecheck` | Pass |
| `pnpm unit` | **42/42** |
| `pnpm integration` | **19/19** |
| `pnpm build` | Pass |
| `pnpm prisma:validate` | Pass |

---

## Consistency Verification

| Area | Status | Notes |
|---|---|---|
| Architecture | Pass | Modular monolith; `RbacModule` shared without Identity↔Tenancy cycle; Prisma in infrastructure; thin controllers |
| Database | Pass | Forward-only migration; org-scoped FKs; property grants schema ready for Sprint-05 |
| API | Pass | Nested org paths match Sprint-04 + existing invitation pattern; permission keys from `docs/06` |
| UI | Pass | Admin IA only; switcher purge checklist; discoverability from `/me` only |
| No Sprint-05 | Pass | No Property/Unit/Bed CRUD |

---

## Known Limitations / Follow-ups

1. MFA recovery-code enrollment still deferred (Sprint-03 H9).
2. Support elevation is schema + banner placeholder only — no silent impersonation path.
3. Property access grants have no inventory targets until Sprint-05.
4. In-memory rate limiter remains process-local (Sprint-03 carryover).
5. Formal M2 stakeholder sign-off / staging demo is process (not proven by this local gate run).
6. T04-06 / T04-12 (mid-flight switch failure UX, concurrent switch+refresh e2e) covered by client purge design + server serialization points; dedicated browser e2e not added this sprint.

---

## Milestone M2

Organization isolation and authorization suite for identity/administration is implemented and green in local CI-equivalent gates (`pnpm isolation` / `isolation-tests` workflow job). Inventory and finance remain out of scope until later sprints.

---

## Handoff to Sprint-05

- Consume `property_access_grants` when Property entities exist.
- Reuse `PermissionsGuard` + permission catalog keys for portfolio APIs.
- Keep org-scoped JWT + path equality + deny-by-default as the access boundary.
