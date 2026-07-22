# Cross-Cutting UI Patterns

**Status:** Canonical implementation guidance  
**Audience:** Product design, frontend engineering, QA  
**Normative references:** [Authentication](../05-authentication.md) · [Permission System](../06-permission-system.md) · [UI Design](../07-ui-design.md) · [Design System](../design-system.md) · [Navigation](../navigation.md)

This document consolidates behaviors that apply across many screens. Individual screen specifications in `docs/ui/` remain authoritative for page layout and field lists; this document is authoritative for shared client behavior, authorization presentation, high-risk flows, async work, offline boundaries, and state conventions.

---

## 1. Client security and session model

### 1.1 Token handling

- Access tokens live **only in application memory**.
- Refresh tokens are **HttpOnly, Secure** cookies; never local/session storage, IndexedDB, service-worker caches, URLs, analytics, or logs.
- Neither token may appear in page titles, breadcrumbs, shareable URLs, or error toasts.

### 1.2 Sign-in and account recovery

- Use identical generic outcomes for unknown email, wrong password, disabled account, lockout, and ineligible membership.
- Password success with MFA required returns a **challenge context**, not an authenticated session.
- Password reset, email verification, and invitation links are single-use, time-bounded, and must not disclose organization membership.
- Workforce and resident invitations use **separate visual and routing surfaces**; possession of an invitation never replaces credentials.

### 1.3 Token refresh

- Single-flight refresh: concurrent API calls await one refresh operation.
- Preserve shell and known context during refresh; do not blank the application.
- Retry failed requests only after refresh succeeds.
- Refresh-token reuse invalidates the family, clears all sensitive state, and routes to signed-out with a security-appropriate message (no attacker-useful detail).

### 1.4 Organization switch (atomic isolation)

Organization switch is a **security boundary**, not a filter change.

1. Show explicit loading; block interaction with stale content.
2. Cancel or partition all in-flight requests.
3. Purge prior-organization query caches, mutation state, optimistic updates, drafts, prefetched routes, subscriptions, and protected offline data.
4. Reset property scope and incompatible filters.
5. Exchange token through authenticated session endpoint.
6. Install new access token only after exchange succeeds.
7. Render new organization only after isolation completes.
8. On failure: recoverable error; **never** silently fall back to another organization.
9. Serialize concurrent switch and refresh operations.

### 1.5 Logout and forced revocation

Current-session logout revokes server session, clears cookie, purges all organization-specific client state, and routes to signed-out without briefly showing protected content.

Gracefully terminate or refresh authorization after: password change, MFA change, membership suspension/removal, role reduction, account disablement, administrative session revocation, or token reuse.

### 1.6 Support elevation presentation

When platform support enters an organization:

- Persistent banner: support mode, target organization, remaining duration, exit action.
- Dual-identity audit attribution preserved in UI copy where operators need clarity.
- Owner-only, selected financial, and security actions remain disabled with plain-language reasons.

---

## 2. Permission-aware presentation

The UI improves discoverability; **the server is always authoritative**.

| Behavior | When to use |
|---|---|
| **Hide** | Destination or action is wholly unavailable to the actor |
| **Disable + reason** | Action is sometimes unavailable; discoverability helps workflow |
| **Read-only shell** | Auditor or mutation-less role |
| **Non-disclosing empty** | Actor lacks list permission; do not imply resource absence |
| **Scoped labels** | Show organization, property, role, and data-class scope on every high-impact view |

### 2.1 Revalidation triggers

Re-fetch `/me` authorization metadata after:

- Role or assignment change
- Organization switch
- Session refresh following revocation-like events
- Support elevation start/end

Handle mid-session permission denial without crashes: disable stale affordances, show inline permission change notice, preserve safe user input.

### 2.2 Role navigation summary

| Role | Primary shell emphasis | Typical restrictions |
|---|---|---|
| **Platform Administrator** | Platform health, org directory, security, support access | No implicit org data; MFA mandatory; shorter privileged sessions |
| **Organization Owner** | Portfolio-wide dashboard, administration, high-risk approvals | Org-bound; ownership transfer needs MFA + confirmation |
| **Organization Administrator** | Configuration, users, roles, integrations, templates | No ownership transfer/org delete; SoD on security + refund combos |
| **Property Manager** | Assigned-property operations, leasing, collections follow-up | Property-scoped; no unrestricted refunds/write-offs/role admin |
| **Accountant** | Finance workspaces, reconciliation, governed exports | No user/role admin; resident PII minimized to finance needs |
| **Maintenance Staff** | Mobile assigned-work queue, inspections | Minimal resident contact; offline limited to approved drafts |
| **Read-only Auditor** | Traceable lists, audit, evidence views | No mutation affordances; export may need separate permission |
| **Resident** | Self-service portal only | Self scope from server; no workforce navigation |

