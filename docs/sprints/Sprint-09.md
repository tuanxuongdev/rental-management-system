# Sprint-09 — Lease Lifecycle

**Sprint ID:** Sprint-09  
**Roadmap alignment:** [10-development-roadmap.md](../10-development-roadmap.md) Sprint 9 · Phase 4 exit **M4**  
**Program references:** [project-roadmap.md](../project-roadmap.md) · [dependency-map.md](../dependency-map.md) · [03-database-design.md](../03-database-design.md) · [04-api-specification.md](../04-api-specification.md) · [01-business-requirements.md](../01-business-requirements.md)  
**UI references:** [ui/leasing/move-in.md](../ui/leasing/move-in.md) · [ui/leasing/move-out-checkout.md](../ui/leasing/move-out-checkout.md) · [ui/leasing/lease-renew-transfer.md](../ui/leasing/lease-renew-transfer.md) · [ui/leasing/lease-detail.md](../ui/leasing/lease-detail.md) · [ui/leasing/leases-list.md](../ui/leasing/leases-list.md) · [ui/cross-cutting-patterns.md](../ui/cross-cutting-patterns.md)  
**Duration:** 2 weeks  
**Status:** Implemented (engineering) — staging/M4 pilot sign-off remaining  
**Builds on:** [Sprint-08.md](./Sprint-08.md) · [Sprint-07.md](./Sprint-07.md) (documents)

---

## Goal

Complete the controlled lease lifecycle—move-in, renewal/transfer, notice, move-out checkout, termination boundaries, occupancy consistency, expiry/pending-action views, and versioned domain events—so a pilot operator can finish move-in, renewal, and move-out scenarios end to end (**M4**).

---

## Business Value

- Makes activated leases operationally usable day-to-day, not just contractual records.
- Keeps physical occupancy aligned with lease transitions—critical for availability accuracy.
- Defines deposit disposition **boundaries** (execution may complete with finance in later sprints) so move-out is not ad hoc.
- Emits events billing/notifications will consume, reducing later rework.
- Independently deployable: lifecycle completes without requiring live PSP payments (deposit disposition may be preview/checklist-only where finance absent).

---

## Scope

### In scope

- Move-in workflow: checklist, keys/assets checkout (`asset_keys` thin), optional **meter reading values captured on checklist/documents** (canonical `meters` / `meter_readings` tables land in Sprint-10), occupancy event `moved_in`, unit/bed status updates.
- Renewal: create successor lease terms/allocation linked to prior; activation rules reuse Sprint-08 constraints.
- Transfer (unit/bed change) within policy: end prior allocation, start new without forbidden overlap.
- Notice to vacate / termination request with effective dates.
- Move-out checkout: condition checklist, photos/docs, key return, final meter reading **values on checklist** (persisted to finance meter tables when Sprint-10 exists; until then store on checkout payload/documents only), deposit disposition **preview/checklist only**—no `security_deposits` ledger rows until Sprint-10.
- Lease termination status after checkout gates.
- Occupancy events timeline on lease and resident.
- Lease expiry and pending-action lists (expiring soon, move-in due, move-out due).
- Amendment policy: documented MVP (limited field changes vs new version)—implement minimum safe path.
- Holdover flag/behavior thin if required by BR (detect stay past end).
- Outbox events: `lease.moved_in`, `lease.renewed`, `lease.move_out_completed`, `lease.terminated`, etc.
- End-to-end acceptance with pilot operators.

### Out of scope

- Recurring invoice generation and PSP payments (Sprint-10–13).
- Full deposit refund payout rails.
- E-sign renewals.
- Arrears collections desk (later).
- Resident portal move-out self-service (later).

---

## Features

1. Move-in workspace from activated lease.
2. Renew / transfer wizard.
3. Move-out checkout workspace.
4. Termination confirmation (high-risk UX).
5. Pending actions / expiry views on leasing list or home widgets.
6. Occupancy timeline on lease detail and resident detail.
7. Asset/key status tracking (thin).
8. Event emission for downstream modules.

