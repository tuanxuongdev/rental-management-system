# Sprint-06 — Bulk Inventory Import and Scale Baseline

**Sprint ID:** Sprint-06  
**Roadmap alignment:** [10-development-roadmap.md](../10-development-roadmap.md) Sprint 6 · Phase 3 exit **M3**  
**Program references:** [project-roadmap.md](../project-roadmap.md) · [dependency-map.md](../dependency-map.md) · [03-database-design.md](../03-database-design.md) · [ui/admin/import-wizard.md](../ui/admin/import-wizard.md) · [ui/shell/operations-center.md](../ui/shell/operations-center.md) · [ui/cross-cutting-patterns.md](../ui/cross-cutting-patterns.md)  
**Duration:** 2 weeks  
**Status:** Implemented — see docs/reviews/Sprint-06-Implementation.md  
**Builds on:** [Sprint-05.md](./Sprint-05.md)

---

## Goal

Enable idempotent bulk inventory import (CSV template, validation, dry-run, commit, rejection report), permissioned bulk status updates, and a proven query/pagination/export baseline at 10,000+ Unit scale so pilot portfolio inventory can be imported, validated, searched, and exported (**M3**).

---

## Business Value

- Makes real pilot onboarding feasible without manual Unit-by-Unit entry.
- Surfaces data-quality issues early via dry-run and rejection CSVs.
- De-risks 10k-unit performance before leasing and billing amplify load.
- Establishes Import → Operations Center patterns reused by migration rehearsals (Phase 7).
- Independently deployable: import/scale improvements ship atop inventory without residents/leases.

---

## Scope

### In scope

- Inventory import types: Properties, Buildings (optional), Units, Beds, amenities links as supported.
- CSV templates + downloadable examples.
- Import wizard: upload → identify → map → dry-run → review → async commit → summary.
- Field mapping persistence for authorized reusable mappings.
- Validation: required fields, referential integrity within file/org, duplicate codes, status enums.
- Idempotent commit with durable `import_jobs` / batch id; resumable; failed-row reporting.
- Downloadable errors/rejections CSV.
- Bulk status updates for Units/Beds with permission, preview, and audit.
- Search/list/export behavior tested at ≥10,000 Units (synthetic seed).
- Indexes, slow-query instrumentation, worker queue depth metrics.
- Operations Center entries for import jobs.
- Pilot inventory mapping and cleansing rules document.

### Out of scope

- Resident/lease/payment imports (later migration phases).
- Opening balances / financial imports.
- Full migration rehearsal (Sprints 16–17).
- Holds/reservations advanced workspaces.
- Non-inventory import types in the wizard UI (hide or disable).

---

## Features

1. Import wizard UI for inventory only.
2. Async import worker using outbox/jobs from Sprint-02.
3. Dry-run totals, warnings, duplicates, sample transformed rows.
4. Commit with exactly-once row application per idempotency keys.
5. Bulk status update with exclusion reasons.
6. Governed export of inventory list (CSV) with authz.
7. 10k Unit seed + performance test suite (CI nightly or staging gate).
8. Ops metrics: import duration, reject rate, p95 list/search.

---

## User Stories

1. **As an Organization Administrator**, I can download a CSV template and dry-run an import so I see errors before changing production inventory.
2. **As an Organization Administrator**, I can commit an import asynchronously and track it in Operations Center so I can leave the page safely.
3. **As a Property Manager**, I can apply bulk status updates only within my property scope so I cannot alter unauthorized inventory.
4. **As an operator**, I can search and page through a 10,000-Unit portfolio without the UI freezing.
5. **As a data migration lead**, I receive rejection CSVs with row-level reasons so business owners can cleanse source data.
6. **As a product owner**, **M3** is met: pilot inventory imports with agreed error handling.

---

## Database Changes

| Table | Purpose |
|---|---|
| `import_jobs` | Durable import batch metadata, status, counts, actor, org, type |
| `import_job_rows` or error blob store | Row-level reject/skip reasons (or object-storage error artifacts) |
| `export_jobs` | Thin support for async inventory export if required |
| Indexes | Composite indexes on units/beds for `(tenant_id, property_id, status)`, `(tenant_id, code)`, list sort keys |
| Optional | Mapping presets table for reusable column maps |

No lease/finance tables. Ensure import writes remain org-scoped and audited.

---

## API Changes

| Method | Path | Description | AuthZ |
|---|---|---|---|
| `GET` | `/v1/organizations/{orgId}/imports/templates/inventory` | Download template | `imports.inventory` |
| `POST` | `/v1/organizations/{orgId}/imports` | Create import (upload metadata + mapping) | `imports.inventory` |
| `POST` | `/v1/organizations/{orgId}/imports/{id}/dry-run` | Validate/normalize | `imports.inventory` |
| `POST` | `/v1/organizations/{orgId}/imports/{id}/commit` | Async commit (`Idempotency-Key`) | `imports.inventory` |
| `GET` | `/v1/organizations/{orgId}/imports/{id}` | Status/summary | `imports.inventory` |
| `GET` | `/v1/organizations/{orgId}/imports/{id}/errors` | Error CSV / URL | `imports.inventory` |
| `POST` | `/v1/organizations/{orgId}/units/bulk-status` | Bulk status preview/commit | `units.update` + scope |
| `GET` | `/v1/organizations/{orgId}/operations` | Include import operations | `operations.read` |
| `POST` | `/v1/organizations/{orgId}/exports` | Inventory export job (optional) | `exports.inventory` |

