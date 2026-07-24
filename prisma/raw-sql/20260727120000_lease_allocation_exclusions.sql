-- Copied into prisma/schema/migrations/20260727120000_sprint_08_leases/migration.sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "lease_allocations" ADD CONSTRAINT "lease_allocations_whole_unit_excl"
EXCLUDE USING gist (
  unit_id WITH =,
  tstzrange(effective_from, COALESCE(effective_to, 'infinity'::timestamptz), '[)') WITH &&
) WHERE (allocation_type = 'WHOLE_UNIT' AND status = 'ACTIVE');

ALTER TABLE "lease_allocations" ADD CONSTRAINT "lease_allocations_bed_excl"
EXCLUDE USING gist (
  bed_id WITH =,
  tstzrange(effective_from, COALESCE(effective_to, 'infinity'::timestamptz), '[)') WITH &&
) WHERE (allocation_type = 'BED' AND status = 'ACTIVE' AND bed_id IS NOT NULL);
