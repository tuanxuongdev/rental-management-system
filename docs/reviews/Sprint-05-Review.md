# Sprint-05 Implementation Review

**Review ID:** RPM-REVIEW-SPRINT-05  
**Review date:** 2026-07-23  
**Reviewer role:** Principal Software Architect / Senior Code Reviewer  
**Scope:** Implementation of [Sprint-05](../sprints/Sprint-05.md) only — no Sprint-06+ features evaluated  
**Normative baselines:** [00-overview](../00-overview.md) · [02-system-architecture](../02-system-architecture.md) · [03-database-design](../03-database-design.md) · [04-api-specification](../04-api-specification.md) · [06-permission-system](../06-permission-system.md) · [CODING_RULES.md](../../CODING_RULES.md) · [Sprint-04-Review.md](./Sprint-04-Review.md) · [Sprint-05-Implementation.md](./Sprint-05-Implementation.md)

---

## Summary

Sprint-05 delivers Organization-scoped portfolio inventory (Property → Unit → optional Bed), amenities, status history, status-based availability, Property Owners / ownerships / management agreements, Property Manager grant enforcement, Portfolio UI, demo seed, and isolation tests toward **M3**.

During this review, **one critical disclosure defect** and several **high** correctness/authz defects were found and corrected:

1. **P0 — Property list cursor overwrote PM grant filter** (page 2+ could leak out-of-scope properties).
2. **Archived property restore was unreachable** (`assertPropertyAccess` required `deletedAt: null`).
3. **SELECTED_PROPERTIES PMs could create properties they then could not read** (no auto-grant).
4. **Active code uniqueness was raceable** (application-only checks; partial unique indexes added).
5. **Ownership share/overlap invariants were missing**.
6. **Stale If-Match returned 409 instead of API-contract 412** on inventory/parties writes.
7. **Agreement activate ignored draft/overlap rules; partyIds were not org-validated**.
8. **Unit `allocationMode` could leave BED mode while active beds remained**.

After review fixes, local gates pass: lint, typecheck, unit, integration (36 tests including new review cases), build.

The implementation **substantially meets Sprint-05 technical acceptance criteria** for a small-portfolio demo. Residual gaps are mainly **composite tenant FKs**, **staging/T05-12 process**, **property-grant admin UI**, and **org-wide units list API** (UI fan-out).

---

## Critical Issues

### Critical (fixed during review)

| ID | Area | Issue | Severity |
|---|---|---|---|
| C1 | AuthZ / isolation | `listProperties` spread `{ id: { gt: after } }` after `{ id: { in: accessible } }`, wiping the PM grant filter on page 2+. Out-of-scope properties could leak under normal pagination. | Critical |

### High (fixed during review)

| ID | Area | Issue | Severity |
|---|---|---|---|
| H1 | Restore | `restoreProperty` called `assertPropertyAccess` which required non-deleted rows → archived properties always 404. | High |
| H2 | AuthZ | Property-scoped PM `createProperty` did not insert a `SELECTED_PROPERTIES` grant → create succeeded, subsequent get/list 404. | High |
| H3 | Data integrity | No partial unique indexes on active property/unit/bed/building codes; concurrent creates could duplicate. | High |
| H4 | Validation | Ownership create lacked period-overlap (same owner) and ≤100% equity share checks. | High |
| H5 | API contract | Inventory/parties `VERSION_MISMATCH` used `ConflictException` (409); VersionedWrite requires **412**. | High |
| H6 | Agreements | Activate did not require `DRAFT`, did not reject overlapping ACTIVE agreements; `partyIds` not verified in-org. | High |
| H7 | Units | `patchUnit` could change `allocationMode` away from `BED` while active beds remained. | High |
| H8 | Agreements list | When `propertyId` + selected grants both set, grant `{ in }` overwrote the specific property filter. | Medium–High |

### Medium / High (open — document / defer)

| ID | Area | Issue | Severity |
|---|---|---|---|
| H9 | Database | Inventory/parties FKs are single-column (id only), not composite `(tenant_id, …)` as preferred in DB design. Cross-tenant parent/child mismatch is still mitigated by application `tenantId` filters but not DB-enforced. | High (soft) |
| H10 | Process | Staging deploy + formal Sprint-05 demo / T05-12 terminology sign-off not evidenced in repo. | High (process) |
| M1 | UI | Portfolio/Admin nav not filtered by `permissionKeys` (server remains authoritative). | Medium |
| M2 | UI | No admin UI to assign Property Manager `property_access_grants` (schema + auto-grant on PM create only). | Medium |
| M3 | API | No dedicated org-wide `GET /units`; web fans out per-property lists (fine for small portfolios; Sprint-06 scale). | Medium |
| M4 | Schema/UI | Floors modeled; no floor CRUD UI. Rate plans table without product UI. | Medium |
| M5 | A11y | Portfolio screens use labels/alerts; no automated WCAG suite. | Medium |
| M6 | Testing | No browser e2e for Portfolio scope selector mid-flight org switch. | Medium |

