# Sprint-08 Implementation Summary

**Sprint ID:** Sprint-08 — Lease Creation and Activation  
**Implementation date:** 2026-07-24  
**Scope:** Sprint-08 only (draft leases, allocations with GiST/capacity enforcement, review, activate, leasing UI, document↔lease links). **No** Sprint-09 move-in/renew/terminate.  
**Baseline:** [Sprint-08.md](../sprints/Sprint-08.md) · [ADR-0004](../adr/0004-money-representation.md) · [03-database-design.md](../03-database-design.md) · [04-api-specification.md](../04-api-specification.md) · [CODING_RULES.md](../../CODING_RULES.md)  
**Out of scope:** Move-in/out, renew, payments/billing, e-sign providers, applications pipeline

---

## Summary

Sprint-08 delivers Organization-scoped draft lease creation (parties, commercial terms per ADR-0004 money, Unit/Bed/capacity allocation), review validation, and idempotent activation with do-not-rent gating, status history, and `lease.activated` outbox events. PostgreSQL `btree_gist` EXCLUDE constraints enforce WHOLE_UNIT and BED half-open range non-overlap; CAPACITY uses row lock + sum recheck. Staff UI adds Leasing nav, list/detail, create wizard, and high-risk activate workspace. Document links may target leases.

**Quality gates:** `pnpm lint` · `pnpm typecheck` · `pnpm unit` · `pnpm build` (integration/isolation require Postgres; suite authored as T08-01…13).

---

## Features implemented

| # | Feature | Status |
|---|---|---|
| 1 | ADR-0004 money accepted (`NUMERIC(19,4)` + ISO currency + decimal-string contracts) | Done |
| 2 | Lease schema: leases, lease_terms, lease_parties, lease_allocations, lease_status_history | Done |
| 3 | GiST EXCLUDE for WHOLE_UNIT / BED + migration `20260727120000_sprint_08_leases` | Done |
| 4 | CAPACITY lock + overflow rejection | Done |
| 5 | Mixed WHOLE vs BED/CAPACITY app conflict check | Done |
| 6 | Draft create/list/get/patch with If-Match | Done |
| 7 | Set allocation on draft | Done |
| 8 | Review snapshot (`POST …/review`) | Done |
| 9 | Activate with Idempotency-Key + If-Match + checklist | Done |
| 10 | Do-not-rent block / permissioned override | Done |
| 11 | `lease.activated` outbox event | Done |
| 12 | Status history API | Done |
| 13 | Document link to lease (upload-intent + createLink) | Done |
| 14 | Permissions: leases.list/view/create/update/activate/override_do_not_rent + role seeds | Done |
| 15 | Leasing UI: list, detail, wizard, activate + nav | Done |
| 16 | Isolation/concurrency tests T08-01…13 | Done (DB-gated) |
| 17 | Staging demo / human sign-off | Process remaining |
| 18 | Move-in / renew / terminate | Out of scope (Sprint-09) |

---

## Files created / updated (high level)

### Docs / ADR
- `docs/adr/0004-money-representation.md` — **Accepted**
- `docs/sprints/Sprint-08.md` — Status → Implemented
- `docs/reviews/Sprint-08-Implementation.md` — this file
- `prisma/raw-sql/20260727120000_lease_allocation_exclusions.sql`

### Prisma
- `prisma/schema/leasing.prisma`
- `prisma/schema/migrations/20260727120000_sprint_08_leases/migration.sql`
- Relation updates: `tenancy.prisma`, `inventory.prisma`, `parties.prisma`, `documents.prisma`
- `packages/testing` reset includes lease tables

### Contracts
- `packages/contracts/src/money.ts`
- `packages/contracts/src/leases.ts`
- `packages/contracts/src/permissions.ts` — lease keys
- `packages/contracts/src/documents.ts` — leaseId on upload intent
- `packages/contracts/src/sprint-08.contracts.spec.ts`
- `packages/contracts/src/index.ts` exports

### API
- `apps/api/src/modules/leasing/**` (domain, application, presentation, module, integration spec)
- `apps/api/src/app.module.ts` — LeasingModule
- `apps/api/src/modules/tenancy/application/permission-catalog.ts`
- `apps/api/src/modules/documents/application/document.service.ts` — lease links

### Web
- `apps/web/src/lib/leases-api.ts`
- `apps/web/src/features/leasing/**`
- `apps/web/src/app/(app)/app/leases/**`
- `apps/web/src/components/layouts/app-shell.tsx` — Leasing nav

---

## API surface (org-scoped)

| Method | Path | Permission |
|---|---|---|
| GET/POST | `/v1/organizations/{orgId}/leases` | list / create |
| GET/PATCH | `/v1/organizations/{orgId}/leases/{id}` | view / update |
| POST | `…/allocations` | update (+ If-Match) |
| POST | `…/review` | view |
| POST | `…/activate` | activate (+ If-Match + Idempotency-Key) |
| GET | `…/history` | view |

---

## Test coverage

| ID | Case | Location |
|---|---|---|
| T08-01 | Draft happy path | `leasing.integration.spec.ts` |
| T08-02 | Activate + history + outbox | same |
| T08-03 | Overlapping BED | same |
| T08-04 | Overlapping WHOLE_UNIT | same |
| T08-05 | Capacity overflow | same |
| T08-06 | Concurrent activate same draft — one wins | same |
| T08-07 | Stale If-Match | same |
| T08-08 | DNR without override | same |
| T08-09 | Cross-org 404 | same |
| T08-10 | PM out of scope | same |
| T08-11 | Idempotent activate replay | same |
| T08-12 | Isolation cross-org | same |
| T08-13 | EXCLUDE constraints present | same |
| Contracts | Money + create/activate schemas | `sprint-08.contracts.spec.ts` |

---

## Acceptance criteria mapping

| AC | Status |
|---|---|
| Draft reviewed and activated without double-booking | Met in code + T08-02/03/04/05/06 |
| GiST + capacity + concurrency tests | Met (T08-03…06, T08-13) |
| Lease list/detail/wizard/activate UI | Met |
| Money per ADR-0004 | Met |
| Do-not-rent gate | Met (T08-08) |
| `lease.activated` outbox | Met (T08-02) |
| Lease document attach path | Met (createLink + upload intent leaseId) |
| Staging demo + ADR before rent fields | ADR accepted; staging demo process open |
| Sprint-09 can extend without breaking allocations | Allocations retained; move-in not started |

---

## Remaining risks / follow-ups

1. **Staging migrate + demo** — Docker/Postgres was unavailable in the implementation environment; run `pnpm prisma:migrate:deploy` and T08 suite in CI/staging.
2. **Owner override permission** — `leases.override_do_not_rent` is on Owner/Admin catalog (assignable); PM does not get it by default.
3. **Lease number uniqueness races** — retry on unique violation could be hardened further under extreme concurrency.
4. **Wizard UX** — create wizard uses IDs for property/unit/resident (MVP); combobox pickers can deepen later.
5. **Accountant read path** — system Accountant role remains INACTIVE stub; auditors get leases.list/view.

---

## Handoff to Sprint-09

- Consume `ACTIVE` leases and `lease.activated` outbox events.
- Do not mutate locked terms; append occupancy events / move-in separately from contract status.
- Keep GiST allocations authoritative for inventory; end/replace allocations rather than delete history.
