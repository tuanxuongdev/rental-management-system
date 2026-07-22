# UI Design

**Related documentation:** [UI screen specifications](./ui/README.md) · [Navigation and user flows](./navigation.md) · [Design system](./design-system.md) · [Cross-cutting patterns](./ui/cross-cutting-patterns.md) · [Deferred screens](./ui/deferred-screens.md)

## 1. Purpose and product experience

This document defines the user experience for an enterprise-grade, multi-tenant Rental Property Management SaaS serving boarding houses and apartments with 30 to more than 10,000 units.

The product should make daily work fast for small operators while remaining predictable, governable, and scalable for large organizations. The interface must expose operational context without weakening authorization or tenant isolation.

Terminology is canonical:

- **Organization:** the SaaS tenant boundary.
- **Property:** a managed physical location.
- **Unit:** a rentable room, apartment, or other occupancy space.
- **Bed:** an optional rentable place within a shared unit.
- **Occupant/resident:** a person living in a unit or bed.
- **Lease:** the contractual occupancy agreement.

Do not label an organization as a “tenant” in administrative UI. The role label **Resident/Tenant** may be used where “tenant” clearly means a lease contracting party.

## 2. Experience principles

- **Context is always visible:** users know the active organization, property scope, date range, and acting role.
- **Operational work comes first:** common tasks require few steps and preserve useful filters.
- **Safe by default:** high-risk actions require clear review, confirmation, and appropriate reauthentication.
- **Scale without clutter:** support a single property and thousands of units through search, saved views, bulk operations, and progressive disclosure.
- **Accessible by design:** WCAG 2.2 AA is a release requirement, not a later enhancement.
- **Responsive, not reduced:** mobile supports field work and resident self-service; complex administration remains usable at smaller widths without hiding critical state.
- **Trustworthy status:** loading, saving, failure, synchronization, and permissions are explicit.
- **Consistent language:** the same entity and action names appear in navigation, forms, reports, exports, and audit events.

## 3. Personas

### 3.1 Platform Administrator

Needs platform health, organization provisioning, security events, support-access controls, and cross-organization operational metrics. Requires strong separation between platform operations and audited organization support access.

### 3.2 Organization Owner

Needs a concise business overview, organization controls, billing, security, ownership, administrator management, and portfolio-wide financial visibility. Often approves high-risk actions.

### 3.3 Organization Administrator

Configures organization settings, roles, users, properties, templates, workflows, and integrations. Needs scalable administration and impact previews.

### 3.4 Property Manager

Runs occupancy, resident onboarding, leases, collections follow-up, notices, inspections, and maintenance across assigned properties. Needs rapid exception handling and mobile access during property rounds.

### 3.5 Accountant

Works with charges, invoices, payments, allocations, deposits, refunds, reconciliation, and reporting. Needs accurate date context, immutable references, keyboard efficiency, and export governance.

### 3.6 Maintenance Staff

Needs a mobile-first assigned-work queue, location details, access notes, resident contact information when authorized, checklists, photos, costs, and status updates. Connectivity may be intermittent.

### 3.7 Read-only Auditor

Needs traceable, filterable views of configuration, leases, financial activity, and audit history without mutation affordances. Exports may require separate permission.

### 3.8 Resident/Tenant

Needs a simple self-service experience for leases, balances, payments, documents, notices, profile data, and maintenance requests. The experience must avoid exposing internal property operations or other residents.

## 4. Information architecture

The administrative application uses an organization-centric hierarchy:

1. Platform context, only for platform users.
2. Active organization.
3. Portfolio or selected property scope.
4. Domain area.
5. Resource list.
6. Resource detail and related activity.

Primary domain areas:

- Home
- Portfolio
- Residents
- Leases
- Finance
- Maintenance
- Inspections
- Communications
- Reports
- Documents
- Audit
- Administration

Resident self-service uses:

- Home
- My lease
- Payments
- Maintenance
- Documents
- Notices
- Profile and security

Information architecture is permission-aware. Removing a navigation item improves clarity but does not replace backend authorization.

## 5. Global navigation

### 5.1 Desktop shell

