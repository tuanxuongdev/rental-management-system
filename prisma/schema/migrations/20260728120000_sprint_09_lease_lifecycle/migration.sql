-- Sprint-09: lease lifecycle occupancy, asset keys, notice/termination columns.

CREATE TYPE "LeaseOccupancyState" AS ENUM ('NOT_MOVED_IN', 'OCCUPIED', 'MOVED_OUT');
CREATE TYPE "LeaseMoveOutStatus" AS ENUM ('NONE', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "OccupancyEventType" AS ENUM ('MOVED_IN', 'MOVED_OUT', 'NOTICE_RECORDED', 'RENEWED', 'TRANSFERRED', 'TERMINATED', 'HOLDOVER_FLAGGED');
CREATE TYPE "AssetKeyStatus" AS ENUM ('ISSUED', 'RETURNED', 'LOST', 'DAMAGED');

ALTER TYPE "LeaseStatus" ADD VALUE IF NOT EXISTS 'NOTICE';
ALTER TYPE "LeaseStatus" ADD VALUE IF NOT EXISTS 'ENDED';

ALTER TABLE "leases"
  ADD COLUMN IF NOT EXISTS "occupancy_state" "LeaseOccupancyState" NOT NULL DEFAULT 'NOT_MOVED_IN',
  ADD COLUMN IF NOT EXISTS "moved_in_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "moved_out_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "notice_date" DATE,
  ADD COLUMN IF NOT EXISTS "notice_effective_end" DATE,
  ADD COLUMN IF NOT EXISTS "termination_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "terminated_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "renewed_from_lease_id" UUID,
  ADD COLUMN IF NOT EXISTS "move_out_status" "LeaseMoveOutStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "move_in_checklist" JSONB,
  ADD COLUMN IF NOT EXISTS "move_out_checklist" JSONB,
  ADD COLUMN IF NOT EXISTS "holdover_flag" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "leases_tenant_id_occupancy_state_end_date_idx"
  ON "leases"("tenant_id", "occupancy_state", "end_date");
CREATE INDEX IF NOT EXISTS "leases_tenant_id_move_out_status_idx"
  ON "leases"("tenant_id", "move_out_status");

ALTER TABLE "leases"
  DROP CONSTRAINT IF EXISTS "leases_renewed_from_lease_id_fkey";
ALTER TABLE "leases"
  ADD CONSTRAINT "leases_renewed_from_lease_id_fkey"
  FOREIGN KEY ("renewed_from_lease_id") REFERENCES "leases"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "occupancy_events" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "lease_id" UUID NOT NULL,
  "party_id" UUID,
  "event_type" "OccupancyEventType" NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actor_user_id" UUID,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "occupancy_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "occupancy_events_tenant_id_lease_id_occurred_at_idx"
  ON "occupancy_events"("tenant_id", "lease_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "occupancy_events_tenant_id_event_type_occurred_at_idx"
  ON "occupancy_events"("tenant_id", "event_type", "occurred_at");

ALTER TABLE "occupancy_events"
  DROP CONSTRAINT IF EXISTS "occupancy_events_lease_id_fkey";
ALTER TABLE "occupancy_events"
  ADD CONSTRAINT "occupancy_events_lease_id_fkey"
  FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "occupancy_events"
  DROP CONSTRAINT IF EXISTS "occupancy_events_party_id_fkey";
ALTER TABLE "occupancy_events"
  ADD CONSTRAINT "occupancy_events_party_id_fkey"
  FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "occupancy_events"
  DROP CONSTRAINT IF EXISTS "occupancy_events_lease_tenant_fk";
ALTER TABLE "occupancy_events"
  ADD CONSTRAINT "occupancy_events_lease_tenant_fk"
  FOREIGN KEY ("tenant_id", "lease_id") REFERENCES "leases"("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "asset_keys" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "lease_id" UUID NOT NULL,
  "unit_id" UUID,
  "label" TEXT NOT NULL,
  "code" TEXT,
  "status" "AssetKeyStatus" NOT NULL DEFAULT 'ISSUED',
  "issued_at" TIMESTAMP(3) NOT NULL,
  "returned_at" TIMESTAMP(3),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_keys_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "asset_keys_tenant_id_lease_id_status_idx"
  ON "asset_keys"("tenant_id", "lease_id", "status");

ALTER TABLE "asset_keys"
  DROP CONSTRAINT IF EXISTS "asset_keys_lease_id_fkey";
ALTER TABLE "asset_keys"
  ADD CONSTRAINT "asset_keys_lease_id_fkey"
  FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_keys"
  DROP CONSTRAINT IF EXISTS "asset_keys_unit_id_fkey";
ALTER TABLE "asset_keys"
  ADD CONSTRAINT "asset_keys_unit_id_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "asset_keys"
  DROP CONSTRAINT IF EXISTS "asset_keys_lease_tenant_fk";
ALTER TABLE "asset_keys"
  ADD CONSTRAINT "asset_keys_lease_tenant_fk"
  FOREIGN KEY ("tenant_id", "lease_id") REFERENCES "leases"("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
