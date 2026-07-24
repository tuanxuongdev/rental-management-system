# Permission System

## 1. Purpose

This document defines authorization for the multi-tenant Rental Property Management SaaS. It combines role-based access control (RBAC), explicit resource scopes, deny-by-default evaluation, separation of duties, and auditability.

An **organization** is the tenant boundary. A **Property Owner** is a business Party holding an effective ownership interest in a Property; that interest does not itself create a User account or permission. A **property** contains units and, where applicable, beds. An **occupant/resident** is a person living in a unit or bed. A **lease** is the contractual occupancy agreement. These terms must not be used interchangeably in permissions or user interfaces.

Authentication and session security are defined in [05-authentication.md](./05-authentication.md).

## 2. Authorization principles

- Deny by default.
- Grant only explicit permissions through an active role assignment or a narrowly reviewed resource-ownership rule such as resident self-service. Property ownership records and Management Agreements never grant application access by themselves.
- Evaluate both action and scope; a permission without the required scope never authorizes access.
- Treat the organization as the mandatory tenant boundary for all organization-owned records.
- Enforce authorization in the NestJS backend and PostgreSQL access path, not only in React routing or controls.
- Use one policy-evaluation model across REST endpoints, jobs, exports, WebSockets, and background processing.
- Prefer named, granular permissions over checks against role names.
- Prevent privilege escalation through role-management constraints.
- Reevaluate membership and high-risk permissions against server-side state.
- Audit sensitive reads, exports, mutations, role changes, and denied privileged actions.

## 3. Canonical roles

### 3.1 Platform Administrator

Operates the SaaS platform across organizations for system health, provisioning, compliance, and controlled support. This is a platform-scoped role, not an implicit organization role. Access to organization data requires an explicit, time-bound support-access workflow and audit trail.

### 3.2 Organization Owner

Holds ultimate administrative control for one organization, including ownership transfer, organization security settings, and administrator appointment. Each organization must have at least one active owner.

### 3.3 Organization Administrator

Manages organization configuration, users, properties, and operational settings, subject to owner-only restrictions and separation-of-duties policy.

### 3.4 Property Manager

Runs assigned properties, including units, residents, leases, collections visibility, maintenance coordination, and operational reporting. Scope is normally limited to assigned properties.

### 3.5 Accountant

Manages charges, invoices, payments, deposits, reconciliation, financial reporting, and controlled exports. It does not inherently grant user administration or property-configuration rights.

### 3.6 Maintenance Staff

Views and updates assigned maintenance work and the minimum resident/contact information needed to complete it. It does not grant access to leases, broad financial data, or unrelated resident records.

### 3.7 Read-only Auditor

Views approved organization, property, lease, financial, and audit information without mutation rights. Export remains a separate permission and may be disabled.

### 3.8 Resident/Tenant

Uses self-service capabilities for the resident's own profile, household context where explicitly linked, active and historical leases, balances, payments, notices, documents, and maintenance requests. “Tenant” in this role label refers to a resident contracting party; **organization** remains the SaaS tenant boundary.

## 4. Scope model

Every authorization decision uses one of four scopes.

### 4.1 Platform scope

Applies to platform-owned resources such as organization provisioning, global feature flags, platform security, service health, and controlled support access. Platform scope never implies unrestricted organization-data access.

### 4.2 Organization scope

Applies across one organization. The request and resource must have the same `tenant_id`/organization identifier as the active authorization context.

### 4.3 Property scope

Applies only to explicitly assigned properties inside the active organization. Property assignments are additive but cannot cross organizations. Child resources such as units, beds, leases, payments, and work orders inherit property scope through validated relationships.

### 4.4 Self scope

Applies to the authenticated identity's own profile or resident-linked resources. Self scope is relationship-based, not based on client-supplied IDs. A resident can access a lease only when the server establishes that the authenticated identity is an authorized party or permitted household member for that lease.

### 4.5 Scope precedence

Broader scope does not bypass tenant isolation or explicit denies. Platform scope and organization scope are different authorities rather than a simple hierarchy. Property scope must resolve to a property inside the active organization. Self scope grants only the explicitly modeled relationship.

