# UI Master Specification — Commercial SaaS Redesign

**Status:** Normative for the **visual redesign phase** (documentation only — no application code in this change set)  
**Revision:** B (2026-07-24) — incorporates must-fix items from [`UI_MASTER_SPEC_REVIEW.md`](./UI_MASTER_SPEC_REVIEW.md)  
**Date:** 2026-07-24  
**Product:** Multi-tenant Rental Property Management SaaS (staff, resident portal, platform shells)  
**Audience:** Product design, design system, frontend architecture, QA accessibility, engineering leads  

**Assumptions (frozen):** Feature set complete · business logic frozen · APIs finalized · schema finalized · Light / Dark / System theme supported · Vietnamese / English localization supported  

### §0 Normative precedence

When documents disagree on **visual/layout constants or redesign sequencing**:

1. **This Master Spec (Revision B+)**  
2. [`design-system.md`](./design-system.md) (v2) for primitive/component detail not repeated here  
3. [`07-ui-design.md`](../07-ui-design.md) / [`navigation.md`](../navigation.md) / [`cross-cutting-patterns.md`](./cross-cutting-patterns.md) for UX behavior and IA  
4. Individual screen specs under `docs/ui/**`  
5. Root [`docs/design-system.md`](../design-system.md) — **historical only** (indigo baseline; do not implement)

Known drift to sync (follow-up, not optional before Phase-03 exit): screen docs citing **240 px sidebar** or **1600 px** content max → use **248** / **1440** per §6.2.

**Normative companions (read with this file):**

| Document | Role |
|---|---|
| [`UI_MASTER_SPEC_REVIEW.md`](./UI_MASTER_SPEC_REVIEW.md) | Design review, scores, approval gate |
| [`design-system.md`](./design-system.md) | Token & component visual language (v2) |
| [`../07-ui-design.md`](../07-ui-design.md) | Experience principles, personas, IA |
| [`../navigation.md`](../navigation.md) | Canonical navigation tree |
| [`cross-cutting-patterns.md`](./cross-cutting-patterns.md) | Session, permissions, high-risk UX |
| [`theme-implementation.md`](./theme-implementation.md) | Theme runtime contract |
| [`i18n-implementation.md`](./i18n-implementation.md) | Locale runtime contract |
| [`README.md`](./README.md) | Screen inventory index |

**Implementation roadmap:** [`redesign/`](./redesign/) — Phase-01 … Phase-10 · **Detailed Phase-01:** [`phases/Phase-01-Application-Layout.md`](./phases/Phase-01-Application-Layout.md)  

**Canonical vocabulary (UI copy):** Organization · Property · Unit · Bed · Resident · Lease · Property Owner · Meter · Payment. Never “Room” as Unit; never Organization-as-“Tenant” in customer UI.

---

## 1. Mission

Elevate the product from a functional operational console to a **world-class commercial SaaS** visual and interaction experience suitable for 2026 buyers: calm, precise, trustworthy with money and occupancy data, and fast for daily operators.

This phase redesigns **look, feel, density, motion, and shared patterns**. It does **not** invent features, change APIs, alter permissions, or rewrite domain workflows.

---

## 2. Design goal & quality bar

### 2.1 Feel

| Attribute | Meaning in RPM |
|---|---|
| **Premium** | Restrained materials; deliberate type; no template chrome |
| **Minimal** | One accent; hierarchy from space and type before color |
| **Elegant** | Soft elevation, hairline borders, consistent radii |
| **Spacious** | Comfortable default padding; compact only where desks demand it |
| **Calm** | Quiet status; no alarmist color fields |
| **Professional** | Enterprise trust for finance, leases, and audit |
| **Enterprise SaaS** | Scale to 10k+ Units without clutter |

### 2.2 Explicit anti-goals

Avoid: Bootstrap / Material / Ant Design / AdminLTE “admin panel” aesthetics; heavy gradients; glassmorphism; bright or rainbow palettes; purple-on-white AI-default themes; ornamental glow; emoji-as-status; decorative KPI cards without scope/as-of.

Product chrome stays **utilitarian**. Display typography and hero composition are allowed only for rare empty/onboarding moments — not for daily operational screens.

### 2.3 Inspiration (patterns only — do not copy brands)

Linear · Stripe Dashboard · Vercel · Notion · GitHub · Raycast · Apple HIG  

See §9 Benchmark.

### 2.4 Success metrics (redesign outcomes)

| Outcome | Indicator |
|---|---|
| **Trust** | Financial widgets always show scope + as-of + currency; toasts never sole evidence of money mutation |
| **Speed-to-task** | High-frequency staff tasks reachable ≤2 clicks from Home with scope preserved |
| **Auditability** | Support-access / read-only / correlation ids visible when relevant; no silent org bleed |
| **Clarity** | Active nav and page primary action identifiable without color alone |
| **Inclusion** | WCAG 2.2 AA light+dark; EN/VI; reduced-motion; 320–414 feature access via task-shaped UI |

