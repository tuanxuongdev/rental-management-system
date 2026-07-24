# Phase-01 — Application Layout

**Status:** Normative implementation specification (documentation only — no application code in this change set)  
**Phase:** 01 — Application Layout  
**Revision:** C (2026-07-24) — must-fix from [`../reviews/Phase-01-Application-Layout-Review.md`](../reviews/Phase-01-Application-Layout-Review.md)  
**Parent:** [`../UI_MASTER_SPEC.md`](../UI_MASTER_SPEC.md) **Revision B (approved)**  
**Review gate:** [`../UI_MASTER_SPEC_REVIEW.md`](../UI_MASTER_SPEC_REVIEW.md) · Phase review: [`../reviews/Phase-01-Application-Layout-Review.md`](../reviews/Phase-01-Application-Layout-Review.md)  
**Companions:** [`../design-system.md`](../design-system.md) · [`../../navigation.md`](../../navigation.md) · [`../../07-ui-design.md`](../../07-ui-design.md) · [`../cross-cutting-patterns.md`](../cross-cutting-patterns.md) · [`../theme-implementation.md`](../theme-implementation.md) · [`../i18n-implementation.md`](../i18n-implementation.md)  
**Supersedes for detail:** brief [`../redesign/Phase-01-application-layout.md`](../redesign/Phase-01-application-layout.md) (keep as index pointer)

**Canonical vocabulary:** Organization · Property · Unit · Bed · Resident · Lease · Property Owner. Never “Room”; never Organization-as-“Tenant”.

**Token lock (parallel):** Light/Dark semantic CSS variables must match Master Spec §4 before broad primitive restyle (Phase-03). Theme formal exit remains Phase-07; chrome strings start in i18n catalogs in parallel (Phase-08 exit).

---

# Objectives

1. Establish a **premium, calm application chrome** (banners, sidebar, header, content frame) that feels like 2026 commercial SaaS — Linear restraint + Stripe trust + Vercel quietness — without copying brand assets.
2. Make **Organization** and **Property scope** impossible to miss on every staff viewport.
3. Deliver **responsive shells** for staff, resident portal, platform, and public/auth using one geometry system (248 / 64 / 56 / gutters / max widths).
4. Guarantee **WCAG 2.2 AA** chrome: landmarks, skip link, focus, keyboard, EN/VI labels, light/dark.
5. Preserve frozen IA and permissions: navigation tree from [`navigation.md`](../../navigation.md); UI discovery never replaces server authorization.
6. Start **token lock** and **chrome i18n keys** so later phases do not rework layout constants.

**Success indicators (Phase-01):** Org + Property reachable ≤1 interaction; active nav identifiable without color alone; no FOUC of theme/`lang` on chrome; shell never blanks during org switch loading; visual QA pass at **390** and **1440** light+dark.

---

# Scope

### In

| Area | Detail |
|---|---|
| Staff `AppShell` | Banner stack + sidebar + top bar + main + optional sticky context bar |
| Sidebar | Groups, collapse/rail, drawer, permission filtering, active/hover, icons, widths |
| Header / top bar | Wordmark/logo zone, search, breadcrumbs (placement rules), notifications, locale, theme, user menu, org/property controls |
| Page header | Title / meta / primary / tertiary anatomy inside `main` |
| Content container | Max width 1440, gutters, full-bleed workspace flag |
| Footer | App chrome footer rules (minimal / none on staff) |
| Layout grid | 4 / 8 / 12 columns by breakpoint |
| Responsive matrix | 320 → 1920 including **1600** ultra-wide |
| Shell variants | Public/auth, portal, platform (same foundations) |
| States | Empty / loading / error **layout chrome** (not feature content) |
| A11y + keyboard + performance | Chrome-level only |
| i18n | All chrome strings via catalogs (no new hardcoded EN/VI) |

### Parallel (must start, not Phase-01 exclusive exit)

- Semantic token CSS variables aligned to Master Spec §4 (light + dark).
- Chrome message keys under `shell.*`, `nav.*`, `locale.*`, `theme.*`, `common.*`.

---

# Out of Scope