## 5. Permission naming and catalog

Permission keys use:

`<domain>.<resource>.<action>`

Actions should be precise: `view`, `list`, `create`, `update`, `delete`, `approve`, `assign`, `export`, `refund`, `close`, or another reviewed business verb. Avoid vague permissions such as `manage_all`.

### 5.1 Platform

- `platform.organizations.list`
- `platform.organizations.view`
- `platform.organizations.create`
- `platform.organizations.suspend`
- `platform.organizations.restore`
- `platform.support_access.request`
- `platform.support_access.approve`
- `platform.support_access.use`
- `support.elevate`
- `platform.security.view`
- `platform.audit.view`
- `platform.feature_flags.update`
- `platform.system_settings.update`

### 5.2 Organization and membership

- `organization.profile.view`
- `organization.profile.update`
- `organization.security.view`
- `organization.security.update`
- `organization.billing.view`
- `organization.billing.update`
- `organization.ownership.transfer`
- `organization.delete`
- `members.list`
- `members.view`
- `members.invite`
- `members.update`
- `members.suspend`
- `members.remove`
- `members.sessions.revoke`
- `roles.list`
- `roles.view`
- `roles.create`
- `roles.update`
- `roles.delete`
- `members.roles.assign`

### 5.3 Property ownership, management, and inventory

- `property_owners.list`
- `property_owners.view`
- `property_owners.create`
- `property_owners.update`
- `property_ownerships.view`
- `property_ownerships.create`
- `property_ownerships.end`
- `management_agreements.list`
- `management_agreements.view`
- `management_agreements.create`
- `management_agreements.update`
- `management_agreements.activate`
- `management_agreements.terminate`
- `properties.list`
- `properties.view`
- `properties.create`
- `properties.update`
- `properties.archive`
- `properties.assign_staff`
- `units.list`
- `units.view`
- `units.create`
- `units.update`
- `units.archive`
- `beds.list`
- `beds.view`
- `beds.create`
- `beds.update`
- `beds.archive`
- `occupancy.view`

### 5.4 Residents and leases

- `residents.list`
- `residents.view`
- `residents.create`
- `residents.update`
- `residents.archive`
- `residents.sensitive_data.view`
- `residents.documents.view`
- `residents.documents.upload`
- `residents.documents.delete`
- `leases.list`
- `leases.view`
- `leases.create`
- `leases.update`
- `leases.approve`
- `leases.activate`
- `leases.override_do_not_rent`
- `leases.move_in`
- `leases.renew`
- `leases.transfer`
- `leases.move_out`
- `leases.terminate`
- `assets.keys.manage`
- `leases.documents.view`
- `leases.documents.generate`
- `leases.documents.sign`

### 5.5 Finance

- `finance.charges.list`
- `finance.charges.view`
- `finance.charges.create`
- `finance.charges.update`
- `finance.charges.void`
- `finance.invoices.list`
- `finance.invoices.view`
- `finance.invoices.issue`
- `finance.payments.list`
- `finance.payments.view`
- `finance.payments.record`
- `finance.payments.allocate`
- `finance.payments.refund`
- `finance.payments.refund.approve`
- `finance.payments.refund.execute`
- `finance.deposits.view`
- `finance.deposits.record`
- `finance.deposits.release`
- `finance.deposits.disposition`
- `finance.deposits.disposition.approve`
- `finance.deposits.disposition.execute`
- `finance.payment_plans.list`
- `finance.payment_plans.view`
- `finance.payment_plans.create`
- `finance.payment_plans.update`
- `finance.payment_plans.approve`
- `finance.late_fees.view`
- `finance.late_fees.run`
- `finance.late_fees.waive`
- `finance.write_offs.view`
- `finance.write_offs.request`
- `finance.write_offs.approve`
- `finance.write_offs.execute`
- `finance.reconciliation.view`
- `finance.reconciliation.perform`
- `finance.reconciliation.approve`
- `finance.reports.view`
- `finance.exports.create`

