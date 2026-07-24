# Beta Product Review

**Review ID:** RPM-BETA-PRODUCT-01  
**Review date:** 2026-07-24  
**Roles applied:** Product Manager · UX Designer · QA Lead · Principal Software Architect  
**Release channel evaluated:** **Beta / Release Candidate candidacy** (pre-GA SemVer `0.0.0`; engineering through **Sprint-10** accepted with Conditional Go to Sprint-11)  
**Persona lens:** Owner-operated or small professional manager running **~30–50 rentable rooms** (canonical product: **Units** and optional **Beds** in one or few Properties—not a Room entity)  
**Normative baselines:** [00-overview.md](../00-overview.md) · [01-business-requirements.md](../01-business-requirements.md) · [navigation.md](../navigation.md) · [project-roadmap.md](../project-roadmap.md) · [dependency-map.md](../dependency-map.md) · [Alpha-Product-Review.md](./Alpha-Product-Review.md) · [Sprint-09-Review.md](./Sprint-09-Review.md) · [Sprint-10-Review.md](./Sprint-10-Review.md) · UI specs under `docs/ui/` · ADRs 0002–0006  
**Method:** Docs-as-truth + prior review evidence. **No code changes** in this review.

---

## 1. Executive verdict

Since the Alpha review (through Sprint-08), the product has closed the **occupancy hole** (Sprint-09) and opened a **billing foundation** (Sprint-10: schedules, billing runs, invoices, ledger, deposit *records*, meters MVP, Finance nav). Home is no longer a skeleton: it surfaces leasing exception queues. Engineering foundations (org isolation, money ADR, charge uniqueness post–Sprint-10 review) remain disproportionately strong.

For a landlord with **30–50 rooms**, the product is now a **usable ops + billing-prep system**, not yet a **collection system**. The operator can answer “who lives where?” and “what do we claim they owe?” but **cannot** record that rent was paid, reconcile arrears, dispose deposits after move-out, run maintenance, or rely on reports/aging. Those gaps force parallel spreadsheets for the money that funds the business.

**Release Candidate / public Beta is not justified.**  
**Allowed:** closed design-partner Beta (ops + invoice generation) with explicit “cash book still external until Sprint-11/12,” or continued Conditional Alpha→Beta engineering track.

---

## 2. Overall Product Score

| Dimension | Score | Weight | Delta vs Alpha (5.1) | Notes |
|---|---:|---:|---|---|
| Business workflow completeness (landlord day) | **6.0 / 10** | High | +2.5 | Lifecycle + invoices; **payments still missing** |
| UX / navigation / task success | **6.0 / 10** | High | +1.0 | Finance nav + Home exceptions; pickers/mobile still weak |
| Trust (security, isolation, audit) | **7.5 / 10** | High | ~0 | Strong isolation; privacy/AV/KMS stubs; no payment threat surface yet |
| Performance fitness (30–50 rooms) | **7.0 / 10** | Medium | ~0 | Adequate at this scale; list/cursor polish incomplete |
| Accessibility | **4.5 / 10** | Medium | ~0 | Patterns partial; no WCAG evidence |
| Documentation (operator + program) | **7.0 / 10** | Medium | ~0 | Engineering strong; landlord quickstart still thin |
| Quality / evidence (QA) | **6.0 / 10** | Medium | ~0 | Unit gates strong; staging/e2e/integration DB evidence open |

**Overall Product Score (Beta fitness for 30–50-room landlord): 6.3 / 10**

Interpretation: **Credible closed design-partner / finance-prep Beta candidate**; **not** Release Candidate for a landlord who must collect and trust money in-product. Roadmap **M4** is near-technical; **M5** (financial parallel run) is **not** started for payments/recon.

---

## 3. Business Readiness

### 3.1 Milestone reality vs landlord expectation

