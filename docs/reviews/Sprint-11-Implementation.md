# Sprint-11 Implementation Summary

**Sprint ID:** Sprint-11 — Payments, Receipts, Collection Desk  
**Implementation date:** 2026-07-24  
**Scope:** Sprint-11 staff-only exit + Beta thin unblockers (arrears list, deposit disposition execute). **No** Sprint-12 reconciliation workspace, aging bucket materialization, or dual-control approve.  
**Baseline:** [Sprint-11.md](../sprints/Sprint-11.md) · [Beta-Product-Review.md](./Beta-Product-Review.md) · [Sprint-10-Review.md](./Sprint-10-Review.md) · [Sprint-10-Implementation.md](./Sprint-10-Implementation.md) · [ADR-0004](../adr/0004-money-representation.md) · [ADR-0006](../adr/0006-billing-policy.md) · [CODING_RULES.md](../../CODING_RULES.md)

---

## Beta blockers resolved

| Beta ID | Blocker | Sprint-11 outcome |
|---|---|---|
| **B1** | No payment recording / allocation | **Resolved** — staff cash/bank (and offline channels) record + allocate to open invoices; ledger Dr cash/bank Cr AR; invoice `balanceAmount` / `PARTIALLY_PAID` / `PAID` |
| **B2** | No arrears / aging desk | **Thin resolved** — unpaid `POSTED` / `PARTIALLY_PAID` invoices ordered by `dueDate` (`GET /arrears` + Finance → Arrears UI). Full aging buckets remain Sprint-12 |
| **B3** | Staging + human M4/M5-prep sign-off | **Not resolved** — process/evidence gate; outside code delivery |
| **B4** | Deposit settlement not executable | **Thin resolved** — disposition create + execute (single-actor MVP); dual-control approve remains Sprint-12 |
| **B5** | Mobile unsupported for field ops | **Not resolved** — soft RC label / later UX track |
| **B6** | A11y / WCAG evidence absent | **Not resolved** — soft for closed Beta |

**Also delivered for money trust:** receipts (`RCP-{YYYY}-{seq}`), finance dashboard widgets (outstanding, unpaid count, collected period, deposits held), sandbox PSP intents + HMAC webhooks, refund **PENDING** request only.

**Portal pay:** **DEFERRED** — no resident↔user linkage assumed; staff collection satisfies Sprint-11 exit.

---

## Features implemented

| # | Feature | Status |
|---|---|---|
| 1 | Manual payment record (CASH / BANK_TRANSFER / QR / CHECK / OTHER) with optional inline allocations | Done |
| 2 | Payment list / detail; allocate remaining unallocated amount | Done |
| 3 | Receipt issue + `GET /receipts/{id}` | Done |
| 4 | Ledger settlement journals (cash `1000` / bank `1010` ↔ AR `1100`) | Done |
| 5 | Sandbox payment intents + checkout URL adapter | Done |
| 6 | Provider webhook HMAC fail-closed + `externalEventId` idempotency | Done |
| 7 | Refund create as **PENDING** only (approve/execute Sprint-12) | Done |
| 8 | Thin arrears list by due date | Done |
| 9 | Thin deposit disposition create + execute | Done |
| 10 | Finance dashboard summary widgets | Done |
| 11 | Finance UI: payments, record form, detail, arrears, dashboard; invoice “Record payment”; deposit disposition actions | Done |
| 12 | Permissions: `finance.payments.list|view|record|allocate`, refund request, deposit disposition keys; Accountant/Owner/Admin seeds | Done |
| 13 | Webhook incident runbook | Done |
| 14 | Resident portal self-pay | Deferred (documented) |
| 15 | Reconciliation workspace / aging materialization | Out of scope (Sprint-12) |

---

## Files created

### Docs
- `docs/reviews/Sprint-11-Implementation.md` (this file)
- `docs/runbooks/payment-webhook-incidents.md`

### Prisma
- `prisma/schema/payments.prisma`
- `prisma/schema/migrations/20260730120000_sprint_11_payments/migration.sql`

### Contracts
- `packages/contracts/src/payments.ts`
- `packages/contracts/src/sprint-11.contracts.spec.ts`

### API (`apps/api/src/modules/payments/`)
- `domain/payment.rules.ts`, `domain/payment.rules.spec.ts`
- `application/payment.service.ts`, `receipt.service.ts`, `refund.service.ts`, `payment-intent.service.ts`, `webhook.service.ts`, `arrears.service.ts`, `finance-dashboard.service.ts`, `deposit-disposition.service.ts`
- `infrastructure/sandbox.adapter.ts`
- `presentation/payments.controller.ts`, `provider-webhooks.controller.ts`
- `payments.module.ts`, `payments.integration.spec.ts`

### Web
- `apps/web/src/lib/payments-api.ts`
- `apps/web/src/features/finance/hooks/use-payments.ts`
- `apps/web/src/features/finance/components/{payments-list,payment-record-form,payment-detail,arrears-list,finance-dashboard}.tsx`
- `apps/web/src/app/(app)/app/finance/{page,arrears/page,payments/page,payments/new/page,payments/[paymentId]/page}.tsx`

---

## Files modified (high level)

- `prisma/schema/tenancy.prisma`, `billing.prisma` — payment / disposition relations
- `packages/contracts/src/permissions.ts`, `index.ts` — payment permission keys + exports
- `apps/api/src/modules/billing/domain/billing.rules.ts` — cash/bank account codes
- `apps/api/src/modules/billing/application/ledger.service.ts` — `postPaymentSettlementJournal`, `postDepositDispositionJournal`
- `apps/api/src/modules/tenancy/application/permission-catalog.ts` — Sprint-11 seeds / role grants
- `apps/api/src/app.module.ts` — `PaymentsModule`
- `packages/testing/src/integration-database.ts` — payment table cleanup
- `apps/web/src/components/layouts/app-shell.tsx` — Payments / Arrears nav
- `apps/web/src/features/finance/components/{invoice-detail,deposits-list}.tsx` — record payment + disposition UI
- `apps/web/src/features/finance/utils/permissions.ts`, `index.ts`
- `apps/web/src/app/(app)/app/page.tsx` / home dashboard — finance widgets linkage as applicable