### 5.6 Maintenance and operations

- `maintenance.requests.list`
- `maintenance.requests.view`
- `maintenance.requests.create`
- `maintenance.requests.update`
- `maintenance.requests.assign`
- `maintenance.requests.close`
- `maintenance.work_orders.view`
- `maintenance.work_orders.update`
- `maintenance.attachments.view`
- `maintenance.attachments.upload`
- `maintenance.costs.view`
- `maintenance.costs.update`
- `inspections.list`
- `inspections.view`
- `inspections.create`
- `inspections.complete`
- `meters.list`
- `meters.view`
- `meters.create`
- `meters.update`
- `meters.readings.record`
- `meters.readings.correct`
- `meters.readings.bulk`
- `utilities.tariffs.view`
- `utilities.tariffs.create`
- `utilities.tariffs.update`
- `utilities.usage.view`
- `utilities.billing.run`
- `imports.list`
- `imports.view`
- `imports.create`
- `imports.validate`
- `imports.commit`
- `assets.list`
- `assets.view`
- `assets.create`
- `assets.update`
- `assets.checkout`
- `assets.return`
- `waitlist.list`
- `waitlist.view`
- `waitlist.create`
- `waitlist.update`
- `waitlist.offer`
- `waitlist.remove`
- `arrears.list`
- `arrears.view`
- `arrears.actions.create`
- `arrears.actions.complete`
- `arrears.escalate`
- `legal_holds.list`
- `legal_holds.view`
- `legal_holds.create`
- `legal_holds.release`

### 5.7 Communications and documents

- `communications.notices.list`
- `communications.notices.view`
- `communications.notices.create`
- `communications.notices.send`
- `communications.templates.update`
- `documents.list`
- `documents.view`
- `documents.upload`
- `documents.delete`

### 5.8 Reporting, exports, and audit

- `reports.operational.view`
- `reports.occupancy.view`
- `reports.financial.view`
- `reports.resident.view`
- `exports.personal_data.create`
- `exports.bulk.create`
- `audit.events.view`
- `audit.events.export`

### 5.9 Self-service

- `self.profile.view`
- `self.profile.update`
- `self.leases.view`
- `self.documents.view`
- `self.balance.view`
- `self.payments.view`
- `self.payments.create`
- `self.maintenance.create`
- `self.maintenance.view`
- `self.maintenance.update`
- `self.notices.view`

The catalog is version-controlled. Adding or broadening a permission requires security and product review, migration impact analysis, role-default updates, and authorization tests.

`support.elevate` is platform-only even though its key omits the `platform.` prefix; organization roles and custom roles can never contain it.

## 6. Default role matrix

Legend: **P** = platform scope, **O** = organization scope, **A** = assigned-property scope, **S** = self scope, **R** = restricted or approval-dependent, and **—** = not granted by default.

| Capability | Platform Admin | Org Owner | Org Admin | Property Manager | Accountant | Maintenance | Auditor | Resident |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Platform operations | P | — | — | — | — | — | — | — |
| Support access to organization data | R | — | — | — | — | — | — | — |
| Organization profile | — | O | O | View A | View O | — | View O | — |
| Ownership transfer/deletion | — | O | — | — | — | — | — | — |
| Security settings | — | O | O, restricted | — | — | — | View O | — |
| Member invitations and lifecycle | — | O | O | — | — | — | View O | — |
| Role creation and assignment | — | O | O, constrained | — | — | — | View O | — |
| Property owners and ownership history | — | O | O | View A | View O | — | View O | — |
| Management Agreements | — | O | O, restricted | View A | View O | — | View O | — |
| Property configuration | — | O | O | A | — | — | View O | — |
| Units, beds, and occupancy | — | O | O | A | View O | Limited A | View O | — |
| Resident records | — | O | O | A | Limited O | Minimal A | View O | S |
| Lease lifecycle | — | O | O | A | View O | — | View O | View S |
| Charges and invoices | — | O | O | A, limited | O | — | View O | View S |
| Record payments | — | O | O | A, optional | O | — | View O | Pay S |
| Refunds and deposit release | — | O, R | R | — | O, R | — | View O | — |
| Reconciliation | — | View O | View O | — | O | — | View O | — |
| Maintenance requests | — | O | O | A | Assigned A | Assigned A | View O | S |
| Operational reports | — | O | O | A | View O | Limited A | View O | — |
| Financial reports | — | O | O | A, summary | O | — | View O | — |
| Bulk/personal-data exports | — | O, R | R | R, A | R, O | — | R | Self download only |
| Audit events | P | O | O | Limited A | Limited O | — | O | Own security events |

