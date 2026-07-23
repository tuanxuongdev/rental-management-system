# Sprint-04 Implementation Review

**Review ID:** RPM-REVIEW-SPRINT-04  
**Review date:** 2026-07-23  
**Reviewer role:** Principal Software Architect / Senior Code Reviewer  
**Scope:** Implementation of [Sprint-04](../sprints/Sprint-04.md) only — no Sprint-05+ features evaluated  
**Normative baselines:** [00-overview](../00-overview.md) · [02-system-architecture](../02-system-architecture.md) · [03-database-design](../03-database-design.md) · [04-api-specification](../04-api-specification.md) · [05-authentication](../05-authentication.md) · [06-permission-system](../06-permission-system.md) · [08-folder-structure](../08-folder-structure.md) · [09-coding-standard](../09-coding-standard.md) · [CODING_RULES.md](../../CODING_RULES.md) · [Sprint-03-Review.md](./Sprint-03-Review.md) · [Sprint-04-Implementation.md](./Sprint-04-Implementation.md)

---

## Summary

Sprint-04 delivers the **authorization and Organization administration** layer required for **M2**: permission catalog + system roles, deny-by-default guards, membership/role/settings/invitation admin APIs, Organization switch with client isolation, `/me` effective permissions, isolation suite + CI `isolation-tests`, and admin UI with read-only banner.

During this review, **critical and high authorization defects** were found and corrected:

1. **Invitation `proposedRoleIds` skipped role-assignment authorization** (privilege escalation via invite).
2. **System Owner role could not be assigned** because assignment reused the custom-role owner-only ban.
3. **Last Owner could be demoted** by replacing roles (only suspend was protected).
4. **SoD dangerous triple was warn-only** for non-Owners (docs require hard deny).
5. **`PermissionsGuard` failed open** when `@RequirePermissions` was omitted on org-scoped routes.
6. **JWT org claims survived membership suspension** until TTL; session org context was not authoritative on each request.
7. **If-Match was optional** on versioned admin writes; unknown permission keys silently dropped on role patch.
8. **Worker accepted null `tenantId` with org-claiming payloads**; seed-based `assertCanInvite` leftover risk.

After review fixes, **all local quality gates pass**: unit, integration (including expanded isolation cases), lint, typecheck, build, and Prettier format check.

The implementation **substantially meets Sprint-04 technical acceptance criteria** for deny-by-default RBAC and admin operability. Residual gaps are mainly **incomplete T04-06/T04-12 browser e2e**, **formal M2/staging sign-off**, **MFA recovery enrollment** (honest deferral), and **shell nav not permission-filtered**.

**Note:** Angular best practices are **not applicable** — the web stack is React/Next.js per project documentation.

---

## Critical Issues

### Critical (fixed during review)

| ID | Area | Issue | Severity |
|---|---|---|---|
| C1 | Invitations | `createInvitation` accepted `proposedRoleIds` (default Admin) without `assertCanAssignRoles`; accept wrote arbitrary role UUIDs. Invite-only actors could escalate to Owner/Admin; cross-tenant role IDs were possible. | Critical |
| C2 | Role assign | `assertCanAssignRoles` called `validateCustomRolePermissionKeys`, which always rejects owner-only keys — making system Owner assignment impossible even for Owners. | Critical |
| C3 | Memberships | Last-Owner protection ran only on suspend; role replace could strip the sole Owner (`LAST_ORGANIZATION_OWNER` hole). | Critical |

### High (fixed during review)

| ID | Area | Issue | Severity |
|---|---|---|---|
| H1 | SoD | Dangerous permission triple produced warnings only; non-Owners could create the combination. Docs §7 require rejection for non-Owners. | High |
| H2 | Guards | `PermissionsGuard` returned `true` when permission metadata missing — fail-open on org routes if `@RequirePermissions` forgotten. | High |
| H3 | AuthN/AuthZ | Suspend cleared session org but JWT still carried `org_id`/`membership_id` until TTL; validator trusted claims. | High |
| H4 | API writes | If-Match optional on member/role/settings PATCH; omitted → last-write-wins. | High |
| H5 | Roles | `patchRole` silently ignored unknown permission keys (create rejected them). | High |
| H6 | Worker | Null `event.tenantId` allowed even when payload claimed an organization (T04-09 incomplete). | High |
| H7 | Tenancy | Dead `assertCanInvite` still authorized via `seedRole` (unused but regression hazard). | High |

### Medium / High (open — document / defer)

