# Release Candidate Product Review

**Review ID:** RPM-RC-PRODUCT-01  
**Review date:** 2026-07-24  
**Roles applied:** Product Manager · QA Lead · UX Lead · Principal Software Architect  
**Release channel evaluated:** **Release Candidate / Production candidacy** (pre-GA SemVer `0.0.0`; engineering through **Sprint-12** Conditional Go; **Sprint-13 soak not started**)  
**Persona lens:** Owner-operated or small professional manager running **~30–50 rentable Units** (± Beds) in one or few Properties  
**Normative baselines:** [00-overview.md](../00-overview.md) · [01-business-requirements.md](../01-business-requirements.md) · [project-roadmap.md](../project-roadmap.md) · [dependency-map.md](../dependency-map.md) · [navigation.md](../navigation.md) · [Alpha-Product-Review.md](./Alpha-Product-Review.md) · [Beta-Product-Review.md](./Beta-Product-Review.md) · Sprint reviews **01–12** · UI specs under `docs/ui/` · ADRs 0002–0006 · [reconciliation-tolerance.md](../finance/reconciliation-tolerance.md)  
**Method:** Docs-as-truth + prior review/implementation evidence. **No code changes** in this review.

---

## 1. Executive verdict

Since the Beta review (through Sprint-10), the product closed the **collection hole** (Sprint-11) and opened the **financial control plane** (Sprint-12: reconciliation, aging buckets, deposit/refund SoD, period close, exports, parallel compare). For a 30–50-unit landlord, the **core rent loop**—inventory → residents → lease lifecycle → bill → collect → age → reconcile → dispose deposit—now exists **in-product** as a staff desktop path.

That is a material step-change from Beta’s “invoice without cash book.” It is **not** yet a Production Release Candidate under the program’s own milestone rules.

Roadmap **M5** requires a **financial parallel run** with no unexplained duplicate/missing/imbalanced transactions under soak criteria. Sprint-12 explicitly hands that marathon to **Sprint-13**. Staging/human M4–M5 sign-off (**B3**), WCAG evidence (**B6**), mobile policy (**B5**), privacy stub policy, migration/integration evidence, and residual money-control defects (period guards on billing posts, thin T11/T12 DB fixtures) remain open. Phase **6** ops (maintenance, notifications, rich reports) and Phase **9** pen-test / 10k load are not claimed.

**Production / public RC: No-Go.**  
**Allowed:** closed design-partner pilot (desk-only staff UI) with signed tolerance, applied migrations, and explicit residual contracts—not unassisted production cutover.

---

## 2. Overall Product Score

| Dimension | Score | Weight | Delta vs Beta (6.3) | Notes |
|---|---:|---:|---|---|
| Business workflow completeness (landlord day) | **7.5 / 10** | High | +1.5 | Bill + collect + age + recon + deposit SoD; maintenance/portal still out |
| UX / navigation / task success | **6.5 / 10** | High | +0.5 | Finance desk richer; SoD via ID paste; pickers/mobile still weak |
| Trust (security, isolation, audit, money SoD) | **7.0 / 10** | High | −0.5 | Isolation still strong; money surface + residual control defects |
| Performance fitness (30–50 units) | **7.0 / 10** | Medium | ~0 | Fit at pilot scale; aging on-read; list “Load more” thin |
| Accessibility | **4.5 / 10** | Medium | ~0 | Patterns improved; **no WCAG evidence pack** |
| Documentation (operator + program) | **7.5 / 10** | Medium | +0.5 | Runbooks + tolerance; landlord quickstart still thin |
| Quality / evidence (QA) | **6.0 / 10** | Medium | ~0 | Unit/build gates strong; staging/e2e/DB T11–T12 thin |

**Overall Product Score (RC fitness for 30–50-unit landlord): 7.1 / 10**

Interpretation: **Credible closed finance-capable pilot candidate**; **not** Production RC for unassisted landlords or public RC marketing.

---

## 3. Business Readiness

### 3.1 Milestone reality vs landlord expectation

| Roadmap milestone | Status (docs + reviews) | Landlord impact |
|---|---|---|
| M1–M2 Platform + isolation | Strong | Trust foundation |
| M3 Inventory operable | Conditional (staging residual) | Can model ~30–50 units |
| M4 Lease lifecycle | Technical Conditional Go; **human staging sign-off open** | Occupancy operable; transfer/notice UI thin |
| M5 Financial parallel run | **Control plane shipped (S10–12); soak = Sprint-13** | Can bill, collect, age, reconcile in code—**not soak-proven** |
| M6 Ops & reports | Not started | No maintenance; thin reports/exports only |
| M7–M10 Migration → pilots → pen-test → GA | Not started | Not Production |