---

## User Stories

1. **As a Property Manager**, I can complete move-in so the Unit/Bed becomes occupied and keys are tracked.
2. **As a Property Manager**, I can renew a lease into a new term without double-booking.
3. **As a Property Manager**, I can run move-out checkout with photos and checklists so condition evidence is retained.
4. **As a Property Manager**, I see leases expiring in the next 60 days so renewals are proactive.
5. **As an Organization Administrator**, terminating a lease requires explicit confirmation and reason so mistakes are auditable.
6. **As a pilot operator**, I can execute move-in → renew → move-out on staging with accepted scripts (**M4**).
7. **As an Accountant**, I can see deposit disposition checklist outcomes even if refund execution waits for finance modules.

---

## Database Changes

| Table | Purpose |
|---|---|
| `occupancy_events` | Move-in/out and related events |
| `asset_keys` | Key/asset checkout records |
| Lease / checkout JSON or checklist tables | Move-in/out checklist including optional reading **values** (not canonical meter registry) |
| Lease columns | Links `renewed_from_lease_id`, notice dates, termination reason |
| Status history | Occupancy reflected via events + inventory status; lease enum remains contractual |

**Explicit non-owners this sprint:** `meters`, `meter_readings`, `tariffs`, `security_deposits` — canonical create in **Sprint-10**. Sprint-09 must not invent parallel money or meter schemas.

Keep Sprint-08 EXCLUDE invariants during renew/transfer.

---

## API Changes

| Method | Path | Description | AuthZ |
|---|---|---|---|
| `POST` | `.../leases/{id}/move-in` | Complete move-in | `leases.move_in` |
| `POST` | `.../leases/{id}/renew` | Create renewal draft/successor | `leases.renew` |
| `POST` | `.../leases/{id}/transfer` | Transfer allocation | `leases.transfer` |
| `POST` | `.../leases/{id}/notice` | Record notice | `leases.update` |
| `POST` | `.../leases/{id}/move-out/start` | Start checkout | `leases.move_out` |
| `PATCH` | `.../leases/{id}/move-out` | Update checklist | `leases.move_out` |
| `POST` | `.../leases/{id}/move-out/complete` | Complete checkout | `leases.move_out` |
| `POST` | `.../leases/{id}/terminate` | Terminate (`Idempotency-Key`) | `leases.terminate` |
| `GET` | `.../leases/pending-actions` | Expiry/move queues | `leases.list` |
| `GET` | `.../leases/{id}/occupancy-events` | Timeline | `leases.view` |

**Rules:** High-risk terminate/move-out complete use confirmation payloads; property scope; idempotency; 412 on stale versions; occupancy updates transactional with lease status.

---

## UI Changes

| Screen | Spec |
|---|---|
| Move-in | `ui/leasing/move-in.md` |
| Move-out checkout | `ui/leasing/move-out-checkout.md` |
| Renew/transfer | `ui/leasing/lease-renew-transfer.md` |
| Lease detail | Actions + occupancy timeline |
| Leases list | Pending-action filters |
| Home (thin) | Expiring leases / move-ins due widgets |

Separate operational completion from financial deposit release messaging (“Pending finance disposition” if ledger not ready). Mobile-friendly checklists and photo capture for move-out.

---

## Permissions

| Permission | Use |
|---|---|
| `leases.move_in` | Move-in |
| `leases.renew` / `leases.transfer` | Continuity |
| `leases.move_out` | Checkout |
| `leases.terminate` | Termination (may require step-up later) |
| `assets.keys.manage` | Key checkout |
| Property scope | All lifecycle actions |

Dual-control for deposit **release** not required until finance executes money movement.

---

## Validation Rules

