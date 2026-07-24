# Alpha Product Review

**Review ID:** RPM-ALPHA-PRODUCT-01  
**Review date:** 2026-07-24  
**Roles applied:** Product Manager · UX Designer · QA Lead · Principal Software Architect  
**Release channel evaluated:** **Alpha** (pre-GA SemVer `0.0.0`; engineering through **Sprint-08**)  
**Persona lens:** Owner-operated or small professional manager running **~30–50 rentable rooms** (Units and/or Beds in one or few Properties)  
**Normative baselines:** [00-overview.md](../00-overview.md) · [01-business-requirements.md](../01-business-requirements.md) · [navigation.md](../navigation.md) · [project-roadmap.md](../project-roadmap.md) · [Sprint-08-Review.md](./Sprint-08-Review.md) · UI specs under `docs/ui/`  
**Method:** Docs-as-truth + implemented staff surface evidence. **No code changes** in this review.

---

## 1. Executive verdict

This Alpha is a **credible operational scaffolding** for portfolio setup, people records, documents, and **contractual** lease draft/activation—not yet a daily operating system for a 30–50-room landlord.

A landlord can: create Organization access, import/maintain inventory, enroll residents (with DNR/waitlist), attach documents, and create/activate leases with overlap protection and money fields. They **cannot**: move someone in, renew/terminate with occupancy truth, invoice or collect rent, track arrears, run maintenance, see a useful morning dashboard, or rely on resident self-service.

**Beta is not justified** until lease lifecycle (M4 / Sprint-09) and a minimal finance path (or an explicitly scoped “ops-only Alpha pilot” with parallel spreadsheets) exist, plus staging demo evidence and a usable Home dashboard for the 30–50 room day.

---

## 2. Overall Product Score

| Dimension | Score | Weight | Notes |
|---|---:|---:|---|
| Business workflow completeness (landlord day) | **3.5 / 10** | High | Stops at activated lease; occupancy & money missing |
| UX / navigation / task success | **5.0 / 10** | High | Shell & domains exist; Home empty; wizards ID-heavy |
| Trust (security, isolation, audit) | **7.5 / 10** | High | Strong Alpha foundation; privacy stubs remain |
| Performance fitness (30–50 rooms) | **7.0 / 10** | Medium | Adequate at this scale; list polish incomplete |
| Accessibility | **4.5 / 10** | Medium | Partial patterns; no WCAG evidence |
| Documentation (operator + program) | **7.0 / 10** | Medium | Rich engineering docs; thin operator onboarding |
| Quality / evidence (QA) | **6.0 / 10** | Medium | Unit gates strong; staging/e2e thin |

**Overall Product Score (Alpha fitness for 30–50-room landlord): 5.1 / 10**

Interpretation: **Acceptable as engineering Alpha / controlled design-partner preview**; **not** acceptable as primary rental OS for Beta-caliber pilots.

---

## 3. Business Readiness

### 3.1 Milestone reality vs landlord expectation

| Roadmap milestone | Status | Landlord impact |
|---|---|---|
| M1–M2 Platform + isolation | Technically strong | Invisible but necessary trust |
| M3 Inventory operable | Conditional (staging/sign-off open) | Can model ~30–50 rooms |
| M4 Lease lifecycle | **Incomplete** (Sprint-08 only; Sprint-09 not started) | Contract without move-in/out |
| M5+ Finance / ops / reports | Not started | No rent collection or ops desk |

### 3.2 Complete business workflow (persona walkthrough)

| Step | Landlord need | Alpha status |
|---|---|---|
| 1. Sign up / invite staff | Org + invitations + roles | **Usable** |
| 2. Define property + rooms/beds | Portfolio CRUD + import | **Usable** (wizard depth varies) |
| 3. See what’s vacant this week | Availability + occupancy from leases | **Partial** — availability lookup exists; occupancy still contractual-only until Sprint-09 |
| 4. Capture prospect / resident | Residents + waitlist + DNR | **Usable** |
| 5. Store ID / lease files | Documents library | **Usable** (AV/encryption stubs) |
| 6. Create & activate lease | Draft → review → activate | **Usable** (post Sprint-08 review fixes) |
| 7. Hand keys / move-in | Checklist, occupancy flip | **Missing** (Sprint-09) |
| 8. Monthly rent due | Charges / invoices | **Missing** (Sprint-10+) |
| 9. Record payment / arrears | Payments / allocation | **Missing** |
| 10. Renew / move-out / deposit | Lifecycle + finance preview | **Missing** |
| 11. Fix a broken AC | Maintenance | **Missing** |
| 12. Morning “what needs me?” | Role-aware dashboard | **Missing** (Home is skeleton copy) |