| Roadmap milestone | Status (docs + reviews) | Landlord impact |
|---|---|---|
| M1–M2 Platform + isolation | Strong | Trust foundation |
| M3 Inventory operable | Conditional (staging/sign-off historically open) | Can model ~30–50 rooms |
| M4 Lease lifecycle | **Largely technical** (Sprint-09 Conditional Go; staging/human M4 sign-off residual) | Occupancy operable with UI gaps (transfer/notice thin) |
| M5 Financial parallel run | **Incomplete** — Sprint-10 billing only; Sprint-11/12 not implemented | Can invoice; **cannot collect or reconcile** |
| M6 Ops & reports | Not started | No maintenance desk; thin reports |

### 3.2 Complete business workflow (persona walkthrough)

| Step | Landlord need | Beta-candidate status |
|---|---|---|
| 1. Sign up / invite staff | Org + invitations + roles | **Usable** (Accountant role now ACTIVATED in catalog) |
| 2. Define property + rooms/beds | Portfolio CRUD + import | **Usable** |
| 3. See what’s vacant | Availability + occupancy | **Improved** — occupancy state + pending queues; availability still allocation-led |
| 4. Capture prospect / resident | Residents + waitlist + DNR | **Usable** |
| 5. Store ID / lease files | Documents | **Usable** (privacy/AV stubs remain) |
| 6. Create & activate lease | Draft → review → activate | **Usable** |
| 7. Hand keys / move-in | Checklist, occupancy, keys | **Usable** (post Sprint-09 review fixes) |
| 8. Monthly rent due | Charges / invoices | **Usable (billing)** — billing-run → posted invoices |
| 9. Record payment / arrears | Payments / allocation / aging | **Missing (Sprint-11/12)** — **Beta blocker** |
| 10. Renew / move-out / deposit | Lifecycle + deposit *execution* | **Partial** — renew/move-out/terminate usable; deposit **record + preview only**; disposition = Sprint-12 |
| 11. Utilities | Meter grid + allocation | **MVP / thin** — equal-split; evidence/explainability residual |
| 12. Fix a broken AC | Maintenance | **Missing** |
| 13. Morning “what needs me?” | Role-aware dashboard | **Partial** — leasing exceptions + finance note; **no arrears/work orders** |
| 14. Month-end trust | Reports / recon | **Missing** |

**Business readiness rating**

| Question | Answer |
|---|---|
| Setup readiness (inventory → residents → leases) | **Yes** |
| Day-2 occupancy operations | **Conditional Yes** (transfer/notice UI thin; staging evidence open) |
| Day-2 money operations (bill **and** collect) | **No** |
| Beta / RC for unassisted 30–50-room landlord | **No** |
| Closed design-partner Beta (ops + invoice gen + external cash book) | **Conditional Yes** if honestly labeled |

### 3.3 Fit for 30–50 rooms specifically

Scale is not the problem. At 30–50 rooms the operator lives in three loops: **occupancy churn**, **month-start billing**, and **collection**. Loop 1 is largely present; loop 2 is present for rent invoicing; **loop 3 is absent**. A landlord will not replace Excel for rent until cash/bank (or PSP) posts to open invoice balances with receipts.

Canonical vocabulary note: product uses **Unit/Bed**, not Room—persona language “rooms” maps to Units (± Beds). Teaching that vocabulary in onboarding remains weak.

---

## 4. Domain lifecycle evaluation

### 4.1 Room (Unit/Bed) lifecycle

| Capability | Status | Gap for landlord |
|---|---|---|
| Create / status / capacity / beds | Present | ID-heavy pickers still slow |
| Import / bulk | Present | Staging sign-off residual |
| Availability | Present | Must be read with occupancy honesty |
| Occupancy from leases | Present (Sprint-09) | Transfer UI API-first |
| Maintenance / turn costs | Absent | Hallway ops still offline |

**Score: 7.0 / 10** for inventory+occupancy modeling; **not** full unit turn operations.

### 4.2 Tenant (Resident) lifecycle

| Capability | Status | Gap |
|---|---|---|
| Profile / contacts / DNR / waitlist | Present | Combobox depth vs specs |
| Documents | Present | Encryption/AV stubs |
| Lease party roles | Present | Guarantor claim workflows deferred |
| Move-in / move-out | Present | Deposit disposition not executable |
| Portal self-service | Absent | Expected post-staff finance |

