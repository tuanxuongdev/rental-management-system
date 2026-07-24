# Production Readiness Assessment

**Assessment ID:** RPM-PROD-READY-01  
**Assessment date:** 2026-07-24  
**Roles applied:** DevOps Lead · Security Lead · Principal Software Architect  
**Scope:** Full repository through Sprint-12 Conditional Go; SemVer `0.0.0`; pre–Sprint-13 soak  
**Normative baselines:** [`CODING_RULES.md`](../../CODING_RULES.md) · [`docs/01-business-requirements.md`](../01-business-requirements.md) (NFR-REL / NFR-OPS) · [`docs/02-system-architecture.md`](../02-system-architecture.md) · [`docs/09-coding-standard.md`](../09-coding-standard.md) · runbooks under [`docs/runbooks/`](../runbooks/) · ADRs 0001–0006 · [`Release-Candidate-Review.md`](./Release-Candidate-Review.md) · [`Final-Architecture-Audit.md`](./Final-Architecture-Audit.md) · Sprint-12 Review  
**Method:** Docs-as-truth + repository evidence. **No code changes.**

---

## 1. Executive verdict

Engineering **merge quality** is production-*minded*: CI runs format, lint, boundaries, typecheck, build, unit, Postgres integration, isolation, SCA, Gitleaks, and Trivy image scans. Migrations are forward-only with `migrate deploy` in CI. Auth isolation, webhook fail-closed HMAC, and structured logs with correlation IDs are real.

**Production operations are not.** “Deploy staging/dev” workflows are ephemeral Compose smokes on GitHub runners—not managed environments with vaulted secrets. Monitoring/terraform folders are absent; OpenTelemetry and dashboards are unmet NFRs. Restore runbooks are skeletons without rehearsal evidence against **RPO ≤ 15 min / RTO ≤ 4 h**. Money soak, staging human sign-off, period-control residuals, and pen-test/10k load remain open.

**Production Score: 5.0 / 10**  
**Go / No-Go for Production: No-Go**

Closed design-partner pilot remains **conditionally** viable only under the Residual Contract in §10—not as unassisted production cutover.

---

## 2. Production Score

| Dimension | Score | Weight | Notes |
|---|---:|---:|---|
| Build reproducibility | **7.0 / 10** | Medium | Ordered pnpm build + Dockerfiles; fragile web runner / no Turbo DAG |
| Automated tests | **6.0 / 10** | High | Vitest unit+integration; no Playwright/web tests; money isolation thin |
| CI/CD pipeline | **5.5 / 10** | High | Strong CI gates; deploy ≠ cloud; no prod/canary/approvals |
| Database migrations | **7.5 / 10** | High | Forward-only discipline solid; staging apply evidence open |
| Rollback strategy | **6.0 / 10** | High | Image rollback documented; no down migrations (by design) |
| Logging | **7.0 / 10** | Medium | Structured JSON + correlation; limited redaction proof |
| Monitoring / alerting | **2.5 / 10** | High | Health/ready only; no OTel/metrics/dashboards/alerts |
| Environment configuration | **5.5 / 10** | Medium | `.env.example` present; payment webhook secrets not listed |
| Secrets management | **4.5 / 10** | High | Gitignore + Gitleaks; no vault in deploy; Compose uses example env |
| Performance readiness | **5.0 / 10** | Medium | Pilot-fit; in-memory rate limit; no M9 10k/pen-test |
| Security readiness | **6.5 / 10** | High | Strong isolation/HMAC/SCA; weak headers/rate-limit/pen-test |
| Backup & restore | **3.5 / 10** | High | Skeleton runbooks; no evidenced rehearsal |
| Deployment guide | **5.0 / 10** | Medium | Skeleton; staging parity checklist aspirational |
| Operations runbooks | **6.5 / 10** | Medium | Migration, incident, recon, webhook, billing replay present |
| Disaster recovery | **3.0 / 10** | High | RPO/RTO targets documented; annual drill unmet |

**Production Score (weighted): 5.0 / 10**

Interpretation: **Ready to harden toward Production**; **not ready to run Production**.

---

## 3. Evaluation by area

### 3.1 Build

