-- Sprint-10: billing foundation (schedules, invoices, ledger, deposits, meters).

CREATE TYPE "BillingScheduleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');
CREATE TYPE "ChargeRuleType" AS ENUM ('RENT', 'SERVICE', 'FEE', 'UTILITY', 'TAX', 'DISCOUNT', 'DEPOSIT');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'POSTED', 'PARTIALLY_PAID', 'PAID', 'VOID');
CREATE TYPE "CreditNoteStatus" AS ENUM ('DRAFT', 'POSTED', 'VOID');
CREATE TYPE "LedgerAccountType" AS ENUM ('RECEIVABLE', 'LIABILITY', 'REVENUE', 'CONTROL');
CREATE TYPE "LedgerEntrySide" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "SecurityDepositStatus" AS ENUM ('DUE', 'HELD', 'PARTIALLY_DISPOSED', 'CLOSED');
CREATE TYPE "BillingRunStatus" AS ENUM ('DRAFT', 'PREVIEWED', 'APPROVED', 'COMMITTING', 'COMPLETED', 'FAILED', 'PARTIAL');
CREATE TYPE "MeterType" AS ENUM ('ELECTRICITY', 'WATER');
CREATE TYPE "MeterStatus" AS ENUM ('ACTIVE', 'RETIRED');
CREATE TYPE "MeterReadingQuality" AS ENUM ('ACTUAL', 'ESTIMATE', 'CORRECTED');
CREATE TYPE "UtilityAllocationRunStatus" AS ENUM ('DRAFT', 'PREVIEWED', 'COMMITTED', 'FAILED');
CREATE TYPE "LateFeeMethod" AS ENUM ('FLAT', 'PERCENT');

