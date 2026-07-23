# Sprint-06 Implementation Review

**Review ID:** RPM-REVIEW-SPRINT-06  
**Review date:** 2026-07-23  
**Reviewer role:** Principal Software Architect / Senior Code Reviewer  
**Scope:** Implementation of [Sprint-06](../sprints/Sprint-06.md) only — no Sprint-07+ features evaluated  
**Normative baselines:** [CODING_RULES.md](../../CODING_RULES.md) · [AGENTS.md](../../AGENTS.md) · [03-database-design.md](../03-database-design.md) · [04-api-specification.md](../04-api-specification.md) · [06-permission-system.md](../06-permission-system.md) · [Mid-Project-Audit.md](./Mid-Project-Audit.md) · [Mid-Project-Improvement-Plan.md](./Mid-Project-Improvement-Plan.md) · [Sprint-06-Implementation.md](./Sprint-06-Implementation.md)

---

## Summary

Sprint-06 delivers the M3 technical backbone: inventory CSV import (template → dry-run → async commit → reject CSV), bulk unit status, governed export, Operations Center listing, org-wide units API (fan-out removed), S3-compatible artifact storage, composite tenant FK expand, property-grant admin UX, scale seed + list SLO gate, and Mid-Project Improvement Plan P0/P1 items.

This review found **one critical isolation defect** and several **high** correctness defects. All critical/high items that could be safely corrected in-repo were fixed in this session. After fixes, local gates pass: lint, typecheck, unit (55), integration (50 including review cases), build.

The implementation **meets Sprint-06 technical acceptance for a conditional M3 Go**, with residual process/evidence gaps (staging 10k proof, kill/resume automation, metrics dashboards, human M3 sign-off).

---

## Critical Issues

### Critical (fixed during review)

| ID | Area | Issue | Severity |
|---|---|---|---|
| C1 | Security / isolation | `createImport` accepted caller-supplied `objectKey` without requiring `org/{organizationId}/…`. An actor with `imports.inventory` could dry-run another org’s CSV via storage key. | Critical |

### High (fixed during review)

| ID | Area | Issue | Severity |
|---|---|---|---|
| H1 | Import integrity | Dry-run allowed while commit left the job `QUEUED`, so a second dry-run could rewrite `import_job_rows` before the worker applied them. | High |
| H2 | AuthZ / scope | Property-scoped actors could **create new property codes** via import (scope check only for existing properties). | High |
| H3 | Idempotency | Re-commit while `FAILED`/`QUEUED` with a new idempotency key could enqueue a second `inventory.import.commit` outbox event. | High |
| H4 | AuthZ | Commit ignored `membershipId` (`void membershipId`); grant narrowing after dry-run was not re-applied. | High |
| H5 | Performance / UI | Org-wide units API existed, but Portfolio Units still fetched a hard `limit: 100` with no cursor / Load more — silent truncation at scale. | High |
| H6 | API | Operations list cursor mixed `id > after` with `createdAt desc` across imports+exports → unstable pagination. | High |
| H7 | Export | Sync export could omit `csvText` / silently truncate without a `truncated` flag; contract allowed limit up to 10k while service capped at 5k. | High |

### Medium / High (open — document / defer)