- Persistent left navigation for primary domains.
- Top bar for organization switcher, property-scope selector, global search, notifications, help, and user menu.
- Breadcrumbs on detail and nested administrative pages.
- A clear support-access banner when a platform user has entered an organization context.
- A visible read-only state for auditors and users lacking mutation permissions.

Navigation can collapse to icons but must preserve accessible names and tooltips. The active destination is indicated by more than color.

### 5.2 Organization switcher

The switcher shows only active memberships. Switching organization:

- Requires an explicit selection.
- Resets property scope and incompatible filters.
- Exchanges the session for an access token scoped to the selected organization.
- Cancels in-flight requests and atomically purges all cached queries, mutations, drafts, prefetched routes, and persisted client state belonging to the previous organization before rendering the new context.
- Prevents content from the previous organization remaining visible.
- Shows loading and failure states without silently falling back to another organization.

The current organization name remains visible after selection. Similar organization names include a secondary identifier where needed.

### 5.3 Property scope

Users can select:

- All authorized properties.
- One property.
- A saved group when supported.

Property scope is persistent within the active organization and reflected in page headings, filters, dashboard metrics, exports, and URLs when safe. Users cannot select properties outside their assignments.

On data-dense and long-scrolling portfolio pages, the active property scope remains in a sticky context bar with saved-filter name, result count, and a one-action scope change. It must not disappear when table headers or bulk-action bars become sticky.

### 5.4 Global search

Global search supports authorized results across properties, units, residents, leases, payments, and maintenance requests. Results are grouped by entity, include enough context to distinguish duplicates, and never reveal unauthorized records through counts, suggestions, or timing-sensitive previews.

### 5.5 Mobile navigation

Use a compact top bar plus bottom navigation for the highest-frequency destinations. Secondary domains live in an accessible “More” menu. Organization and property context remain reachable within one interaction and are never represented only by truncated text.

## 6. Page patterns

### 6.1 List pages

List pages provide:

- Search, filters, sort, saved views, and clear-all controls.
- Server-side pagination or cursor loading suitable for 10,000+ units.
- Row virtualization for large result sets, with accessible non-virtualized or paginated alternatives where assistive technology requires them.
- Column configuration and density options on desktop.
- Selectable rows and permission-aware bulk actions.
- Stable URLs for shareable non-sensitive filter state.
- Total or approximate result count when technically and operationally appropriate.
- Export as a distinct governed action, not an implicit table feature.

Filters appear as readable chips and remain after visiting a detail page. Large datasets must not be loaded entirely into the browser.

### 6.2 Detail pages

Detail pages use:

- Identity header with status, primary identifiers, and context.
- A concise summary followed by domain-specific tabs.
- Related records with explicit entity names.
- Activity timeline for meaningful lifecycle events.
- Permission-aware action menu.
- Unsaved-change protection where editing is possible.

For residents, distinguish personal details, occupancy, and contractual leases. A resident can move between units over time; the profile must not imply that the current unit is the identity.

### 6.3 Create and edit flows

- Short forms use a single page.
- Long or consequential flows use a stepper with progress and a final review.
- Validate at field level and on submission.
- Preserve entered values after recoverable errors.
- Explain dependencies and derived values.
- Use sensible defaults but never preselect destructive or legally significant consent.
- Provide cancel behavior that warns about unsaved changes.

### 6.4 Bulk workflows

Bulk actions display:

- Selected count and applicable scope.
- Items excluded because of permissions or lifecycle state.
- A preview of intended changes.
- Validation results before execution.
- Progress for long-running jobs.
- Downloadable result summary with success and failure reasons.

Large operations run asynchronously. Users can leave the page and return through notifications or an operations center.

## 7. Main pages

### 7.1 Home and dashboards

Role-aware home pages show actionable exceptions rather than decorative metrics. Every card states its scope and time range and links to the filtered underlying records.

Common modules:

- Occupancy and vacancy.
- Move-ins, move-outs, lease expirations, and renewals.
- Outstanding balances and overdue accounts.
- Recent and failed payments.
- Open and overdue maintenance.
- Inspection schedule.
- Notices requiring attention.
- Data-quality or setup warnings.