**Business readiness rating:** **Alpha setup readiness — Yes (conditional)** · **Day-2 operations readiness — No** · **Beta readiness — No**

### 3.3 Fit for 30–50 rooms specifically

At 30–50 rooms the product’s **data model and isolation model fit**; the **job-to-be-done gap** is not scale—it is **missing middle of the rental loop** (occupancy + money). A small landlord will abandon a system that activates leases but still forces Excel for who lives where and who paid.

---

## 4. UX Score

**UX Score: 5.0 / 10**

### 4.1 What works

- Clear domain grouping in staff shell: Portfolio · People · Leasing · Admin.
- Permission-aware nav for People/Leasing/Imports reduces dead ends for limited roles.
- Property scope selector supports multi-property managers (even at 1–2 properties).
- High-risk activate workspace includes consequence copy and checklist (aligned with lease-activate intent).
- Occupancy honesty in lease copy (“vacant until move-in”) prevents over-claiming ACTIVE as moved-in—good product ethics for Alpha.

### 4.2 Navigation

| Observation | Impact |
|---|---|
| Finance / Maintenance / Communications / Reports absent from shell | Correct vs scope; landlord still expects them → perceived incompleteness |
| Home (`/app`) still says “shell skeleton / domain modules not wired” | **Trust-breaking** for Alpha demos |
| Operations Center link present with thin substance | Risk of “fake ops” perception |
| Documents under People vs top-level Documents in IA | Acceptable Alpha; may confuse “lease files vs resident files” |
| No guided setup checklist (FR-TEN-010) | New orgs lack a “first 14 days” path |

### 4.3 Dashboard usefulness

**Score: 1.5 / 10.** Spec ([dashboard-home.md](../ui/home/dashboard-home.md)) calls for exception-first widgets (vacancies, expiring leases, arrears, work orders). Implementation is a placeholder title/blurb. For 30–50 rooms, the morning dashboard is the primary UX; Alpha fails this bar.

### 4.4 Mobile responsiveness

Specs define drawer/bottom-nav patterns; implemented shell is **desktop-first sidebar**. Tables and wizards will be painful on phone for a landlord walking a hallway. Treat mobile as **not Alpha-qualified** for core workflows (create lease, activate, import).

### 4.5 Interaction quality gaps (30–50 room ops)

- Lease/resident/unit pickers still too **UUID / ID-entry** heavy vs searchable combobox specs.
- Lease list: limited filters/pagination (“Load more”) vs dense weekly scanning.
- Resident detail / lease detail depth thinner than UI specs (tabs, activity, emergency contacts).
- Empty and error states exist in places but are inconsistent; Home empty state is misleading (“not wired”).

---

## 5. Missing Features

### 5.1 Blockers for Beta (must exist or explicitly waive)

1. **Move-in / occupancy truth** (Sprint-09) — without this, availability and “who lives in room 12” stay unreliable.  
2. **Move-out / terminate / renew-or-transfer** — churn is constant at 30–50 rooms.  
3. **Expiring / pending-action lists** — Alpha has no “leases ending in 30 days” desk.  
4. **Minimal receivables path** — at least charge + invoice + record payment (even offline/cash) before calling Beta.  
5. **Role-aware Home dashboard** — vacancies, activations pending move-in, DNR flags, import failures.  
6. **Operator onboarding checklist** — first Property → inventory → resident → lease → move-in.  
7. **Staging demo + human sign-off** for S06–S08 paths (still process-open in reviews).

### 5.2 Expected soon after Beta entry (not Beta launchers, but planned)

- Recurring billing runs, deposits ledger, meters (Sprint-10–12).  
- Maintenance requests / work orders (roadmap M6).  
- Resident portal (specified, not implemented as staff-parity).  
- Notifications / reminders.  
- Reports catalog (occupancy, arrears).  
- Accountant role productized (Sprint-08 residual).  
- Application pipeline / e-sign (deferred by design).

### 5.3 Explicitly out of MVP (do not confuse with Alpha gaps)

- Owner distribution / trust accounting.  
- Full GL / tax filing.  
- Marketplace / public listings.  
- Two-way messaging (Phase 2).  
- Enterprise SSO/SCIM.

