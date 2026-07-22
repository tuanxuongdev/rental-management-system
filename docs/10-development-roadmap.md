# 10. Development Roadmap

## 1. Purpose and Planning Basis

This roadmap provides a realistic delivery sequence for a production commercial, multi-Organization Rental Property Management SaaS. It is a planning baseline, not a fixed-price commitment or delivery guarantee.

The product is expected to support an initial portfolio of approximately 30 units and scale to 10,000+ units. The technical baseline is a `pnpm` monorepo with React/TypeScript, NestJS API and worker applications, PostgreSQL/Prisma, Redis, S3-compatible storage, and a modular monolith.

### Estimate assumptions

The schedule below assumes:

- Two-week sprints.
- A stable, empowered product owner and access to property-management subject matter experts.
- One cross-functional product team as described in the staffing section.
- Managed PostgreSQL, Redis, S3, email, observability, and payment-provider services.
- One primary country, currency, language, tax context, and payment provider for MVP.
- Responsive web delivery; native mobile applications are not in MVP.
- Payment card data remains with a compliant payment provider.
- No complex trust accounting, owner distributions, public marketplace, or full general ledger in MVP.
- Timely decisions and external-provider onboarding; payment-provider KYC, merchant underwriting, bank-account verification, and production credential issuance begin in Sprint 0 and may take 6–12+ weeks.
- Pilot data of manageable quality and volume.

Under those assumptions, controlled pilots are plausible after approximately 18 two-week sprints (about nine months). General availability should not be planned before dedicated financial soak, two migration rehearsals, representative pilots, independent penetration testing, and a 10,000-unit load gate complete—approximately 24 sprints (about twelve months). Discovery outcomes, compliance requirements, provider KYC, staffing changes, legal variance, and data quality can materially extend that range.

## 2. MVP Scope and Product Boundaries

### MVP capabilities

- Organization creation, subscription/admin controls, and Organization isolation.
- User authentication, invitations, memberships, role-based authorization, and audit trail.
- Property, building, Unit, optional Bed, amenity, and occupancy inventory.
- Resident profiles, document references, leases, deposits, move-in, renewal, and move-out.
- Charge schedules, invoices/ledgers, receipts, payment-provider integration, and reconciliation.
- Maintenance requests, assignment, status tracking, attachments, and notifications.
- Basic dashboards, occupancy, aging, collection, lease-expiry, and maintenance reports.
- CSV/PDF exports for selected operational reports.
- Production operations: monitoring, backups, recovery, support tooling, and runbooks.

### Explicitly deferred unless discovery changes priority

- Native iOS/Android apps.
- Multi-country tax and regulatory support.
- Full accounting/general ledger and owner distribution accounting.
- Marketplace/listing syndication.
- Smart-lock, utility-meter, and broad ERP integrations.
- Advanced pricing optimization and AI automation.
- Custom Organization-defined workflows or report builders.
- Microservices.

### Post-GA product Phase 2

- Payment plans and promise-to-pay automation.
- E-signature workflows.
- SMS delivery and consent management.
- Owner statements and owner-facing reporting.

These capabilities are explicitly outside MVP/GA scope and must not be pulled into launch sprints without removing equivalent scope.

## 3. Delivery Principles

1. Establish Organization isolation, audit, observability, and delivery automation before business modules multiply.
2. Deliver vertical, demonstrable slices rather than completing all backend work before frontend work.
3. Introduce billing and payment foundations early enough to absorb provider and reconciliation risk.
4. Keep migrations backward-compatible and releases reversible.
5. Validate workflows with pilot users throughout development, not only at acceptance.
6. Use production-like volumes and failure scenarios before launch.
7. Scope each sprint to a releasable increment; unfinished work does not count as delivered.

## 4. Phase and Milestone Overview

### Phase 0 — Discovery and delivery setup

**Target:** Sprint 0 or a two-week inception period  
**Outcome:** Approved MVP boundaries, domain language, architecture decisions, risk register, delivery backlog, and provider choices.

Key outputs:

- User roles, primary journeys, business rules, and authorization matrix.
- Initial data classification and threat model.
- Entity lifecycle and terminology for property, unit, optional bed, resident, lease, charge, invoice, payment, and maintenance request.
- Non-functional targets and launch service-level objectives.
- Provider selection and onboarding for cloud, email, object storage, observability, and payments.
- Initial migration assessment and representative source-data samples.

**Milestone M0:** MVP charter and architecture baseline approved.

### Phase 1 — Platform foundation

**Target:** Sprints 1–2  
**Outcome:** Deployable monorepo baseline with secure configuration, CI/CD, observability, persistence, and test foundations.