### 7.2 Portfolio

- Property directory and portfolio map where useful.
- Property summary, units, beds, occupancy, staff assignments, documents, and settings.
- Unit and bed availability.
- Status transitions with impact warnings.
- Property comparison for authorized organization-wide users.

### 7.3 Residents

- Resident directory with property and occupancy filters.
- Identity, contact, household, emergency contact, documents, and communication preferences.
- Current and historical occupancy.
- Linked leases without conflating resident identity and contract.
- Sensitive-data labels and masked values where appropriate.

### 7.4 Leases

- Draft, approval, signature, activation, renewal, and termination states.
- Parties, unit or bed, dates, rent schedule, deposit, documents, and history.
- Conflict detection for occupancy dates and resources.
- Review page before activation or termination.
- Clear distinction between contract status and physical occupancy status.

### 7.5 Finance

- Charges, invoices, payments, allocations, deposits, refunds, and reconciliation.
- Ledger-style history with stable references and timestamps.
- Explicit currency and accounting date.
- Reversal or void workflows instead of destructive edits where auditability is required.
- Batch processing with previews and approvals.
- Export and report controls governed separately from view access.

#### 7.5.1 Bulk meter reading entry

- Provide a keyboard-efficient grid scoped to organization, property, utility type, and reading period; keep that scope sticky and visible.
- Load only authorized Unit/Bed meters and virtualize rows for large properties without breaking keyboard order or accessible table semantics.
- Support spreadsheet paste, previous-reading reference, calculated consumption, duplicate detection, and per-row validation for missing, regressive, implausible, or conflicting readings.
- Save an offline-tolerant local draft containing the minimum required data. Clearly distinguish `local draft`, `syncing`, `server draft`, `ready`, `partially invalid`, and `committed`.
- Synchronize drafts with idempotency keys and version checks. Organization switch, logout, or session revocation purges drafts for the previous organization.
- Commit is a deliberate online action: validate every row on the server, summarize valid/invalid counts, require confirmation, and return row-addressable errors without discarding valid input. Committed readings are never blindly replayed.

#### 7.5.2 Billing run workspace

Use a durable workspace rather than a one-shot dialog:

1. Select organization/property scope, billing period, schedules, and effective dates.
2. Generate a read-only preview with totals, prior-period comparison, sample invoices, and rule/version identifiers.
3. Triage exceptions such as missing rates, overlapping leases, absent readings, anomalous consumption, negative totals, and already-billed periods.
4. Require authorized approval with an impact summary and separation of duties where configured.
5. Show queued/running progress, counts, elapsed time, and a durable run ID while allowing the user to leave safely.
6. On partial or total failure, preserve successful work, expose safe error categories, and allow idempotent retry of failed items only. Never offer an unqualified “run again.”

Retain previews, approvals, attempts, exceptions, and reconciliation links as audit evidence.

#### 7.5.3 Arrears and collections workspace

- Show balances in explicit aging buckets with an `as of` date, currency, sticky property scope, responsible collector, dispute status, and last contact.
- Prioritize accounts by configurable policy while displaying why each item is prioritized.
- Track next action, owner, due date, contact outcome, promise-to-pay, and follow-up history.
- Pause collections for a dispute without changing the underlying balance; display reason, approver, review date, and permitted actions.
- Provide governed message templates with channel, language, merge-field preview, recipient preview, consent/preference checks, approval where required, and delivery status.
- Bulk messaging requires a recipient and amount preview, exclusions, rate-limit awareness, and downloadable results.

#### 7.5.4 Cash and bank payment recording

- Record payer, amount, currency, received date, accounting date, method, bank/reference number, receiving account, collector, and notes.
- Upload receipt, deposit slip, or bank evidence through the authorized document flow; show scan/upload status and preserve the draft after recoverable upload failure.
- Detect likely duplicate references and amounts before posting.
- Preview allocation across invoices/charges. Any remainder becomes an explicit unallocated credit owned by the organization and payer account; it is never silently forced onto an invoice.
- Require a reason and appropriate permission for backdating, reversal, write-off, refund, or allocation changes. Posted records use reversal/correction workflows rather than deletion.

