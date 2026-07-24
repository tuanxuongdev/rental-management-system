# Sprint-08 — Lease Creation and Activation

**Sprint ID:** Sprint-08  
**Roadmap alignment:** [10-development-roadmap.md](../10-development-roadmap.md) Sprint 8 · Phase 4 toward **M4**  
**Program references:** [project-roadmap.md](../project-roadmap.md) · [dependency-map.md](../dependency-map.md) · [03-database-design.md](../03-database-design.md) · [04-api-specification.md](../04-api-specification.md) · [01-business-requirements.md](../01-business-requirements.md)  
**UI references:** [ui/leasing/leases-list.md](../ui/leasing/leases-list.md) · [ui/leasing/lease-detail.md](../ui/leasing/lease-detail.md) · [ui/leasing/lease-create-wizard.md](../ui/leasing/lease-create-wizard.md) · [ui/leasing/lease-activate.md](../ui/leasing/lease-activate.md) · [ui/cross-cutting-patterns.md](../ui/cross-cutting-patterns.md)  
**Duration:** 2 weeks  
**Status:** Implemented — see [docs/reviews/Sprint-08-Implementation.md](../reviews/Sprint-08-Implementation.md)  
**Builds on:** [Sprint-05.md](./Sprint-05.md) · [Sprint-06.md](./Sprint-06.md) · [Sprint-07.md](./Sprint-07.md)

---

## Goal

Implement draft lease creation (parties, Unit/Bed/capacity allocation, term, rent, deposit, recurring charges), transactional overlap/capacity enforcement, review, and activation with audit timeline so a draft lease can be activated without double-booking a Unit or Bed.

---

## Business Value

- Core commercial capability: binding occupancy agreements enter the system of record.
- Prevents double-booking—the highest-trust failure mode for boarding houses and apartments.
- Separates contract status from physical move-in (move-in completes in Sprint-09).
- Unlocks billing schedules in Sprint-10 from activated lease terms.
- Independently deployable: activation works without payment collection or maintenance.

---

## Scope

### In scope

- Lease draft wizard: parties (primary resident + additional), allocation mode (WHOLE_UNIT / BED / CAPACITY), dates, rent, deposit amount, currency, charge schedule inputs.
- `lease_terms`, `lease_parties`, `lease_allocations`, `lease_status_history`.
- GiST `EXCLUDE` constraints for WHOLE_UNIT and BED overlap; CAPACITY mode transactional lock + recheck.
- Do-not-rent hard stop or override-with-reason (permissioned) at activation.
- Review page before activation; `If-Match` optimistic concurrency.
- Activation transition: draft → approved/signed (MVP may collapse approval/sign to activate with checklist) → activated.
- MVP lease document: generate from template **or** upload executed PDF linked via documents.
- Lease list/detail with status, property scope, search.
- Concurrency tests for contested Unit/Bed allocation.
- Domain events (outbox) for `lease.activated` for downstream billing/notifications later.
- **Money storage ADR must be approved** before rent/deposit columns: `NUMERIC(19,4)` + explicit currency. Full billing policy (due dates, invoice numbering, tax display, proration edge cases) is finalized in Sprint-10—Sprint-08 only needs storage-safe commercial fields on the lease.

### Out of scope

- Move-in checklist, renew, terminate, move-out checkout (Sprint-09).
- Invoice generation and payments (Sprint-10+).
- E-signature provider workflows (Post-GA Phase 2)—upload/manual sign-off OK.
- Payment plans, guarantor deep workflow.
- Applications pipeline (deferred).

---

## Features

1. Leases list with filters (status, property, dates, resident).
2. Create-lease stepper with final review.
3. Allocation picker respecting availability and mode.
4. Activate lease workspace with conflict explanation.
5. Lease detail: parties, allocation, terms, documents, status timeline.
6. Concurrency-safe activation API.
7. Document attach for executed lease.
8. Outbox event on activation.

---

## User Stories

1. **As a Property Manager**, I can draft a lease for a resident and Unit or Bed so terms are captured before move-in.
2. **As a Property Manager**, the system prevents me from activating a lease that overlaps an existing allocation on the same Bed/Unit.
3. **As a Property Manager**, I see a clear review of rent, deposit, dates, and parties before activation.
4. **As an Organization Administrator**, I can require acknowledgment when activating despite a do-not-rent flag (if permitted) so risk is explicit and audited.
5. **As an Accountant**, I can view activated lease commercial terms read-only for later billing setup.
6. **As a product owner**, demo shows two concurrent activation attempts where only one wins.

---

## Database Changes

| Table | Purpose |
|---|---|
| `leases` | Lease header/status |
| `lease_terms` | Rent, deposit, dates, policies |
| `lease_parties` | Parties/roles on lease |
| `lease_allocations` | Unit/Bed/capacity allocations with time ranges |
| `lease_status_history` | Status timeline |
| Raw SQL migration | `btree_gist` + `EXCLUDE` for WHOLE_UNIT/BED half-open ranges |
| Documents | Link leases via `document_links` |

**Invariants:** No overlapping active allocations per exclusion rules; capacity rechecked in transaction; amounts `NUMERIC(19,4)` + currency code.

---

## API Changes

Subset of API §13 Leases:

| Method | Path | Description | AuthZ |
|---|---|---|---|
| `GET/POST` | `.../leases` | List/create draft | `leases.list` / `leases.create` |
| `GET/PATCH` | `.../leases/{id}` | Detail/update draft | `leases.view` / `leases.update` |
| `POST` | `.../leases/{id}/allocations` | Set allocations | `leases.update` |
| `POST` | `.../leases/{id}/review` | Validation snapshot | `leases.view` |
| `POST` | `.../leases/{id}/activate` | Activate (`Idempotency-Key`, `If-Match`) | `leases.activate` |
| `GET` | `.../leases/{id}/history` | Status history | `leases.view` |
| Documents | attach to lease | `documents.*` + `leases.update` |

