# Phase-01 Application Layout — Design Review

**Document under review:** [`../phases/Phase-01-Application-Layout.md`](../phases/Phase-01-Application-Layout.md)  
**Review date:** 2026-07-24  
**Baseline:** [`../UI_MASTER_SPEC.md`](../UI_MASTER_SPEC.md) **Revision B (approved)** · [`../UI_MASTER_SPEC_REVIEW.md`](../UI_MASTER_SPEC_REVIEW.md) · [`../design-system.md`](../design-system.md)  
**Review roles:** Principal UX Architect · Principal Product Designer · Senior Frontend Architect · Enterprise Design System Reviewer  

**Method:** Spec-only audit. No application code reviewed or changed for product behavior.  
**Spec updates from this review:** Phase-01 **Revision C** (see changelog in that file).

---

## 1. Executive verdict

Phase-01 is a **strong, implementation-shaped chrome contract**: geometry (248/64/56), banner stack, responsive matrix (320–1920), permission-aware nav, a11y/keyboard, and empty/loading/error shell rules align well with Master Spec Revision B.

It was **not yet ship-ready** as written: several **normative ambiguities** (content alignment, Org/Property placement), an **IA gap** (Maintenance / Communications / Reports missing from sidebar groups vs `navigation.md`), a **tablet rail exception** that conflicted with “drawer below 1024”, and **insufficient CLS/banner height** rules.

**Final verdict: Approve with Changes** — must-fix items applied in Phase-01 Revision C.

---

## 2. Evaluation by dimension

### 2.1 Alignment with UI_MASTER_SPEC Revision B — **8.5 / 10**

**Strengths**

- Constants match: sidebar 248/64, top bar 56, gutters 16/20/24, content max 1440, workspace full-bleed flag, motion ≤180 ms, token lock parallel, EN/VI chrome, vocabulary.
- Banner stack order matches Master §8.3.1.
- Mobile bottom nav set matches Master §7.4.
- Task-shaped heavy workspaces correctly deferred (chrome only).

**Issues**

| ID | Problem | Impact | Best solution | Disposition |
|---|---|---|---|---|
| A-1 | Content alignment left as “centered **or** start-aligned” | Layout thrash across pages; inconsistent denseness | **Normative: start-aligned** + `max-width: 1440` | Fixed Rev C |
| A-2 | Desktop ASCII implies sidebar toggle always present | Engineers ship useless control in expanded mode | Toggle only in rail/drawer modes | Fixed Rev C |
| A-3 | 1440 max-width vs viewport math under-explained | Confusion when 1440 viewport ≠ 1440 content | Document `min(1440, main width)` | Fixed Rev C |

### 2.2 Information architecture — **6.5 / 10 → improved**

**Strengths:** Org → Property → domain hierarchy; permission hide; portal/platform separation; no invented domains claimed.

**Issues**

| ID | Problem | Impact | Best solution | Disposition |
|---|---|---|---|---|
| IA-1 | Sidebar groups omit **Maintenance**, **Communications**, **Reports** present in `navigation.md` | Future modules / current IA drift; scalability failure | Add groups; keep order stable; permission-filter; Documents as top-level (not under People) | Fixed Rev C |
| IA-2 | “Shell” group only for Operations is easy to misread as meta-nav | Operators look under Admin | Rename label to **Operations** section or keep Shell with glossary note | Fixed Rev C (`shell.sectionOperations`) |
| IA-3 | No **nav registry / extension** rule for future domains | Ad-hoc sidebar edits later | Document append-only group registry | Fixed Rev C |

### 2.3 Layout hierarchy — **8 / 10**

Banner → top bar → sticky context → main (page header → content) is correct and calm.

| ID | Problem | Impact | Best solution | Disposition |
|---|---|---|---|---|
| H-1 | Sticky **page header** unspecified | Teams may pin H1 and collide with table sticky headers | Page header **scrolls with main** by default; only top bar + context bar + banners sticky | Fixed Rev C |
| H-2 | z-index interaction with Phase-05 table sticky headers not stated | Covering bugs | Reference Master §6.7; context bar `z.sticky`; table headers ≤ sticky | Fixed Rev C |

### 2.4 Sidebar design — **8 / 10**

Widths, active (≥2 cues), hover, icons, sticky section labels, rail tooltips: excellent and design-system aligned.

| ID | Problem | Impact | Best solution | Disposition |
|---|---|---|---|---|
| S-1 | Org/Property “sidebar **or** top bar” | Duplicate switchers; Master review risk | **Canonical:** Org + Property primaries in **top bar / sticky context**; sidebar shows read-only org display name only | Fixed Rev C |
| S-2 | No pinned sidebar footer (collapse control / density) | Collapse affordance orphaned | Footer: collapse toggle; optional density later | Fixed Rev C |
| S-3 | Rail hit target 64×36 may be tight on pointer laptop | Mis-taps | Icon button hit area ≥36×36 centered in 64 rail | Fixed Rev C |