### 7.6 Move-out checkout

The guided checkout workspace combines:

1. A configurable inspection and condition checklist with photos, notes, assignee, and completion status.
2. Final utility meter readings with comparison and validation.
3. Keys, access cards, furniture, appliances, and other assets with expected/returned/missing/damaged states.
4. A deposit disposition preview showing deposit held, deductions, evidence, tax treatment, approvals, refund, and any balance due.
5. A final invoice preview covering prorated charges, utilities, damages, credits, and prior balance.
6. A review step that separates operational completion from financial approval and lease closure.

Incomplete items remain visible with owners. Finalization produces immutable references, audit events, resident-facing documents, and clear next steps for refund, collection, or dispute.

### 7.7 Import wizard

All domain imports use a consistent staged workflow:

1. Upload a supported CSV template and identify encoding, delimiter, and header row.
2. Map source columns to canonical fields, including required organization/property context, and save reusable mappings only when authorized.
3. Normalize and validate in a dry run without mutating production data.
4. Review totals, warnings, duplicates, cross-row conflicts, and representative transformed records.
5. Download an errors CSV containing source row number, stable error code, field, safe message, and original value where permitted.
6. Commit valid rows through an idempotent asynchronous job with progress, cancellation boundaries, and a durable batch ID.

Dry-run success does not guarantee commit if data changed in the interim; commit revalidates constraints. Partial completion reports exactly what was created, skipped, or rejected and provides a safe retry path.

### 7.8 Maintenance

- Kanban and list views by status, urgency, assignee, property, and age.
- Request detail with location, description, attachments, resident availability, access instructions, assignee, checklist, cost, and timeline.
- Mobile work mode optimized for one-handed updates and photo capture.
- Emergency actions visually distinct but not dependent on color alone.

### 7.9 Communications

- Notices, templates, recipient selection, delivery channels, and delivery status.
- Recipient previews based on current authorization and property scope.
- Clear warning when messages contain personal or financial data.
- Scheduled-send review and cancellation behavior.

### 7.10 Reports

- Operational, occupancy, financial, resident, and compliance report catalog.
- Scope, date range, currency, time zone, and data freshness visible.
- Saved configurations and scheduled delivery subject to permissions.
- Large reports generated asynchronously with expiring downloads.

### 7.11 Administration

- Organization profile, users, invitations, roles, properties, billing, security, integrations, templates, and retention settings.
- Impact summaries for role and security changes.
- Dedicated session and device management.
- Audit log with immutable event detail.

### 7.12 Resident portal

- Current balance and next due amount.
- Secure payment initiation and payment history.
- Current and historical lease access.
- Maintenance request creation and status.
- Notices and documents.
- Profile, communication preferences, sessions, password, and MFA controls.

## 8. Dashboards by role

### Platform Administrator

- Platform availability and service health.
- Organization provisioning and suspension activity.
- Security alerts and authentication anomalies.
- Support-access requests and active sessions.
- Aggregate usage without unnecessary resident-level data.

### Organization Owner

- Portfolio occupancy, revenue, receivables, and major trends.
- Lease expirations and operational risk.
- High-value approvals.
- Security and administrative alerts.

### Organization Administrator

- Setup completeness and data-quality issues.
- Pending invitations and access reviews.
- Property and workflow exceptions.
- Integration, billing, and security notices.

### Property Manager

- Today's move-ins, move-outs, and inspections.
- Vacancies and soon-to-expire leases.
- Overdue balances requiring follow-up.
- Open, urgent, and overdue maintenance for assigned properties.

### Accountant

- Unallocated and failed payments.
- Overdue receivables.
- Deposits and refunds requiring action.
- Reconciliation status and financial close tasks.

### Maintenance Staff

- Assigned work ordered by urgency and due time.
- Access constraints and resident availability.
- Work awaiting parts, approval, or completion evidence.
- Offline or pending-sync status on mobile.

### Read-only Auditor

- Audit coverage, recent privileged changes, and exception reports.
- Read-only financial and lease summaries.
- Saved evidence views with governed export.

### Resident/Tenant