Align async job states with cross-cutting patterns: `queued`, `processing`, `partially_completed`, `completed`, `failed`, `cancelled`.

---

## UI Changes

| Screen | Spec |
|---|---|
| Import wizard | `ui/admin/import-wizard.md` (inventory type only) |
| Operations Center | `ui/shell/operations-center.md` — show import jobs |
| Units/Beds lists | Bulk action bar for status; export action |
| Properties/Units | Performance: virtualization or cursor “load more”; no full client load |

Empty states: template-first for zero inventory; filtered-empty distinct from permission-empty.

---

## Permissions

| Permission | Use |
|---|---|
| `imports.inventory` | Run inventory imports |
| `units.update` / `beds.update` | Bulk status (scoped) |
| `exports.inventory` | Export inventory |
| `operations.read` | View jobs |
| Property scope | All bulk/import row applications filtered |

Deny import of types outside inventory. Step-up not required for inventory import (unlike PII export).

---

## Validation Rules

1. Dry-run never mutates inventory.
2. Commit is idempotent per job id / idempotency key; retries safe.
3. Duplicate Unit codes within org/property rejected with row errors.
4. Referenced Property/Building must exist or be creatable in same file per mapping rules—document chosen approach.
5. Partial failure preserves successful rows; summary counts exact.
6. Cancellation only before irreversible commit boundary; document boundary.
7. Bulk status preview lists exclusions (permission, lifecycle).
8. Exports/list queries must be server-side paginated; max page size enforced.
9. File size/type limits; malware scan hook if documents pipeline exists—or defer binary to CSV-only.
10. All import commits emit audit events with job id and counts.

---

## Test Cases

| ID | Case | Expected |
|---|---|---|
| T06-01 | Dry-run invalid CSV | Errors CSV; zero writes |
| T06-02 | Commit valid file | Units/beds created; job completed |
| T06-03 | Re-commit same idempotency key | No duplicates |
| T06-04 | Partial invalid rows | Partial success + reject reasons |
| T06-05 | Property Manager import affecting other property | Rows excluded/denied |
| T06-06 | Cross-org import id | 404 |
| T06-07 | Bulk status preview/commit | Audited; scoped |
| T06-08 | Seed 10k units; list p95 | Meets agreed SLO (document target) |
| T06-09 | Search by code under 10k | Uses index; no seq scan hot path |
| T06-10 | Worker kill mid-import | Resumable; no duplicate creates |
| T06-11 | Operations Center shows job | Status transitions visible |
| T06-12 | Export inventory | Authz enforced; async or bounded sync |
| T06-13 | Isolation suite includes import/bulk | Pass |

---

## Acceptance Criteria

1. Pilot portfolio inventory can be **imported, validated, searched, and exported** (**M3**).
2. Import wizard supports dry-run, async commit, durable job id, and downloadable errors.
3. Bulk status updates are permissioned, previewed, and audited.
4. 10,000+ Unit inventory queries/pagination/export behavior tested with instrumentation.
5. Slow-query and queue-depth metrics visible in staging.
6. Pilot inventory mapping and cleansing rules published.
7. Representative pilot inventory import succeeds with agreed error handling.
8. Deployed to staging; demo to pilot stakeholders.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Dirty pilot CSVs | Import distrust | Dry-run + reject CSV; cleansing rules |
| Non-idempotent commit | Duplicate Units | Idempotency keys + unique constraints |
| 10k tests only on tiny data | False M3 | Mandatory synthetic seed |
| Wizard scope creep to leases | Slip | Inventory-only type gate |
| Blocking UI on sync import | Timeouts | Async commit mandatory above small threshold |
| Weak property scope on bulk | Data corruption | Row-level scope checks |

---

## Dependencies

| Dependency | Type | Required |
|---|---|---|
| Sprint-05 inventory APIs/UI | Hard | Yes |
| Sprint-02 outbox/worker/S3 | Hard | Yes |
| Sprint-04 RBAC + property grants | Hard | Yes |
| Pilot mapping rules SME | Soft→Hard for M3 | Yes for sign-off |
| Object storage for files/error artifacts | Hard | Yes |
| Sprint-07 | Downstream | Residents on imported portfolios |

---

## Deliverables

1. `import_jobs` (+ errors) migrations and workers.
2. Inventory import APIs and wizard UI.
3. Bulk status API/UI.
4. Operations Center integration for imports.
5. 10k seed tool + performance evidence.
6. Mapping/cleansing rules document for pilots.
7. **M3** sign-off record.
8. Metrics dashboards or queries for import/list latency.

---

## Estimated Time

| Track | Estimate |
|---|---|
| Import domain + worker + idempotency | 3–4 days |
| Import wizard UI + Operations Center | 2–3 days |
| Bulk status + export | 1–2 days |
| 10k seed, indexes, perf tests | 2 days |
| Pilot rules + M3 demo | 1 day |
| **Sprint total** | **10 business days (2 weeks)** |

---

## Definition of Done

1. Acceptance criteria and **M3** sign-off complete.
2. Async import proven under kill/retry; no duplicate inventory from replay.
3. Isolation, authz, and performance tests pass at agreed thresholds.
4. Coding standards, CI gates, reviews complete.
5. Runbooks updated: failed import retry, stuck job handling.
6. Deployed + smoke-tested on staging with sample pilot file.
7. Independently deployable without residents/leases/finance.
8. Handoff: Sprint-07 residents; migration later reuses import job patterns.
