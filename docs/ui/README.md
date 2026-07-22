# UI/UX Documentation Index

This directory is the implementation-ready screen specification for the Rental Property Management SaaS. It is documentation only. Normative order: product/business rules → API and permission contracts → `design-system.md`, `navigation.md`, and [`cross-cutting-patterns.md`](./cross-cutting-patterns.md) → individual screen documents. Resolve conflicts through an approved documentation change.

## Foundation documents

- [Cross-cutting patterns](./cross-cutting-patterns.md) — session isolation, permission presentation, high-risk UX, async/bulk/import, offline boundaries, and shared state conventions.
- [Deferred screen inventory](./deferred-screens.md) — backlog screens referenced in product/architecture docs not yet individually specified.
- [Design system](../design-system.md) · [Navigation](../navigation.md) · [Screen template](./_template.md)

## Canonical terminology
- **Organization:** SaaS customer and isolation boundary; never a renter.
- **Resident:** renter/person living or expected to live at a Property. Do not label renters “tenants” in UI.
- **Lease:** contract governing occupancy and financial terms.
- **Property:** managed physical site.
- **Unit:** apartment, studio, private room, or shared room. There is no Room entity.
- **Bed:** optional named assignable place beneath a shared Unit.
- **Meter:** one resource with `meterType=ELECTRICITY|WATER`.
- **Property Owner:** business Party with an effective ownership interest; distinct from **Organization Owner**, the privileged SaaS role.
- **Payment:** money received/confirmed; do not conflate initiation, confirmation, settlement, allocation, or reconciliation.

## Shared screen template
New screens copy [`_template.md`](./_template.md). Every screen must retain all required sections, even when the conclusion is that a specific component is not applicable. Use N/A only after explaining why the screen has no meaningful instance.

## Breakpoints
`xs 0–479`, `sm 480–767`, `md 768–1023`, `lg 1024–1279`, `xl 1280–1535`, `2xl ≥1536`. Layout follows available CSS pixels at zoom/reflow. Mobile gutters are 16 px; desktop 24 px. Complex tables may scroll with sticky identity, while task-focused lists become labeled cards.

## Global shell
Staff: persistent sidebar/rail, 56 px top bar, Organization switcher, sticky Property scope, global search, notifications, Operations Center, help, and user/security menu. Resident and platform users receive separate permission shells using the same foundations. A support-access banner and read-only banner persist across navigation.

Organization switch uses authenticated token exchange, cancels in-flight requests, purges prior-Organization queries/drafts/subscriptions/optimistic state, resets Property scope, and renders the target only after isolation is complete.

## Cross-cutting states
- Loading and structure-matched skeleton; local refresh must not blank the shell.
- First-use empty, filtered-empty, no-current-relationship, dependency unavailable, subscription limit, and restricted-scope states.
- Validation, conflict/stale version, rate limit, permission change, dependency, and internal errors using safe RFC 9457 messages.
- Durable success with resource/operation ID for financial, security, export, and async actions.
- Permission denied that does not reveal cross-Organization resource existence.
- Offline/stale state; high-risk mutations require confirmed online execution.
- Async queued/running/partially succeeded/succeeded/failed/cancelled states in Operations Center.
- Document uploading/scanning/ready/rejected states and export/report expiry.
- Light/dark themes, English/Vietnamese, reduced motion, 200% zoom, 400% reflow, and WCAG 2.2 AA.

## Screen inventory

### Auth

- [Login](./auth/login.md)
- [Forgot Password](./auth/forgot-password.md)
- [Reset Password](./auth/reset-password.md)
- [Email Verify](./auth/email-verify.md)
- [MFA Challenge](./auth/mfa-challenge.md)
- [Invitation Accept](./auth/invitation-accept.md)

### Shell

- [Organization Switcher](./shell/organization-switcher.md)
- [Global Search](./shell/global-search.md)
- [Notifications Center](./shell/notifications-center.md)
- [Operations Center](./shell/operations-center.md)

### Home

- [Dashboard Home](./home/dashboard-home.md)

### Portfolio

- [Properties List](./portfolio/properties-list.md)
- [Property Detail](./portfolio/property-detail.md)
- [Property Create Edit](./portfolio/property-create-edit.md)
- [Buildings List](./portfolio/buildings-list.md)
- [Units List](./portfolio/units-list.md)
- [Unit Detail](./portfolio/unit-detail.md)
- [Unit Create Edit](./portfolio/unit-create-edit.md)
- [Beds List](./portfolio/beds-list.md)
- [Availability Lookup](./portfolio/availability-lookup.md)
- [Property Owners List](./portfolio/property-owners-list.md)
- [Property Owner Detail](./portfolio/property-owner-detail.md)
- [Management Agreements List](./portfolio/management-agreements-list.md)
- [Management Agreement Detail](./portfolio/management-agreement-detail.md)

