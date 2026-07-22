# Backup and Restore Runbook (Skeleton)

**Status:** Sprint-02 skeleton  
**Owner:** Platform engineering

## Scope

Non-production restore rehearsal for managed PostgreSQL. Production RPO/RTO targets are defined in program roadmap documents.

## Preconditions

- Managed Postgres backup enabled (snapshots or PITR).
- Staging credentials stored in approved secret manager.
- Application version pinned to migration set under test.

## Restore rehearsal procedure

1. **Record baseline** — note source environment, backup ID, operator, date (UTC).
2. **Provision restore target** — new database instance or restored snapshot.
3. **Apply migrations** — `pnpm prisma:migrate:deploy` against restored DB.
4. **Smoke test**
   - `GET /health` → 200
   - `GET /ready` → 200 with `checks.database: ok`
   - `GET /v1/meta/version` → build metadata
5. **Verify platform tables** — `outbox_events`, `processed_messages`, `scheduled_jobs`, `idempotency_keys` present.
6. **Record outcome** — success/failure, duration, anomalies.

## Evidence template

See [restore-rehearsal-record.md](./restore-rehearsal-record.md).

## Post-restore

- Rotate credentials if rehearsal used production-derived snapshots.
- Tear down temporary restore environments.
