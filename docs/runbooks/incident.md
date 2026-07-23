# Incident Response Runbook (Skeleton)

**Status:** Sprint-02 skeleton  
**Owner:** Platform / on-call engineering

## 1. Triage

1. Confirm scope: API, worker, web, database, or deploy pipeline.
2. Check `/health` and `/ready` on API (`database` check must be `ok`).
3. Collect `X-Request-ID` / `requestId` from failing client responses.
4. Search structured API logs for `correlationId` / `traceId`.

## 2. Severity guide

| Severity | Example | Initial response |
|---|---|---|
| SEV-1 | Production outage, data loss risk | Page on-call lead immediately |
| SEV-2 | Staging/dev deploy broken, elevated errors | Fix within business day |
| SEV-3 | Non-blocking defect | Backlog with owner |

## 3. Common checks

- Postgres connectivity (`/ready` → `checks.database`)
- Pending `outbox_events` backlog (worker consuming?)
- Recent migration deploy (`pnpm prisma:migrate:status`)
- Secret/config drift between environments

## 4. Escalation

Document incident timeline, impact, root cause, and follow-up actions in the team incident tracker.

## 5. Access administration (membership / session)

For revoke membership, force re-login, and invitation revoke steps, see [access-admin.md](./access-admin.md).
