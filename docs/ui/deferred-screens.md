# Deferred Screen Inventory

**Status:** Backlog — not yet individually specified  
**Purpose:** Track screens and workspaces referenced in product, architecture, API, or security documentation that do not yet have a dedicated file under `docs/ui/`.  
**Normative references:** [Business Requirements](../01-business-requirements.md) · [Development Roadmap](../10-development-roadmap.md) · [Cross-Cutting Patterns](./cross-cutting-patterns.md)

Screens listed here **must follow** [`_template.md`](./_template.md) when promoted to implementation-ready specifications. Until then, related behavior may be partially covered by adjacent screens or [cross-cutting-patterns.md](./cross-cutting-patterns.md).

---

## Scope resolution notes

The following items appear in business requirements but are **deferred or phased** in roadmap/overview. UI must not silently omit them from information architecture planning.

| Topic | Business intent | Current UI stance | Target phase |
|---|---|---|---|
| Resident portal | Self-service for leases, payments, maintenance | **Specified** — `resident-portal/*` | MVP |
| Move-in / move-out | Operational checkout workflows | **Specified** — `leasing/move-in.md`, `leasing/move-out-checkout.md` | MVP (ops); portal visibility Phase 2+ |
| Two-way messaging | Resident ↔ staff conversations | **Deferred** — notices are outbound-only today | Phase 2 |
| Online applications | Pre-lease application pipeline | **Deferred** | Phase 2 |
| Enterprise SSO/SCIM | Federated workforce access | **Deferred** — break-glass paths required before enforcement | Phase 2+ |
| Owner distribution / trust accounting | Payouts to property owners | **Explicitly out of scope** — ownership tables support attribution only | Post-MVP / separate product decision |

---

## Deferred screens by domain

### Administration and security

| Screen | Description | Why deferred | Planned IA location | Depends on |
|---|---|---|---|---|
| **Security settings** | Organization MFA enforcement, password policy, session lifetime, IP allowlists | Partially implied by `organization-settings.md`; needs dedicated security tab spec | Administration → Security | Auth policy API |
| **SSO configuration** | OIDC/SAML IdP setup, domain verification, JIT mapping | Enterprise Phase 2+ | Administration → Security → SSO | SSO roadmap |
| **Session management (staff)** | List/revoke devices and sessions for self or administered users | Mentioned in `user-detail.md`; no standalone spec | Administration → Users → Sessions; Profile menu | Session API |
| **MFA enrollment** | TOTP setup, recovery codes, factor removal | Challenge specified; enrollment wizard not | Auth + Profile/Security | MFA enrollment API |
| **Retention settings** | Legal hold, archive, purge policies | Referenced in architecture | Administration → Retention | Retention policy API |
| **Organization subscription / SaaS billing** | Plan, usage, invoices to the SaaS vendor, payment method | Platform commercial model; distinct from resident invoicing | Administration → Billing (SaaS) | Platform billing integration |
| **Approval inbox** | Dual-control queue: refunds, write-offs, deposit releases, exports, billing runs | Workflows referenced in finance screens; no unified inbox | Home exception + Administration → Approvals | Approval workflow API |

### Portfolio and inventory

| Screen | Description | Why deferred | Planned IA location | Depends on |
|---|---|---|---|---|
| **Inventory holds** | Soft holds on units/beds with expiry | Business rules specify holds vs reservations | Portfolio → Availability → Holds | Holds API |
| **Hard reservations** | Commitment-level reservations distinct from holds | Same | Portfolio → Availability → Reservations | Reservations API |
| **Portfolio map** | Geographic portfolio view | Optional enhancement | Portfolio → Map | Geocoding |
| **Property comparison** | Side-by-side property metrics | Optional enhancement | Portfolio → Compare | Read models |
| **Staff assignments** | Property/unit staff roster | Implied in property detail | Portfolio → Property → Staff | Assignments API |
| **Assets and keys** | Key checkout, asset tracking at move-in/out | Business requirements; partial in move-in/out | Operations → Assets | Assets API |

### Leasing and residents