The matrix describes default role templates, not endpoint logic. Enforcement always uses granular permissions and scope.

The Property Manager template never includes unrestricted `finance.payments.refund`, `finance.write_offs.*`, or deposit disposition/release execution. Any property-level financial exception is an explicit, bounded grant with amount limits and approval policy; it is not inherited from operational collection visibility.

## 7. Custom roles

Organization owners and authorized organization administrators can create organization-specific custom roles.

Constraints:

- A custom role is owned by exactly one organization.
- It contains reviewed permission keys and an allowed maximum scope.
- It cannot include platform permissions.
- It cannot grant ownership transfer, organization deletion, or other owner-only actions.
- The creator can grant only permissions they possess and are allowed to delegate.
- An administrator cannot assign a role at a broader scope than their own.
- Unless the acting and assigned principal is an Organization Owner, a custom role or combined role set must not contain all three of `members.roles.assign`, `organization.security.update`, and `finance.payments.refund`. Validation evaluates effective permissions across all assignments, so splitting the keys across roles does not bypass the rule.
- System roles may be cloned but not edited in place.
- Permission removal takes effect promptly for active sessions.
- Deleting a role requires all assignments to be removed or migrated.
- Role changes show an impact preview and are audited with before/after values.

The UI groups permissions by domain and warns about combinations involving personal data, financial control, role management, bulk export, or audit access.

## 8. Role assignments

A role assignment links:

- An active user membership.
- One organization.
- One system or custom role.
- A scope type and, for property scope, one or more explicit property IDs.
- Effective and optional expiration timestamps.
- Assigning actor and approval information.

All referenced properties must belong to the assignment's organization. Expired, suspended, or deleted assignments grant nothing. Temporary elevated access must expire automatically.

Residents receive self-service entitlements through verified identity-to-resident relationships and lease participation, not through property-staff assignments. Shared occupancy alone does not authorize access to another resident's profile, documents, payments, communications, or obligations. Such access requires an explicit, active household/guardian relationship that names the permitted resource classes and is enforced server-side; client-supplied resident, lease, unit, or bed IDs cannot broaden self scope.

## 9. Authorization evaluation

For every protected operation, the backend evaluates:

1. **Authentication:** Is the access token valid for this issuer, audience, session, and time?
2. **Tenant context:** Does the token contain one active `org_id` when organization data is involved?
3. **Principal state:** Are the identity, session, membership, and required assignments active?
4. **Explicit deny:** Does any applicable platform, organization, assignment, resource, legal-hold, or risk policy deny the action? A deny ends evaluation and overrides every allow, including ownership.
5. **Permission allow:** Does an effective role or reviewed ownership rule grant the exact action? Multiple allows may be unioned only after deny evaluation.
6. **Scope:** Does the target resource fall within platform, organization, assigned-property, or self scope?
7. **Resource state:** Is the action valid for the resource's lifecycle state?
8. **Constraints:** Are separation-of-duties, step-up authentication, approval, export, and data-classification rules satisfied?
9. **Decision:** Permit only if every required check succeeds; otherwise deny with a stable reason code. Absence of an allow is a deny.
10. **Audit:** Record the action when policy requires it, including material denials.

Policy checks must occur before returning resource existence details. APIs should generally return `404` instead of `403` when revealing the resource would disclose cross-tenant information.

### 9.1 Server implementation boundaries

