# Sprint-09 Implementation Summary

**Sprint ID:** Sprint-09 — Lease Lifecycle  
**Implementation date:** 2026-07-24  
**Scope:** Sprint-09 only (move-in, renew/transfer, notice, move-out checkout, terminate, occupancy events, pending actions, thin Home dashboard). **No** Sprint-10 billing/payments/meters ledger/security_deposits.  
**Baseline:** [Sprint-09.md](../sprints/Sprint-09.md) · [Alpha-Product-Review.md](./Alpha-Product-Review.md) · [Sprint-08-Review.md](./Sprint-08-Review.md) · [CODING_RULES.md](../../CODING_RULES.md)  
**Out of scope:** Rent collection, invoices, PSP, deposit ledger execution, e-sign, resident portal move-out

---

## Summary

Sprint-09 completes the operational lease loop after contractual activation: physical move-in with key checkout, renewal draft successors, allocation transfer under Sprint-08 EXCLUDE rules, notice recording, move-out checkout with deposit **preview** only, termination with reason, occupancy event timeline, pending-action queues, and a thin Home dashboard of leasing exceptions. Rent collection remains explicitly deferred to Sprint-10 (surfaced in dashboard `financeNote`).

**Quality gates:** `pnpm lint` · `pnpm typecheck` · `pnpm unit` · `pnpm build` (integration/isolation require Postgres; suite authored as T09-*).

---

## Features implemented

| # | Feature | Status |
|---|---|---|
| 1 | `occupancy_events` + `asset_keys` tables | Done |
| 2 | Lease columns: occupancy state, notice, termination, renewal link, checklists, holdover | Done |
| 3 | Move-in API + UI (`leases.move_in`) | Done |
| 4 | Renew draft successor API + UI (`leases.renew`) | Done |
| 5 | Transfer allocation API (`leases.transfer`) | Done (API; thin UI via renew path focus) |
| 6 | Notice API (`leases.update`) | Done |
| 7 | Move-out start / patch / complete + UI | Done |
| 8 | Terminate with confirmation + reason | Done (from move-out UI + API) |
| 9 | Pending-actions + Home dashboard widgets | Done |
| 10 | Occupancy timeline API | Done |
| 11 | Outbox events: moved_in, renewed, transferred, notice, move_out_completed, terminated | Done |
| 12 | Deposit disposition checklist/preview only | Done (no Sprint-10 ledger) |
| 13 | Permissions + PM grants for lifecycle | Done |
| 14 | Integration tests T09-* | Authored (DB-gated) |
| 15 | Staging / M4 human sign-off | Process remaining |
| 16 | Rent collection | Out of scope (Sprint-10) |

---

## Alpha review items completed

| Alpha gap | Sprint-09 handling |
|---|---|
| Move-in workflow | Implemented |
| Move-out workflow | Implemented (checkout + terminate) |
| Morning dashboard | Thin Home exception widgets from pending actions |
| Business workflow continuity | Activate → move-in → renew / move-out → terminate |
| Rent collection | **Not** implemented — labeled Sprint-10 in UI/API notes |

---

## Files created

### Prisma
- `prisma/schema/migrations/20260728120000_sprint_09_lease_lifecycle/migration.sql`

### Contracts
- `packages/contracts/src/leases-lifecycle.ts`

### API
- `apps/api/src/modules/leasing/application/lease-lifecycle.service.ts`
- `apps/api/src/modules/leasing/leasing-lifecycle.integration.spec.ts`

### Web
- `apps/web/src/features/leasing/components/lease-move-in.tsx`
- `apps/web/src/features/leasing/components/lease-move-out.tsx`
- `apps/web/src/features/leasing/components/lease-renew.tsx`
- `apps/web/src/features/leasing/components/home-dashboard.tsx`
- `apps/web/src/app/(app)/app/leases/[leaseId]/move-in/page.tsx`
- `apps/web/src/app/(app)/app/leases/[leaseId]/move-out/page.tsx`
- `apps/web/src/app/(app)/app/leases/[leaseId]/renew/page.tsx`

### Docs
- `docs/reviews/Sprint-09-Implementation.md` (this file)

---

## Files modified

