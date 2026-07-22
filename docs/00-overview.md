# Rental Property Management SaaS — Product Overview

**Document ID:** RPM-OVERVIEW-00  
**Status:** Draft baseline  
**Audience:** Product, engineering, design, operations, sales, implementation, and support teams  
**Related documents:** [01 — Business Requirements](./01-business-requirements.md) · [11 — Design Review Findings](./11-design-review-findings.md)

## 1. Product vision

Provide a dependable, secure, and commercially viable multi-tenant platform that enables boarding-house and apartment Organizations to manage the complete rental lifecycle—from inventory and occupancy to billing, maintenance, communication, and reporting—in one system.

The product is designed to serve Organizations with approximately 30 independently managed occupancy spaces while retaining a clear path to portfolios of 10,000 or more Units and Beds. It should reduce manual administration, improve revenue visibility, strengthen operational control, and give Residents a more transparent rental experience.

## 2. Product goals

1. **Create one operational source of truth.** Consolidate properties, rentable inventory, residents, leases, charges, payments, utilities, maintenance, documents, and communications.
2. **Improve occupancy and revenue control.** Make availability, lease status, receivables, arrears, deposits, and cash collection visible and actionable.
3. **Automate repeatable work.** Generate recurring rent and service charges, apply payment allocations, issue reminders, and schedule routine operational tasks.
4. **Support multiple operating models.** Represent apartments, studios, private rooms, and shared rooms consistently as Units, with optional Beds for individually assigned shared occupancy.
5. **Protect Organization data.** Enforce Organization isolation, role-based access, traceable changes, and secure handling of credentials and documents.
6. **Scale predictably.** Support small operators without unnecessary complexity and large portfolios without redesigning the core domain.
7. **Enable regional operation.** Support configurable currencies, languages, date/number formats, business time zones, billing conventions, and document templates.
8. **Establish a sustainable SaaS business.** Provide subscription plans, entitlements, usage metering, trials, billing status, and lifecycle controls.

### 2.1 Supported operating models

The same Organization boundary supports:

- **Owner-operated boarding house:** the property owner directly operates one or more boarding houses and performs leasing, collection, utility, and maintenance work.
- **Professional property manager (operator):** an operator manages Properties for one or more beneficial owners while the operator remains the SaaS customer and Organization boundary.
- **Multi-property portfolio:** one Organization centrally governs multiple Properties, staff scopes, policies, reporting, and shared services.

Owner identity, management agreements, and owner-attributed reporting may be recorded where required, but calculation and execution of owner distributions or payouts are deferred beyond the MVP. An owner is not a separate Organization unless separately contracted and isolated as a SaaS customer.

## 3. Measurable success metrics

Initial targets are product objectives and should be calibrated after pilot baselines are available.

| Area | Metric | Target |
|---|---|---|
| Adoption | Activated Organizations that configure a Property, inventory, and first Lease within 14 days | At least 80% |
| Data completeness | Active leases with required resident, inventory, dates, rent, deposit, and billing schedule data | At least 98% |
| Billing automation | Recurring monthly charges generated without manual correction | At least 99.5% |
| Collection visibility | Recorded payments allocated or explicitly left as account credit | At least 99% |
| Collection effectiveness | Collection rate: confirmed Payments allocated to Charges due in the period, divided by net Charges due in that period, measured 30 days after period end | At least 95% for pilot cohorts, reported by Organization and excluding documented disputes/write-offs |
| Leasing efficiency | Median elapsed time from approved application or accepted offer to move-in-ready Active Lease | At most 2 business days, excluding resident-controlled signature/payment delay |
| Batch scalability | Month-start recurring billing run for one Organization with 10,000 Units/optional Beds under the defined reference load | Complete within 60 minutes, with no duplicate Charges |
| Operational efficiency | Reduction in time spent preparing monthly rent statements versus prior process | At least 50% |
| Occupancy visibility | Active inventory with a determinable availability status | 100% |
| Reliability | Monthly production availability, excluding announced maintenance | At least 99.9% |
| Performance | Common interactive API requests at p95 under normal load | At most 500 ms |
| Support quality | Priority-one incidents caused by cross-Organization data exposure | Zero |
| Retention | Logo churn after the first full subscription year | Below 10% annually |

