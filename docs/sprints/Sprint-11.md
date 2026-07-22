# Sprint-11 — Payments and Receipts

**Sprint ID:** Sprint-11  
**Roadmap alignment:** [10-development-roadmap.md](../10-development-roadmap.md) Sprint 11 · Phase 5 toward **M5**  
**Program references:** [project-roadmap.md](../project-roadmap.md) · [dependency-map.md](../dependency-map.md) · [03-database-design.md](../03-database-design.md) · [04-api-specification.md](../04-api-specification.md) · [05-authentication.md](../05-authentication.md)  
**UI references:** [ui/finance/payments-list.md](../ui/finance/payments-list.md) · [ui/finance/payment-detail.md](../ui/finance/payment-detail.md) · [ui/finance/payment-record-cash-bank.md](../ui/finance/payment-record-cash-bank.md) · [ui/finance/invoice-detail.md](../ui/finance/invoice-detail.md) · [ui/resident-portal/portal-payments.md](../ui/resident-portal/portal-payments.md) · [ui/resident-portal/portal-invoices.md](../ui/resident-portal/portal-invoices.md) · [ui/cross-cutting-patterns.md](../ui/cross-cutting-patterns.md)  
**Duration:** 2 weeks  
**Status:** Ready for planning  
**Builds on:** [Sprint-10.md](./Sprint-10.md)

---

## Goal

Integrate the selected payment provider (tokenized/hosted methods), implement payment intents, webhook verification, idempotent ledger updates, receipts, refund boundaries, failure states, and manual cash/bank recording with separation-of-duties controls so supported online and offline payments update the ledger and issue receipts exactly once.

---

## Business Value

- Enables actual collection—core SaaS revenue operations for customers.
- Supports regional reality: cash, bank transfer, QR/wallet via PSP—not card-PAN vaulting.
- Prevents duplicate posts under webhook retries and operator double-submit.
- Independently deployable on billing balances; full settlement reconciliation completes in Sprint-12.

---

## Scope

### In scope

- PSP sandbox integration: hosted/tokenized checkout; **no PAN storage**.
- `payment_intents`, `payment_transactions`, `payment_allocations`, `refunds`.
- `provider_webhook_events` with HMAC verification, timestamp window, replay cache.
- Idempotent application of payments to invoices/balances; explicit unallocated credit.
- Receipt generation (PDF or printable statement) with stable references.
- Offline/manual payment recording: cash, bank transfer, evidence upload, duplicate-reference warnings.
- Operator payment list/detail; allocate/unallocate within rules.
- Refund request boundary (execute may require dual-control—minimum: record + pending approval state).
- **Resident portal pay:** default **staff-only** for this sprint. Portal invoices/payments are **stretch** only if resident↔user linkage and resident invitation acceptance already exist; otherwise document deferral to post–Sprint-12 / pilot prep (roadmap resident portal is pilot-phase). Do not block Sprint-11 exit on portal.
- Provider sandbox chaos: timeout, duplicate webhook, out-of-order, failure.
- Failure states visible in UI and Operations Center.

### Out of scope

- Full reconciliation workspace and aging (Sprint-12).
- Financial soak marathon (Sprint-13; not in this sprint file pack yet).
- Payment plans automation (Phase 2).
- Expenses module.
- Card vaulting / merchant-of-record complexity beyond selected PSP.
- Owner payouts.
- Full resident portal IA (home, maintenance, documents)—payments-only stretch at most.

---

## Features

1. Create payment intent against invoice/account balance.
2. Webhook handler → confirm transaction → allocate → receipt.
3. Cash/bank record payment form with evidence.
4. Payments list/detail with method, status, allocations, receipt link.
5. Refund request / pending state (SoD-ready).
6. Duplicate external reference detection.
7. Portal pay CTA — **stretch only** (see Scope).
8. Idempotency across API, worker, and webhook paths.

---

## User Stories

1. **As a Resident** (stretch) / **As an operator collecting on behalf of a resident**, an open invoice can be paid through the hosted payment flow so the balance updates once.
2. **As an Accountant**, I can record a cash payment with evidence so offline collection is auditable.
3. **As an Accountant**, a duplicated provider webhook does not double-post the payment.
4. **As a Property Manager** (if granted), I can record bank transfer payments within my property scope.
5. **As an Accountant**, I see unallocated credit explicitly when amount exceeds selected invoices.
6. **As a security engineer**, webhook signatures fail closed; unsigned events are rejected.
7. **As a product owner**, demo shows online + offline payment each producing one receipt and correct ledger effect.

---

## Database Changes

| Table | Purpose |
|---|---|
| `payment_intents` | Initiation / PSP reference |
| `payment_transactions` | Confirmed money movements |
| `payment_allocations` | Application to invoices/charges |
| `refunds` | Refund records + status |
| `provider_webhook_events` | Raw/normalized webhook log + processing state |
| Receipt artifacts | Document links or receipt table |
| Ledger | Additional entries for payments/refunds/credits |

**Constraints:** Unique provider event ids; unique logical payment keys; org-scoped FKs; amounts `NUMERIC(19,4)`.

---

## API Changes

Subset of API §17 Payments + §25 provider callbacks + portal §26 as applicable:

| Method | Path | Description | AuthZ |
|---|---|---|---|
| `POST` | `.../payment-intents` | Start online payment | `finance.payments.create` / `self.payments.create` |
| `GET` | `.../payments` | List | `finance.payments.read` |
| `GET` | `.../payments/{id}` | Detail | `finance.payments.read` |
| `POST` | `.../payments` | Record offline payment | `finance.payments.record_offline` |
| `POST` | `.../payments/{id}/allocations` | Allocate | `finance.payments.allocate` |
| `POST` | `.../refunds` | Request refund | `finance.refunds.request` |
| `POST` | `/v1/provider/webhooks/{provider}` | Webhook intake | Signature auth |
| `GET` | `.../payments/{id}/receipt` | Receipt URL | read permission |
| Portal | self invoices/payments | Resident self scope | Server-side self only |