---

## 3. Visual language summary

1. **Quiet chrome, loud content** — Sidebar and top bar recede; lists, money, and exceptions dominate.
2. **Near-black primary actions + cool blue accent** — CTAs are near-black (inverted in dark); focus, links, and selection use one cool blue.
3. **Borders before shadows** — Embedded surfaces are flat + 1 px border; soft shadows only on floating layers.
4. **Rounded, not bubbly** — `radius.sm`–`lg`; `radius.full` only for avatars/progress dots.
5. **Density with air** — Comfortable default; compact finance mode without sub-AA hit targets.
6. **Status ≠ color alone** — Icon + text (+ pattern when needed).
7. **Motion is presence** — 150–180 ms opacity/transform; honor reduced motion.
8. **Locale-ready** — EN/VI; 35% text expansion; currency never from locale.

### 3.1 Density modes

| Mode | Attribute | Row / control | Where |
|---|---|---|---|
| **Comfortable** (default) | `data-density="comfortable"` | Table row 48; control 36–40 | Most staff + portal |
| **Compact** | `data-density="compact"` | Table row 40; control 32–36 | Finance desks, reconciliation, meters |

Touch targets remain ≥ **44×44 CSS px** on touch breakpoints even in compact. Do not fork component markup per theme; density is an attribute on a layout ancestor.

---

## 4. Semantic color system

Primitives and semantic CSS variables align with [`design-system.md`](./design-system.md) §2. This section defines **usage contracts** for every semantic family.

### 4.1 Brand posture

| Role | Light | Dark | Intent |
|---|---|---|---|
| Near black | `#0B0B0C` / `#18181B` | Inverted to near-white primary | Authority, primary CTA |
| White / canvas | `#FFFFFF` / `#F7F7F8` | `#09090B` / `#121214` | Calm workspace |
| Slate gray | Neutral 200–600 | Neutral 400–700 | Structure, muted copy |
| Cool blue accent | `#2563EB` (links/focus) | `#60A5FA` | Selection, focus, info — **not** primary CTA fill |

### 4.2 Primitive neutrals (zinc-cool)

| Token | Hex | Usage |
|---|---|---|
| `neutral.0` | `#FFFFFF` | Pure surface, cards, inputs (light) |
| `neutral.25` | `#FBFBFC` | Soft wash behind marketing-thin public chrome |
| `neutral.50` | `#F7F7F8` | App canvas |
| `neutral.100` | `#EFEFF1` | Sidebar, table header, subtle strips |
| `neutral.150` | `#E8E8EB` | Row / control hover wash |
| `neutral.200` | `#E2E2E7` | Default border, dividers |
| `neutral.300` | `#D1D1D6` | Strong border, emphasized frames |
| `neutral.400` | `#A1A1AA` | Placeholder, disabled icon |
| `neutral.500` | `#71717A` | Muted text, meta |
| `neutral.600` | `#52525B` | Secondary body |
| `neutral.700` | `#3F3F46` | Strong secondary |
| `neutral.800` | `#27272A` | Alternate emphasis |
| `neutral.900` | `#18181B` | Primary body text |
| `neutral.950` | `#0B0B0C` | Inverse surfaces / primary button fill |

### 4.3 Accent blues

| Token | Hex | Usage |
|---|---|---|
| `blue.50` | `#EFF6FF` | Selection wash, soft chip (light) |
| `blue.100` | `#DBEAFE` | Soft chip / info soft alt |
| `blue.200` | `#BFDBFE` | Soft focus halo companion |
| `blue.500` | `#3B82F6` | Charts mid, secondary info |
| `blue.600` | `#2563EB` | Links, focus ring, selected (light) |
| `blue.700` | `#1D4ED8` | Link hover |

### 4.4 Semantic families

| Family | Soft (50) | Action (600) | Emphasis (700) | Usage |
|---|---|---|---|---|
| **Success** | `#ECFDF5` | `#059669` | `#047857` | Paid, active occupancy, success toast/badge |
| **Warning** | `#FFFBEB` | `#D97706` | `#B45309` | Due soon, holdover, caution banners |
| **Danger** | `#FEF2F2` | `#DC2626` | `#B91C1C` | Destructive, overdue, failed |
| **Info** | `#EFF6FF` | `#2563EB` | `#1D4ED8` | System notices (non-alarm) |

Chart series: see §4.10 (labels required; never color-only).

### 4.5 Semantic tokens — Light