## 4. Target users

### 4.1 SaaS customer roles

- **Organization Owner:** Owns the Organization account, subscription, security policy, and highest-level administration.
- **Portfolio Administrator:** Configures properties, users, policies, templates, and portfolio-wide settings.
- **Property Manager:** Manages occupancy, leases, resident accounts, communications, and daily property operations.
- **Leasing Officer:** Handles inquiries, applications where enabled, resident onboarding, lease preparation, move-in, renewal, transfer, and move-out.
- **Accountant or Finance Officer:** Manages charges, invoices, payments, deposits, adjustments, reconciliation, tax configuration, and financial reports.
- **Maintenance Manager:** Triages work requests, assigns work, manages priorities and service-level targets, and tracks costs.
- **Technician or Vendor User:** Views and updates only assigned work with intentionally limited resident and financial information.
- **Read-only Auditor or Executive:** Reviews portfolio results, records, and audit history without changing operational data.

### 4.2 Resident-facing users

- **Leaseholder:** A resident who is legally responsible under a lease and may access statements, payments, documents, messages, and requests.
- **Occupant:** A person authorized to reside in an inventory item but who may not be financially responsible.
- **Guarantor or Sponsor:** A party with defined financial responsibility and restricted access when supported.

### 4.3 Platform roles

- **SaaS Platform Administrator:** Operates the service, subscriptions, support tooling, feature entitlements, and platform health. Platform access to Organization data must be controlled and audited.
- **Support Agent:** Assists customers through time-bound, least-privilege support access with reason capture and audit logging.

## 5. Canonical vocabulary

The following terms are normative across product and engineering documentation:

- **Organization:** The customer-facing term for a customer account and its security, data, configuration, subscription, and operational boundary. Internally, each Organization maps one-to-one to an immutable `tenant_id`; **tenant** and **tenant_id** are reserved primarily for architecture, database, infrastructure, and implementation language.
- **User:** An authenticated person with access to one or more Organizations.
- **Property Owner:** A person or legal entity holding an effective ownership or beneficial interest in one or more Properties. A Property Owner is a business Party, not automatically a User, Organization Owner, or SaaS customer.
- **Management Agreement:** An effective-dated agreement defining the Organization's authority to operate a Property for one or more Property Owners. It records scope and commercial references but does not itself grant application access.
- **Resident:** A person who lives or will live at a property.
- **Leaseholder:** A Resident or external party that is legally responsible for a Lease.
- **Portfolio:** The collection of Properties managed by one Organization.
- **Property:** A physical site or building managed as an operational location.
- **Unit:** An independently managed occupancy space within a Property, such as an apartment, studio, private room, or shared room. A Unit is the whole-space rentable level and is not subdivided into a separate Room entity.
- **Bed:** An optional individually assignable occupancy place within a shared Unit. Beds are not required when a shared Unit is managed only by capacity.
- **Rentable Item:** The specific Unit or optional Bed assigned to a Lease. Whole-unit rental uses the Unit; individually assigned shared occupancy uses a Bed. Capacity-based shared occupancy may assign the Unit while consuming one or more capacity places.
- **Lease:** A dated agreement governing occupancy, financial terms, responsible parties, and assigned Rentable Items.
- **Resident Account:** The financial subledger for a Lease or responsible party, containing charges, payments, credits, refunds, and balances.
- **Charge:** An amount due, including rent, utilities, services, fees, taxes, penalties, or adjustments.
- **Invoice/Statement:** A rendered and optionally numbered presentation of charges and account activity. It does not replace ledger entries.
- **Payment:** Money received or confirmed through a payment method or external provider.
- **Security Deposit:** Funds held under configurable rules and tracked separately from operating income.
- **Meter:** A device or logical source used to record utility consumption.
- **Work Order:** A managed maintenance task resulting from a request, inspection, or planned activity.

## 6. Product scope

### 6.1 In scope

#### Organization and access management

- Organization onboarding, trial, activation, suspension, reactivation, export, and closure.
- User invitations, multi-organization membership, roles, scoped permissions, and session management.
- Subscription plan, billing state, entitlements, usage counters, and plan-limit enforcement.

#### Portfolio and rentable inventory