| Check | Status |
|---|---|
| Root `pnpm build` (contracts → testing → ui → api → worker → web) | **Pass** |
| Docker multi-stage API / web / worker | **Pass** (web runner `pnpm` on alpine is fragile) |
| `prisma:generate` in CI quality job | **Pass**; not part of root `build` (local footgun) |
| Turbo/Nx DAG | **Absent** — order-dependent filters |

### 3.2 Tests

| Layer | Status |
|---|---|
| Unit (Vitest) | **Present** (~20 non-integration specs) |
| Integration (Postgres) | **Present** (13 `*.integration.spec.ts`); skip-if-no-DB locally |
| Isolation job | **Partial** — omits billing/payments/reconciliation |
| Web / Playwright e2e | **Absent** |
| Coverage thresholds | **Absent** |
| Money DB harness | **Thin** — `resetPlatformTables` incomplete for payments/recon (RC-B3 / S12-O2) |

### 3.3 CI/CD

| Artifact | Reality |
|---|---|
| `.github/workflows/ci.yml` | Quality, unit, integration, isolation, sca, secrets (Gitleaks), containers (Trivy), PR commitlint |
| `deploy-dev.yml` / `deploy-staging.yml` | Ephemeral Compose up → smoke → `down -v` |
| Prod deploy / canary / blue-green | **Missing** |
| GitHub Environments + approvals | **Missing** |
| Dependabot | **Present** |
| Branch-protection as code | **Not in repo** (docs name required checks; live settings unverified) |

### 3.4 Database migrations

- Location: `prisma/schema/migrations/` (15 forward migrations through Sprint-12).
- Runtime path: `pnpm prisma:migrate:deploy` + status/validate in CI.
- Raw SQL: reviewed fragments copied into ordered migrations (EXCLUDE, etc.).
- Seeds: demo/scale only — **not for production**.
- Expand/migrate/contract documented; applied migrations immutable.

### 3.5 Rollback strategy

| Mechanism | Status |
|---|---|
| Redeploy previous image SHA | **Documented** ([deployment.md](../runbooks/deployment.md)) |
| Schema down migrations | **Forbidden by design** — forward-fix only |
| Expand/contract for breaking DDL | **Documented**; process must be followed |
| Feature flags for money paths | **Partial / ad hoc** (e.g. utilities flag); not a full rollback fabric |

### 3.6 Logging

- Structured JSON logger + bootstrap `api.started`.
- `X-Request-ID` / correlation on problem+json.
- Worker/API health servers.
- **Gap:** NFR-OPS-001 traces + Organization-safe redaction not fully evidenced; no centralized log sink config in-repo.

### 3.7 Monitoring

| NFR | Status |
|---|---|
| `/health`, `/ready` | **Present**; Redis check always **`skipped`** |
| Metrics / OTel | **Missing** |
| `infrastructure/monitoring/` | **Missing** (docs aspirational) |
| Dashboards / alerts (NFR-OPS-002/003) | **Missing** |
| Outbox backlog alerts | **Runbook mentions**; no automated alert |

### 3.8 Environment configuration

- `.env.example` covers DB, API/worker ports, JWT/cookie, Redis, S3, CORS, email mode.
- **Gap:** `PAYMENTS_WEBHOOK_SECRET` / allow-default flag used in code/runbook but **not** in `.env.example`.
- Deploy workflows copy `.env.example` — unsuitable for real secrets.

### 3.9 Secrets management

| Control | Status |
|---|---|
| `.env` gitignored; Gitleaks in CI | **Pass** |
| Vault / GitHub Environment secrets for staging/prod | **Not evidenced** |
| Webhook secret fail-closed | **Pass** (unless allow-default / test) |
| KMS / AV | **Stubs** (base64 “encrypt”; MIME allowlist scan) |
| Production seed secrets | **Forbidden** by rules |

### 3.10 Performance

- Inventory scale harness exists (CI default ~2.5k units); **not** M9 10k gate.
- In-memory rate limiter — weak under multi-replica.
- Redis/queue/cache aspirational; no PgBouncer in infra.
- Aging on-read acceptable for 30–50 units; not a Production scale claim.

### 3.11 Security