| Token | Value | Usage |
|---|---|---|
| `--bg-canvas` | `neutral.50` | Full app / portal background |
| `--bg-surface` | `neutral.0` | Cards, panels, inputs, sheets |
| `--bg-surface-raised` | `neutral.0` | Modals, popovers, menus |
| `--bg-subtle` | `neutral.100` | Sidebar, table header, muted strips |
| `--bg-muted` | `neutral.150` | Hover rows, ghost button hover |
| `--bg-inverse` | `neutral.950` | Primary button, inverse chips |
| `--fg-default` | `neutral.900` | Body and titles |
| `--fg-muted` | `neutral.500` | Meta, hints, secondary labels |
| `--fg-subtle` | `neutral.400` | Placeholders only |
| `--fg-inverse` | `neutral.0` | Text on inverse / primary |
| `--fg-disabled` | `neutral.400` @ reduced meaning | Disabled labels (never sole carrier of meaning) |
| `--border-default` | `neutral.200` | Inputs, cards, dividers |
| `--border-strong` | `neutral.300` | Emphasized frames, hover borders |
| `--border-focus` | `blue.600` | Focus ring color |
| `--border-danger` | danger 600 | Invalid inputs |
| `--accent` | `blue.600` | Links, selected text, info actions |
| `--accent-fg` | `blue.700` | Accent text hover |
| `--accent-soft` | `blue.50` | Selected row, active nav, soft chips |
| `--primary` | `neutral.950` | Primary CTA fill |
| `--primary-fg` | `neutral.0` | On primary |
| `--primary-hover` | `#27272A` (`neutral.800`) | Primary hover (light) |
| `--primary-active` | `#3F3F46` (`neutral.700`) | Primary pressed (light) |
| `--secondary` | `neutral.0` | Secondary button fill |
| `--secondary-fg` | `neutral.900` | Secondary label |
| `--secondary-border` | `neutral.200` | Secondary outline |
| `--secondary-hover` | `neutral.150` | Secondary hover wash |
| `--success` / `--success-fg` / `--success-soft` | `#059669` / `#047857` / `#ECFDF5` | Success actions & badges |
| `--warning` / `--warning-fg` / `--warning-soft` | `#D97706` / `#B45309` / `#FFFBEB` | Warning |
| `--danger` / `--danger-fg` / `--danger-soft` | `#DC2626` / `#B91C1C` / `#FEF2F2` | Danger |
| `--info` / `--info-fg` / `--info-soft` | `#2563EB` / `#1D4ED8` / `#EFF6FF` | Info (see §4.9) |
| `--selection` | `--accent-soft` + optional 2 px left `--accent` bar | Text/row selection |
| `--focus-ring` | `0 0 0 2px var(--bg-surface), 0 0 0 4px var(--border-focus)` | Keyboard focus always |
| `--overlay` | `rgba(15,23,42,0.45)` | Modal/drawer scrim |

### 4.6 Semantic tokens — Dark

| Token | Value | Usage |
|---|---|---|
| `--bg-canvas` | `#09090B` | App background |
| `--bg-surface` | `#121214` | Cards / inputs |
| `--bg-surface-raised` | `#161618` | Modals, popovers, menus |
| `--bg-subtle` | `#1C1C1F` | Sidebar / headers |
| `--bg-muted` | `#232326` | Hover |
| `--bg-inverse` | `#FAFAFA` | Inverse chips / rare fills |
| `--fg-default` | `#FAFAFA` | Body |
| `--fg-muted` | `#A1A1AA` | Meta |
| `--fg-subtle` | `#71717A` | Placeholder |
| `--fg-inverse` | `#09090B` | On primary / inverse |
| `--fg-disabled` | `#52525B` | Disabled (not sole meaning) |
| `--border-default` | `#2A2A2E` | Borders |
| `--border-strong` | `#3F3F46` | Strong borders |
| `--border-focus` | `#60A5FA` | Focus ring color |
| `--border-danger` | `#F87171` | Invalid inputs |
| `--accent` | `#60A5FA` | Links / focus |
| `--accent-fg` | `#93C5FD` | Accent hover text |
| `--accent-soft` | `rgba(96,165,250,0.14)` | Selection wash |
| `--primary` | `#FAFAFA` | Primary CTA |
| `--primary-fg` | `#09090B` | On primary |
| `--primary-hover` | `#E4E4E7` | Primary hover |
| `--primary-active` | `#D4D4D8` | Primary pressed |
| `--secondary` | `#121214` | Secondary fill |
| `--secondary-fg` | `#FAFAFA` | Secondary label |
| `--secondary-border` | `#2A2A2E` | Secondary outline |
| `--secondary-hover` | `#232326` | Secondary hover |
| `--success` / `--success-fg` / `--success-soft` | `#34D399` / `#6EE7B7` / `#052E1C` | Success (AA-verify on soft) |
| `--warning` / `--warning-fg` / `--warning-soft` | `#FBBF24` / `#FCD34D` / `#2A1D05` | Warning |
| `--danger` / `--danger-fg` / `--danger-soft` | `#F87171` / `#FCA5A5` / `#2A0F0F` | Danger |
| `--info` / `--info-fg` / `--info-soft` | `#60A5FA` / `#93C5FD` / `#0B1F3A` | Info |
| `--selection` | `--accent-soft` + optional left bar | Selection |
| `--focus-ring` | `0 0 0 2px var(--bg-surface), 0 0 0 4px var(--border-focus)` | Focus |
| `--overlay` | `rgba(0,0,0,0.60)` | Scrim |

