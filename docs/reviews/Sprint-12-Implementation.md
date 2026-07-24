# Sprint-12 Implementation Summary

**Sprint ID:** Sprint-12 — Reconciliation and Financial Controls  
**Implementation date:** 2026-07-24  
**Scope:** Sprint-12 only (M5 control plane). **No** Sprint-13 soak, expenses, payment plans, maintenance, notifications, portal, or owner distributions.  
**Baseline:** [Sprint-12.md](../sprints/Sprint-12.md) · [Sprint-11-Review.md](./Sprint-11-Review.md) · [Beta-Product-Review.md](./Beta-Product-Review.md) · [CODING_RULES.md](../../CODING_RULES.md) · [06-permission-system.md](../06-permission-system.md) · [04-api-specification.md](../04-api-specification.md) §16–17 · [reconciliation-tolerance.md](../finance/reconciliation-tolerance.md)

---

## Features implemented

| # | Feature | Status |
|---|---|---|
| 1 | Reconciliation runs / items, settlement ingest, resolve, complete with documented tolerance | Done |
| 2 | Aging / arrears workspace with as-of date, currency, buckets (on-read) | Done |
| 3 | Deposit disposition SoD: request → PENDING_APPROVAL → approve → execute | Done |
| 4 | Refund approve / execute SoD + ledger effects | Done |
| 5 | Payment reversal (reason + reversing allocations + ledger; original retained) | Done |
| 6 | Accounting period close / Owner-gated reopen; closed-period post rejection | Done |
| 7 | Parallel billing comparison report | Done |
| 8 | Governed finance exports (aging / payments) | Done |
| 9 | Unapplied cash ledger account `1200` (Sprint-11 O1 TD) | Done |
| 10 | Idempotency `begin` / `complete` reservation (Sprint-11 O2 TD) | Done |
| 11 | Web UI workspaces + SoD panels + nav | Done |
| 12 | Tolerance doc + daily recon runbook (+ webhook incident link) | Done |

**Beta / RC (Sprint-12 slice):** Full aging desk (B2) and deposit dual-control (B4 SoD) delivered in-product. Staging sign-off (B3), mobile (B5), a11y pack (B6) remain process/UX tracks outside this sprint file.

---

## Files created

### Docs
- `docs/reviews/Sprint-12-Implementation.md` (this file)
- `docs/finance/reconciliation-tolerance.md`
- `docs/runbooks/daily-reconciliation.md`

### Prisma
- `prisma/schema/reconciliation.prisma`
- `prisma/schema/migrations/20260731120000_sprint_12_reconciliation/migration.sql`

### Contracts
- `packages/contracts/src/reconciliation.ts`
- `packages/contracts/src/sprint-12.contracts.spec.ts`

### API (`apps/api/src/modules/reconciliation/`)
- `domain/reconciliation.rules.ts`, `domain/reconciliation.rules.spec.ts`
- `application/reconciliation.service.ts`, `aging.service.ts`, `period.service.ts`, `payment-reversal.service.ts`, `parallel-comparison.service.ts`, `finance-export.service.ts`
- `presentation/reconciliation.controller.ts`
- `reconciliation.module.ts`, `reconciliation.integration.spec.ts`

### Web
- `apps/web/src/lib/reconciliation-api.ts`
- `apps/web/src/features/finance/hooks/use-reconciliation.ts`
- `apps/web/src/features/finance/components/{reconciliation-workspace,periods-workspace,comparisons-workspace,finance-exports-workspace}.tsx`
- Routes: `app/finance/{reconciliation,periods,comparisons,exports}/page.tsx`

---

## Files modified

- `prisma/schema/payments.prisma`, `tenancy.prisma` — recon status, refund/disposition executor columns, Tenant relations
- `packages/contracts/src/permissions.ts`, `payments.ts`, `index.ts` — Sprint-12 keys / refund SoD / exports
- `apps/api/src/modules/tenancy/application/permission-catalog.ts` — seeds / role grants
- `apps/api/src/modules/billing/application/ledger.service.ts`, `domain/billing.rules.ts` — unapplied `1200`, settlement/reversal/refund journals
- `apps/api/src/infrastructure/idempotency/idempotency.service.ts` — `begin` / `complete`
- `apps/api/src/modules/payments/**` — period guard, disposition SoD, refund approve/execute, payment settlement unapplied path
- `apps/api/src/app.module.ts` — ReconciliationModule
- `packages/testing/src/integration-database.ts` — cleanup tables
- `apps/web/src/components/layouts/app-shell.tsx` — Finance nav
- `apps/web/src/features/finance/components/{arrears-list,deposits-list,payment-detail}.tsx` — aging UI + SoD panels
- `apps/web/src/features/finance/utils/permissions.ts`, `hooks/use-payments.ts`, `index.ts`
- `docs/runbooks/payment-webhook-incidents.md` — link to daily recon

---

