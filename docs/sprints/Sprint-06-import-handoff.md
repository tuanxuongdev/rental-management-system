# Sprint-06 import handoff (from Sprint-05)

Notes only — **do not implement** bulk import in Sprint-05.

## Suggested column mapping (CSV → inventory)

| Column | Target | Notes |
|---|---|---|
| `property_code` | `properties.code` | Required; org-scoped unique among active |
| `property_name` | `properties.name` | |
| `property_type` | `properties.property_type` | `APARTMENT` / `BOARDING_HOUSE` / `MIXED` / `OTHER` |
| `address_line1` / `city` / `region` / `postal_code` / `country_code` | property address | `country_code` ISO-3166-1 alpha-2 |
| `time_zone` | `properties.time_zone` | IANA; never browser locale |
| `default_currency` | `properties.default_currency` | ISO-4217 |
| `building_code` | `buildings.code` | Optional |
| `unit_code` | `units.code` | Unique per property among active |
| `unit_name` | `units.name` | |
| `unit_type` | `units.unit_type` | `APARTMENT` / `STUDIO` / `PRIVATE_ROOM` / `SHARED_ROOM` |
| `allocation_mode` | `units.allocation_mode` | `WHOLE_UNIT` / `BED` / `CAPACITY` |
| `capacity` | `units.capacity` | Required for CAPACITY / BED shared units |
| `bed_code` / `bed_label` | `beds` | Only when `allocation_mode=BED` |
| `amenity_codes` | amenity links | Resolve via `amenities.code` |

## Idempotent import job design (sketch)

1. Accept upload → persist import job + file object key (org-scoped).
2. Parse rows → validate against Zod/contracts write schemas.
3. Upsert by natural keys: `(tenant_id, property_code)`, `(tenant_id, property_id, unit_code)`, `(tenant_id, unit_id, bed_code)`.
4. Write outbox event per completed batch; never invent Room entities.
5. Property Managers: import must still respect `property_access_grants` for updates to existing properties.

## 10k query plan prep

Indexes already present on `(tenant_id, property_id)`, unit codes, and status. Sprint-06 should add:
- Partial unique indexes for soft-deleted active codes if not already enforced in app
- Cursor pagination stress on units list at ≥10k rows
- Synthetic seed generator separate from `demo-portfolio.ts`