| Strength | Residual |
|---|---|
| Org JWT + path 404 + forbidden tenant headers | Pen-test not done (M9) |
| Deny-by-default RBAC | Custom-role SoD packing residual |
| Gitleaks + Trivy + `pnpm audit --high` | Security headers (Helmet/CSP/HSTS) absent |
| Webhook HMAC + raw body | In-memory rate limit |
| No PAN; HttpOnly refresh; in-memory access token | Privacy stub unsigned (RC-B5) |
| Money SoD (refunds/dispositions) | Period holes on some AR posts (RC-B4 / S12-O1) |

### 3.12 Backup & restore

- [restore.md](../runbooks/restore.md) + [restore-rehearsal-record.md](../runbooks/restore-rehearsal-record.md) are **skeletons**.
- Assumes managed Postgres snapshots/PITR; no filled rehearsal evidence in-repo.
- NFR-REL-004/005/008: encrypted backups, RPO≤15m, RTO≤4h, ≥ annual DR — **targets only**.

### 3.13 Deployment guide

- [deployment.md](../runbooks/deployment.md) Sprint-02 skeleton: pre-deploy checklist, Compose-oriented steps, image rollback.
- Staging parity checklist still describes “empty vertical slice” language inconsistent with Sprint-12 finance surface.
- No cloud topology (VPC, TLS termination, WAF, managed DB) as an as-built guide.

### 3.14 Operations runbooks

| Runbook | Usefulness |
|---|---|
| migration.md | **Usable** |
| deployment.md | Skeleton |
| incident.md | Skeleton triage |
| restore*.md | Skeleton |
| daily-reconciliation.md | **Usable** for finance ops |
| payment-webhook-incidents.md | **Usable** |
| billing-replay-retry.md | **Usable** |
| import-jobs.md | **Usable** |
| access-admin.md | **Usable** |

### 3.15 Disaster recovery

- Commercial RPO/RTO documented in BRD/roadmap.
- No evidenced restore drill; no multi-region/failover design implemented.
- Worker outbox provides durability for committed events but is not a DR plan for Postgres loss.
- **NFR-REL-005 failure is a launch blocker** per program docs — currently unmet as *demonstrated* capability.

---

## 4. Critical Blockers

| ID | Blocker | Why it blocks Production |
|---|---|---|
| **PR-C1** | No managed staging/prod deploy with vaulted secrets (Compose smoke ≠ environment) | Cannot operate or sign off a real cutover |
| **PR-C2** | No evidenced backup restore / DR drill vs RPO≤15m / RTO≤4h | Violates NFR-REL-004/005/008 launch bar |
| **PR-C3** | No metrics/OTel/dashboards/alerts (NFR-OPS-001…003) | Blind on-call; cannot meet 99.9% ops posture |
| **PR-C4** | Staging human M4/M5-prep + bill→pay→reconcile→age sign-off absent (RC-B1) | No acceptance evidence |
| **PR-C5** | Formal financial soak / Sprint-13 (RC-B2) not done | Money integrity under chaos unproven |
| **PR-C6** | Thin T11/T12 DB/integration + isolation omits finance modules (RC-B3) | Isolation merge gate incomplete for money |
| **PR-C7** | Closed-period incomplete on billing invoice/credit posts (RC-B4 / S12-O1) | Month-end control bypass |
| **PR-C8** | Privacy stub / PII policy unsigned; KMS/AV stubs (RC-B5) | Compliance risk for real resident data |

---

## 5. Medium Risks

| ID | Risk | Notes |
|---|---|---|
| **PR-M1** | In-memory rate limit under multi-replica | Abuse / cost / auth brute-force |
| **PR-M2** | Idempotency residual on payment record/allocate (S12-O3) | Duplicate money posts under concurrency |
| **PR-M3** | No Playwright / golden-path e2e | Regressions escape CI |
| **PR-M4** | No security response headers (Helmet/CSP/HSTS) | Browser/API hardening gap |
| **PR-M5** | `.env.example` missing payment webhook secret keys | Misconfig / accidental allow-default |
| **PR-M6** | Dockerfile.web / deploy-dev Node/corepack fragility | Failed starts in “prod-like” images |
| **PR-M7** | Redis readiness always skipped; queue/cache not real | Architecture/docs overclaim |
| **PR-M8** | Branch-protection enforcement unverified | Local bypass of required checks possible |
| **PR-M9** | Single CODEOWNERS identity | Weak SoD for money/auth reviews |
| **PR-M10** | Deployment/incident/restore runbooks still Sprint-02 skeletons | On-call improvisation |
| **PR-M11** | No canary / progressive delivery / prod workflow | Blast-radius on first real deploy |
| **PR-M12** | Pen-test and 10k load (M9) unmet | Acceptable only if not claimed for GA |

