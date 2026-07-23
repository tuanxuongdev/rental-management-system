-- Sprint-05 review: partial unique indexes for active soft-deleted inventory codes.
-- Application checks remain; these close concurrent duplicate races.

CREATE UNIQUE INDEX IF NOT EXISTS "properties_tenant_code_active_uidx"
ON "properties" ("tenant_id", "code")
WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "units_tenant_property_code_active_uidx"
ON "units" ("tenant_id", "property_id", "code")
WHERE "deleted_at" IS NULL AND "status" = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS "beds_tenant_unit_code_active_uidx"
ON "beds" ("tenant_id", "unit_id", "code")
WHERE "deleted_at" IS NULL AND "status" = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS "buildings_tenant_property_code_active_uidx"
ON "buildings" ("tenant_id", "property_id", "code")
WHERE "deleted_at" IS NULL AND "status" = 'ACTIVE';