- Balance and next payment.
- Lease dates and important obligations.
- Active maintenance requests.
- Unread notices and new documents.

## 9. High-risk UX

High-risk actions include ownership transfer, organization deletion, role escalation, personal-data export, lease activation or termination, large refunds, deposit release, reconciliation approval, support access, and security-setting changes.

Use the following pattern:

1. State the action and affected organization/property/resource.
2. Explain material consequences in plain language.
3. Show a review of changed values or affected records.
4. Identify irreversible or delayed effects.
5. Require a reason when policy or audit needs it.
6. Require recent authentication or MFA when directed by backend policy.
7. Require dual approval where separation of duties applies.
8. Use a specific confirmation label such as “Terminate lease,” not “Confirm.”
9. Show a durable result with reference ID and next steps.

Typed-name confirmation is reserved for rare destructive actions such as organization deletion; it must not become routine friction.

### 9.1 Financial safety

- Always show currency beside monetary values.
- Distinguish transaction date, accounting date, and recorded time.
- Preview allocations and balance impact.
- Never use a generic delete for posted financial activity.
- Warn about duplicate payment references.
- Display approval status and approvers.

### 9.2 Personal-data safety

- Mask sensitive values by default where full display is unnecessary.
- Show why access is unavailable without disclosing the value.
- Display export scope, fields, row estimate, purpose, retention reminder, and expiry.
- Prevent sensitive data from appearing in toast messages, URLs, analytics, or browser titles.

## 10. Accessibility: WCAG 2.2 AA

### 10.1 Keyboard and focus

- All functionality is keyboard accessible.
- Focus order follows visual and semantic order.
- Focus indicators meet contrast and visibility requirements.
- Modals trap focus, have an accessible name, and restore focus on close.
- Skip links bypass repeated navigation.
- Keyboard shortcuts are discoverable, remappable where needed, and never required.

### 10.2 Structure and semantics

- Use native HTML elements before ARIA.
- Pages have one clear primary heading and logical heading levels.
- Landmarks identify navigation, main content, search, and complementary regions.
- Tables have captions, headers, and accessible sorting state.
- Virtualized lists preserve meaningful semantics and screen-reader position.

### 10.3 Forms

- Every input has a persistent label.
- Required status and instructions are programmatically associated.
- Errors identify the field, cause, and correction.
- Submission errors receive focus through an error summary.
- Do not rely on placeholder text as a label.
- Timeouts can be extended unless a security constraint prevents it.

### 10.4 Visual presentation

- Text and essential graphical contrast meet AA thresholds.
- Status never depends only on color.
- Content supports 200% zoom and 400% reflow without loss of function.
- Text spacing can be overridden without clipping.
- Touch targets meet WCAG 2.2 target-size requirements or valid exceptions.
- Motion respects `prefers-reduced-motion`.

### 10.5 Notifications and dynamic content

- Loading and results updates use appropriate live regions without excessive announcements.
- Toasts do not contain the only copy of important information.
- Destructive and security events receive persistent inline confirmation.
- Charts include text summaries and accessible data alternatives.

Accessibility is tested with automated tooling, keyboard-only use, zoom/reflow, and representative screen readers on supported platforms.

WCAG 2.2 AA applies to every state and workflow, including dense grids, virtualized lists, charts, file uploads, offline/synchronization status, drag-and-drop alternatives, asynchronous progress, conflict resolution, and third-party payment surfaces within the product's control. No operational workflow receives an accessibility exception merely because desktop use is recommended.

## 11. Responsive and mobile behavior

### 11.1 Breakpoint strategy

Breakpoints respond to content needs rather than specific device brands. Layouts support narrow mobile screens, tablets, laptops, and large desktop displays.

### 11.2 Data-dense views

- Tables can transform into labeled cards for focused mobile workflows.
- Users can horizontally scroll genuinely tabular content with sticky identity columns and a visible affordance.
- Critical context and actions remain available without requiring hover.
- Filters open in a full-height sheet and show the active-filter count.
- Bulk financial administration may communicate that desktop is recommended, but authorized essential actions cannot fail silently on mobile.

### 11.3 Field workflows

Maintenance and inspection pages prioritize:

