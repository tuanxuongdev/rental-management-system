# Management Agreements List

**Domain:** Portfolio  
**Status:** Implementation-ready UX specification  
**Normative references:** [UI Design](../../07-ui-design.md) · [API Specification](../../04-api-specification.md) · [Permission System](../../06-permission-system.md) · [Design System](../../design-system.md)

## Overview

### Purpose
Search, filter, compare, and act on Management Agreements at Organization and authorized Property scope.

### Target users
Organization Owner/Administrator and Property Manager; Accountant and Auditor receive permission-limited read views.

### Entry points
- Permission-visible sidebar or resident-portal navigation.
- Contextual links from dashboard exceptions, related-record tabs, global search, notifications, and recently completed operations.
- Stable deep link preserving non-sensitive filters, active Organization, and Property scope; unauthorized or cross-Organization identifiers return a non-disclosing not-found state.

**API alignment:** Portfolio endpoints in API §11, including `/properties`, `/buildings`, `/units`, `/beds`, `/availability`, `/property-owners`, and `/management-agreements`. Collection pages use bounded cursor pagination (default 25, maximum 100); writes use `If-Match` and/or `Idempotency-Key` exactly where API §7 marks them. Errors map from RFC 9457 Problem Details and stable domain codes.  
**Authorization:** `properties.*`, `units.*`, `beds.*`, `occupancy.view`, `property_owners.*`, `property_ownerships.*`, and `management_agreements.*` as applicable. UI checks shape discoverability only; the server remains authoritative.

## Layout

## Desktop Layout
Use the global 240 px sidebar and 56 px top bar. Content uses a 12-column grid, maximum readable width 1600 px, sticky context/filter bar, and 24 px page gutters. The title row contains identity/status, scope/as-of context, and no more than one emphasized primary action. Dense tables/workspaces may use the full canvas; supporting summary/help occupies a 320–400 px right panel only when it improves decisions.

## Tablet Layout
Collapse the sidebar to a 64 px rail at 1024–1279 px and to a drawer below 1024 px. Use an 8-column grid and 20 px gutters. Move secondary actions into an overflow menu, retain scope and status above the fold, and open edit/supporting content in a full-height drawer.

## Mobile Layout
Use a compact header and bottom navigation/More menu. Stack summary, filters, content, and actions in that order. Convert non-comparative rows to labeled cards; genuinely tabular financial or grid data may horizontally scroll with a sticky identity column and explicit scroll affordance. Sticky bottom action area respects safe-area insets and never covers validation.

## Responsive Breakpoints
- **xs 0–479 px:** single column, 16 px gutters.
- **sm 480–767 px:** single column; paired compact fields only when labels remain readable.
- **md 768–1023 px:** 8 columns; navigation drawer.
- **lg 1024–1279 px:** 12 columns; collapsed rail.
- **xl 1280–1535 px:** full sidebar and standard density.
- **2xl ≥1536 px:** wider workspace; text measures and form widths remain capped.
At 200% zoom and 400% reflow, behavior follows available CSS pixels, not device labels.

## Navigation

### Breadcrumb
`Portfolio / Management Agreements List`; detail/workflow screens insert the authorized parent label and record identifier. Breadcrumbs never contain sensitive values.

### Sidebar
Highlight Portfolio using icon, label, and left indicator. Hide unavailable domains; show disabled conditional destinations only when an explanation helps users request access or complete setup.

### Header
Show active Organization, sticky Property scope where applicable, page title, status/as-of/freshness, global search, notifications, help, and user menu. Support access and read-only states use persistent banners.

## User Flow
```mermaid
flowchart LR
  A[Authorized entry] --> B[Management Agreements List]
  B --> C{Review context and scope}
  C --> D[Search, enter, or inspect data]
  D --> E{Permission and lifecycle valid?}
  E -- No --> F[Explain restriction or conflict]
  E -- Yes --> G[Preview consequence]
  G --> H[Submit or navigate]
  H --> I[Durable result, reference, and next step]
```

## Components