**Milestone M1:** A production-shaped empty vertical slice deploys automatically to development and staging.

### Phase 2 — Identity and Organization boundary

**Target:** Sprints 3–4  
**Outcome:** Users can authenticate, join an organization, exercise approved roles, switch authorized organization context, and produce audit records.

**Milestone M2:** Organization isolation and authorization test suite passes for identity and administration.

### Phase 3 — Property inventory

**Target:** Sprints 5–6  
**Outcome:** Authorized users can manage properties, buildings, units, optional beds, status, and bulk inventory imports.

**Milestone M3:** Pilot portfolio inventory can be imported, validated, searched, and exported.

### Phase 4 — Residents and leases

**Target:** Sprints 7–9  
**Outcome:** Teams can manage residents and execute a controlled lease lifecycle with occupancy and document rules.

**Milestone M4:** A pilot operator can complete move-in, renewal, and move-out scenarios end to end.

### Phase 5 — Billing and payments

**Target:** Sprints 10–13  
**Outcome:** The platform can generate charges, maintain resident ledgers, accept supported payments, reconcile settlements, and issue receipts. Dedicated soak time validates webhooks, idempotency, retries, reversals, reconciliation, and billing replay under repeated and out-of-order delivery.

**Milestone M5:** Financial parallel run reconciles to agreed tolerances with no unexplained duplicate or missing transactions.

### Phase 6 — Operations and reporting

**Target:** Sprints 14–15  
**Outcome:** Maintenance workflows, notifications, operational dashboards, and MVP reports support daily property operations.

**Milestone M6:** Core operational workflows and reports are accepted by pilot users.

### Phase 7 — Migration rehearsals

**Target:** Sprints 16–17  
**Outcome:** Two complete, timed migration rehearsals prove mapping, rejection handling, occupancy integrity, opening-balance reconciliation, cutover duration, and rollback mechanics.

**Milestone M7:** Rehearsal results meet pre-agreed count, financial, duration, and exception tolerances.

### Phase 8 — Representative pilots

**Target:** Sprints 18–19  
**Outcome:** One boarding house and one apartment portfolio operate through at least one representative billing, payment, reconciliation, maintenance, and move-out cycle.

**Milestone M8:** Both pilot cohorts satisfy product, financial, support, and operational exit criteria.

### Phase 9 — Security and scale launch gate

**Target:** Sprints 20–21  
**Outcome:** Dedicated security hardening, independent penetration testing, remediation/retest, resilience exercises, WCAG 2.2 AA validation, and the 10,000-unit load gate complete before GA.

**Milestone M9:** No unresolved launch-blocking security finding; 10,000-unit workload and backlog-recovery targets pass.

### Phase 10 — Launch and stabilization

**Target:** Sprints 22–24  
**Outcome:** Production migration, controlled rollout, intensive monitoring, issue response, and transition to normal operations.

**Milestone M10:** General availability decision and stabilization review completed.

## 5. Two-Week Sprint Plan

The allocation is intentionally outcome-based. Product discovery, design, automated testing, security review, and documentation occur within each sprint rather than in separate downstream phases.

### Sprint 0 — Inception and risk reduction

- Confirm personas, Organization boundary, role/permission matrix, MVP workflows, and reporting needs.
- Map resident/lease/billing data classifications and retention obligations.
- Validate payment-provider, email, S3, cloud, and observability choices.
- Draft architecture decisions, domain map, initial threat model, and migration assessment.
- Establish success metrics, service targets, backlog, and acceptance examples.

**Exit:** M0 approved; unresolved assumptions have owners and decision dates.

### Sprint 1 — Repository and delivery foundation

- Establish monorepo workspace conventions and package boundaries.
- Create web, API, and worker delivery pipelines.
- Establish strict typechecking, linting, testing, contract checks, dependency scanning, and secret scanning.
- Provision disposable local/test dependencies and development environment.
- Define typed runtime configuration, health endpoints, structured logging, correlation IDs, and baseline telemetry.

**Demo:** A traced web-to-API request deploys through CI to development.

### Sprint 2 — Data and operational foundation

- Establish Prisma schema organization, migration workflow, transaction helpers, and Organization-aware repository patterns.
- Configure managed PostgreSQL, Redis, S3, queue/outbox baseline, and backup policies.
- Define API error, pagination, idempotency, audit, and event envelopes.
- Add integration-test infrastructure and production-like staging deployment.
- Write incident, migration, restore, and deployment runbook skeletons.

**Exit:** M1; restore rehearsal succeeds in a non-production environment.

### Sprint 3 — Authentication and invitations

