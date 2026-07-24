# Local Development Guide

**Audience:** engineers running the monorepo on a laptop  
**Scope:** local Docker dependencies + Node processes (or optional Compose app profile)  
**Out of scope:** cloud deploy, managed staging, production secrets

Canonical companion docs: [README.md](../README.md) · [prisma/README.md](../prisma/README.md) · [runbooks/migration.md](./runbooks/migration.md)

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | **20.11+** | LTS; matches `engines` in root `package.json` |
| **pnpm** | **9.15.0** (or 9.x) | `corepack enable` then `corepack prepare pnpm@9.15.0 --activate` |
| **Docker Desktop** (or Docker Engine + Compose v2) | Recent | Required for Postgres / Redis / MinIO |
| **Git** | Any recent | Clone + hooks |

Optional:

- IDE with TypeScript 5.7+
- `curl` or a browser for health checks

Ports used by default:

| Service | Host port |
|---|---:|
| Web (Next.js) | 3000 |
| API | 3001 |
| Worker health | 3002 |
| Postgres | **5433** → container 5432 |
| Redis | 6379 |
| MinIO API | 9000 |
| MinIO console | 9001 |

---

## Installation

```bash
git clone <your-fork-or-remote> rental-property-management
cd rental-property-management

corepack enable
corepack prepare pnpm@9.15.0 --activate

cp .env.example .env
pnpm setup:local
```

`pnpm setup:local` runs `pnpm install`, `prisma generate`, and builds `@rpm/contracts` + `@rpm/ui` (required before Nest/Next watch modes).

---

## Environment variables

Copy [`.env.example`](../.env.example) → `.env` at the **repo root**. Nest apps also load `../../.env` when started from `apps/*`.

| Variable | Purpose | Local default |
|---|---|---|
| `DATABASE_URL` | Prisma + API + worker | `postgresql://rpm:rpm@localhost:5433/rpm?schema=public` |
| `API_HOST` / `API_PORT` | API bind | `0.0.0.0` / `3001` |
| `WORKER_HEALTH_*` | Worker HTTP health | `3002` |
| `NEXT_PUBLIC_API_BASE_URL` | Browser → API | `http://localhost:3001` |
| `WEB_ORIGIN` | CORS allowlist | `http://localhost:3000` |
| `REDIS_URL` | Optional Redis | `redis://localhost:6379` (readiness still reports `skipped`) |
| `S3_*` | MinIO / S3 | MinIO on `:9000` (`local-dev` / `local-dev-secret`) |
| `JWT_SECRET` / `TOKEN_HASH_PEPPER` | Auth crypto | Dev placeholders (min lengths enforced) |
| `PAYMENTS_WEBHOOK_SECRET` | Sandbox webhook HMAC | `local-dev-webhook-secret` |
| `PAYMENTS_WEBHOOK_ALLOW_DEFAULT_SECRET` | Fail-open webhook | **`false`** |
| `LOCAL_BOOTSTRAP_EMAIL` / `PASSWORD` | Seed login | See seed section |
| `DEMO_ORGANIZATION_ID` | Demo portfolio seed | UUID of your org |

**File storage**

- With `S3_*` set and MinIO running → objects go to bucket `rpm-dev`.
- If any required `S3_*` value is missing → API writes under `.data/object-storage/` (gitignored).

Never commit `.env`. Rotate secrets before sharing a machine image.

---

## First-time setup

Recommended **hybrid** mode: Docker for data stores, `pnpm` for apps.

```bash
# 1) Env + packages (see Installation)
cp .env.example .env
pnpm setup:local

# 2) Start Postgres, Redis, MinIO (+ create bucket)
pnpm docker:deps

# 3) Apply all Prisma migrations
pnpm db:migrate
pnpm db:status

# 4) Bootstrap a local login user
pnpm seed:local-bootstrap

# 5) Start API (RBAC permission catalog seeds on boot), worker, web
pnpm dev:api      # terminal 1
pnpm dev:worker   # terminal 2
pnpm dev:web      # terminal 3

# Or all three:
# pnpm dev
```

Then:

