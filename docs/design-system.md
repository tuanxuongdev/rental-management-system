# Design System

**Direction:** restrained enterprise utility inspired by Linear, Notion, Stripe Dashboard, Vercel, GitHub, and shadcn/ui—without copying brand assets.  
**Accessibility:** WCAG 2.2 AA in light and dark themes.

## Principles
- Neutral surfaces, high information clarity, and one accent color.
- Borders and spacing establish hierarchy before shadows.
- Semantic tokens, not raw palette names, are used by product components.
- Compact and comfortable density share behavior and accessibility.
- Status is domain-specific and never communicated by color alone.

## Color palette

### Primitive recommendations
| Family | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Neutral | #FAFAFA | #F4F4F5 | #E4E4E7 | #D4D4D8 | #A1A1AA | #71717A | #52525B | #3F3F46 | #27272A | #18181B | #09090B |
| Brand/indigo | #EEF2FF | #E0E7FF | #C7D2FE | #A5B4FC | #818CF8 | #6366F1 | #4F46E5 | #4338CA | #3730A3 | #312E81 | #1E1B4B |
| Success/emerald | #ECFDF5 | #D1FAE5 | #A7F3D0 | #6EE7B7 | #34D399 | #10B981 | #059669 | #047857 | #065F46 | #064E3B | #022C22 |
| Warning/amber | #FFFBEB | #FEF3C7 | #FDE68A | #FCD34D | #FBBF24 | #F59E0B | #D97706 | #B45309 | #92400E | #78350F | #451A03 |
| Danger/red | #FEF2F2 | #FEE2E2 | #FECACA | #FCA5A5 | #F87171 | #EF4444 | #DC2626 | #B91C1C | #991B1B | #7F1D1D | #450A0A |
| Info/sky | #F0F9FF | #E0F2FE | #BAE6FD | #7DD3FC | #38BDF8 | #0EA5E9 | #0284C7 | #0369A1 | #075985 | #0C4A6E | #082F49 |

### Semantic tokens
Light: canvas neutral-50, surface white, surface-subtle neutral-100, border neutral-200, text neutral-900, muted neutral-600, accent indigo-600. Dark: canvas neutral-950, surface neutral-900, surface-subtle neutral-800, border neutral-700, text neutral-50, muted neutral-400, accent indigo-400. Semantic foreground/background pairs use success 700/50, warning 800/50, danger 700/50, and info 700/50 in light; use 300/950–900 variants in dark after contrast verification.

Focus ring: indigo-500 light and indigo-300 dark, 2 px with 2 px offset. Selection uses accent tint plus border/icon. Charts use a color-blind-safe sequence (indigo, sky, emerald, amber, violet, rose) and patterns/labels.

## Typography
UI stack: Inter, ui-sans-serif, system-ui, Segoe UI, sans-serif. Monospace: ui-monospace, SFMono-Regular, Consolas for IDs and tabular references only. Use tabular numerals for money, counts, dates, and Meter readings.

| Token | Size/line | Weight | Use |
|---|---|---|---|
| display | 32/40 | 650 | rare onboarding/empty hero |
| h1 | 24/32 | 650 | page title |
| h2 | 20/28 | 600 | major section |
| h3 | 16/24 | 600 | card/subsection |
| body | 14/20 | 400 | default UI |
| body-lg | 16/24 | 400 | resident and reading-focused content |
| label | 13/18 | 550 | controls/table headings |
| caption | 12/16 | 400 | metadata; never essential at low contrast |
| code | 12/18 | 500 | immutable identifiers |

Cap prose at 68–76 characters. Use sentence case. Avoid all-caps except short machine codes.

## Spacing and layout
Base unit 4 px. Scale: 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24 = 0–96 px. Control gaps 8 px; field stack 16 px; card padding 16/20/24 px; section gaps 24/32 px; desktop page gutter 24 px; mobile 16 px. Desktop sidebar 240 px (rail 64 px), top bar 56 px, content max 1600 px, form max 720 px, reading content max 840 px.