- **Cards:** compact summary/exception cards with scope, value, time basis, and drill-down; avoid decorative KPI cards.
- **Tables:** semantic server-driven table/data grid with configurable columns, sticky header, sort state, row selection, and accessible pagination.
- **Forms:** persistent labels, help/error text, grouped fieldsets, error summary, unsaved-change guard, and server-conflict recovery.
- **Dialogs:** reserved for short confirmations, reason capture, or irreversible consequences; never contain a long workflow.
- **Drawers:** contextual create/edit/detail on desktop; become full-screen sheets on mobile.
- **Tabs:** only for peer sections of one resource; URL-addressable, keyboard operable, and not used to hide required steps.
- **Dropdowns:** menus for actions; searchable comboboxes for entity selection. Never place required explanations only in a tooltip.
- **Date pickers:** locale-aware date or date-time controls with text-entry fallback, explicit Property time zone, and start-inclusive/end-exclusive help where relevant.
- **Charts:** include legend, values, as-of/freshness, accessible text summary, and data-table alternative; never rely only on color.
- **Pagination:** cursor-based Previous/Next with page-size 25/50/100 when supported; preserve filters and announce result changes.

## Form Design

### Field list
The primary record is read-oriented; filters, inline notes, and permitted quick actions remain forms. Fields and filter controls: Code; name; Property; Building; Unit type; allocation mode; capacity; operational status; effective dates; owner/agreement attributes.

### Validation rules
Validate required/type/range locally, then treat server validation as authoritative. Dates must form a valid effective period; money is a decimal string with explicit ISO currency; entity choices must be in active Organization and permitted Property scope. Preserve input on recoverable errors. Surface duplicate, stale-version, capacity, immutable-record, consent, scan, and closed-period conflicts beside the affected field plus in an error summary.

### Required fields
Required fields are marked in labels and announced programmatically. Asterisks are accompanied by “Required” semantics. Workflow completion additionally requires all policy-dependent evidence, acknowledgements, and approvals returned by capability metadata.

### Default values
Default Organization and Property scope from the shell; dates from the applicable Property business date; locale/time zone/currency from effective Organization or Property configuration. Never default consent, destructive choices, approval decisions, override reasons, or a financial currency inferred only from locale.

### Error messages
Use corrective language: “Enter an end date after the start date,” “This Unit is no longer available for the selected period,” or “The record changed; review the latest version.” Include a stable support reference for unexpected failures; never expose raw provider, SQL, stack, token, internal tenant ID, or unauthorized resource details.

### Disabled states
Disable during an in-flight non-idempotent submit; explain lifecycle, permission, subscription, dependency, or approval blockers inline. Prefer hiding actions the user can never perform and disabling discoverable actions that can become available. Read-only fields remain selectable/copyable and visually distinct from disabled inputs.

## Table Design

### Columns
Primary data table columns: Code/name, Property, type, capacity or share, occupancy/authority status, effective dates, updated time, and row actions.

### Sorting
Server-side, single primary sort from the API allowlist with a unique stable tie-breaker. Display sort direction via text/ARIA as well as icon; preserve sort in the URL.

### Filtering
Permission-safe filters use Property, status, type, effective date/as-of, owner/assignee, and domain criteria. Display active filters as removable chips and provide Clear all. Filter counts never leak unauthorized records.

### Search
Debounce 250–400 ms after two characters except exact-reference search, with a clear button and keyboard submit. Search approved indexed identifiers and names only; describe the searchable fields.

### Pagination
Cursor pagination; default 25 rows and maximum 100. Do not show invented page numbers when the API cannot provide stable totals. Keep the current cursor/filter snapshot when returning from detail.

### Bulk actions
Show selected and excluded counts, scope, permission/lifecycle exclusions, preview, and asynchronous progress. Jobs are safe to leave and continue in Operations Center. Retrying targets failed items only.

### Export
Export is a separate governed action, not “download current DOM.” Show scope, filters, fields, estimated size, purpose, format, expiry, classification, and whether step-up/approval is required. Audit creation and download.

## Button Actions

### Primary
**Create or open the selected record.** Use one emphasized button with a specific verb and disabled/loading text that communicates progress.

### Secondary
Save draft, cancel, preview, refresh, edit filters, download authorized evidence, or navigate to related records. Cancel preserves a safe draft where policy permits and warns about unsaved consequential changes.

### Dangerous
Archive, revoke, terminate, void, reverse, delete, reject, or cancel a running operation only when valid. Confirmation names the resource and scope, explains additive/irreversible effects, captures a reason, and requests step-up or approval when returned by policy. Posted financial, issued, signed, and audited records are never destructively edited.

