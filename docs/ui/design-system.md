# RPM Design System (v2)

**Status:** Normative for UI redesign (documentation only — no React in this revision)  
**Audience:** Product design, frontend engineering, QA accessibility  
**Product:** Multi-tenant Rental Property Management SaaS (staff, portal, platform shells)  
**Inspiration:** Apple HIG clarity · Linear density & restraint · Stripe Dashboard trust · Vercel minimalism  
**Accessibility target:** WCAG 2.2 AA (light and dark)  
**Supersedes for redesign work:** root [`docs/design-system.md`](../design-system.md) remains historical baseline; **this file** is the implementation target for the v2 visual language.

---

## 1. Design principles

1. **Quiet chrome, loud content** — Hierarchy comes from type, spacing, and borders before color or shadow.
2. **One accent, many neutrals** — Near-black primary actions; a single cool blue for focus, links, and selection. No purple gradients, no ornamental glow.
3. **Soft elevation** — Prefer 1 px borders; use soft, low-opacity shadows only for floating surfaces (popover, modal, elevated card).
4. **Rounded, not bubbly** — Consistent radii; never `rounded-full` pills for primary navigation or table actions.
5. **Density with air** — Comfortable default; compact mode for finance desks without shrinking hit targets below 44×44 CSS px on touch.
6. **Status is never color alone** — Icon + text (+ optional pattern) for every semantic state.
7. **Canonical vocabulary in UI** — Organization, Property, Unit, Bed, Resident, Lease. Never “Room” or org-as-“Tenant” in customer copy.
8. **Motion is presence, not noise** — Short, opacity/transform only; honor `prefers-reduced-motion`.

---

## 2. Color palette

### 2.1 Primitives

Neutral scale (zinc-leaning, slightly cool):

| Token | Hex | Role |
|---|---|---|
| `neutral.0` | `#FFFFFF` | Pure surface |
| `neutral.25` | `#FBFBFC` | Soft canvas wash |
| `neutral.50` | `#F7F7F8` | App canvas |
| `neutral.100` | `#EFEFF1` | Subtle fill / zebra |
| `neutral.150` | `#E8E8EB` | Hover wash |
| `neutral.200` | `#E2E2E7` | Default border |
| `neutral.300` | `#D1D1D6` | Strong border / dividers |
| `neutral.400` | `#A1A1AA` | Placeholder / disabled icon |
| `neutral.500` | `#71717A` | Muted text |
| `neutral.600` | `#52525B` | Secondary text |
| `neutral.700` | `#3F3F46` | Emphasis secondary |
| `neutral.800` | `#27272A` | Near-primary text alt |
| `neutral.900` | `#18181B` | Primary text |
| `neutral.950` | `#0B0B0C` | Inverse / primary button |

Accent (Apple/Stripe-adjacent blue — not indigo/violet):

| Token | Hex | Role |
|---|---|---|
| `blue.50` | `#EFF6FF` | Selection wash |
| `blue.100` | `#DBEAFE` | Soft chip bg |
| `blue.200` | `#BFDBFE` | Focus ring soft |
| `blue.500` | `#3B82F6` | Charts / info mid |
| `blue.600` | `#2563EB` | Links, focus ring, selected |
| `blue.700` | `#1D4ED8` | Link hover |

Semantic:

| Family | 50 | 600 | 700 | Use |
|---|---|---|---|---|
| Success | `#ECFDF5` | `#059669` | `#047857` | Paid, active occupancy, success toast |
| Warning | `#FFFBEB` | `#D97706` | `#B45309` | Due soon, holdover, caution |
| Danger | `#FEF2F2` | `#DC2626` | `#B91C1C` | Destructive, overdue, failed |
| Info | `#EFF6FF` | `#2563EB` | `#1D4ED8` | Neutral system notices |

Chart sequence (color-blind aware): `blue.600`, `teal.600` `#0D9488`, `amber.600`, `rose.600`, `slate.500`, `lime.700` — always pair with labels.

### 2.2 Semantic tokens (CSS variables)

Light theme:

