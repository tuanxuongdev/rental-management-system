# Daily reconciliation runbook

**Audience:** Accountant / Organization Owner  
**Related:** [reconciliation-tolerance.md](../finance/reconciliation-tolerance.md) · [payment-webhook-incidents.md](./payment-webhook-incidents.md)

## Daily checklist

1. Confirm prior-day payments settled (cash desk + sandbox/provider webhooks). See [payment-webhook-incidents.md](./payment-webhook-incidents.md) if events are stuck.
2. Open **Finance → Reconciliation** and create a run for the business day (`PROVIDER` or `CASH_UP`), currency required.
3. Ingest settlement lines (sandbox JSON: `externalReference`, `amount`, `currency`, `transactionDate`).
4. Confirm suggested matches; resolve unmatched with reason (`MATCH` / `EXCEPTION_ACCEPTED` / dispute).
5. Complete the run. If variance exceeds [tolerance](../finance/reconciliation-tolerance.md), a different approver must supply `overrideReason`.
6. Review **Arrears / Aging** as-of today for collection follow-up.
7. Close the accounting period only after unmatched items are resolved or accepted (Owner/Admin).

## Exception SLA

- Unmatched items should not remain `UNMATCHED` across period close.
- Document override reasons; never force-complete silently.