- Large targets and one-handed use.
- Camera and attachment capture.
- Draft preservation.
- Clear connectivity and synchronization state.
- Location, access notes, and emergency contact actions.

## 12. Loading, success, empty, and error states

### 12.1 Loading

- Use skeletons only when they resemble the final structure.
- Preserve page shell and known context.
- Avoid replacing the entire application during background refresh.
- Show progress for operations longer than a few seconds.
- Prevent duplicate submission while clearly indicating pending state.

### 12.2 Success

- Confirm completion close to the action.
- Update the visible record immediately when safe.
- Provide a durable reference for asynchronous or financial actions.
- Offer the next logical action without trapping the user.

### 12.3 Empty states

Differentiate:

- First use: explain the entity and primary setup action.
- No filter results: show active filters and clear/reset action.
- No permission: explain restricted access without implying absence.
- No current occupancy or lease: state the condition precisely.
- Data unavailable: explain dependency and recovery action.
- Overbooking/occupancy conflict: identify the affected Property, Unit, optional Bed, and date range; link to conflicting authorized records and offer safe alternatives without exposing another organization.
- Subscription limit reached: show current usage, limit, affected capability, who can change the subscription, and non-destructive next steps. Never present a plan limit as a permission or server error.

Do not use cheerful generic illustrations for serious financial, security, or resident-safety states.

### 12.4 Errors

- Use plain language and stable support reference IDs.
- Preserve user input after recoverable failures.
- Distinguish validation, permission, conflict, connectivity, and server failures.
- Provide retry only when retry is safe.
- For stale updates, explain the conflict and allow review of the latest version.
- Never expose stack traces, SQL details, token data, tenant identifiers not already authorized, or raw provider errors.

### 12.5 Partial and asynchronous results

Dashboards and reports may load modules independently. Failed modules show local recovery without invalidating successful content. Long-running exports and imports expose queued, processing, completed, partially completed, failed, and expired states.

## 13. Design system

### 13.1 Foundations

Define tokens for:

- Color roles, including semantic success, warning, danger, and information.
- Typography scale and readable line lengths.
- Spacing, grid, breakpoints, radius, border, elevation, and motion.
- Focus rings and interactive states.
- Density modes for comfortable and compact enterprise layouts.
- Light and dark themes if dark mode is supported.

Tokens use semantic names such as `color-text-danger`, not presentation names such as `red-600` in product components.

### 13.2 Core components

- Buttons and icon buttons.
- Inputs, select, combobox, date and time controls.
- Currency and numeric input.
- Checkbox, radio, switch, and segmented control.
- Form field, help text, and error summary.
- Table, data grid, pagination, filter bar, and saved view.
- Badge, status indicator, alert, toast, and progress.
- Modal, drawer, popover, tooltip, and menu.
- Tabs, breadcrumbs, stepper, and navigation.
- Card, description list, timeline, and activity feed.
- File upload, document preview, and image capture.
- Empty, loading, permission-denied, and error states.

Every component documents accessibility semantics, responsive behavior, content rules, keyboard behavior, and supported states.

### 13.3 Status language

Statuses are domain-specific. Avoid using a universal “active/inactive” when the real state is `draft`, `signed`, `occupied`, `overdue`, `assigned`, or `suspended`. Status labels and colors are consistent across detail pages, filters, reports, and exports.

### 13.4 Content design

- Use direct verbs: “Record payment,” “Invite member,” “Renew lease.”
- Use sentence case.
- Explain consequences before confirmation.
- Avoid unexplained abbreviations.
- Put technical identifiers in secondary text unless operationally primary.
- Use resident-preferred names where appropriate while preserving legal names in contractual contexts.

## 14. Localization and time zones

### 14.1 Localization

- Externalize all user-facing strings.
- Support pluralization, grammatical variants, and text expansion.
- Avoid concatenating translated sentence fragments.
- Use locale-aware number, currency, percentage, date, and address formatting.
- Do not embed text in icons or images.
- Prepare layouts for right-to-left languages even if not in the first release.

### 14.2 Currency

Financial records store currency explicitly. Never infer currency solely from locale. Multi-currency views label each value and do not total incompatible currencies without an explicit conversion basis.