| Token | Value | Maps to |
|---|---|---|
| `--bg-canvas` | `neutral.50` | App background |
| `--bg-surface` | `neutral.0` | Cards, panels, inputs |
| `--bg-surface-raised` | `neutral.0` | Modals, popovers |
| `--bg-subtle` | `neutral.100` | Sidebar, table header, muted strips |
| `--bg-muted` | `neutral.150` | Hover rows |
| `--bg-inverse` | `neutral.950` | Primary buttons |
| `--fg-default` | `neutral.900` | Body text |
| `--fg-muted` | `neutral.500` | Meta, hints |
| `--fg-subtle` | `neutral.400` | Placeholders |
| `--fg-inverse` | `neutral.0` | On inverse |
| `--border-default` | `neutral.200` | Dividers, inputs |
| `--border-strong` | `neutral.300` | Emphasized frames |
| `--border-focus` | `blue.600` | Focus ring |
| `--accent` | `blue.600` | Links, selection |
| `--accent-soft` | `blue.50` | Selected row / chip |
| `--primary` | `neutral.950` | Primary CTA fill |
| `--primary-fg` | `neutral.0` | On primary |
| `--danger` / `--warning` / `--success` / `--info` | semantic 600/700 | Actions & badges |
| `--danger-soft` etc. | semantic 50 | Soft badge backgrounds |

Dark theme (required AA):

| Token | Value |
|---|---|
| `--bg-canvas` | `#09090B` |
| `--bg-surface` | `#121214` |
| `--bg-subtle` | `#1C1C1F` |
| `--border-default` | `#2A2A2E` |
| `--fg-default` | `#FAFAFA` |
| `--fg-muted` | `#A1A1AA` |
| `--accent` | `#60A5FA` |
| `--primary` | `#FAFAFA` |
| `--primary-fg` | `#09090B` |

**Contrast rules:** Body text ≥ 4.5:1 on canvas/surface. UI chrome icons ≥ 3:1. Disabled text may drop to 3:1 only if not the sole carrier of meaning. Focus indicators ≥ 3:1 against adjacent colors.

**Do not use:** Purple/violet brand fills, neon glows, pure `#000` large surfaces in light mode, or status communicated only by red/green fills.

---

## 3. Typography

### 3.1 Families

| Role | Stack | Notes |
|---|---|---|
| **UI sans** | `"Inter Variable", Inter, ui-sans-serif, system-ui, "Segoe UI", sans-serif` | Default product face |
| **Display (optional)** | `"SF Pro Display", Inter, system-ui` fallback Inter | Rare marketing/onboarding only |
| **Mono** | `ui-monospace, "SF Mono", "JetBrains Mono", Consolas, monospace` | IDs, lease numbers, receipts, JSON |

Use **tabular lining numerals** (`font-variant-numeric: tabular-nums`) for money, meters, dates, and counts.

### 3.2 Type scale

| Token | Size | Line | Weight | Letter | Use |
|---|---:|---:|---:|---|---|
| `display` | 32 | 40 | 600 | -0.02em | Empty/onboarding hero only |
| `title.lg` | 24 | 32 | 600 | -0.015em | Page title (H1) |
| `title.md` | 20 | 28 | 600 | -0.01em | Section (H2) |
| `title.sm` | 16 | 24 | 600 | 0 | Card / drawer title (H3) |
| `body.md` | 14 | 20 | 400 | 0 | Default UI copy |
| `body.lg` | 16 | 24 | 400 | 0 | Portal / long-form |
| `label.md` | 13 | 18 | 500 | 0 | Field labels, table headers |
| `label.sm` | 12 | 16 | 500 | 0.01em | Overlines, column meta |
| `caption` | 12 | 16 | 400 | 0 | Helper, timestamps |
| `code.sm` | 12 | 18 | 500 | 0 | Mono IDs |

Sentence case everywhere. No all-caps UI labels except short codes (e.g. `INV-2026-0042`). Max prose measure ~68–72 ch.

---

## 4. Spacing system

Base unit **4 px**. Token = multiplier × 4.