- NestJS guards establish authenticated principal and active organization context.
- Policy services evaluate named permissions and scopes.
- Service-layer methods enforce business-state and relationship constraints.
- Prisma queries include trusted organization predicates.
- PostgreSQL row isolation provides defense in depth.
- React uses authorization metadata only to shape navigation and controls; it is not an enforcement boundary.

Direct object references from clients are untrusted. Parent-child ownership, such as a lease's property or a resident's organization, must be resolved server-side.

Authorization caches include organization, membership, assignment/version, scope, and policy version in their keys. Role, assignment, membership, explicit-deny, or security-policy changes publish invalidation immediately. If invalidation delivery fails, cache TTL must be no longer than the access-token TTL; high-risk actions recheck authoritative state. Therefore stale authorization can never remain effective beyond the current access-token lifetime, and revocation-sensitive actions may require faster server-side checks.

## 10. Multi-tenant isolation

### 10.1 Data model

All organization-owned tables include a non-null `tenant_id` that references the organization boundary. Child records either carry `tenant_id` directly or use a reviewed pattern that makes tenant filtering equally explicit; direct `tenant_id` is preferred for security, indexing, and operational clarity.

Required controls:

- Composite uniqueness includes `tenant_id` where identifiers are organization-local.
- Foreign keys prevent relationships across tenants.
- Frequently queried tenant predicates have appropriate indexes.
- Prisma repositories require an explicit tenant context.
- Raw SQL requires security review and tenant-isolation tests.
- Redis keys, S3 object prefixes, queues, search indexes, and cache entries include trusted tenant context.
- Signed S3 URLs are created only after authorization and expire quickly.

### 10.2 PostgreSQL row isolation

PostgreSQL Row-Level Security or an equivalent reviewed row-isolation layer enforces `tenant_id` using a transaction-local, server-established tenant context.

- Application roles cannot bypass row isolation.
- Missing tenant context returns no tenant rows or fails closed.
- Administrative migrations and background jobs use separately controlled database roles.
- Connection pooling must not leak tenant state; set context transaction-locally and clear it deterministically.
- Platform support access uses an explicit audited path, not routine RLS bypass.

### 10.3 Cross-tenant operations

Cross-organization analytics, support, or billing operations run through platform services with dedicated permissions and data-minimization rules. They must not reuse ordinary organization endpoints with a wildcard tenant.

## 11. Separation of duties

High-risk workflows must prevent one person from unilaterally creating and completing incompatible actions where organization size and policy support dual control.

Recommended controls:

- The requester of a large refund cannot approve it.
- When dual control is enabled, no identity may both approve and execute the same high-value refund, write-off, or deposit release/disposition, regardless of how many roles that identity holds. Request, approval, and execution identities are recorded, and configured thresholds cannot be bypassed by splitting one transaction into related smaller actions.
- Reconciliation preparer and approver are different identities.
- Organization ownership transfer requires current-owner confirmation and recent MFA.
- A user cannot assign themselves permissions they do not already hold or are not authorized to delegate.
- Platform support-access requester and approver are different identities for sensitive cases.
- Audit records cannot be modified or deleted by operational roles.
- Export approval is separate from export execution above configured thresholds.
- MFA or SSO recovery for privileged users requires a separate authorized operator.

Thresholds and dual-approval requirements are organization-configurable only within platform-defined minimum security constraints.

## 12. High-risk permissions

The following require additional controls:

- Organization ownership transfer or deletion.
- Platform support access.
- Role creation and assignment involving privileged permissions.
- Viewing sensitive resident identity data.
- Bulk and personal-data exports.
- Refunds, deposit releases, write-offs, and reconciliation approval.
- Audit export.
- Security, SSO, MFA-enforcement, and billing changes.

Controls can include recent authentication, MFA, justification, approval, transaction limits, time-bounded grants, notifications, and enhanced audit records.

Export of personally identifiable information always requires step-up authentication and a non-empty, allowlisted or reviewed audit purpose. The export record captures purpose, actor, organization, filters/scope, approval where required, row/file classification, expiry, and download events. Possessing `exports.personal_data.create` alone does not satisfy step-up or purpose requirements.