- Dashboard widgets / KPI composition (Phase-02)
- Primitive visual deep-restyle of Button/Input/Table internals (Phase-03)
- Form field patterns & wizards (Phase-04)
- Data table toolbar/row density implementation beyond fitting the frame (Phase-05)
- Full responsive audit of every feature page (Phase-06)
- Formal theme acceptance gate (Phase-07) / full string coverage gate (Phase-08)
- Motion system polish (Phase-09) beyond 150–180 ms drawer/overlay already required
- Product polish / visual regression baselines program (Phase-10)
- API, route, permission, workflow, or schema changes
- Inventing navigation domains or renaming entities
- Command-palette **search result ranking** (behavior stays in [`../shell/global-search.md`](../shell/global-search.md); Phase-01 owns chrome placement only)
- Marketing site, print, PDF

---

# Desktop Layout

**Target:** 1440 CSS px (preferred staff canvas). Also valid at 1280–1599 with full sidebar.

```text
┌─ Support-access banner (conditional, min-height 40) ──────────────┐
├─ Read-only banner (conditional, min-height 36) ───────────────────┤
├──────────────┬─ Top bar 56 (sticky) ──────────────────────────────┤
│ Sidebar 248  │  Wordmark · Org · Property │ Search │ utilities│User│
│              ├─ Sticky context bar (dense pages, optional) ───────┤
│  Nav groups  │                                                    │
│  (scroll)    │  main                                                │
│              │    Page header (NOT sticky — scrolls with content) │
│              │    Content container (max 1440, gutter 24)           │
│  [footer]    │                                                    │
└──────────────┴────────────────────────────────────────────────────┘
```

| Property | Spec |
|---|---|
| Sidebar | Expanded **248**, persistent, `--bg-subtle`, right hairline `--border-default` |
| Sidebar toggle | **Only** when mode is rail or drawer — not shown in expanded desktop |
| Top bar | Height **56**, `--bg-surface`, bottom hairline, **sticky** (`z.sticky`) |
| Page header | **Not sticky** by default (scrolls inside `main`) |
| Sticky context | Property/filter context only (`z.sticky`); below top bar |
| Main | `--bg-canvas`; padding-x **24**; content **start-aligned** with `max-width: min(1440px, 100%)`; surplus space on **inline-end** |
| Density | Default `data-density="comfortable"` on shell root |
| Hover | Allowed on nav, ghost controls, scope chips |
| Search | Center/right zone, max width **420** |

---

# Laptop Layout

**Target:** 1024–1279 CSS px.

| Property | Spec |
|---|---|
| Sidebar | **Collapsed rail 64** by default; user may expand to 248 (persisted preference `rpm-sidebar` = `expanded` \| `rail`) |
| Top bar | 56; search may compress to icon that opens command palette / search popover |
| Gutters | 20–24 |
| Grid | 12-col inside content |
| Org / Property | Remain visible as chips; truncate with tooltip + accessible name |
| Drawers | Full-height docked; width 400/560 per design-system |

At **1280–1439**: treat as desktop with full sidebar (Master Spec §7.1).

---

# Tablet Layout

**Target:** 768–1023 CSS px.

| Property | Spec |
|---|---|
| Sidebar | **Off-canvas drawer** only; hamburger in top bar opens drawer |
| Top bar | Compact; scope chips may move under top bar as sticky context strip |
| Grid | **8 columns** |
| Gutters | **20** |
| Drawers / sheets | Full-height; create/edit prefer sheet |
| Bottom nav | **Not** used in this band (reserved for &lt;768) |
| Rail | **Forbidden** below 1024 (no optional tablet rail) |

---

# Mobile Layout

**Target:** 320–767 CSS px (design verify at 320, 375, 390, 414).

```text
┌─ Banners ──────────────────────────────────────┐
├─ Top bar 56 (menu · context · actions) ────────┤
├─ main (gutter 16) ─────────────────────────────┤
│  Page header stacked                           │
│  Content                                       │
├─ Bottom nav 56+safe-area ──────────────────────┤
│ Home · Portfolio · Leases · Finance · More     │
└────────────────────────────────────────────────┘
```

| Property | Spec |
|---|---|
| Sidebar | Drawer only; focus trap; Esc + scrim close; return focus to menu button |
| Bottom nav | ≤5 slots per Master Spec §7.4; permission-aware substitution |
| More | Sheet listing remaining domains + Operations + Settings + theme/locale + help |
| Touch | Controls ≥ **44×44**; primary actions not covered by bottom nav (safe-area) |
| Search | Icon → full-screen or sheet search |
| Breadcrumb | Collapse to ≤2 visible segments (parent + current); full trail in overflow; do not duplicate `h1` text in SR — current crumb uses `aria-current="page"` |
| Heavy workspaces | Task-shaped sheets (Master §7.5); non-blocking “best on desktop” hint |
| Drawer vs bottom nav | While drawer open: bottom nav is `inert` (or `aria-hidden` + non-focusable) to avoid dual tab stops |