1. Move-in only from activated (and not already moved-in) lease.
2. Move-in updates occupancy; availability reflects occupied.
3. Renew/transfer must satisfy Sprint-08 allocation constraints.
4. Move-out complete requires checklist mandatory items + key return status per policy.
5. Terminate requires reason; irreversible confirmation UX.
6. Cannot double move-in / double complete move-out (idempotent).
7. Holdover: if occupant remains past end without renew, flag pending action (thin).
8. Photos/docs linked via documents module; org-scoped.
9. Deposit disposition checklist items recorded; no silent “refunded” without finance permission/module.
10. Events emitted once per successful transition.

---

## Test Cases

| ID | Case | Expected |
|---|---|---|
| T09-01 | Move-in happy path | Occupancy event; status/availability updated |
| T09-02 | Move-in twice | Second rejected or idempotent |
| T09-03 | Renew without overlap | Successor lease; prior ended cleanly |
| T09-04 | Transfer to contested bed | Rejected by exclusion |
| T09-05 | Move-out complete with checklist | Docs linked; event emitted |
| T09-06 | Terminate without reason | Validation error |
| T09-07 | Pending-actions expiry window | Correct lease set |
| T09-08 | Cross-org lifecycle call | 404 |
| T09-09 | Property scope enforcement | Denied outside grant |
| T09-10 | E2E pilot script move-in→renew→move-out | Pass on staging |
| T09-11 | Worker/outbox events | Consumable payloads versioned |
| T09-12 | Isolation suite lifecycle endpoints | Pass |

---

## Acceptance Criteria

1. Pilot operator can complete **move-in, renewal, and move-out** scenarios end to end (**M4**).
2. Occupancy remains consistent through lease transitions; no double-booking on renew/transfer.
3. Move-in and move-out UIs delivered with checklists, evidence, and key tracking.
4. Pending-action / expiry views available.
5. Domain events emitted for downstream billing/notifications.
6. Deposit disposition boundaries explicit (preview/checklist vs finance execution).
7. Pilot acceptance scripts signed by named operators.
8. Deployed to staging; **M4** sign-off recorded.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Occupancy/lease status drift | Wrong availability | Single transactional updates; tests |
| Deposit law variance | Illegal move-out flow | Country freeze; checklist not auto-forfeit |
| Skipping finance stubs | Rework in Sprint-10 | Checklist “pending finance disposition”; no fake deposit ledger |
| Transfer edge cases | Overlap bugs | Reuse allocation engine + tests |
| Pilot unavailability | Weak M4 | Schedule operators in Sprint-07/08 |

---

## Dependencies

| Dependency | Type | Required |
|---|---|---|
| Sprint-08 activated leases + EXCLUDE | Hard | Yes |
| Sprint-07 documents | Hard | Yes |
| Legal move-out / deposit rules (MVP country) | Hard | Yes |
| Pilot operators for acceptance | Hard | For M4 sign-off |
| Sprint-10 | Downstream | Billing from active occupancy/terms |

---

## Deliverables

1. Lifecycle APIs + occupancy/assets migrations (no finance meter/deposit tables).
2. Move-in, renew/transfer, move-out UI.
3. Pending-actions views.
4. Outbox event contracts for lifecycle.
5. E2E pilot acceptance evidence → **M4**.
6. Runbook: failed mid-checkout recovery.
7. Backlog for finance: deposit disposition execution, final invoice.

---

## Estimated Time

| Track | Estimate |
|---|---|
| Occupancy/lifecycle domain + APIs | 3–4 days |
| Move-in / move-out / renew UI | 3–4 days |
| Events + pending views | 1 day |
| Pilot E2E + fixes | 2 days |
| **Sprint total** | **10 business days (2 weeks)** |

---

## Definition of Done

1. Acceptance criteria and **M4** sign-off complete.
2. E2E pilot scripts pass on staging.
3. Allocation invariants hold across renew/transfer tests.
4. Coding standards, CI gates, isolation tests pass.
5. No critical/high lifecycle defects open.
6. Docs updated (API lifecycle subset, event list, deposit boundary notes).
7. Independently deployable without PSP; finance stubs clearly labeled.
8. Handoff: Sprint-10 billing consumes activated + moved-in leases and terms.