| Screen | Description | Why deferred | Planned IA location | Depends on |
|---|---|---|---|---|
| **Applications pipeline** | Pre-lease applications, screening status | Phase 2 leasing | Leasing → Applications | Applications API |
| **Application detail** | Documents, screening, decision | Phase 2 | Leasing → Applications → Detail | Applications API |
| **Screening / do-not-rent workspace** | Governed flags with privacy constraints | Partially in resident detail; needs workspace | Residents → Screening | Screening flags API |
| **Guarantor workflow** | Guarantor invitation and linkage | Business requirement | Leasing → Parties / Applications | Guarantor API |
| **Charges list** | Pre-invoice charges ledger | Invoices specified; charges list not | Finance → Charges | Charges API |
| **Late fee run workspace** | Preview, cap, idempotent late-fee batch | Related to billing run | Finance → Late fees | Late-fee API |
| **Refunds list / refund request** | Refund lifecycle with dual control | Payment detail partial | Finance → Refunds | Refunds API |
| **Write-offs workspace** | Approved write-off execution | Arrears partial | Finance → Write-offs | Write-offs API |

### Communications

| Screen | Description | Why deferred | Planned IA location | Depends on |
|---|---|---|---|---|
| **Conversations / threads** | Two-way resident messaging | Phase 2; distinct from outbound notices | Communications → Conversations | Messaging API |
| **Portal notices (resident)** | Resident-facing notice inbox | IA lists notices; no `portal-notices.md` | Resident portal → Notices | Notices self-service API |

### Maintenance and vendors

| Screen | Description | Why deferred | Planned IA location | Depends on |
|---|---|---|---|---|
| **Vendors directory** | Vendor contacts and linked work orders | Business/ops reference | Maintenance → Vendors | Vendors API |
| **Vendor detail** | Contracts, W-9/tax docs (jurisdiction-dependent) | Phase 2+ | Maintenance → Vendors → Detail | Vendors API |

### Platform

| Screen | Description | Why deferred | Planned IA location | Depends on |
|---|---|---|---|---|
| **Platform security alerts** | Authentication anomalies, lockouts | Platform shell partial | Platform → Security | Platform security API |
| **Platform audit** | Cross-organization audit search | Platform shell partial | Platform → Audit | Platform audit API |
| **Feature flags** | Global and per-organization flags | Platform ops | Platform → Feature flags | Feature flag service |
| **System settings** | Platform-wide configuration | Platform ops | Platform → Settings | Platform config API |
| **Organization provisioning detail** | Full provision/suspend lifecycle beyond list | `platform-organizations.md` is list-oriented | Platform → Organizations → Detail | Platform org API |
| **Usage / quota dashboard** | Per-organization usage counters | Architecture specifies counters | Platform → Usage | `tenant_usage_counters` |

---

## Promotion criteria

A deferred screen should be promoted to a full `docs/ui/[domain]/[screen].md` specification when **all** of the following are true:

1. API endpoints and permissions are stable in [04-api-specification.md](../04-api-specification.md) and [06-permission-system.md](../06-permission-system.md).
2. The screen is in scope for the target delivery phase in [10-development-roadmap.md](../10-development-roadmap.md).
3. Navigation placement is agreed in [navigation.md](../navigation.md).
4. Cross-cutting behaviors in [cross-cutting-patterns.md](./cross-cutting-patterns.md) apply without screen-specific exceptions.

On promotion:

1. Create the screen file from [`_template.md`](./_template.md).
2. Add link to [README.md](./README.md) screen inventory.
3. Add route entry to [navigation.md](../navigation.md).
4. Remove the row from this document or mark **Promoted** with link.

---

## Related partial coverage

These deferred items have **interim** coverage elsewhere:

| Deferred item | Interim coverage |
|---|---|
| Approval steps | `finance/billing-run-workspace.md`, `finance/deposit-disposition.md`, `admin/export-center.md` |
| Screening / do-not-rent | `residents/resident-detail.md`, `residents/waitlist.md` |
| Session / MFA (resident) | `resident-portal/portal-profile.md` |
| Staff security (partial) | `admin/user-detail.md`, `admin/organization-settings.md` |
| Outbound notices | `communications/notifications-list.md`, `communications/notification-compose.md` |
| Move-in/out assets | `leasing/move-in.md`, `leasing/move-out-checkout.md` |

---

## Recommended promotion order (documentation)

1. **Approval inbox** — unifies dual-control UX across finance and administration.
2. **Portal notices** — closes resident IA gap vs [07-ui-design.md](../07-ui-design.md).
3. **Charges list** and **Refunds** — completes finance navigation parity with API.
4. **Inventory holds / reservations** — required for availability accuracy at scale.
5. **Security settings** and **MFA enrollment** — GA security completeness.
6. **Organization subscription / SaaS billing** — required before commercial launch billing.
7. Phase 2 items: **Applications**, **Conversations**, **SSO**, **Vendors**.