---

## Database changes

Migration `20260730120000_sprint_11_payments`:

- Enums: `PaymentChannel`, `PaymentIntentStatus`, `PaymentTransactionStatus`, `RefundStatus`, `WebhookProcessingStatus`, `DepositDispositionType`, `DepositDispositionStatus`
- Tables: `payment_intents`, `payment_transactions`, `payment_allocations`, `refunds`, `provider_webhook_events`, `payment_receipts`, `security_deposit_disposition_lines`
- Money: `DECIMAL(19,4)` + `CHAR(3)` currency; tenant-scoped FKs / indexes; unique webhook `external_event_id` (provider + event)
- Backward compatible expand: billing/invoice/deposit tables unchanged except new child relations

---

## API changes

Under `/v1/organizations/{organizationId}/` (unless noted):

| Area | Endpoints |
|---|---|
| Payments | `GET /payments`, `GET /payments/{paymentId}`, `POST /payments` (manual record, `Idempotency-Key`) |
| Allocations | `POST /payment-transactions/{id}/allocations` |
| Intents | `POST /payment-intents` |
| Refunds | `POST /refunds` → status `PENDING` |
| Receipts | `GET /receipts/{receiptId}` |
| Arrears | `GET /arrears` |
| Finance dashboard | `GET /dashboard/finance` |
| Deposit disposition | `POST /deposits/{depositId}/dispositions`, `POST /dispositions/{dispositionId}/execute` |
| Provider webhooks | `POST /v1/provider/webhooks/{provider}` (HMAC; no org JWT) |

Rules preserved: org isolation from session JWT (no `X-Tenant-ID`), decimal-string money, posted payment immutability, no PAN storage, webhook fail-closed.

---

## UI changes

- Finance home → dashboard widgets (outstanding, unpaid count, collected, deposits held)
- Nav: **Payments**, **Arrears** (alongside Sprint-10 Finance items)
- Payments list / new record / detail (allocations + receipt link)
- Invoice detail → **Record payment**
- Deposits list → create disposition lines + execute
- Portal pay UI not shipped

---

## Tests added

| Suite | Coverage |
|---|---|
| `packages/contracts/src/sprint-11.contracts.spec.ts` | Payment/arrears/disposition Zod; money string rejection |
| `apps/api/.../payment.rules.spec.ts` | Allocation / channel helpers |
| `apps/api/.../payments.integration.spec.ts` | T11-05 offline cash + ledger/receipt; T11-07 partial allocation; T11-02 duplicate webhook; T11-04 invalid HMAC; T11-09 cross-org 404; deposit execute reduces held (DB-gated) |

---

## Quality gates

| Gate | Result |
|---|---|
| `pnpm lint` | Pass |
| `pnpm typecheck` | Pass |
| `pnpm unit` | Pass — 18 files / 72 tests (includes `sprint-11.contracts` + `payment.rules`) |
| `pnpm build` | Pass — Finance routes include `/app/finance/payments`, `/arrears`, dashboard |
| Integration T11-* | Authored; require `pnpm prisma migrate deploy` + Postgres |

---

## Remaining Release Candidate blockers

| ID | Remaining item | Owner / track |
|---|---|---|
| **B3** | Staging landlord demo + human M4/M5-prep sign-off | Process / pilot ops |
| **B5** | Mobile field-ops support (or explicit desk-only RC labeling) | UX / Sprint later |
| **B6** | WCAG evidence pack | UX / compliance |
| Sprint-12 | Aging buckets, bank reconciliation workspace, dual-control refund/deposit approve | Product |
| Ops | Apply Sprint-11 migration on staging; seed Accountant permissions on existing orgs; run T11-* + isolation | Engineering |
| Trust | Privacy stub policy for closed Beta PII classes | Process |
| Stretch | Resident portal pay after invitation acceptance + resident↔user linkage | Post–Sprint-12 / pilot prep |
| Soft | Transfer/notice wizards, combobox pickers, Playwright smoke, maintenance MVP | Roadmap (not money-critical) |

**RC readiness after this sprint:** money **day-2 collection path exists in-product** (B1/B2-thin/B4-thin). Overall RC remains **No-Go** until B3 staging sign-off and remaining soft/hard gates above are cleared or formally waived.

---

## Known limitations

1. **Portal pay deferred** — staff-only collection exit.
2. **Deposit SoD** — execute without separate approver (Sprint-12 dual-control).
3. **Refunds** — request/PENDING only; no execute/PSP reverse in Sprint-11.
4. **Arrears** — open-invoice list by due date; not aging buckets / chase workflows.
5. **PSP** — sandbox provider + HMAC secret env (`PAYMENTS_WEBHOOK_SECRET`); no production KYC.
6. **Accountant permissions** — catalog seeds updated; existing orgs may need RBAC re-seed / role refresh.
7. **Webhook clock skew** — 5-minute timestamp window; see runbook for replay incidents.

---

## Handoff to Sprint-12

Sprint-12 can build reconciliation and aging on settled `payment_transactions` / allocations and ledger cash/bank postings without redesigning payment numbering, receipt sequences, or AR settlement journals. Deposit disposition lines already support draft→executed; add approve gate + SoD before partner production.