---

## 6. Low Risks

| ID | Risk | Notes |
|---|---|---|
| **PR-L1** | No Turbo task graph | Manual build order mistakes |
| **PR-L2** | Root `build` without `prisma:generate` | Local DX footgun (CI OK) |
| **PR-L3** | No coverage thresholds | Soft quality signal |
| **PR-L4** | Scale CI default 2.5k not 10k | Honest for pilot; label claims |
| **PR-L5** | README still points at Sprint-06 | Operator confusion |
| **PR-L6** | Email console stub | Expected until provider wired |
| **PR-L7** | Mobile / WCAG evidence soft for closed pilot | Hard for public Production marketing |

---

## 7. Production Checklist

Use as the **minimum** gate before any Production Go claim. Items marked ☐ are currently unmet or unverified in-repo.

### A. Engineering gates
- [x] CI quality: format, lint, boundaries, typecheck, build
- [x] Unit tests in CI
- [x] Integration tests against Postgres in CI
- [ ] Isolation suite includes billing, payments, reconciliation
- [ ] Playwright (or equivalent) landlord golden-path smoke
- [x] SCA (`pnpm audit --high`) + Gitleaks + Trivy CRITICAL/HIGH
- [ ] Branch protection required checks verified in GitHub settings
- [ ] Coverage / a11y / bundle budgets as claimed in coding standard (or ADR waive)

### B. Data & migrations
- [x] Forward-only migrations; no edited applied migrations
- [ ] Sprint-11/12 migrations applied on **managed** staging DB with status green
- [ ] Expand/contract plan reviewed for next breaking change
- [ ] `resetPlatformTables` (or successor) covers payments/recon for T11/T12 evidence
- [ ] Finance permissions re-seeded on existing orgs post-migrate

### C. Security & secrets
- [x] No tenant isolation headers accepted
- [x] Webhook HMAC fail-closed
- [ ] Secrets in vault / GitHub Environments — not `.env.example` on runners
- [ ] `PAYMENTS_WEBHOOK_SECRET` documented in `.env.example` and set in staging/prod
- [ ] Allow-default webhook secret **disabled** outside local/test
- [ ] Security headers (CSP/HSTS/etc.) or explicit waive
- [ ] Redis-backed (or equivalent) rate limiting for multi-instance
- [ ] Privacy / PII class policy signed for production data
- [ ] KMS + malware scanning path beyond stubs (or data-class exclusion)
- [ ] External pen-test scheduled/passed before GA (M9)

### D. Observability & SLOs
- [x] `/health` and `/ready` (database)
- [ ] Redis/queue checks real when dependencies enabled
- [ ] Structured logs shipped to central store with redaction policy
- [ ] Metrics + traces (OTel or equivalent)
- [ ] Dashboards: latency, errors, saturation, outbox depth, job failures
- [ ] Alerts routed to on-call with runbook links (NFR-OPS-003)
- [ ] Error budget / 99.9% availability monitoring plan

### E. Deploy & environments
- [ ] Persistent staging environment (managed Postgres, Redis, S3, TLS)
- [ ] Production deploy workflow with approvals
- [ ] Image tags by git SHA; rollback rehearsed
- [ ] Canary or rolling strategy documented and tested
- [ ] Staging parity checklist updated for finance modules (not “empty slice”)
- [ ] CORS/`WEB_ORIGIN` locked to production origins