| Token | px | Common use |
|---|---:|---|
| `space.0` | 0 | — |
| `space.1` | 4 | Icon gaps, tight chips |
| `space.2` | 8 | Control internal gap, button icon |
| `space.3` | 12 | Compact stack |
| `space.4` | 16 | Field stack, card padding (sm) |
| `space.5` | 20 | Card padding (md) |
| `space.6` | 24 | Section padding, page gutter desktop |
| `space.8` | 32 | Between major blocks |
| `space.10` | 40 | Sparse dashboard regions |
| `space.12` | 48 | Page section breaks |
| `space.16` | 64 | Rare marketing spacing |

**Layout constants**

| Region | Value |
|---|---|
| Page gutter (mobile) | 16 |
| Page gutter (desktop) | 24 |
| Content max width | 1440 |
| Form max width | 640 |
| Reading max width | 720 |
| Sidebar width | 248 (collapsed rail 64) |
| Topbar height | 56 |
| Control gap (inline) | 8 |
| Form field vertical stack | 16 |

---

## 5. Radius

| Token | px | Use |
|---|---:|---|
| `radius.xs` | 4 | Badges, checkboxes visual |
| `radius.sm` | 6 | Inputs, buttons, small chips |
| `radius.md` | 10 | Cards, menu items, table containers |
| `radius.lg` | 14 | Modals, large panels |
| `radius.xl` | 18 | Marketing / rare hero frames |
| `radius.full` | 9999 | **Avatars and progress dots only** — not nav pills |

---

## 6. Shadows

Soft, diffuse, low opacity. Prefer border + shadow together on floaters.

| Token | CSS | Use |
|---|---|---|
| `shadow.none` | `none` | Flat embedded surfaces |
| `shadow.xs` | `0 1px 2px rgba(15, 23, 42, 0.04)` | Subtle resting card |
| `shadow.sm` | `0 1px 2px rgba(15,23,42,0.05), 0 4px 12px rgba(15,23,42,0.04)` | Default elevated card |
| `shadow.md` | `0 4px 8px rgba(15,23,42,0.04), 0 16px 32px rgba(15,23,42,0.08)` | Popover, dropdown |
| `shadow.lg` | `0 8px 16px rgba(15,23,42,0.05), 0 24px 48px rgba(15,23,42,0.12)` | Modal |
| `shadow.focus` | `0 0 0 2px var(--bg-surface), 0 0 0 4px var(--border-focus)` | Focus ring (always) |

Dark mode: reduce opacity ~40% and rely more on `--border-default`. No colored glow shadows.

---

## 7. Border system

| Token | Spec |
|---|---|
| `border.width.default` | 1 px solid `var(--border-default)` |
| `border.width.strong` | 1 px solid `var(--border-strong)` |
| `border.width.accent` | 1 px solid `var(--accent)` |
| `border.width.danger` | 1 px solid `var(--danger)` |
| `divider` | 1 px horizontal/vertical using `--border-default` |
| `hairline` | 1 px at 100% scale; on 2x displays still 1 CSS px |

**Rules:** Tables and lists use hairline row borders, not zebra alone. Selected rows use `accent-soft` fill + optional 2 px left accent bar. Never use 2+ px decorative frames on content cards.

---

## 8. Icons

| Rule | Spec |
|---|---|
| Library | Lucide (or Lucide-compatible outline set) — **one** stroke library only |
| Stroke | 1.75 px optical (1.5–2 px) |
| Sizes | 14 meta · **16** default · 18 nav · 20 empty/section · 32 empty illustration max |
| Color | Inherit `currentColor`; status icons use semantic fg |
| Accessibility | Decorative `aria-hidden`; interactive icons need accessible name |
| Forbidden | Emoji as UI icons; filled brand marks inside dense tables; building/key icons replacing words “Property” / “Unit” |

---

## 9. Buttons

### 9.1 Variants

| Variant | Visual | When |
|---|---|---|
| **Primary** | `--primary` fill, `--primary-fg` text, `radius.sm`, `shadow.xs` | One primary per decision region (Save, Post, Activate) |
| **Secondary** | Surface fill, default border, default text | Cancel adjacent to primary, secondary confirms |
| **Outline** | Transparent + border | Tertiary framed actions |
| **Ghost** | Transparent, muted hover wash | Toolbar, table row actions |
| **Danger** | Danger fill or outline-danger | Destructive confirm |
| **Link** | Accent text, underline on hover | Inline textual actions |

