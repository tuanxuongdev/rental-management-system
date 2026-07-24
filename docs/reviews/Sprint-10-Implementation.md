# Sprint-10 Implementation Summary

**Sprint ID:** Sprint-10 — Billing Foundation  
**Implementation date:** 2026-07-24  
**Scope:** Sprint-10 only (charge schedules, billing runs, invoices/ledger, security deposits, MVP meters/utilities, Finance UI). **No** Sprint-11 PSP/payments/cash-bank depth.  
**Baseline:** [Sprint-10.md](../sprints/Sprint-10.md) · [ADR-0004](../adr/0004-money-representation.md) · [ADR-0006](../adr/0006-billing-policy.md) · [Sprint-09-Review.md](./Sprint-09-Review.md) · [Alpha-Product-Review.md](./Alpha-Product-Review.md) · [CODING_RULES.md](../../CODING_RULES.md)

---

## Features implemented

| # | Feature | Status |
|---|---|---|
| 1 | ADR-0006 billing policy (rounding, TZ periods, due dates, tax display, invoice numbering) | Done |
| 2 | Schema: schedules, charge rules, invoices/lines/history, credit notes, ledger, deposits, meters/readings/tariffs, utility runs, opening balances, balance snapshots | Done |
| 3 | Billing-run create → preview → approve → idempotent commit (advisory lock + charge keys) | Done |
| 4 | Invoice list/detail, post, void (posted lines immutable; corrections via credit notes) | Done |
| 5 | Ledger AR/Revenue balanced journals per posted invoice/credit | Done |
| 6 | Canonical `security_deposits` on lease activate + deposits list/detail APIs/UI | Done |
| 7 | Default billing schedule + RENT charge rule on activate | Done |
| 8 | MVP meters + bulk readings + equal-split utility allocation (flag `UTILITIES_ALLOCATION_ENABLED`) | Done |
| 9 | Credit note create/post path | Done |
| 10 | Late fee policy **model** (table; batch assessment thin/stretch — not full batch UI) | Schema done |
| 11 | Finance navigation + billing workspace, invoices, deposits, meters, credit notes, utilities | Done |
| 12 | Operations Center surfaces `BILLING_RUN` jobs | Done |
| 13 | Worker idempotent `billing.run.commit` handler | Done |
| 14 | Accountant role activated with finance permissions | Done |
| 15 | Home dashboard finance note points to Finance (payments remain Sprint-11) | Done |
| 16 | PSP / payment allocation | Out of scope (Sprint-11) |

---

## Files created

### Docs / ADR
- `docs/adr/0006-billing-policy.md`
- `docs/runbooks/billing-replay-retry.md`
- `docs/reviews/Sprint-10-Implementation.md` (this file)

### Prisma
- `prisma/schema/billing.prisma`
- `prisma/schema/migrations/20260729120000_sprint_10_billing/migration.sql`

### Contracts
- `packages/contracts/src/billing.ts`
- `packages/contracts/src/sprint-10.contracts.spec.ts`

### API (`apps/api/src/modules/billing/`)
- `domain/billing.rules.ts`, `domain/billing.rules.spec.ts`
- `application/ledger.service.ts`, `deposit.service.ts`, `invoice.service.ts`, `credit-note.service.ts`, `billing-run.service.ts`, `meter.service.ts`, `utility-allocation.service.ts`
- `presentation/billing-runs.controller.ts`, `invoices.controller.ts`, `deposits.controller.ts`, `meters.controller.ts`, `credit-notes.controller.ts`
- `billing.module.ts`, `billing.integration.spec.ts`

### Worker
- `apps/worker/src/handlers/billing-run.handler.ts`
- `apps/worker/src/handlers/billing-run.commit.ts`

### Web
- `apps/web/src/lib/billing-api.ts`
- `apps/web/src/features/finance/**` (hooks, components, permissions, index)
- `apps/web/src/app/(app)/app/finance/**` (billing, invoices, deposits, credit-notes, meters, utilities)

---

## Files modified

- `prisma/schema/tenancy.prisma`, `leasing.prisma`, `inventory.prisma`, `parties.prisma` — relations
- `docs/adr/README.md` — ADR-0004/0006 Accepted
- `packages/contracts/src/permissions.ts`, `index.ts`, `imports.ts` (BILLING_RUN operation kind), `leases-lifecycle.ts` (financeNote copy)
- `apps/api/src/app.module.ts` — BillingModule
- `apps/api/src/modules/leasing/leasing.module.ts`, `lease.service.ts` — deposit + schedule on activate
- `apps/api/src/modules/leasing/application/lease-lifecycle.service.ts` — finance note
- leasing integration specs — DepositService injection
- `apps/api/src/modules/tenancy/application/permission-catalog.ts` — finance/meters seeds; Accountant ACTIVE
- `apps/api/src/modules/imports/application/operations.service.ts` — billing run rows
- `apps/worker/src/outbox/outbox-consumer.service.ts` — billing commit handler
- `packages/testing/src/integration-database.ts` — billing table cleanup
- `apps/web/src/components/layouts/app-shell.tsx` — Finance nav
- `apps/web/src/features/leasing/components/home-dashboard.tsx` — Finance link