**Rules:** Idempotency keys; webhook HMAC-SHA256 + timestamp; never trust client-reported “paid”; path org == token.

---

## UI Changes

| Screen | Spec |
|---|---|
| Payments list/detail | `ui/finance/payments-list.md`, `payment-detail.md` |
| Record cash/bank | `ui/finance/payment-record-cash-bank.md` |
| Invoice detail | Pay / record payment actions |
| Portal payments/invoices | Stretch only; otherwise staff invoice “Pay” / record payment |
| Operations Center | Webhook processing / payment jobs |

Currency beside amounts; separate received vs accounting dates; duplicate warnings; no delete of posted payments—reversal/refund only.

---

## Permissions

| Permission | Use |
|---|---|
| `finance.payments.read/create/record_offline/allocate` | Staff payments |
| `finance.refunds.request` | Refund request |
| `finance.refunds.approve/execute` | May be Sprint-12 dual-control |
| `self.payments.*` | Resident portal |
| Property scope | Offline recording limits |

SoD: recorder of cash should not silently approve own large refund (enforce when approve ships).

---

## Validation Rules

1. Payment currency must match invoice/account currency unless FX policy exists (MVP: match only).
2. Allocation sum ≤ payment amount; remainder = unallocated credit.
3. Over-allocation rejected.
4. Webhook signature/timestamp invalid → 401/403; no ledger write.
5. Duplicate provider event id → prior result, no double ledger.
6. Offline payment requires method, amount, received date, and reference rules per method.
7. Evidence upload failure preserves draft (cash form).
8. Refund cannot exceed refundable captured amount.
9. Posted payments immutable; corrections via reversal/refund flows.
10. Resident self APIs ignore client-supplied resident ids for authorization.

---

## Test Cases

| ID | Case | Expected |
|---|---|---|
| T11-01 | Hosted pay success webhook | One transaction; allocated; receipt |
| T11-02 | Duplicate webhook | Idempotent; one ledger effect |
| T11-03 | Out-of-order webhooks | Terminal state correct |
| T11-04 | Invalid HMAC | Rejected |
| T11-05 | Offline cash record | Ledger + receipt; audited |
| T11-06 | Duplicate bank reference warning | Warn / block per policy |
| T11-07 | Partial allocation + credit | Balances correct |
| T11-08 | Refund request | Pending state; no silent full execute if SoD |
| T11-09 | Cross-org payment id | 404 |
| T11-10 | Portal pay as other resident | Denied |
| T11-11 | Provider timeout then success | Single post |
| T11-12 | Isolation suite payments | Pass |

---

## Acceptance Criteria

1. Supported online and offline payments update the ledger and issue receipts **exactly once** (**Sprint 11 demo**).
2. Webhook verification, replay, and failure paths exercised in sandbox.
3. Cash/bank recording with evidence and SoD-ready controls delivered.
4. Payment list/detail and invoice payment actions complete.
5. No PAN/card data stored in application databases.
6. Resident portal pay path is **stretch**; staff-only collection path is the Sprint-11 exit requirement (document deferral if portal not shipped).
7. Deployed to staging with PSP **sandbox** credentials; production KYC tracked as external dependency for later pilots.
8. Sprint-12 can reconcile provider settlements to `payment_transactions`.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Portal without resident user link | Blocked or insecure self APIs | Default staff-only; require linkage before stretch |
| PSP KYC/prod credentials late | Blocks prod pilots not this sandbox sprint | Sandbox AC; KYC weekly tracking |
| Double-pay on retries | Financial corruption | Idempotency across all paths |
| Weak webhook auth | Fraudulent posts | HMAC + replay cache + fail closed |
| Cash without evidence | Audit gaps | Required fields + permissions |
| Portal scope bugs | Cross-resident leak | Self-scope server tests |

---

## Dependencies

| Dependency | Type | Required |
|---|---|---|
| Sprint-10 invoices/ledger | Hard | Yes |
| PSP sandbox account + docs | Hard | Yes |
| PSP KYC for production | External | Not blocking sandbox demo |
| Resident user linkage + resident invite | Soft | Required only for portal stretch |
| S3 for evidence/receipts | Hard | Yes |
| Sprint-12 | Downstream | Reconciliation |

---

## Deliverables

1. Payment/refund/webhook schema and services.
2. PSP adapter (sandbox) + webhook endpoint.
3. Staff payment UIs + offline recording.
4. Receipt generation.
5. Portal payment MVP (**stretch**) or written deferral in deliverables.
6. Chaos test evidence (duplicate/out-of-order/fail).
7. Payment incident runbook draft.

---

## Estimated Time

| Track | Estimate |
|---|---|
| PSP adapter + webhooks + idempotency | 4 days |
| Offline payments + allocations | 2 days |
| Staff UI + receipts | 2 days |
| Portal pay MVP (stretch) | 0–2 days |
| Chaos tests + staging | 1–2 days |
| **Sprint total** | **10 business days (2 weeks)** |
| **Capacity note** | Portal must not consume payment idempotency/webhook contingency buffer |

---

## Definition of Done

1. Acceptance criteria met; exactly-once demo recorded.
2. Webhook and idempotency tests pass in CI/staging.
3. Coding standards, reviews, isolation tests pass.
4. No critical/high payment defects open.
5. Runbooks updated for webhook incidents.
6. Independently deployable with sandbox PSP; prod keys gated.
7. Handoff: Sprint-12 reconciliation against settlements and aging.
