# UI Master Spec — Design Review

**Document under review:** [`UI_MASTER_SPEC.md`](./UI_MASTER_SPEC.md)  
**Review date:** 2026-07-24  
**Review roles:** Principal Product Designer · UX Architect · Frontend Architect · Design System Reviewer  
**Method:** Spec-only audit against companion norms (`design-system.md` v2, `07-ui-design.md`, `navigation.md`, `cross-cutting-patterns.md`, redesign Phase-01…10). No application code inspected for this review verdict.

**Spec updates applied from this review:** see Changelog (Revision B) at the end of [`UI_MASTER_SPEC.md`](./UI_MASTER_SPEC.md).

---

## 1. Executive verdict

The Master Spec is a **strong commercial north star**: clear anti-goals, coherent near-black + cool-blue posture, exception-first dashboard intent, and a phased roadmap that respects frozen APIs/business logic. It is **not yet implementation-complete** as a sole engineering contract: dark tokens were partial, several companion docs still conflict on layout constants, mobile IA destinations were underspecified, performance was absent, and theme/i18n sequencing was too late relative to primitive work.

**Final recommendation: Approve with Changes** (must-fix items landed in Master Spec Revision B; remaining companion-doc sync tracked as follow-ups).

---

## 2. Evaluation by dimension

### 2.1 Product vision — **8.5 / 10**

**Strengths**

- Mission correctly scopes a *visual/interaction* modernization without inventing features.
- Quality bar (premium, calm, enterprise trust for money) matches RPM’s finance + occupancy risk profile.
- Frozen-assumption framing prevents scope creep.

**Issues**

| ID | Problem | Why it hurts | Best practice | Spec action |
|---|---|---|---|---|
| V-1 | Vision did not name **buyer proof points** as measurable outcomes | Teams optimize aesthetics over operator throughput | Tie vision to measurable UX outcomes | Added §2.4 Success metrics |
| V-2 | “World-class 2026” risked over-designing auth/marketing moments | Chrome becomes ornamental | Keep product chrome utilitarian; display type rare | Clarified in §2.2 |

### 2.2 Design philosophy — **9 / 10**

**Strengths:** Quiet chrome / loud content; borders before shadows; status ≠ color; motion restraint — excellent and consistent with design-system v2.

**Issues**

| ID | Problem | Why | Best practice | Spec action |
|---|---|---|---|---|
| P-1 | Density modes not first-class | Finance desks fork CSS | Explicit `data-density` contract | Added §3.1 |

### 2.3 Information architecture — **7 / 10**

**Strengths:** Correct Org → Property → domain hierarchy; defers to `navigation.md`; multi-shell awareness.

**Issues**

| ID | Problem | Why | Best practice | Spec action |
|---|---|---|---|---|
| IA-1 | Long Finance nav overflow undefined | Sidebar noise; lost active item | Scroll region + sticky section labels | Added §8.2.1 |
| IA-2 | Mobile bottom-nav destinations undefined | Phase-06 inconsistency | Specify primary tabs + More | Added §7.4 |
| IA-3 | Portal / platform IA only one-liners | Shell drift | Short IA per shell | Added §11.1 |
| IA-4 | Screen specs still cite **240 px / 1600** vs Master **248 / 1440** | Wrong constants in build | Master wins; sync companions | Added §0 Precedence |

### 2.4 Visual hierarchy — **7.5 / 10**

**Strengths:** Type scale and metric anatomy; anti-vanity KPI stance.

**Issues**

| ID | Problem | Why | Best practice | Spec action |
|---|---|---|---|---|
| H-1 | No page header anatomy | Inconsistent title rows | Standard title block | Added §8.0 |
| H-2 | Accent vs primary CTA competition undefined | Missed next action | One primary per region | Clarified in §8.0 |

### 2.5 Color system — **7 / 10**

**Strengths:** Near-black primary + cool blue accent; semantic families; light tokens mostly complete.

**Issues**

| ID | Problem | Why | Best practice | Spec action |
|---|---|---|---|---|
| C-1 | Dark theme table incomplete | Theme phase invents values | Full light↔dark parity | Expanded §4.6 |
| C-2 | `--primary-hover` / `--secondary` were prose | Non-deterministic CSS | Exact values | Specified §4.5–4.6 |
| C-3 | Info ≡ Accent (same blue) | Badges ≈ links | Document merge + soft distinction | Added §4.9 |
| C-4 | Chart amber/rose without hex | Inconsistent charts | Full chart tokens | Added §4.10 |
| C-5 | No forced-colors note | Enterprise a11y gap | Document `forced-colors` | Added §8.14.1 |