**Score: 6.5 / 10** for staff CRM + lease attachment; incomplete money and portal.

### 4.3 Billing

| Capability | Status |
|---|---|
| Schedules / rent charge generation | Present (Sprint-10) |
| Preview → approve → commit | Present (post–Sprint-10 review SoD fixes) |
| Invoices + ledger | Present |
| Credit notes | Present |
| Proration / property TZ rigor | Residual (Sprint-10 review M2) |
| Late-fee batch | Stretch / schema only |

**Score: 7.5 / 10** as billing *foundation*; not full FR-BIL surface.

### 4.4 Payment collection

| Capability | Status |
|---|---|
| Cash / bank record | **Not implemented** (Sprint-11) |
| PSP / webhooks / receipts | **Not implemented** |
| Allocation to invoices | **Not implemented** |
| Arrears / aging desk | **Not implemented** (Sprint-12) |

**Score: 1.0 / 10** — balances visible, collection impossible in-product. **Primary Beta blocker.**

### 4.5 Utility meter workflow

| Capability | Status |
|---|---|
| Meters + bulk readings | MVP present |
| Tariffs / allocation run | MVP equal-split; flag on |
| Evidence-linked consumption billing | Thin / residual |
| Dispute explainability | Insufficient for boarding-house fights |

**Score: 5.0 / 10** — usable for demo; not landlord-trustworthy for contested utilities without SME waiver.

---

## 5. UX Score

**UX Score: 6.0 / 10**

### 5.1 What improved since Alpha

- Home shows leasing pending-action counts and lists (move-in due, expiring, move-out, holdover, checkout).
- Finance navigation: invoices, billing run, deposits, meters, credit notes, utilities.
- Occupancy honesty and finance notes set correct expectations (payments Sprint-11).
- High-risk confirms on billing commit / move-out / void (post reviews).

### 5.2 Dashboard usefulness

**Score: 4.5 / 10** (was 1.5 at Alpha).

Useful for **leasing exceptions**; still fails [dashboard-home.md](../ui/home/dashboard-home.md) intent for a full morning desk (arrears, vacancies as first-class widgets, work orders, import failures, freshness across finance). No arrears KPIs because payments/aging do not exist.

### 5.3 Navigation & task success

| Observation | Impact |
|---|---|
| Portfolio · People · Leasing · Finance · Admin present | Landlord can find invoice paths |
| Transfer / notice largely API-only | Churn workflows incomplete for non-technical staff |
| Lease/resident pickers still often ID-heavy | Error rate at 50 leases |
| Operations Center shows imports + billing runs | Better than Alpha; still thin |
| No guided setup checklist (FR-TEN-010) | Time-to-first-lease still high |

### 5.4 Mobile usability

**Score: 3.0 / 10.** Shell remains desktop-first sidebar. Meter grid and billing commit are poor hallway companions. Treat phone as **unsupported** for Beta RC critical paths.

### 5.5 Accessibility

**Score: 4.5 / 10.** Labels/`role="alert"` appear in newer flows; no automated WCAG 2.2 AA evidence (roadmap M9). Do not claim accessible Beta/RC.

---

## 6. Performance Score

**Performance Score: 7.0 / 10** (30–50 room fitness)

- Adequate for org-scoped lists and month-start billing at this scale if cursors/limits are respected.
- Residual risks from reviews: truncated lists without Load more, UTC-centric billing UI vs property TZ, async billing worker not fully owning generation/resume.
- Not evaluating 10k-unit GA gate (M9)—irrelevant to this persona’s Beta bar, but list polish still matters at 50.

---

## 7. Security & production readiness

### 7.1 Security

| Strength | Residual |
|---|---|
| Org isolation from session (no tenant headers) | Staging isolation suite evidence gaps |
| Deny-by-default RBAC; property grants | Accountant meters/utilities SoD incomplete |
| Money as decimal strings; charge uniqueness post-review | Payment webhook surface not yet built (good until Sprint-11) |
| Audit on sensitive mutations | Document KMS/AV stubs; MFA recovery deferred |