- Implement authentication/session lifecycle, secure recovery, and invitation acceptance.
- Create users, Organizations, memberships, and immutable audit foundations.
- Add security controls for rate limiting, session revocation, and sensitive-log redaction.
- Build sign-in, recovery, invitation, and basic Organization setup experiences.
- Test authentication abuse and organization-scoped JWT/context establishment.

**Demo:** A new Organization administrator can securely activate an account and invite a user.

### Sprint 4 — Authorization and Organization administration

- Implement deny-by-default role and permission enforcement.
- Add membership, role assignment, Organization settings, and authorized Organization switching.
- Propagate Organization/actor context through API, worker jobs, cache, storage, logs, and audits.
- Build cross-Organization negative tests across every implemented repository and endpoint.
- Add platform support access with explicit reason and enhanced audit, if required.

**Exit:** M2; authorization matrix and Organization-isolation tests are approved.

### Sprint 5 — Property and unit inventory

- Implement property, building/floor, unit, optional bed, amenity, and status models.
- Deliver create/edit/archive, search, filtering, pagination, and responsive list/detail views.
- Add occupancy-safe state transition rules and audit events.
- Establish Organization-scoped object paths for property documents/images.
- Validate inventory terminology and workflows with pilot users.

**Demo:** Operators can configure a small portfolio and locate available Units or Beds.

### Sprint 6 — Bulk inventory and scale baseline

- Add CSV template, validation, preview, import, failure report, and idempotent retry.
- Add bulk status updates with permission and audit controls.
- Test 10,000+ Unit inventory queries, indexes, pagination, and export behavior.
- Instrument slow queries and worker queue depth.
- Prepare pilot inventory mapping and cleansing rules.

**Exit:** M3; representative pilot inventory imports with agreed error handling.

### Sprint 7 — Resident management

- Implement resident profiles, contacts, emergency contacts, status, notes policy, and duplicate detection.
- Add secure document metadata/upload/download flow with short-lived access.
- Define consent, retention, redaction, and export behavior for personal data.
- Deliver resident search and detail history.
- Test cross-Organization document and resident access denial.

**Demo:** Authorized staff can safely create and manage a resident record and documents.

### Sprint 8 — Lease creation and activation

- Implement draft lease, parties, whole-unit/bed/capacity allocation, term, rent, deposit, and recurring-charge inputs.
- Enforce overlap, capacity, date, currency, and occupancy constraints transactionally.
- Add lease review, activation, and audit timeline.
- Generate or upload the MVP lease document through an approved template/process.
- Add concurrency tests for contested Unit/Bed allocation.

**Demo:** A draft lease can be reviewed and activated without double-booking a Unit or Bed.

### Sprint 9 — Lease lifecycle

- Implement move-in, amendment policy, renewal, notice, move-out, termination, and deposit disposition boundaries.
- Update occupancy consistently through lease state transitions.
- Add lease expiry and pending-action views.
- Trigger versioned domain events for downstream billing and notifications.
- Conduct end-to-end workflow acceptance with pilot operators.

**Exit:** M4; lease lifecycle acceptance scenarios pass.

### Sprint 10 — Billing foundation

- Finalize monetary, rounding, timezone, due-date, tax, and numbering policies.
- Implement charge types, recurring schedules, one-off charges, invoices/statements, ledger entries, and adjustments.
- Generate charges idempotently in the worker using durable scheduling/outbox behavior.
- Add preview and approval controls for material batch actions.
- Test month boundaries, leap dates, timezone changes, retries, and partial lease periods.

**Demo:** A billing run produces deterministic, reviewable charges without duplicates.

### Sprint 11 — Payments and receipts

- Integrate the selected payment provider using tokenized/hosted payment methods.
- Implement payment intent/reference, webhook verification, idempotency, receipt, refund boundary, and failure states.
- Add manual/offline payment recording with separation-of-duties controls.
- Build resident/operator payment and ledger views.
- Exercise provider sandbox failure, timeout, duplicate webhook, and replay scenarios.

**Demo:** Supported online and offline payments update the ledger and issue receipts exactly once.

### Sprint 12 — Reconciliation and financial controls

- Implement settlement import/webhook reconciliation, unmatched item queue, and exception workflow.
- Add aging, outstanding balance, collection status, correction, and reversal controls.
- Protect closed periods or finalized records according to agreed policy.
- Run historical and parallel billing comparisons against approved source data.
- Document daily reconciliation and payment incident runbooks.

**Exit:** M5; totals reconcile within an agreed, documented tolerance and exceptions are explainable.

### Sprint 13 — Financial soak and replay