### Portal mobile

Bottom tabs (permission-aware): Home · Lease · Payments · Maintenance · More (Documents, Profile, theme/locale, help). No staff Admin domains.

### Platform mobile

Compact top bar + More sheet (Dashboard, Organizations, Support access, theme/locale). Bottom nav optional ≤4 slots; prefer More if sparse.

---

# Ultra-wide Layout (1600px+)

**Targets:** 1600, 1920 (and above).

| Mode | Behavior |
|---|---|
| **Default pages** | Sidebar 248 + main; content `max-width: min(1440px, 100%)`, **start-aligned**; surplus margin on **inline-end** (calm canvas — do not stretch forms) |
| **Workspace full-bleed** | Only when page sets `data-layout="workspace"` (billing run, reconciliation, meter grid, arrears, ops center): content may use full main width beside sidebar; identity columns sticky; nested forms still max 640/720 |
| **Typography measure** | Prose / settings reading column still ≤720 |
| **Dashboard** | May use full 12-col within the content max; do not stretch metric cards beyond readable width (~360 each in a 4-up) |
| **Note** | At viewport 1440 with sidebar 248, main ≈1192 — the 1440 cap binds when `main − gutters > 1440` (typically viewport ≳ 1688+) |

Do **not** introduce a third sidebar width at ultra-wide.

---

# Sidebar

## Navigation groups

Staff groups (labels via i18n `shell.section*`; **order fixed**; permission-filtered):

| Group | Items |
|---|---|
| *(ungrouped)* | Home |
| **Portfolio** | Properties, Units, Availability, Property Owners, Management Agreements |
| **People** | Residents, Waitlist |
| **Leasing** | Leases |
| **Finance** | Overview, Payments, Arrears, Reconciliation, Periods, Comparisons, Exports, Invoices, Billing run, Deposits, Meters, Credit notes, Utilities *(flag)* |
| **Maintenance** | Requests, Work Orders, Inspections |
| **Communications** | Notifications, Notification templates |
| **Documents** | Library |
| **Reports** | Catalog, Scheduled reports |
| **Operations** | Operations Center *(when permitted; i18n `shell.sectionOperations`)* |
| **Administration** | Users, Invitations, Roles, Settings, Imports *(when permitted)* |

Domain inventory remains authoritative in [`navigation.md`](../../navigation.md). Do not invent domains in Phase-01.

### Nav registry (extensibility)

Future modules append a **new group** or item via docs + i18n keys only:

1. Update `navigation.md` + this table in the same change set.  
2. Stable `nav.*` / `shell.section*` keys.  
3. No reordering of existing groups without Design + PM approval.  
4. Feature flags may hide items; they must not leave empty section labels.

**Portal groups:** flat list — Home, My Lease, Invoices, Payments, Maintenance, Documents, Profile.  
**Platform groups:** Platform dashboard, Organizations, Support access.

### Section label

- Type: `label.sm`, `--fg-muted`, sentence case  
- Sticky within sidebar scrollport when group long (Finance)  
- Not focusable  

### Nav item

| Property | Spec |
|---|---|
| Height | 36 expanded; **hit target ≥36×36** in rail (icon centered in 64); 44 touch in drawer |
| Radius | `radius.sm` |
| Pad | 8–12 horizontal; icon 18 + gap 8 + label `body.md`/`label.md` |
| Max accordion depth | **1** (no nested accordions of destinations) |
| Active route match | Exact for index routes; **prefix match** for detail/workflow (`/app/leases/:id` → Leases) unless a more specific sibling route is active |

## Collapse behavior

| Mode | Width | Content |
|---|---:|---|
| Expanded | 248 | Icon + label + optional badge |
| Rail | 64 | Icon only; tooltip + `aria-label` on focus/hover |
| Drawer (mobile/tablet) | min(320, 100vw − 48) | Expanded content; overlay `z.overlay` |

- Toggle control in **sidebar footer** (expanded/rail) or top-bar menu button (drawer); persist `localStorage` key `rpm-sidebar` (`expanded` \| `rail`).  
- Below 1024, force **drawer** mode (ignore rail preference for layout; preference restored when ≥1024).  
- Collapse animation ≤180 ms on sidebar width; main `margin`/`padding` tracks the same duration to limit CLS; reduced-motion → **instant** width change.  
- Do not run both rail and bottom nav.