- Property hierarchy supporting Property → Unit → optional Bed.
- Whole-unit rental for apartments, studios, and private rooms, plus Bed assignment or Unit-capacity allocation for shared rooms.
- Inventory attributes, amenities, capacity, operational status, pricing defaults, availability, waitlists, and expiring soft holds or hard reservations.
- Boarding-house and apartment configurations within one portfolio.

#### Residents and leases

- Resident and related-party profiles, duplicate detection aids, contact preferences, and history.
- Lease drafting, approval where configured, activation, renewal, transfer, amendment, notice-period enforcement, termination, holdover occupancy after lease end, and move-out.
- Multiple leaseholders and occupants, date-bounded assignments, deposits, rent schedules, and attached documents.

#### Billing and payments

- Recurring and one-time charges, proration, discounts, taxes, penalties, credits, write-offs, refunds, and account balances.
- Invoices/statements, payment recording, allocation, receipts, reconciliation support, and payment-provider integration points.
- First-class payment channels for cash, bank transfer, QR/local wallets, and card through a payment service provider (PSP), with evidence and settlement/reconciliation status. The platform does not store card PAN or other raw card credentials.
- Security-deposit collection, holding, deduction, refund, and disposition records.

#### Utilities and meters

- Utility services, meters, readings, tariffs, shared-cost allocation, consumption calculation, and billable charge generation.

#### Operations

- Maintenance requests, work orders, assignment, status, service-level targets, costs, attachments, and resident updates.
- Scheduled notices, announcements, message templates, delivery history, preferences, and opt-out controls where legally permitted.
- Document upload, categorization, versioning, access control, retention metadata, and template-generated documents.

#### Reporting and governance

- Operational and financial dashboards, occupancy, rent roll, arrears, collections, lease expiry, utilities, and maintenance reports.
- Export of authorized data.
- Immutable audit events for material actions and controlled support access.
- Locale, currency, language, date/number format, and time-zone-aware processing.

### 6.2 Out of scope for the initial release

- Full general ledger, double-entry accounting, payroll, procurement, and statutory tax filing.
- Native banking, card acquiring, or custody of payment-card credentials, including card PAN.
- Building access control, smart-lock firmware, CCTV, or physical security monitoring.
- Full real-estate marketplace, lead syndication, and public listing portal.
- Construction project management and capital asset depreciation.
- AI-based legal, credit, or resident eligibility decisions.
- Jurisdiction-specific legal compliance guarantees; the platform provides configurable controls, not legal advice.
- Dedicated database per Organization in the initial architecture.
- Fully offline operation.

External accounting, payment, identity, messaging, and storage services may be integrated without becoming systems of record for the core rental domain.

### 6.3 Known limitations and deferred commercial depth

The MVP establishes operational records and integration seams but does not imply the following commercial depth:

| Capability | MVP boundary | Phase 2+ direction |
|---|---|---|
| Owner distributions | Owner attribution and exportable owner-facing operational reports may be supported; no payout calculation, reserve waterfall, approval, or disbursement execution | Configurable management fees, reserves, owner statements, distribution approval, and PSP/banking-assisted payout workflows |
| Full trust accounting | Deposits and client funds are separately classified and traceable, but the product is not a statutory trust-accounting ledger or bank-accounting system | Jurisdiction-specific trust ledgers, three-way reconciliation, controlled journals, and compliance evidence where commercially approved |
| Multi-country tax and e-invoicing | Configurable tax components, display, calculation, and document fields; no statutory filing, clearance, fiscalization, or universal compliance guarantee | Country extension packs and certified provider integrations for selected jurisdictions |
| Marketplace | Internal inventory availability, waitlist, holds, and reservations only | Public listings, lead syndication, marketplace application funnels, and partner distribution |
| Enterprise identity | Product-managed authentication, MFA policy, and Organization-scoped roles | Enterprise SSO, SCIM provisioning/deprovisioning, directory groups, and advanced access governance |

These deferrals must be stated in proposals and release notes so operational capability is not misrepresented as regulated accounting, statutory tax compliance, payout custody, marketplace distribution, or enterprise identity support.

## 7. Core capabilities

### 7.1 Organization and subscription administration