### 4.7 System theme

Resolved appearance follows OS `prefers-color-scheme` when preference = System. Token sets are only **Light** and **Dark**; System never invents a third palette. Theme transitions use 180 ms color interpolation when motion allowed ([`theme-implementation.md`](./theme-implementation.md)).

### 4.8 Contrast & forbidden uses

- Body text ≥ **4.5:1**; UI icons ≥ **3:1**; focus ≥ **3:1** vs adjacent.
- **Do not:** purple/violet brand fills; neon glow; pure `#000` large light canvases; status by red/green fill alone; infer currency from locale colors.

### 4.9 Info vs accent

Info and accent share the **same blue family** by design (one accent system). Distinguish by **pattern**, not a second brand hue:

- **Links / selection / focus** → `--accent` + underline or left bar / focus ring  
- **Info badge / alert** → `--info-soft` fill + info icon + text label (“Information”)  
Never rely on blue fill alone to mean both “selected” and “informational”.

### 4.10 Chart tokens

| Token | Hex | Notes |
|---|---|---|
| `chart.1` | `#2563EB` | Primary series |
| `chart.2` | `#0D9488` | Teal |
| `chart.3` | `#D97706` | Amber |
| `chart.4` | `#E11D48` | Rose |
| `chart.5` | `#64748B` | Slate |
| `chart.6` | `#4D7C0F` | Lime |

Always pair with legend labels and a non-color cue (pattern or direct labels). Axis/grid: `--border-default` at ≤50% opacity; no heavy grid ink.

---

## 5. Typography

### 5.1 Families

| Role | Stack | Usage |
|---|---|---|
| **UI sans** | `"Inter Variable", Inter, ui-sans-serif, system-ui, "Segoe UI", sans-serif` | Product UI default |
| **Display (rare)** | Inter / system display | Onboarding / empty hero only |
| **Mono** | `ui-monospace, "SF Mono", "JetBrains Mono", Consolas, monospace` | IDs, lease/invoice numbers, correlation ids |

**Tabular lining numerals** for money, meters, dates, counts.

### 5.2 Scale

| Token | Size / Line | Weight | Tracking | Usage |
|---|---:|---:|---:|---|
| `display` | 32 / 40 | 600 | -0.02em | Empty/onboarding hero |
| `title.lg` | 24 / 32 | 600 | -0.015em | Page H1 |
| `title.md` | 20 / 28 | 600 | -0.01em | Section H2, KPI value |
| `title.sm` | 16 / 24 | 600 | 0 | Card / drawer H3 |
| `body.lg` | 16 / 24 | 400 | 0 | Portal / long-form |
| `body.md` | 14 / 20 | 400 | 0 | Default UI |
| `label.md` | 13 / 18 | 500 | 0 | Field labels, table headers |
| `label.sm` | 12 / 16 | 500 | 0.01em | Section overlines, nav groups |
| `caption` | 12 / 16 | 400 | 0 | Helpers, timestamps, as-of |
| `code.sm` | 12 / 18 | 500 | 0 | Mono IDs |

### 5.3 Domain applications

| Context | Rules |
|---|---|
| **Dashboard** | KPI title = `label.md` muted; value = `title.md`/`title.lg` tabular; delta = `caption` + semantic color + icon |
| **Tables** | Header `label.md`; cell `body.md`; money right-aligned tabular; empty = muted em dash |
| **Forms** | Label `label.md`; control `body.md`; hint/error `caption` |
| **Prose** | Max ~68–72 ch; sentence case; no all-caps except short codes (`INV-2026-0042`) |

### 5.4 Font loading

- Prefer **Inter Variable** with `font-display: swap`.
- Preload only the primary UI face used above the fold; do not block first paint on display face.
- Fallback stack must preserve metrics enough to avoid large CLS (system-ui / Segoe UI).
- Tabular nums via `font-variant-numeric: tabular-nums` on money/meter/date cells — not a second webfont.

### 5.5 Locale typography (EN / VI)

- Plan **~35%** string expansion for VI.
- Do not truncate Organization legal names, invoice numbers, or permission denial reasons mid-word; prefer wrap or tooltip with full accessible name.
- Nav labels: allow two-line wrap in expanded sidebar; rail mode uses tooltip with full label.
- Diacritics must not clip; if a control clips, increase line-box by 2 px rather than reducing type size below `label.sm`.

---

## 6. Spacing, grid, containers

### 6.1 Base scale (4 px)

| Token | Multiplier | px |
|---|---:|---:|
| `space.0` | 0 | 0 |
| `space.1` | 1 | 4 |
| `space.2` | 2 | 8 |
| `space.3` | 3 | 12 |
| `space.4` | 4 | 16 |
| `space.5` | 5 | 20 |
| `space.6` | 6 | 24 |
| `space.8` | 8 | 32 |
| `space.10` | 10 | 40 |
| `space.12` | 12 | 48 |
| `space.16` | 16 | 64 |

