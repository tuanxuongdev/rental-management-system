# Sprint-05 — Property and Unit Inventory

**Sprint ID:** Sprint-05  
**Roadmap alignment:** [10-development-roadmap.md](../10-development-roadmap.md) Sprint 5 · Phase 3 start toward **M3**  
**Program references:** [project-roadmap.md](../project-roadmap.md) · [dependency-map.md](../dependency-map.md) · [03-database-design.md](../03-database-design.md) · [04-api-specification.md](../04-api-specification.md)  
**UI references:** [ui/portfolio/properties-list.md](../ui/portfolio/properties-list.md) · [ui/portfolio/property-detail.md](../ui/portfolio/property-detail.md) · [ui/portfolio/property-create-edit.md](../ui/portfolio/property-create-edit.md) · [ui/portfolio/buildings-list.md](../ui/portfolio/buildings-list.md) · [ui/portfolio/units-list.md](../ui/portfolio/units-list.md) · [ui/portfolio/unit-detail.md](../ui/portfolio/unit-detail.md) · [ui/portfolio/unit-create-edit.md](../ui/portfolio/unit-create-edit.md) · [ui/portfolio/beds-list.md](../ui/portfolio/beds-list.md) · [ui/portfolio/availability-lookup.md](../ui/portfolio/availability-lookup.md) · [ui/portfolio/property-owners-list.md](../ui/portfolio/property-owners-list.md) · [ui/portfolio/property-owner-detail.md](../ui/portfolio/property-owner-detail.md) · [ui/portfolio/management-agreements-list.md](../ui/portfolio/management-agreements-list.md) · [ui/portfolio/management-agreement-detail.md](../ui/portfolio/management-agreement-detail.md) · [navigation.md](../navigation.md)  
**Duration:** 2 weeks  
**Status:** Ready for planning  
**Builds on:** [Sprint-04.md](./Sprint-04.md)

---

## Goal

Deliver Organization-scoped property inventory—Properties, buildings/floors, Units, optional Beds, amenities, status transitions, ownership attribution, and management agreements—with responsive list/detail UI and property-scoped authorization so operators can configure a small portfolio and locate available Units or Beds.

---

## Business Value

- First operational domain value: portfolios become manageable in-product.
- Validates boarding-house (Unit + optional Bed) and apartment (Unit) models in one hierarchy.
- Separates **Property Owner** (party) from **Organization Owner** (role)—commercial honesty for operator model.
- Enables pilot feedback on inventory terminology before leasing/billing.
- Independently deployable on top of M2 without residents or finance.

---

## Scope

### In scope

- Property create/edit/archive, search, filter, pagination.
- Building/floor structure where used.
- Unit CRUD with types (apartment, studio, private room, shared room).
- Optional Bed CRUD under shared Units; capacity fields for capacity-mode shared Units.
- Amenities and unit/property amenity links.
- Inventory status and `inventory_status_history`.
- Availability lookup (vacant/available vs occupied placeholder—full occupancy from leases in Sprint-08/09; status-based availability acceptable).
- Parties subset: Property Owners (`owner_profiles`), `property_ownerships`, `management_agreements` (+ agreement parties).
- Property-scoped access grants enforcement for Property Managers.
- Org-scoped object key paths for future property images/docs (upload optional/thin).
- Audit events for inventory and ownership mutations.
- Staff Portfolio navigation section.

### Out of scope

- Bulk CSV import at scale (Sprint-06 / M3).
- Soft holds/hard reservations deep workspace (deferred/thin flags only if trivial).
- Lease/resident assignment.
- Meters and utilities.
- Portfolio map / property comparison (deferred screens).
- Owner payouts or trust accounting.

---

## Features

1. Properties list/detail/create-edit.
2. Buildings list under property.
3. Units list/detail/create-edit; Beds list under unit.
4. Availability lookup by property/status/type.
5. Property Owners list/detail; link ownership interests (effective-dated).
6. Management Agreements list/detail (effective-dated operational authority).
7. Property scope selector in shell filters portfolio views.
8. Status transitions with impact warnings (e.g., archive constraints).
9. Pagination/search indexes suitable for growth (10k prep continues Sprint-06).

---

## User Stories

1. **As a Property Manager**, I can create Properties and Units in my assigned scope so inventory matches the physical site.
2. **As a Property Manager**, I can add Beds under a shared Unit so boarding-house assignments are representable.
3. **As an Organization Administrator**, I can record Property Owners and management agreements so beneficial ownership is attributed without granting login.
4. **As an operator**, I can search and filter Units/Beds and see availability status so I can locate rentable inventory.
5. **As a Property Manager with limited scope**, I cannot view or edit Properties outside my grants.
6. **As an Auditor**, I can view inventory but not mutate it.
7. **As a product owner**, pilot users validate Unit/Bed terminology in a demo portfolio.

---

## Database Changes

| Table | Purpose |
|---|---|
| `parties` | Party backbone |
| `party_contacts` | Contacts |
| `owner_profiles` | Property Owner profile extension |
| `properties` | Properties |
| `property_ownerships` | Effective-dated M:N ownership |
| `management_agreements` | Operator authority records |
| `management_agreement_parties` | Parties on agreements |
| `buildings` | Buildings |
| `floors` | Floors (if modeled) |
| `unit_types` | Unit type catalog |
| `units` | Units |
| `beds` | Optional beds |
| `amenities` | Amenity catalog |
| `property_amenities` / `unit_amenities` | Links |
| `inventory_status_history` | Status history |
| `rate_plans` | Optional thin defaults |

**Constraints:** Composite FKs with `tenant_id`; partial uniques for soft-delete; indexes on `(tenant_id, property_id)`, unit codes, status. **No** lease allocation GiST yet (Sprint-08).