| ID | Area | Issue | Severity |
|---|---|---|---|
| H8 | Testing | T04-06 (switch mid-flight UI) and T04-12 (concurrent switch+refresh) lack dedicated browser/e2e automation. | High (soft) |
| H9 | Process | Staging admin journey + formal M2 stakeholder sign-off not evidenced in repo (acceptance criteria 6–7 process). | High (process) |
| H10 | MFA | Recovery-code enrollment still deferred from Sprint-03 (Sprint-04 “if deferred” clause). | High (soft) |
| M1 | UI | Administration sidebar links always visible; not filtered by `permissionKeys` (page actions are gated). | Medium |
| M2 | UI | Invitations list supports revoke; no invite-create form in admin UI (API exists). | Medium |
| M3 | RBAC seed | System `role_permissions` upsert does not remove stale keys if catalog shrinks. | Medium |
| M4 | Features | No `roles.delete` / system-role clone endpoint (permission seeded; clone messaging only). | Medium |
| M5 | Audit | Material denials (role assign / invite escalation) not written to `audit_events`. | Medium |
| M6 | A11y | Admin screens have labels/alerts; no automated WCAG suite. | Medium |
| M7 | Rate limit | In-memory limiter remains process-local (Sprint-03 carryover). | Medium |

### Low (open)

| ID | Area | Issue | Severity |
|---|---|---|---|
| L1 | Pagination | Role list cursor on `id` with multi-key `orderBy` can skip/dupe under concurrent inserts. | Low |
| L2 | Read-only heuristic | `isReadOnly` uses a static mutation-key list; new mutation permissions can be missed. | Low |
| L3 | Support skeleton | Support banner is non-elevating placeholder only (acceptable). | Low |

---

## Changes Made

| Fix | What changed |
|---|---|
| C1 | `InvitationService.createInvitation` requires inviter membership + `assertCanAssignRoles`; accept re-validates roles via `assertRolesBelongToOrganization` |
| C2 | Split `validateAssignableRolePermissionKeys` vs custom-role validator; Owners can assign system Owner template |
| C3 | `patchMember` blocks role replace that would remove the last Owner |
| H1 | Non-Owners hit `ROLE_COMBINATION_FORBIDDEN` for the SoD triple; Owners still warn |
| H2 | `PermissionsGuard` fails closed when `organizationId` path param present without `@RequirePermissions` |
| H3 | `AuthUserValidator` prefers live session membership and drops stale JWT org claims when suspended/mismatched |
| H4 | `requireIfMatchVersion` → **428** when missing; required on member/role/settings PATCH |
| H5 | `patchRole` rejects unknown permission keys (parity with create) |
| H6 | Worker rejects payload org claims when `event.tenantId` is null |
| H7 | Removed `OrganizationService.assertCanInvite` seedRole helper |
| Tests | Added invite escalation + last-Owner demotion cases; fixed constructors/If-Match in isolation suite |

---

## Minor Issues

Documented above as M1–M7 / L1–L3. None block M2 technical readiness after critical/high fixes, but H8–H10 and M1–M2 should be tracked before claiming a full product demo of the admin journey.

---

## Architecture Compliance

| Criterion | Status | Notes |
|---|---|---|
| Modular monolith (`identity`, `tenancy`, `audit`, `RbacModule`) | ✅ Pass | Shared RBAC without Identity↔Tenancy cycle |
| Clean layering | ✅ Pass | Controllers thin; services hold use cases; Prisma in infra |
| Deny-by-default AuthZ | ✅ Pass (post-fix) | Guard + service permission checks; org path fail-closed |
| Org path == token org → 404 | ✅ Pass | `OrganizationPathGuard` |
| No `X-Tenant-ID` | ✅ Pass | Header guard retained |
| Money / inventory domains | ✅ Pass | Not introduced (Sprint-05) |
| Outbox tenant context | ✅ Pass (post-fix) | Mismatch + missing tenant fail closed |
| Tokens memory-only / HttpOnly refresh | ✅ Pass | Unchanged from Sprint-03 |

---

## Business / Sprint Scope Compliance

