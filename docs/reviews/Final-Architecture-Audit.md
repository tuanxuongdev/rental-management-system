# Final Architecture Audit

**Audit ID:** RPM-ARCH-FINAL-01  
**Audit date:** 2026-07-24  
**Auditor role:** Principal Software Architect  
**Scope:** Full repository architecture through **Sprint-12** Conditional Go (pre–Sprint-13 soak; SemVer `0.0.0`)  
**Normative baselines:** [`CODING_RULES.md`](../../CODING_RULES.md) · [`AGENTS.md`](../../AGENTS.md) · [`docs/02-system-architecture.md`](../02-system-architecture.md) · [`docs/08-folder-structure.md`](../08-folder-structure.md) · [`docs/09-coding-standard.md`](../09-coding-standard.md) · [`docs/03-database-design.md`](../03-database-design.md) · [`docs/04-api-specification.md`](../04-api-specification.md) · [`docs/05-authentication.md`](../05-authentication.md) · [`docs/06-permission-system.md`](../06-permission-system.md) · ADRs 0001–0006 · prior reviews (Mid-Project, Alpha/Beta/RC, Sprint 01–12)  
**Method:** Docs-as-truth + codebase evidence. **No code changes.**

---

## 1. Executive verdict

The codebase implements a **credible, production-oriented modular monolith**: Nest domain modules, Next.js feature modules, Zod `@rpm/contracts`, Prisma split schemas, org-scoped JWT isolation, transactional outbox co-commit, and Decimal money transport. That foundation correctly carries inventory → leasing → billing → payments → reconciliation without premature microservices.

It does **not** fully implement the Clean Architecture contract written in `CODING_RULES.md` §4.3. Domain folders import Nest and Prisma; application services own persistence directly; the sample `TenantScopedRepositoryBase` is unused; payments↔reconciliation uses `forwardRef`; Redis/queue/cache containers remain aspirational; worker event catalog is thin; several doc modules (maintenance, communications, reporting, utilities-as-module) are absent or absorbed.

**Architecture Score: 7.2 / 10**  
**Go / No-Go (architecture as Production / public-RC foundation): No-Go** until soak/evidence, period-control completeness, and documented layering debt are closed or formally waived.  
**Conditional Go** to continue v1.0 closed-pilot engineering and plan **v1.1** hardening (see §9–§10).

---

## 2. Architecture Score

| Dimension | Score | Weight | Notes |
|---|---:|---:|---|
| Clean Architecture boundaries | **5.5 / 10** | High | Controllers mostly thin; domain impure; repos deferred |
| Module coupling / dependency direction | **6.5 / 10** | High | Exports used well; Prisma cross-reads + finance `forwardRef` |
| Domain model consistency | **8.0 / 10** | High | Org/Resident/Lease/Unit/Bed vocabulary held |
| Database design | **7.5 / 10** | High | Split schema, Decimal(19,4), EXCLUDE; composite FK coverage uneven |
| API design | **7.5 / 10** | Medium | `/v1` org paths, problem+json, idempotency; OpenAPI gap |
| Security architecture | **7.5 / 10** | High | JWT org scope, RBAC deny-by-default, webhook HMAC; rate-limit/in-memory |
| Multi-tenant isolation | **8.5 / 10** | High | Header forbid + path 404 + tenant filters; no repo base enforcement |
| Scalability | **6.0 / 10** | Medium | Pilot-fit; Redis/queue not real; worker partial; aging on-read |
| Maintainability | **7.0 / 10** | Medium | Clear modules + contracts; duplication worker/API; impure domain |
| Documentation consistency | **6.0 / 10** | Medium | Rich norms; README/`02` lag; OpenAPI/ADR-0001 status drift |

**Architecture Score (weighted): 7.2 / 10**

Mid-Project (through Sprint-05) scored Architecture **7.5**. Delta ≈ **−0.3**: finance surface growth exposed layering/coupling debt that inventory-era audits under-weighted, partially offset by ADR-0005, money ADRs, and stronger module exports.

---

## 3. Clean Architecture boundaries

### Target (normative)