**Errors:** Overbooking, capacity exceeded, currency mismatch, do-not-rent block, stale version (412), lifecycle conflict.

---

## UI Changes

| Screen | Spec |
|---|---|
| Leases list / detail | `ui/leasing/leases-list.md`, `lease-detail.md` |
| Create wizard | `ui/leasing/lease-create-wizard.md` |
| Activate | `ui/leasing/lease-activate.md` |
| Navigation | Add **Leasing** |

High-risk activation confirmation per cross-cutting patterns (consequences, reason if override). Currency beside amounts. Distinguish **Lease status** vs **occupancy** (occupancy still vacant until Sprint-09 move-in).

---

## Permissions

| Permission | Use |
|---|---|
| `leases.list` / `leases.view` / `leases.create` / `leases.update` | Draft management |
| `leases.activate` | Activation (may be narrower than update) |
| `leases.override_do_not_rent` | Optional override |
| Property scope | Enforce on create/activate |
| `documents.*` | Lease file attach |

Property Manager: activate within scope; no org-wide unless granted.

---

## Validation Rules

1. Start date < end date (or open-ended policy explicit).
2. Allocation required before activate; mode matches unit configuration.
3. WHOLE_UNIT/BED overlaps rejected by DB exclusion + API message.
4. CAPACITY: sum of concurrent capacity ≤ unit capacity under lock.
5. Currency required; rent/deposit non-negative; precision rules per ADR.
6. At least one primary leaseholder party.
7. Do-not-rent on any party blocks activate unless override permission + reason.
8. Activate idempotent; duplicate requests do not create double allocations.
9. Draft editable; activated commercial terms locked or amendment-only (amendments thin—prefer lock until Sprint-09 policy).
10. Cannot activate without passing review validations.

---

## Test Cases

| ID | Case | Expected |
|---|---|---|
| T08-01 | Draft lease happy path | Saved as draft |
| T08-02 | Activate non-overlapping | Activated; history + outbox |
| T08-03 | Overlapping BED allocation | Rejected (API + DB) |
| T08-04 | Overlapping WHOLE_UNIT | Rejected |
| T08-05 | Capacity overflow | Rejected |
| T08-06 | Two concurrent activates same bed | Exactly one success |
| T08-07 | Stale If-Match activate | 412 |
| T08-08 | Do-not-rent without override | Blocked |
| T08-09 | Cross-org lease id | 404 |
| T08-10 | Property Manager out of scope | Denied |
| T08-11 | Idempotent activate replay | Same result; one allocation |
| T08-12 | Isolation suite lease endpoints | Pass |
| T08-13 | Prisma migrate + raw EXCLUDE applied | CI drift check pass |

---

## Acceptance Criteria

1. A draft lease can be reviewed and activated without double-booking a Unit or Bed (**Sprint 8 demo**).
2. GiST exclusion (and capacity locking) enforced with concurrency tests.
3. Lease list/detail/wizard/activate UI delivered per specs.
4. Money stored per ADR (`NUMERIC(19,4)` + currency).
5. Do-not-rent gate works at activation.
6. `lease.activated` outbox event emitted.
7. Lease document attach/upload path works for MVP.
8. Deployed to staging; money/TZ ADR approved before coding rent fields.
9. Sprint-09 can extend lifecycle without breaking allocations.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Missing EXCLUDE / app-only checks | Double-booking | Raw SQL + concurrency tests |
| ADR money/TZ late | Wrong billing later | Hard dependency before sprint mid-point |
| Collapsing sign/approve unsafely | Legal risk | Explicit MVP checklist; legal template track |
| Activating = move-in confusion | Ops errors | UI copy; occupancy unchanged until Sprint-09 |
| Capacity mode race | Over-capacity | Transactional lock + recheck tests |

---

## Dependencies

| Dependency | Type | Required |
|---|---|---|
| Sprint-05/06 inventory | Hard | Yes |
| Sprint-07 residents + docs | Hard | Yes |
| Money storage + property/org timezone ADR | Hard | Yes (storage + display TZ). Invoice numbering/tax/due-date policy → Sprint-10 |
| Lease template / legal workflow | Soft→Hard | For document generate path |
| btree_gist on Postgres | Hard | Yes |
| Sprint-09 | Downstream | Lifecycle / M4 |

---

## Deliverables

1. Lease schema + GiST/capacity migrations.
2. Lease APIs including activate.
3. Leasing UI (list, detail, wizard, activate).
4. Concurrency and isolation test packs.
5. Outbox `lease.activated` contract.
6. ADR compliance evidence for money fields.
7. Staging demo: activate + failed overlap attempt.

---

## Estimated Time

| Track | Estimate |
|---|---|
| Schema + EXCLUDE/capacity | 3 days |
| Lease domain + activate API | 3 days |
| Wizard/activate UI | 2–3 days |
| Concurrency/isolation tests | 1–2 days |
| **Sprint total** | **10 business days (2 weeks)** |

Named senior owns allocation correctness.

---

## Definition of Done

1. Acceptance criteria met; overlap demo recorded.
2. DB constraints + API tests prove no double-book under concurrency.
3. CI includes migrate drift check for EXCLUDE.
4. Coding standards, reviews, gates pass.
5. No critical/high leasing defects open.
6. Independently deployable without payments/maintenance.
7. Handoff: Sprint-09 move-in/renew/move-out consumes activated leases and events.
