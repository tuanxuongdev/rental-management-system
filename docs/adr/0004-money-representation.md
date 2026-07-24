# ADR 0004: Money Representation and Rounding Policy

**Status:** Accepted  
**Date:** 2026-07-24  
**Owner:** Platform engineering + finance domain  
**Review trigger:** Sprint-08 lease commercial fields; billing modules (Sprint-10+) must comply

## Context

Financial correctness requires deterministic decimal arithmetic. JavaScript floating point and implicit minor-unit conversions are forbidden for currency fields. Sprint-08 stores rent and deposit on lease terms before full billing policy (due dates, invoice numbering, tax display, proration) lands in Sprint-10.

## Decision

1. **Database:** Amount columns use `NUMERIC(19,4)` (`@db.Decimal(19, 4)` in Prisma). Every monetary amount is paired with an explicit ISO 4217 currency code column (`CHAR(3)`), never inferred only from locale.
2. **API transport:** Money is `{ amount: string, currency: string }` where `amount` is a decimal string (no float/number), matching `^\d+(\.\d{1,4})?$` (or signed where refunds apply later). Shared Zod helpers live in `@rpm/contracts`.
3. **Application:** Convert with Prisma `Decimal` / string round-trip only. Do not use JS `number` for currency math. Named rounding policies per charge type are finalized with billing (Sprint-10); Sprint-08 stores exact entered scale up to 4 fractional digits without inventing invoice rounding.
4. **Currency consistency:** Lease header currency must match term rent/deposit currency and Property default currency unless an explicit future multi-currency ADR supersedes this. Activation rejects mismatch (`CURRENCY_MISMATCH`).
5. **Timezone display:** Property `timeZone` is authoritative for operator-facing lease date display; storage of allocation ranges uses timestamptz half-open `[effective_from, effective_to)`.

## Alternatives considered

| Option | Why rejected / deferred |
|---|---|
| Integer minor units only | Acceptable later with explicit per-currency scale policy; not required for Sprint-08 storage |
| Float/double storage | Forbidden — rounding and equality hazards |
| Currency inferred from locale | Forbidden — silent wrong-currency risk |

## Consequences

- Lease `rent_amount` / `deposit_amount` and future invoice/payment amounts must use this ADR.
- Contracts expose decimal strings; UI shows currency beside amounts.
- Sprint-10 billing ADRs may refine rounding/naming without changing storage type or transport shape.

## References

- [docs/03-database-design.md](../03-database-design.md)
- [docs/04-api-specification.md](../04-api-specification.md)
- [docs/09-coding-standard.md](../09-coding-standard.md)
- [docs/sprints/Sprint-08.md](../sprints/Sprint-08.md)