---

## 6. Cross-cutting quality evaluation

### 6.1 Validation

| Area | Verdict |
|---|---|
| Contracts Zod on leases/money/inventory/residents | **Strong** for Alpha |
| Activate checklist / DNR override reason | **Improved** (Sprint-08 review) |
| Wizard client validation depth | **Uneven** — server catches many cases late |
| Import row-level errors | **Present** (Sprint-06) — critical for 30–50 bulk seed |

### 6.2 Error messages

| Area | Verdict |
|---|---|
| RFC 9457 problem+json + domain codes | **Architecturally good** |
| Staff UI mapping of codes to plain language | **Partial** — often raw API message |
| Cross-org / out-of-scope | Correct non-disclosure (404) — good security UX tradeoff |
| Concurrency (412 If-Match) | Present; recovery UX thin (“refresh and retry” guidance incomplete) |

### 6.3 Performance (30–50 rooms)

Adequate for Alpha list/detail if cursors are used. Risks: truncated lists without Load more, N+1 patterns under PM scope, import jobs without clear progress UX for nervous first-time importers. **Not** the 10k problem yet—but Alpha should still feel snappy at 50 units.

### 6.4 Security

| Strength | Residual risk |
|---|---|
| Org isolation from session (no tenant headers) | Staging isolation evidence gaps |
| Deny-by-default RBAC + property grants | Accountant story incomplete |
| Memory access token + HttpOnly refresh | MFA recovery deferred |
| Audit on sensitive mutations | Identifier encryption placeholder; AV stub |
| Lease activate / DNR override gated | Document privacy maturity not production-grade |

**Security posture for Alpha design partners: Conditional Accept.** **Security posture for Beta with real PII + payments: Not yet.**

### 6.5 Accessibility

Labels/alerts appear in newer flows; no automated a11y suite; mobile/keyboard/reflow unverified against WCAG 2.2 AA (roadmap M9). **Alpha: weak.** Do not claim accessible Beta.

### 6.6 Documentation

| Audience | Status |
|---|---|
| Engineers (ADRs, CODING_RULES, sprint reviews) | **Strong** |
| UI specs (full IA) | **Strong on paper**; ahead of implementation |
| Operator runbooks / landlord quickstart | **Thin** — deployment/incident exist; no “run your boarding house in 7 steps” |
| README / PROJECT_STATE drift | Historical drift noted; treat sprint reviews as current |

---

## 7. High Priority Improvements

Ordered for Alpha → Beta path (product + UX + QA + architecture agreement):

| # | Improvement | Why (30–50 rooms) | Owner lens |
|---|---|---|---|
| P0 | **Replace Home skeleton** with exception widgets (vacant units, draft leases, DNR, imports needing attention) | Morning desk is the product | PM + UX + Eng |
| P0 | **Ship Sprint-09 lifecycle** (move-in, renew/transfer, move-out, pending lists) | Completes M4; makes leases operational | Eng + QA |
| P0 | **Staging landlord demo script** + sign-off (import → resident → lease activate → move-in) | Alpha credibility | PM + QA |
| P0 | **Combobox entity pickers** on lease wizard / allocations | Speed & error rate on phones/desks | UX + Eng |
| P1 | **Minimal finance slice** (charge → invoice → record cash/bank payment) before Beta label | Rent is the business | PM + Eng |
| P1 | **Lease list density** — status/property/resident filters, cursor Load more, expiry cues | Weekly scanning at 50 leases | UX + Eng |
| P1 | **Plain-language error catalog** for top 20 landlord actions | Support load | UX + Eng |
| P1 | **Guided setup checklist** (FR-TEN-010) | Time-to-first-lease metric | PM + UX |
| P1 | **Close privacy stubs policy** (KMS IDs, external AV) or restrict Alpha data classes | Trust | Security + PM |
| P1 | **Playwright critical paths** (login → create unit → create resident → activate lease) | QA gate for Beta | QA |

---

## 8. Low Priority Improvements

| # | Improvement | Notes |
|---|---|---|
| L1 | Recurring charges UI on lease wizard | Can wait until finance sprint |
| L2 | Buildings depth / amenity richness | Nice-to-have at 1 property |
| L3 | Global search / notifications center | Spec exists; low Alpha ROI |
| L4 | Money trailing-zero display polish | ADR-compliant enough |
| L5 | Domain layer Nest-exception purity | Engineering hygiene |
| L6 | Mixed-type DB EXCLUDE trigger | Defense-in-depth |
| L7 | Create-lease Idempotency-Key | Correctness polish |
| L8 | Visual design density pass | After workflow completeness |
| L9 | Resident portal MVP | After staff lifecycle + invoices exist |
| L10 | Doc drift cleanup (README/PROJECT_STATE) | Ongoing hygiene |