Property ownership records and management agreements **do not grant application access**; they are portfolio attribution, not login entitlements.

---

## 3. High-risk, step-up, and dual-control UX

### 3.1 High-risk action catalog

Includes but is not limited to:

- Password, email, MFA, recovery-code changes
- Organization ownership transfer or deletion
- Property deletion
- Privileged role creation/assignment
- Sensitive resident-data reveal
- Personal/bulk/audit exports
- Lease activation/termination
- Large refunds, deposit release/disposition, write-offs
- Reconciliation approval
- Billing, payout, SSO, MFA-enforcement, and security policy changes
- Support access entry
- Logout all sessions

### 3.2 Standard confirmation sequence

1. Identify exact action, organization, property, and records affected.
2. Explain material consequences in plain language.
3. Show changed values, scope, totals, exclusions, and irreversible effects.
4. Collect required reason or audit purpose.
5. Request recent authentication/MFA per policy.
6. Show approval requirements and eligible next approver when dual control applies.
7. Prevent same-person approve-and-execute where policy forbids it.
8. Use action-specific primary button label (e.g., “Terminate lease”, not “Confirm”).
9. Show durable result with reference ID, status, and next steps.

Typed-name confirmation is reserved for rare destructive actions (e.g., organization deletion).

### 3.3 Dual-control rules (presentation)

| Domain | UI must enforce visibility of |
|---|---|
| Refunds / write-offs / deposit release | Requester ≠ approver ≠ executor when dual control enabled |
| Reconciliation | Preparer ≠ approver |
| Exports above threshold | Approver ≠ executor |
| Support access (sensitive) | Requester ≠ approver |
| Ownership transfer | Current-owner confirmation + recent MFA |

### 3.4 PII export preview (mandatory)

Before execution, show: scope, filters, fields, estimated rows, classification, purpose, approval state, retention reminder, download expiry, and download history. Non-empty reviewed purpose and step-up are required regardless of permission possession.

### 3.5 Financial safety presentation

- Currency beside every amount; never infer currency from locale alone.
- Distinguish transaction date, accounting date, and recorded timestamp.
- Show allocation/balance impact preview before commit.
- No generic delete for posted activity; use reversal/correction flows.
- Surface duplicate-reference warnings and approval status with named approvers.

---

## 4. Async, bulk, and import patterns

### 4.1 When to run asynchronously

Use async jobs for: billing runs, utility allocation at scale, bulk meter commit, imports, large exports, report generation, bulk notices, and multi-record financial mutations exceeding interaction-time thresholds.

### 4.2 Operations Center contract

Every async job exposes:

| Field | Requirement |
|---|---|
| Durable operation ID | Copyable; links from notifications |
| Status | `queued` → `processing` → `partially_completed` \| `completed` \| `failed` \| `cancelled` \| `expired` |
| Scope | Organization, property, period, actor |
| Progress | Counts processed / total when known |
| Result summary | Created, updated, skipped, failed with reasons |
| Retry affordance | Failed-items-only when idempotent |
| Retention | Expiry for downloads and previews |

Users must be able to navigate away and return without losing track of the job.

### 4.3 Bulk selection UX

- Selected count and effective scope always visible.
- Excluded rows explained (permission, lifecycle, currency mismatch, legal hold).
- Impact preview and validation before commit.
- Prevent duplicate submission; show in-flight state on primary action.
- Partial failure preserves successful work and identifies failed items.

### 4.4 Import wizard stages

`upload` → `identify` → `map` → `dry-run` → `review` → `commit` → `summary`

- Dry-run shows totals, warnings, duplicates, conflicts, transformed samples.
- Errors downloadable as CSV.
- Commit is idempotent with durable batch ID.
- Cancellation boundaries documented per import type.

Supported import types (UI must label explicitly): opening balances, properties/units/beds, residents, leases, meters/readings, payments, chart mappings. Types without API backing must not appear as selectable.

### 4.5 Idempotency and concurrency (client)

- Send `Idempotency-Key` on non-idempotent writes where API requires it.
- Send `If-Match` / ETag on updates; on `412`, show latest version with review/resubmit path.
- Key client data by organization, authorization version, property scope, filters, and resource identity to prevent stale overwrites.

---

## 5. Offline, PWA, and field sync

### 5.1 Allowed offline

- Application shell and non-sensitive static assets
- Maintenance/inspection drafts and approved queued field updates
- Previously downloaded assignments when policy permits
- Meter-reading **local draft only**; commit requires online validation