- Run repeated billing cycles with production-shaped volumes, late meter corrections, prorations, reversals, refunds, and unallocated credits.
- Deliver out-of-order, delayed, duplicated, and missing webhook scenarios; verify idempotency across API, worker, provider, and ledger boundaries.
- Kill/restart workers during billing and reconciliation, then prove deterministic resume and failed-item retry.
- Reconcile provider settlements, internal ledger, receipts, bank evidence, and exception queues daily.
- Finalize billing replay, webhook incident, reconciliation, and financial correction runbooks with named owners.

**Exit:** M5; the financial subsystem completes a sustained soak with no unexplained duplicate, missing, or imbalanced transaction and replay is rehearsed.

### Sprint 14 — Maintenance and communications

- Implement maintenance request intake, priority, assignment, status, notes, attachments, and history.
- Add resident/operator views and role-specific actions.
- Deliver configurable notification templates and asynchronous delivery with retry/dead-letter handling.
- Define service targets and overdue indicators without promising a full workflow engine.
- Add operational metrics for backlog, response, and completion time.

**Demo:** A request progresses from submission through assignment and completion with notifications.

### Sprint 15 — Dashboards and reports

- Deliver occupancy, vacancy, lease expiry, rent roll, aging/collections, payment, and maintenance reports.
- Add bounded filtering, date/timezone semantics, export authorization, and asynchronous large exports.
- Define metric formulas in a reporting glossary and reconcile totals to source transactions.
- Add dashboard freshness and partial-failure indicators.
- Validate accessibility, print/export usability, and pilot decision needs.

**Exit:** M6; named business owners sign off metric definitions and report totals.

### Sprint 16 — Migration rehearsal 1

- Execute a full dry run for both boarding-house and apartment source shapes.
- Validate mappings, duplicate handling, Organization/Property/Unit/Bed relationships, lease conflicts, documents, and rejection CSVs.
- Reconcile opening balances, deposits, credits, charges, payments, and occupancy to pre-agreed tolerances.
- Time every step and test resumability, audit evidence, least-privilege migration access, and rollback.

**Exit:** Rehearsal defects are prioritized; cutover duration and manual workload are measured rather than estimated.

### Sprint 17 — Migration rehearsal 2 and readiness

- Repeat the full migration after fixes using a fresh production-shaped extract.
- Prove idempotent reruns, corrected error paths, checksums, count/financial reconciliation, and business sign-off sampling.
- Train pilot administrators and support staff; publish user guidance and escalation procedures.
- Rehearse go/no-go, rollback, source freeze/read-only, and post-cutover payment-event handling.

**Exit:** M7; both source shapes meet migration, reconciliation, duration, and rollback criteria.

### Sprint 18 — Boarding-house pilot

- Pilot one representative boarding house with optional Bed occupancy and utility workflows.
- Complete a real move-in/move-out, meter cycle, billing run, payment/reconciliation cycle, collection follow-up, and maintenance request.
- Run daily product/finance/support triage and track corrections, latency, delivery, and support demand.

**Exit:** Boarding-house pilot blockers are resolved or have accepted owners and dates.

### Sprint 19 — Apartment-portfolio pilot

- Pilot one representative apartment portfolio at broader Property/Unit scale.
- Repeat financial and operational cycles, including bulk workspaces, saved filters, imports, and exception handling.
- Validate support access, audit evidence, monitoring, alert routing, on-call readiness, and rollback controls.

**Exit:** M8; both pilot cohorts satisfy named business, finance, support, and operational exit criteria.

### Sprint 20 — Dedicated security hardening

- Complete threat-model refresh, authorization and Organization-isolation review, dependency remediation, secure-configuration review, and privacy checks.
- Commission an independent penetration test against the release candidate.
- Exercise backup restore, dependency outage, queue recovery, billing replay, and privileged-support controls.
- Complete manual WCAG 2.2 AA validation for critical workflows.

**Exit:** Penetration-test findings are triaged with severity, owner, due date, and launch disposition.

### Sprint 21 — Pen-test remediation and 10,000-unit gate

- Remediate and independently retest all launch-blocking findings.
- Run production-shaped load tests at 10,000 Units across search, virtualized lists, billing, reconciliation, reports, imports, exports, and worker backlog recovery.
- Tune indexes, queues, rate limits, timeouts, retries, resource limits, and capacity alerts from measurements.
- Publish signed test evidence, residual risks, scaling thresholds, and runbooks.

**Exit:** M9; no unresolved critical/high exploitable finding and the 10,000-unit performance gate passes agreed SLOs.

### Sprint 22 — Production cutover