### Sidebar footer (pinned)

| Element | Spec |
|---|---|
| Collapse / expand control | Ghost icon button; accessible name |
| Optional later | Density toggle (out of Phase-01 scope unless trivial) |
| Not allowed | Second Organization switcher |

### Organization display in sidebar

Sidebar header may show **read-only** Organization display name + user email (context only). **Primary Org switcher and Property scope live in the top bar / sticky context** — never two interactive Org switchers.

## Permission-aware menu

| Rule | Behavior |
|---|---|
| Hide | Destination never available to actor |
| Disable + reason | Rare; only when discoverability helps request access |
| Server authoritative | `/me` permissions shape UI only ([`cross-cutting-patterns.md`](../cross-cutting-patterns.md)) |
| Empty group | Hide section label if zero visible items |
| Dead bottom-nav tab | Never; substitute next permitted domain or drop slot |

## Active state

Must use **≥2 cues**:

1. Background `--accent-soft`  
2. Text/icon `--accent` (or `--accent-fg`)  
3. Optional **2 px** left bar `--accent`  
4. `aria-current="page"` on the active link  

Do not use color alone. Parent section is not “active” unless its index route is current.

## Hover state

- Background `--bg-muted`  
- No translate/lift  
- Rail: tooltip appears on hover **and** focus  

## Icons

| Rule | Spec |
|---|---|
| Library | Lucide outline only |
| Size | **18** nav; stroke ~1.75 |
| Color | `currentColor` |
| Decorative | `aria-hidden="true"` when label visible |
| Forbidden | Emoji; filled brand marks; icon replacing canonical words in copy |

Suggested mapping (non-normative examples): Home `house`, Properties `building-2`, Units `layout-grid`, Residents `users`, Leases `file-text`, Finance `wallet`, Admin `settings`.

## Width rules

| Token | px | Notes |
|---|---:|---|
| `--sidebar-width` | 248 | Expanded |
| `--sidebar-width-rail` | 64 | Rail |
| Min content | Labels wrap ≤2 lines expanded; never truncate legal entity names in org **display** — use tooltip |
| Landmark | `nav` with `aria-label` from i18n (e.g. “Primary”) — distinct from mobile bottom nav label |

Org switcher + property scope: **canonical interactive controls in header / sticky context only** (see Header).

---

# Header

Top bar height **56**. Background `--bg-surface`. Bottom border `--border-default`. `z.sticky`.

## Zones (LTR)

| Zone | Desktop / laptop | Tablet / mobile |
|---|---|---|
| **Leading** | Sidebar toggle (if rail/drawer) · Wordmark | Menu · condensed context |
| **Context** | Organization switcher · Property scope | Icon buttons → sheets |
| **Search** | Global search field (⌘K / Ctrl+K) max 420 | Search icon |
| **Trailing** | Notifications · Operations (if permitted) · Help · Locale · Theme · User | Overflow / More may absorb locale/theme |

**Trailing progressive disclosure**

| Width | Behavior |
|---|---|
| ≥1440 | Show Notifications, Operations, Help, Locale, Theme, User |
| 1280–1439 | Locale + Theme may collapse into a single “Display” menu; others remain |
| &lt;1280 | Locale/Theme in More / overflow; icon-first utilities |

### Logo / wordmark

- Text wordmark: product name via `common.productName` (EN/VI).  
- Type: weight 600, `label.md`–`title.sm`; color `--fg-default`.  
- Monochrome mark optional; no animated logo (Master §11.2).  
- Links to `/app` (staff) / portal home / platform home as appropriate.  
- Public layout: wordmark in public header only.

### Search

- Ghost/subtle fill, `radius.sm`, leading search icon.  
- Placeholder from i18n; not a substitute for accessible name (`aria-label`).  
- Opens command palette / results per [`../shell/global-search.md`](../shell/global-search.md).  
- Never leak unauthorized counts or cross-org hits.  
- Shortcut hint visible on desktop (≥1280); sr-only on small screens.

### Breadcrumb

- **Placement:** Inside **page header** (below top bar / sticky context), not inside the 56 px top bar on desktop.  
- Top bar may show a single parent crumb on mobile only when page header is scrolled away — prefer keeping crumbs in page header.  
- Pattern: `Home / Domain / Record` — no secrets, tokens, or PII in trail.  
- Soft max **4** visible segments; collapse middle into an ellipsis control that reveals omitted ancestors.  
- Current page: plain text with `aria-current="page"`; ancestors: links.  
- Landmark: `nav` with distinct i18n label (e.g. “Breadcrumb”) — not the same name as Primary/Bottom nav.  
- Do not remove the page `h1`; crumb current text may match title visually but SR relies on one clear current-page strategy (prefer `h1` as title, crumb as location).