```text
presentation → application → domain
infrastructure → application/domain ports
domain → no NestJS, Prisma, Redis, S3, or HTTP
```

### Observed

| Rule | Verdict | Evidence |
|---|---|---|
| Thin controllers | **Mostly Pass** | Domain controllers call application services |
| Controllers free of Prisma | **Fail (1)** | `tenancy/presentation/organizations.controller.ts` injects `PrismaService` |
| Application owns transactions | **Pass (pragmatic)** | Services + `$transaction` / advisory locks |
| Domain free of Nest/Prisma | **Fail (systematic)** | `lease.rules.ts`, `billing.rules.ts`, `payment.rules.ts`, `reconciliation.rules.ts` import `@nestjs/common` + `@prisma/client` |
| Infrastructure repositories | **Fail (deferred)** | `TenantScopedRepositoryBase` + sample only; production Prisma in application |
| Ports / commands folders | **Absent** | Flat `*.service.ts` + `*.rules.ts` instead of documented shape |
| Contracts purity | **Pass** | `packages/contracts` = Zod only |

**Judgment:** Hexagonal purity is **aspirational**. The running architecture is a **modular Nest service layer** with partial “domain rules” files. Acceptable for early product velocity; **not** claimable as Clean Architecture complete.

---

## 4. Module coupling & dependency direction

### Module inventory (`apps/api`)

**Wired:** identity, tenancy (+ rbac), inventory, parties, imports, residents, billing, payments, reconciliation, leasing, documents, meta, health, auth, prisma, observability.

**Not implemented as Nest modules (docs still list):** maintenance, communications, reporting; utilities absorbed into billing.

### Coupling quality

| Pattern | Assessment |
|---|---|
| Feature modules import `RbacModule` / `AuditModule` / Prisma / Outbox | **Good** shared kernel |
| Cross-module via **exported** application services (e.g. `DepositService`, `LedgerService`, `PeriodService`) | **Good** |
| Domain money helpers shared across billing → payments → reconciliation | **Fragile** — shared kernel should live in contracts or a finance kernel package |
| Direct `prisma.invoice` / `prisma.lease` from peer modules | **Weak** — bypasses module API |
| `PaymentsModule` → `forwardRef(ReconciliationModule)` | **Anti-pattern** vs “no circular deps” guidance |
| Deep relative imports (no per-module `index.ts` façades) | **Maintainability drag** |
| App↛app imports | **Pass** (`pnpm boundaries`) |

### Frontend

Feature domains under `apps/web/src/features/*` (admin, imports, inventory, documents, finance, leasing, parties, residents, platform) align with backend vocabulary. Thin App Router pages + TanStack Query + in-memory auth store match ADR-0005 / coding rules. Residual: some API clients in `lib/*-api.ts` vs feature `api/` co-location (documented adapter).

### Worker

Separate deployable; must not import `apps/api`. **Inventory import commit logic is duplicated** between API processor and worker handler. Billing-run worker path is largely acknowledge/lock visibility; most outbox event types are durable no-ops. Outbox is a **reliability hook**, not a complete async domain bus.

---

## 5. Domain model consistency

| Concept | Consistency |
|---|---|
| Organization (UI) / `Tenant` + `tenantId` (DB) | **Consistent** |
| Resident (not renter-as-tenant API) | **Consistent** |
| Property → Unit → optional Bed; no Room | **Consistent** |
| Property Owner ≠ Organization Owner / login | **Consistent** |
| Lease + allocations + EXCLUDE ranges | **Consistent** |
| Security deposits as first-class finance objects | **Consistent** (post S10+) |
| Utilities as first-class module | **Absorbed** into billing (doc drift) |
| Maintenance / communications / reporting domains | **Documentation-only** |

Domain language in schema and HTTP paths is a **program strength**. Persona copy that still says “rooms” in some review narratives must not leak into APIs (currently guarded).

---

## 6. Database design