---

## Database changes

Migration `20260729120000_sprint_10_billing`:

- Enums: billing schedule/run, charge rule, invoice/credit note, ledger, deposit, meter, utility, late fee
- Tables: `service_catalog_items`, `lease_services`, `billing_schedules`, `charge_rules`, `late_fee_policies`, `billing_runs`, `invoices`, `invoice_lines`, `invoice_status_history`, `credit_notes`, `credit_note_lines`, `ledger_accounts`, `ledger_entries`, `opening_balance_entries`, `balance_snapshots`, `security_deposits`, `meters`, `meter_readings`, `tariffs`, `utility_allocation_runs`
- Money columns: `NUMERIC(19,4)` + currency `CHAR(3)`
- Unique posting keys / period uniqueness for idempotent billing
- Tenant-complete FKs where patterned

---

## API changes

Under `/v1/organizations/{organizationId}/`:

| Area | Endpoints |
|---|---|
| Billing runs | `GET/POST /billing-runs`, `GET …/{id}`, `POST …/preview`, `…/approve`, `…/commit`, `…/retry` |
| Invoices | `GET /invoices`, `GET …/{id}`, `POST …/post`, `POST …/void` |
| Credit notes | `GET/POST /credit-notes`, `POST …/{id}/post` |
| Deposits | `GET /deposits`, `GET …/{id}` |
| Ledger | `GET /ledger-entries` (and balances thin) |
| Meters | `GET/POST /meters`, `GET …/{id}`, `POST /meter-readings/bulk` |
| Utilities | `POST /utility-allocation-runs/preview`, `…/{id}/commit` |

Rules: org isolation, `@RequirePermissions`, `Idempotency-Key` on commit/post, decimal-string money, If-Match on versioned updates.

---

## UI changes

- Finance nav: Invoices, Billing run, Deposits, Credit notes, Meters, Utilities (flag-gated)
- Billing run workspace with preview/approve/commit confirmation
- Invoice list/detail with post/void
- Deposits list from lease obligations
- Thin meters grid + utility allocation screen
- Home note: billing available; payments Sprint-11

---

## Tests added

| Suite | Coverage |
|---|---|
| `packages/contracts/src/sprint-10.contracts.spec.ts` | Preview/invoice money Zod; reject floats |
| `apps/api/.../billing.rules.spec.ts` | Rounding, period keys, numbering (ADR-0006) |
| `apps/api/.../billing.integration.spec.ts` | T10-01/02/03/08/10/12 (DB-gated) |

---

## Quality gates

| Gate | Result |
|---|---|
| `pnpm lint` | Pass |
| `pnpm typecheck` | Pass |
| `pnpm unit` | Pass (see session log) |
| `pnpm build` | Pass (see session log) |
| Integration T10-* | Authored; skipped without Postgres / migration apply |

---

## Remaining work

1. Apply migration on staging/integration DB and execute T10-* + isolation finance suite.
2. Finance SME review of billing-run preview UX (acceptance criterion).
3. Staging demo dataset with posted invoices for Sprint-11 handoff.
4. Full late-fee batch assessment UI (policy table only in this sprint).
5. Optional backfill of Sprint-09 checklist meter values into `meter_readings` when meters exist.
6. Durable holdover flagging (Sprint-09 residual) — unrelated to billing.

---

## Known limitations

1. **No payment collection** — balances are visible; PSP/cash recording is Sprint-11.
2. **Deposit disposition execution** — records exist; Sprint-12 disposition/refund flows remain.
3. **Utility allocation** — MVP equal-split; advanced methods are thin/stretch behind `UTILITIES_ALLOCATION_ENABLED`.
4. **Worker commit** — API performs sync commit + outbox; worker handler is idempotent completion check / FAILED marker, not a second full generator.
5. **Proration** — ADR-0006 daily formula implemented in rules; edge occupancy windows should be expanded in soak tests.
6. **Accountant role** — activated in catalog seed; existing orgs need RBAC re-seed / role assign to pick up new permissions.
7. **Opening balances / snapshots** — tables present; import UI not built (stubs OK per Sprint-10).

---

## Alpha review items addressed (Sprint-10 slice)

| Alpha gap | Outcome |
|---|---|
| Monthly rent due / invoices | **Addressed** — billing run + posted invoices + ledger |
| Morning finance visibility | **Partial** — Finance nav + invoices; arrears desk is later |
| Deposit records | **Addressed** — canonical `security_deposits` on activate |
| Payment / arrears collection | **Deferred** — Sprint-11 / Sprint-12 |

---

## Handoff to Sprint-11

Sprint-11 can allocate payments to open invoice `balanceAmount` values and ledger AR without redesigning invoice numbering, period keys, or ledger account codes seeded as org defaults (`AR`, `REVENUE`, etc.).
