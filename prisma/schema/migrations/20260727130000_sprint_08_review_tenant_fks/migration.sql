-- Sprint-08 review: tenant-complete FKs for beds and document_links.lease_id.
-- Expand-only: add parent uniqueness then composite FKs alongside single-column FKs.

CREATE UNIQUE INDEX IF NOT EXISTS "beds_tenant_id_id_key"
  ON "beds" ("tenant_id", "id");

ALTER TABLE "lease_allocations"
  DROP CONSTRAINT IF EXISTS "lease_allocations_bed_tenant_fk";
ALTER TABLE "lease_allocations"
  ADD CONSTRAINT "lease_allocations_bed_tenant_fk"
  FOREIGN KEY ("tenant_id", "bed_id") REFERENCES "beds" ("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_links"
  DROP CONSTRAINT IF EXISTS "document_links_lease_tenant_fk";
ALTER TABLE "document_links"
  ADD CONSTRAINT "document_links_lease_tenant_fk"
  FOREIGN KEY ("tenant_id", "lease_id") REFERENCES "leases" ("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
