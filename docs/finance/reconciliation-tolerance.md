# Reconciliation tolerance

**Status:** Normative for Sprint-12 reconciliation completion  
**Default:** `0.0100` major currency units (DECIMAL(19,4))

## Rule

A reconciliation run may complete without override when:

\[
|\mathrm{varianceAmount}| \le \mathrm{toleranceAmount}
\]

`varianceAmount` is computed from control total vs matched total (or sum of unmatched when control is absent).

## Defaults

| Currency style | Recommended default | Notes |
|---|---|---|
| Major unit (USD, EUR, …) | `0.0100` | One cent |
| VND-style (no minor unit in ops) | `1.0000` | Org setting override |

Platform code default is **`0.0100`**. Organizations may override per run via `toleranceAmount` or a future org setting.

## Force-complete over tolerance

Requires:

1. Permission `finance.reconciliation.approve`
2. Non-empty `overrideReason` (≥ 3 characters)
3. Approver `userId` ≠ preparer `userId` (separation of duties)

Without both permission and reason, the API rejects with `RECONCILIATION_VARIANCE_EXCEEDED` / approve-required codes.
