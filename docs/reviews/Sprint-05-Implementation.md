# Sprint-05 Implementation Summary

**Sprint ID:** Sprint-05 — Property and Unit Inventory  
**Implementation date:** 2026-07-23  
**Scope:** Sprint-05 only (Organization-scoped portfolio inventory, parties/ownership/agreements, property-scoped authz, Portfolio UI)  
**Baseline:** [Sprint-05.md](../sprints/Sprint-05.md) · [03-database-design.md](../03-database-design.md) · [04-api-specification.md](../04-api-specification.md) · [06-permission-system.md](../06-permission-system.md) · [navigation.md](../navigation.md) · [Sprint-04-Review.md](./Sprint-04-Review.md)  
**Out of scope:** Sprint-06 bulk CSV import, leases/residents, meters, maps, owner payouts

---

## Summary

Sprint-05 delivers the first operational domain slice on top of M2: Properties → optional Buildings/Floors → Units → optional Beds, amenities, status history, status-based availability, Property Owners / ownerships / management agreements, Property Manager grant enforcement, and staff Portfolio UI with a Property scope selector. Architecture, tenancy model, and Sprint-04 RBAC patterns were extended—not redesigned. All local quality gates passed (lint, typecheck, unit, integration, build).

---

## Features implemented

| # | Feature | Status |
|---|---|---|
| 1 | Parties CRM subset (`parties`, `party_contacts`, `owner_profiles`) | Done |
| 2 | Properties CRUD + archive/restore with If-Match concurrency | Done |
| 3 | Buildings (and floors schema) under property | Done (floors schema; buildings APIs/UI) |
| 4 | Units CRUD + operational status transitions + history | Done |
| 5 | Beds CRUD under `allocationMode=BED` units only | Done |
| 6 | Amenities catalog + property/unit amenity replace | Done |
| 7 | Availability lookup (operational status–based; lease occupancy deferred) | Done |
| 8 | Property Owners list/detail/create/update (non-authorizing) | Done |
| 9 | Property ownerships create/end (no membership created) | Done |
| 10 | Management agreements CRUD + activate/terminate (no RBAC grant) | Done |
| 11 | Property-scoped `property_access_grants` enforcement on inventory queries | Done |
| 12 | Permission catalog expanded; Property Manager system role **ACTIVE** | Done |
| 13 | Portfolio nav + Property scope selector in staff shell | Done |
| 14 | Portfolio list/detail/create-edit screens for inventory + owners + agreements | Done |
| 15 | Audit events for inventory and ownership/agreement mutations | Done |
| 16 | Isolation suite extended with T05-01…T05-11 | Done |
| 17 | Demo portfolio seed script | Done |
| 18 | Sprint-06 import handoff notes | Done |
| 19 | Bulk CSV import | Deferred to Sprint-06 |
| 20 | Pilot terminology checklist sign-off (T05-12) | Process / remaining |
| 21 | Staging deploy + M3 demo | Process / remaining |

---

## Files created

### Prisma / database

- `prisma/schema/parties.prisma`
- `prisma/schema/inventory.prisma`
- `prisma/schema/migrations/20260724120000_sprint_05_portfolio_inventory/migration.sql`
- `prisma/seeds/demo-portfolio.ts`

### Contracts (`@rpm/contracts`)

- `packages/contracts/src/inventory.ts`
- `packages/contracts/src/parties.ts`
- `packages/contracts/src/sprint-05.contracts.spec.ts`

### API — inventory

- `apps/api/src/modules/inventory/inventory.module.ts`
- `apps/api/src/modules/inventory/presentation/inventory.controller.ts`
- `apps/api/src/modules/inventory/application/property.service.ts`
- `apps/api/src/modules/inventory/application/building.service.ts`
- `apps/api/src/modules/inventory/application/unit.service.ts`
- `apps/api/src/modules/inventory/application/bed.service.ts`
- `apps/api/src/modules/inventory/application/amenity.service.ts`
- `apps/api/src/modules/inventory/application/availability.service.ts`
- `apps/api/src/modules/inventory/inventory.integration.spec.ts`

### API — parties

- `apps/api/src/modules/parties/parties.module.ts`
- `apps/api/src/modules/parties/presentation/parties.controller.ts`
- `apps/api/src/modules/parties/application/property-owner.service.ts`
- `apps/api/src/modules/parties/application/ownership.service.ts`
- `apps/api/src/modules/parties/application/management-agreement.service.ts`

### Web — portfolio

- `apps/web/src/lib/portfolio-api.ts`
- `apps/web/src/state/property-scope-store.ts`
- `apps/web/src/features/inventory/**` (hooks, lists, forms, detail, scope selector, availability)
- `apps/web/src/features/parties/**` (owners, agreements)
- `apps/web/src/app/(app)/app/portfolio/**` (properties, units, beds, availability, owners, agreements routes)

### Docs

- `docs/sprints/Sprint-06-import-handoff.md`
- `docs/reviews/Sprint-05-Implementation.md` (this file)

---

## Files modified

| Area | Files |
|---|---|
| Prisma | `prisma/schema/tenancy.prisma` (relations), `prisma/schema/rbac.prisma` (`PropertyAccessGrant` → `Property` FK), `prisma/README.md` |
| Permissions | `packages/contracts/src/permissions.ts`, `packages/contracts/src/index.ts`, `apps/api/src/modules/tenancy/application/permission-catalog.ts` |
| Authz | `apps/api/src/modules/tenancy/application/authorization.service.ts` (`resolveAccessiblePropertyIds`, `assertPropertyAccess`) |
| App wiring | `apps/api/src/app.module.ts` |
| Testing | `packages/testing/src/integration-database.ts` (FK-safe reset), `package.json` (`isolation`, `seed:demo-portfolio`), `.github/workflows/ci.yml` |
| Web shell | `apps/web/src/components/layouts/app-shell.tsx` |