### Notifications

- Ghost icon button; optional count badge (neutral/warning) with accessible “N unread”.  
- Opens notifications center panel/drawer ([`../shell/notifications-center.md`](../shell/notifications-center.md)).  
- Does not replace Operations Center for durable async jobs.

### Language switcher

- Segmented `en` \| `vi` on desktop; cycle control acceptable in public header.  
- Persists `rpm-locale`; updates `html.lang` ([`../i18n-implementation.md`](../i18n-implementation.md)).  
- Labels via `locale.*` keys; visible name for SR.

### Theme switcher

- Light / Dark / System; localized labels via `LocalizedThemeToggle`.  
- Persists `rpm-theme`; no FOUC ([`../theme-implementation.md`](../theme-implementation.md)).  
- Transition ≤180 ms; reduced-motion instant.

### User menu

- Avatar 28–32 + optional name on ≥1440.  
- Menu: Profile/security · (portal: account) · Sign out.  
- Sign out clears session per cross-cutting patterns; routes to login without flash of protected content.  
- Keyboard: button → menu listbox/menu pattern; Esc closes; focus restore.

### Organization & Property (header-adjacent) — canonical

- **One** interactive Organization switcher and **one** interactive Property scope control in the shell.  
- Placement: top-bar **Context** zone on desktop/laptop; sticky context strip on tablet/mobile when chips do not fit.  
- Always reachable ≤1 interaction on all widths.  
- Org switch: explicit selection, loading isolation, no silent fallback ([`../shell/organization-switcher.md`](../shell/organization-switcher.md), cross-cutting §1.4).  
- Property: All authorized · one property · saved group when supported; sticky on dense pages.  
- Sidebar org name is **display-only** (see Sidebar).

---

# Page Header

Lives at top of `main` content (not the 56 top bar). **Scrolls with content** — not sticky. Sticky chrome is limited to banners, top bar, and optional property/filter context bar so Phase-05 table sticky headers (`z.sticky`) do not fight a pinned H1.

| Zone | Spec |
|---|---|
| **Breadcrumb** | Detail/workflow pages; rules in Header › Breadcrumb |
| **Title** | One `h1` · `title.lg` |
| **Meta** | Scope, as-of, status, result count — `caption` / `label.sm`; never color alone |
| **Primary action** | One near-black primary; desktop right-aligned |
| **Tertiary** | Ghost/outline overflow; never second filled primary |

Stack order on mobile: breadcrumb → title → meta → actions (full width primary).

Spacing: `space.6` (24) below sticky chrome / context strip; `space.8` (32) before first section when sparse.

---

# Content Container

| Token / rule | Value |
|---|---|
| Max width | **`min(1440px, 100%)`** of main content box; **start-aligned**; surplus on inline-end |
| Gutter | 16 (&lt;768) · 20 (768–1023) · 24 (≥1024) |
| Alignment | **Normative start-aligned** (not centered) — Master Spec consistency |
| Form pages | Inner form max **640** |
| Reading | Max **720** |
| Workspace | `data-layout="workspace"` full-bleed per Master §6.2.1 |
| Landmark | `<main id="main-content" tabindex="-1">` for skip target |

---

# Footer

| Shell | Footer |
|---|---|
| **Staff / portal / platform** | **No persistent app footer** in Phase-01 (avoids fighting sticky actions / bottom nav). Legal/help live in Help menu. |
| **Public / auth** | Optional minimal footer: calm caption links (help, status) — no sitemap clutter |
| **Safe area** | Mobile bottom nav provides the persistent bottom chrome |

If a page needs legal footnotes, place them in content, not global chrome.

---

# Layout Grid

| Breakpoint | Columns | Gutter | Notes |
|---|---:|---:|---|
| &lt; 768 | 4 | 16 | Stack page header + content |
| 768–1023 | 8 | 20 | Two-up cards when useful |
| ≥ 1024 | 12 | 24 | Dashboard / workspaces |

- Prefer **CSS grid** on page templates; container queries for reusable widgets.  
- Do not place primary nav in the content grid — nav is shell chrome.  
- Dense tables may span all 12 columns inside the content container.

---

# Responsive Rules

Documented behavior by width (CSS px):