- Freeze or control source changes according to the migration plan.
- Take verified backups, migrate data, reconcile counts and financial totals, and run smoke tests.
- Enable production access in staged cohorts.
- Monitor errors, latency, queues, payments, billing, database capacity, and support load.
- Run go/no-go checkpoints and execute rollback if thresholds are breached.

**Exit:** M10 candidate release operates within launch thresholds.

### Sprints 23–24 — Stabilization and general availability

- Resolve launch defects by severity and complete outstanding data exceptions.
- Observe at least one production billing/payment/reconciliation cycle before GA.
- Review service indicators, capacity, security events, customer feedback, and support trends.
- Remove temporary migration access and tighten elevated permissions.
- Complete the post-launch review and update runbooks, backlog, forecasts, and ownership.

**Exit:** General availability approved or controlled rollout is extended with an explicit reason and new decision date.

## 6. Critical Dependencies

| Dependency | Needed by | Risk if late | Mitigation |
|---|---:|---|---|
| Role/permission decisions | Sprint 3 | Rework and unsafe defaults | Approve matrix in Sprint 0; deny by default |
| Payment-provider KYC, merchant underwriting, bank verification, and production credentials | Sprint 10 | Payments cannot launch despite completed code | Submit in Sprint 0, track provider SLA weekly, keep sandbox adapter, define manual-payment fallback |
| Representative legacy data | Sprint 5 | Migration surprises | Obtain samples in discovery; profile continuously |
| Monetary, tax, timezone, and numbering policy | Sprint 8 | Incorrect billing model | Named finance owner and decision deadline |
| Lease templates and legal workflow | Sprint 8 | Lease activation blocked | Legal review during Sprints 5–7 |
| Cloud and security baseline | Sprint 1 | Environment/launch delay | Use managed services and infrastructure ownership |
| Email domain and deliverability setup | Sprint 3 | Invitation/notification failure | Configure SPF, DKIM, DMARC early |
| Pilot users and properties | Sprint 5 | Late usability feedback | Schedule recurring reviews from discovery |
| Independent penetration-test vendor/window | Sprint 20 | GA gate slips | Procure and reserve test/retest windows by Sprint 8 |
| Two representative pilot cohorts | Sprint 18 | Product fit and scale risks remain hidden | Contract one boarding house and one apartment portfolio during discovery |
| Support and incident ownership | Sprint 18 | Unsafe launch | Assign owners before pilot |

Dependencies should be tracked in the delivery backlog with an owner, required-by date, current confidence, and fallback.

## 7. Milestone Acceptance

Milestones are accepted only when:

- Demonstrated in the target environment.
- Automated acceptance and Organization-isolation tests pass.
- Relevant product, engineering, design, security, finance, or operations owners approve.
- Documentation, telemetry, migration impact, and support impact are complete.
- Known limitations and follow-up work are recorded.

Schedule progress should be reported by accepted outcomes, not percentage-complete estimates.

## 8. Definition of Ready

A backlog item is ready for sprint commitment when:

- The user/business outcome and target persona are clear.
- Acceptance criteria include happy path, failure behavior, permissions, and Organization scope.
- Designs and content are sufficient for implementation.
- API, event, data, migration, audit, observability, and accessibility impacts are identified.
- Dependencies and external decisions are resolved or have an agreed fallback.
- Test approach and representative data are available.
- Security/privacy classification is known.
- The item is small enough to complete within one sprint or has a safe slicing plan.
- Product, engineering, and quality representatives agree that it is actionable.

Discovery spikes may enter a sprint with a time box, question to answer, and required artifact rather than implementation acceptance criteria.

## 9. Definition of Done

An item is done when:

- Acceptance criteria are met and demonstrated.
- Code follows repository boundaries and coding standards.
- Appropriate unit, component, integration, contract, end-to-end, and Organization-isolation tests pass.
- Authorization is server-enforced and negative cases are covered.
- API/contracts and database migrations are backward-compatible or have an approved rollout plan.
- Required audit events are emitted, asserted in tests, documented, and reviewable; operational logs are not a substitute.
- Logs, metrics, traces, alerts, and runbook changes are implemented where needed.
- Every billing/payment/reconciliation change updates or explicitly validates the billing replay, failed-job retry, reconciliation, and correction runbooks.
- Security, privacy, accessibility, performance, and failure behavior are reviewed proportionately.
- Documentation and user-facing content are updated.
- CI quality gates pass with required reviews.
- The change is deployed to the target non-production environment and smoke-tested.
- No unresolved critical/high defect remains; accepted lower risks have owners and dates.

“Code complete” is not “done.”

