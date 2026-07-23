# Pilot inventory mapping and cleansing rules (Sprint-06 / M3)

**Audience:** Data migration leads, Organization Administrators, pilot SMEs  
**Related:** [Sprint-06.md](./Sprint-06.md) · [Sprint-06-import-handoff.md](./Sprint-06-import-handoff.md) · Import wizard UI

## Purpose

Define how pilot CSV extracts map into Organization-scoped inventory and how cleansing decisions are recorded before dry-run/commit.

## Canonical columns

Use the template from `GET /v1/organizations/{orgId}/imports/templates/inventory`. Required conceptual fields:

| Source concept | CSV column | Rule |
|---|---|---|
| Property identity | `property_code` | Unique among active properties in the Organization |
| Property name | `property_name` | Non-empty |
| Property type | `property_type` | `APARTMENT` \| `BOARDING_HOUSE` \| `MIXED` \| `OTHER` |
| Address | `address_line1`, `city`, optional region/postal/country | Explicit; never browser locale |
| Time zone | `time_zone` | IANA ID |
| Currency | `default_currency` | ISO-4217 |
| Unit identity | `unit_code` | Unique per property among active units |
| Unit type / mode | `unit_type`, `allocation_mode` | Beds only when `allocation_mode=BED` |
| Optional bed | `bed_code`, `bed_label` | Rejected if mode ≠ BED |

## Cleansing checklist (before dry-run)

1. Normalize codes: trim, uppercase property/unit codes if pilot policy requires.
2. Collapse duplicate property rows that share `property_code` with conflicting addresses — resolve offline.
3. Convert legacy “room” labels to Unit types; never invent a Room entity.
4. Confirm BED-mode shared units list bed rows; WHOLE_UNIT rows must not include bed columns.
5. Strip PII not needed for inventory (owner SSNs, etc.) — ownership imports are out of scope for this wizard.
6. Confirm Property Manager scope: rows updating properties outside grants will be rejected/skipped.

## Dry-run / commit semantics

- Dry-run **never** mutates inventory; download reject CSV and fix source.
- Commit is async and idempotent per job + `Idempotency-Key`.
- Partial success preserves applied rows; rejected rows appear in error artifact.

## Sign-off

| Role | Name | Date | Notes |
|---|---|---|---|
| Product owner | _TBD_ | | M3 demo |
| Pilot SME | _TBD_ | | Terminology (Unit/Bed) |
| Engineering | _TBD_ | | Staging import evidence |
