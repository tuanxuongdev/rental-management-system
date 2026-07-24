-- Sprint-10 review: tenant-scoped unique charge keys (ADR-0006).
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_lines_tenant_id_charge_key_uidx"
  ON "invoice_lines"("tenant_id", "charge_key");
