-- Sprint-06: Bulk inventory import / export jobs

-- CreateEnum
CREATE TYPE "ImportJobType" AS ENUM ('INVENTORY');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'PARTIALLY_COMPLETED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportJobRowStatus" AS ENUM ('ACCEPTED', 'REJECTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ExportJobType" AS ENUM ('INVENTORY');

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" "ImportJobType" NOT NULL DEFAULT 'INVENTORY',
    "status" "ImportJobStatus" NOT NULL DEFAULT 'QUEUED',
    "actor_user_id" UUID NOT NULL,
    "mapping" JSONB NOT NULL DEFAULT '{}',
    "object_key" TEXT,
    "error_object_key" TEXT,
    "counts" JSONB NOT NULL DEFAULT '{"total":0,"accepted":0,"rejected":0,"skipped":0,"applied":0}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_job_rows" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "status" "ImportJobRowStatus" NOT NULL,
    "reason" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_job_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" "ExportJobType" NOT NULL DEFAULT 'INVENTORY',
    "status" "ImportJobStatus" NOT NULL DEFAULT 'QUEUED',
    "actor_user_id" UUID NOT NULL,
    "object_key" TEXT,
    "counts" JSONB NOT NULL DEFAULT '{"total":0}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_mapping_presets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "mapping" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_mapping_presets_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_job_rows" ADD CONSTRAINT "import_job_rows_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_mapping_presets" ADD CONSTRAINT "import_mapping_presets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "import_jobs_tenant_id_status_idx" ON "import_jobs"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "import_jobs_tenant_id_created_at_idx" ON "import_jobs"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "import_job_rows_job_id_row_number_key" ON "import_job_rows"("job_id", "row_number");

-- CreateIndex
CREATE INDEX "import_job_rows_tenant_id_job_id_status_idx" ON "import_job_rows"("tenant_id", "job_id", "status");

-- CreateIndex
CREATE INDEX "export_jobs_tenant_id_status_idx" ON "export_jobs"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "export_jobs_tenant_id_created_at_idx" ON "export_jobs"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "import_mapping_presets_tenant_id_name_key" ON "import_mapping_presets"("tenant_id", "name");