### 5.2 Prohibited offline

- Token caching
- Broad resident, lease, financial, audit, or export datasets
- Blind replay of payments, refunds, lease activation/termination, role/security changes, organization deletion
- Presenting stale balances as current
- Service-worker responses crossing organization contexts

### 5.3 Sync indicator states

`offline` · `online` · `local_draft` · `syncing` · `server_draft` · `ready` · `partially_invalid` · `committed` · `conflict`

Logout, organization switch, revocation, or account removal clears protected local data and pending operations.

---

## 6. Component and state conventions

### 6.1 Core inventory

All product surfaces compose from: buttons, inputs, selects/comboboxes, date/time and currency controls, tables/grids, filter bars, badges, alerts/toasts, modals/drawers/sheets, tabs, breadcrumbs, steppers, cards, timelines, uploads, empty/loading/error states, organization switcher, property-scope selector, approval/step-up controls, async status, offline/sync indicator.

Use **semantic tokens** from [design-system.md](../design-system.md); never raw palette names in product code.

### 6.2 Domain status vocabulary

Use domain-specific statuses consistently across lists, filters, detail headers, exports, and audit:

| Domain | Example statuses |
|---|---|
| Lease | draft, approved, signed, activated, terminated, renewed |
| Occupancy | vacant, reserved, occupied, move-out pending |
| Maintenance | open, assigned, in progress, awaiting parts/approval, completed, closed |
| Membership | invited, active, suspended, removed |
| Async job | queued, processing, partially completed, completed, failed, expired |
| Document | uploading, scanning, ready, rejected |

### 6.3 Loading

- Skeleton only when structure matches final layout.
- Independent dashboard/report modules load and fail independently.
- Background refresh must not blank shell or hide organization/property context.

### 6.4 Empty states (distinct)

First-use/setup · filtered-empty · no permission · no current relationship · dependency unavailable · subscription limit · occupancy conflict.

Permission-empty must not imply non-existence. Subscription limits are product gates, not authorization failures.

### 6.5 Error taxonomy (user-facing)

| Class | User guidance |
|---|---|
| Validation | Field-level cause and correction |
| Permission | Plain denial; no cross-tenant hints |
| Lifecycle conflict | Explain blocking state and next step |
| Stale version | Show latest; offer review/resubmit |
| Connectivity | Retry when safe; preserve input |
| Rate limit | Cooldown messaging |
| Session expired | Route to re-auth; clear sensitive state |
| Server failure | Safe message + support reference ID |
| Partial async failure | Preserve success; list failed items |

Never expose stack traces, SQL, tokens, or raw provider errors.

### 6.6 Success feedback

- Confirm near initiating action.
- Durable reference for financial, security, export, and async actions.
- Toasts supplement but do not replace durable confirmation for high-risk work.

---

## 7. Localization, time, and accessibility

### 7.1 Localization

- Externalize all user-facing strings; support English and Vietnamese at GA.
- Locale-aware number, currency, date, and address formatting.
- Store currency explicitly; label amounts in multi-currency views.
- Business date-only values must not shift with browser time zone.
- Reports, dashboards, and audit show effective time zone; audit may show local + UTC.

### 7.2 Accessibility (WCAG 2.2 AA)

- Complete keyboard access, visible focus, modal trap and restoration.
- Table headers, captions, sort state; virtualization with accessible alternative.
- Error summary receives focus on submit failure.
- Status not conveyed by color alone; chart summaries and data alternatives required.
- 200% zoom and 400% reflow without loss of content or function.
- Reduced-motion support; live regions without announcement flooding.

---

## 8. Performance and data freshness

- Server-side pagination, filtering, sorting, and aggregation for large datasets.
- Cancel obsolete requests after filter, scope, or organization changes.
- Dashboard/report cards show scope, date range, and **freshness/as-of**.
- Prefetch only inside active organization context.

---

## 9. Screen authoring checklist

When creating or reviewing a screen specification, confirm:

- [ ] Purpose, actors, and entry points aligned with API § and permissions
- [ ] Organization and property scope visible where data is scope-sensitive
- [ ] High-risk actions follow §3 confirmation sequence
- [ ] Async/bulk/import flows link to Operations Center
- [ ] All required template sections present (use N/A only with justification)
- [ ] Empty, loading, error, permission, and offline states distinct
- [ ] English and Vietnamese string-length risk considered in layout
- [ ] WCAG 2.2 AA behaviors documented for interactive components

See also: [deferred-screens.md](./deferred-screens.md) for backlog screens not yet individually specified.