### 2.6 Typography — **8 / 10**

**Strengths:** Clear scale; tabular nums; sentence case; prose measure. Inter is acceptable because design-system v2 already locked it.

**Issues**

| ID | Problem | Why | Best practice | Spec action |
|---|---|---|---|---|
| T-1 | No font-loading policy | CLS / FOUT | Loading + fallback rules | Added §5.4 |
| T-2 | No VI diacritic / expansion note | Clipped nav/legal labels | Line-box tolerance; no critical truncation | Added §5.5 |

### 2.7 Spacing — **8.5 / 10**

**Strengths:** 4 px base; clear layout constants; form/table/card rhythm.

**Issues**

| ID | Problem | Why | Best practice | Spec action |
|---|---|---|---|---|
| S-1 | `space.*` multiplier mapping ambiguous | Token confusion | Explicit table | Clarified §6.1 |
| S-2 | Full-canvas workspaces unbounded | Unreadable wide tables | Full-bleed rules | Added §6.2.1 |

### 2.8 Component consistency — **6.5 / 10**

**Strengths:** Points at design-system for buttons/tables/cards.

**Issues**

| ID | Problem | Why | Best practice | Spec action |
|---|---|---|---|---|
| CMP-1 | Radius/shadow absent from master | Dual-doc hunting | Canonical summaries | Added §6.5–6.6 |
| CMP-2 | No state-matrix pointer | Inconsistent interaction | Mandate design-system §§9–10 | Added §8.15 |
| CMP-3 | No z-index scale | Overlay bugs | Stacking scale | Added §6.7 |

### 2.9 Layout strategy — **8 / 10**

Good shell constants and grid. Banner stack order was missing → §8.3.1.

### 2.10 Dashboard UX — **8.5 / 10**

Exception-first is correct. Widget error isolation / freshness reinforced via Phase-02 cross-link in §8.4.

### 2.11 Forms UX — **8 / 10**

Solid. Added form surface decision tree (§8.5.1) and SoD pointer to cross-cutting patterns.

### 2.12 Tables UX — **8 / 10**

Strong density/toolbar rules. Added empty vs filtered-empty (§8.6.1).

### 2.13 Navigation / Sidebar — **7.5 / 10**

See IA. Added overflow + keyboard (§8.2.1–8.2.2).

### 2.14 Responsive / Mobile / Desktop — **7.5 / 10**

Excellent width matrix. “All features on mobile” needed **task-shaped** presentation for heavy workspaces (§7.5–7.6).

### 2.15 Accessibility (WCAG 2.2 AA) — **7.5 / 10**

Expanded §8.14 into testable requirements; live regions; forced-colors.

### 2.16 Theme — **7 / 10**

Runtime pointers good; dark token gap was critical (C-1) — addressed in Revision B.

### 2.17 Internationalization — **7.5 / 10**

EN/VI + glossary + no currency-from-locale are correct. Added program rules (§8.16).

### 2.18 Animation — **8.5 / 10**

150–180 ms core is right. Locale switch: instant content swap; optional ≤150 ms fade.

### 2.19 Performance — **3 / 10 (pre-fix) → addressed**

Critical gap filled in §14 (fonts, list virtualization threshold, skeleton budget, FOUC).

### 2.20 Implementation roadmap & dependencies — **6.5 / 10 (pre-fix) → addressed**

| ID | Problem | Why | Best practice | Spec action |
|---|---|---|---|---|
| PH-1 | Theme/i18n after primitives | Rework | Token lock early; i18n parallel | Rewrote §12.1 |
| PH-2 | Dashboard before primitives | One-off widgets | 01 → tokens → 03 → 02/04/05 | Updated sequencing |
| PH-3 | No RACI / exit | Phases stall | Sign-off roles | Added §12.3 |
| PH-4 | No contingency on effort | Under-plan | 20% buffer note | Added §12.4 |

### 2.21 Missing specifications (inventory)

| Missing item | Severity | Disposition |
|---|---|---|
| Full dark token parity | Critical | Fixed Revision B |
| Normative precedence vs screen specs | Critical | Fixed §0 |
| Mobile bottom-nav set | High | Fixed §7.4 |
| Performance / virtualization | High | Fixed §14 |
| z-index scale | High | Fixed §6.7 |
| Radius/shadow in master | Medium | Fixed §6.5–6.6 |
| Page header anatomy | Medium | Fixed §8.0 |
| Density attribute | Medium | Fixed §3.1 |
| Command palette visual spec | Medium | Pointer; Phase-01 owns detail |
| Brand wordmark rules | Medium | Fixed §11.2 |
| Chart token hex completeness | Medium | Fixed §4.10 |
| Illustration system | Low | Explicit non-goal (icon + text) |
| Print / PDF UI | Low | Explicit non-goal |

