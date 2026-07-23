# Runbook — Inventory import jobs (Sprint-06)

## Symptoms

- Import stuck in `QUEUED` / `PROCESSING`
- Duplicate Units after retry
- Dry-run errors not downloadable

## Checks

1. Confirm worker is healthy: `GET http://localhost:3002/health` (or staging worker).
2. Inspect `outbox_events` for `inventory.import.commit` with matching `tenant_id` and `PENDING`/`FAILED`.
3. Confirm object storage: S3 configured **or** local `.data/object-storage` for non-prod.
4. Confirm actor still has `imports.inventory` and active membership.

## Retry

- Re-commit with the **same** `Idempotency-Key` and job id — apply path is upsert-by-natural-key; safe to resume.
- Do **not** create a second job for the same file unless the first is `FAILED`/`CANCELLED` and product accepts re-import.

## Stuck job

1. If outbox row is `PENDING` past SLA, restart worker and re-poll.
2. If outbox is `PROCESSED` but job status lags, inspect `import_jobs.counts` and worker logs; prefer fixing status via support SQL only with audit note.
3. Cancellation is only valid before irreversible commit boundary (document: after outbox publish, treat as resumable apply — do not cancel mid-batch without engineering).

## Isolation

Cross-org import ids must 404. Property Managers cannot apply rows outside `property_access_grants`.