| Sprint-04 requirement | Status | Evidence |
|---|---|---|
| Permission catalog + Owner/Admin (+ stubs) | ✅ | Seed catalog + system roles |
| Deny-by-default on org-scoped admin APIs | ✅ (post-fix) | Guard + `@RequirePermissions` |
| Members / invitations / roles / settings | ✅ | APIs + admin UI |
| Custom role constraints | ✅ (post-fix) | Platform/owner-only/delegation/SoD |
| Org switch + client purge | ✅ | API + switcher cancel/clear/refetch |
| `/me` effective permissions | ✅ | `permissionKeys`, roles, memberships, `isReadOnly` |
| Isolation suite / M2 technical gate | ✅ Partial | CI job + expanded tests; formal sign-off process open (H9) |
| Property grants schema | ✅ | Table ready; unused until Sprint-05 |
| Support elevation skeleton | ✅ | Schema + non-elevating banner |
| MFA enrollment completion | ⚠️ Deferred | Documented honestly |
| No Sprint-05 inventory | ✅ | No Property/Unit/Bed CRUD |

---

## Database Consistency

| Check | Status |
|---|---|
| Sprint-04 tables present | ✅ |
| Forward-only migration | ✅ `20260723120000_sprint_04_rbac` |
| System role partial unique index | ✅ |
| `property_access_grants` ready | ✅ `property_id` nullable |
| `privileged_access_events` skeleton | ✅ |
| Expand/contract (`seedRole` retained) | ✅ |

---

## API Consistency

| Check | Status |
|---|---|
| Nested org paths per Sprint-04 | ✅ |
| Permission keys from `docs/06` | ✅ (`members.list` etc., not ambiguous `members.read`) |
| Path/token org mismatch → 404 | ✅ |
| If-Match on versioned writes | ✅ (post-fix, required) |
| Problem Details errors | ✅ |
| Invite role assignment AuthZ | ✅ (post-fix) |

---

## UI Consistency

| Check | Status |
|---|---|
| Admin screens + shell Administration | ✅ |
| Org switcher purge checklist | ✅ |
| Read-only banner | ✅ |
| Portfolio hidden | ✅ |
| Permission-aware nav | ⚠️ Partial (M1) |
| Invite create UI | ⚠️ Missing (M2); revoke present |
| A11y automation | ⚠️ Manual only (M6) |

---

## RBAC / Isolation / Security

| Check | Status |
|---|---|
| Effective permissions from `membership_roles` | ✅ |
| Active membership re-check in `assertPermission` | ✅ |
| Custom role platform/owner-only ban | ✅ |
| Delegation ⊆ actor permissions | ✅ |
| Owner assign / last-Owner integrity | ✅ (post-fix) |
| Suspend clears session org + JWT trust | ✅ (post-fix) |
| Cross-org path non-disclosure | ✅ |
| Worker tenant fail-closed | ✅ (post-fix) |

---

## Testing

| Gate | Result |
|---|---|
| `pnpm lint` | Pass |
| `pnpm typecheck` | Pass |
| `pnpm unit` | Pass (includes T04-09 worker cases) |
| `pnpm integration` | Pass (isolation suite + Sprint-03 regression) |
| `pnpm build` | Pass |
| `pnpm format:check` | Pass |
| CI `isolation-tests` job | Present in workflow |

Covered after review: T04-01/02/03/04/05/07/08/09/10/11 + invite escalation + last-Owner demotion.  
Gaps: T04-06/T04-12 browser e2e (H8).

---

## Documentation Consistency

| Check | Status |
|---|---|
| Sprint-04-Implementation.md | ✅ Present |
| Access-admin runbook | ✅ |
| Permission keys vs Sprint table aliases | ✅ Mapped to canonical `docs/06` keys |
| Known deferrals called out | ✅ MFA recovery, support UX, M2 process |

---

## Remaining Risks

1. **False M2 confidence without staging demo / formal sign-off** (H9).
2. **Admin UX incomplete** for invite-create and permission-filtered nav (M1–M2) — server remains authoritative.
3. **Multi-instance rate limiting** still in-memory.
4. **Catalog shrink** can leave stale system role grants until seed delete logic lands (M3).
5. **Concurrent switch/refresh e2e** not automated (H8).

---

## Overall Score

**8.4 / 10**

Strong RBAC foundation aligned with architecture and Sprint-04 scope after review hardening. Score held back by incomplete admin UI journey, deferred MFA recovery, and process/staging M2 evidence — not by remaining critical authz defects.

---

## Recommendation

**Approve Sprint-04 with conditions:**

1. Treat post-review authorization fixes as **must-merge** before any multi-user staging admin demo.
2. Track H8–H10 and M1–M4 as explicit follow-ups (early Sprint-05 hardening or a short authz polish spike).
3. Do **not** start Property inventory until isolation suite remains green in CI (`isolation-tests`) on the merge branch.
4. Keep M2 formal sign-off gated on a recorded admin journey (invite → role assign → org switch → suspend) on staging.

**Do not implement Sprint-05 in this review cycle.**