### 2.22 Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Dual norms (Master vs ui/design-system v2 vs root indigo baseline) | High | Theme regress | Precedence §0 |
| “Full features” mobile → unusable finance grids | High | Operator rejection | Task-shaped mobile §7.5 |
| Late theme/i18n (pre-B) | High | Rework | Resequence §12.1 |
| Incomplete dark tokens (pre-B) | High | A11y fail | §4.6 parity |
| Finance nav overload | Medium | Lost orientation | §8.2.1 |
| Screen-spec constant drift | Medium | Layout bugs | Companion sync backlog |
| VI expansion clipping | Medium | Truncated legal terms | §5.5 |
| Toast misuse for payments | Medium | Trust failure | Reinforce Phase-03 AC |

---

## 3. Scores

| Dimension | Score |
|---|---:|
| Product vision | 8.5 |
| Design philosophy | 9.0 |
| Information architecture | 7.0 |
| Visual hierarchy | 7.5 |
| Color system | 7.0 |
| Typography | 8.0 |
| Spacing | 8.5 |
| Component consistency | 6.5 |
| Layout strategy | 8.0 |
| Dashboard UX | 8.5 |
| Forms UX | 8.0 |
| Tables UX | 8.0 |
| Navigation / Sidebar | 7.5 |
| Responsive / Mobile / Desktop | 7.5 |
| Accessibility | 7.5 |
| Theme | 7.0 |
| Internationalization | 7.5 |
| Animation | 8.5 |
| Performance (pre-fix) | 3.0 |
| Roadmap / dependencies (pre-fix) | 6.5 |
| **Overall (post–Revision B intent)** | **7.8** |

### Overall Score (0–10): **7.8**

### Readiness Score for Implementation: **6.5 / 10**

Ready to start **Phase-01 (layout) + early token lock** after Revision B acceptance.  
**Not ready** for broad feature restyles until Phase-03 primitives accept and companion constants (248 / 1440) are synced.

---

## 4. Critical issues

1. **Incomplete dark semantic tokens** (pre-B) — blocked Theme and AA sign-off.  
2. **No normative precedence** vs older screen specs (240/1600 vs 248/1440).  
3. **Roadmap put Theme/i18n too late** (pre-B) — guaranteed rework.  
4. **Missing performance / large-list strategy** — 10k Units without virtualization threshold.  
5. **Mobile full-feature claim without task-shaped UX** for heavy workspaces.

---

## 5. Recommended improvements

### Must (blocking beyond shell spike) — addressed in Revision B

- [x] Complete dark token matrix + concrete hover/secondary values  
- [x] Declare Master Spec precedence; track companion sync  
- [x] Resequence phases: token lock early; i18n parallel  
- [x] Define mobile primary destinations + heavy-workspace mobile pattern  
- [x] Add performance section  

### Should (before Phase-03 exit)

- [ ] Sync `dashboard-home.md` and other screens to 248 / 1440  
- [ ] Primitive state matrix in Storybook (or equivalent)  
- [ ] Pseudo-loc CI gate for VI expansion  
- [ ] Command palette chrome brief under Phase-01  

### Could

- [ ] Optional font ADR only if Inter fails brand bar in visual QA  
- [ ] Empty-state illustration system (remain icon-first)

---

## 6. Final recommendation

### **Approve with Changes**

Revision B of [`UI_MASTER_SPEC.md`](./UI_MASTER_SPEC.md) incorporates the must-fix items above.

**Do not** treat the pre-B Master Spec alone as an engineering build contract.

**Next gates**

1. Design + FE accept Revision B.  
2. Sync conflicting screen-spec constants (248 sidebar, 1440 content max).  
3. Enter Phase-01 with parallel token-lock checklist (Phase-07 work pulled forward).  
4. Hold broad page restyles until Phase-03 acceptance.

---

## 7. Review metadata

| Field | Value |
|---|---|
| Reviewer stance | Defect-first, implementation-readiness |
| Application code changes | None |
| Spec changes | `UI_MASTER_SPEC.md` Revision B |
| Related | [`redesign/README.md`](./redesign/README.md) |