### 3.2 End-to-end business workflows

| Step | Landlord need | RC-candidate status |
|---|---|---|
| 1. Sign up / invite staff | Org + invitations + roles | **Usable** (Accountant activated) |
| 2. Define property + units/beds | Portfolio CRUD + import | **Usable** |
| 3. Vacancy / occupancy | Availability + lease occupancy | **Usable** (transfer UI thin) |
| 4. Prospect / resident | Residents + waitlist + DNR | **Usable** |
| 5. ID / lease files | Documents | **Usable** (privacy/AV stubs) |
| 6. Create & activate lease | Draft → review → activate | **Usable** |
| 7. Move-in / keys | Checklist + occupancy | **Usable** (post S09 fixes) |
| 8. Monthly rent due | Billing run → invoices | **Usable** |
| 9. Record payment / receipts | Cash/bank + allocate + receipt | **Usable** (staff; portal deferred) |
| 10. Arrears / aging | As-of buckets | **Usable** (S12) |
| 11. Reconcile settlements | Recon workspace + tolerance | **Usable** (sandbox; SME sign-off open) |
| 12. Renew / move-out | Lifecycle | **Usable** |
| 13. Deposit settlement | Disposition SoD | **Usable** (cross-user via ID paste; dual-control) |
| 14. Utilities | Meters + equal-split allocation | **MVP / thin** |
| 15. Fix a broken AC | Maintenance | **Missing (M6)** |
| 16. Morning desk | Home + finance dashboard | **Partial** — leasing exceptions + finance widgets; no work orders |
| 17. Month-end trust | Recon + period close + exports | **Partial** — in-product; soak/staging evidence open |
| 18. Resident self-pay | Portal | **Deferred** |

**Business readiness rating**

| Question | Answer |
|---|---|
| Setup readiness | **Yes** |
| Day-2 occupancy operations | **Conditional Yes** (staging M4 sign-off; transfer/notice thin) |
| Day-2 money operations (bill **and** collect) | **Conditional Yes** (in-product; migration/T11–T12 evidence + SME tolerance open) |
| Month-end money trust (recon + period) | **Conditional** — code path exists; soak + staging demo not evidenced |
| Unassisted Production for 30–50 units | **No** |
| Closed design-partner pilot (desk staff, labeled residuals) | **Conditional Yes** |

### 3.3 Fit for 30–50 units

Scale remains appropriate. The operator’s three loops—**occupancy**, **billing**, **collection/control**—are now represented in the product. Remaining abandonment risk shifts from “no cash book” to **trust evidence** (staging demo, soak, period holes on billing posts) and **ops gaps** (maintenance, mobile hallway use).

---

## 4. Domain evaluation (RC lens)

### 4.1 Property / inventory management

Present: Property → Unit → Bed, import, availability, ownership attribution. Residuals: combobox pickers, staging import sign-off. **Score: 7.5 / 10.**

### 4.2 Tenant (Resident) lifecycle

Present: profiles, waitlist, DNR, documents, lease attachment, move-in/out. Residuals: portal, guarantor depth, privacy stub policy. **Score: 7.0 / 10.**

### 4.3 Contracts / leases

Present: draft → activate, renew, transfer (API-first UI), notice, terminate, occupancy events, pending queues. Residuals: transfer/notice wizards, M4 human acceptance. **Score: 7.5 / 10.**

### 4.4 Utility meters

Present: meters, bulk readings, equal-split allocation (flagged). Residuals: consumption evidence/explainability for partners. **Score: 6.0 / 10.**

### 4.5 Billing

Present: schedules, billing runs (preview/approve/commit), invoices, credit notes, ledger, ADR-0006. Residuals: property-TZ proration hardening; period guard incomplete on invoice/credit posts (S12 O1). **Score: 7.5 / 10.**

### 4.6 Payments

Present: cash/bank record, allocate, receipts, sandbox intents/webhooks, refund SoD, reversal, unapplied cash `1200`. Residuals: portal pay deferred; concurrent idempotency on some paths; PSP production KYC external. **Score: 7.5 / 10.**

### 4.7 Deposits

Present: canonical deposit on activate; disposition request → approve → execute with identity SoD. Residuals: UI SoD via pasted IDs (not queue inbox); TRANSFER/REMAINING_HELD GL thin. **Score: 7.0 / 10.**