## Database changes

Migration `20260731120000_sprint_12_reconciliation`:

| Object | Purpose |
|---|---|
| Enums | `AccountingPeriodStatus`, `ReconciliationSourceType`, `ReconciliationRunStatus`, `ReconciliationItemStatus`, `PaymentReconciliationStatus`, `PaymentReversalStatus` |
| `accounting_periods` | Period open/close flags (`period_key` YYYY-MM) |
| `reconciliation_runs` | Run header, control/matched/unmatched/variance/tolerance |
| `reconciliation_items` | Settlement lines + match/exception state |
| `payment_reversals` | Correction records linked to immutable payments |
| Alters | `refunds.executed_by_user_id`, `refunds.approved_at`; disposition executor columns; `payment_transactions.reconciliation_status` |
| Money | `DECIMAL(19,4)` + `CHAR(3)` currency; org-scoped uniques/indexes |

Backward-compatible expand; no rewrite of Sprint-10/11 settlement journals.

---

## API changes

Under `/v1/organizations/{organizationId}/`:

| Area | Endpoints |
|---|---|
| Reconciliation | `POST/GET /reconciliation-runs`, `GET …/{runId}`, `GET …/items`, `POST …/ingest-settlements`, `POST …/complete`, `POST /reconciliation-items/{id}/resolve` |
| Aging | `GET /invoice-aging`, `GET /aging` (`asOf`, `currency`, optional `propertyId`) |
| Periods | `GET/POST /accounting-periods`, `POST …/{periodKey}/close`, `POST …/reopen` |
| Refunds SoD | `POST /refunds/{id}/approve`, `POST /refunds/{id}/execute` |
| Disposition SoD | create → `PENDING_APPROVAL`; `POST …/dispositions/{id}/approve`; execute requires APPROVED + distinct actors |
| Reversals | `POST /payments/{paymentId}/reverse` |
| Parallel compare | `POST /billing-comparisons/parallel` |
| Exports | `POST /exports/finance` (`aging` \| `payments`) |

Rules: org isolation from JWT; Decimal money; SoD by `userId`; Idempotency-Key on executes; variance override needs `finance.reconciliation.approve` + reason; closed period rejects money posts.

---

## UI changes

- Finance nav: Reconciliation, Aging/Arrears (bucketed), Periods, Comparisons, Exports
- Reconciliation workspace: create run, ingest, resolve items, complete
- Arrears workspace: as-of + currency + bucket summary + account list
- Deposits: request → approve → execute (SoD messaging)
- Payment detail: refund request / approve / execute; reverse with reason; allocate unallocated
- Periods / Comparisons / Exports thin workspaces

---

## Tests added

| Suite | Coverage |
|---|---|
| `packages/contracts/src/sprint-12.contracts.spec.ts` | Zod / money / path contracts |
| `apps/api/.../reconciliation.rules.spec.ts` | T12-03 variance, T12-04 buckets, T12-05/06 SoD identity |
| `apps/api/.../reconciliation.integration.spec.ts` | Domain gates always-on; full DB T12-01..11 expand after migrate deploy |
| Existing payment unit paths | Period / unapplied / SoD wired into payments module |

Quality gates (session): `pnpm lint` · `typecheck` · `unit` (79) · `build` — pass.

---

## Remaining work

1. Apply migration `20260731120000_sprint_12_reconciliation` on staging/integration DB; expand T12-01..T12-11 DB fixtures.
2. Finance SME sign [reconciliation-tolerance.md](../finance/reconciliation-tolerance.md) for pilot.
3. Staging bill → pay → reconcile → age demo evidence (Beta B3 / M5-prep process).
4. Re-seed existing orgs for new Accountant/Owner permission keys.
5. Author `Sprint-13.md` for sustained soak / formal M5 chaos exit.
6. Soft RC: mobile labeling (B5), WCAG evidence (B6), privacy stub — outside Sprint-12 code.

---

## Known limitations

1. **Aging** is on-read aggregation (no snapshot table); fine for 30–50 rooms; snapshot strategy if portfolio grows.
2. **Period reopen** gated with Owner-only proxy (`organization.ownership.transfer`); Admin closes but does not reopen.
3. **Settlement ingest** sandbox JSON adapter; production bank-file parsers remain provider-specific later.
4. **Historical payments** before unapplied-cash O1 lack cash/unapplied symmetry (forward-only).
5. **Write-off mega-batch** not shipped (explicitly out of scope without SoD design).
6. **Sprint-13 soak** (webhook chaos, worker kills, formal M5) not claimed here.
7. Export is sync JSON/CSV metadata + rows (thin); not a durable multi-GB export pipeline.

---

## Handoff to Sprint-13

Control plane is independently deployable on billing/payments. Sprint-13 should execute repeated bill→pay→reconcile cycles, webhook chaos, worker kill/resume, and formal **M5** exit without schema rewrite.