| Width | Shell | Sidebar | Nav | Content | Notes |
|---:|---|---|---|---|---|
| **320** | Mobile | Drawer | Bottom 5 + More | 4-col, gutter 16 | Tightest; no horizontal page scroll except table islands |
| **375** | Mobile | Drawer | Bottom | 4-col | Comfortable SE-class |
| **390** | Mobile | Drawer | Bottom | 4-col | Golden-path mobile QA |
| **414** | Mobile | Drawer | Bottom | 4-col; metrics 2-up OK | |
| **768** | Tablet | Drawer | No bottom nav | 8-col, gutter 20 | Sticky context strip OK |
| **1024** | Laptop | Rail 64 default | — | 12-col | Expand sidebar optional |
| **1280** | Desktop | Expanded 248 | — | 12-col, gutter 24 | Desktop excellence begins |
| **1440** | Desktop preferred | 248 | — | max 1440 | Golden-path desktop QA |
| **1600** | Ultra-wide | 248 | — | max 1440 **or** workspace bleed | Margins calm; don’t stretch forms |
| **1920** | Ultra-wide | 248 | — | same as 1600 | Full-bleed only with `data-layout="workspace"` |

**Zoom / reflow:** At 200% zoom and 400% reflow, follow available CSS pixels (may drop into mobile/tablet behaviors). Status and Org/Property must remain discoverable.

---

# Navigation UX

1. Hierarchy: **Organization → Property scope → domain → list → detail/workflow**.  
2. Active route highlighting per sidebar rules; deep links preserve non-sensitive query state.  
3. Org switch purges prior-org client state before paint of new org content.  
4. Bottom nav destinations (staff, &lt;768): Home · Portfolio · Leases · Finance · More — substitute by permission (Master §7.4). More must include Maintenance, Communications, Reports, Documents, Admin, Operations when not in bottom slots.  
5. Operations Center is a shell utility (Operations group and/or header), not a vanity dashboard tile.  
6. Portal must not expose staff admin domains.  
7. Platform support entering an org shows support banner for entire session slice.  
8. Landmarks: Primary sidebar/drawer nav, Bottom nav, and Breadcrumb each have **unique** `aria-label`s.

---

# Empty Layout

Chrome remains fully rendered. Empty applies to **`main` content region** only.

| Element | Spec |
|---|---|
| Position | Centered in content container (or panel) |
| Icon | 32 outline, muted |
| Title | `title.sm` |
| Description | `body.md` muted ≤2 sentences |
| Actions | One primary; optional text link |

Sidebar shows normal permission-filtered items even when a list is empty. Do not replace the shell with a marketing empty state.

Distinguish **first-use empty** vs **filtered empty** vs **no permission** (Master §8.6.1) at page level; Phase-01 provides the **slot** only.

---

# Loading Layout

| Region | Behavior |
|---|---|
| Shell chrome | **Never blank**; show structure immediately |
| Org switch | Explicit blocking overlay/progress on **main** only; banners + chrome stay; focus moves into the blocking message with `role="alertdialog"` or busy region — do not leave focus on stale links |
| Main first paint | Structure-matched **skeletons** for page header + content blocks |
| Sidebar | May show muted placeholders for labels only if `/me` pending — prefer cached last-good nav when safe |
| Top bar search/user | Disabled or pending without layout shift |
| Announce | `aria-busy="true"` on updating regions; polite live region for completion when needed |

Spinner only for &lt;2s unknown waits on controls; not for full-page staff loads.

---

# Error Layout

| Level | Shell behavior |
|---|---|
| **Feature error** | Keep shell; page-level error state in `main` (icon, title, message, correlation id mono caption, Retry/Home) |
| **Forbidden** | Non-disclosing; explain permission; link Home |
| **Cross-org not found** | Same as not-found; no existence leak |
| **Auth session loss** | Route signed-out; no flash of protected nav labels with data |
| **Org switch failure** | Recoverable error; **never** silent fallback org |

Toasts are not the sole error surface for shell-level failures.

---

# Accessibility

- WCAG **2.2 AA** light and dark for all chrome text/icons/focus.  
- Landmarks: `banner` (top bar), optional `complementary`/`navigation` (sidebar), `main`, bottom `navigation` on mobile.  
- **Skip link** first focusable → `#main-content`.  
- Contrast: body ≥4.5:1; UI icons ≥3:1; focus ≥3:1.  
- Status/banners: icon + text; not color alone.  
- `html.lang` matches locale; `dir` LTR for EN/VI.  
- `forced-colors`: preserve borders/focus (Master §8.14.1).  
- Support-access and read-only banners are not dismissible while active; support-access announced **assertive** once on appear; read-only **polite**.  
- Hit targets ≥44 CSS px on touch breakpoints; rail icon targets ≥36×36.  
- No keyboard trap except modal/drawer/org-switch block while open.  
- While mobile nav drawer is open, bottom nav is inert.