### 2.5 Header design — **8 / 10**

Zones, search 420, locale/theme/user, notifications vs Operations: good.

| ID | Problem | Impact | Best solution | Disposition |
|---|---|---|---|---|
| HD-1 | Trailing cluster overcrowded at 1280 with locale+theme+ops+help | Truncation / overflow menus undocumented | Progressive disclosure: ≥1440 full; 1280–1439 overflow “Display” menu for locale+theme | Fixed Rev C |
| HD-2 | Design-system §16 puts scope chips on the right; Phase-01 puts context mid-left | Mild dual-norm confusion | Affirm Master/Phase: context after wordmark; trailing = utilities | Noted; Phase-01 wins per Master precedence |

### 2.6 Navigation UX — **8 / 10**

Org switch isolation, bottom nav substitution, portal isolation: strong.

| ID | Problem | Impact | Best solution | Disposition |
|---|---|---|---|---|
| N-1 | Active ancestor routes (e.g. `/leases/:id`) only partially specified | Wrong item highlighted | Match prefix rules already used in app; document list vs detail | Fixed Rev C |
| N-2 | Mobile: drawer **and** bottom nav both `navigation` landmarks | SR confusion | Distinct `aria-label`s (Primary / Bottom) | Fixed Rev C |

### 2.7 Breadcrumb behavior — **7.5 / 10**

Placement in page header is correct (avoids 56 px clutter).

| ID | Problem | Impact | Best solution | Disposition |
|---|---|---|---|---|
| B-1 | Mobile “parent + title” vs page `h1` duplication | Redundant announcing | Crumb current page `aria-current`; h1 remains; collapse trail length ≤2 visible | Fixed Rev C |
| B-2 | No max depth / overflow menu | Long admin trails wrap badly | Soft max 4 segments; collapse middle with ellipsis button | Fixed Rev C |

### 2.8 Responsive strategy — **8 / 10**

Matrix 320–1920 including 1600 is complete and Master-aligned.

| ID | Problem | Impact | Best solution | Disposition |
|---|---|---|---|---|
| R-1 | Tablet “optional icon rail ≥900” **conflicts** with “force drawer below 1024” | Ambiguous implementation | **Remove** tablet rail exception; drawer-only &lt;1024 | Fixed Rev C |
| R-2 | Portal/platform mobile chrome underspecified | Divergent shells | Portal: bottom tabs per portal IA; Platform: simpler top+More | Fixed Rev C |

### 2.9 Desktop / Laptop / Tablet / Mobile / Ultra-wide — **8 / 10**

Desktop excellence and ultra-wide non-stretch rules are right. Laptop rail default at 1024 is correct.

| ID | Problem | Impact | Best solution | Disposition |
|---|---|---|---|---|
| U-1 | Ultra-wide calm margins OK; need explicit **main padding** when content &lt; main | Uneven left bias if start-aligned without cap behavior | Start-aligned; when `main - gutters > 1440`, extra space trails on the **end** (inline-end) | Fixed Rev C |

### 2.10 Content width & grid & spacing — **8 / 10**

Gutters and 4/8/12 grid match Master. Form 640 / reading 720 correct.

| ID | Problem | Impact | Best solution | Disposition |
|---|---|---|---|---|
| G-1 | Page header spacing “24 below chrome” vs Master title block | OK but no token names | Map to `space.6` / `space.8` | Fixed Rev C |

### 2.11 Accessibility & keyboard — **8.5 / 10**

Skip link, landmarks, focus trap, Esc, forced-colors pointer: strong.

| ID | Problem | Impact | Best solution | Disposition |
|---|---|---|---|---|
| A11Y-1 | Banner announce “on appear” without polite/assertive choice | Noisy or missed | Support-access: assertive once; read-only: polite | Fixed Rev C |
| A11Y-2 | Bottom nav + drawer open simultaneously | Tab order chaos | Opening drawer inert/disable bottom nav or hide inert | Fixed Rev C |

### 2.12 Performance & CLS — **7 / 10 → improved**

FOUC, font-display, lean shell: good.

| ID | Problem | Impact | Best solution | Disposition |
|---|---|---|---|---|
| P-1 | Banner CLS: “reserve when known” without heights | Layout jump when support mode engages mid-session | Fixed min-heights: support **40**, read-only **36**; reserve only when active | Fixed Rev C |
| P-2 | Sidebar expand/collapse width animation can cause main CLS | Janky content reflow | Animate sidebar; main uses CSS grid/`margin-inline-start` with same duration; or instant under reduced-motion | Fixed Rev C |