### 6.2 Layout constants

| Region | Value |
|---|---|
| Page gutter mobile | 16 |
| Page gutter desktop | 24 |
| Content max width | 1440 (see §6.2.1 for full-bleed) |
| Form max width | 640 |
| Reading max width | 720 |
| Sidebar expanded | 248 |
| Sidebar rail | 64 |
| Top bar | 56 |
| Control inline gap | 8 |
| Form field stack | 16 |
| Section gap | 24–32 |
| Card padding | 16 / 20 / 24 |

### 6.2.1 Full-bleed workspaces

Dense finance/ops grids **may** break the 1440 content cap and use the remaining viewport beside the sidebar when:

1. The screen is explicitly a workspace (billing run, reconciliation, meter grid, arrears); and  
2. Identity column(s) stick; and  
3. Forms/side panels inside the workspace still respect form/reading max widths.

Do not full-bleed marketing/auth or simple CRUD forms.

### 6.3 Grid

| Viewport | Columns | Notes |
|---|---:|---|
| &lt; 768 | 4 | Stacked |
| 768–1023 | 8 | Tablet / two-up cards |
| ≥ 1024 | 12 | Dashboard & workspaces |
| Gutter | 16–24 | Match page gutters |

### 6.4 Pattern spacing

| Pattern | Spec |
|---|---|
| **Page** | Title block 24 below top; sections 32 apart |
| **Card** | Internal 20 default; metric 16–20 |
| **Form** | Fields 16; fieldsets 24; sticky footer actions |
| **Table** | Cell pad 12–16 X / 10–12 Y; toolbar 12–16 |

### 6.5 Radius (canonical summary)

| Token | px | Use |
|---|---:|---|
| `radius.xs` | 4 | Badges, checkbox visual |
| `radius.sm` | 6 | Inputs, buttons, chips |
| `radius.md` | 10 | Cards, menus, table shells |
| `radius.lg` | 14 | Modals, large panels |
| `radius.xl` | 18 | Rare hero frames |
| `radius.full` | 9999 | Avatars / progress dots only |

Detail remains in design-system §5; values here are normative for redesign.

### 6.6 Shadows (canonical summary)

| Token | Use |
|---|---|
| `shadow.none` | Embedded flat surfaces |
| `shadow.xs` | Resting card (optional) |
| `shadow.sm` | Elevated card |
| `shadow.md` | Popover / dropdown |
| `shadow.lg` | Modal |
| `shadow.focus` | Focus ring (always with `--focus-ring`) |

Dark mode: reduce shadow opacity ~40%; prefer border elevation.

### 6.7 Z-index scale

| Token | Value | Layer |
|---|---:|---|
| `z.base` | 0 | Content |
| `z.sticky` | 10 | Sticky header / scope bar |
| `z.dropdown` | 30 | Menus, combobox |
| `z.overlay` | 40 | Scrim |
| `z.modal` | 50 | Modal / drawer |
| `z.toast` | 60 | Toasts |
| `z.banner` | 70 | Support / read-only banners (above chrome) |

---

## 7. Responsive strategy

Desktop remains the **best** experience. Mobile retains **access to all capabilities** via **task-shaped presentation** (sheets, stepped flows, card lists) — not by shrinking desktop grids until unusable (§7.5).

### 7.1 Design widths (verify at)

| Width | Device class | Shell behavior |
|---:|---|---|
| 320 | Small phone | Single column; bottom nav / More; stacked filters; sheets |
| 375 | iPhone SE-class | Same; comfortable touch 44 |
| 390 | Modern phone | Same |
| 414 | Large phone | Same; two-up metrics when space |
| 768 | Tablet portrait | Drawer or rail; 8-col; drawers full-height |
| 1024 | Small laptop | Collapsed rail; 12-col |
| 1280 | Laptop | Full sidebar; standard density |
| 1440 | Desktop | Preferred staff canvas |
| 1920 | Wide | Cap measure; full-bleed only per §6.2.1 |

### 7.2 Breakpoint tokens (CSS)

Align with design-system: `xs 0` · `sm 480` · `md 768` · `lg 1024` · `xl 1280` · `2xl 1536`. Container queries preferred for reusable widgets.

### 7.3 Responsive rules

- Tables: horizontal scroll in bordered container + sticky identity column when needed.
- Primary actions: sticky footer on mobile forms; safe-area insets.
- Navigation: bottom bar for high-frequency destinations; More for the rest.
- Zoom 200% / reflow 400%: follow available CSS pixels, not device marketing names.

### 7.4 Mobile primary destinations (staff)

Bottom navigation (≤5 slots including More):

1. **Home**  
2. **Portfolio** (properties/units entry)  
3. **Leases** (if permitted; else next permitted domain)  
4. **Finance** (if permitted; else Maintenance / People)  
5. **More** — Residents, Documents, Admin, Operations, Settings, theme/locale, help  