| Check | Verdict |
|---|---|
| Split Prisma schemas by domain | **Pass** (implemented set; not full doc list) |
| Money as `Decimal(19,4)` + string transport (ADR-0004) | **Pass** |
| Soft-delete + partial uniques (inventory) | **Pass** (post early reviews) |
| GiST EXCLUDE on lease allocations | **Pass** (raw-sql → ordered migration; ADR-0003) |
| Composite `(tenantId, …)` FKs | **Partial** — leasing hardened; broader inventory historically open |
| Outbox + idempotency tables | **Pass** |
| Period / recon / aging persistence | **Pass** (S12 schema) |
| Maintenance / communications / reporting tables | **Absent** (roadmap) |
| Migration immutability discipline | **Pass** observed |

**Risk:** New money queries without mandatory tenant-scoped repository discipline rely on reviewer vigilance.

---

## 7. API design

| Check | Verdict |
|---|---|
| Global prefix `/v1`; org paths `/organizations/:organizationId/…` | **Pass** |
| RFC 9457 `problem+json` central filter | **Pass** |
| Cursor pagination contracts | **Pass** |
| `Idempotency-Key` + begin/complete on high-risk money | **Partial** (S12 O3 residual on some payment paths) |
| `If-Match` / version concurrency | **Pass** on critical leasing/billing paths |
| Webhooks public + HMAC + raw body | **Pass** (post S11 review fixes) |
| OpenAPI 3.1 published from Nest/contracts | **Fail** — Zod is source of truth; no published OpenAPI tree |
| Doc base URL `/api/v1` vs code `/v1` | **Drift** |
| Portal / maintenance surfaces in `04` | **Ahead of code** (honest roadmap, dishonest if read as shipped) |

---

## 8. Security architecture & multi-tenant isolation

### Strengths

- Access JWT org-scoped (`org_id` / membership / session claims); path org mismatch → **404** non-disclosure.
- `OrganizationHeaderGuard` rejects `X-Tenant-ID` / `X-Organization-ID`.
- Deny-by-default `PermissionsGuard` on org routes; property scope helpers.
- Refresh: HttpOnly cookie path; access token **in-memory** on web (no localStorage persistence found).
- Webhook HMAC fail-closed; no PAN storage; sandbox PSP adapter.
- Audit + outbox patterns on money/lease mutations.
- Identity SoD on refunds/deposit dispositions (application-level).

### Weaknesses

- Isolation enforced **per method**, not via mandatory tenant repositories.
- In-memory rate limiting (weak under multi-replica).
- MFA recovery / enterprise SSO deferred.
- Privacy stub / AV / KMS still policy stubs for closed pilots.
- Custom-role SoD packing residual (S12).
- Period close incomplete on some AR posts (control-plane hole, money integrity risk).
- ADR-0001 still **Proposed** while cookie topology is largely live.

**Multi-tenant isolation score remains the strongest subsystem (~8.5)** relative to Clean Architecture purity.

---

## 9. Scalability & maintainability

### Scalability

| Signal | Status |
|---|---|
| Stateless API replicas | **Designed**; rate limit not Redis-backed |
| Redis cache/queue | **Config optional; readiness skipped; no BullMQ** |
| DB outbox poll worker | **Works**; not Redis-queue relay as full doc diagram |
| Advisory locks on billing/utilities | **Present** |
| Cursor APIs | **Present**; UI often truncates ~50 |
| Aging on-read | **OK at 30–50 units**; not 10k claim |
| 10k / pen-test (M9) | **Not started** |

Fit: **closed pilot / small org**. Not architecture-proven for horizontal money scale claims.

### Maintainability

**Positive:** Domain modules, shared contracts, CI boundaries, Conventional Commits, review-driven money fixes, runbooks for recon.

**Negative:** Impure domain + Prisma-in-services increases change blast radius; worker/API duplication; finance circular module graph; doc list of modules ≠ disk; README still advertising Sprint-06 as next while S12 is done.

---

## 10. Documentation consistency

