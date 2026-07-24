# Billing run replay and failed-item retry

**Scope:** Sprint-10 billing foundation  
**Audience:** Operators and on-call engineers

## Identity

- Billing run id is durable in `billing_runs`.
- Period uniqueness: `(tenant_id, period_key, schedule_id)`.
- Charge posting key: `(tenant_id, lease_id, period_key, charge_key)` via invoice line uniqueness + ledger `posting_key`.
- Commit holds PostgreSQL advisory lock `billing:{tenantId}:{periodKey}` for the transaction.

## Happy path

1. Create run (`POST /billing-runs`) with `periodKey` `YYYY-MM`.
2. Preview (`POST …/preview`) — read-only charge projection; updates run `preview_payload` / status `PREVIEWED` only.
3. Approve (`POST …/approve`).
4. Commit (`POST …/commit` + `Idempotency-Key`) — creates/posts invoices + ledger; status `COMPLETED`; emits `billing.run.commit` outbox event.
5. Operations Center lists `BILLING_RUN` rows for visibility.

## Re-commit / duplicates

- Replaying the same Idempotency-Key returns the prior response.
- Re-committing an already `COMPLETED` run for the same period/charge keys must not create duplicate posted lines (skip existing posting keys).
- Concurrent commits: advisory lock + unique constraints; loser receives conflict.

## Failed / partial runs

1. Inspect `billing_runs.failure_summary` and Operations Center status.
2. Fix underlying data (lease terms, currency, party).
3. `POST …/retry` with `retryFailedOnly: true` when safe — successful items remain; only failed leases re-attempt.
4. Do not delete posted invoices; use credit notes for corrections.

## Worker

Outbox consumer handles `billing.run.commit` idempotently: if status is already `COMPLETED`, no-op. Prefer API commit path for generation; worker ensures at-least-once completion signaling.

## Rollback posture

Posted finance is append-only. Reverse via credit note / void policies — never destructive line edits.