Exact slot substitution is permission-aware; never show a dead tab without explanation in More.

### 7.5 Heavy workspaces on mobile

Billing run, reconciliation, meter grids, arrears bulk actions:

- Present as **guided sheets / stepped panels**, not microscopic data grids.
- Keep the same API capabilities and approvals; change layout only.
- Provide “Open in desktop layout” hint when viewport &lt; 768 and task is grid-native (non-blocking).

### 7.6 Desktop excellence criteria

At ≥1280: persistent sidebar, hover affordances, ⌘K search, multi-column dashboard, compact density available, visible scope chips, and keyboard-operable tables without requiring touch targets as the primary path.

---

## 8. UX principles (product chrome)

### 8.0 Page header anatomy

| Zone | Content | Rules |
|---|---|---|
| **Title** | `title.lg` H1 | One H1 per page |
| **Meta** | Scope, as-of, status, breadcrumb | `caption` / `label.sm`; never only color |
| **Primary action** | One emphasized button | Near-black primary; right-aligned on desktop |
| **Tertiary** | Overflow / secondary | Ghost or outline; never compete with primary |

Accent (blue) is for links/selection/focus — **not** a second primary CTA fill.

### 8.1 Navigation

Organization → Property scope → domain → list → detail/workflow. Permission-aware discovery; **server authoritative**. Active destination = icon + label + indicator (not color alone).

### 8.2 Sidebar

248 / 64; section labels muted; active `accent-soft`; collapse to icon + tooltip; mobile off-canvas with focus trap. One accent only.

#### 8.2.1 Nav density & overflow

- Sidebar body scrolls independently; **section labels sticky** within the scrollport when lists are long (Finance).
- Do not nest more than one accordion level.
- Prefer grouping already defined in [`navigation.md`](../navigation.md); do not invent new domains.

#### 8.2.2 Sidebar keyboard

- Tab moves through focusable nav items in visual order.
- Enter/Space activates.
- Esc closes mobile drawer and returns focus to the menu button.
- Arrow-key roving tabindex is optional; if implemented, document in Phase-01.

### 8.3 Header (top bar)

56 px; Organization + Property scope always reachable; global search (⌘K); notifications; help; user menu; theme + locale controls; support-access and read-only banners persist.

Command palette / global search chrome detail is owned by Phase-01 + [`shell/global-search.md`](./shell/global-search.md).

#### 8.3.1 Banner stack

Top → bottom: (1) Support-access banner (2) Read-only banner (3) Top bar (4) Sticky property/filter context. Banners use `z.banner` and never cover focusable primary actions without scroll.

### 8.4 Dashboard

Exception-first, not vanity KPIs. Metric row (2–4) with **scope + as-of**; exception list; work queue; activity. Omit unauthorized widgets independently. Widget-level error/empty/skeleton per [`redesign/Phase-02-dashboard.md`](./redesign/Phase-02-dashboard.md).

### 8.5 Forms

Persistent labels; 16 px rhythm; one column preferred; error summary + field errors; unsaved guard; money as decimal string + explicit ISO currency; dates with Property time zone context.

#### 8.5.1 Form surface decision tree

| Situation | Surface |
|---|---|
| Short confirm / reason | Dialog |
| Create/edit single entity with ≤12 fields | Drawer or page form |
| Wizard / multi-step | Full page stepper |
| High-risk money / SoD | Follow [`cross-cutting-patterns.md`](./cross-cutting-patterns.md); typed confirm when required |

### 8.6 Tables

Comfortable 48 / compact 40 / touch 52; sticky header; toolbar (title+count | search+filters+primary); filter chips; accessible sort; row actions named with entity id.

#### 8.6.1 Empty vs filtered-empty

| State | Copy pattern |
|---|---|
| **First-use empty** | Explain none exist yet + primary Create/Import |
| **Filtered empty** | “No results for these filters” + Clear filters |
| **No permission** | Non-disclosing empty; do not imply resource absence |

### 8.7 Cards

Surface / interactive / metric / exception / flat. No decorative nested cards. Metrics always disclose basis.

### 8.8 Dialogs

Short decisions only (400 / 520 / 720). Focus trap; Esc; restore focus. High-risk money/SoD may require typed confirm per product rules.

### 8.9 Drawers

Create/edit/detail; URL-addressable when navigational; full-screen sheet on mobile.

### 8.10 Search

Global search grouped by entity; never leak unauthorized counts/suggestions; distinguish duplicates with secondary identifiers.

### 8.11 Filters

Saved views where supported; sticky scope; chips for active filters; clear-all; preserve on pagination.

### 8.12 Empty / Loading / Error

Calm specific empty copy + one CTA; skeleton matching geometry; field → inline → page error levels; map RFC 9457; non-disclosing 404 cross-org; toasts never sole evidence for financial outcomes.

### 8.13 Notifications

In-app center for durable items; toasts for low-risk confirm only; Operations Center for async jobs.