### F. Backup, restore, DR
- [ ] Automated encrypted Postgres backups enabled
- [ ] PITR or snapshot retention meets RPO ≤ 15 minutes
- [ ] Restore rehearsal completed; [restore-rehearsal-record.md](../runbooks/restore-rehearsal-record.md) filled
- [ ] RTO ≤ 4 hours demonstrated (or waived with exec sign-off — not recommended)
- [ ] Annual DR exercise scheduled (NFR-REL-008)
- [ ] Object storage backup/retention for documents

### G. Money & product acceptance
- [ ] Period guards on all AR posts (or audited waive)
- [ ] Idempotency begin/complete on remaining payment writers
- [ ] Named M4 occupancy + M5-prep finance demo signed on staging
- [ ] Reconciliation tolerance SME sign-off
- [ ] Formal soak / chaos (Sprint-13) with no unexplained imbalances
- [ ] Daily recon runbook dry-run by operator
- [ ] Partner/pilot contract states desk-only, portal/maintenance deferred (if not full GA)

### H. Runbooks & ownership
- [ ] deployment.md / incident.md / restore.md promoted from skeleton to as-built
- [ ] On-call roster + escalation tracker live
- [ ] CODEOWNERS team-based for auth/money paths
- [ ] README and architecture docs match as-built deploy topology

**Current checklist completion (approx.): ~25% of Production-critical items.**

---

## 8. Alignment with prior reviews

| Source | Ops-relevant conclusion |
|---|---|
| Release-Candidate-Review | Production **No-Go**; RC-B1…B5 |
| Final-Architecture-Audit | Architecture Production claim **No-Go**; Redis/OTel/rate-limit debt |
| Sprint-12-Review | Conditional Go to staging control-plane only; O1–O3 open |
| This assessment | Confirms ops/DR/monitoring as **hard** Production blockers beyond product gaps |

---

## 9. Scorecard summary (required return fields)

| Field | Result |
|---|---|
| **Production Score** | **5.0 / 10** |
| **Critical Blockers** | PR-C1…C8 (§4) — no managed deploy/secrets; no DR evidence; no observability; RC-B1…B5 / period / thin money tests |
| **Medium Risks** | PR-M1…M12 (§5) — rate limit, idempotency, e2e, headers, webhook env, image fragility, branch protection, canary, pen-test |
| **Low Risks** | PR-L1…L7 (§6) — Turbo, local generate, coverage, README drift, email stub, soft a11y/mobile |
| **Production Checklist** | §7 (A–H) — ~25% complete for Production-critical items |
| **Go / No-Go** | **No-Go** |

---

## 10. Go / No-Go

### Decision: **No-Go for Production**

| Claim | Allowed? |
|---|---|
| Unassisted Production cutover for paying landlords | **No** |
| Public Production / GA launch | **No** |
| Managed multi-tenant Production with resident PII | **No** (privacy/KMS/AV + DR unmet) |
| Closed design-partner pilot on desk staff UI | **Conditional** — see below |
| Continue Sprint-13 soak + ops hardening | **Yes — required path** |

### Residual Contract for Conditional closed pilot (not Production)

1. Ephemeral or dedicated non-prod stack only; no public marketing as Production.  
2. Vaulted secrets; webhook allow-default **off**.  
3. Migrations applied; T11/T12 + finance isolation evidence recorded.  
4. Named sign-off: occupancy + bill→pay→reconcile→age + tolerance.  
5. Explicit exclusions: portal, maintenance, notifications, mobile hallway, WCAG claim, pen-test, 10k load.  
6. Period/idempotency residuals tracked as known defects with owner.  
7. No Production RPO/RTO commitment until restore rehearsal passes.

### Path to Production Go

1. Clear **PR-C1…C8**.  
2. Complete Production Checklist §7 to **all critical boxes**.  
3. Sprint-13 soak + M5 exit.  
4. Then M6–M10 as roadmap requires for GA—not leapfrog.

---

## 11. Closing note

This repository has a **credible CI fortress** and **usable finance ops runbooks**, but Production readiness is judged by **environments, evidence, observability, and recoverability**—not by green Vitest alone. Treat the next program increment as **ops hardening + soak**, not feature marketing. Until restore drills, managed staging, and money chaos evidence exist, the only honest status is **No-Go for Production**.