### 9.2 Sizes

| Size | Height | Pad X | Type |
|---|---:|---:|---|
| `sm` | 32 | 12 | `label.md` |
| `md` | 36 | 14 | `body.md` / `label.md` |
| `lg` | 40 | 16 | `body.md` weight 500 |
| `icon` | 36×36 | — | Icon 16 |

### 9.3 States

Default → hover (darken inverse 6% / border strengthen) → active (press scale 0.98 optional) → focus-visible (`shadow.focus`) → disabled (40% opacity, `cursor: not-allowed`, no pointer events) → loading (spinner replaces label or leading icon; keep width stable).

**A11y:** Min hit target 36 px desktop; 44 px touch. Don’t rely on color alone for danger.

---

## 10. Inputs

### 10.1 Anatomy

Persistent **label** above control (`label.md`) · optional hint below (`caption`, muted) · error text below in danger (`caption`, with `role="alert"` or `aria-describedby`).

### 10.2 Specs

| Property | Value |
|---|---|
| Height | 36 (default) / 40 (comfortable) |
| Pad X | 12 |
| Radius | `radius.sm` |
| Border | `--border-default`; hover `--border-strong` |
| Focus | `shadow.focus`; never remove outline without replacement |
| Background | `--bg-surface` |
| Placeholder | `--fg-subtle` — not a substitute for label |

### 10.3 Variants

Text, password (show/hide), number (tabular), textarea (min 3 rows), select, combobox (async entity picker), date, money (prefix currency code, decimal string display), checkbox, radio, switch.

### 10.4 Validation states

| State | Treatment |
|---|---|
| Default | Neutral border |
| Error | Danger border + icon + message |
| Success (verified) | Success border only when verification completed (e.g. email) |
| Disabled | Subtle bg, muted text |
| Read-only | No hover chrome; still selectable for copy |

**Forms:** One column preferred; 16 px vertical rhythm; group with 24 px between sections; sticky footer actions on long wizards.

---

## 11. Tables

Enterprise data workhorse (invoices, leases, units, arrears).

| Property | Spec |
|---|---|
| Container | Surface + `radius.md` + 1 px border; overflow auto |
| Header | `--bg-subtle`, `label.md`, muted uppercase **avoided** — sentence case |
| Row height | Comfortable 48 · Compact 40 · Touch 52 |
| Cell pad | 12–16 X, 10–12 Y |
| Alignment | Text left · money/dates/numbers right · status center-left with icon |
| Hover | `--bg-muted` |
| Selected | `--accent-soft` + checkbox |
| Sticky | Header sticky; first column sticky optional for wide grids |
| Empty column | Em dash `—` muted, never blank |
| Pagination | “Showing 1–50 of N” + prev/next; keyboard accessible |

**Toolbar pattern:** Left: title + count · Right: search, filters, view density, primary action. Filters as chips below toolbar when active.

**A11y:** `<table>` or grid with `role="table"`; sortable columns expose `aria-sort`; row actions in a menu button with accessible name including entity id/code.

---

## 12. Cards

| Variant | Spec | Use |
|---|---|---|
| **Surface** | Border + `radius.md` + `shadow.xs` optional | Default grouping |
| **Interactive** | Hover border-strong + `shadow.sm`; focusable | Navigational tiles |
| **Metric** | Compact padding 16–20; title caption; value `title.md` tabular; delta caption | Dashboard KPIs |
| **Exception** | Left accent bar warning/danger | Home exceptions, arrears callouts |
| **Flat** | Border only, no shadow | Nested inside panels |

**Anti-pattern:** Cards inside cards for decoration; metric cards without time/scope basis (“Unpaid · as of today · Org”).

Padding: 16 (sm) / 20 (md) / 24 (lg). Title `title.sm`, body `body.md`, meta `caption`.

---

## 13. Modal (dialog)

| Size | Max width | Use |
|---|---:|---|
| `sm` | 400 | Simple confirm |
| `md` | 520 | Standard forms |
| `lg` | 720 | Review summaries |
| `xl` | 900 | Rare complex review (prefer drawer) |