### 8.14 Accessibility (WCAG 2.2 AA)

Program requirements (testable):

- Text contrast ≥ 4.5:1; large text / UI component contrast per WCAG; verify light **and** dark.
- Visible focus (`--focus-ring`) on all interactive elements; never remove outline without replacement.
- Keyboard: tab order matches visual order; Esc closes overlays; menus/listboxes arrow-operable where role requires.
- Hit targets ≥ 24 CSS px minimum; **prefer 44** on touch; spacing between targets ≥ 8 px.
- Persistent labels; errors via `aria-describedby` / `role="alert"` as appropriate.
- Status not by color alone (icon + text).
- Skip link to `main`; one logical H1; `lang` on document.
- `prefers-reduced-motion: reduce` → instant show/hide.
- Live regions: polite for result-count updates; assertive sparingly for blocking failures.
- See also design-system §23 checklist.

#### 8.14.1 Forced colors

In `forced-colors: active`, preserve borders and focus using system colors; do not rely on box-shadow alone for focus. Icons that convey status must remain visible (or have text equivalents).

### 8.15 Component state matrix

Button, Input, Select, Checkbox, Switch, Badge, Tab, and Menu **must** implement the state sets in design-system §§9–10 (default, hover, active, focus-visible, disabled, loading/error where applicable). Phase-03 acceptance requires a visible matrix (Storybook or equivalent).

### 8.16 Internationalization program rules

- All user-visible chrome and feature copy via catalogs (`en` / `vi`); lazy-load per locale.
- Persist locale; set `html.lang` before paint ([`i18n-implementation.md`](./i18n-implementation.md)).
- Glossary enforced (Tổ chức, Cư dân, Hợp đồng thuê, Căn/Đơn vị, Giường, …).
- Map known API problem codes to catalog messages; do not translate arbitrary server stack text.
- Pseudo-localization (or 35% expansion QA) before Phase-08 exit.
- Currency **code** always explicit; locale affects separators/display only.

---

## 9. Animation

| Token | Duration | Usage |
|---|---:|---|
| `motion.instant` | 0 | Reduced-motion fallback |
| `motion.fast` | 120–150 | Hover, switch toggles |
| `motion.normal` | **150–180** | Menus, tabs, theme crossfade |
| `motion.slow` | 200–240 | Modal/drawer enter only |

**Easing:** enter `cubic-bezier(0.16, 1, 0.3, 1)` · exit `cubic-bezier(0.7, 0, 1, 1)`.  
**Properties:** opacity + translateY(4–8 px) / scale(0.98–1) only.  
**Locale switch:** swap strings immediately; optional opacity fade ≤150 ms — never delay readability.  
**Forbidden:** layout thrash, parallax, count-up under reduced motion, decorative infinite loops.

---

## 10. Benchmark — adopt vs avoid

| Product | Adopt | Avoid |
|---|---|---|
| **Linear** | Keyboard-first density; quiet borders; precise active states; command palette feel | Issue-tracker metaphor; ultra-dense defaults for accountants without compact toggle |
| **Stripe Dashboard** | Trust hierarchy for money; clear as-of; restrained charts; excellent empty/error honesty | Payment-product IA; decorative hero metrics |
| **Vercel** | Minimal chrome; typographic clarity; calm dark mode | Deploy-log aesthetics as primary metaphor |
| **Notion** | Spacious reading; soft grouping; approachable empty states | Block-editor interaction for operational tables |
| **GitHub** | Predictable nav; strong diff/audit affordance metaphor for history | Developer-only density and monospace-everything |
| **Raycast** | Instant search; action lists; shortcut hints | Floating launcher as sole navigation |
| **Apple HIG** | Hit targets; clarity; motion restraint; SF-like rigor | Consumer iOS patterns that hide enterprise scope |

**RPM synthesis:** Stripe-grade financial trust + Linear restraint + Vercel calm + GitHub audit clarity + Raycast search speed — expressed with near-black CTAs and a single cool blue accent.

---

## 11. Shells in scope

| Shell | Visual notes |
|---|---|
| **Staff** | Full sidebar + top bar; Property scope sticky on dense pages |
| **Resident portal** | Simpler nav; `body.lg` allowed; no internal ops leakage |
| **Platform** | Distinct support-access chrome; stronger audit cues |
| **Public / auth** | Centered form, max-width form container, brand wordmark calm |

### 11.1 Shell IA summaries

| Shell | Primary nav model |
|---|---|
| Staff | Domain sections per [`navigation.md`](../navigation.md); permission-filtered |
| Portal | Home · Lease · Invoices · Payments · Maintenance · Documents · Profile |
| Platform | Platform dashboard · Organizations · Support access |
| Public | No domain nav; brand + theme/locale only |

### 11.2 Wordmark

- Text wordmark using UI sans at `label.md`/`title.sm` weight 600; calm tracking.
- No ornamental logo lockups required for redesign; if SVG mark exists, keep monochrome using `--fg-default` / `--fg-inverse`.
- Do not animate the wordmark.