### 4.8 Reports / exports / dashboard

Present: finance dashboard widgets, aging, thin finance exports, parallel billing compare, Home leasing exceptions. Missing: maintenance KPIs, rich report catalog, notifications. **Score: 6.0 / 10.**

---

## 5. UX Score

**UX Score: 6.5 / 10**  
(Dashboard **5.5 / 10** · Mobile **3.0 / 10** · Finance desk **7.0 / 10**)

### What works

- Staff shell domains: Portfolio, People, Leasing, Finance, Admin/Ops.
- Finance path is discoverable: invoices, payments, arrears/aging, recon, periods, deposits, exports.
- High-risk money actions use confirmation/SoD messaging; receipts printable.
- Home surfaces leasing exceptions (no longer Alpha skeleton copy).

### What fails RC bar

- Entity pickers still ID-heavy vs combobox specs (operator friction at 30–50 units).
- SoD approve/execute often requires pasting UUIDs across users—workable, not polished.
- Transfer/notice remain thin vs lease lifecycle IA.
- Mobile/hallway ops unsupported; must be **desk-only labeled** for any pilot.
- Guided setup checklist (FR-TEN-010) still absent.
- No Playwright smoke pack for landlord golden path.

---

## 6. Performance Score

**Performance Score: 7.0 / 10** (30–50 unit fitness)

- Fit for pilot portfolio size; cursor pagination present on many APIs; UI often hard-limits ~50 without Load more.
- Aging is on-read (acceptable at this scale; snapshot later).
- Not evaluated against M9 10k-unit load gate—**out of RC claim**.

---

## 7. Security Score

**Security Score: 7.0 / 10** (money-capable closed pilot)

| Strength | Residual |
|---|---|
| Org isolation from session JWT (no tenant headers) | Staging isolation suite evidence gaps |
| Deny-by-default RBAC; property scope | PM property null gaps; custom-role SoD packing residual |
| Decimal money; no PAN storage; webhook HMAC fail-closed | Secret/env misconfig risk if ops skip runbooks |
| Refund/deposit identity SoD; recon override SoD | Period close incomplete on billing posts; thin DB money tests |
| Audit/outbox patterns | Privacy stub policy for closed Beta PII **unsigned** |
| | No pen-test (M9); AV/KMS stubs remain |

**Production money movement:** Not ready without staging evidence, migration apply, SME tolerance sign-off, and residual control fixes or waivers.

---

## 8. Accessibility

**Accessibility Score: 4.5 / 10**

Labels/`role="alert"` patterns improved in finance reviews; focus-on-error and automated WCAG 2.2 AA pack **absent**. Public RC marketing would over-claim; closed pilot should state “a11y evidence pending.”

---

## 9. Production readiness

| Gate | Required for Production RC | Current |
|---|---|---|
| Occupancy E2E (M4) evidenced on staging | Yes | **Open** (code Conditional; human sign-off absent) |
| Bill + collect rent in-product | Yes | **Met in code** (S11) |
| Aging + recon control plane | Yes for money trust | **Met in code** (S12); soak not met |
| Financial soak / parallel run (M5) | Yes per roadmap | **Fail** — Sprint-13 |
| Staging demo signed (bill→pay→reconcile→age) | Yes | **Open (B3)** |
| Migrations + T11/T12 isolation evidence | Yes | **Open / thin** |
| Period close covers all money posts | Yes or waive | **Partial (O1)** |
| Mobile policy labeled | Yes if hallway expected | **Open (B5)** |
| WCAG evidence | Yes for public RC | **Open (B6)** |
| Privacy stub policy | Yes for PII pilots | **Open** |
| Maintenance / notifications | Soft for money RC | **Absent (M6)** |
| Pen-test / 10k load | GA (M9), not money pilot | **N/A for closed pilot** |

---

## 10. Remaining Blockers

### Hard blockers (Production / public RC)

| ID | Blocker | Why it blocks |
|---|---|---|
| **RC-B1** (ex-B3) | Staging + human M4/M5-prep sign-off absent | Cannot claim pilot-ready without evidenced golden path |
| **RC-B2** | Formal M5 soak (Sprint-13) not done | Roadmap M5 exit unmet; unexplained money risk under chaos |
| **RC-B3** | Migration deploy + T11/T12 DB/integration evidence thin | Money correctness not proven in target environment |
| **RC-B4** | Closed-period incomplete on billing invoice/credit posts | Period lock can be bypassed on core AR posts |
| **RC-B5** | Privacy stub policy unsigned | PII classes for closed Beta undefined |