## 10. Environment Strategy

### Local

- Developer-owned processes with containerized or managed disposable dependencies.
- Synthetic data only.
- Fast unit/integration feedback and documented setup.

### Test/CI

- Ephemeral, isolated databases and Organization fixtures.
- Automated migrations, contracts, integration, and browser tests.
- No shared mutable state across CI runs.

### Development

- Continuously deployed from the default branch.
- Used for integrated feature validation with synthetic data.
- May be reset with notice.

### Staging

- Production-like topology, security controls, provider sandbox accounts, data volume, and deployment process.
- Release candidates, migration rehearsals, performance tests, recovery drills, and user acceptance.
- Access is restricted and audited; production personal data is not copied without approved masking and controls.

### Pilot/production

- Production controls and monitoring with pilot access constrained by Organization, Property, user, or feature flag.
- Pilot is preferably a controlled cohort in production rather than a permanently divergent environment.
- No direct manual schema changes or untracked configuration.

Environment configuration is validated at startup. Infrastructure changes and application versions are traceable, reviewable, and reproducible.

## 11. Test and Validation Strategy

### Continuous testing

- Unit tests on every pull request.
- React component and accessibility tests on affected surfaces.
- API/repository integration tests against real PostgreSQL and Redis-compatible services.
- Contract compatibility tests for APIs, events, jobs, and generated clients.
- Cross-Organization authorization suites for every Organization-owned capability.
- Critical-path end-to-end tests for invitation, inventory, lease activation, billing, payment, reconciliation, maintenance, and reporting.

### Release testing

- Cross-browser and responsive checks on supported browsers.
- Payment-provider sandbox failure and webhook replay tests.
- Billing determinism, rounding, timezone, retry, and concurrency tests.
- Migration and reconciliation rehearsal with production-shaped data.
- Performance tests at expected launch load, 10,000+ Units, and agreed burst/backlog scenarios.
- Backup/restore, queue recovery, dependency outage, and rollback exercises.
- External penetration test or independent security assessment before general availability.

Quality reporting should emphasize critical journey success, escaped defects, flaky tests, security findings, migration reconciliation, and service indicators—not only coverage percentage.

## 12. Data Migration Plan

### Discover and map

- Inventory each source, owner, format, update frequency, quality issue, and legal constraint.
- Define canonical mappings and stable external identifiers.
- Profile duplicates, invalid dates, missing Organization/Property relationships, conflicting occupancy, and financial imbalance.

### Clean and rehearse

- Clean source data with business-owner approval rather than silently guessing.
- Build idempotent, resumable imports with dry-run, validation, and detailed rejection output.
- Preserve source identifiers and migration batch metadata for traceability.
- Rehearse at least twice for high-risk financial or occupancy migration where schedule allows.

### Reconcile

At minimum compare:

- Organization, property, unit, bed, resident, and lease counts.
- Active occupancy and conflicting allocations.
- Opening balances, charges, payments, credits, deposits, and outstanding totals.
- Status distributions and required document references.
- Random and risk-based record samples signed off by business owners.

Tolerance must be defined before cutover. Financial differences are not accepted merely because aggregate counts match.

### Cut over

- Publish freeze/read-only timing and support communications.
- Capture source and target backups and checksums.
- Run versioned migration, validation, reconciliation, and smoke-test steps.
- Record all manual exceptions and approvers.
- Open access in controlled cohorts after go/no-go approval.

## 13. Pilot and Rollback Strategy

### Pilot design

- Start with one or a small number of representative properties.
- Include real operators across administrator, manager, finance, and maintenance roles.
- Use feature flags and Organization/Property allowlists.
- Establish daily pilot review, support channel, response targets, and decision owners.
- Measure task completion, data corrections, reconciliation, error rates, latency, notification delivery, and support demand.

### Rollback triggers

Examples of immediate stop or rollback conditions:

- Confirmed cross-Organization data exposure or authorization bypass.
- Unexplained financial imbalance, duplicate billing, or payment corruption.
- Migration reconciliation outside approved tolerance.
- Sustained critical-path error or latency above launch threshold.
- Inability to restore service or data within approved recovery objectives.
- Material provider failure without a safe degraded mode.

### Rollback mechanics

- Keep schema changes backward-compatible across the release window.
- Retain source snapshots and define whether the legacy system remains read-only or resumes writes.
- Record post-cutover writes and payment events so they can be replayed or reconciled.
- Disable affected capabilities with feature flags where partial rollback is safer.
- Roll back the application only when the deployed schema remains compatible; otherwise execute the approved forward-fix plan.
- Communicate status, data implications, and next checkpoint to users and stakeholders.