### Residents

- [Residents List](./residents/residents-list.md)
- [Resident Detail](./residents/resident-detail.md)
- [Resident Create Edit](./residents/resident-create-edit.md)
- [Waitlist](./residents/waitlist.md)

### Leasing

- [Leases List](./leasing/leases-list.md)
- [Lease Detail](./leasing/lease-detail.md)
- [Lease Create Wizard](./leasing/lease-create-wizard.md)
- [Lease Activate](./leasing/lease-activate.md)
- [Lease Renew Transfer](./leasing/lease-renew-transfer.md)
- [Move In](./leasing/move-in.md)
- [Move Out Checkout](./leasing/move-out-checkout.md)

### Finance

- [Invoices List](./finance/invoices-list.md)
- [Invoice Detail](./finance/invoice-detail.md)
- [Billing Run Workspace](./finance/billing-run-workspace.md)
- [Meter Reading Grid](./finance/meter-reading-grid.md)
- [Utility Allocation Run](./finance/utility-allocation-run.md)
- [Payment Record Cash Bank](./finance/payment-record-cash-bank.md)
- [Payments List](./finance/payments-list.md)
- [Payment Detail](./finance/payment-detail.md)
- [Payment Plans List](./finance/payment-plans-list.md)
- [Payment Plan Detail](./finance/payment-plan-detail.md)
- [Deposits List](./finance/deposits-list.md)
- [Deposit Disposition](./finance/deposit-disposition.md)
- [Arrears Workspace](./finance/arrears-workspace.md)
- [Expenses List](./finance/expenses-list.md)
- [Expense Detail](./finance/expense-detail.md)
- [Reconciliation Workspace](./finance/reconciliation-workspace.md)
- [Credit Notes List](./finance/credit-notes-list.md)

### Maintenance

- [Maintenance Requests List](./maintenance/maintenance-requests-list.md)
- [Maintenance Request Detail](./maintenance/maintenance-request-detail.md)
- [Work Orders List](./maintenance/work-orders-list.md)
- [Work Order Detail](./maintenance/work-order-detail.md)
- [Inspections List](./maintenance/inspections-list.md)
- [Inspection Detail](./maintenance/inspection-detail.md)

### Communications

- [Notifications List](./communications/notifications-list.md)
- [Notification Compose](./communications/notification-compose.md)
- [Notification Templates List](./communications/notification-templates-list.md)
- [Notification Template Editor](./communications/notification-template-editor.md)

### Documents

- [Documents Library](./documents/documents-library.md)
- [Document Upload](./documents/document-upload.md)
- [Document Detail](./documents/document-detail.md)

### Reports

- [Reports Catalog](./reports/reports-catalog.md)
- [Report Run](./reports/report-run.md)
- [Scheduled Reports List](./reports/scheduled-reports-list.md)
- [Scheduled Report Editor](./reports/scheduled-report-editor.md)

### Admin

- [Organization Settings](./admin/organization-settings.md)
- [Users List](./admin/users-list.md)
- [User Detail](./admin/user-detail.md)
- [Invitations List](./admin/invitations-list.md)
- [Roles List](./admin/roles-list.md)
- [Role Editor](./admin/role-editor.md)
- [Integrations List](./admin/integrations-list.md)
- [Integration Detail](./admin/integration-detail.md)
- [Audit Log](./admin/audit-log.md)
- [Import Wizard](./admin/import-wizard.md)
- [Export Center](./admin/export-center.md)

### Resident Portal

- [Portal Home](./resident-portal/portal-home.md)
- [Portal Lease](./resident-portal/portal-lease.md)
- [Portal Invoices](./resident-portal/portal-invoices.md)
- [Portal Payments](./resident-portal/portal-payments.md)
- [Portal Maintenance](./resident-portal/portal-maintenance.md)
- [Portal Documents](./resident-portal/portal-documents.md)
- [Portal Profile](./resident-portal/portal-profile.md)

### Platform

- [Platform Dashboard](./platform/platform-dashboard.md)
- [Platform Organizations](./platform/platform-organizations.md)
- [Support Access](./platform/support-access.md)
