-- Sprint-06: composite tenant FK expand (defense in depth).
-- Prerequisite: parent tables expose UNIQUE (tenant_id, id). Primary key on id already
-- implies uniqueness of (tenant_id, id) once we add the composite unique.

-- Parent uniqueness for composite FK targets
CREATE UNIQUE INDEX IF NOT EXISTS "properties_tenant_id_id_key"
  ON "properties" ("tenant_id", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "buildings_tenant_id_id_key"
  ON "buildings" ("tenant_id", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "units_tenant_id_id_key"
  ON "units" ("tenant_id", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "parties_tenant_id_id_key"
  ON "parties" ("tenant_id", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "management_agreements_tenant_id_id_key"
  ON "management_agreements" ("tenant_id", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "amenities_tenant_id_id_key"
  ON "amenities" ("tenant_id", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "import_jobs_tenant_id_id_key"
  ON "import_jobs" ("tenant_id", "id");

-- List/search indexes for 10k Unit scale
CREATE INDEX IF NOT EXISTS "units_tenant_status_code_idx"
  ON "units" ("tenant_id", "status", "code");

CREATE INDEX IF NOT EXISTS "units_tenant_operational_status_idx"
  ON "units" ("tenant_id", "operational_status")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "beds_tenant_status_idx"
  ON "beds" ("tenant_id", "status")
  WHERE "deleted_at" IS NULL;

-- Composite FKs (tenant-complete). Drop single-column FKs that would conflict only if needed;
-- PostgreSQL allows both as long as columns match. We add composite FKs alongside existing ones.

ALTER TABLE "units"
  DROP CONSTRAINT IF EXISTS "units_property_tenant_fk";
ALTER TABLE "units"
  ADD CONSTRAINT "units_property_tenant_fk"
  FOREIGN KEY ("tenant_id", "property_id") REFERENCES "properties" ("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "beds"
  DROP CONSTRAINT IF EXISTS "beds_unit_tenant_fk";
ALTER TABLE "beds"
  ADD CONSTRAINT "beds_unit_tenant_fk"
  FOREIGN KEY ("tenant_id", "unit_id") REFERENCES "units" ("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "buildings"
  DROP CONSTRAINT IF EXISTS "buildings_property_tenant_fk";
ALTER TABLE "buildings"
  ADD CONSTRAINT "buildings_property_tenant_fk"
  FOREIGN KEY ("tenant_id", "property_id") REFERENCES "properties" ("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "property_ownerships"
  DROP CONSTRAINT IF EXISTS "property_ownerships_property_tenant_fk";
ALTER TABLE "property_ownerships"
  ADD CONSTRAINT "property_ownerships_property_tenant_fk"
  FOREIGN KEY ("tenant_id", "property_id") REFERENCES "properties" ("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "property_ownerships"
  DROP CONSTRAINT IF EXISTS "property_ownerships_owner_tenant_fk";
ALTER TABLE "property_ownerships"
  ADD CONSTRAINT "property_ownerships_owner_tenant_fk"
  FOREIGN KEY ("tenant_id", "owner_party_id") REFERENCES "parties" ("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "management_agreements"
  DROP CONSTRAINT IF EXISTS "management_agreements_property_tenant_fk";
ALTER TABLE "management_agreements"
  ADD CONSTRAINT "management_agreements_property_tenant_fk"
  FOREIGN KEY ("tenant_id", "property_id") REFERENCES "properties" ("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "management_agreement_parties"
  DROP CONSTRAINT IF EXISTS "management_agreement_parties_agreement_tenant_fk";
ALTER TABLE "management_agreement_parties"
  ADD CONSTRAINT "management_agreement_parties_agreement_tenant_fk"
  FOREIGN KEY ("tenant_id", "agreement_id") REFERENCES "management_agreements" ("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "management_agreement_parties"
  DROP CONSTRAINT IF EXISTS "management_agreement_parties_party_tenant_fk";
ALTER TABLE "management_agreement_parties"
  ADD CONSTRAINT "management_agreement_parties_party_tenant_fk"
  FOREIGN KEY ("tenant_id", "party_id") REFERENCES "parties" ("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "property_access_grants"
  DROP CONSTRAINT IF EXISTS "property_access_grants_property_tenant_fk";
ALTER TABLE "property_access_grants"
  ADD CONSTRAINT "property_access_grants_property_tenant_fk"
  FOREIGN KEY ("tenant_id", "property_id") REFERENCES "properties" ("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "import_job_rows"
  DROP CONSTRAINT IF EXISTS "import_job_rows_job_tenant_fk";
ALTER TABLE "import_job_rows"
  ADD CONSTRAINT "import_job_rows_job_tenant_fk"
  FOREIGN KEY ("tenant_id", "job_id") REFERENCES "import_jobs" ("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