CREATE TABLE IF NOT EXISTS "service_catalog_items" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "calculation_type" TEXT NOT NULL DEFAULT 'FIXED',
  "tax_category" TEXT,
  "default_currency" CHAR(3) NOT NULL,
  "default_rate" DECIMAL(19,4),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_catalog_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "lease_services" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "lease_id" UUID NOT NULL,
  "service_item_id" UUID NOT NULL,
  "quantity" DECIMAL(19,4) NOT NULL DEFAULT 1,
  "rate_override" DECIMAL(19,4),
  "currency" CHAR(3) NOT NULL,
  "cadence" "RentCadence" NOT NULL DEFAULT 'MONTHLY',
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "lease_services_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "billing_schedules" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "lease_id" UUID NOT NULL,
  "property_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "cadence" "RentCadence" NOT NULL DEFAULT 'MONTHLY',
  "time_zone" TEXT NOT NULL,
  "status" "BillingScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
  "next_run_at" TIMESTAMP(3),
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "charge_rules" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "schedule_id" UUID NOT NULL,
  "rule_type" "ChargeRuleType" NOT NULL,
  "charge_key" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(19,4),
  "currency" CHAR(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "version_number" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "charge_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "late_fee_policies" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "property_id" UUID,
  "name" TEXT NOT NULL,
  "method" "LateFeeMethod" NOT NULL,
  "grace_days" INTEGER NOT NULL DEFAULT 5,
  "flat_amount" DECIMAL(19,4),
  "percent_rate" DECIMAL(19,4),
  "cap_amount" DECIMAL(19,4),
  "currency" CHAR(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "late_fee_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "billing_runs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "schedule_id" UUID,
  "property_id" UUID,
  "period_key" TEXT NOT NULL,
  "status" "BillingRunStatus" NOT NULL DEFAULT 'DRAFT',
  "time_zone" TEXT NOT NULL,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "preview_payload" JSONB,
  "totals_amount" DECIMAL(19,4),
  "currency" CHAR(3),
  "scheduled_job_id" TEXT,
  "approved_at" TIMESTAMP(3),
  "approved_by_user_id" UUID,
  "committed_at" TIMESTAMP(3),
  "failure_summary" JSONB,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ledger_accounts" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "account_type" "LedgerAccountType" NOT NULL,
  "currency" CHAR(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "invoices" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "lease_id" UUID NOT NULL,
  "property_id" UUID NOT NULL,
  "billing_run_id" UUID,
  "bill_to_party_id" UUID NOT NULL,
  "invoice_number" TEXT,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" CHAR(3) NOT NULL,
  "issue_date" DATE,
  "due_date" DATE,
  "period_key" TEXT,
  "subtotal_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "total_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "balance_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "posted_at" TIMESTAMP(3),
  "voided_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "invoice_lines" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "line_number" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "charge_key" TEXT NOT NULL,
  "period_key" TEXT,
  "quantity" DECIMAL(19,4) NOT NULL DEFAULT 1,
  "unit_price" DECIMAL(19,4) NOT NULL,
  "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "line_total" DECIMAL(19,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "service_period_start" DATE,
  "service_period_end" DATE,
  "source_type" TEXT,
  "source_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "invoice_status_history" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "from_status" "InvoiceStatus",
  "to_status" "InvoiceStatus" NOT NULL,
  "reason" TEXT,
  "actor_user_id" UUID,
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_status_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "credit_notes" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "lease_id" UUID NOT NULL,
  "credit_note_number" TEXT,
  "status" "CreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" CHAR(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "total_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "posted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "credit_note_lines" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "credit_note_id" UUID NOT NULL,
  "invoice_line_id" UUID,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "credit_note_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ledger_entries" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "account_id" UUID NOT NULL,
  "lease_id" UUID,
  "journal_id" UUID NOT NULL,
  "side" "LedgerEntrySide" NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "effective_at" TIMESTAMP(3) NOT NULL,
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "posting_key" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_id" UUID NOT NULL,
  "description" TEXT,
  "reversal_of_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "opening_balance_entries" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "lease_id" UUID,
  "account_code" TEXT NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "as_of_date" DATE NOT NULL,
  "notes" TEXT,
  "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "opening_balance_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "balance_snapshots" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "lease_id" UUID,
  "party_id" UUID,
  "currency" CHAR(3) NOT NULL,
  "as_of" TIMESTAMP(3) NOT NULL,
  "balance_amount" DECIMAL(19,4) NOT NULL,
  "calculation_version" TEXT NOT NULL DEFAULT 'v1',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "balance_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "security_deposits" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "lease_id" UUID NOT NULL,
  "payer_party_id" UUID NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "amount_due" DECIMAL(19,4) NOT NULL,
  "amount_held" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "status" "SecurityDepositStatus" NOT NULL DEFAULT 'DUE',
  "custody_ref" TEXT,
  "notes" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "security_deposits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "meters" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "property_id" UUID NOT NULL,
  "unit_id" UUID,
  "meter_type" "MeterType" NOT NULL,
  "code" TEXT NOT NULL,
  "serial_number" TEXT,
  "unit_of_measure" TEXT NOT NULL DEFAULT 'kWh',
  "multiplier" DECIMAL(19,4) NOT NULL DEFAULT 1,
  "status" "MeterStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "meters_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "meter_readings" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "meter_id" UUID NOT NULL,
  "read_at" TIMESTAMP(3) NOT NULL,
  "value" DECIMAL(19,4) NOT NULL,
  "quality" "MeterReadingQuality" NOT NULL DEFAULT 'ACTUAL',
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "meter_readings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tariffs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "property_id" UUID NOT NULL,
  "meter_type" "MeterType" NOT NULL,
  "name" TEXT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "rate_per_unit" DECIMAL(19,4) NOT NULL,
  "fixed_charge" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tariffs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "utility_allocation_runs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "property_id" UUID NOT NULL,
  "period_key" TEXT NOT NULL,
  "status" "UtilityAllocationRunStatus" NOT NULL DEFAULT 'DRAFT',
  "method_version" TEXT NOT NULL DEFAULT 'equal_split_v1',
  "preview_payload" JSONB,
  "totals_amount" DECIMAL(19,4),
  "currency" CHAR(3),
  "committed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "utility_allocation_runs_pkey" PRIMARY KEY ("id")
);

-- Unique and search indexes
CREATE UNIQUE INDEX IF NOT EXISTS "service_catalog_items_tenant_id_code_key"
  ON "service_catalog_items"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "service_catalog_items_tenant_id_active_idx"
  ON "service_catalog_items"("tenant_id", "active");

CREATE INDEX IF NOT EXISTS "lease_services_tenant_id_lease_id_idx"
  ON "lease_services"("tenant_id", "lease_id");
CREATE INDEX IF NOT EXISTS "lease_services_tenant_id_service_item_id_idx"
  ON "lease_services"("tenant_id", "service_item_id");

CREATE INDEX IF NOT EXISTS "billing_schedules_tenant_id_lease_id_status_idx"
  ON "billing_schedules"("tenant_id", "lease_id", "status");
CREATE INDEX IF NOT EXISTS "billing_schedules_tenant_id_status_next_run_at_idx"
  ON "billing_schedules"("tenant_id", "status", "next_run_at");

CREATE UNIQUE INDEX IF NOT EXISTS "charge_rules_tenant_id_schedule_id_charge_key_version_number_key"
  ON "charge_rules"("tenant_id", "schedule_id", "charge_key", "version_number");
CREATE INDEX IF NOT EXISTS "charge_rules_tenant_id_schedule_id_active_idx"
  ON "charge_rules"("tenant_id", "schedule_id", "active");

CREATE INDEX IF NOT EXISTS "late_fee_policies_tenant_id_active_idx"
  ON "late_fee_policies"("tenant_id", "active");

CREATE UNIQUE INDEX IF NOT EXISTS "billing_runs_tenant_id_period_key_schedule_id_key"
  ON "billing_runs"("tenant_id", "period_key", "schedule_id");
CREATE INDEX IF NOT EXISTS "billing_runs_tenant_id_status_period_key_idx"
  ON "billing_runs"("tenant_id", "status", "period_key");

CREATE UNIQUE INDEX IF NOT EXISTS "ledger_accounts_tenant_id_code_key"
  ON "ledger_accounts"("tenant_id", "code");

CREATE UNIQUE INDEX IF NOT EXISTS "invoices_tenant_id_invoice_number_key"
  ON "invoices"("tenant_id", "invoice_number");
CREATE INDEX IF NOT EXISTS "invoices_tenant_id_lease_id_status_idx"
  ON "invoices"("tenant_id", "lease_id", "status");
CREATE INDEX IF NOT EXISTS "invoices_tenant_id_property_id_status_idx"
  ON "invoices"("tenant_id", "property_id", "status");
CREATE INDEX IF NOT EXISTS "invoices_tenant_id_due_date_status_idx"
  ON "invoices"("tenant_id", "due_date", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "invoice_lines_tenant_id_invoice_id_charge_key_key"
  ON "invoice_lines"("tenant_id", "invoice_id", "charge_key");
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_lines_invoice_id_line_number_key"
  ON "invoice_lines"("invoice_id", "line_number");
CREATE INDEX IF NOT EXISTS "invoice_lines_tenant_id_invoice_id_idx"
  ON "invoice_lines"("tenant_id", "invoice_id");

CREATE INDEX IF NOT EXISTS "invoice_status_history_tenant_id_invoice_id_recorded_at_idx"
  ON "invoice_status_history"("tenant_id", "invoice_id", "recorded_at");

CREATE UNIQUE INDEX IF NOT EXISTS "credit_notes_tenant_id_credit_note_number_key"
  ON "credit_notes"("tenant_id", "credit_note_number");
CREATE INDEX IF NOT EXISTS "credit_notes_tenant_id_invoice_id_idx"
  ON "credit_notes"("tenant_id", "invoice_id");

CREATE INDEX IF NOT EXISTS "credit_note_lines_tenant_id_credit_note_id_idx"
  ON "credit_note_lines"("tenant_id", "credit_note_id");

CREATE UNIQUE INDEX IF NOT EXISTS "ledger_entries_tenant_id_posting_key_key"
  ON "ledger_entries"("tenant_id", "posting_key");
CREATE INDEX IF NOT EXISTS "ledger_entries_tenant_id_lease_id_effective_at_idx"
  ON "ledger_entries"("tenant_id", "lease_id", "effective_at");
CREATE INDEX IF NOT EXISTS "ledger_entries_tenant_id_account_id_effective_at_idx"
  ON "ledger_entries"("tenant_id", "account_id", "effective_at");

CREATE INDEX IF NOT EXISTS "opening_balance_entries_tenant_id_as_of_date_idx"
  ON "opening_balance_entries"("tenant_id", "as_of_date");

CREATE UNIQUE INDEX IF NOT EXISTS "balance_snapshots_tenant_id_lease_id_currency_as_of_calculation_version_key"
  ON "balance_snapshots"("tenant_id", "lease_id", "currency", "as_of", "calculation_version");
CREATE INDEX IF NOT EXISTS "balance_snapshots_tenant_id_as_of_idx"
  ON "balance_snapshots"("tenant_id", "as_of");

CREATE UNIQUE INDEX IF NOT EXISTS "security_deposits_tenant_id_lease_id_key"
  ON "security_deposits"("tenant_id", "lease_id");
CREATE INDEX IF NOT EXISTS "security_deposits_tenant_id_status_idx"
  ON "security_deposits"("tenant_id", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "meters_tenant_id_property_id_code_key"
  ON "meters"("tenant_id", "property_id", "code");
CREATE INDEX IF NOT EXISTS "meters_tenant_id_property_id_status_idx"
  ON "meters"("tenant_id", "property_id", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "meter_readings_tenant_id_meter_id_read_at_source_key"
  ON "meter_readings"("tenant_id", "meter_id", "read_at", "source");
CREATE INDEX IF NOT EXISTS "meter_readings_tenant_id_meter_id_read_at_idx"
  ON "meter_readings"("tenant_id", "meter_id", "read_at" DESC);

CREATE INDEX IF NOT EXISTS "tariffs_tenant_id_property_id_meter_type_active_idx"
  ON "tariffs"("tenant_id", "property_id", "meter_type", "active");

CREATE UNIQUE INDEX IF NOT EXISTS "utility_allocation_runs_tenant_id_property_id_period_key_method_version_key"
  ON "utility_allocation_runs"("tenant_id", "property_id", "period_key", "method_version");
CREATE INDEX IF NOT EXISTS "utility_allocation_runs_tenant_id_status_idx"
  ON "utility_allocation_runs"("tenant_id", "status");

-- Parent uniqueness for composite tenant FK targets
CREATE UNIQUE INDEX IF NOT EXISTS "service_catalog_items_tenant_id_id_key"
  ON "service_catalog_items"("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "billing_schedules_tenant_id_id_key"
  ON "billing_schedules"("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "billing_runs_tenant_id_id_key"
  ON "billing_runs"("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "ledger_accounts_tenant_id_id_key"
  ON "ledger_accounts"("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_tenant_id_id_key"
  ON "invoices"("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "credit_notes_tenant_id_id_key"
  ON "credit_notes"("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "meters_tenant_id_id_key"
  ON "meters"("tenant_id", "id");

-- Tenant FKs
ALTER TABLE "service_catalog_items"
  DROP CONSTRAINT IF EXISTS "service_catalog_items_tenant_id_fkey";
ALTER TABLE "service_catalog_items"
  ADD CONSTRAINT "service_catalog_items_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lease_services"
  DROP CONSTRAINT IF EXISTS "lease_services_tenant_id_fkey";
ALTER TABLE "lease_services"
  ADD CONSTRAINT "lease_services_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "billing_schedules"
  DROP CONSTRAINT IF EXISTS "billing_schedules_tenant_id_fkey";
ALTER TABLE "billing_schedules"
  ADD CONSTRAINT "billing_schedules_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "charge_rules"
  DROP CONSTRAINT IF EXISTS "charge_rules_tenant_id_fkey";
ALTER TABLE "charge_rules"
  ADD CONSTRAINT "charge_rules_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "late_fee_policies"
  DROP CONSTRAINT IF EXISTS "late_fee_policies_tenant_id_fkey";
ALTER TABLE "late_fee_policies"
  ADD CONSTRAINT "late_fee_policies_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "billing_runs"
  DROP CONSTRAINT IF EXISTS "billing_runs_tenant_id_fkey";
ALTER TABLE "billing_runs"
  ADD CONSTRAINT "billing_runs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ledger_accounts"
  DROP CONSTRAINT IF EXISTS "ledger_accounts_tenant_id_fkey";
ALTER TABLE "ledger_accounts"
  ADD CONSTRAINT "ledger_accounts_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoices"
  DROP CONSTRAINT IF EXISTS "invoices_tenant_id_fkey";
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoice_lines"
  DROP CONSTRAINT IF EXISTS "invoice_lines_tenant_id_fkey";
ALTER TABLE "invoice_lines"
  ADD CONSTRAINT "invoice_lines_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoice_status_history"
  DROP CONSTRAINT IF EXISTS "invoice_status_history_tenant_id_fkey";
ALTER TABLE "invoice_status_history"
  ADD CONSTRAINT "invoice_status_history_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "credit_notes"
  DROP CONSTRAINT IF EXISTS "credit_notes_tenant_id_fkey";
ALTER TABLE "credit_notes"
  ADD CONSTRAINT "credit_notes_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "credit_note_lines"
  DROP CONSTRAINT IF EXISTS "credit_note_lines_tenant_id_fkey";
ALTER TABLE "credit_note_lines"
  ADD CONSTRAINT "credit_note_lines_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ledger_entries"
  DROP CONSTRAINT IF EXISTS "ledger_entries_tenant_id_fkey";
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "opening_balance_entries"
  DROP CONSTRAINT IF EXISTS "opening_balance_entries_tenant_id_fkey";
ALTER TABLE "opening_balance_entries"
  ADD CONSTRAINT "opening_balance_entries_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "balance_snapshots"
  DROP CONSTRAINT IF EXISTS "balance_snapshots_tenant_id_fkey";
ALTER TABLE "balance_snapshots"
  ADD CONSTRAINT "balance_snapshots_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "security_deposits"
  DROP CONSTRAINT IF EXISTS "security_deposits_tenant_id_fkey";
ALTER TABLE "security_deposits"
  ADD CONSTRAINT "security_deposits_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meters"
  DROP CONSTRAINT IF EXISTS "meters_tenant_id_fkey";
ALTER TABLE "meters"
  ADD CONSTRAINT "meters_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meter_readings"
  DROP CONSTRAINT IF EXISTS "meter_readings_tenant_id_fkey";
ALTER TABLE "meter_readings"
  ADD CONSTRAINT "meter_readings_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tariffs"
  DROP CONSTRAINT IF EXISTS "tariffs_tenant_id_fkey";
ALTER TABLE "tariffs"
  ADD CONSTRAINT "tariffs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "utility_allocation_runs"
  DROP CONSTRAINT IF EXISTS "utility_allocation_runs_tenant_id_fkey";
ALTER TABLE "utility_allocation_runs"
  ADD CONSTRAINT "utility_allocation_runs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Single-column relation FKs (Prisma onDelete semantics)
ALTER TABLE "lease_services"
  DROP CONSTRAINT IF EXISTS "lease_services_lease_id_fkey";
ALTER TABLE "lease_services"
  ADD CONSTRAINT "lease_services_lease_id_fkey"
  FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lease_services"
  DROP CONSTRAINT IF EXISTS "lease_services_service_item_id_fkey";
ALTER TABLE "lease_services"
  ADD CONSTRAINT "lease_services_service_item_id_fkey"
  FOREIGN KEY ("service_item_id") REFERENCES "service_catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_schedules"
  DROP CONSTRAINT IF EXISTS "billing_schedules_lease_id_fkey";
ALTER TABLE "billing_schedules"
  ADD CONSTRAINT "billing_schedules_lease_id_fkey"
  FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "billing_schedules"
  DROP CONSTRAINT IF EXISTS "billing_schedules_property_id_fkey";
ALTER TABLE "billing_schedules"
  ADD CONSTRAINT "billing_schedules_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "charge_rules"
  DROP CONSTRAINT IF EXISTS "charge_rules_schedule_id_fkey";
ALTER TABLE "charge_rules"
  ADD CONSTRAINT "charge_rules_schedule_id_fkey"
  FOREIGN KEY ("schedule_id") REFERENCES "billing_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "late_fee_policies"
  DROP CONSTRAINT IF EXISTS "late_fee_policies_property_id_fkey";
ALTER TABLE "late_fee_policies"
  ADD CONSTRAINT "late_fee_policies_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "billing_runs"
  DROP CONSTRAINT IF EXISTS "billing_runs_schedule_id_fkey";
ALTER TABLE "billing_runs"
  ADD CONSTRAINT "billing_runs_schedule_id_fkey"
  FOREIGN KEY ("schedule_id") REFERENCES "billing_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "billing_runs"
  DROP CONSTRAINT IF EXISTS "billing_runs_property_id_fkey";
ALTER TABLE "billing_runs"
  ADD CONSTRAINT "billing_runs_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoices"
  DROP CONSTRAINT IF EXISTS "invoices_lease_id_fkey";
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_lease_id_fkey"
  FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices"
  DROP CONSTRAINT IF EXISTS "invoices_property_id_fkey";
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices"
  DROP CONSTRAINT IF EXISTS "invoices_bill_to_party_id_fkey";
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_bill_to_party_id_fkey"
  FOREIGN KEY ("bill_to_party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices"
  DROP CONSTRAINT IF EXISTS "invoices_billing_run_id_fkey";
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_billing_run_id_fkey"
  FOREIGN KEY ("billing_run_id") REFERENCES "billing_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoice_lines"
  DROP CONSTRAINT IF EXISTS "invoice_lines_invoice_id_fkey";
ALTER TABLE "invoice_lines"
  ADD CONSTRAINT "invoice_lines_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoice_status_history"
  DROP CONSTRAINT IF EXISTS "invoice_status_history_invoice_id_fkey";
ALTER TABLE "invoice_status_history"
  ADD CONSTRAINT "invoice_status_history_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "credit_notes"
  DROP CONSTRAINT IF EXISTS "credit_notes_invoice_id_fkey";
ALTER TABLE "credit_notes"
  ADD CONSTRAINT "credit_notes_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "credit_notes"
  DROP CONSTRAINT IF EXISTS "credit_notes_lease_id_fkey";
ALTER TABLE "credit_notes"
  ADD CONSTRAINT "credit_notes_lease_id_fkey"
  FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "credit_note_lines"
  DROP CONSTRAINT IF EXISTS "credit_note_lines_credit_note_id_fkey";
ALTER TABLE "credit_note_lines"
  ADD CONSTRAINT "credit_note_lines_credit_note_id_fkey"
  FOREIGN KEY ("credit_note_id") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "credit_note_lines"
  DROP CONSTRAINT IF EXISTS "credit_note_lines_invoice_line_id_fkey";
ALTER TABLE "credit_note_lines"
  ADD CONSTRAINT "credit_note_lines_invoice_line_id_fkey"
  FOREIGN KEY ("invoice_line_id") REFERENCES "invoice_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ledger_entries"
  DROP CONSTRAINT IF EXISTS "ledger_entries_account_id_fkey";
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ledger_entries"
  DROP CONSTRAINT IF EXISTS "ledger_entries_lease_id_fkey";
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_lease_id_fkey"
  FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "security_deposits"
  DROP CONSTRAINT IF EXISTS "security_deposits_lease_id_fkey";
ALTER TABLE "security_deposits"
  ADD CONSTRAINT "security_deposits_lease_id_fkey"
  FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "security_deposits"
  DROP CONSTRAINT IF EXISTS "security_deposits_payer_party_id_fkey";
ALTER TABLE "security_deposits"
  ADD CONSTRAINT "security_deposits_payer_party_id_fkey"
  FOREIGN KEY ("payer_party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "meters"
  DROP CONSTRAINT IF EXISTS "meters_property_id_fkey";
ALTER TABLE "meters"
  ADD CONSTRAINT "meters_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "meter_readings"
  DROP CONSTRAINT IF EXISTS "meter_readings_meter_id_fkey";
ALTER TABLE "meter_readings"
  ADD CONSTRAINT "meter_readings_meter_id_fkey"
  FOREIGN KEY ("meter_id") REFERENCES "meters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tariffs"
  DROP CONSTRAINT IF EXISTS "tariffs_property_id_fkey";
ALTER TABLE "tariffs"
  ADD CONSTRAINT "tariffs_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "utility_allocation_runs"
  DROP CONSTRAINT IF EXISTS "utility_allocation_runs_property_id_fkey";
ALTER TABLE "utility_allocation_runs"
  ADD CONSTRAINT "utility_allocation_runs_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Composite tenant-complete FKs
ALTER TABLE "lease_services"
  DROP CONSTRAINT IF EXISTS "lease_services_lease_tenant_fk";
ALTER TABLE "lease_services"
  ADD CONSTRAINT "lease_services_lease_tenant_fk"
  FOREIGN KEY ("tenant_id", "lease_id") REFERENCES "leases"("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lease_services"
  DROP CONSTRAINT IF EXISTS "lease_services_service_item_tenant_fk";
ALTER TABLE "lease_services"
  ADD CONSTRAINT "lease_services_service_item_tenant_fk"
  FOREIGN KEY ("tenant_id", "service_item_id") REFERENCES "service_catalog_items"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_schedules"
  DROP CONSTRAINT IF EXISTS "billing_schedules_lease_tenant_fk";
ALTER TABLE "billing_schedules"
  ADD CONSTRAINT "billing_schedules_lease_tenant_fk"
  FOREIGN KEY ("tenant_id", "lease_id") REFERENCES "leases"("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "billing_schedules"
  DROP CONSTRAINT IF EXISTS "billing_schedules_property_tenant_fk";
ALTER TABLE "billing_schedules"
  ADD CONSTRAINT "billing_schedules_property_tenant_fk"
  FOREIGN KEY ("tenant_id", "property_id") REFERENCES "properties"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "charge_rules"
  DROP CONSTRAINT IF EXISTS "charge_rules_schedule_tenant_fk";
ALTER TABLE "charge_rules"
  ADD CONSTRAINT "charge_rules_schedule_tenant_fk"
  FOREIGN KEY ("tenant_id", "schedule_id") REFERENCES "billing_schedules"("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "late_fee_policies"
  DROP CONSTRAINT IF EXISTS "late_fee_policies_property_tenant_fk";
ALTER TABLE "late_fee_policies"
  ADD CONSTRAINT "late_fee_policies_property_tenant_fk"
  FOREIGN KEY ("tenant_id", "property_id") REFERENCES "properties"("tenant_id", "id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "billing_runs"
  DROP CONSTRAINT IF EXISTS "billing_runs_schedule_tenant_fk";
ALTER TABLE "billing_runs"
  ADD CONSTRAINT "billing_runs_schedule_tenant_fk"
  FOREIGN KEY ("tenant_id", "schedule_id") REFERENCES "billing_schedules"("tenant_id", "id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "billing_runs"
  DROP CONSTRAINT IF EXISTS "billing_runs_property_tenant_fk";
ALTER TABLE "billing_runs"
  ADD CONSTRAINT "billing_runs_property_tenant_fk"
  FOREIGN KEY ("tenant_id", "property_id") REFERENCES "properties"("tenant_id", "id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoices"
  DROP CONSTRAINT IF EXISTS "invoices_lease_tenant_fk";
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_lease_tenant_fk"
  FOREIGN KEY ("tenant_id", "lease_id") REFERENCES "leases"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices"
  DROP CONSTRAINT IF EXISTS "invoices_property_tenant_fk";
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_property_tenant_fk"
  FOREIGN KEY ("tenant_id", "property_id") REFERENCES "properties"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices"
  DROP CONSTRAINT IF EXISTS "invoices_bill_to_party_tenant_fk";
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_bill_to_party_tenant_fk"
  FOREIGN KEY ("tenant_id", "bill_to_party_id") REFERENCES "parties"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices"
  DROP CONSTRAINT IF EXISTS "invoices_billing_run_tenant_fk";
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_billing_run_tenant_fk"
  FOREIGN KEY ("tenant_id", "billing_run_id") REFERENCES "billing_runs"("tenant_id", "id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoice_lines"
  DROP CONSTRAINT IF EXISTS "invoice_lines_invoice_tenant_fk";
ALTER TABLE "invoice_lines"
  ADD CONSTRAINT "invoice_lines_invoice_tenant_fk"
  FOREIGN KEY ("tenant_id", "invoice_id") REFERENCES "invoices"("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoice_status_history"
  DROP CONSTRAINT IF EXISTS "invoice_status_history_invoice_tenant_fk";
ALTER TABLE "invoice_status_history"
  ADD CONSTRAINT "invoice_status_history_invoice_tenant_fk"
  FOREIGN KEY ("tenant_id", "invoice_id") REFERENCES "invoices"("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "credit_notes"
  DROP CONSTRAINT IF EXISTS "credit_notes_invoice_tenant_fk";
ALTER TABLE "credit_notes"
  ADD CONSTRAINT "credit_notes_invoice_tenant_fk"
  FOREIGN KEY ("tenant_id", "invoice_id") REFERENCES "invoices"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "credit_notes"
  DROP CONSTRAINT IF EXISTS "credit_notes_lease_tenant_fk";
ALTER TABLE "credit_notes"
  ADD CONSTRAINT "credit_notes_lease_tenant_fk"
  FOREIGN KEY ("tenant_id", "lease_id") REFERENCES "leases"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "credit_note_lines"
  DROP CONSTRAINT IF EXISTS "credit_note_lines_credit_note_tenant_fk";
ALTER TABLE "credit_note_lines"
  ADD CONSTRAINT "credit_note_lines_credit_note_tenant_fk"
  FOREIGN KEY ("tenant_id", "credit_note_id") REFERENCES "credit_notes"("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ledger_entries"
  DROP CONSTRAINT IF EXISTS "ledger_entries_account_tenant_fk";
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_account_tenant_fk"
  FOREIGN KEY ("tenant_id", "account_id") REFERENCES "ledger_accounts"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ledger_entries"
  DROP CONSTRAINT IF EXISTS "ledger_entries_lease_tenant_fk";
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_lease_tenant_fk"
  FOREIGN KEY ("tenant_id", "lease_id") REFERENCES "leases"("tenant_id", "id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "security_deposits"
  DROP CONSTRAINT IF EXISTS "security_deposits_lease_tenant_fk";
ALTER TABLE "security_deposits"
  ADD CONSTRAINT "security_deposits_lease_tenant_fk"
  FOREIGN KEY ("tenant_id", "lease_id") REFERENCES "leases"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "security_deposits"
  DROP CONSTRAINT IF EXISTS "security_deposits_payer_party_tenant_fk";
ALTER TABLE "security_deposits"
  ADD CONSTRAINT "security_deposits_payer_party_tenant_fk"
  FOREIGN KEY ("tenant_id", "payer_party_id") REFERENCES "parties"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "meters"
  DROP CONSTRAINT IF EXISTS "meters_property_tenant_fk";
ALTER TABLE "meters"
  ADD CONSTRAINT "meters_property_tenant_fk"
  FOREIGN KEY ("tenant_id", "property_id") REFERENCES "properties"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "meter_readings"
  DROP CONSTRAINT IF EXISTS "meter_readings_meter_tenant_fk";
ALTER TABLE "meter_readings"
  ADD CONSTRAINT "meter_readings_meter_tenant_fk"
  FOREIGN KEY ("tenant_id", "meter_id") REFERENCES "meters"("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tariffs"
  DROP CONSTRAINT IF EXISTS "tariffs_property_tenant_fk";
ALTER TABLE "tariffs"
  ADD CONSTRAINT "tariffs_property_tenant_fk"
  FOREIGN KEY ("tenant_id", "property_id") REFERENCES "properties"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "utility_allocation_runs"
  DROP CONSTRAINT IF EXISTS "utility_allocation_runs_property_tenant_fk";
ALTER TABLE "utility_allocation_runs"
  ADD CONSTRAINT "utility_allocation_runs_property_tenant_fk"
  FOREIGN KEY ("tenant_id", "property_id") REFERENCES "properties"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
