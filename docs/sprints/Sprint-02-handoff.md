# Sprint-02 Handoff Notes

**From:** Sprint-01 — Repository and Delivery Foundation  
**To:** Sprint-02 — Prisma, staging, and persistence workflow  
**Status:** Handoff checklist (not Sprint-01 code)

## Sprint-01 foundation ready for consumption

- Monorepo boundaries enforced (`pnpm boundaries`, ESLint rules)
- API health/meta endpoints with correlation ID + trace ID headers
- Problem Details error envelope stub
- Organization header rejection guard (`X-Tenant-ID`, `X-Organization-ID` → 400)
- Worker HTTP health on port 3002
- Web `/status` vertical slice
- CI: lint, typecheck, unit, SCA, secrets, container scan (api/web/worker)
- Deploy-dev Compose smoke on `main`
- ADR stubs: cookie topology, outbox, Prisma/raw SQL, money

## Sprint-02 must deliver

1. **Prisma migration workflow** — first reviewed migrations; expand/contract process documented in runbooks
2. **Staging environment** — beyond CI-runner Compose; M1 exit includes staging restore rehearsal
3. **Outbox schema + relay skeleton** — per ADR-0002
4. **Integration test harness** — real PostgreSQL in CI for repository tests
5. **OpenAPI baseline** — full pagination/idempotency stubs per API spec
6. **Readiness hardening** — optional soft checks for Postgres/Redis when wired

## Known Sprint-01 deferrals (intentional)

- No authentication, Organizations, or RBAC (Sprint-03+)
- No business domain modules
- No OpenTelemetry exporter/backend (trace ID header + structured logs only)
- No cloud registry push in deploy-dev (Compose smoke on CI runner)
- M0 formal sign-off artifact (process, not code)

## Owners to confirm at Sprint-02 planning

| Decision | ADR | Suggested owner |
|---|---|---|
| Cookie topology | 0001 | Platform + security |
| Outbox implementation | 0002 | Backend platform |
| Prisma/raw SQL policy | 0003 | Backend + DBA |
| Money library selection | 0004 | Backend + finance domain |