**Security for closed design partners (no live PSP):** Conditional Accept.  
**Security for Beta RC with real PII + live money movement:** **Not ready** until Sprint-11 threat model + staging evidence + privacy stub policy.

### 7.2 Production readiness (Release Candidate bar)

| Gate | Needed for RC | Current |
|---|---|---|
| End-to-end occupancy (M4 human sign-off) | Yes | **Open / Conditional** |
| Invoice + **payment** path | Yes | **Fail** (payments missing) |
| Recon / aging or explicit waive | Yes for money trust | **Fail** |
| Staging demo + SME/PM sign-off | Yes | **Open** (Sprint-09/10 reviews) |
| Integration/isolation green on CI Postgres | Yes | **Partial** (DB-gated suites) |
| Playwright critical paths | Soft→Hard for RC | **Fail evidence** |
| Operator runbook / quickstart | Yes | **Thin** |
| Incident / restore / billing replay notes | Partial | Billing replay runbook exists; full on-call pack incomplete |
| Feature flags / rollback story for utilities | Yes | Flag present; ops playbook thin |

**Production readiness: Not RC.** Engineering quality ≠ release readiness.

---

## 8. Documentation

| Audience | Status |
|---|---|
| Engineers (ADRs, CODING_RULES, sprint reviews) | **Strong** |
| UI specs | **Strong on paper**; ahead of implementation in places |
| Billing replay runbook | **Present** (Sprint-10) |
| Operator “run your boarding house in 7 steps” | **Thin / missing** |
| Honest capability labeling for partners | **Improved** in product copy; marketing must match |

---

## 9. Missing Features

### 9.1 Critical for Beta / RC (blockers or hard waives)

1. **Payment collection** — cash/bank record at minimum; PSP optional for first closed Beta if cash path ships (Sprint-11).  
2. **Arrears / outstanding balances view** — even thin list of unpaid invoices sorted by due date (can start on Sprint-10 data; full aging Sprint-12).  
3. **Staging landlord demo + sign-off** — import → resident → lease → move-in → billing run → (payment when exists).  
4. **Deposit disposition path** — or explicit “deposits tracked, settlement offline” partner contract (Sprint-12).  
5. **M4 human acceptance** — move-in/out/renew on staging with named owner.  
6. **Privacy stub policy** — what PII classes are allowed in closed Beta.

### 9.2 Expected before broad Beta (not all RC-day-one)

- Transfer/notice staff UI (not API-only).  
- Property-TZ proration hardening.  
- Combobox entity pickers; lease list density + Load more.  
- Guided setup checklist.  
- Playwright smoke pack.  
- Utility evidence/explainability or feature-flag off for partners.  
- Maintenance MVP (may stay post-Beta-entry per Alpha allocation).  
- Resident portal pay (stretch even in Sprint-11).

### 9.3 Explicitly not Beta blockers (roadmap honesty)

- Owner distributions / trust accounting.  
- Full GL / tax filing.  
- Marketplace listings.  
- Enterprise SSO/SCIM.  
- 10k-unit load / pen-test (M9 — GA track).

---

## 10. Critical Blockers

| ID | Blocker | Why it kills RC for 30–50 rooms |
|---|---|---|
| B1 | **No payment recording / allocation** | Rent is the business; invoices without collection keep Excel alive |
| B2 | **No arrears/aging desk** | Landlord cannot prioritize who to chase Monday morning |
| B3 | **Staging + human M4/M5-prep sign-off absent** | Cannot claim pilot-ready without evidenced demo |
| B4 | **Deposit settlement not executable** | Move-out ends in “pending finance” forever for real exits |
| B5 | **Mobile unsupported for field ops** | Soft for desk-only RC; hard if partners expect hallway use—label or fix |
| B6 | **A11y/WCAG evidence absent** | Soft for closed Beta; hard for public RC marketing |

---

## 11. Nice-to-have Improvements