### Soft blockers (waive only with explicit partner contract)

| ID | Blocker | Notes |
|---|---|---|
| **RC-S1** (ex-B5) | Mobile unsupported | Label **desk-only RC** or fix |
| **RC-S2** (ex-B6) | WCAG evidence absent | Soft for closed pilot; hard for public RC |
| **RC-S3** | Maintenance / notifications missing | Acceptable if pilot scope is finance+leasing only |
| **RC-S4** | Portal pay deferred | Staff collection required |
| **RC-S5** | Transfer/notice UI thin | API-first residual |

**Beta blockers B1/B2/B4 (payments, aging, deposit settlement):** **Resolved in product** through Sprint-11/12 (post–Beta review).

---

## 11. Nice-to-have Improvements

| ID | Improvement | Notes |
|---|---|---|
| N1 | Combobox entity pickers | Alpha residual; reduces UUID friction |
| N2 | Transfer & notice wizards | Completes leasing UX |
| N3 | Disposition/refund approval queues (list pending) | Replaces ID-paste SoD |
| N4 | Guided setup checklist | FR-TEN-010 |
| N5 | Playwright golden-path smoke | RC evidence automation |
| N6 | Operator quickstart + honest capability sheet | Partner enablement |
| N7 | Utility evidence/explainability | Or keep feature-flagged |
| N8 | Plain-language error catalog | Support load |
| N9 | Home unpaid/overdue widgets polish | Morning desk |
| N10 | Maintenance MVP | M6; not money-critical for finance pilot |
| N11 | Period guards on all AR posts | Closes RC-B4 |
| N12 | Expand T11/T12 isolation fixtures | Closes RC-B3 |

---

## 12. Scorecard summary (required return fields)

| Field | Result |
|---|---|
| **Overall Product Score** | **7.1 / 10** |
| **Business Readiness** | **Setup: Yes · Occupancy day-2: Conditional Yes · Money day-2: Conditional Yes (code) · Month-end trust: Conditional · Production/RC: No** |
| **UX Score** | **6.5 / 10** (Dashboard **5.5** · Mobile **3.0** · Finance desk **7.0**) |
| **Performance Score** | **7.0 / 10** (30–50 unit fitness; not 10k) |
| **Security Score** | **7.0 / 10** (closed pilot; not pen-tested Production) |
| **Remaining Blockers** | See §10 (esp. **RC-B1 staging**, **RC-B2 soak**, **RC-B3 evidence**, **RC-B4 period holes**, **RC-B5 privacy**) |
| **Nice-to-have Improvements** | See §11 |
| **Go / No-Go for Production** | **No-Go** |

---

## 13. Go / No-Go for Production

### Decision: **No-Go for Production Release Candidate**

| Claim | Allowed? |
|---|---|
| Unassisted Production cutover for paying landlords | **No** |
| Public “Release Candidate” marketing | **No** |
| Closed design-partner pilot (desk staff, finance+leasing) | **Conditional Yes** — see conditions |
| Formal GA | **No** (M7–M10 unmet) |

### Conditions for a Conditional closed pilot (not Production)

1. Apply Sprint-11/12 migrations; re-seed finance permissions; run T11/T12 isolation against staging DB.  
2. Named owners sign: M4 occupancy demo + bill→pay→reconcile→age demo + [tolerance](../finance/reconciliation-tolerance.md).  
3. Partner contract states: desk-only UI; portal/maintenance/notifications out; utilities MVP; residual period/idempotency risks tracked; no public RC claim.  
4. Privacy stub policy for allowed PII classes.  
5. Soft waivers recorded for mobile and WCAG if not remediated.

### What would flip to Production RC later

1. Sprint-13 soak + formal M5 exit.  
2. RC-B1…B5 cleared.  
3. Period guards complete (or audited waive).  
4. Desk-only labeling **or** mobile remediation; WCAG pack for claimed workflows.  
5. Then proceed toward M6–M10 for GA—not leapfrog.

---

## 14. Closing note

Engineering through Sprint-12 produced a **finance-capable product skeleton** that Beta correctly said was missing. Treating this as Production RC would confuse **“the loop exists in code”** with **“the loop is proven under soak, staging, and partner contract.”** Ship honesty: celebrate the closed pilot path; keep Production behind Sprint-13 and evidenced sign-off.
