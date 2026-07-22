# Sprint-01 Demo Checklist

**Sprint:** Sprint-01 — Repository and Delivery Foundation  
**Audience:** Engineering lead, product owner, on-call engineer

## Pre-demo setup

- [ ] Clone repository and run `cp .env.example .env`
- [ ] `pnpm install && pnpm prisma:generate && pnpm build`
- [ ] Start Postgres/Redis: `docker compose -f infrastructure/docker/docker-compose.yml up postgres redis -d`
- [ ] Start apps: `pnpm dev:api`, `pnpm dev:web`, `pnpm dev:worker` (or full stack via Compose)

## Live demo script

1. **Monorepo health**
   - [ ] Show workspace layout (`apps/*`, `packages/*`, `prisma/`, `docs/adr/`)
   - [ ] Run `pnpm lint && pnpm typecheck && pnpm unit`

2. **API liveness/readiness**
   - [ ] `curl http://localhost:3001/health` → 200, no secrets in body
   - [ ] `curl http://localhost:3001/ready` → 200 when configured
   - [ ] `curl http://localhost:3001/v1/meta/version` → SemVer + git SHA

3. **Traced web → API vertical slice**
   - [ ] Open `http://localhost:3000/status`
   - [ ] Confirm version and ping load successfully
   - [ ] Note matching request/correlation ID in UI
   - [ ] Show API structured log line containing the same correlation ID

4. **Worker health**
   - [ ] `curl http://localhost:3002/health` → worker JSON health

5. **CI/CD proof (development)**
   - [ ] Show GitHub Actions `CI` workflow (lint, typecheck, unit, sca, secrets, containers)
   - [ ] Show `Deploy Development` workflow smoke steps on `main` push

## Acceptance sign-off

- [ ] Acceptance criteria in [Sprint-01.md](./Sprint-01.md) demonstrated
- [ ] No business domain endpoints beyond meta/health
- [ ] Handoff notes captured for Sprint-02 (Prisma migrations, staging, outbox)