## States

### Loading
Preserve shell and known scope; use structure-matched skeletons for initial load, local spinners for refresh, and progress with counts/operation ID beyond a few seconds. Prevent duplicate submission.

### Skeleton
Match final title, summary, filter, and row/card geometry; do not display fabricated monetary or status content.

### Empty
Distinguish first use, no filter results, no current relationship, unavailable dependency, and restricted scope. Offer one relevant action and do not imply that unauthorized data does not exist.

### Error
Keep entered data and successful modules. Distinguish validation, stale version, business conflict, permission change, throttling, dependency outage, and internal error. Retry only safe/idempotent operations.

### Success
Confirm near the action and persist important outcomes in-page. Show stable resource/operation reference, effective time, audit-relevant status, and next action.

### Permission denied
Use a non-disclosing not-found state for cross-Organization/out-of-scope resources. For a known destination with insufficient permission, identify the missing capability in user language, current scope, and who can grant access—without exposing protected data.

### No internet
Show a persistent offline banner and last-known freshness. Read-only cached shell content may remain if policy allows; financial posting, Lease lifecycle, role/security changes, exports, and other high-risk writes are blocked. Only explicitly supported maintenance/inspection drafts may queue.

## Theme

### Light mode
Use neutral canvas/surface hierarchy, subtle borders, restrained shadows, and semantic foreground/background pairs from the design system. Financial and status values retain text labels.

### Dark mode
Use designed dark tokens rather than inversion. Reduce large-area contrast, preserve 4.5:1 text and 3:1 essential graphical contrast, avoid pure black/white, and give charts/pickers/focus/error states dedicated dark palettes.

## Internationalization

### English
Sentence case, direct verbs, explicit entity names, ISO currency labels where ambiguity exists, and concise consequence-first confirmations.

### Vietnamese
Provide complete `vi` translations, locale formatting, Vietnamese diacritics in search, and reviewed financial/legal terminology. Canonical labels: Organization = **Tổ chức**, Resident = **Cư dân**, Lease = **Hợp đồng thuê**, Unit = **Căn/Đơn vị cho thuê**, Bed = **Giường**, Property Owner = **Chủ sở hữu bất động sản**. Product glossary wins over ad hoc abbreviations.

### Long text handling
Allow at least 35% expansion, wrap labels/chips, clamp only secondary preview text with an accessible full-text mechanism, and never truncate names, money, errors, legal text, or action consequences without access to the complete value.

## Accessibility

### Keyboard navigation
Logical landmarks and heading order; skip link; tab/shift-tab for controls; arrow-key patterns only for composite widgets; Escape closes overlays; dialogs trap then restore focus. Data-grid shortcuts are documented and never required.

### Focus states
Use a 2 px high-contrast focus ring with 2 px offset, visible against both themes and not obscured by sticky content. On validation, focus the error summary, then link to each invalid field.

### Color contrast
WCAG 2.2 AA: 4.5:1 normal text, 3:1 large text and essential UI graphics. Status, trend, selection, and error meaning always include icon/text/pattern beyond color.

### ARIA considerations
Prefer native elements. Provide accessible names/descriptions, `aria-current` for navigation, `aria-sort` for sortable headers, polite live regions for results/progress, assertive only for urgent failures, and accessible chart/table alternatives. Virtualized rows expose correct position/count.

## UX Notes

### Best practices
- Keep active Organization, Property scope, currency, time zone, date/as-of, and read-only/support context visible.
- Distinguish Resident identity, physical occupancy, and Lease responsibility.
- Use Unit for apartment/room and optional Bed beneath a shared Unit; never introduce a Room entity.
- A Meter always uses `meterType=ELECTRICITY|WATER`.
- Preserve traceability: preview consequential changes, show immutable references, and route long work to Operations Center.

### Animations
Use 120–180 ms opacity/transform transitions for menus, drawers, and row insertion; 180–240 ms for larger panels. Avoid layout-shifting animation in dense grids and financial totals. Progress is determinate when counts exist.

### Transition suggestions
Preserve list filters/scroll when opening and returning from detail. Use a brief highlight for updated rows, optimistic UI only for low-risk reversible preferences, and server-confirmed transitions for financial, permission, Lease, occupancy, and document actions. Respect `prefers-reduced-motion` by removing nonessential motion.