| ID | Area | Issue | Severity |
|---|---|---|---|
| H8 | Testing / M3 evidence | CI scale gate defaults to ~2.5k units (not 10k); “p95” uses 5 samples; search uses `ILIKE '%q%'` (T06-09 index seek unproven). | High (evidence) |
| H9 | Testing | T06-10 worker kill/resume not automated; resume relies on upserts over forever-`ACCEPTED` rows. | High (soft) |
| H10 | Architecture | Byte-identical commit processors in API vs worker — divergence risk (known debt). | Medium–High |
| H11 | Process | Staging deploy + formal M3 / pilot sign-off not evidenced in-repo. | High (process) |
| H12 | Observability | Slow-query / queue-depth metrics dashboards not shipped (Sprint AC #5). | Medium |
| H13 | RBAC product | Default Property Manager system role lacks `imports.inventory` (scoped import only via custom role or service-level tests). | Medium |
| H14 | Database | `(tenant_id, membership_id)` composite FK on grants still absent (property composite FK landed). | Medium |

### Low / partial (open)

| ID | Area | Issue | Severity |
|---|---|---|---|
| M1 | UI | Portfolio nav still largely unfiltered by permission keys (Imports/Operations gated; Q4 residual). | Medium |
| M2 | Import | Cancellation / `CANCELLED` path unused; no cancel-before-commit API. | Low |
| M3 | Audit | Worker completion does not emit a final `applied` audit event (enqueue-time audit only). | Low |
| M4 | Mapping presets | `import_mapping_presets` table exists; reusable mapping UI/API thin. | Low |
| M5 | Beds bulk | Bulk status covers units; beds bulk status not separately surfaced. | Low |

---

## Changes Made

| Fix | What changed |
|---|---|
| C1 | `S3StorageClient.assertOrganizationObjectKey`; create/load paths reject cross-org keys (`IMPORT_OBJECT_KEY_FORBIDDEN`) |
| H1 | Commit CAS `QUEUED\|FAILED → PROCESSING` before outbox; dry-run blocked on `PROCESSING` / terminal statuses |
| H2 | Scoped dry-run skips unknown property codes; cannot create new properties via import |
| H3 | Claim + early return when already `PROCESSING`; second key does not append another outbox |
| H4 | `reapplyPropertyScopeAtCommit` demotes out-of-scope `ACCEPTED` rows before enqueue; payload carries `actorMembershipId` |
| H5 | `useUnits` → `useInfiniteQuery` + Units list **Load more** (page size 50) |
| H6 | Operations keyset on `(createdAt desc, id desc)` with anchor lookup |
| H7 | Export always returns bounded inline `csvText`; `truncated` flag; contract max limit 5_000 |
| Bulk UX | Commit requires successful Preview first |
| Bulk AuthZ | Out-of-scope units reported as `NOT_FOUND` (non-disclosure) |
| Tests | Review cases + T06-05 commit assert + T06-12 export; integration **50** tests |

---

## Minor Issues

Documented above as H8–H14 / M1–M5. None block technical merge after critical/high fixes. H8/H11 should be closed before claiming **full** M3 stakeholder completion.

---

## Verification matrix

| Criterion | Status | Notes |
|---|---|---|
| Sprint scope (no Sprint-07) | ✅ Pass | Residents/leasing/Redis MFA not started |
| Architecture consistency | ✅ Pass (post-fix) | Imports module + domain rules; worker handler; ADR-0005 |
| Database consistency | ✅ Pass | `import_jobs` / rows / exports; composite FKs + list indexes |
| API consistency | ✅ Pass (post-fix) | Paths/permissions align with Sprint-06.md; org path 404 |
| UI consistency | ✅ Pass (post-fix) | Wizard, ops, bulk+export, cursor Load more |
| Multi-tenant isolation | ✅ Pass (post-fix) | Job IDOR + objectKey tenancy + PM scope (incl. new props) |
| Performance improvements | ✅ Pass | Org-wide units API; client fan-out removed; cursor UI |
| 10k dataset performance | ⚠️ Conditional | Seed + SLO harness exist; CI default &lt;10k; staging env gate |
| Security | ✅ Pass (post-fix) | Object key binding; scoped import/bulk; S3 path `..` checks |
| Import pipeline | ✅ Pass (post-fix) | Dry-run immutability of inventory; commit claim boundary |
| Background workers | ✅ Pass | Outbox `inventory.import.commit`; upsert resume |
| Error handling / validation | ✅ Pass | Row reject CSV; problem paths; file size check on load |
| Testing | ✅ Pass (expanded) | T06-01…07, 08/09, 12 + review cases; T06-10/11 thin |
| Documentation consistency | ✅ Pass | Implementation + pilot rules + import runbook + ADR |

---

## Remaining Risks

1. **M3 evidence** — run `SCALE_TEST_UNIT_COUNT=10000` (or `pnpm seed:scale-inventory`) in staging and record list/search latency before stakeholder M3 sign-off.
2. **Worker kill mid-commit** — upserts + partial uniques reduce duplicates, but T06-10 automation and `APPLIED` row marking are still debt.
3. **API↔worker processor duplication** — extract shared package before further import types.
4. **Search index plan** — prefix/trigram strategy needed if operators rely on mid-string `q` at 10k+.
5. **Ops metrics** — reject rate / queue depth dashboards still missing for AC #5.
6. Improvement Plan leftovers intentionally deferred: Q5 e2e, S3 Redis rate limit, S4 MFA recovery, D3 OpenAPI (Sprint-07+).

---

## Overall Score

**8.1 / 10**

Strong feature delivery and Mid-Project P0 coverage after review hardening. Deducted for the pre-review objectKey isolation defect, incomplete 10k CI proof, thin T06-10/metrics, and process/sign-off gaps.

---

## Recommendation

**Approve with conditions** for Sprint-06 technical merge / Conditional Go toward Sprint-07:

1. Ship review fixes (already applied in this session).
2. Before claiming full **M3**, complete staging 10k seed + recorded list/search evidence and pilot demo sign-off.
3. Track H9/H10/H12 as near-term hardening (can start Sprint-07 week 0 without blocking residents kickoff if Conditional Go is accepted).
4. **Do not** treat Implementation.md’s “Met” rows for staging demo / human M3 as closed until H11 is evidenced.
5. **Do not implement Sprint-07 in this review session** (none started).

---

## Quality gates (post-review)

- `pnpm lint` / `typecheck` / `unit` / `integration` / `build` — pass after fixes  
- Imports isolation suite: **11** cases (T06-01…07, T06-12, + 3 review cases)  
- Full integration run: **50** tests