---

## API Changes

Subset of API §11 portfolio / property-owners:

| Area | Endpoints (representative) |
|---|---|
| Properties | `GET/POST /v1/organizations/{orgId}/properties`, `GET/PATCH /properties/{id}` |
| Buildings | CRUD under property |
| Units | CRUD, list with filters (`status`, `buildingId`, `q`) |
| Beds | CRUD under unit |
| Amenities | list/assign |
| Availability | `GET .../availability` or filtered units/beds |
| Property owners | CRUD parties/owner profiles |
| Ownerships | create/end-date ownership rows |
| Management agreements | CRUD + list |
| Status | transition endpoints or PATCH with validation |

**Rules:** Cursor pagination; `If-Match` on updates; org path == token; property scope filter for Property Managers; ownership/agreement APIs do **not** create memberships.

---

## UI Changes

| Screen | Notes |
|---|---|
| Portfolio nav | Properties, Units, Availability, Property Owners, Management Agreements |
| Properties / Units / Beds screens | Per UI specs |
| Property scope selector | Sticky; filters lists |
| Owners & agreements | Clear copy: does not grant app access |
| Home dashboard | Optional inventory counts widget (thin) |

Mobile: card lists; tables may horizontal-scroll with sticky identity.

---

## Permissions

| Permission | Use |
|---|---|
| `properties.read/create/update/archive` | Property lifecycle |
| `units.*` / `beds.*` | Inventory |
| `property_owners.*` | Owner party records |
| `management_agreements.*` | Agreements |
| `occupancy.view` | Availability views |
| Property scope | Property Manager limited by `property_access_grants` |

Organization Owner/Admin: org-wide. Ownership records ≠ login.

---

## Validation Rules

1. Unit codes unique within property (active rows).
2. Beds only allowed under Units configured for bed assignment; capacity-mode rules documented.
3. Cannot archive Property with blocking child constraints without explicit force path (prefer block + message).
4. Status transitions follow allowed graph; history row written.
5. Ownership share/effective dates: no invalid open-ended overlaps per business rules (enforce documented constraints).
6. Management agreement effective dating validated; does not imply RBAC.
7. Property Manager APIs enforce grant scope on every query (not only UI filter).
8. Cross-org property id → 404.
9. Currency/timezone on property if present must be explicit fields—not inferred from browser locale.

---

## Test Cases

| ID | Case | Expected |
|---|---|---|
| T05-01 | Create property/unit/bed happy path | Persisted; audited |
| T05-02 | List units with cursor pagination | Stable order |
| T05-03 | Property Manager outside grant | 404/empty |
| T05-04 | Cross-org unit id | 404 |
| T05-05 | Bed under non-shared unit disallowed config | Validation error |
| T05-06 | Archive property with units | Per rule (block or cascade policy) |
| T05-07 | Create ownership + agreement | No membership created |
| T05-08 | Availability filter | Returns status-consistent rows |
| T05-09 | Concurrent update without If-Match | 412 when ETag required |
| T05-10 | Auditor PATCH unit | 403 |
| T05-11 | Isolation suite includes portfolio endpoints | Pass |
| T05-12 | Pilot terminology review checklist | Signed notes |

---

## Acceptance Criteria

1. Operators can configure a small portfolio and locate available Units or Beds (**Sprint 5 demo**).
2. Property → Unit → optional Bed hierarchy works for apartment and boarding-house shapes.
3. Property Owners and management agreements are manageable and clearly non-authorizing.
4. Property-scoped authorization enforced for Property Managers.
5. Portfolio UI matches navigation IA and screen specs for listed pages.
6. Audit events for inventory/ownership mutations.
7. Deployed to staging; isolation tests extended.
8. Sprint-06 can add bulk import without schema rewrite.

**Milestone contribution:** Progress toward **M3** (bulk import exit in Sprint-06).

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Room vs Unit terminology drift | UX confusion | Canonical vocabulary in UI copy |
| Premature occupancy from status only | Misleading availability | Label status vs lease occupancy |
| Ownership mistaken for access | Security support burden | Explicit UI/API warnings |
| Weak indexes | Sprint-06 scale fail | Index review now |
| Scope creep into import/leases | Slip | Strict out-of-scope |

---

## Dependencies

| Dependency | Type | Required |
|---|---|---|
| Sprint-04 / **M2** | Hard | Yes |
| Permission keys for portfolio | Hard | Yes |
| Pilot sample mental model / SME | Soft | Terminology validation |
| Representative legacy samples | Soft | Prep for Sprint-06 |
| Sprint-06 | Downstream | Bulk import + M3 |

---

## Deliverables

1. Inventory + ownership/agreement migrations.
2. Portfolio APIs + property scope enforcement.
3. Portfolio UI screens listed in scope.
4. Extended isolation tests.
5. Audit coverage for inventory mutations.
6. Demo portfolio seed script (synthetic).
7. Backlog notes for import column mapping (Sprint-06).

---

## Estimated Time

| Track | Estimate |
|---|---|
| Schema + domain services | 3 days |
| APIs + authz scope | 2–3 days |
| Portfolio UI | 3–4 days |
| Tests + staging harden | 1–2 days |
| **Sprint total** | **10 business days (2 weeks)** |

---

## Definition of Done

1. Acceptance criteria met; demo portfolio on staging.
2. Isolation and permission tests pass for all new endpoints.
3. Coding standards, CI gates, reviews complete.
4. No critical/high inventory defects open.
5. Docs: API subset + permission keys updated.
6. Independently deployable without leasing/finance.
7. Handoff to Sprint-06: import templates, idempotent import job design, 10k query plan.