---

# Keyboard Navigation

| Control | Keys |
|---|---|
| Skip link | Tab → Enter |
| Sidebar links | Tab order = visual order; Enter/Space activate |
| Sidebar drawer | Esc closes; focus returns to menu button |
| Rail tooltips | Focus shows accessible name |
| Top bar controls | Tab across zones left→right |
| Search | ⌘K / Ctrl+K opens; Esc closes palette |
| User / locale / theme menus | Arrow keys within menu; Esc closes; focus restore |
| Bottom nav | Tab to items; Enter activates |
| Roving tabindex in sidebar | **Optional**; if implemented, document in PR and keep Tab operable |

Do not require arrow keys as the only way to reach nav items.

---

# Performance Considerations

| Concern | Rule |
|---|---|
| Theme / locale FOUC | Blocking head scripts (existing) |
| Shell JS | Keep layout components lean; defer command palette heavy module |
| Fonts | Inter Variable `font-display: swap`; preload at most one UI face |
| Nav icons | Tree-shake Lucide; no barrel import of entire set in shell if avoidable |
| Org switch | Cancel in-flight; do not mount previous org routes |
| Persistence | `rpm-sidebar`, `rpm-theme`, `rpm-locale` only — never tokens |
| Layout shift | Fixed 56 top bar; banner **min-heights** 40 (support) / 36 (read-only) only while active; sidebar width change synced to main inset ≤180 ms |
| Lists | Virtualization is Phase-05/feature concern; shell must not load all nav from oversized payloads |
| Token lock (Phase-01 exit minimum) | Shell must bind: `--bg-canvas`, `--bg-surface`, `--bg-subtle`, `--bg-muted`, `--fg-default`, `--fg-muted`, `--border-default`, `--accent`, `--accent-soft`, `--primary`, `--primary-fg`, `--overlay`, plus z-index tokens — light **and** dark values per Master §4 |

---

# Components Impacted

| Component | Change type |
|---|---|
| `AppShell` (staff) | Geometry, banners, landmarks, density attr |
| `Sidebar` / `NavSection` / `NavItem` | Groups, active/hover, rail/drawer |
| `TopBar` / header zones | Search, locale, theme, user, scope |
| `OrganizationSwitcher` | Placement, chip density, loading |
| `PropertyScopeSelector` | Sticky context bar integration |
| `SupportAccessBanner` / `ReadOnlyBanner` | Stack order, z-index, a11y |
| `PublicHeader` / public layout | Wordmark + locale/theme |
| `PortalShell` / `PlatformShell` | Variant chrome |
| `SkipToContent` | Required |
| `LocaleSwitcher` / `LocalizedThemeToggle` | Placement in header/More |
| `BottomNav` / `MoreSheet` | New mobile chrome |
| `PageHeader` (pattern) | Title/meta/actions slot |
| `ContentContainer` | Max width + workspace flag |
| i18n catalogs | `shell.*`, `nav.*`, chrome strings |
| CSS tokens | `--sidebar-width*`, layout vars, z-index |

Feature route pages: **consume** shell only; no business logic edits in Phase-01.

---

# Acceptance Criteria

1. Sidebar **248** expanded / **64** rail; top bar **56**; gutters **16 / 20 / 24** per band; content max **1440** (workspace bleed documented).  
2. Banner stack order: Support → Read-only → Top bar → Sticky context; persist across navigation and theme changes.  
3. Active nav uses fill + accent text/icon (+ optional bar) and `aria-current`; section labels muted `label.sm`.  
4. Permission-aware hide of nav items; empty sections omitted; bottom nav never shows dead tabs.  
5. Org and Property reachable within one interaction at 320–1920.  
6. Skip link, `main` landmark, sidebar `navigation`, mobile bottom `navigation` present.  
7. Drawer/rail: tooltips/sr-names; focus trap; Esc restore.  
8. Search, notifications, locale, theme, user menu present per shell rules; chrome strings from i18n.  
9. Page header anatomy enforced on golden paths (Home, Properties list, Lease detail).  
10. Empty/loading/error **do not destroy shell chrome**.  
11. Visual QA light+dark at **390** and **1440**; spot-check **1600** workspace vs default.  
12. Keyboard: Tab completes a full chrome circuit; ⌘K opens search on desktop.  
13. No API/permission/IA changes; vocabulary canonical.  
14. Token lock **minimum** met for shell surfaces (see Performance table) — light and dark.  
15. Preference keys: sidebar/theme/locale only — no auth tokens in storage.  
16. Exactly one interactive Org switcher and one Property scope control.  
17. Content container start-aligned with `min(1440px,100%)`.  
18. Nav groups include Maintenance, Communications, Reports (and Documents without duplication).  
19. No rail below 1024; drawer-only tablet/mobile sidebar.