Each Organization has independent branding, configuration, Users, roles, subscription, limits, locale, currency, and default time zone. Plan entitlements control optional capabilities and usage ceilings without weakening access controls or historical data access.

### 7.2 Flexible property hierarchy

The inventory model supports:

- Whole-Unit Leases for apartments, studios, and private rooms.
- Whole-Unit Leases for shared rooms managed as one contract.
- Bed-level Leases for individually assigned places in a shared Unit.
- Capacity-based assignments for shared Units where named Beds are unnecessary.

Every Bed belongs to one shared Unit; there is no separate Room entity or Room-level rentable item. The system derives occupancy from active, date-effective Unit/Bed assignments and capacity consumption rather than a manually editable occupied flag. Operational statuses such as unavailable, under maintenance, reserved, or retired remain separately managed.

### 7.3 Resident and lease lifecycle

The platform maintains a durable Resident identity within an Organization and preserves historical relationships. Lease workflows support draft negotiation, approvals, future activation, move-in, amendments, renewal, transfer, notice, termination, move-out, and archival. Historical lease terms remain reproducible after configuration changes.

### 7.4 Billing and collection

The system generates charges from date-effective lease terms and utility calculations. A resident account clearly separates amounts charged, paid, credited, refunded, written off, and held as deposits. Corrections use reversals or adjustments rather than destructive edits after posting.

Cash, bank transfer, QR/local wallet, and PSP-processed card Payments are first-class channels. Each preserves channel-specific evidence, confirmation, settlement, and reconciliation state; card processing is delegated to the PSP and the platform does not store card PAN.

### 7.5 Utilities

Meters can belong to a Property, Unit, or shared service. Reading validation detects regressions, duplicates, and unusual consumption. Tariffs and allocation methods are versioned so historical bills can be explained and regenerated consistently.

### 7.6 Maintenance

Residents and staff can report issues with categories, descriptions, urgency, availability, and attachments. Managers triage requests into work orders, assign internal or external workers, track labor/material costs, record status history, and communicate completion.

### 7.7 Communication and documents

Users can send transactional messages and announcements using templates and preferred channels. Every delivery attempt records its status. Documents can be linked to Properties, Residents, Leases, invoices, Payments, or Work Orders and are protected by the same Organization and permission boundaries.

### 7.8 Reporting and audit

Dashboards and reports operate on an explicit “as of” date/time and respect user scope. Material create, update, posting, approval, export, access-elevation, and deletion actions generate audit events containing actor, action, target, timestamp, and relevant before/after context.

## 8. Organization lifecycle

1. **Prospect/Trial:** An Organization is created with a time-limited plan, owner, default settings, and setup checklist.
2. **Active:** Subscription is valid; entitled features and normal operations are available.
3. **Grace Period:** Payment or renewal requires attention; warnings are shown while operational access continues for a configurable period.
4. **Suspended:** Mutating operations are restricted, but authorized owners may access billing, support, and data export as policy permits.
5. **Reactivated:** Subscription is restored without losing historical configuration or identifiers.
6. **Closure Requested:** Ownership is verified, export options are presented, and a recoverable retention window begins.
7. **Closed/Pending Deletion:** Normal access ends; retained data is protected and unavailable except through an approved recovery process.
8. **Deleted or Anonymized:** Organization data is removed or irreversibly anonymized according to retention policy, legal holds, and backup lifecycle.

Lifecycle transitions must be explicit, authorized, auditable, and idempotent.

## 9. Product principles

- **Isolation by default:** Every Organization maps one-to-one to an internal `tenant_id`; every Organization-owned record carries or inherits that boundary, and authorization and data access enforce it server-side.
- **History over mutation:** Posted financial records, readings used for billing, executed lease terms, and audit events are corrected through traceable actions.
- **Configuration is date-effective:** Rates, taxes, tariffs, entitlements, and lease terms preserve effective periods.
- **Least privilege:** Users receive only the permissions and property scope required.
- **Explainability:** A user can trace an amount, occupancy state, or status to its source records.
- **Idempotency:** Retried billing, payment, import, notification, and integration operations must not create duplicate business effects.
- **Local business time:** User interfaces display local time, while persisted timestamps and integrations use UTC with an associated IANA time-zone identifier.
- **Accessible workflows:** Core staff and resident journeys should conform to WCAG 2.2 Level AA.
- **Integration-ready:** External systems connect through versioned APIs, webhooks, exports, and stable identifiers.