---

## Database changes

Migration: `20260724120000_sprint_05_portfolio_inventory`

| Table | Purpose |
|---|---|
| `parties`, `party_contacts`, `owner_profiles` | Property Owner party backbone |
| `properties` | Portfolio properties |
| `property_ownerships` | Effective-dated ownership interests |
| `management_agreements`, `management_agreement_parties` | Operator authority records |
| `buildings`, `floors` | Optional structure |
| `unit_types`, `units`, `beds` | Rentable inventory hierarchy |
| `amenities`, `property_amenities`, `unit_amenities` | Amenity catalog + links |
| `inventory_status_history` | Status transition history |
| `rate_plans` | Thin rate defaults (schema ready) |

Also: `property_access_grants.property_id` FK to `properties` (nullable for `ALL_PROPERTIES` scope).

**Rules enforced in application layer:** unit codes unique per property among active rows; beds only when `allocation_mode = BED`; archive property blocked while active units exist; org path mismatch → 404; PM outside grant → 404/empty.

---

## API changes

Org-scoped routes under `/v1/organizations/{organizationId}/…` (path org must match session org):

| Area | Endpoints |
|---|---|
| Properties | `GET/POST /properties`, `GET/PATCH/DELETE /properties/{id}`, `POST …/restore` |
| Buildings | `GET/POST /properties/{id}/buildings`, `GET/PATCH/DELETE /buildings/{id}` |
| Units | `GET/POST /properties/{id}/units`, `GET/PATCH/DELETE /units/{id}`, `POST …/status`, `POST …/restore` |
| Beds | `GET/POST /units/{id}/beds`, `GET/PATCH/DELETE /beds/{id}` |
| Amenities | `GET/POST /amenities`, `PUT` property/unit amenity sets |
| Availability | `GET /availability` |
| Property owners | `GET/POST /property-owners`, `GET/PATCH /property-owners/{id}` |
| Ownerships | `GET/POST /properties/{id}/ownerships`, `POST /property-ownerships/{id}/end` |
| Management agreements | `GET/POST /management-agreements`, `GET/PATCH /…/{id}`, `POST …/activate`, `POST …/terminate` |

**Cross-cutting:** cursor pagination; `If-Match` / version on updates; `@RequirePermissions`; property scope filter for Property Managers; ownership/agreement APIs never create memberships; responses mark `grantsLoginAccess: false` for owners.

---

## UI changes

| Screen / shell | Notes |
|---|---|
| Portfolio nav | Properties, Units, Availability, Property Owners, Management Agreements |
| Property scope selector | In-memory Zustand; filters portfolio lists; resets on org switch |
| Properties / Units / Beds | List, detail, create/edit; archive + status actions with version |
| Buildings | List under property |
| Availability | Status-based lookup with clear “not lease occupancy” semantics |
| Owners / Agreements | Non-authorizing banner copy |
| Home inventory widget | Skipped (Home remains stub) |

---

## Tests added

| Suite | Coverage |
|---|---|
| `inventory.integration.spec.ts` | T05-01…T05-11 (happy path, pagination, PM scope, cross-org 404, bed mode validation, archive block, ownership≠membership, availability, If-Match, auditor 403, isolation) |
| `sprint-05.contracts.spec.ts` | Path constants, permission keys, Zod write/read schemas, non-access flag |
| `pnpm isolation` | Now includes inventory isolation suite alongside Sprint-04 authz + worker tenant-context |

**Quality gates (2026-07-23):**

- `pnpm lint` — pass  
- `pnpm typecheck` — pass  
- `pnpm unit` — 48 tests pass  
- `pnpm integration` — 32 tests pass (includes Sprint-05 + prior)  
- `pnpm build` — pass  

---

## Remaining work

1. **T05-12** pilot terminology review checklist sign-off (process).
2. Staging deploy + demo portfolio seed against a real org (`DEMO_ORGANIZATION_ID=… pnpm seed:demo-portfolio`).
3. Floors CRUD UI (schema present; buildings covered; floor APIs thin/deferred if unused).
4. Dedicated org-wide `/units` API (UI currently fan-outs property unit lists)—acceptable for small portfolios; Sprint-06 scale may want a single endpoint.
5. Amenity assignment UI polish beyond API replace endpoints.
6. Property access grant **admin UI** for assigning Property Managers to properties (API/schema ready; assignment exercised in tests).
7. Sprint-06: bulk import per `docs/sprints/Sprint-06-import-handoff.md`.

---

## Known limitations

1. Availability is **operational-status based**, not lease occupancy (explicit Sprint-05 rule; leasing arrives later).
2. No bulk import (Sprint-06).
3. Rate plans table exists but no product UI.
4. Object-storage property images/docs remain future/thin.
5. Partial unique DB constraints for soft-deleted codes rely primarily on application checks (index hardening continues in Sprint-06).
6. Portfolio nav is not yet permission-filtered client-side (server authorization remains authoritative, same pattern as Admin nav).
7. Home dashboard inventory counts widget not shipped.

---

## Milestone contribution

Progress toward **M3**. Inventory hierarchy and APIs are ready for Sprint-06 bulk import without schema rewrite.