A rollback decision owner and time limit are named before cutover. Rollback is rehearsed, not just documented.

## 14. Production Launch Gates

General availability requires explicit sign-off against the following:

### Product and operations

- MVP critical journeys accepted by named business owners.
- Pilot exit criteria met and launch-blocking feedback resolved.
- User guidance, training, support process, incident ownership, and status communication ready.

### Security and privacy

- No unresolved critical or high exploitable security findings.
- Organization-isolation and authorization matrix tests pass.
- Secrets, encryption, audit, retention, data export/deletion, and privileged support access reviewed.
- Penetration-test findings have approved disposition.

### Data and finance

- Migration rehearsed and production reconciliation procedure approved.
- Billing/payment parallel results meet documented tolerance.
- Idempotency, webhook replay, refunds/reversals, and exception queues verified.

### Reliability and scale

- Performance targets pass at production-shaped volume and agreed peaks.
- Backup restoration and recovery objectives are demonstrated.
- Queue retry/dead-letter, dependency outage, and backlog recovery are tested.
- Capacity thresholds and scaling procedures are documented.

### Delivery and observability

- Production infrastructure, deployment, rollback, feature flags, and configuration are reproducible.
- Dashboards, alerts, traces, audit records, and runbooks are active and tested.
- On-call contacts and escalation paths are confirmed.
- Release artifacts pass CI, vulnerability, license, secret, and container scans.

Any waived gate requires written risk acceptance, compensating controls, an accountable owner, and expiry date. Organization isolation, financial integrity, recoverability, and critical security findings are not normal waiver candidates.

## 15. Initial Service and Performance Targets

Targets must be validated during discovery and load testing. Reasonable starting objectives are:

- Monthly API availability target: 99.9% after general availability, excluding communicated maintenance.
- Typical interactive read API: p95 below 500 ms under agreed normal load.
- Typical interactive write API: p95 below 800 ms, excluding provider-dependent operations.
- Critical queued jobs begin processing within 60 seconds under normal load.
- Recovery point objective: 15 minutes or better for primary transactional data.
- Recovery time objective: 4 hours or better for a major recoverable incident.
- Zero tolerance for cross-Organization data exposure and unexplained financial imbalance.

These are planning targets, not contractual service-level agreements. They require infrastructure cost, operational coverage, and measurement agreement.

## 16. Staffing Assumptions

The schedule assumes approximately:

- 1 product manager/product owner with direct decision authority.
- 1 engineering lead/architect who also contributes code.
- 2 backend engineers, including a named senior owner for billing/payments.
- 2 frontend engineers.
- 1 full-stack engineer focused on vertical integration and operational workspaces.
- 1 QA/quality engineer focused on automation, exploratory testing, accessibility, migration, and financial reconciliation.
- 0.5 product designer/researcher.
- 0.5 DevOps/platform engineer from inception, increasing near migration, pilot, and launch.
- 0.25–0.5 security/privacy specialist during threat modeling and hardening.
- 0.25–0.5 finance/accounting SME advisor throughout billing design, parallel runs, migration reconciliation, and launch approval.
- Part-time property-operations, legal/compliance, support, and data-migration subject matter experts.

This is roughly eight to ten full-time-equivalent contributors plus part-time specialists. The product owner, backend, frontend, full-stack, QA, part-time DevOps, and finance-SME roles are minimum planning inputs, not optional hats assumed to be absorbed invisibly. A smaller team can deliver only by extending the schedule or narrowing MVP.

Recommended ownership:

- Identity/Organization-boundary and security controls: engineering lead plus security reviewer.
- Inventory/resident/lease: product domain lead and feature engineers.
- Billing/payment: named senior engineer plus finance owner.
- Platform/reliability: platform owner.
- Migration: dedicated technical owner plus business data owner.
- Pilot and launch: product owner, engineering lead, support lead, and incident commander.

## 17. Principal Risks and Responses

### Organization data leakage

**Risk:** Missing scope in a query, cache, job, export, or object key exposes another Organization's data.  
**Response:** Mandatory Organization context, repository enforcement, compound constraints, negative cross-Organization tests, code ownership, audit, and security review.

### Financial correctness

**Risk:** Rounding, retries, concurrency, timezone rules, or webhook duplication corrupt balances.  
**Response:** Explicit monetary policy, immutable ledger concepts, idempotency, transactional updates, reconciliation, parallel runs, and finance sign-off.

### Legacy data quality

**Risk:** Invalid or inconsistent source data delays pilot or produces unsafe occupancy/balances.  
**Response:** Early profiling, business-owned cleansing, repeatable dry runs, exception reports, and pre-agreed tolerances.