---

# Risks

| Risk | Mitigation |
|---|---|
| Screen specs still say 240/1600 | Follow Master precedence; sync companions before Phase-03 exit |
| Finance nav overflow | Sticky section labels + independent sidebar scroll |
| Mobile “parity” pressure to shrink grids | Task-shaped sheets; Phase-01 only provides chrome |
| Duplicate Org/Property controls | Single primary control each |
| Token lock slips | Block Phase-03 start without §4 parity on shell |
| Hardcoded chrome strings | Lint/checklist gate on Phase-01 PR |
| Bottom nav + sticky footers collide | Safe-area padding utility on `main` |
| Org switch flash of wrong org | Keep existing isolation protocol; layout shows blocking state |
| Duplicate Documents entries | Single top-level Documents group only |
| Header overcrowding at 1280 | Progressive disclosure Display menu |

---

# Dependencies

| Dependency | Status needed |
|---|---|
| Master Spec Revision B | **Approved** (given) |
| Design-system v2 tokens | Reference + token lock parallel |
| `navigation.md` IA | Unchanged |
| Theme + i18n runtimes | Exist; chrome consumes them |
| Cross-cutting org switch / banners | Behavioral norms unchanged |
| Global search / notifications screen specs | Chrome placement only |
| Phase-03 primitives | Not required to **start** Phase-01; required before broad restyle |
| Design QA capacity | Light/dark + a11y pass |

---

# Implementation Checklist

Documentation / planning

- [ ] Design signs this Phase-01 spec  
- [ ] FE lead confirms component inventory mapping to `apps/web` + `packages/ui`  
- [ ] i18n key list for chrome drafted (`shell`, `nav`, banners, bottom nav, skip, breadcrumbs)  
- [ ] Token lock spreadsheet: shell surfaces ↔ Master §4 light/dark  

Engineering (when implementation is authorized — not this doc task)

- [ ] Skip link + landmarks  
- [ ] Banner stack + z-index  
- [ ] Sidebar expanded/rail/drawer + persistence  
- [ ] Nav groups + permission filtering + active/hover  
- [ ] Top bar zones + locale/theme/user/search  
- [ ] PageHeader + ContentContainer + workspace flag  
- [ ] Bottom nav + More sheet  
- [ ] Portal + platform + public variants  
- [ ] Org switch loading isolation preserved  
- [ ] Empty/loading/error slots in `main`  
- [ ] Keyboard + a11y pass  
- [ ] Visual QA 390 / 1440 / 1600 light+dark  
- [ ] No hardcoded chrome strings  
- [ ] Phase-01 AC signed by Design + FE + QA  

Exit

- [ ] Update [`../redesign/Phase-01-application-layout.md`](../redesign/Phase-01-application-layout.md) to point here as canonical detail  
- [ ] Unblock Phase-03 only after token lock minimum for shell; Phase-02 after PageHeader + metric slot geometry exist  

---

## Changelog

### Revision C — 2026-07-24

Incorporates must-fix items from [`../reviews/Phase-01-Application-Layout-Review.md`](../reviews/Phase-01-Application-Layout-Review.md):

- Locked start-aligned content + ultra-wide end margin behavior  
- Canonical Org/Property in header; sidebar display-only org name; sidebar footer collapse  
- Complete nav groups (Maintenance, Communications, Reports) + registry  
- Removed tablet rail exception; drawer inert vs bottom nav  
- Page header non-sticky; banner min-heights; CLS notes  
- Breadcrumb depth/overflow; header trailing progressive disclosure  
- Portal/platform mobile; landmark label uniqueness  
- Token lock minimum exit list; expanded AC  

### Revision B — 2026-07-24

Initial complete Phase-01 application layout specification.

---

*End of Phase-01 Application Layout specification.*