| ID | Improvement | Notes |
|---|---|---|
| N1 | Combobox pickers on lease/resident/unit | Alpha P0 residual |
| N2 | Transfer & notice wizards | API exists |
| N3 | Home widgets for unpaid invoices (once payments exist) | Completes morning desk |
| N4 | Plain-language error catalog (top 20 actions) | Support load |
| N5 | Guided setup checklist | FR-TEN-010 |
| N6 | Meter grid keyboard polish | Utility UX |
| N7 | Operator quickstart PDF/doc | Partner enablement |
| N8 | Maintenance request MVP | M6; not money-critical |
| N9 | Notifications for expiry / overdue | After payments |
| N10 | Trailing-zero money display polish | Cosmetic ADR |

---

## 12. Scorecard summary (required return fields)

| Field | Result |
|---|---|
| **Overall Product Score** | **6.3 / 10** |
| **Business Readiness** | **Setup: Yes · Occupancy day-2: Conditional Yes · Money day-2: No · Beta/RC: No** |
| **UX Score** | **6.0 / 10** (Dashboard **4.5 / 10**; Mobile **3.0 / 10**) |
| **Performance Score** | **7.0 / 10** (30–50 room fitness) |
| **Missing Features** | Payments/receipts; arrears/aging/recon; deposit disposition; maintenance; reports catalog; portal; notifications; setup checklist; transfer/notice UI depth; staging evidence |
| **Critical Blockers** | See §10 (esp. **B1 payments**, **B2 arrears**, **B3 staging sign-off**, **B4 deposit settlement**) |
| **Nice-to-have Improvements** | See §11 |
| **Go / No-Go for Release Candidate** | **No-Go** |

---

## 13. Go / No-Go for Release Candidate

### Decision: **No-Go for Release Candidate**

| Gate | Required for RC | Current |
|---|---|---|
| Occupancy end-to-end (M4) | Yes | **Conditional** — code present; staging/human sign-off open |
| Bill + **collect** rent | Yes | **Fail** — collect missing |
| Morning desk (leasing **and** money exceptions) | Yes | **Fail** — money exceptions absent |
| Financial trust (receipts / recon or waive) | Yes | **Fail** |
| Staging demo signed | Yes | **Open** |
| Security for PII + money movement | Yes for money Beta | **Not ready** (payments not shipped; stubs remain) |
| Unassisted 30–50-room week | Yes | **Fail** (cash book still required) |

### What *is* allowed now

**Conditional closed design-partner Beta** (not RC), only if contracts state:

1. Product supports inventory, residents, lease lifecycle, and **invoice generation**.  
2. **Payment recording, arrears, recon, and deposit settlement remain external** until Sprint-11/12.  
3. Utilities are MVP/equal-split unless SME accepts.  
4. Desktop staff UI; mobile unsupported.  
5. Staging demo script exists and is signed before partner data load.

### Revisit RC when

1. Sprint-11 accepted: at least **cash/bank payment record + allocation + receipt**.  
2. Thin **unpaid invoice / arrears** view live (full aging can follow in Sprint-12).  
3. Sprint-09/10 staging demos signed (M4 + billing preview SME).  
4. Deposit disposition policy: executable path **or** written partner waive.  
5. Playwright critical paths + isolation suite green on CI Postgres.  
6. Operator quickstart published.

### Recommended near-term allocation (product agreement)

| Track | Focus | Outcome |
|---|---|---|
| **Sprint-11** | Payments + receipts (cash/bank first if PSP KYC slips) | Unblocks money Beta |
| **Sprint-12 thin** | Arrears view + deposit disposition MVP | Morning desk + exit trust |
| **Parallel** | Staging sign-off, pickers, transfer UI, Playwright, operator quickstart | RC evidence |
| **Defer past RC entry** | Full maintenance module, rich reports, portal depth, 10k/pen-test | Per roadmap M6–M9 |

---

## 14. Closing note

Alpha asked: “Will a landlord with 40 rooms trust it tomorrow morning?” After Sprint-09/10 the honest answer is: **for who lives where and what we billed—increasingly yes; for who paid and what is overdue—still no.**

Engineering through Sprint-10 is **Release-Candidate-quality foundations with incomplete product loops**. Labeling this a Release Candidate would over-claim financial readiness and burn partner trust. Ship **Sprint-11 collection**, prove staging demos, then reconsider RC under an explicitly scoped closed Beta—not a public money-complete release.