### Scope expansion

**Risk:** Accounting, customization, integrations, or multi-country needs turn MVP into a broad platform.  
**Response:** Product charter, explicit deferred scope, milestone-based prioritization, and change impact assessment.

### External-provider lead time or failure

**Risk:** Payment-provider KYC/underwriting, local payment-method certification, email, identity, or cloud onboarding blocks critical paths; sandbox success does not imply production approval.  
**Response:** Start onboarding in Sprint 0, assign a commercial owner, track production-credential lead time separately from engineering, isolate adapters, and define manual/degraded modes.

### Utility allocation disputes

**Risk:** Shared meters, estimated readings, vacant-period usage, common-area allocation, rounding, and corrected readings cause resident disputes and retroactive billing changes; this complexity is commonly underestimated.  
**Response:** Finance-approved allocation policies, versioned formulas, meter evidence, previews, dispute pause workflow, correction/reversal handling, and pilot scenarios across both property types.

### Local payment methods

**Risk:** Bank transfer references, cash controls, asynchronous wallets, settlement files, fees, and provider-specific reversals do not fit a card-only model.  
**Response:** Confirm launch-country methods in discovery, model provider-neutral payment/settlement states, retain unallocated credits, and test real reconciliation artifacts before scope lock.

### Deposit law variance

**Risk:** Deposit custody, permitted deductions, interest, deadlines, evidence, notices, and refund rules vary by jurisdiction and may invalidate a generic move-out flow.  
**Response:** Restrict MVP to named jurisdictions, obtain legal review, version policy by Property/jurisdiction, preserve evidence, and block unsupported configurations.

### Performance at portfolio scale

**Risk:** Lists, reports, billing, and exports degrade near 10,000 Units.  
**Response:** Bounded APIs, production-shaped datasets, indexes, asynchronous exports, worker controls, load tests, and query telemetry.

### Insufficient operational readiness

**Risk:** The team can deploy but cannot detect, diagnose, recover, or support incidents.  
**Response:** Service ownership, runbooks, alerts, restore/rollback drills, support training, and controlled rollout.

### Team capacity and knowledge concentration

**Risk:** Critical billing, Organization-boundary, or infrastructure knowledge rests with one person.  
**Response:** Paired design/review, ADRs, runbooks, rotation, cross-training, and realistic work-in-progress limits.

## 18. Post-Launch Roadmap

Priorities after stabilization should be driven by usage, support data, commercial strategy, and measured operational constraints.

### Horizon 1 — Stabilize and optimize (0–3 months)

- Resolve recurring support and usability issues.
- Improve query, queue, export, and billing-run performance from production evidence.
- Expand operational dashboards, audit search, and support tooling.
- Automate additional reconciliation and data-quality checks.
- Strengthen disaster recovery and conduct another restore exercise.
- Improve onboarding, import templates, help content, and in-product guidance.

### Horizon 2 — Commercial depth (3–6 months)

- Payment plans, promise-to-pay schedules, and plan-aware collections.
- E-signature integration and signed-document evidence.
- SMS delivery with jurisdiction-appropriate consent, opt-out, and template controls.
- Owner statements and owner-facing reporting.
- Additional payment methods and configurable fee/late-charge policies.
- Vendor management, maintenance scheduling, and service-level workflows.
- Resident self-service enhancements and notification preferences.
- Configurable lease/document templates.
- Expanded finance exports and accounting-system integration.
- Portfolio-level roles, approvals, and richer operational reporting.

### Horizon 3 — Scale and ecosystem (6–12 months)

- Public API/webhooks and integration governance.
- Multi-entity, multi-currency, localization, and jurisdiction-specific capabilities where commercially justified.
- Advanced analytics, forecasting, and warehouse/BI integration.
- Utility, access-control, listing, or IoT integrations.
- Data lifecycle automation and enterprise compliance controls.
- Evaluate module extraction only from measured scaling, security, ownership, or deployment needs.

### Continuous roadmap inputs

- Activation and onboarding completion.
- Unit/bed growth and active organization count.
- Collection rate, reconciliation exceptions, and billing run duration.
- Occupancy and lease workflow completion.
- Maintenance response/completion trends.
- Support volume and top issue categories.
- Availability, latency, queue age, and incident trends.
- Security findings and audit requirements.
- Customer retention, expansion, and requested integrations.

Quarterly planning should revisit assumptions, capacity, architecture fitness, and deferred scope. The roadmap is updated from evidence; the modular monolith remains the default until extraction criteria are demonstrably met.