---

## 9. Recommended Sprint Allocation

Assume **2-week sprints**; sequence optimized for landlord Beta entry—not pure roadmap purity where product risk is higher.

| Sprint | Focus | Outcome for 30–50-room Alpha→Beta |
|---|---|---|
| **S09** (planned) | Lease lifecycle: move-in, renew/transfer, move-out, pending/expiry lists | **M4 technical**; occupancy usable |
| **S09.5 / polish buffer** (0.5–1 sprint) | Home dashboard v1, combobox pickers, lease list UX, setup checklist, Playwright smoke | Alpha feels like a product |
| **S10** (planned) | Charges, invoices, meters foundation | Landlord can bill on paper parity |
| **S11** (planned) | Payments record/allocate (cash/manual OK) | Collection desk begins |
| **S12** (planned) | Reconciliation / control plane thin | Finance trust for pilot |
| **Parallel track** | Staging evidence, privacy hardening decisions, Accountant role, operator quickstart doc | Beta gate evidence |
| **Defer past Beta entry** | Full maintenance module, rich reports, portal depth, SSO | Per roadmap M6+ |

**Do not** start Sprint-10 UI before Sprint-09 occupancy: billing against “ACTIVE but vacant” will teach wrong habits.

---

## 10. Go / No-Go for Beta

### Decision: **No-Go for Beta**

| Gate | Required for Beta | Current |
|---|---|---|
| End-to-end lease + occupancy (M4) | Yes | **Fail** — activate only |
| Minimal rent collect path | Yes (or explicit waive) | **Fail** |
| Useful Home / pending work | Yes | **Fail** |
| Staging demo + sign-off | Yes | **Open** |
| Security for PII+money | Yes for paid Beta | **Conditional / stubs** |
| A11y critical paths | Soft for closed Beta; hard for public Beta | **Fail evidence** |
| 30–50 room task success (unassisted) | Yes | **Fail** (workflow hole) |

### Allowed now (not Beta)

**Conditional Alpha continue** for:

- Design partners configuring inventory + residents + draft/activated leases **with parallel spreadsheets** for occupancy and money.  
- Internal dogfood / sales demos that **honestly label** “contract Alpha — move-in & billing next.”  
- Engineering progression to Sprint-09 without marketing Beta.

### Revisit Beta when

1. Sprint-09 accepted (move-in/out/renew + pending lists).  
2. Home dashboard shows actionable exceptions for a 50-unit org.  
3. At least manual invoice + payment recording ships **or** Beta is contractually “ops-only” (rare; not recommended).  
4. Staging script signed by PM + named landlord persona.  
5. Critical Playwright paths green; isolation suite green on CI Postgres.

---

## 11. Scorecard summary (required fields)

| Field | Result |
|---|---|
| **Overall Product Score** | **5.1 / 10** |
| **Business Readiness** | **Alpha setup: Conditional Yes · Daily ops: No · Beta: No** |
| **UX Score** | **5.0 / 10** (Dashboard **1.5 / 10**) |
| **Missing Features** | Move-in/out/renew; finance; dashboard; maintenance; portal; notifications; reports; setup checklist; entity comboboxes; staging evidence |
| **High Priority Improvements** | See §7 (P0: Home, Sprint-09, staging demo, pickers; P1: finance slice, list UX, errors, checklist, privacy policy, Playwright) |
| **Low Priority Improvements** | See §8 |
| **Recommended Sprint Allocation** | See §9 (S09 → polish → S10–12; evidence parallel) |
| **Go / No-Go for Beta** | **No-Go** — continue **Conditional Alpha**; target Beta after M4 + minimal finance + Home + evidence |

---

## 12. Closing note

Engineering quality through Sprint-08 is **disproportionately strong relative to product completeness**—isolation, money ADR, allocation constraints, and activate gates are the right foundations for a serious SaaS. The Alpha risk is not “will it scale to 10k?” for this persona; it is “will a landlord with 40 rooms trust it tomorrow morning?” Today the honest answer is **not yet**. Ship lifecycle and a useful Home before any Beta label.
