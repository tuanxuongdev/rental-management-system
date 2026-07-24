-- Sprint-12: reconciliation runs/items, accounting periods, payment reversals, refund/disposition SoD columns.

CREATE TYPE "AccountingPeriodStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "ReconciliationSourceType" AS ENUM ('PROVIDER', 'BANK_FILE', 'CASH_UP');
CREATE TYPE "ReconciliationRunStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'PENDING_APPROVAL', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ReconciliationItemStatus" AS ENUM ('SUGGESTED', 'MATCHED', 'UNMATCHED', 'EXCEPTION_ACCEPTED', 'DISPUTED', 'RESOLVED');
CREATE TYPE "PaymentReconciliationStatus" AS ENUM ('UNRECONCILED', 'MATCHED', 'EXCEPTION');
CREATE TYPE "PaymentReversalStatus" AS ENUM ('PENDING', 'EXECUTED');

CREATE TABLE IF NOT EXISTS "accounting_periods" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "period_key" TEXT NOT NULL,
  "status" "AccountingPeriodStatus" NOT NULL DEFAULT 'OPEN',
  "closed_at" TIMESTAMP(3),
  "closed_by_user_id" UUID,
  "reopen_reason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_periods_tenant_id_period_key_key"
  ON "accounting_periods"("tenant_id", "period_key");
CREATE UNIQUE INDEX IF NOT EXISTS "accounting_periods_tenant_id_id_key"
  ON "accounting_periods"("tenant_id", "id");
CREATE INDEX IF NOT EXISTS "accounting_periods_tenant_id_status_idx"
  ON "accounting_periods"("tenant_id", "status");

ALTER TABLE "accounting_periods"
  ADD CONSTRAINT "accounting_periods_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "reconciliation_runs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "source_type" "ReconciliationSourceType" NOT NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "status" "ReconciliationRunStatus" NOT NULL DEFAULT 'DRAFT',
  "provider" TEXT,
  "document_id" UUID,
  "control_total" DECIMAL(19,4),
  "matched_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "unmatched_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "variance_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "tolerance_amount" DECIMAL(19,4) NOT NULL DEFAULT 0.0100,
  "override_reason" TEXT,
  "prepared_by_user_id" UUID NOT NULL,
  "approved_by_user_id" UUID,
  "completed_at" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reconciliation_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "reconciliation_runs_tenant_id_id_key"
  ON "reconciliation_runs"("tenant_id", "id");
CREATE INDEX IF NOT EXISTS "reconciliation_runs_tenant_id_status_idx"
  ON "reconciliation_runs"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "reconciliation_runs_tenant_id_period_start_period_end_idx"
  ON "reconciliation_runs"("tenant_id", "period_start", "period_end");

ALTER TABLE "reconciliation_runs"
  ADD CONSTRAINT "reconciliation_runs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "reconciliation_items" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "run_id" UUID NOT NULL,
  "status" "ReconciliationItemStatus" NOT NULL DEFAULT 'UNMATCHED',
  "external_reference" TEXT,
  "external_amount" DECIMAL(19,4),
  "external_date" DATE,
  "payment_transaction_id" UUID,
  "resolution_code" TEXT,
  "resolution_reason" TEXT,
  "assigned_to_user_id" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reconciliation_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "reconciliation_items_tenant_id_id_key"
  ON "reconciliation_items"("tenant_id", "id");
CREATE INDEX IF NOT EXISTS "reconciliation_items_tenant_id_run_id_status_idx"
  ON "reconciliation_items"("tenant_id", "run_id", "status");
CREATE INDEX IF NOT EXISTS "reconciliation_items_tenant_id_payment_transaction_id_idx"
  ON "reconciliation_items"("tenant_id", "payment_transaction_id");

ALTER TABLE "reconciliation_items"
  ADD CONSTRAINT "reconciliation_items_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reconciliation_items"
  ADD CONSTRAINT "reconciliation_items_tenant_run_fkey"
  FOREIGN KEY ("tenant_id", "run_id") REFERENCES "reconciliation_runs"("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reconciliation_items"
  ADD CONSTRAINT "reconciliation_items_payment_transaction_id_fkey"
  FOREIGN KEY ("payment_transaction_id") REFERENCES "payment_transactions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "payment_reversals" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "payment_transaction_id" UUID NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "PaymentReversalStatus" NOT NULL DEFAULT 'PENDING',
  "requested_by_user_id" UUID NOT NULL,
  "executed_by_user_id" UUID,
  "executed_at" TIMESTAMP(3),
  "ledger_journal_id" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_reversals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_reversals_tenant_id_id_key"
  ON "payment_reversals"("tenant_id", "id");
CREATE INDEX IF NOT EXISTS "payment_reversals_tenant_id_payment_transaction_id_idx"
  ON "payment_reversals"("tenant_id", "payment_transaction_id");
CREATE INDEX IF NOT EXISTS "payment_reversals_tenant_id_status_idx"
  ON "payment_reversals"("tenant_id", "status");

ALTER TABLE "payment_reversals"
  ADD CONSTRAINT "payment_reversals_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_reversals"
  ADD CONSTRAINT "payment_reversals_payment_transaction_id_fkey"
  FOREIGN KEY ("payment_transaction_id") REFERENCES "payment_transactions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Expand payment_transactions
ALTER TABLE "payment_transactions"
  ADD COLUMN IF NOT EXISTS "reconciliation_status" "PaymentReconciliationStatus" NOT NULL DEFAULT 'UNRECONCILED';

CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_tenant_id_id_key"
  ON "payment_transactions"("tenant_id", "id");
CREATE INDEX IF NOT EXISTS "payment_transactions_tenant_id_reconciliation_status_idx"
  ON "payment_transactions"("tenant_id", "reconciliation_status");

-- Expand refunds for SoD execute
ALTER TABLE "refunds"
  ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "executed_by_user_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "refunds_tenant_id_id_key"
  ON "refunds"("tenant_id", "id");

-- Expand disposition lines for executor identity
ALTER TABLE "security_deposit_disposition_lines"
  ADD COLUMN IF NOT EXISTS "executed_by_user_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "security_deposit_disposition_lines_tenant_id_id_key"
  ON "security_deposit_disposition_lines"("tenant_id", "id");

-- Aging on-read support indexes (no snapshot table)
CREATE INDEX IF NOT EXISTS "invoices_tenant_id_status_due_date_idx"
  ON "invoices"("tenant_id", "status", "due_date")
  WHERE "status" IN ('POSTED', 'PARTIALLY_PAID');
