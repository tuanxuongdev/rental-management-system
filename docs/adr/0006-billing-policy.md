# ADR 0006: Billing Period, Rounding, Due Dates, Tax Display, and Invoice Numbering

**Status:** Accepted  
**Date:** 2026-07-24  
**Owner:** Platform engineering + finance domain  
**Review trigger:** Sprint-10 billing foundation; Sprint-11 payment allocation must not change these rules without a superseding ADR

## Context

ADR-0004 fixed storage (`NUMERIC(19,4)`) and transport (decimal string + ISO currency). Sprint-10 requires deterministic charge generation: period boundaries, rounding, due dates, tax **display** (not statutory filing), and invoice numbering.

## Decision

1. **Rounding:** Half-up to 4 fractional digits using decimal arithmetic (`Prisma.Decimal` / equivalent). Never JS `number`. Line totals = `round(qty * unitPrice, 4)`; invoice totals = sum of rounded line totals (no second-pass silent reallocation across currencies).
2. **Timezone / periods:** Billing period is calendar-month in the **Property** `timeZone` (fallback Organization `timeZone`). Period key format `YYYY-MM` in that zone. Charge windows are half-open `[periodStart, periodEnd)` as UTC timestamptz derived from the property zone.
3. **Due date:** Default `invoiceDate + 5 calendar days` in the property zone (configurable later via schedule). Stored as `DATE` (calendar date, not timestamptz).
4. **Tax display:** Optional tax amount/rate fields are **informational display only**. No filing engine, no jurisdiction matrix. Tax lines must share invoice currency.
5. **Invoice numbering:** Monotonic per Organization: `INV-{YYYY}-{seq}` where `seq` is a zero-padded per-tenant counter stored on `tenant_settings` key `finance.invoice_sequence` (or dedicated counter row). Numbers assigned at **post**, immutable thereafter.
6. **Credit notes:** `CN-{YYYY}-{seq}` same counter family with separate sequence key `finance.credit_note_sequence`.
7. **Idempotent posting key:** Unique `(tenant_id, lease_id, period_key, charge_key)` prevents duplicate rent lines across retries.
8. **Proration:** Daily rent = `monthlyRent / daysInBillingMonth` (property zone calendar), then `round(daily * occupiedDays, 4)`. Leap days included in `daysInBillingMonth`.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Banker's rounding | Less familiar to small landlords; half-up is explicit |
| Org-only timezone | Property portfolios span zones; Property TZ is authoritative |
| Invoice number = UUID | Not operator-friendly; ADR prefers human-readable monotonic |

## Consequences

- Billing runs must lock `(tenant_id, schedule_id|org, period_key)` for commit duration.
- Posted invoice lines are immutable; corrections use credit notes / reversals.
- Sprint-11 allocates payments against open invoice balances without redesigning numbering or period keys.

## References

- [0004-money-representation.md](./0004-money-representation.md)
- [docs/sprints/Sprint-10.md](../sprints/Sprint-10.md)
- [docs/03-database-design.md](../03-database-design.md)
