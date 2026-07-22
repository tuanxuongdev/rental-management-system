# Deployment Runbook (Skeleton)

**Status:** Sprint-02 skeleton  
**Owner:** Platform engineering

## Environments

| Environment | Workflow | Notes |
|---|---|---|
| Development | `.github/workflows/deploy-dev.yml` | Compose smoke on `main` |
| Staging | `.github/workflows/deploy-staging.yml` | Parity checklist below |

## Pre-deploy checklist

- [ ] CI green (`quality`, `unit`, `integration`, `sca`, `secrets`, `containers`)
- [ ] `pnpm prisma:migrate:status` shows no pending migrations
- [ ] `.env` / secret values updated for target environment
- [ ] Container images built from intended git SHA

## Deploy steps (automated)

1. Build images (`api`, `web`, `worker`)
2. Start Postgres + Redis
3. `pnpm prisma:migrate:deploy`
4. Roll out application containers
5. Smoke: `/health`, `/ready`, `/v1/meta/version`, `/v1/meta/pagination-example`

## Staging parity checklist

- Managed PostgreSQL + Redis + S3-compatible bucket configured
- Secrets in vault (not repository)
- Observability: structured logs with correlation ID
- Same empty vertical slice as development (no business modules)

## Rollback

- Redeploy previous known-good image tag/SHA.
- Do not revert applied migrations without platform lead approval.