Breakpoints: xs 0, sm 480, md 768, lg 1024, xl 1280, 2xl 1536. Container queries are preferred for reusable patterns.

## Radius, borders, and shadows
Radius: 4 px compact, 6 px controls, 8 px cards, 10 px dialogs/drawers, 999 px pills. Use 1 px neutral borders. Shadows: `xs` 0 1px 2px / 6%; `sm` 0 1px 3px / 10%; `md` 0 8px 24px / 14%; `lg` 0 20px 50px / 18%. Dark mode uses borders and subtle ambient shadow; avoid glowing elevations. Destructive focus never changes shape or causes layout shift.

## Icons
Use one outlined 1.5–2 px library (Lucide-compatible), default 16 px, navigation 18–20 px, empty state max 32 px. Icons require accessible labels when standalone. Do not use building/key/bed icons as substitutes for canonical labels. Directional icons mirror in RTL; status icons do not. Never embed English text.

## Motion
Durations: instant 0, fast 120 ms, standard 180 ms, deliberate 240 ms. Ease-out for entry, ease-in for exit, standard ease for state transitions. Animate opacity and transform, not large layout dimensions. Reduced-motion mode removes parallax, count-up, and nonessential transforms.

## Component variants
- **Button:** primary, secondary, outline, ghost, dangerous, link; sizes sm 32, md 36, lg 40, icon 36. One primary per decision region.
- **Input:** default, error, success-verified, disabled, read-only; 36/40 px heights; persistent labels.
- **Select/combobox:** single, multi, async entity selector; scope-limited results and keyboard listbox behavior.
- **Badge/status:** neutral, info, success, warning, danger; dot/icon + text; domain labels remain canonical.
- **Card:** default, interactive, metric, exception, selected; metric cards include scope/time basis and drill-down.
- **Table/data grid:** comfortable 48 px row, compact 36 px row; semantic header, sticky options, selection, expansion, accessible pagination.
- **Alert:** inline info/success/warning/danger; persistent for security, finance, permission, or sync outcomes.
- **Toast:** transient low-risk confirmation only; never sole evidence for financial or destructive outcomes.
- **Dialog:** sm 400, md 560, lg 720; short decisions only.
- **Drawer/sheet:** 400/560 px desktop; full-screen mobile; URL-addressable when it represents navigation.
- **Tabs:** underline for page sections, pill for compact view modes; no nested tab sets.
- **Stepper:** numbered, named, status-bearing; supports save/resume and error count.
- **Date picker:** date, range, date-time with explicit time zone and typed fallback.
- **File upload:** idle, drag-active, uploading, scanning, ready, rejected, failed; display limits before selection.
- **Progress:** spinner <2 s unknown wait, bar for determinate, operation card for durable jobs.
- **Empty/error/forbidden:** reusable state shell with semantic title, explanation, reference, and one recovery action.

## Tailwind token recommendations
Map semantic CSS variables through Tailwind: `background`, `foreground`, `card`, `popover`, `muted`, `accent`, `primary`, `secondary`, `destructive`, `border`, `input`, `ring`, plus `success`, `warning`, and `info`. Add `sidebar-*`, `chart-1..6`, and `status-*` variables. Keep raw palette utilities available only for visualization/prototyping; product components consume semantic aliases.

Recommended spacing aliases: `page-x` 16/24 responsive, `section` 24/32, `control` 8, `field` 16. Radius aliases: `sm` 4, `md` 6, `lg` 8, `xl` 10. Typography aliases match the table above. Add `data-density=compact|comfortable` and `dark` theme attributes; do not fork component markup by theme.

## Content, localization, and accessibility
Externalize all strings for English and Vietnamese. Allow 35% expansion. Currency is explicit and never inferred from locale. Date-only Lease values do not shift with browser time zone. Minimum touch target is 24×24 px under WCAG exceptions, with 44×44 px preferred on mobile. Components document role/name/value, keyboard behavior, focus restoration, live announcements, zoom/reflow, contrast, and forced-colors behavior.