## 13. Background jobs, integrations, and impersonation

### 13.1 Background jobs

Jobs carry explicit organization and initiating-principal context. Workers verify that the job's tenant matches every loaded resource. Jobs never infer tenant from an arbitrary record supplied by the client.

### 13.2 Integrations

API clients and integrations receive narrowly scoped service permissions, organization restrictions, credential expiry/rotation, and distinct audit identities. Human role permissions are not copied automatically to service credentials.

### 13.3 Support access and impersonation

Support access is not silent impersonation. It requires:

- A platform permission.
- A reason and support case reference.
- An approved target organization and time window.
- Optional organization approval according to policy.
- A visible support-access indicator.
- Prohibition on owner-only and selected financial/security actions.
- Complete audit records identifying the platform actor and affected organization.

## 14. Audit requirements

Audit:

- Role and custom-role creation, update, deletion, and assignment.
- Membership invitation, suspension, removal, and session revocation.
- Permission evaluation for high-risk actions and material denials.
- Sensitive resident and lease record access where required by policy.
- Bulk exports and signed document downloads.
- Financial approvals, refunds, releases, and reconciliation.
- Platform support-access lifecycle.
- Tenant-isolation policy or database-policy changes.

Each event includes actor, effective principal, organization, scope, target resource, permission, decision, reason code, request correlation ID, timestamp, source context, and before/after values where relevant. Logs must be tamper-evident, access-controlled, retained according to policy, and excluded from ordinary mutation paths.

## 15. UI behavior

- Hide unavailable navigation and actions to reduce confusion.
- Disable conditionally unavailable actions with an explanation when discoverability matters.
- Never rely on hidden or disabled controls for enforcement.
- Explain scope, such as “Assigned properties,” near role assignments.
- Show a permission-impact summary before saving role changes.
- Require explicit confirmation and step-up authentication for high-risk changes.
- Handle server authorization denials gracefully when permissions change during a session.

## 16. Testing strategy

### 16.1 Unit and policy tests

- Every permission has allow and deny tests.
- Scope tests cover platform, organization, assigned property, unrelated property, and self.
- Deny-by-default tests cover unknown permissions and missing context.
- Custom-role constraints and delegation limits are tested.
- Resource lifecycle and separation-of-duties rules are tested.

### 16.2 Integration tests

- Every protected endpoint is tested without authentication, with wrong audience, wrong organization, insufficient permission, and out-of-scope resource.
- Prisma and database tests prove tenant predicates and row isolation.
- Redis, S3, exports, queues, and background jobs are tested for cross-tenant leakage.
- Revoked memberships and changed permissions are tested against active sessions.

### 16.3 Matrix and regression tests

Generate regression cases from the canonical role templates and permission catalog. Each release must detect:

- Newly added endpoints without policy declarations.
- Permissions absent from the catalog.
- Roles accidentally broadened.
- Tenant-owned models lacking isolation requirements.
- Raw queries without tenant-security review.

### 16.4 Adversarial tests

Test horizontal and vertical privilege escalation, identifier substitution, nested-resource mismatches, mass assignment, stale tokens, cache-key collisions, export leakage, support-access abuse, and connection-pool tenant-context leakage.

## 17. Operational governance

- Permission catalog changes require code review by domain and security owners.
- Default-role changes include a migration and customer-impact note.
- Organizations receive a readable role and access report.
- Privileged and dormant assignments are reviewed periodically.
- Emergency access is time-limited, monitored, and reviewed after use.
- Authorization metrics track denials and anomalies without exposing sensitive resource data.

## 18. Acceptance criteria

- No request can access an organization-owned row without a trusted organization context.
- A property-scoped user cannot access another property by changing an identifier.
- A platform administrator has no implicit organization-data access.
- A resident can access only self-linked resident and lease resources.
- A custom role cannot grant platform or owner-only permissions.
- High-risk role, export, and financial actions enforce configured step-up and approval controls.
- Authorization remains effective in APIs, jobs, caches, S3 access, and database queries.
- Every role or permission change and sensitive privileged action is attributable in the audit trail.
