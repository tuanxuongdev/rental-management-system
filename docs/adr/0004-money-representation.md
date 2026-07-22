# ADR 0004: Money Representation and Rounding Policy

**Status:** Proposed (stub — Sprint-01)  
**Date:** 2026-07-22  
**Owner:** Platform engineering + finance domain  
**Review trigger:** Sprint-08+ billing implementation

## Context

Financial correctness requires deterministic decimal arithmetic. JavaScript floating point and implicit minor-unit conversions are forbidden for currency fields.

## Decision (to finalize)

- Database: `NUMERIC(19,4)` amount columns with ISO 4217 currency code columns.
- API transport: `{ amount: decimal-string, currency: ISO-4217 }`.
- Application: approved arbitrary-precision decimal library with named rounding policies per charge type.

## Alternatives considered

- Integer minor units only (acceptable only with explicit scale policy per currency — deferred detail).
- Float/double storage (forbidden).

## Consequences

- Shared money value object lives in domain layer; contracts mirror transport shape.
- All billing/payment modules must use the shared policy before merge.

## References

- [docs/03-database-design.md](../03-database-design.md)
- [docs/04-api-specification.md](../04-api-specification.md)
- [docs/09-coding-standard.md](../09-coding-standard.md)
