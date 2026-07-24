# Local Run Report

**Report ID:** RPM-LOCAL-RUN-01  
**Date:** 2026-07-24  
**Operator:** Senior Full Stack Engineer (agent session)  
**Mode:** Hybrid local (Docker deps + `pnpm` apps)  
**Guide:** [local-development.md](./local-development.md)

---

## Verdict

**Application started successfully.** Health, database readiness, authentication, Organization create, and demo seeds were verified.

---

## Services started

| Service | How started | Status |
|---|---|---|
| PostgreSQL 16 | `pnpm docker:deps` → Compose `postgres` | Healthy (`localhost:5433`) |
| Redis 7 | `pnpm docker:deps` → Compose `redis` | Running (`localhost:6379`) |
| MinIO | `pnpm docker:deps` → Compose `minio` + `minio-init` | Running (`:9000` / console `:9001`); bucket `rpm-dev` |
| API (`@rpm/api`) | `pnpm dev:api` | Running |
| Worker (`@rpm/worker`) | `pnpm dev:worker` | Running |
| Web (`@rpm/web`) | `pnpm dev:web` | Running |

Migrations: **15/15 applied** (`pnpm db:status` → up to date).

---

## URLs

| Surface | URL |
|---|---|
| Web app | http://localhost:3000 |
| Login | http://localhost:3000/login |
| Org onboarding | http://localhost:3000/onboarding/organization |
| Staff app shell | http://localhost:3000/app |
| Status page | http://localhost:3000/status |
| API base | http://localhost:3001 |
| API health | http://localhost:3001/health |
| API ready | http://localhost:3001/ready |
| Worker health | http://localhost:3002/health |
| Worker ready | http://localhost:3002/ready |
| MinIO API | http://localhost:9000 |
| MinIO console | http://localhost:9001 |

---

## Default accounts

| Role | Email | Password | Notes |
|---|---|---|---|
| Local bootstrap owner | `owner@localhost.dev` | `LocalDevPassword123!` | Created by `pnpm seed:local-bootstrap` |

**Organization created this run**

| Field | Value |
|---|---|
| Display name | Local Demo Properties |
| Slug | `local-demo` |
| Organization ID | `61935601-bc79-40db-9443-17a0735d5fd2` |

After browser login, if JWT has no org yet, open `/onboarding/organization` or re-login after org exists (session org attach). API create-org in this run returned a new org-scoped access token.

---

## Seed data

| Seed | Command | Result |
|---|---|---|
| Bootstrap user | `pnpm seed:local-bootstrap` | User present (`1b00ff54-e00f-4111-8a00-0cd99e54f2f2`) |
| Demo portfolio | `DEMO_ORGANIZATION_ID=61935601-… pnpm seed:demo-portfolio` | Properties `DEMO-APT`, `DEMO-BH`; units `101`, `SR-1` |
| Demo residents | `pnpm seed:demo-residents` | Resident + sample document metadata |
| RBAC catalog | API boot (`RbacSeedService`) | Seeded on API start |

Verified via API: `GET /v1/organizations/{orgId}/properties` → **2** items (`DEMO-APT`, `DEMO-BH`).

---

## Verification results

| Check | Result |
|---|---|
| `pnpm health:check` | API + worker health/ready **OK** |
| `GET /ready` DB | `checks.database: ok`, `configuration: ok`, `redis: skipped` |
| Web `/` and `/login` | HTTP **200** |
| `POST /v1/auth/login` | **200** + `accessToken` (org initially `null`) |
| `POST /v1/organizations` | **200** + org + org-scoped token |
| Properties list after seed | **2** demo properties |

---

## Startup issues fixed

| Issue | Fix |
|---|---|
| `EADDRINUSE` on `:3001` / `:3002` | Killed leftover Nest/node watchers from prior sessions before restart |
| `prisma generate` `EPERM` renaming `query_engine-windows.dll.node` | Stopped processes locking the Prisma engine DLL, then regenerated |
| Failed lease migration historically (`tstzrange` IMMUTABLE) | Already fixed earlier to `tsrange`; DB reset/migrate clean this session |
| `PermissionsGuard` DI boot failure (`type`-only Reflector imports) | Already fixed earlier; API boots cleanly now |
| Auth/org seed scripting on Windows (`/tmp` paths) | Used `.data/tmp/*.json` under the repo |

---

## Remaining issues

| Item | Severity | Notes |
|---|---|---|
| Redis readiness always `skipped` | Low | Expected current behavior even when `REDIS_URL` is set |
| Document object bytes may be absent locally | Low | Demo resident seed notes re-upload via UI for download demos |
| Windows Prisma DLL lock while apps run | Medium (DX) | Avoid `pnpm prisma:generate` while API/worker hold the engine; stop apps first |
| No public self-signup | Info | Local entry = bootstrap seed + login |
| Redis/MinIO not required for core login path | Info | Hybrid stack still runs them for storage/queue parity |

---

## How to stop / restart

```bash
# Stop app processes in their terminals (Ctrl+C), or kill listeners on 3000–3002

pnpm docker:down:all   # optional: wipe volumes (destructive)
pnpm docker:deps
pnpm db:migrate
pnpm seed:local-bootstrap
pnpm dev:api
pnpm dev:worker
pnpm dev:web
```

---

## Summary

Local stack is **up**: Postgres/Redis/MinIO + API + worker + web. Login works with `owner@localhost.dev` / `LocalDevPassword123!`. Demo Organization `local-demo` has seeded apartment + boarding inventory and a sample resident.
