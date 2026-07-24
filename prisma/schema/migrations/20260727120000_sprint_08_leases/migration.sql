-- Sprint-08: leases + GiST allocation exclusions (btree_gist).

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "LeaseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CANCELLED');
CREATE TYPE "LeasePartyRole" AS ENUM ('PRIMARY_LEASEHOLDER', 'LEASEHOLDER', 'OCCUPANT', 'GUARANTOR', 'PAYER', 'SPONSOR');
CREATE TYPE "LeaseAllocationType" AS ENUM ('WHOLE_UNIT', 'BED', 'CAPACITY');
CREATE TYPE "LeaseAllocationStatus" AS ENUM ('ACTIVE', 'ENDED', 'CANCELLED');
CREATE TYPE "RentCadence" AS ENUM ('MONTHLY', 'WEEKLY', 'DAILY', 'OTHER');

CREATE TABLE "leases" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "lease_number" TEXT,
    "status" "LeaseStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "activated_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "leases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lease_terms" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lease_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "currency" CHAR(3) NOT NULL,
    "rent_amount" DECIMAL(19,4) NOT NULL,
    "deposit_amount" DECIMAL(19,4) NOT NULL,
    "rent_cadence" "RentCadence" NOT NULL DEFAULT 'MONTHLY',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "recurring_charges" JSONB NOT NULL DEFAULT '[]',
    "locked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lease_terms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lease_parties" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lease_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "role" "LeasePartyRole" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lease_parties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lease_allocations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lease_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "bed_id" UUID,
    "allocation_type" "LeaseAllocationType" NOT NULL,
    "capacity_quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "LeaseAllocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lease_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lease_status_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lease_id" UUID NOT NULL,
    "from_status" "LeaseStatus",
    "to_status" "LeaseStatus" NOT NULL,
    "reason" TEXT,
    "actor_user_id" UUID,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "lease_status_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "leases_tenant_id_lease_number_key" ON "leases"("tenant_id", "lease_number");
CREATE INDEX "leases_tenant_id_property_id_status_idx" ON "leases"("tenant_id", "property_id", "status");
CREATE INDEX "leases_tenant_id_status_start_date_idx" ON "leases"("tenant_id", "status", "start_date");
CREATE UNIQUE INDEX "leases_tenant_id_id_key" ON "leases"("tenant_id", "id");

CREATE UNIQUE INDEX "lease_terms_lease_id_version_number_key" ON "lease_terms"("lease_id", "version_number");
CREATE INDEX "lease_terms_tenant_id_lease_id_is_current_idx" ON "lease_terms"("tenant_id", "lease_id", "is_current");

CREATE INDEX "lease_parties_tenant_id_lease_id_idx" ON "lease_parties"("tenant_id", "lease_id");
CREATE INDEX "lease_parties_tenant_id_party_id_idx" ON "lease_parties"("tenant_id", "party_id");
CREATE UNIQUE INDEX "lease_parties_lease_id_party_id_role_key" ON "lease_parties"("lease_id", "party_id", "role");

CREATE INDEX "lease_allocations_tenant_id_lease_id_idx" ON "lease_allocations"("tenant_id", "lease_id");
CREATE INDEX "lease_allocations_tenant_id_unit_id_status_idx" ON "lease_allocations"("tenant_id", "unit_id", "status");
CREATE INDEX "lease_allocations_tenant_id_bed_id_status_idx" ON "lease_allocations"("tenant_id", "bed_id", "status");

CREATE INDEX "lease_status_history_tenant_id_lease_id_recorded_at_idx" ON "lease_status_history"("tenant_id", "lease_id", "recorded_at");

CREATE INDEX "document_links_tenant_id_lease_id_idx" ON "document_links"("tenant_id", "lease_id");

ALTER TABLE "leases" ADD CONSTRAINT "leases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leases" ADD CONSTRAINT "leases_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leases" ADD CONSTRAINT "leases_property_tenant_fk" FOREIGN KEY ("tenant_id", "property_id") REFERENCES "properties"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lease_terms" ADD CONSTRAINT "lease_terms_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lease_terms" ADD CONSTRAINT "lease_terms_lease_tenant_fk" FOREIGN KEY ("tenant_id", "lease_id") REFERENCES "leases"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lease_parties" ADD CONSTRAINT "lease_parties_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lease_parties" ADD CONSTRAINT "lease_parties_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lease_parties" ADD CONSTRAINT "lease_parties_lease_tenant_fk" FOREIGN KEY ("tenant_id", "lease_id") REFERENCES "leases"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lease_parties" ADD CONSTRAINT "lease_parties_party_tenant_fk" FOREIGN KEY ("tenant_id", "party_id") REFERENCES "parties"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lease_allocations" ADD CONSTRAINT "lease_allocations_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lease_allocations" ADD CONSTRAINT "lease_allocations_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lease_allocations" ADD CONSTRAINT "lease_allocations_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "beds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lease_allocations" ADD CONSTRAINT "lease_allocations_lease_tenant_fk" FOREIGN KEY ("tenant_id", "lease_id") REFERENCES "leases"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lease_allocations" ADD CONSTRAINT "lease_allocations_unit_tenant_fk" FOREIGN KEY ("tenant_id", "unit_id") REFERENCES "units"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lease_status_history" ADD CONSTRAINT "lease_status_history_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lease_status_history" ADD CONSTRAINT "lease_status_history_lease_tenant_fk" FOREIGN KEY ("tenant_id", "lease_id") REFERENCES "leases"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_links" ADD CONSTRAINT "document_links_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Active WHOLE_UNIT allocations: no overlapping half-open ranges on the same unit.
-- Columns are TIMESTAMP (without time zone) → use tsrange (tstzrange + cast is not IMMUTABLE).
ALTER TABLE "lease_allocations" ADD CONSTRAINT "lease_allocations_whole_unit_excl"
EXCLUDE USING gist (
  unit_id WITH =,
  tsrange(effective_from, COALESCE(effective_to, 'infinity'::timestamp), '[)') WITH &&
) WHERE (allocation_type = 'WHOLE_UNIT' AND status = 'ACTIVE');

-- Active BED allocations: no overlapping half-open ranges on the same bed.
ALTER TABLE "lease_allocations" ADD CONSTRAINT "lease_allocations_bed_excl"
EXCLUDE USING gist (
  bed_id WITH =,
  tsrange(effective_from, COALESCE(effective_to, 'infinity'::timestamp), '[)') WITH &&
) WHERE (allocation_type = 'BED' AND status = 'ACTIVE' AND bed_id IS NOT NULL);