| Item | Status |
|---|---|
| ADR-0005 Next.js | **Accepted**; remediates Mid-Project “no Next ADR” |
| `docs/02` still SPA/PWA client diagram | **Drift** vs ADR-0005 / implemented Next |
| `docs/08` header corrected; deeper trees may still show aspirational folders | **Partial** |
| README “next = Sprint-06” | **Stale** vs S12/RC reality |
| OpenAPI mandated in `04` | **Unmet** |
| ADR-0001 Proposed vs implemented cookies | **Status drift** |
| UI specs for maintenance/portal | **Ahead of backend** |
| Sprint reviews + RC/Beta | **Strong** program memory |

Documentation is **rich enough to govern** but **not synchronized enough to trust as an as-built architecture description** without cross-checking ADRs + reviews.

---

## 11. Strengths

1. **Modular monolith done right for stage** — clear Nest modules matching product vocabulary; extractable later without rewrite of vocabulary.
2. **Organization isolation as a first-class architecture** — JWT + path + header forbid + tenant filters + non-disclosure 404s.
3. **Transport contracts package** — Zod-only `@rpm/contracts` shared by web/api/worker without framework leakage.
4. **Money discipline** — Decimal DB + string API (ADR-0004/0006); SoD and recon control plane present.
5. **Transactional outbox co-commit** — durable async hook aligned with ADR-0002 intent.
6. **Frontend stack alignment** — Next App Router + feature folders + TanStack Query + non-persisted tokens.
7. **Occupancy integrity** — GiST EXCLUDE + leasing lifecycle modules.
8. **Review culture** — Sprint reviews repeatedly catch money/isolation defects before claiming Done.

---

## 12. Weaknesses

1. Clean Architecture **domain/infrastructure** rules systematically unmet.
2. Finance **circular dependency** (`forwardRef`) and cross-module Prisma reads.
3. Shared money helpers live in impure domain files instead of a pure kernel.
4. Worker **event catalog incomplete** + handler duplication.
5. Redis/queue/cache **documented but not implemented**.
6. OpenAPI **not published**; API doc path drift (`/api/v1` vs `/v1`).
7. Ops domains (maintenance, communications, reporting) **docs-only**.
8. Program docs (**README**, `docs/02`) lag implementation and ADRs.
9. Tenant scoping **not structurally enforced** by repositories.
10. Period / idempotency residuals on money paths (architecture of controls incomplete).

---

## 13. Technical Debt

| ID | Debt | Severity | Suggested horizon |
|---|---|---|---|
| TD-A1 | Purify domain (no Nest/Prisma); map exceptions at application boundary | High | v1.1 |
| TD-A2 | Introduce real tenant-scoped repositories; retire Prisma-in-controller; apply base to org-owned aggregates | High | v1.1 |
| TD-A3 | Break payments↔reconciliation cycle (events or finance kernel module) | High | v1.1 |
| TD-A4 | Extract pure money/period helpers to `@rpm/contracts` or `packages/finance-kernel` | Medium | v1.1 |
| TD-A5 | Shared worker/API library for import/billing handlers; expand outbox consumers | Medium | v1.1 |
| TD-A6 | Redis-backed rate limit + queue transport per architecture docs | Medium | v1.1 / M9 prep |
| TD-A7 | Generate/publish OpenAPI from contracts; fix `/v1` base URL in docs | Medium | v1.1 |
| TD-A8 | Close period guards on all AR posts; finish idempotency begin/complete on payment record/allocate | High (controls) | Before Production RC |
| TD-A9 | Composite tenant FKs audit across remaining tables | Medium | v1.1 |
| TD-A10 | Doc hygiene: README sprint currency, rewrite `02` client section, ADR-0001 Accept, module list = as-built | Medium | Immediate / v1.1 |
| TD-A11 | Maintenance/communications modules when M6 starts — do not let UI specs imply shipped API | Product | M6 |
| TD-A12 | Playwright golden-path + staging isolation evidence pack | High (evidence) | Sprint-13 / RC |

---