**Structure:** Overlay `rgba(15,23,42,0.45)` · panel `radius.lg` + `shadow.lg` · header (title + dismiss) · body scroll · footer actions right-aligned (secondary left of primary).

**Behavior:** Focus trap; Esc closes non-destructive; initial focus first field or primary; restore focus on close; `aria-modal="true"` + labelled by title. Destructive modals require typed confirm or explicit checkbox when money/SoD involved (product rules).

Prefer **drawer** for multi-step or entity detail that feels like navigation.

---

## 14. Toast

| Property | Spec |
|---|---|
| Position | Bottom-right desktop · top-center mobile |
| Width | 320–400 |
| Radius | `radius.md` |
| Shadow | `shadow.md` |
| Duration | 4s success · 6s warning · persist until dismiss for error (with action) |
| Content | Icon + title (optional) + one-line message |

**Allowed:** Low-risk confirmations (“Invitation sent”, “Copied”).  
**Forbidden as sole evidence:** Payment posted, refund executed, deposit disposition, period close — those use inline alert + audit/receipt UI.

Stack max 3; newest below or above consistently; pause on hover.

---

## 15. Sidebar

Staff shell navigation (Portfolio, People, Leasing, Finance, Admin).

| Property | Spec |
|---|---|
| Width expanded | 248 |
| Width collapsed | 64 |
| Background | `--bg-subtle` or surface with right hairline border |
| Item height | 36 |
| Item radius | `radius.sm` |
| Active | `--accent-soft` bg + `--accent` text/icon; 2 px accent bar optional |
| Hover | `--bg-muted` |
| Section label | `label.sm` muted, 12 px pad |
| Footer | Org switcher / user menu pinned |

**Collapsed:** Icons only with tooltips (`role="tooltip"` on focus/hover).  
**Mobile:** Sidebar becomes off-canvas drawer; topbar hamburger; focus trap when open.

Do not mix more than one accent color in nav. Keep icons 18 px.

---

## 16. Navbar (top bar)

Height **56**. Surface with bottom hairline. Contents:

| Zone | Content |
|---|---|
| Left | Mobile menu · optional breadcrumbs · page title (on small screens title may move to content) |
| Center | Global search (⌘K) — max width 420 |
| Right | Scope chip (Organization / Property) · notifications · help · user avatar menu |

Search field: ghost/subtle fill, `radius.sm`, leading search icon. Avatar 28–32 px. Keep actions ghost buttons density-friendly.

---

## 17. Dashboard widgets

Home / finance dashboard composition rules:

1. **Metric row** — 2–4 metric cards; equal width; sparklines optional (blue/muted only).
2. **Exception list** — Exception cards or compact table (expiring leases, overdue invoices).
3. **Work queue** — Pending actions with count badges (neutral/warning).
4. **Activity** — Timeline list; caption timestamps.

| Widget part | Spec |
|---|---|
| Title | `label.md` muted |
| Value | `title.md` or `title.lg` tabular |
| Delta | Caption + success/danger text + caret icon |
| Footer link | Link button “View all” |
| Loading | Skeleton matching layout (see §19) |
| Empty | Inline empty state (see §18) |

Always show **as-of** and **scope** on financial widgets.

---

## 18. Empty states

Centered in the content region of a panel/table.

| Element | Spec |
|---|---|
| Icon | 32 outline, muted |
| Title | `title.sm` |
| Description | `body.md` muted, ≤ 2 sentences |
| Primary action | One button (Create… / Import… / Record payment) |
| Secondary | Link to docs/help optional |

Tone: calm, specific (“No unpaid invoices in this property for the selected period”), never blame. Use canonical entity names.

---

## 19. Loading states

| Pattern | When |
|---|---|
| **Skeleton** | First paint of lists, cards, dashboards — match final layout geometry; pulse opacity 6–12% |
| **Spinner** | Inline button loading; waits &lt; 2s unknown |
| **Progress bar** | Determinate uploads, imports, billing runs |
| **Operation card** | Durable async jobs (import commit, billing run) with status + deep link |