---

## 12. Implementation roadmap overview

Documentation phases precede any visual code. Each phase has a dedicated brief under [`redesign/`](./redesign/).

| Phase | Title | Doc |
|---|---|---|
| 01 | Application Layout | [Phase-01](./redesign/Phase-01-application-layout.md) |
| 02 | Dashboard | [Phase-02](./redesign/Phase-02-dashboard.md) |
| 03 | Shared Components | [Phase-03](./redesign/Phase-03-shared-components.md) |
| 04 | Forms | [Phase-04](./redesign/Phase-04-forms.md) |
| 05 | Tables | [Phase-05](./redesign/Phase-05-tables.md) |
| 06 | Responsive | [Phase-06](./redesign/Phase-06-responsive.md) |
| 07 | Theme | [Phase-07](./redesign/Phase-07-theme.md) |
| 08 | Internationalization | [Phase-08](./redesign/Phase-08-internationalization.md) |
| 09 | Animations | [Phase-09](./redesign/Phase-09-animations.md) |
| 10 | Product Polish | [Phase-10](./redesign/Phase-10-product-polish.md) |

### 12.1 Sequencing rules (Revision B)

1. **Token lock (Phase-07 checklist) starts with Phase-01** — light/dark semantic CSS variables must match §4 before broad primitive restyle. Phase-07 remains the formal theme acceptance gate.  
2. **i18n catalogs (Phase-08 work) run parallel from Phase-01** for chrome strings; Phase-08 is the coverage/exit gate.  
3. Foundation build order: **01 (+ token lock) → 03 → 04 ∥ 05 → 02** (dashboard after metric/card primitives exist).  
4. **06** validates 01–05 across listed widths (including task-shaped mobile).  
5. **09** after surfaces stable; **10** release gate.  
6. Do not restyle all feature pages before Phase-03 acceptance.

### 12.2 Global non-goals (all phases)

- No API / schema / permission / workflow redesign  
- No new business entities  
- No inventing Room or tenant-as-Organization labels  
- No code in documentation phases themselves  
- No print/PDF redesign; no illustration system required

### 12.3 Sign-off (RACI)

| Gate | Design | Frontend lead | QA a11y |
|---|---|---|---|
| Phase exit AC | Accountable | Responsible | Consulted |
| Token lock | Accountable | Responsible | Consulted |
| Program DoD (§13) | Accountable | Accountable | Responsible |

### 12.4 Effort contingency

Sum of phase engineering estimates in redesign briefs is a **baseline**. Plan **+20%** calendar contingency for companion-doc sync, VI linguistic review, and contrast remediation.

---

## 13. Definition of done (redesign program)

- Visual language matches this master + design-system v2 on staff, portal, platform, and auth shells.  
- Light / Dark / System verified AA.  
- EN / VI complete for user-visible strings on redesigned surfaces; glossary enforced.  
- Desktop 1440/1920 excellence; mobile 320–414 capability access via task-shaped UI.  
- Motion 150–180 ms; reduced-motion instant.  
- Performance budgets in §14 met on golden paths.  
- Acceptance criteria in Phases 01–10 signed off by design + frontend + QA.  
- Companion screen specs synced to 248 / 1440 (or explicitly excepted).

---

## 14. Performance

| Concern | Rule |
|---|---|
| **Theme FOUC** | Blocking head script per theme-implementation |
| **Locale FOUC** | Blocking `lang` script; avoid blank shell &gt; 100 ms after paint without skeleton |
| **Fonts** | `font-display: swap`; preload at most one UI face |
| **Lists** | Virtualize (or window) when rendered rows routinely exceed **100** visible-capable rows; server pagination remains authoritative |
| **Skeletons** | Prefer partial region skeletons; pulse opacity 6–12%; no full-shell blank for one panel |
| **Motion** | No continuous idle animation on dashboards |
| **Bundles** | Locale catalogs lazy per language; do not ship both EN+VI in the critical path beyond fallback policy |
| **Images/icons** | Lucide tree-shake; no emoji image sprites |

---

## Changelog

### Revision B — 2026-07-24

Incorporates must-fix findings from [`UI_MASTER_SPEC_REVIEW.md`](./UI_MASTER_SPEC_REVIEW.md):

- §0 Normative precedence  
- Success metrics, density modes  
- Full dark token parity; concrete hover/secondary; info vs accent; chart hex  
- Font loading + VI typography  
- Spacing token table; full-bleed; radius/shadow/z-index  
- Mobile destinations; task-shaped heavy workspaces; desktop excellence  
- Page header; nav overflow/keyboard; banner stack; form/table clarifications  
- Expanded a11y + forced-colors; i18n program rules  
- Resequenced roadmap; RACI; contingency  
- Performance §14  

### Revision A — 2026-07-24

Initial Master Spec + redesign phase index.

---

*End of UI Master Specification. Phase briefs follow under `docs/ui/redesign/`.*