## 14. Risks

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Missed `tenantId` on a new query | Cross-org data leak | Medium (growing surface) | Tenant repository base + isolation tests as merge gate |
| Circular finance modules harden into unextractable ball | Slow money changes / extraction failure | Medium | Kernel module + events |
| Outbox “success” without consumers | False sense of async reliability | Medium | Catalog + handlers or stop writing unused types |
| Claiming Clean Architecture in sales/compliance | Trust damage | Medium | Honest “modular Nest services” language |
| Multi-replica rate-limit bypass | Abuse / cost | Medium at scale | Redis limiter before multi-instance Production |
| Period bypass on billing posts | Month-end integrity failure | Medium until TD-A8 | Guard + soak |
| Doc/code mismatch | Wrong agent/engineer implementations | High already | Doc sync gate in PR template |
| Premature microservice split to “fix” layering | Cost explosion | Low if discipline holds | Stay modular monolith through M9 |

---

## 15. Recommendations for v1.1

Prioritize **architecture hardening**, not feature sprawl:

1. **Layering pass:** domain pure functions + application exception mapping; Prisma only in `infrastructure/` repos implementing ports.
2. **Finance kernel:** shared money/period/idempotency primitives; eliminate `forwardRef` between payments and reconciliation.
3. **TenantScopedRepositoryBase** mandatory for org-owned aggregates; expand isolation fixtures (T11/T12 class).
4. **Outbox maturity:** shared handler package; implement or delete unused event types; optionally introduce Redis queue relay as docs describe.
5. **Controls completeness:** closed-period on all AR writers; reservation-first idempotency on remaining money mutations.
6. **Contracts → OpenAPI** publish pipeline; align `04` base path with `/v1`.
7. **Doc as-built sync:** README, `02` container diagram (Next.js), module inventory, ADR-0001 Accepted.
8. **Observability/scale prep:** Redis rate limits; replace skipped Redis readiness with real checks when enabled.
9. **Defer microservices** until queue depth, team boundaries, or blast-radius evidence demand extraction (ADR required).
10. **M6 scaffolding:** when maintenance starts, create Nest + Prisma modules first—do not grow UI-only islands.

---

## 16. Scorecard summary (required return fields)

| Field | Result |
|---|---|
| **Architecture Score** | **7.2 / 10** |
| **Strengths** | Modular monolith + vocabulary; org isolation; Zod contracts; Decimal money; outbox co-commit; Next feature alignment; review culture (§11) |
| **Weaknesses** | Impure domain; Prisma-in-application; finance circularity; thin worker; Redis aspirational; OpenAPI/doc drift (§12) |
| **Technical Debt** | TD-A1…TD-A12 (§13) |
| **Risks** | Isolation slip, false async confidence, period holes, doc mismatch, premature split (§14) |
| **Recommendations for v1.1** | Layering + finance kernel + repos + outbox + controls + OpenAPI + doc sync (§15) |
| **Go / No-Go** | **No-Go** for Production architecture claim; **Conditional Go** for continued closed-pilot delivery under debt plan |

---

## 17. Go / No-Go

### Decision: **No-Go** (as Production / public-RC architecture certification)

| Claim | Allowed? |
|---|---|
| “Clean Architecture fully implemented” | **No** |
| “Architecture ready for unassisted Production / public RC” | **No** |
| “Fit to continue closed design-partner pilot + Sprint-13 soak” | **Conditional Yes** |
| “Ready to extract microservices” | **No** — stay modular monolith |
| “v1.1 architecture hardening backlog approved” | **Recommended Yes** |

### Exit criteria to flip architecture Go for Production candidacy

1. Domain purity + repository ports for org-owned money/lease aggregates (or ADR accepting pragmatic Nest services).  
2. Finance circular dependency removed; period + idempotency residuals closed.  
3. Staging isolation + soak evidence (aligns with RC-B1/B2/B3).  
4. As-built docs (README, `02`, OpenAPI or explicit ADR waiving OpenAPI).  
5. Rate-limit/queue story honest for the chosen deploy topology.

---

## 18. Closing note

This system’s architecture **succeeds where it matters most for a multi-tenant rental SaaS**—Organization isolation, vocabulary, contracts, and money representation—while **under-delivering on the hexagonal packaging** the coding rules advertise. Treat v1.0 as a **strong modular monolith with known layering debt**; use v1.1 to make the as-built match the as-documented before scaling claims or extraction fantasies.