### 2.13 Empty / Loading / Error — **8.5 / 10**

Shell preservation is correct and enterprise-safe.

Minor: loading overlay must not trap focus outside org-switch intentional block — clarified Rev C.

### 2.14 Token lock dependencies — **8 / 10**

Parallel lock is right; AC “started” was weak.

| ID | Problem | Impact | Best solution | Disposition |
|---|---|---|---|---|
| T-1 | No minimum token list for Phase-01 exit | Phase-03 starts on incomplete vars | Exit requires shell surfaces: canvas/surface/subtle/muted/fg/border/accent/primary/overlay/z | Fixed Rev C |

### 2.15 Design consistency & scalability — **7.5 / 10 → improved**

Philosophy matches. Scalability needed nav registry + missing domains (IA-1/IA-3).

---

## 3. Specific verification checklist

| Check | Result |
|---|---|
| Sidebar widths 248 / 64 | Pass |
| Collapse / rail / drawer behavior | Pass after R-1 / S-2 fixes |
| Sticky top bar | Pass |
| Sticky page header | Clarified: **not** sticky by default |
| Banner stacking | Pass; heights added |
| Mobile navigation | Pass; portal/platform added; inert when drawer open |
| Breakpoints 320–1920 + 1600 | Pass |
| Token lock | Strengthened exit list |
| Empty / Loading / Error shell | Pass |
| Layout stability (CLS) | Improved (banner heights, sidebar reflow) |
| Future extensibility | Improved (nav registry + missing domains) |

---

## 4. Scores

| Dimension | Score |
|---|---:|
| Alignment with Master Spec B | 8.5 |
| Information architecture | 7.5 (post-fix) |
| Layout hierarchy | 8.5 (post-fix) |
| Sidebar | 8.5 (post-fix) |
| Header | 8.0 |
| Navigation UX | 8.0 |
| Breadcrumb | 8.0 (post-fix) |
| Responsive strategy | 8.5 (post-fix) |
| Desktop usability | 8.5 |
| Tablet usability | 8.0 (post-fix) |
| Mobile usability | 8.0 |
| Ultra-wide | 8.5 |
| Content width / grid / spacing | 8.5 |
| Accessibility / keyboard | 8.5 |
| Performance / CLS | 8.0 (post-fix) |
| Consistency / scalability | 8.0 (post-fix) |
| **Overall** | **8.2 / 10** |

### Overall Score (0–10): **8.2**

### Implementation Readiness: **7.8 / 10**

Ready to implement chrome after Revision C sign-off. Still require design+FE acceptance of Org/Property canonical placement and nav group list before coding.

---

## 5. Critical issues

1. **Missing nav domains** (Maintenance, Communications, Reports) vs canonical IA.  
2. **Ambiguous Org/Property control placement** (duplicate switcher risk).  
3. **Content alignment left optional** (inconsistent shells).  
4. **Tablet rail vs drawer contradiction**.  
5. **Banner/sidebar CLS under-specified**.

*(All five addressed in Phase-01 Revision C.)*

---

## 6. Recommended improvements

### Must — done in Revision C

- [x] Lock content start-alignment + max-width behavior  
- [x] Canonical Org/Property in header/context; sidebar read-only org name  
- [x] Complete sidebar groups from `navigation.md`  
- [x] Remove tablet rail exception  
- [x] Banner min-heights + page header non-sticky + CLS notes  
- [x] Token lock minimum exit list  
- [x] Header trailing progressive disclosure  
- [x] Nav registry / extensibility  

### Should (before Phase-01 engineering exit)

- [ ] Sync any screen specs still citing 240/1600  
- [ ] Prototype Finance long-nav scroll + sticky labels at 390 & 1440  
- [ ] Confirm bottom-nav substitution matrix with PM for roles lacking Leases/Finance  

### Could

- [ ] Optional density toggle in sidebar footer (defer to Phase-05/10)  
- [ ] Storybook shell matrix (staff/portal/platform × light/dark × 390/1440)

---

## 7. Final verdict

### **Approve with Changes**

Phase-01 **Revision C** incorporates the must-fix items above. Treat Revision C as the implementation contract.

**Do not** implement against pre-C text where it conflicts (alignment choice, tablet rail, incomplete nav groups, dual Org switchers).

**Next gate:** Design + FE sign Revision C → authorize engineering checklist in the Phase-01 spec.

---

## 8. Review metadata

| Field | Value |
|---|---|
| Application code | None |
| Spec changed | `docs/ui/phases/Phase-01-Application-Layout.md` Revision C |
| Related | Master Spec B, design-system v2, navigation.md |