Never block the whole shell for a single panel. Prefer partial skeleton. Announce busy regions with `aria-busy="true"` where appropriate.

---

## 20. Error states

| Level | Pattern |
|---|---|
| **Field** | Input error state (§10.4) |
| **Inline alert** | Banner inside page/card: icon + title + message + optional retry; variants info/success/warning/danger |
| **Page error** | Empty-state shell with reference `requestId` / correlation id in mono caption |
| **Forbidden (403)** | Clear permission explanation; no raw stack; link Home |
| **Not found (404)** | Non-disclosing for cross-org IDs (product security rule) |
| **Problem+json** | Map API `title`/`detail`/`code` to alert; never show secrets |

Destructive failures stay visible until dismissed; include recovery action when possible (“Retry”, “Back to invoices”).

---

## 21. Motion

| Token | ms | Use |
|---|---:|---|
| `motion.instant` | 0 | Prefers-reduced-motion fallback |
| `motion.fast` | 120 | Hover, toggles |
| `motion.normal` | 180 | Menus, tabs |
| `motion.slow` | 240 | Modal/drawer enter |

Easing: `cubic-bezier(0.16, 1, 0.3, 1)` enter · `cubic-bezier(0.7, 0, 1, 1)` exit. Animate opacity + translateY(4–8 px) only. Respect `prefers-reduced-motion: reduce` → instant show/hide.

---

## 22. Breakpoints & responsiveness

| Token | Min width | Behavior |
|---|---:|---|
| `xs` | 0 | Single column; bottom sheets; stacked filters |
| `sm` | 480 | Larger touch controls |
| `md` | 768 | 2-col forms; collapse sidebar to rail optional |
| `lg` | 1024 | Persistent sidebar; split detail |
| `xl` | 1280 | Full dashboard grids |
| `2xl` | 1536 | Max content width comfort |

Tables horizontally scroll inside bordered containers rather than shrinking below readable density. Primary actions remain visible (sticky footer on mobile forms).

---

## 23. Accessibility checklist (AA)

- [ ] Text contrast ≥ 4.5:1; large text ≥ 3:1  
- [ ] Focus visible on all interactive elements (`shadow.focus`)  
- [ ] Keyboard: tab order matches visual; Esc closes overlays; arrows in menus/listboxes  
- [ ] Hit targets ≥ 24 px (prefer 36+); spacing between targets ≥ 8 px  
- [ ] Form labels persistent; errors linked via `aria-describedby`  
- [ ] Status not by color alone  
- [ ] Skip link to main content  
- [ ] `lang` on document; logical heading order  
- [ ] Reduced motion honored  
- [ ] Dark theme verified with same AA thresholds  

---

## 24. Token delivery (implementation contract)

When React work begins (out of scope here), map tokens to:

1. CSS variables on `:root` / `.dark` in `packages/ui`  
2. Tailwind semantic aliases (`bg-canvas`, `text-muted`, `border-default`, `ring-accent`, …)  
3. Component primitives consuming **only** semantic tokens — no raw hex in features  

Document any exception in an ADR.

---

## 25. Component inventory summary

| Component | Key tokens |
|---|---|
| Button | primary/secondary/ghost/danger · sm/md/lg |
| Input / Select / Combobox | sm radius · focus ring · error |
| Table | subtle header · 48/40 rows · sticky |
| Card | md radius · xs/sm shadow · metric/exception |
| Modal | lg radius · lg shadow · sm/md/lg widths |
| Toast | md shadow · transient non-finance |
| Sidebar | 248/64 · accent-soft active |
| Navbar | 56 · search · scope chips |
| Dashboard widgets | metric + exception + queue |
| Empty / Loading / Error | shared state shell patterns |

---

## 26. Visual direction — do / don’t

**Do:** Near-black CTAs, cool blue focus, soft gray canvas, hairline borders, generous 16–24 padding, Inter, Lucide outlines, calm empty copy.

**Don’t:** Purple/indigo product themes, glassmorphism, heavy multi-layer neon shadows, pill-shaped primary nav, emoji status, decorative gradients as content, cramped 4 px page gutters, color-only overdue states.

---

*End of Design System v2. Implementation of React components is a separate change set.*