1. Open [http://localhost:3000/login](http://localhost:3000/login)
2. Sign in with bootstrap credentials (below)
3. Create an Organization at `/onboarding/organization` (RBAC already seeded by API boot)
4. Optional demo data:

```bash
DEMO_ORGANIZATION_ID=<your-org-uuid> pnpm seed:demo-portfolio
pnpm seed:demo-residents
```

Verify health:

```bash
pnpm health:check
# or
curl -s http://localhost:3001/health
curl -s http://localhost:3001/ready
curl -s http://localhost:3002/health
```

Expected API liveness: HTTP 200 JSON with `status: "ok"`.  
Expected readiness: `checks.configuration` and `checks.database` = `ok` (Redis may be `skipped`).

---

## Database migration

Migrations live under `prisma/schema/migrations/` and are **forward-only**.

```bash
# Apply pending migrations (local + CI path)
pnpm db:migrate
# alias: pnpm prisma:migrate:deploy

pnpm db:status
pnpm prisma:validate
pnpm prisma:generate
```

Destructive local reset (wipes Compose volumes):

```bash
pnpm db:reset:local
pnpm seed:local-bootstrap
```

Do **not** edit applied migration SQL. See [runbooks/migration.md](./runbooks/migration.md).

---

## Seed command

| Command | What it does |
|---|---|
| `pnpm seed:local-bootstrap` | Idempotent verified user for login |
| `DEMO_ORGANIZATION_ID=… pnpm seed:demo-portfolio` | Demo apartment + boarding inventory |
| `pnpm seed:demo-residents` | Demo resident (+ sample doc metadata); needs existing org + user |
| `pnpm seed:demo` | Portfolio then residents (portfolio still needs `DEMO_ORGANIZATION_ID`) |
| `pnpm seed:scale-inventory` | Large inventory for scale tests (env-driven) |

### Bootstrap credentials (defaults)

| Field | Value |
|---|---|
| Email | `owner@localhost.dev` |
| Password | `LocalDevPassword123!` |

Override with `LOCAL_BOOTSTRAP_EMAIL` / `LOCAL_BOOTSTRAP_PASSWORD` (≥ 12 chars).

There is **no public self-signup** in the web app; bootstrap seed is the supported local entry path.

---

## Run frontend

```bash
pnpm setup:local   # once, or after pulling UI/contracts changes
pnpm dev:web
```

- URL: [http://localhost:3000](http://localhost:3000)
- Status page: [http://localhost:3000/status](http://localhost:3000/status)
- Requires API at `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:3001`)

Production-mode local build (optional):

```bash
pnpm --filter @rpm/web build
pnpm --filter @rpm/web start
```

---

## Run backend

```bash
pnpm prisma:generate
pnpm --filter @rpm/contracts build
pnpm docker:deps
pnpm db:migrate
pnpm dev:api
```

| Endpoint | Purpose |
|---|---|
| `GET http://localhost:3001/health` | Liveness |
| `GET http://localhost:3001/ready` | Config + Postgres readiness |
| `http://localhost:3001/v1/...` | Versioned API |

Notes:

- Access tokens stay in memory on the web client; refresh uses HttpOnly cookie (`credentials: include`).
- `X-Tenant-ID` / `X-Organization-ID` are rejected.
- On boot, API seeds the RBAC permission catalog unless `RBAC_SEED_ON_BOOT=false`.

---

## Run worker

```bash
pnpm docker:deps
pnpm db:migrate
pnpm --filter @rpm/contracts build
pnpm dev:worker
```

| Endpoint | Purpose |
|---|---|
| `GET http://localhost:3002/health` | Worker liveness |
| `GET http://localhost:3002/ready` | Worker readiness |

The worker polls the transactional outbox (inventory import commit, etc.). Keep it running when testing async import/billing jobs.

---

## Docker Compose modes

Compose file: [`infrastructure/docker/docker-compose.yml`](../infrastructure/docker/docker-compose.yml)

### Dependencies only (default)

```bash
pnpm docker:deps
# equivalent:
# docker compose -f infrastructure/docker/docker-compose.yml up -d
```

Starts: `postgres`, `redis`, `minio`, `minio-init` (creates `rpm-dev` bucket).

### Full stack containers (`apps` profile)

```bash
pnpm db:migrate          # from host against localhost:5433 first
pnpm docker:up           # builds api + worker + web
pnpm docker:ps
pnpm docker:down
```

Container networking uses `postgres:5432`, `redis:6379`, `minio:9000` (overridden in Compose `environment`).

Stop and wipe volumes:

```bash
pnpm docker:down:all
```

---

## Build configuration

```bash
# Full monorepo build (includes prisma generate)
pnpm build

# Package-level
pnpm --filter @rpm/contracts build
pnpm --filter @rpm/api build
pnpm --filter @rpm/worker build
pnpm --filter @rpm/web build
```

Docker images:

- `infrastructure/docker/Dockerfile.api`
- `infrastructure/docker/Dockerfile.worker`
- `infrastructure/docker/Dockerfile.web` (starts via `node …/next`, not pnpm)

Context exclusions: [`.dockerignore`](../.dockerignore).

---

## Health check endpoint

| Process | Liveness | Readiness |
|---|---|---|
| API | `GET /health` | `GET /ready` |
| Worker | `GET /health` | `GET /ready` |

Convenience:

```bash
pnpm health:check
```

Script: [`tooling/scripts/local-health-check.mjs`](../tooling/scripts/local-health-check.mjs).

---

## Troubleshooting

### `DATABASE_URL` / migrate fails / `ready.database: failed`

1. Confirm Compose Postgres: `pnpm docker:ps` / `docker ps | grep rpm-postgres`
2. Host URL must use port **5433**, not 5432
3. Re-copy `.env.example` → `.env`
4. `pnpm db:migrate` then restart API

### Port already in use

Change host mappings in Compose or stop the conflicting process. API/web ports can be changed via `.env` (`API_PORT`, Next `--port`).

### `Invalid API configuration` / JWT length errors

`JWT_SECRET` must be ≥ 32 characters; `TOKEN_HASH_PEPPER` ≥ 16. Use the values from `.env.example`.

### Web cannot reach API / CORS errors

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`
- `WEB_ORIGIN=http://localhost:3000`
- Restart API after changing `WEB_ORIGIN`

### Document upload / MinIO errors

1. `pnpm docker:deps` and ensure `rpm-minio` is up  
2. Confirm `S3_*` matches MinIO root user/secret (`local-dev` / `local-dev-secret`)  
3. Or **comment out** `S3_*` in `.env` to force local disk fallback under `.data/object-storage/`

### Payment webhook signature failures

Set `PAYMENTS_WEBHOOK_SECRET` and keep `PAYMENTS_WEBHOOK_ALLOW_DEFAULT_SECRET=false`. See [runbooks/payment-webhook-incidents.md](./runbooks/payment-webhook-incidents.md).

### Prisma Client out of date after pull

```bash
pnpm prisma:generate
```

### Nest / Next cannot resolve `@rpm/contracts` or `@rpm/ui`

```bash
pnpm setup:local
```

### Login works but no permissions / empty org

1. Ensure API started at least once (RBAC seed on boot)  
2. Complete `/onboarding/organization`  
3. Re-login or organization-switch so the JWT carries `org_id`

### Integration tests skip

Tests use `describe.skipIf(!databaseAvailable)` against `localhost:5433`. Start `pnpm docker:deps` first, then `pnpm integration`.

### Windows path / Docker file sharing

Ensure the repo directory is shared with Docker Desktop. Run Compose commands from the repo root.

### `functions in index expression must be marked IMMUTABLE` (lease EXCLUDE)

Lease allocation overlap constraints use `tsrange` on `TIMESTAMP` columns. If you still have a **failed** `20260727120000_sprint_08_leases` row from an older `tstzrange` script:

```bash
pnpm db:reset:local
pnpm seed:local-bootstrap
```

Do not hand-edit a successfully applied migration in shared environments; forward-fix with a new migration instead.

---

## Useful script index

| Script | Purpose |
|---|---|
| `pnpm setup:local` | Install + generate + build contracts/ui |
| `pnpm docker:deps` | Postgres + Redis + MinIO |
| `pnpm docker:up` / `docker:down` | Optional full Compose apps profile |
| `pnpm db:migrate` / `db:status` | Prisma migrate deploy / status |
| `pnpm seed:local-bootstrap` | Local login user |
| `pnpm dev` / `dev:api` / `dev:web` / `dev:worker` | Watch mode |
| `pnpm health:check` | Probe health/ready |
| `pnpm build` | Full build including `prisma:generate` |
