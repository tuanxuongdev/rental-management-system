-- Sprint-11: payments, receipts, refunds, webhooks, thin deposit disposition.

CREATE TYPE "PaymentChannel" AS ENUM ('CASH', 'BANK_TRANSFER', 'QR', 'CHECK', 'CARD_HOSTED', 'OTHER');
CREATE TYPE "PaymentIntentStatus" AS ENUM ('CREATED', 'REQUIRES_ACTION', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('PENDING', 'SETTLED', 'FAILED', 'REVERSED');
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'APPROVED', 'EXECUTED', 'REJECTED', 'CANCELLED');
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED');
CREATE TYPE "DepositDispositionType" AS ENUM ('DEDUCTION', 'REFUND', 'FORFEIT', 'TRANSFER', 'REMAINING_HELD');
CREATE TYPE "DepositDispositionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'EXECUTED', 'REJECTED');

CREATE TABLE IF NOT EXISTS "payment_intents" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "lease_id" UUID,
  "invoice_id" UUID,
  "payer_party_id" UUID,
  "amount" DECIMAL(19,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "channel" "PaymentChannel" NOT NULL DEFAULT 'CARD_HOSTED',
  "status" "PaymentIntentStatus" NOT NULL DEFAULT 'CREATED',
  "provider" TEXT NOT NULL DEFAULT 'sandbox',
  "provider_intent_id" TEXT,
  "idempotency_key" TEXT,
  "checkout_url" TEXT,
  "failure_reason" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "payment_transactions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "intent_id" UUID,
  "lease_id" UUID,
  "property_id" UUID,
  "payer_party_id" UUID,
  "amount" DECIMAL(19,4) NOT NULL,
  "unallocated_amount" DECIMAL(19,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "channel" "PaymentChannel" NOT NULL,
  "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'SETTLED',
  "external_reference" TEXT,
  "provider" TEXT,
  "provider_payment_id" TEXT,
  "received_at" TIMESTAMP(3) NOT NULL,
  "accounting_at" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "evidence_document_id" UUID,
  "recorded_by_user_id" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "payment_allocations" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "payment_transaction_id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "effective_at" TIMESTAMP(3) NOT NULL,
  "reversed_at" TIMESTAMP(3),
  "reversal_of_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "refunds" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "payment_transaction_id" UUID NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
  "requested_by_user_id" UUID,
  "approved_by_user_id" UUID,
  "executed_at" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "provider_webhook_events" (
  "id" UUID NOT NULL,
  "tenant_id" UUID,
  "provider" TEXT NOT NULL,
  "external_event_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "signature_valid" BOOLEAN NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "processing_status" "WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
  "processed_at" TIMESTAMP(3),
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "payment_receipts" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "payment_transaction_id" UUID NOT NULL,
  "receipt_number" TEXT NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "summary" JSONB NOT NULL DEFAULT '{}',
  "document_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "security_deposit_disposition_lines" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "deposit_id" UUID NOT NULL,
  "disposition_type" "DepositDispositionType" NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "DepositDispositionStatus" NOT NULL DEFAULT 'DRAFT',
  "effective_at" TIMESTAMP(3) NOT NULL,
  "executed_at" TIMESTAMP(3),
  "requested_by_user_id" UUID,
  "approved_by_user_id" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "security_deposit_disposition_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_intents_tenant_id_idempotency_key_key"
  ON "payment_intents"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_intents_tenant_id_provider_provider_intent_id_key"
  ON "payment_intents"("tenant_id", "provider", "provider_intent_id");
CREATE INDEX IF NOT EXISTS "payment_intents_tenant_id_status_created_at_idx"
  ON "payment_intents"("tenant_id", "status", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_tenant_id_provider_provider_payment_id_key"
  ON "payment_transactions"("tenant_id", "provider", "provider_payment_id");
CREATE INDEX IF NOT EXISTS "payment_transactions_tenant_id_status_received_at_idx"
  ON "payment_transactions"("tenant_id", "status", "received_at");
CREATE INDEX IF NOT EXISTS "payment_transactions_tenant_id_lease_id_idx"
  ON "payment_transactions"("tenant_id", "lease_id");
CREATE INDEX IF NOT EXISTS "payment_transactions_tenant_id_property_id_idx"
  ON "payment_transactions"("tenant_id", "property_id");
CREATE INDEX IF NOT EXISTS "payment_transactions_tenant_id_external_reference_idx"
  ON "payment_transactions"("tenant_id", "external_reference");

CREATE INDEX IF NOT EXISTS "payment_allocations_tenant_id_payment_transaction_id_idx"
  ON "payment_allocations"("tenant_id", "payment_transaction_id");
CREATE INDEX IF NOT EXISTS "payment_allocations_tenant_id_invoice_id_idx"
  ON "payment_allocations"("tenant_id", "invoice_id");

CREATE INDEX IF NOT EXISTS "refunds_tenant_id_status_idx"
  ON "refunds"("tenant_id", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "provider_webhook_events_provider_external_event_id_key"
  ON "provider_webhook_events"("provider", "external_event_id");
CREATE INDEX IF NOT EXISTS "provider_webhook_events_processing_status_created_at_idx"
  ON "provider_webhook_events"("processing_status", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "payment_receipts_payment_transaction_id_key"
  ON "payment_receipts"("payment_transaction_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_receipts_tenant_id_receipt_number_key"
  ON "payment_receipts"("tenant_id", "receipt_number");
CREATE INDEX IF NOT EXISTS "payment_receipts_tenant_id_issued_at_idx"
  ON "payment_receipts"("tenant_id", "issued_at");

CREATE INDEX IF NOT EXISTS "security_deposit_disposition_lines_tenant_id_deposit_id_status_idx"
  ON "security_deposit_disposition_lines"("tenant_id", "deposit_id", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_tenant_id_id_key"
  ON "payment_transactions"("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "security_deposits_tenant_id_id_key"
  ON "security_deposits"("tenant_id", "id");

ALTER TABLE "payment_intents"
  DROP CONSTRAINT IF EXISTS "payment_intents_tenant_id_fkey";
ALTER TABLE "payment_intents"
  ADD CONSTRAINT "payment_intents_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_transactions"
  DROP CONSTRAINT IF EXISTS "payment_transactions_tenant_id_fkey";
ALTER TABLE "payment_transactions"
  ADD CONSTRAINT "payment_transactions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_transactions"
  DROP CONSTRAINT IF EXISTS "payment_transactions_intent_id_fkey";
ALTER TABLE "payment_transactions"
  ADD CONSTRAINT "payment_transactions_intent_id_fkey"
  FOREIGN KEY ("intent_id") REFERENCES "payment_intents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_allocations"
  DROP CONSTRAINT IF EXISTS "payment_allocations_tenant_id_fkey";
ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_allocations"
  DROP CONSTRAINT IF EXISTS "payment_allocations_payment_transaction_id_fkey";
ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_payment_transaction_id_fkey"
  FOREIGN KEY ("payment_transaction_id") REFERENCES "payment_transactions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_allocations"
  DROP CONSTRAINT IF EXISTS "payment_allocations_invoice_id_fkey";
ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "refunds"
  DROP CONSTRAINT IF EXISTS "refunds_tenant_id_fkey";
ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "refunds"
  DROP CONSTRAINT IF EXISTS "refunds_payment_transaction_id_fkey";
ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_payment_transaction_id_fkey"
  FOREIGN KEY ("payment_transaction_id") REFERENCES "payment_transactions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_receipts"
  DROP CONSTRAINT IF EXISTS "payment_receipts_tenant_id_fkey";
ALTER TABLE "payment_receipts"
  ADD CONSTRAINT "payment_receipts_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_receipts"
  DROP CONSTRAINT IF EXISTS "payment_receipts_payment_transaction_id_fkey";
ALTER TABLE "payment_receipts"
  ADD CONSTRAINT "payment_receipts_payment_transaction_id_fkey"
  FOREIGN KEY ("payment_transaction_id") REFERENCES "payment_transactions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "security_deposit_disposition_lines"
  DROP CONSTRAINT IF EXISTS "security_deposit_disposition_lines_tenant_id_fkey";
ALTER TABLE "security_deposit_disposition_lines"
  ADD CONSTRAINT "security_deposit_disposition_lines_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "security_deposit_disposition_lines"
  DROP CONSTRAINT IF EXISTS "security_deposit_disposition_lines_deposit_id_fkey";
ALTER TABLE "security_deposit_disposition_lines"
  ADD CONSTRAINT "security_deposit_disposition_lines_deposit_id_fkey"
  FOREIGN KEY ("deposit_id") REFERENCES "security_deposits"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_allocations"
  DROP CONSTRAINT IF EXISTS "payment_allocations_invoice_tenant_fk";
ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_invoice_tenant_fk"
  FOREIGN KEY ("tenant_id", "invoice_id") REFERENCES "invoices"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_allocations"
  DROP CONSTRAINT IF EXISTS "payment_allocations_payment_tenant_fk";
ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_payment_tenant_fk"
  FOREIGN KEY ("tenant_id", "payment_transaction_id") REFERENCES "payment_transactions"("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "refunds"
  DROP CONSTRAINT IF EXISTS "refunds_payment_tenant_fk";
ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_payment_tenant_fk"
  FOREIGN KEY ("tenant_id", "payment_transaction_id") REFERENCES "payment_transactions"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_receipts"
  DROP CONSTRAINT IF EXISTS "payment_receipts_payment_tenant_fk";
ALTER TABLE "payment_receipts"
  ADD CONSTRAINT "payment_receipts_payment_tenant_fk"
  FOREIGN KEY ("tenant_id", "payment_transaction_id") REFERENCES "payment_transactions"("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "security_deposit_disposition_lines"
  DROP CONSTRAINT IF EXISTS "security_deposit_disposition_lines_deposit_tenant_fk";
ALTER TABLE "security_deposit_disposition_lines"
  ADD CONSTRAINT "security_deposit_disposition_lines_deposit_tenant_fk"
  FOREIGN KEY ("tenant_id", "deposit_id") REFERENCES "security_deposits"("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