- `prisma/schema/leasing.prisma` — lifecycle enums/models/columns
- `prisma/schema/parties.prisma`, `inventory.prisma` — relations
- `packages/contracts/src/leases.ts`, `permissions.ts`, `index.ts`
- `packages/testing/src/integration-database.ts` — reset order
- `apps/api/.../permission-catalog.ts`
- `apps/api/.../lease.service.ts` — response occupancy fields; shared helpers
- `apps/api/.../leases.controller.ts`, `leasing.module.ts`
- `apps/api/.../lease.rules.ts` — occupancy notes
- `apps/web/src/lib/leases-api.ts`
- `apps/web/src/features/leasing/**` (detail, list, permissions, index)
- `apps/web/src/app/(app)/app/page.tsx` — Home dashboard
- `docs/sprints/Sprint-09.md` — status
- `docs/06-permission-system.md` — lifecycle keys

---

## Database changes

Migration `20260728120000_sprint_09_lease_lifecycle`:

- Enums: `LeaseOccupancyState`, `LeaseMoveOutStatus`, `OccupancyEventType`, `AssetKeyStatus`; `LeaseStatus` adds `NOTICE`, `ENDED`
- `leases` columns for occupancy, notice, termination, renewal FK, checklists, holdover
- Tables: `occupancy_events`, `asset_keys` with tenant-complete lease FKs

**Explicit non-owners:** `meters`, `meter_readings`, `security_deposits` (Sprint-10).

---

## API changes

| Method | Path | AuthZ |
|---|---|---|
| `GET` | `.../dashboard/home` | `leases.list` |
| `GET` | `.../leases/pending-actions` | `leases.list` |
| `POST` | `.../leases/{id}/move-in` | `leases.move_in` + Idempotency + If-Match |
| `POST` | `.../leases/{id}/renew` | `leases.renew` + If-Match |
| `POST` | `.../leases/{id}/transfer` | `leases.transfer` + If-Match |
| `POST` | `.../leases/{id}/notice` | `leases.update` + If-Match |
| `POST` | `.../leases/{id}/move-out/start` | `leases.move_out` + If-Match |
| `PATCH` | `.../leases/{id}/move-out` | `leases.move_out` + If-Match |
| `POST` | `.../leases/{id}/move-out/complete` | `leases.move_out` + Idempotency + If-Match |
| `POST` | `.../leases/{id}/terminate` | `leases.terminate` + Idempotency + If-Match |
| `GET` | `.../leases/{id}/occupancy-events` | `leases.view` |

Lease response now includes `occupancyState`, `moveOutStatus`, move timestamps, notice/termination fields, dynamic `occupancyNote`, and `depositDispositionNote`.

---

## Test coverage

| ID | Case | Location |
|---|---|---|
| T09-01 | Move-in happy path | `leasing-lifecycle.integration.spec.ts` |
| T09-02 | Double move-in rejected | same |
| T09-03 | Renew draft successor | same |
| T09-05 | Move-out complete + terminate | same |
| T09-06 | Terminate schema requires reason | same |
| T09-07 | Pending move-in due | same |
| T09-08 | Cross-org 404 | same |
| T09-09 | Property scope denial | same |
| T09-11 | Home dashboard finance note | same |

T09-04 (transfer contested bed), T09-10 staging E2E, T09-12 full isolation suite expansion: remaining / DB-gated.

---

## Remaining work

1. Staging pilot script sign-off (**M4** process).  
2. Dedicated transfer UI wizard (API exists).  
3. Richer move-out photo capture UX (documents already linkable).  
4. Concurrent capacity/transfer race tests.  
5. **Sprint-10:** rent charges, invoices, payments, meters, deposit ledger execution.  
6. Accountant role productization (still thin).  
7. Playwright critical path automation.

---

## Known limitations

- Home dashboard is leasing-exception-only (no finance/maintenance widgets).  
- Deposit outcomes are preview/checklist; UI states “Pending finance disposition”.  
- Holdover flagging runs opportunistically when listing pending actions (not a background job).  
- Transfer UI not first-class in nav (API + renew path prioritized).  
- Integration tests skip when Postgres unreachable.  
- No rent collection in this sprint by design.