### Low (open)

| ID | Area | Issue | Severity |
|---|---|---|---|
| L1 | Availability | Status-based only (documented Sprint-05 limitation; lease occupancy later). | Low |
| L2 | Soft-delete | Partial uniques now cover codes; other natural keys may still need Sprint-06 hardening. | Low |
| L3 | Amenities | Amenity assignment UI thinner than API replace endpoints. | Low |

---

## Changes Made

| Fix | What changed |
|---|---|
| C1 | `listProperties` combines grant `in` + cursor `gt` on `id` (no overwrite) |
| H1 | `assertPropertyAccess(..., { includeDeleted: true })` for restore; reject non-archived restore |
| H2 | PM create with selected scope inserts `PropertyAccessGrant` for the new property |
| H3 | Migration `20260724130000_sprint_05_review_partial_uniques` |
| H4 | Ownership overlap (same owner) + equity total ≤ 100% + percentage validation |
| H5 | `throwVersionMismatch` → `PreconditionFailedException` (412) for inventory/parties |
| H6 | Activate requires `DRAFT`; overlap check; org-validated `partyIds` |
| H7 | Block allocation mode change off `BED` while active beds exist |
| H8 | Agreements list: specific `propertyId` filter wins after access assert |
| Tests | Review cases: PM cursor scope, restore, PM auto-grant, ownership total |

---

## Minor Issues

Documented above as M1–M6 / L1–L3. None block technical readiness for a small-portfolio Sprint-05 demo after critical/high fixes. H9 (composite FKs) and H10 (staging/sign-off) should be tracked before claiming full M3 readiness.

---

## Architecture Compliance

| Criterion | Status | Notes |
|---|---|---|
| Modular monolith (`inventory`, `parties`, `tenancy`/RBAC) | ✅ Pass | Controllers thin; services hold use cases |
| Org path == session org → 404 | ✅ Pass | `OrganizationPathGuard` retained |
| Property scope on queries | ✅ Pass (post-fix) | Grant filter + assert on mutations |
| Ownership ≠ login | ✅ Pass | Explicit flags + membership count guards |
| Deny-by-default permissions | ✅ Pass | Guard + catalog; Property Manager ACTIVE |
| No `X-Tenant-ID` | ✅ Pass | Unchanged |
| Money as float | ✅ Pass | Ownership % via `Decimal`/string |
| Outbox on inventory mutations | ⚠️ Thin | Audit recorded; durable outbox events not required for all CRUD in Sprint-05 |

---

## Business / Sprint Scope Compliance

| Criterion | Status |
|---|---|
| Property → Unit → Bed hierarchy | ✅ Pass |
| Apartment + boarding-house shapes | ✅ Pass |
| Availability status-based | ✅ Pass (labeled) |
| Property Owners / agreements non-authorizing | ✅ Pass |
| Portfolio UI + scope selector | ✅ Pass |
| Isolation tests T05-01…T05-11 | ✅ Pass (+ review cases) |
| Demo seed + Sprint-06 handoff notes | ✅ Pass |
| Bulk import | ✅ Correctly out of scope |
| Staging demo | ⚠️ Process remaining |

---

## Remaining Risks

1. **Composite tenant FKs** still absent — rely on application scoping until a dedicated expand migration.
2. **No property-grant admin UI** — operators need SQL/API or follow-up sprint to assign PMs without create-auto-grant path.
3. **Units list fan-out** may degrade before Sprint-06 10k work.
4. **Staging / terminology checklist** not closed in-repo.
5. Sprint-04 residual: nav not permission-filtered; MFA recovery enrollment deferred.

---

## Overall Score

**8.3 / 10**

Strong domain delivery and isolation coverage after review fixes. Deducted for the pre-review P0 disclosure bug, missing composite FKs, and process/staging gaps.

---

## Recommendation

**Approve with conditions** for Sprint-05 technical merge:

1. Ship review fixes (already applied in this session).
2. Track H9 composite FK migration as a near-term hardening item (can pair with Sprint-06 index work).
3. Do not claim full M3 until staging demo + T05-12 notes and (ideally) property-grant admin path exist.
4. **Do not start Sprint-06 bulk import** until this review’s critical/high code fixes are merged.

---

## Quality gates (post-review)

- `pnpm lint` / `typecheck` / `unit` / `integration` / `build` — pass after fixes  
- Inventory isolation suite: **15** cases (T05-01…T05-11 + 4 review cases)