## 10. Canonical solution assumptions

These assumptions establish consistency; they are not a complete architecture specification.

- **Frontend:** React with TypeScript.
- **Backend:** NestJS modular monolith with modules aligned to major business capabilities.
- **Database:** PostgreSQL accessed through Prisma.
- **Multi-tenancy:** Each customer-facing Organization maps to one immutable internal `tenant_id`; the shared database and schema use mandatory `tenant_id` row isolation initially.
- **Cache and asynchronous processing:** Redis for cache, distributed coordination, rate limiting as appropriate, and queues.
- **Object storage:** S3-compatible storage using private objects and time-limited access.
- **Authentication:** Short-lived JWT access tokens and rotating refresh tokens with reuse detection and revocation.
- **Deployment:** Containerized services with environment-specific configuration and managed secrets.
- **Commercial recovery baseline:** Production service tiers shall provide RPO ≤ 15 minutes and RTO ≤ 4 hours. Architecture and premium tiers may target better objectives, but must not weaken or ambiguously replace this baseline.
- **Architecture evolution:** Modules should permit later extraction or Organization data-placement changes when scale, regulation, or commercial needs justify them.

## 11. Future roadmap

### Phase 1 — Commercial foundation

- Organization onboarding, Property/Unit/Bed inventory, Residents, Leases, rent billing, Payment recording, utilities, maintenance, documents, core reports, audit, and subscription controls.
- Data import templates and guided migration for properties, residents, opening balances, and active leases.
- Email notifications and integration-ready payment workflows.

### Phase 2 — Automation and resident experience

- Resident self-service portal and mobile-optimized workflows.
- Online applications, approvals, e-signature integration, recurring online payments, and automated collection sequences.
- Inspections, move-in/move-out checklists, deposit disposition workflow, preventive maintenance, and vendor portal.
- SMS and additional messaging channels.

### Phase 3 — Portfolio intelligence and ecosystem

- Accounting integrations, open API, webhooks, data warehouse connectors, and configurable workflow automation.
- Forecasting for occupancy, cash flow, utility anomalies, and maintenance demand with human-review controls.
- Advanced owner reporting, budget versus actuals, and multi-entity consolidation.

### Phase 4 — Enterprise and regional expansion

- Optional dedicated database or regional data placement for qualifying Organizations.
- Enterprise SSO, SCIM provisioning, custom roles, advanced approval matrices, and expanded audit export.
- Additional languages, currencies, tax models, local payment providers, and jurisdiction-specific extension packs.

Roadmap items are directional and become committed scope only when included in an approved release plan.

## 12. Key risks and constraints

- Rental law, deposit handling, taxes, invoicing, privacy, retention, and messaging consent vary by jurisdiction.
- Deposit collection, permitted deductions, holding, transfer, forfeiture, notice, and return deadlines vary materially by jurisdiction and require configurable policy plus customer legal validation.
- Shared-inventory billing and utility allocation can become disputed unless methods, inputs, and rounding are transparent.
- Utility allocation, estimated readings, meter rollover, shared-service rules, and evidence quality can create resident disputes unless calculations are reproducible and dispute-paused collection is supported.
- Spreadsheet migrations often contain duplicates, incomplete histories, inconsistent identifiers, unsupported formulas, and ambiguous opening balances; provenance and reconciliation are mandatory.
- Large portfolios require asynchronous batch processing, pagination, efficient reporting models, Organization-aware quotas, and safeguards against noisy-neighbor tenants.
- Payment initiation or provider confirmation is not equivalent to settled funds; bank/PSP reconciliation lag and delayed reversals must preserve evidence, explicit status, and operator review.
- Organization isolation—implemented initially through the internal `tenant_id` boundary—must be enforced in application access paths, background jobs, exports, object storage, caches, logs, and support tools, not only in database queries.

## 13. Document governance

This overview defines product intent and shared vocabulary. Detailed behavior is specified in [01 — Business Requirements](./01-business-requirements.md). When documents conflict, an approved change record must resolve the discrepancy; implementation behavior must not silently redefine a business term or rule.