### 14.3 Time zones

Store instants in UTC and display them using an explicit time zone.

The UI distinguishes:

- Organization default time zone.
- Property time zone when properties span regions.
- User display preference where appropriate.
- Date-only business values, such as lease start date, which must not shift because of browser time zone.

Reports, dashboards, exports, scheduled notices, and audit events display their effective time zone. Audit details may show both local time and UTC. Daylight-saving transitions must not duplicate or omit scheduled business operations silently.

## 15. PWA and offline boundaries

The React application may provide installability, cached shell assets, push notifications, and narrowly scoped offline field workflows.

### 15.1 Allowed offline behavior

- Cache the application shell and non-sensitive static assets.
- Save maintenance or inspection drafts locally with explicit status.
- Queue approved field updates and attachments with clear pending-sync indication.
- Display previously downloaded work assignments only when local-data policy allows.
- Retry idempotent operations after reconnection.

### 15.2 Prohibited or restricted offline behavior

- Do not cache access or refresh tokens in service-worker caches, IndexedDB, or local storage.
- Do not provide offline access to broad resident, lease, financial, audit, or export datasets.
- Do not queue payments, refunds, lease activation/termination, role changes, security changes, or organization deletion for blind replay.
- Do not show stale financial balances as current.
- Do not allow service-worker responses to cross organization contexts.

### 15.3 Synchronization

Offline-capable records have client-generated idempotency keys, version checks, and conflict handling. The UI shows:

- Offline status.
- Number of pending changes.
- Last successful synchronization.
- Per-item failures.
- Conflict resolution requiring user review.

Logout, organization switch, session revocation, or account removal clears protected local data and pending operations according to policy. Remote push messages contain minimal data and open the authenticated application for details.

## 16. Performance and perceived responsiveness

- Prioritize useful above-the-fold content.
- Use server-side pagination, filtering, sorting, and aggregation.
- Virtualize only when needed and without breaking accessibility.
- Prefetch predictable routes only within the active organization context.
- Cancel obsolete requests after filter or organization changes.
- Prevent stale responses from replacing data in a newer tenant or property context.
- Show data freshness on dashboards and reports.
- Establish performance budgets for startup, route transition, interaction latency, and large-list rendering.

## 17. Privacy and security in the UI

- Apply a strict Content Security Policy and safe output encoding.
- Do not place sensitive values or tokens in URLs.
- Redact personal data from analytics, replay tools, and client logs.
- Use expiring, authorized URLs for S3 documents.
- Clear organization-specific state on organization switch and logout.
- Require backend-confirmed permissions for every action.
- Treat feature flags as presentation controls, not authorization.
- Prevent browser autofill on inappropriate financial or security fields while preserving password-manager compatibility on authentication fields.
- Warn users before navigating away from unsaved consequential work.

## 18. Design and quality validation

Each major workflow is validated against:

- Every relevant canonical role and scope.
- Small organizations and portfolios exceeding 10,000 units.
- Keyboard-only and screen-reader usage.
- 200% zoom and 400% reflow.
- Narrow mobile, tablet, desktop, and high-density layouts.
- Slow, intermittent, and offline connections where supported.
- Long translations, non-Latin names, and locale-specific formats.
- Empty, partial, error, stale, and permission-change states.
- High-risk confirmation, reauthentication, approval, and audit outcomes.

Usability testing should include property-office staff, field maintenance workers, accountants, administrators, auditors, and residents.

## 19. Acceptance criteria

- Users can always identify the active organization and property scope.
- Navigation and actions match effective permissions without being treated as enforcement.
- Core workflows remain usable from 30 to more than 10,000 units.
- Resident identity, physical occupancy, and contractual lease are represented separately.
- High-risk actions show consequences, require appropriate assurance, and produce durable confirmation.
- All core experiences meet WCAG 2.2 AA.
- Mobile field workflows work under intermittent connectivity within defined offline boundaries.
- Financial values always show currency and relevant date/time context.
- Loading, empty, error, stale, and permission-denied states are designed for every main page.
- Organization switches and logout cannot leave prior-organization data visible or cached.
