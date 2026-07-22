# Rental Property Management SaaS — Business Requirements

**Document ID:** RPM-BR-01  
**Status:** Draft baseline  
**Audience:** Product, engineering, design, QA, security, operations, implementation, and customer-facing teams  
**Parent document:** [00 — Product Overview](./00-overview.md)

## 1. Purpose

This document defines the business requirements for a commercial multi-tenant Rental Property Management SaaS serving boarding houses and apartments from approximately 30 to more than 10,000 independently managed Units and Beds.

The terms **Organization**, **Resident**, **Leaseholder**, **Property**, **Unit**, **Bed**, **Rentable Item**, **Lease**, **Resident Account**, **Charge**, **Payment**, **Meter**, and **Work Order** have the normative meanings defined in the [Product Overview](./00-overview.md#5-canonical-vocabulary). Organization is the customer-facing account and isolation boundary and maps one-to-one to the internal `tenant_id`; **tenant** terminology is reserved primarily for architectural and database implementation language.

## 2. Scope and assumptions

### 2.1 Included business scope

The initial product includes Organization administration and subscriptions; access control; Properties and inventory; Residents; Leases; billing; Payments; deposits; utilities; maintenance; communications; documents; reports; audit; localization; imports/exports; and operational integration points.

### 2.2 Explicit boundaries

The initial product is not a full general ledger, payroll system, tax-filing service, payment-card vault, public rental marketplace, physical access-control system, or construction-management suite. It does not make legal or automated eligibility decisions. Jurisdiction-specific compliance remains the customer's responsibility unless a requirement explicitly states otherwise.

### 2.3 Solution assumptions

- React and TypeScript frontend.
- NestJS modular monolith backend.
- PostgreSQL through Prisma.
- Redis for cache, queues, and suitable distributed coordination.
- S3-compatible private object storage.
- Short-lived JWT access tokens and rotating refresh tokens.
- Shared database with mandatory `tenant_id` row isolation initially.
- Containerized deployment with managed configuration and secrets.

Business requirements remain authoritative if the implementation evolves beyond these assumptions.

## 3. Actors

| Actor | Primary responsibilities |
|---|---|
| Organization Owner | Organization ownership, subscription, security, and top-level administration |
| Portfolio Administrator | Configuration, users, roles, portfolio-wide policies, and templates |
| Property Manager | Day-to-day occupancy, lease, account, communication, and property operation |
| Leasing Officer | Resident onboarding and lease lifecycle |
| Finance Officer | Charges, payments, deposits, reconciliation, and financial reporting |
| Maintenance Manager | Request triage, work assignment, service levels, and cost control |
| Technician/Vendor | Restricted access to assigned Work Orders |
| Auditor/Executive | Read-only reports, records, and audit evidence |
| Resident/Leaseholder | Self-service access to authorized personal, lease, account, document, and request data |
| Platform Administrator | Service and subscription operations through controlled platform tooling |
| External System | Payment, accounting, identity, messaging, or reporting integration |

## 4. Functional requirements

Unless otherwise stated, every function must enforce Organization isolation, role and Property scope, audit requirements, localization, and applicable subscription entitlements.

### 4.1 Organization lifecycle and configuration

- **FR-TEN-001:** The system shall create an Organization with a globally unique identifier, one immutable internal `tenant_id`, legal/display name, owner, subscription plan, status, default locale, default currency, and IANA time zone.
- **FR-TEN-002:** The system shall support the lifecycle states Trial, Active, Grace Period, Suspended, Closure Requested, Closed/Pending Deletion, and Deleted/Anonymized.
- **FR-TEN-003:** Authorized users shall configure branding, contact details, invoice identity, numbering rules, payment instructions, business calendar, and feature settings.
- **FR-TEN-004:** Lifecycle transitions shall require authorization, reason capture where material, idempotent execution, and an audit event.
- **FR-TEN-005:** Suspension shall block ordinary mutating operations while preserving policy-approved owner access to subscription management, support, and data export.
- **FR-TEN-006:** Reactivation shall restore access without changing durable business identifiers or historical records.
- **FR-TEN-007:** Closure shall provide ownership verification, export options, a disclosed retention window, legal-hold handling, and cancellation before irreversible deletion when policy permits.
- **FR-TEN-008:** The system shall retain or anonymize closed Organization data according to configurable policy and backup expiration.
- **FR-TEN-009:** Authorized Platform Administrators shall view lifecycle and service metadata without receiving unrestricted business-data access.
- **FR-TEN-010:** The system shall provide a guided setup checklist covering organization settings, first Property, inventory, users, billing policy, and first Lease.

### 4.2 Identity, authentication, and authorization

- **FR-IAM-001:** A User shall authenticate through a verified identity and may belong to multiple Organizations.
- **FR-IAM-002:** Owners and authorized administrators shall invite, resend, revoke, suspend, and remove user memberships.
- **FR-IAM-003:** Invitations shall expire, be single-use, and bind acceptance to the intended Organization and email or identity.
- **FR-IAM-004:** The system shall provide predefined roles and support permission assignments scoped to all Properties or selected Properties.
- **FR-IAM-005:** Authorization shall be enforced server-side for every request and background operation; hidden user-interface controls alone are insufficient.
- **FR-IAM-006:** Access tokens shall be short-lived JWTs; refresh tokens shall rotate on use and support revocation and reuse detection.
- **FR-IAM-007:** Users shall view and revoke active sessions; security-sensitive changes shall invalidate affected sessions.
- **FR-IAM-008:** The system shall support configurable password, lockout, and multi-factor authentication policies where local authentication is used.
- **FR-IAM-009:** Resident-facing access shall expose only records explicitly related to the authenticated Resident or authorized party.
- **FR-IAM-010:** Support access shall be time-bound, least-privilege, reason-based, customer-visible where policy requires, and fully audited.

### 4.3 Subscription, entitlements, and SaaS billing

- **FR-SUB-001:** The system shall maintain subscription plan, billing cycle, trial dates, renewal date, status, payment-provider references, and applicable tax identity.
- **FR-SUB-002:** Plans shall define entitlements and usage limits, including allowed Properties, rentable inventory, staff users, storage, and optional modules.
- **FR-SUB-003:** Usage shall be measured consistently and shown to authorized owners before a limit is reached.
- **FR-SUB-004:** Soft limits shall warn; hard limits shall block only the action that would exceed the limit and shall not hide or delete existing data.
- **FR-SUB-005:** Plan upgrades shall apply according to commercial policy without feature interruption; downgrades shall disclose conflicts and effective date before confirmation.
- **FR-SUB-006:** Failed SaaS subscription payments shall trigger configurable retry, Grace Period, notification, and suspension workflows.
- **FR-SUB-007:** The system shall retain an auditable history of plan, price, entitlement, discount, tax, invoice, and subscription-status changes.
- **FR-SUB-008:** Customer rental transactions and SaaS subscription charges shall use separate ledgers and terminology.
- **FR-SUB-009:** Cancellation shall not itself delete customer data; data closure follows the Organization lifecycle.
- **FR-SUB-010:** Entitlement checks shall not weaken security or prevent authorized export of customer-owned data during allowed retention periods.

### 4.4 Portfolio, property, and inventory

- **FR-INV-001:** Authorized users shall create, update, archive, and view Properties with addresses, contacts, time zones, operational settings, and attributes.
- **FR-INV-002:** A Property shall support Units and optional Beds in the hierarchy Property → Unit → optional Bed.
- **FR-INV-003:** A Unit shall belong to exactly one Property; a Bed shall belong to exactly one shared Unit. The inventory model shall not introduce a separate Room entity.
- **FR-INV-004:** Each inventory item shall have a unique code within its configured parent scope, capacity, attributes, operational status, and effective availability dates.
- **FR-INV-005:** The system shall support whole-Unit rental, Bed-level rental, and Unit-capacity allocation within the same Organization and Property. Apartments, studios, private rooms, and shared rooms are represented as Unit types.
- **FR-INV-006:** Authorized users shall configure amenities, rate defaults, deposit defaults, utility applicability, and document attachments.
- **FR-INV-007:** Operational statuses shall include at least Active, Unavailable, Under Maintenance, and Retired, with reason and effective period.
- **FR-INV-008:** Occupancy and future availability shall be derived from date-effective Lease assignments and reservations, not from a manually maintained occupied flag.
- **FR-INV-009:** The system shall prevent overlapping assignments beyond effective capacity unless an authorized override policy explicitly permits and audits the exception.
- **FR-INV-010:** Inventory with financial or occupancy history shall be archived or retired rather than physically deleted.
- **FR-INV-011:** Users shall search and filter inventory by Property, hierarchy, type, status, capacity, occupancy, availability date, price, and attributes.
- **FR-INV-012:** Bulk import and update shall validate the hierarchy and provide row-level errors before commit.
- **FR-INV-013:** The system shall distinguish a non-blocking inquiry, an expiring soft hold that temporarily reduces displayed availability, and a hard reservation that blocks conflicting assignment for a defined period.
- **FR-INV-014:** Holds and reservations shall record Rentable Item/capacity, requester, effective period, expiry instant, source, status, and conversion/cancellation reason; expiry and conversion shall be idempotent.
- **FR-INV-015:** Conversion of a hold or reservation to a Lease shall revalidate capacity transactionally so concurrent requests cannot overbook the same Unit, Bed, or capacity place.
- **FR-INV-016:** Authorized users shall maintain date-ordered waitlists by Property or inventory criteria and may offer available inventory without disclosing other applicants' personal data.
- **FR-INV-017:** Authorized users shall maintain Property Owner profiles for persons and legal entities without requiring each owner to be a User or separate SaaS Organization.
- **FR-INV-018:** A Property may have multiple effective-dated ownership interests, and one Property Owner may hold interests in multiple Properties managed by the Organization.
- **FR-INV-019:** Each ownership interest shall record interest type, effective period, optional ownership percentage, evidence/document references, status, and source; ownership changes shall preserve prior history.
- **FR-INV-020:** Percentage-bearing interests for the same Property, ownership class, and effective period shall not exceed 100 percent; disputed, unknown, nominee, or non-equity interests shall use explicit types and shall not be silently mixed into that total.
- **FR-INV-021:** The system shall maintain effective-dated Management Agreements identifying the managed Property, participating owners, operator authority, commercial-reference terms, notice/termination state, and supporting documents.
- **FR-INV-022:** Property ownership and Management Agreements shall not grant application access. Access requires a separate active User membership, role, and scope assignment.
- **FR-INV-023:** Transfer, correction, or expiry of ownership or management authority shall not rewrite historical Leases, invoices, Payments, statements, audit evidence, or reports produced for prior effective periods.

### 4.5 Residents and related parties

- **FR-RES-001:** Authorized users shall maintain Resident profiles with names, contact methods, identity references, emergency contacts, preferences, and status.
- **FR-RES-002:** Sensitive identity data shall be optional by configuration, access-restricted, masked where appropriate, and protected by retention rules.
- **FR-RES-003:** The system shall assist duplicate detection within an Organization using configurable matching attributes without automatically merging records.
- **FR-RES-004:** Authorized users shall merge confirmed duplicates while preserving identifiers, relationships, history, and an audit trail.
- **FR-RES-005:** A Resident may participate in multiple historical or concurrent Leases where business rules permit.
- **FR-RES-006:** The system shall distinguish Leaseholders, Occupants, Guarantors/Sponsors, emergency contacts, and other related parties.
- **FR-RES-007:** Contact methods shall record verification, preference, consent, opt-out, and validity state by channel when applicable.
- **FR-RES-008:** Resident portal access shall be independently enabled, suspended, or revoked without deleting the Resident record.
- **FR-RES-009:** Resident deletion requests shall be handled through configurable retention, legal-hold, anonymization, and audit processes.
- **FR-RES-010:** Staff shall view a Resident timeline of authorized lease, account, communication, document, and maintenance events.
- **FR-RES-011:** Authorized users shall record do-not-rent, screening-review, and manual-risk flags with structured reason category, evidence reference, creator, review/expiry date, visibility, and disposition.
- **FR-RES-012:** Screening flags shall be access-restricted, purpose-limited, reviewable, correctable where applicable, and retained only under configured privacy and legal policy.
- **FR-RES-013:** The system shall not make or claim automated adverse eligibility decisions; any decision support shall require authorized human review and retain the factors and policy version considered.

### 4.6 Lease lifecycle and occupancy

- **FR-LEA-001:** Authorized users shall create a Lease in Draft with Property, Rentable Item, Leaseholders, Occupants, start/end terms, rent, deposit, billing schedule, and policy references.
- **FR-LEA-002:** Lease statuses shall include Draft, Pending Approval/Signature, Scheduled, Active, Notice Given, Ended, Terminated, and Cancelled.
- **FR-LEA-003:** The system shall support fixed-term and periodic Leases, future starts, open-ended terms where allowed, and configurable notice periods.
- **FR-LEA-004:** A Lease shall support multiple Leaseholders and Occupants with date-effective participation and responsibility.
- **FR-LEA-005:** The system shall validate availability and capacity for the complete assignment period before approval or activation.
- **FR-LEA-006:** Activation shall preserve a snapshot or version reference for commercially material terms used to generate obligations.
- **FR-LEA-007:** Amendments shall be date-effective, approved as configured, and preserve the superseded terms.
- **FR-LEA-008:** Renewals shall create a new term or linked Lease according to policy while preserving continuity and history.
- **FR-LEA-009:** Transfers shall end the prior assignment and begin the new assignment without losing Lease or Resident Account traceability.
- **FR-LEA-010:** Move-in and move-out workflows shall support checklists, readings, keys/assets, condition evidence, documents, and completion status.
- **FR-LEA-011:** Early termination and cancellation shall require effective date, reason, financial treatment, inventory release, and audit.
- **FR-LEA-012:** The system shall notify authorized users of approaching starts, expirations, renewals, notices, and incomplete move-in/out tasks.
- **FR-LEA-013:** Lease identifiers shall be unique within an Organization and remain immutable after activation.
- **FR-LEA-014:** Ended Leases shall remain read-only except through explicit correction or reopening permissions.
- **FR-LEA-015:** Notice submission shall record giver, recipient, service method/evidence, notice date, required period, proposed end date, and applicable policy; the system shall flag or prevent an invalid end date according to configured enforcement mode.
- **FR-LEA-016:** If occupancy continues after a fixed term or effective termination without an approved renewal, periodic conversion, or extension, the system shall represent the assignment as Holdover rather than silently marking the inventory vacant.
- **FR-LEA-017:** Holdover records shall preserve unauthorized-occupancy status, daily or periodic use-and-occupancy Charges where configured, notices, disputes, legal actions, and actual surrender date without asserting legal entitlement.
- **FR-LEA-018:** A Lease with multiple financially responsible parties shall configure joint-and-several liability or allocated liability and identify an optional primary payer for communication/allocation convenience.
- **FR-LEA-019:** Primary-payer designation shall not reduce another party's contractual liability when joint-and-several liability applies; statements and collections shall disclose the configured responsibility model.
- **FR-LEA-020:** A guarantor claim workflow shall capture triggering default, covered obligations and cap/term, notice/service evidence, claimed amount, response/dispute, payments, release, and status.
- **FR-LEA-021:** Move-in shall issue keys, access devices, furnishings, or other assets through itemized checkout with identifier, condition, quantity, evidence, custodian, and expected return.
- **FR-LEA-022:** Move-out shall reconcile checked-out assets as returned, damaged, lost, or transferred and may propose documented Charges or deposit deductions subject to approval policy.

### 4.7 Billing, charges, and resident accounts

- **FR-BIL-001:** Each Lease shall have a Resident Account or an explicit relationship to the responsible account.
- **FR-BIL-002:** The system shall create recurring schedules for rent, utilities, services, parking, fees, discounts, and taxes.
- **FR-BIL-003:** Recurring schedules shall have effective dates, frequency, due-date rule, amount or calculation basis, tax treatment, and allocation metadata.
- **FR-BIL-004:** The system shall generate Charges idempotently for a billing period and retain their source schedule/version.
- **FR-BIL-005:** Authorized users shall create one-time Charges, credits, discounts, penalties, and write-offs using configured permissions and reason codes.
- **FR-BIL-006:** The system shall support configurable proration methods and show calculation inputs and rounding.
- **FR-BIL-007:** Posted Charges shall not be destructively edited or deleted; corrections shall use reversal and replacement or an adjustment.
- **FR-BIL-008:** The system shall calculate opening balance, Charges, Payments, allocations, credits, refunds, deposits, write-offs, and closing balance for an explicit as-of date.
- **FR-BIL-009:** The system shall render invoices or statements from ledger entries using immutable numbering after issue, applicable branding, and the Lease's locale/currency context.
- **FR-BIL-010:** Account aging shall use configurable buckets and due dates and shall distinguish disputed, deferred, and written-off amounts.
- **FR-BIL-011:** Late fees and penalties shall be configurable, previewable, capped where configured, idempotent, and reversible.
- **FR-BIL-012:** Billing runs shall provide preview, validation errors, approval where configured, asynchronous execution, progress, and completion summary.
- **FR-BIL-013:** Failed items in a batch shall be retryable without duplicating successful Charges.
- **FR-BIL-014:** Financial exports shall include stable identifiers and sufficient source references for reconciliation.
- **FR-BIL-015:** Authorized users shall create payment plans/installment agreements that identify eligible debt, installments, due dates, status, approval, missed-payment treatment, and effect on collection activity without rewriting original Charges.
- **FR-BIL-016:** Payment plans shall support preview, resident acknowledgement/evidence, amendment, cancellation, and reinstatement while preserving prior versions and payment allocation history.
- **FR-BIL-017:** Partial Payments shall reduce only their allocated Charge balances; unpaid remainders shall remain visible with original due dates unless a payment plan explicitly changes collection treatment.
- **FR-BIL-018:** Unapplied credits shall retain source and currency and may be allocated, transferred within policy, or refunded only through authorized, auditable actions.
- **FR-BIL-019:** Write-offs shall preserve the debt history, reason, effective date, tax/reporting treatment, and recovery status and shall not masquerade as a Payment.
- **FR-BIL-020:** Write-offs and adjustments at or above an Organization-configured threshold shall require maker-checker approval by a different authorized user.
- **FR-BIL-021:** Parking, laundry, Wi-Fi, and other billable services shall support recurring, usage-based, or one-time Charges with date-effective rates, service periods, and assigned beneficiary/inventory.
- **FR-BIL-022:** Tax components shall be configurable and separately displayed by name, rate/basis, inclusive/exclusive treatment, jurisdiction label, effective period, and rounding; the system shall not represent this as statutory filing or universal tax compliance.
- **FR-BIL-023:** Concurrent or retried billing runs over an overlapping Organization, scope, schedule, and period shall coordinate ownership and idempotency so each logical Charge is posted at most once.

### 4.8 Payments, allocations, refunds, and deposits

- **FR-PAY-001:** Authorized users and integrations shall record Payments with amount, currency, date, method, payer, reference, status, and evidence.
- **FR-PAY-002:** Payment statuses shall distinguish at least Pending, Confirmed, Failed, Reversed, Refunded, and Partially Refunded.
- **FR-PAY-003:** Confirmed Payments shall be allocated automatically by configurable priority or manually by authorized users.
- **FR-PAY-004:** A Payment may be split across multiple Charges on authorized Resident Accounts within the same Organization and currency.
- **FR-PAY-005:** Overpayments shall remain as unapplied account credit or be refunded according to policy.
- **FR-PAY-006:** Payment recording and provider callbacks shall use idempotency controls and retain provider event references.
- **FR-PAY-007:** The system shall issue a unique, immutable receipt for a confirmed Payment and issue corrective evidence for reversals/refunds.
- **FR-PAY-008:** Reallocation, reversal, refund, and write-off shall require permissions, reason, effective date, and audit history.
- **FR-PAY-009:** Provider authorization, capture, settlement, failure, dispute, and chargeback states shall remain distinguishable.
- **FR-PAY-010:** The system shall support reconciliation against imported or integrated settlement records and expose unmatched exceptions.
- **FR-PAY-011:** Security Deposits shall be tracked separately from rent income and ordinary account credits.
- **FR-PAY-012:** Deposit records shall support amount due, amount received, holding status/reference, permitted deductions, refund, transfer, and final disposition.
- **FR-PAY-013:** Deposit deductions shall reference documented claims and shall not exceed available deposit value without creating a separately identified Charge.
- **FR-PAY-014:** The application shall not store raw payment-card credentials.
- **FR-PAY-015:** Cash, bank transfer, QR/local wallet, and card through a payment service provider (PSP) shall be first-class Payment channels; the application shall not store card PAN or other raw card credentials.
- **FR-PAY-016:** Cash recording shall capture collector, collection location/register, receipt sequence, payer, received-at time, evidence, and expected deposit/bank-reconciliation status.
- **FR-PAY-017:** Bank transfer and QR/local-wallet Payments shall retain channel/provider, sender or masked account reference where lawful, external transaction reference, evidence, confirmation state, settlement state, and reconciliation status.
- **FR-PAY-018:** Payment reconciliation statuses shall include at least Unreconciled, Suggested Match, Matched, Exception, and Reconciled, with separation of duties where the recorder must not confirm their own high-value cash reconciliation.
- **FR-PAY-019:** Deposit disposition shall use a completion checklist covering condition evidence, utilities, keys/assets, permitted deductions, outstanding claims, refund, lawful forfeiture where configured, and transfer to a specifically identified next Lease.
- **FR-PAY-020:** High-value refunds and deposit releases at or above Organization-configured thresholds shall require approval by a different authorized user; the maker shall not approve their own request.
- **FR-PAY-021:** Deposit transfer, forfeiture, deduction, refund, or release shall preserve the prior holding record, approval evidence, recipient or destination Lease, legal/policy basis, and immutable disposition document.

### 4.9 Utilities and meters

- **FR-UTL-001:** Authorized users shall define utility services, units of measure, providers, billing responsibility, and applicable Properties/inventory.
- **FR-UTL-002:** Meters shall have unique identifiers within an Organization and shall be assigned to a Property, Unit, or shared service, with reading type, multiplier, status, and effective dates.
- **FR-UTL-003:** Users and integrations shall record readings with value, timestamp, source, evidence, and optional quality flag.
- **FR-UTL-004:** The system shall validate duplicate timestamps, impossible regressions for non-resetting meters, rollover/reset events, and configurable anomaly thresholds.
- **FR-UTL-005:** A reading used in posted billing shall not be destructively changed; correction shall retain the original and recalculate through adjustment.
- **FR-UTL-006:** Tariffs shall be date-effective and support fixed, flat, tiered, and consumption-based components, taxes, minimums, and rounding.
- **FR-UTL-007:** Shared utilities shall support documented allocation methods such as equal share, occupancy days, floor area, submeter difference, or configured weights.
- **FR-UTL-008:** Utility Charges shall show service period, prior/current readings where applicable, consumption, tariff/allocation version, calculation, and rounding.
- **FR-UTL-009:** The system shall prevent overlapping billable reading periods for the same meter and service unless explicitly corrected.
- **FR-UTL-010:** Reports shall identify missing readings, anomalies, consumption trends, unbilled periods, and reconciliation differences.
- **FR-UTL-011:** Authorized users shall bulk import meter readings from a documented template with source batch/file, mapping preview, row number, meter identifier, reading timestamp/value, source, and optional evidence reference.
- **FR-UTL-012:** Bulk reading import shall validate duplicates, unknown or inactive meters, meter rollback/regression, reset/rollover declarations, future timestamps, overlapping periods, and row-level errors before commit.
- **FR-UTL-013:** Replaying or retrying a meter-reading batch shall not duplicate accepted readings; partial commits shall identify accepted, skipped, and failed rows and remain safely restartable.
- **FR-UTL-014:** Water, electricity, Wi-Fi, and other shared services shall support date-effective allocation across occupied Units/Beds using the methods in FR-UTL-007, with vacancies, common-area share, caps, minimums, and rounding explicitly represented.

### 4.10 Maintenance and inspections

- **FR-MNT-001:** Staff and enabled Residents shall submit maintenance requests with Property/inventory, category, description, urgency, access availability, contact preference, and attachments.
- **FR-MNT-002:** The system shall assign a reference number and capture all status changes and communications.
- **FR-MNT-003:** Authorized users shall triage requests, assess priority, detect/link duplicates, and convert them to one or more Work Orders.
- **FR-MNT-004:** Work Orders shall support assignment to staff or vendors, schedule, service-level target, checklist, parts/materials, labor, cost, attachments, and notes.
- **FR-MNT-005:** Work Order statuses shall include Open, Triaged, Assigned, Scheduled, In Progress, On Hold, Completed, Verified, and Cancelled.
- **FR-MNT-006:** Residents shall see only safe resident-facing notes and status details, not internal, financial, security, or unrelated personal information.
- **FR-MNT-007:** Completion shall record work performed, completion time, cost, evidence, and person completing the work; verification may be required by policy.
- **FR-MNT-008:** The system shall escalate overdue or high-priority Work Orders according to configurable service-level rules.
- **FR-MNT-009:** Planned and preventive maintenance shall support recurrence, asset/inventory linkage, and automatic Work Order generation.
- **FR-MNT-010:** Inspections shall support templates, scheduled occurrences, findings, photos/documents, follow-up actions, and move-in/out linkage.

### 4.11 Communications and notifications

- **FR-COM-001:** Authorized users shall send individual, audience-based, and Property-wide messages through enabled channels.
- **FR-COM-002:** Templates shall support locale, versioning, approved variables, preview, branding, and channel-specific content.
- **FR-COM-003:** Transactional events shall support configurable notifications for invitations, Lease milestones, issued statements, received Payments, arrears, meter requests, Work Order updates, and subscription events.
- **FR-COM-004:** The system shall queue delivery asynchronously and record Queued, Sent, Delivered, Failed, Bounced, and Read states when providers support them.
- **FR-COM-005:** Retries shall not create duplicate logical messages and shall follow channel-specific retry policy.
- **FR-COM-006:** Communication preferences, consent, mandatory-service exceptions, and opt-outs shall be honored according to policy and law.
- **FR-COM-007:** Messages shall render dates, times, amounts, and language using the recipient and business context.
- **FR-COM-008:** Authorized users shall see a communication history linked to the relevant Resident, Lease, account, Work Order, or subscription event.
- **FR-COM-009:** Attachments and links shall use access-controlled, expiring delivery mechanisms.
- **FR-COM-010:** The system shall prevent audience resolution from including Users outside the originating Organization or authorized Property scope.
- **FR-COM-011:** Authorized users shall configure an arrears collection sequence with date/amount eligibility, reminder steps, channels, escalation tasks, guarantor contact where lawful, and exit conditions.
- **FR-COM-012:** An account, Charge, or collection case under active dispute shall pause configured collection steps without erasing arrears; resolution shall resume, amend, or close the sequence from an auditable effective date.
- **FR-COM-013:** Collection execution shall be previewable and idempotent and shall suppress duplicate steps, closed accounts, fulfilled payment plans, and legally/policy-excluded recipients.

### 4.12 Documents and files

- **FR-DOC-001:** Authorized users shall upload documents and images to supported business records with category, title, owner, visibility, and retention metadata.
- **FR-DOC-002:** Objects shall be private by default in S3-compatible storage and accessed using short-lived authorized links or proxied delivery.
- **FR-DOC-003:** File type, size, checksum, malware-scan state, and upload completion shall be validated before general availability.
- **FR-DOC-004:** Document versions shall preserve prior content, author, timestamp, and change reason.
- **FR-DOC-005:** Templates shall generate leases, notices, statements, receipts, and other configured documents from approved data fields.
- **FR-DOC-006:** Generated documents shall retain template version, generation time, locale, and source-record references.
- **FR-DOC-007:** Signed or issued documents shall be immutable; replacement shall create a new version with linkage.
- **FR-DOC-008:** Download, sensitive preview, sharing, deletion, and retention override shall be permission-controlled and auditable.
- **FR-DOC-009:** Legal holds shall suspend automated deletion for applicable documents and linked records.
- **FR-DOC-010:** Deletion shall remove access promptly and purge storage according to retention and backup policy.

### 4.13 Reporting, dashboards, import, and export

- **FR-REP-001:** The system shall provide portfolio and Property dashboards for occupancy, availability, move-ins/outs, Lease expirations, receivables, collections, utilities, and maintenance.
- **FR-REP-002:** Reports shall include at least rent roll, occupancy, vacancy, Lease expiry, account ledger, arrears aging, Charges, Payments, deposits, utility consumption/billing, and Work Order performance.
- **FR-REP-003:** Every report shall identify its data scope, filters, currency, business time zone, and as-of or reporting period.
- **FR-REP-004:** Report results shall enforce the requesting User's Organization, Property, role, and sensitive-field permissions.
- **FR-REP-005:** Large reports shall execute asynchronously with progress, expiration, notification, and secure download.
- **FR-REP-006:** Exports shall support common machine-readable formats, stable identifiers, documented columns, and locale-safe raw values.
- **FR-REP-007:** Dashboard totals and detailed reports using the same scope and as-of time shall reconcile or disclose processing latency.
- **FR-REP-008:** Authorized users shall schedule recurring reports to approved recipients.
- **FR-REP-009:** Imports shall support preview, mapping, validation, duplicate detection, row-level errors, atomic or clearly partitioned commit, and result summary.
- **FR-REP-010:** Import retries shall not duplicate successfully committed business records.
- **FR-REP-011:** Opening balances and migrated history shall be explicitly marked with source system/file, import batch and row, effective/as-of date, original identifier where available, transformation/mapping version, actor, and reconciliation status.
- **FR-REP-012:** Material exports shall create an audit event including actor, scope, purpose where required, and file expiration.
- **FR-REP-013:** Occupancy reporting shall distinguish physical occupancy (capacity physically occupied or assigned) from economic occupancy (earned or contracted rent divided by market or potential rent under a disclosed method) and shall never present one as the other.
- **FR-REP-014:** Vacancy reporting shall separately show physical vacancy, economic vacancy/loss, operationally unavailable inventory, reservations/holds, and holdover occupancy for the stated scope and as-of instant.
- **FR-REP-015:** Opening-balance import shall require debit/credit interpretation, currency, account/Lease mapping, as-of date, source total, accepted total, variance, and approval before balances become operational.

### 4.14 Audit, support, and governance

- **FR-AUD-001:** The system shall record append-only audit events for authentication security events and material create, update, status, approval, posting, reversal, export, access, and deletion actions.
- **FR-AUD-002:** An audit event shall contain Organization identifier/internal `tenant_id`, actor or system identity, action, target type/id, UTC timestamp, request/correlation identifier, and relevant change context.
- **FR-AUD-003:** Before/after context shall exclude secrets, raw credentials, full payment-card data, and unnecessarily exposed sensitive identity data.
- **FR-AUD-004:** Authorized auditors shall search and export audit events by actor, action, target, Property, date, and correlation identifier.
- **FR-AUD-005:** Ordinary customer and support users shall not modify or delete audit events.
- **FR-AUD-006:** Automated jobs shall identify their job type, triggering actor/event, batch, and affected record in audit evidence.
- **FR-AUD-007:** Impersonation shall be avoided; where support session assumption is provided, the interface shall remain visibly marked and both support and effective identities shall be recorded.
- **FR-AUD-008:** Retention policies shall be configurable by record category subject to plan, contract, law, and legal hold.
- **FR-AUD-009:** Privacy requests shall support discovery, export, correction where lawful, restriction, and erasure/anonymization workflows.
- **FR-AUD-010:** Platform operational logs shall use correlation identifiers but shall not become an uncontrolled copy of business records or secrets.
- **FR-AUD-011:** High-value refunds, write-offs, deposit releases, and Organization ownership transfers shall support configurable maker-checker thresholds and require two distinct authorized identities above threshold.
- **FR-AUD-012:** Approval evidence shall include maker, checker, submitted and decided timestamps, amount/scope, policy/threshold version, decision, and reason; a changed request shall require renewed approval.
- **FR-AUD-013:** Emergency override of dual control, if commercially enabled, shall require stronger authorization, reason, immediate alerting, and retrospective review and shall never permit self-approval of Organization ownership transfer.

### 4.15 Localization, currency, and time

- **FR-LOC-001:** Each Organization shall configure default language, locale, currency, IANA time zone, date/number format, and first day of week.
- **FR-LOC-002:** A Property may override the business time zone and supported locale settings.
- **FR-LOC-003:** Persisted instants shall use UTC; the originating or applicable IANA time-zone identifier shall be retained where business interpretation depends on local time.
- **FR-LOC-004:** Billing, due dates, occupancy days, scheduled messages, and report periods shall use the applicable Property business time zone.
- **FR-LOC-005:** The system shall handle daylight-saving gaps and overlaps deterministically and display the resulting offset.
- **FR-LOC-006:** Money shall store currency explicitly and use currency-appropriate precision; floating-point arithmetic shall not be used for authoritative financial calculations.
- **FR-LOC-007:** A Resident Account shall not combine currencies into an unlabeled balance.
- **FR-LOC-008:** Templates and user-facing system text shall support translation and locale-specific formatting with defined fallback behavior.
- **FR-LOC-009:** Changing a default locale, time zone, currency, tariff, or rounding rule shall not reinterpret posted historical records.
- **FR-LOC-010:** Search and sorting shall account for supported character sets while identifiers remain stable and locale-neutral.

### 4.16 Integrations and API

- **FR-INT-001:** External integrations shall use versioned, authenticated interfaces and Organization-scoped credentials bound internally to one `tenant_id`.
- **FR-INT-002:** Write operations susceptible to retry shall accept idempotency keys and return the original outcome for valid duplicates.
- **FR-INT-003:** Webhooks shall be signed, contain stable event identifiers, support retries, and preserve per-resource ordering where required.
- **FR-INT-004:** Customers shall configure webhook endpoints, subscribed events, secret rotation, status, and replay within retention limits.
- **FR-INT-005:** Integration failures shall be visible to authorized users with actionable but non-secret diagnostics.
- **FR-INT-006:** Rate limits and quotas shall be plan-aware and protect the service from abusive or runaway clients.
- **FR-INT-007:** Provider callbacks shall be verified against provider authenticity controls before changing business state.
- **FR-INT-008:** External references shall not replace internal immutable identifiers.

## 5. Explicit business rules

- **BR-001 — Isolation:** Organization is the customer-facing boundary and maps one-to-one to an immutable internal `tenant_id`. Every Organization-owned business record must contain or inherit that `tenant_id`; no request, job, cache entry, export, document key, or report may rely only on a user-supplied tenant identifier.
- **BR-002 — Renter terminology:** “Organization” means the customer account and SaaS isolation boundary. **Tenant** is reserved primarily for architectural/database language, and a person renting accommodation is always a Resident, Leaseholder, or Occupant.
- **BR-003 — Hierarchy:** A Unit belongs to exactly one Property. An optional Bed belongs to exactly one shared Unit. There is no separate Room entity; apartments, studios, private rooms, and shared rooms are Unit types.
- **BR-004 — Rentable level:** Each Lease assignment identifies a Unit or an optional Bed for an effective period. Whole-space rental uses the Unit; individually assigned shared occupancy uses a Bed; capacity-based shared occupancy uses a Unit assignment with explicit capacity consumption.
- **BR-005 — Capacity:** Active and scheduled occupancy must not exceed effective capacity unless a specifically authorized, reasoned, and audited override exists.
- **BR-006 — Availability:** An item is available only when it is operationally rentable and has sufficient capacity with no conflicting assignment or blocking reservation for the requested period.
- **BR-007 — Date intervals:** Occupancy and lease assignment ranges use start-inclusive and end-exclusive intervals unless a jurisdictional policy explicitly requires another convention.
- **BR-008 — Lease activation:** A Lease cannot become Active without at least one Leaseholder, one Rentable Item, an effective start, financial terms, and successful conflict validation.
- **BR-009 — Historical terms:** Activated Lease terms are versioned. Later defaults or configuration changes do not rewrite historical obligations.
- **BR-010 — Lease overlap:** A Resident may hold concurrent Leases, but the same Rentable Item cannot have conflicting assignments beyond capacity.
- **BR-011 — Posting:** Posted Charges, confirmed Payments, billed readings, issued receipts, and signed/issued documents are immutable; corrections are additive and traceable.
- **BR-012 — Idempotency:** One source schedule and billing period may produce at most one active logical Charge unless a correction links the replacement.
- **BR-013 — Money:** Authoritative amounts use decimal arithmetic, explicit currency, and configured rounding at documented calculation steps.
- **BR-014 — Proration:** A Lease uses the proration rule captured with its effective financial terms; results expose included days, divisor, unrounded value, and rounded amount.
- **BR-015 — Allocation:** Payment allocation cannot exceed the unallocated Payment amount or the eligible outstanding Charge amount.
- **BR-016 — Payment date:** Provider initiation does not equal confirmed collection; balance impact follows the configured status rule and remains distinguishable from settlement.
- **BR-017 — Overpayment:** Unallocated confirmed value is account credit until allocated, transferred under authorization, or refunded.
- **BR-018 — Deposits:** Security Deposits are not rent income and cannot be silently allocated to rent; any application requires a documented disposition action.
- **BR-019 — Deposit deductions:** Total deductions cannot exceed held deposit value; excess claims become separate Charges.
- **BR-020 — Meter sequence:** Consumption normally equals current reading minus prior accepted reading adjusted for multiplier, reset, or rollover.
- **BR-021 — Utility allocation:** Shared utility allocation must use a versioned method whose allocated components reconcile to the distributable amount within documented rounding tolerance.
- **BR-022 — Time:** Business-day boundaries use the Property's IANA time zone; persisted event timestamps use UTC.
- **BR-023 — Numbering:** Activated Lease numbers, issued invoice/statement numbers, receipts, and Work Order references are unique within their defined Organization scope and are not reused.
- **BR-024 — Deletion:** Records with financial, legal, occupancy, or audit history are archived, anonymized, or lifecycle-closed rather than hard-deleted through ordinary workflows.
- **BR-025 — Communication:** Legally required service communications may bypass marketing opt-out only when categorized and authorized as transactional.
- **BR-026 — Least privilege:** Vendors and technicians receive only information needed for assigned work and no general access to Resident Accounts or identity documents.
- **BR-027 — Plan limits:** Reaching a subscription limit never deletes, corrupts, or conceals historical customer data.
- **BR-028 — Suspension:** Suspension prevents ordinary mutation but does not terminate Leases, erase records, or alter resident balances.
- **BR-029 — Reporting:** Every financial or occupancy figure is evaluated for a stated scope and as-of time; current-state fields must not be used to rewrite historical reports.
- **BR-030 — Audit:** Audit history is append-only and must identify both initiating and executing identities for privileged or automated operations.
- **BR-031 — Documents:** Object access requires a current authorization decision; possession of a permanent public URL is never sufficient.
- **BR-032 — Cross-currency:** Amounts in different currencies are not summed without an explicit exchange-rate source, rate timestamp, and presentation as converted values.
- **BR-033 — Import:** An import batch must be repeatable or safely restartable and must preserve row-level provenance.
- **BR-034 — Subscription separation:** SaaS subscription invoices and Resident rental statements are separate business domains and cannot share account balances or allocations.
- **BR-035 — Closed Organizations:** Irreversible Organization deletion requires completion of retention, legal-hold, and backup-lifecycle checks.
- **BR-036 — Hold precedence:** A hard reservation blocks conflicting assignment; a soft hold blocks availability only according to its configured priority and expires automatically. Conversion always revalidates capacity in the same transaction as assignment.
- **BR-037 — Overbooking race:** Availability displayed before commit is advisory. The authoritative capacity check occurs under concurrency control at hold, reservation, or Lease-assignment commit; one winner succeeds and conflicting contenders receive a non-destructive conflict response.
- **BR-038 — Holdover:** Lease end does not imply physical vacancy. Continued occupancy remains assigned as Holdover until documented surrender, lawful recovery, or approved continuation, and reports must disclose that status.
- **BR-039 — Notice:** A notice period is calculated from the applicable policy and service evidence. Waiver or override requires authority, reason, and audit and does not assert legal validity.
- **BR-040 — Liability:** A primary payer is a communication and allocation preference, not a release of jointly and severally liable parties. Allocated liability and guarantor limits follow the captured Lease terms.
- **BR-041 — Late fees:** A late-fee run must be previewable, capped by effective policy, and idempotent by account/Charge, fee rule, and assessment period; reversals remain traceable.
- **BR-042 — Payment plans:** A payment plan changes collection scheduling only; it does not erase, redraft, or silently change the due date of original posted Charges.
- **BR-043 — Partial payment:** Partial allocation reduces the eligible Charge by the allocated amount only. Unapplied credit is not collection against a Charge until allocated.
- **BR-044 — Dual control:** Above configured thresholds, the maker and checker for refunds, write-offs, deposit releases, and Organization ownership transfers must be distinct active authorized users.
- **BR-045 — Cash evidence:** Cash is Confirmed only under configured collection policy and remains Unreconciled until matched to an approved cash-up or bank-deposit record; receipt issuance does not itself prove bank settlement.
- **BR-046 — Duplicate callback:** A duplicate payment webhook/provider event returns the prior logical outcome and cannot create a second Payment, allocation, receipt, or notification.
- **BR-047 — Deposit disposition:** Every held deposit ends with a documented refund, permitted deduction, lawful forfeiture, transfer to a named next Lease, or remaining-held status; no amount may disappear through balance editing.
- **BR-048 — Screening privacy:** Do-not-rent and screening flags are restricted decision-support records, not automated adverse decisions; access, correction, review, expiry, and retention follow applicable privacy policy.
- **BR-049 — Meter rollback:** A lower reading is rejected from ordinary billing unless an authorized reset, rollover, replacement, or correction explains the sequence and preserves evidence.
- **BR-050 — Collection dispute:** An active dispute pauses configured arrears escalation for the disputed scope but does not delete the debt or prevent unrelated undisputed collection steps.
- **BR-051 — Tax boundary:** Configurable tax calculation and display do not constitute statutory filing, fiscal clearance, legal advice, or a compliance guarantee.
- **BR-052 — Opening balance:** A migrated opening balance must be traceable to source, as-of date, mapping/transformation, batch/row, and reconciliation; it cannot be represented as a native historical transaction without provenance.
- **BR-053 — Time-zone edge:** Ambiguous or nonexistent local times at daylight-saving transitions use the configured deterministic offset rule, retain the IANA zone and chosen offset, and cannot cause duplicate billing periods or missed deadlines.
- **BR-054 — Billing concurrency:** Overlapping billing workers/runs must acquire compatible scope ownership or rely on an equivalent uniqueness invariant; retries and concurrent execution cannot post more than one active logical Charge.
- **BR-055 — Owner separation:** A Property Owner is a Party with an ownership interest; an Organization Owner is a privileged SaaS account role. Neither status implies the other.
- **BR-056 — Multiple ownership:** Property ownership is effective-dated many-to-many. A single `owner_id` field on Property is not authoritative.
- **BR-057 — Ownership totals:** Percentage-bearing interests within the same ownership class may not exceed 100 percent for an overlapping effective period. Corrections are new effective-dated records, not destructive edits to prior ownership.
- **BR-058 — Management authority:** A Management Agreement records business authority but never bypasses RBAC, Property scope, or step-up controls.
- **BR-059 — Historical attribution:** Owner- and operator-attributed reporting uses the ownership and Management Agreement records effective at the report's as-of instant, not only current relationships.

## 6. Non-functional requirements

### 6.1 Security and privacy

- **NFR-SEC-001:** All network traffic shall use current industry-standard transport encryption; sensitive managed storage and backups shall be encrypted at rest.
- **NFR-SEC-002:** Technical tenant-isolation tests shall verify the Organization-to-`tenant_id` boundary across APIs, background jobs, caches, queues, search, reports, exports, object storage, and support tooling.
- **NFR-SEC-003:** Secrets shall use managed secret storage and shall not appear in source control, client bundles, logs, URLs, or audit payloads.
- **NFR-SEC-004:** The product shall follow OWASP application and API security guidance, including input validation, output encoding, CSRF controls where applicable, rate limiting, and secure headers.
- **NFR-SEC-005:** Refresh-token rotation shall detect reuse and revoke the affected token family.
- **NFR-SEC-006:** Sensitive actions shall support step-up authentication, dual approval, or reauthentication according to risk policy.
- **NFR-SEC-007:** Security events shall be monitored with alerting for suspicious authentication, privilege changes, mass export, and isolation-control failures.
- **NFR-SEC-008:** Production customer-data access shall be restricted, time-bound, approved where required, and audited.
- **NFR-SEC-009:** Privacy controls shall support data minimization, purpose limitation, retention, access requests, and anonymization.
- **NFR-SEC-010:** Dependency, container, and application security scanning shall be part of delivery and vulnerability management.

### 6.2 Performance and scalability

- **NFR-PERF-001:** Under the reference normal load defined below, 95% of common interactive API requests shall complete within 500 ms, excluding third-party latency.
- **NFR-PERF-002:** Search and list endpoints shall use bounded pagination and return the first page within 1 second at p95 under normal load.
- **NFR-PERF-003:** The initial architecture shall support Organizations ranging from approximately 30 to 10,000+ Units and Beds without domain redesign.
- **NFR-PERF-004:** Billing runs, imports, exports, bulk notifications, and large reports shall execute asynchronously and expose progress.
- **NFR-PERF-005:** Resource-intensive work shall enforce Organization-aware quotas, concurrency limits, and backpressure to reduce noisy-neighbor impact.
- **NFR-PERF-006:** Data access shall use indexed `tenant_id` and common scope/filter keys; unbounded Organization-wide scans shall not serve interactive paths.
- **NFR-PERF-007:** Cache keys and queue payloads shall include the immutable internal `tenant_id` scope and avoid sensitive data not required for processing.
- **NFR-PERF-008:** Capacity tests shall include a representative portfolio of 10,000+ Units and Beds and month-start concurrent billing, Payment, reporting, and messaging load.
- **NFR-PERF-009:** Reference normal load shall include at least 250 concurrent staff users, 20,000 active resident portal identities, and one Organization with 10,000 Units/optional Beds, while month-start billing, Payment ingestion/reconciliation, reporting, and messaging execute concurrently.
- **NFR-PERF-010:** The relational model shall impose no fixed product-level cardinality cap on Properties, Units, Beds, Property Owners, Residents, Leases, invoices, or Payments. Commercial plan limits and operational quotas may govern usage, but growth shall not require changing entity identity or relationship semantics.
- **NFR-PERF-010:** Under the reference month-start load, a recurring billing run covering 10,000 Units/optional Beds shall complete within 60 minutes, expose progress at least every 60 seconds, and produce zero duplicate logical Charges.
- **NFR-PERF-011:** Load evidence shall state dataset shape, active Leases, schedules, Charges, readings, hardware/service topology, concurrency mix, test duration, p50/p95/p99 latency, throughput, error rate, and batch completion time; “normal load” without this evidence is not an acceptance result.

### 6.3 Availability, resilience, and recovery

- **NFR-REL-001:** Production monthly availability shall be at least 99.9%, excluding announced maintenance.
- **NFR-REL-002:** Critical services shall use health checks, graceful shutdown, restart policies, and horizontal scaling where appropriate.
- **NFR-REL-003:** Queue processing shall be retryable, idempotent, observable, and use dead-letter handling for exhausted failures.
- **NFR-REL-004:** Database and object-storage backups shall be encrypted, monitored, retention-controlled, and restoration-tested.
- **NFR-REL-005:** The commercial production baseline shall be RPO ≤ 15 minutes and RTO ≤ 4 hours. Architecture or premium service tiers may commit to better objectives but shall not weaken or ambiguously replace this baseline.
- **NFR-REL-006:** Third-party outages shall degrade gracefully, preserve queued work, avoid duplicate effects, and show actionable status.
- **NFR-REL-007:** Schema and application deployments shall support backward-compatible rolling transition or a documented maintenance procedure.
- **NFR-REL-008:** Disaster-recovery exercises shall occur at least annually and after material architecture changes.

### 6.4 Data integrity and consistency

- **NFR-DATA-001:** Financial posting, payment allocation, lease activation, capacity assignment, and deposit disposition shall use transactional consistency.
- **NFR-DATA-002:** Business invariants shall be enforced in service logic and database constraints where feasible.
- **NFR-DATA-003:** Optimistic concurrency or equivalent controls shall prevent silent overwrites of material records.
- **NFR-DATA-004:** Identifiers used externally shall be stable, non-recycled, and impractical to enumerate where exposure creates risk.
- **NFR-DATA-005:** Data migrations shall be versioned, tested on representative volume, reversible where practical, and observable.
- **NFR-DATA-006:** Timestamps, money, effective periods, and status transitions shall follow the rules in this document consistently across modules.
- **NFR-DATA-007:** Concurrency tests shall prove that two simultaneous reservation/Lease commits cannot overbook capacity and that overlapping billing runs cannot duplicate Charges.
- **NFR-DATA-008:** Integration tests shall replay duplicate payment webhooks before, during, and after successful processing and verify one Payment, one allocation effect, and one logical receipt.
- **NFR-DATA-009:** Meter tests shall cover rollback, reset, rollover, replacement, duplicate timestamp, out-of-order import, and correction after billing.
- **NFR-DATA-010:** Time tests shall cover daylight-saving gaps, overlaps, offset changes, leap days, month-end, and Organizations/Properties in different IANA zones, verifying no duplicate or omitted billing period.

### 6.5 Usability and accessibility

- **NFR-UX-001:** Core staff and resident workflows shall conform to WCAG 2.2 Level AA.
- **NFR-UX-002:** The application shall support current major desktop browsers and responsive resident workflows on common mobile widths.
- **NFR-UX-003:** Destructive, financial, or bulk actions shall show scope and consequence and require confirmation appropriate to risk.
- **NFR-UX-004:** Validation shall identify the affected field or row and provide a corrective message without exposing internal details.
- **NFR-UX-005:** Long-running actions shall show accepted, in-progress, completed, partially completed, or failed state and allow safe navigation away.
- **NFR-UX-006:** Common lists shall provide search, filters, sorting, saved views where useful, and accessible keyboard operation.

### 6.6 Observability and supportability

- **NFR-OPS-001:** Services and jobs shall emit structured logs, metrics, traces, and correlation identifiers with Organization-safe redaction.
- **NFR-OPS-002:** Operational dashboards shall cover availability, latency, errors, queue depth, job failure, database saturation, cache health, storage failure, and provider delivery status.
- **NFR-OPS-003:** Alerts shall be actionable, severity-classified, routed, deduplicated, and linked to runbooks.
- **NFR-OPS-004:** Business batch operations shall expose counts for planned, succeeded, skipped, retried, and failed items.
- **NFR-OPS-005:** Support diagnostics shall identify configuration and processing state without revealing secrets or unauthorized customer content.

### 6.7 Maintainability and delivery

- **NFR-MNT-001:** The NestJS modular monolith shall separate business modules with explicit interfaces and ownership of data mutations.
- **NFR-MNT-002:** APIs and events shall be versioned with documented compatibility and deprecation policy.
- **NFR-MNT-003:** Automated tests shall cover core rules, the Organization-to-`tenant_id` isolation boundary, authorization, financial calculations, time zones, idempotency, and key user journeys.
- **NFR-MNT-004:** Container images shall be reproducible, minimally privileged, scanned, and promoted through controlled environments.
- **NFR-MNT-005:** Configuration shall be environment-specific, validated at startup, and free of embedded secrets.
- **NFR-MNT-006:** Feature flags shall be Organization-aware, auditable for material behavior, and must not bypass authorization.

### 6.8 Retention and compliance readiness

- **NFR-CMP-001:** Retention periods shall be configurable by data category and constrained by contract, policy, jurisdiction, and legal hold.
- **NFR-CMP-002:** The system shall provide evidence needed for access reviews, security investigations, financial traceability, and privacy requests.
- **NFR-CMP-003:** Data residency and dedicated deployment are roadmap capabilities, not initial guarantees; deployment region shall be disclosed commercially.
- **NFR-CMP-004:** Terms, consent text, policy versions, and acceptance evidence shall be date-effective and reproducible.

## 7. User stories and acceptance criteria

The stories below define critical end-to-end outcomes. Detailed edge cases remain governed by the functional requirements and business rules above.

### US-001 — Activate a new Organization

**As an Organization Owner, I want to configure my organization and first Property so that I can begin managing rentals quickly.**

Acceptance criteria:

1. Given a valid trial or paid signup, when the owner verifies identity, then one isolated Organization, one internal `tenant_id`, and one owner membership are created.
2. The setup flow captures default locale, currency, IANA time zone, and first Property.
3. Progress is saved and can be resumed without duplicate organizations.
4. The owner can invite staff and see plan limits before adding inventory.
5. Activation and setup actions are audited.

### US-002 — Invite a property-scoped manager

**As a Portfolio Administrator, I want to grant a manager access only to selected Properties so that least privilege is maintained.**

Acceptance criteria:

1. The invitation identifies role, Property scope, expiration, and intended identity.
2. The link is single-use and cannot be accepted by a different identity without authorized correction.
3. The manager can view and change only permitted records in selected Properties.
4. Direct API requests for another Property or Organization are denied.
5. Membership and scope changes invalidate affected authorization state and are audited.

### US-003 — Configure mixed rental inventory

**As a Property Manager, I want to configure apartments, private rooms, shared rooms, and optional Beds so that one platform supports my mixed portfolio without a separate Room entity.**

Acceptance criteria:

1. The manager can create Units under a Property and optional Beds under Units configured for shared occupancy.
2. Each item has a unique scoped code, capacity, operational status, and applicable defaults.
3. Whole-Unit rental, Bed-level rental, and Unit-capacity allocation can coexist; no Room-level Rentable Item exists.
4. Invalid parent relationships and duplicate scoped codes are rejected with clear messages.
5. Inventory with history can be retired but not ordinarily hard-deleted.

### US-004 — Create and activate a Lease

**As a Leasing Officer, I want to activate a complete Lease so that occupancy and billing begin from agreed terms.**

Acceptance criteria:

1. Draft creation captures Leaseholder, Rentable Item, dates, rent, due schedule, deposit, and occupants.
2. The system checks operational availability and capacity for the entire assignment period.
3. Conflicts prevent activation unless an authorized exception policy applies.
4. Activation assigns an immutable Lease number and preserves effective commercial terms.
5. Occupancy and future availability update from the dated assignment.
6. Activation produces an audit event and configured notifications.

### US-005 — Renew or transfer a Lease

**As a Property Manager, I want to renew or transfer a Resident without losing history so that occupancy remains continuous and explainable.**

Acceptance criteria:

1. A renewal copies eligible terms into a new draft term with a link to the prior term.
2. A transfer validates the new Rentable Item and effective date before confirmation.
3. The old and new assignments do not overlap beyond capacity or create an unexplained gap.
4. Billing schedules change only from their recorded effective date.
5. Prior Lease terms, Charges, documents, and inventory history remain accessible.

### US-006 — Run monthly recurring billing

**As a Finance Officer, I want to preview and post monthly Charges in bulk so that Residents are billed accurately and efficiently.**

Acceptance criteria:

1. Preview shows scope, billing period, expected Charges, proration, tax, exceptions, and totals.
2. Posting runs asynchronously with progress and a completion summary.
3. One schedule and period produce no more than one active logical Charge.
4. Retrying a partial failure does not duplicate successful Charges.
5. Posted Charges retain source schedule, calculation inputs, effective terms, and batch ID.
6. Any correction is made through reversal/replacement or adjustment.

### US-007 — Record and allocate a Payment

**As a Finance Officer, I want to record and allocate a Payment so that the Resident Account balance and receipt are correct.**

Acceptance criteria:

1. The Payment captures currency, amount, date, payer, method, reference, status, and evidence.
2. A repeated provider event or idempotency key does not create a duplicate Payment.
3. Confirmed value can be allocated without exceeding Payment or Charge balances.
4. Overpayment remains clearly identified as unapplied credit.
5. A unique receipt is issued for a confirmed Payment.
6. Reallocation, reversal, or refund requires permission, reason, and audit history.

### US-008 — Reconcile provider settlements

**As a Finance Officer, I want to compare provider settlements with recorded Payments so that missing, duplicate, or disputed transactions are visible.**

Acceptance criteria:

1. Settlement data can be imported or received through an authenticated integration.
2. The system suggests matches using stable provider references and amounts without silently confirming ambiguous matches.
3. Unmatched, amount-mismatched, failed, disputed, and chargeback records appear as exceptions.
4. Confirming or changing a match is audited.
5. Provider settlement state remains distinct from resident-facing Payment initiation state.

### US-009 — Bill metered utilities

**As a Property Manager, I want to convert valid meter readings into transparent utility Charges so that consumption is fairly billed.**

Acceptance criteria:

1. The user records prior/current readings, timestamps, source, and evidence.
2. Duplicate, regressive, missing, or anomalous readings are flagged before billing.
3. The system applies the tariff and allocation version effective for the service period.
4. The resulting Charge shows consumption, rate components, allocation method, tax, and rounding.
5. Shared allocations reconcile to the distributable amount within documented tolerance.
6. Correcting a billed reading preserves the original and creates traceable financial adjustments.

### US-010 — Submit and complete maintenance work

**As a Resident, I want to report an issue and follow its progress so that it is resolved with clear communication.**

Acceptance criteria:

1. The Resident can choose related inventory, category, urgency, availability, and add supported attachments.
2. A reference number is immediately returned.
3. Staff can triage, assign, schedule, and update a linked Work Order.
4. The Resident sees only resident-safe statuses, messages, and completion evidence.
5. Completion records work performed, time, responsible worker, and evidence.
6. Overdue high-priority work escalates according to policy.

### US-011 — Issue a move-out deposit disposition

**As a Property Manager, I want to document deposit deductions and refund the remainder so that move-out settlement is transparent.**

Acceptance criteria:

1. The workflow shows amount held, prior dispositions, and available balance.
2. Each deduction has a permitted category, amount, reason, and supporting evidence.
3. Deductions cannot exceed held value; excess claims become separate Charges.
4. The refund records method, status, recipient, and reference.
5. A final disposition document is generated from the effective template and is immutable once issued.
6. All disposition, deduction, and refund actions are audited.

### US-012 — Send an arrears reminder

**As a Finance Officer, I want to notify eligible overdue accounts so that collection follow-up is consistent.**

Acceptance criteria:

1. The preview shows audience criteria, account as-of time, exclusions, channel, locale, and template version.
2. Property and role scope are enforced when resolving recipients.
3. Opt-out and consent rules are applied according to the message's transactional classification.
4. One logical reminder is not duplicated by queue retries.
5. Delivery outcomes are linked to the Resident Account and available for authorized review.

### US-013 — Produce an as-of rent roll

**As an Executive, I want a rent roll for a selected date so that I can review occupancy and contracted rent consistently.**

Acceptance criteria:

1. The report states Organization/Property scope, as-of date, business time zone, currency, and filters.
2. It uses date-effective assignments and Lease terms rather than only current record state.
3. Users see only Properties and sensitive fields within their permission scope.
4. Totals reconcile with report detail for the same scope and processing snapshot.
5. Large output is generated asynchronously and delivered through an expiring authorized link.
6. Export is audited.

### US-014 — Import active leases

**As an Implementation Specialist, I want to validate and import customer lease data so that onboarding is accurate and repeatable.**

Acceptance criteria:

1. The import provides a documented template and field mapping preview.
2. Validation identifies unknown inventory, duplicate Residents, conflicts, invalid dates, currencies, and row-level errors before commit.
3. The user chooses an allowed atomic or partitioned commit strategy and sees its implications.
4. Imported records retain source file/batch, source row, actor, and effective date.
5. Restarting the same batch does not duplicate committed Leases or balances.
6. A completion report identifies created, matched, skipped, and failed rows.

### US-015 — Audit a financial correction

**As an Auditor, I want to trace a corrected Charge from creation to replacement so that financial history is defensible.**

Acceptance criteria:

1. The original posted Charge remains visible and unchanged.
2. Reversal and replacement or adjustment records identify reason, actor, time, and source.
3. Related Payment allocations are re-evaluated explicitly and never silently discarded.
4. The audit view links business records, batch/job, request correlation, and approvals.
5. Secret and unnecessarily sensitive values are excluded from audit payloads.

### US-016 — Enforce a subscription limit

**As an Organization Owner, I want clear warnings and upgrade options when approaching a plan limit so that operations are not unexpectedly disrupted.**

Acceptance criteria:

1. Authorized users can see current usage, limit, measurement definition, and reset/effective period.
2. Warnings appear before the configured threshold.
3. A hard-limit action is blocked before partial creation and explains available resolution.
4. Existing records remain readable and exportable according to lifecycle policy.
5. An upgrade applies according to commercial policy and the blocked action can be safely retried.

### US-017 — Suspend and reactivate an Organization

**As a Platform Administrator, I want controlled suspension and reactivation so that subscription enforcement does not damage customer records.**

Acceptance criteria:

1. Suspension requires authorized reason and records the effective time.
2. Ordinary mutations are rejected consistently across UI, API, integrations, and jobs.
3. Suspension does not alter Leases, balances, inventory, or historical data.
4. Approved owner billing/support/export access remains available.
5. Reactivation is idempotent and restores access without changing durable identifiers.
6. Both transitions are audited and communicated according to policy.

### US-018 — Close an Organization account

**As an Organization Owner, I want to close my Organization and retrieve my data so that offboarding is controlled and transparent.**

Acceptance criteria:

1. Closure requires strong ownership verification and displays contractual consequences.
2. The owner can request a scoped data export before access ends.
3. A recoverable retention period and cancellation deadline are disclosed.
4. Legal holds prevent incompatible deletion and are handled without exposing restricted details.
5. Irreversible deletion/anonymization occurs only after policy and backup-lifecycle checks.
6. Lifecycle actions and exports are audited.

### US-019 — Use localized dates and billing

**As a Property Manager operating in another region, I want local dates, language, and currency formatting so that documents and schedules are understandable.**

Acceptance criteria:

1. The Property uses a valid IANA time zone and configured locale/currency.
2. Due dates and reporting-day boundaries follow Property local time, including daylight-saving transitions.
3. Persisted event instants remain UTC and display with the applicable local offset.
4. Generated documents use the effective translated template and locale formatting.
5. Changing defaults does not alter issued documents or posted historical calculations.

### US-020 — Access resident self-service securely

**As a Leaseholder, I want to view my Lease, balance, receipts, documents, and requests so that I can manage my rental relationship.**

Acceptance criteria:

1. The portal shows only records explicitly related to the authenticated Resident and current authorization.
2. Shared-Lease privacy rules restrict another Resident's sensitive identity and communication data.
3. Documents are delivered through short-lived authorized access.
4. Balance details distinguish Charges, Payments, credits, refunds, and deposits.
5. Revoking portal access invalidates active sessions without deleting the Resident's business history.

### US-021 — Establish and monitor a payment plan

**As a Finance Officer, I want to agree installments for eligible arrears so that collection is structured without rewriting the original debt.**

Acceptance criteria:

1. The draft identifies included Charges, outstanding principal, installment amounts/dates, start/end, missed-payment treatment, and collection steps to pause.
2. Preview proves installments reconcile to the covered amount in the account currency and discloses excluded Charges and any separately authorized fees.
3. Approval and resident acknowledgement/evidence are recorded before activation according to policy.
4. Original Charges, due dates, allocations, and aging history remain intact; plan status separately controls collection treatment.
5. Partial Payments allocate under the plan rule and leave unapplied value and remaining installments explicit.
6. Amendment, cancellation, default, fulfillment, or reinstatement is date-effective, audited, and preserves prior plan versions.

### US-022 — Complete deposit disposition

**As a Property Manager, I want to complete a controlled deposit-disposition checklist so that every held amount has an evidenced outcome.**

Acceptance criteria:

1. The checklist confirms move-out condition, final utility position, returned keys/assets, outstanding claims, held amount, prior dispositions, and applicable policy.
2. Every deduction includes category, amount, reason, evidence, and approval; excess claims become separate Charges.
3. The remaining amount can be refunded, lawfully forfeited where configured, transferred to a specifically identified next Lease, or explicitly remain held with reason.
4. A high-value release, refund, forfeiture, or transfer requires a distinct maker and checker under the effective threshold policy.
5. Completed component amounts reconcile exactly to the held amount and preserve the original holding record.
6. The immutable disposition document identifies effective policy/template, recipient/destination, approvals, and Payment/refund status.

### US-023 — Import meter readings in bulk

**As a Property Manager, I want to validate and import a meter-reading file so that month-end utility billing is efficient and explainable.**

Acceptance criteria:

1. Mapping preview shows source batch/file, row, meter identifier, timestamp, value, unit, source, and evidence reference.
2. Pre-commit validation reports unknown/inactive meters, duplicates, rollback, undeclared reset/rollover, future/out-of-order timestamps, and row-level errors.
3. The user chooses an allowed atomic or partitioned commit and sees source totals and accepted/skipped/failed counts.
4. Retrying the same batch does not duplicate accepted readings and safely re-evaluates corrected failed rows.
5. Accepted readings retain batch/row provenance and cannot be destructively changed after use in billing.
6. The completion report identifies readings requiring review before utility Charges can be generated.

### US-024 — Execute an arrears collection sequence

**As a Finance Officer, I want overdue accounts to progress through controlled reminders and escalation so that follow-up is consistent and disputes are respected.**

Acceptance criteria:

1. Preview shows as-of time, eligibility, overdue amount, aging, payment-plan status, dispute exclusions, guarantor eligibility, steps/channels, and audience.
2. Execution sends or schedules each logical step once and records template/policy version and delivery outcome.
3. Payment, approved plan, write-off, Lease/account closure, or configured minimum balance exits or changes the sequence from an auditable effective time.
4. Opening a dispute pauses only the disputed scope; resolution resumes, amends, or closes subsequent steps without duplicating earlier messages.
5. Escalation creates assigned tasks and never claims automated legal action or adverse eligibility decision.
6. Authorized users can explain why an account entered, skipped, paused, advanced, or exited the sequence.

### US-025 — Record and reconcile a cash Payment

**As a Finance Officer, I want to receipt cash and reconcile it to cash-up and bank deposit evidence so that collection and settlement remain distinct and controlled.**

Acceptance criteria:

1. Recording captures payer, amount/currency, collector, location/register, received-at time, reference, evidence, and idempotency key.
2. Confirmation issues one immutable receipt and allows partial allocation while preserving any unapplied credit.
3. The Payment remains Unreconciled until matched to an approved cash-up or bank-deposit record; receipt issuance does not imply bank settlement.
4. Suggested and ambiguous matches require authorized review, and differences remain visible as exceptions.
5. Above the configured threshold, the recorder cannot approve their own reconciliation, refund, or reversal.
6. Retry or duplicate submission creates no second Payment, allocation effect, receipt, or resident notification; all state changes are audited.

## 8. Reporting and metric definitions

To keep success metrics and reports comparable:

- **Occupied capacity:** Capacity covered by active date-effective Lease assignments at the as-of instant.
- **Available capacity:** Operationally rentable capacity not occupied, reserved, or blocked at the as-of instant.
- **Occupancy rate:** Occupied capacity divided by operationally rentable capacity for the same rentable level and as-of instant.
- **Physical occupancy rate:** Physically occupied or date-effectively assigned capacity, including disclosed Holdover occupancy, divided by operationally rentable physical capacity; reservations and operational blocks are reported separately.
- **Economic occupancy rate:** Earned or contracted rent for occupied inventory divided by market or potential rent for rentable inventory under a disclosed rate source, vacancy treatment, period, and exclusions.
- **Collection rate:** Confirmed Payments allocated to Charges due in the measurement cohort, divided by net Charges due for that cohort, reported with the aging cutoff and treatment of reversals, disputes, credits, and write-offs.
- **Time to move-in:** Elapsed business time from approved application or accepted offer to completion of all configured move-in-ready Lease tasks, with resident-controlled waiting time reported separately.
- **Billing-run duration:** Elapsed time from accepted execution to terminal completion for a stated Organization/scope and period, including retries and excluding preview time.
- **Billed amount:** Net posted Charges after posted reversals/adjustments for the reporting period.
- **Collected amount:** Confirmed Payment value allocated during the reporting period; settlement reporting must be labeled separately.
- **Outstanding balance:** Eligible posted Charges less allocations, credits, reversals, and write-offs as of the stated instant.
- **Arrears:** Outstanding balance whose due date is before the as-of local business date, excluding configured disputed or deferred amounts.
- **Activation:** An Organization has configured at least one Property, one Unit or Bed Rentable Item, and one Scheduled or Active Lease.
- **Billing automation success:** Successfully posted scheduled Charges divided by all eligible scheduled Charges, excluding preview-only items.

## 9. Release acceptance gates

The initial commercial release shall not be approved unless:

1. Automated tests of the Organization-to-`tenant_id` isolation boundary pass for all exposed modules, jobs, exports, caches, and document access paths.
2. Core Lease, billing, Payment, deposit, utility, and correction rules have passing automated tests.
3. Load tests demonstrate representative month-start processing for a portfolio of 10,000+ Units and Beds within approved batch windows.
4. Backup restoration and queue-failure recovery have been demonstrated in a production-like environment.
5. Accessibility review verifies the core staff and Resident journeys against WCAG 2.2 Level AA.
6. Audit evidence is complete for privileged access, Lease activation, financial posting/correction, exports, and lifecycle transitions.
7. Subscription limit, Grace Period, suspension, reactivation, closure, and export behavior has been verified end to end.
8. Locale, currency, IANA time-zone, and daylight-saving test cases cover all launch regions.
9. Security review has no unresolved critical or high-severity findings.
10. Operational dashboards, alerts, runbooks, support procedures, and customer-facing scope disclosures are ready.
11. Concurrency and replay tests demonstrate safe handling of reservation overbooking races, overlapping billing runs, duplicate payment webhooks, meter rollback/reset, and daylight-saving gaps/overlaps.

## 10. Traceability and change control

- Functional requirements use `FR-{DOMAIN}-{NUMBER}`.
- Business rules use `BR-{NUMBER}`.
- Non-functional requirements use `NFR-{DOMAIN}-{NUMBER}`.
- User stories use `US-{NUMBER}`.

Designs, implementation tasks, tests, and release evidence should reference these identifiers. A requirement change that affects posted financial behavior, historical interpretation, tenant isolation, retention, authentication, or subscription enforcement requires explicit product and technical review. Approved revisions must update both this document and the [Product Overview](./00-overview.md) when vocabulary, vision, scope, or roadmap is affected.
