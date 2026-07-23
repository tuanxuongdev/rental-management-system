-- Sprint-07: Residents, waitlist, do-not-rent, documents

-- CreateEnum
CREATE TYPE "ResidentStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'FORMER', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WaitlistEntryStatus" AS ENUM ('OPEN', 'OFFERED', 'CLOSED', 'EXPIRED', 'REMOVED');

-- CreateEnum
CREATE TYPE "DoNotRentFlagStatus" AS ENUM ('ACTIVE', 'CLEARED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADING', 'SCANNING', 'READY', 'REJECTED', 'DELETED');

-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('STAFF', 'RESIDENT_SHARED', 'OWNER_SHARED', 'RESTRICTED');

-- CreateTable
CREATE TABLE "resident_profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "status" "ResidentStatus" NOT NULL DEFAULT 'PROSPECT',
    "preferred_property_id" UUID,
    "date_of_birth" DATE,
    "notes" TEXT,
    "retention_class" TEXT NOT NULL DEFAULT 'STANDARD',
    "legal_hold" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "resident_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_identifiers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "identifier_type" TEXT NOT NULL,
    "issuer" TEXT,
    "value_encrypted" TEXT NOT NULL,
    "lookup_hash" TEXT NOT NULL,
    "key_version" TEXT NOT NULL DEFAULT 'local-v1',
    "verification_status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "party_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "property_id" UUID,
    "unit_id" UUID,
    "status" "WaitlistEntryStatus" NOT NULL DEFAULT 'OPEN',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "criteria" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "consent_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "removed_at" TIMESTAMP(3),
    "remove_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "do_not_rent_flags" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "status" "DoNotRentFlagStatus" NOT NULL DEFAULT 'ACTIVE',
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "reason" TEXT NOT NULL,
    "evidence_note" TEXT,
    "set_by_user_id" UUID NOT NULL,
    "review_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "cleared_at" TIMESTAMP(3),
    "cleared_by_user_id" UUID,
    "clear_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "do_not_rent_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'STAFF',
    "retention_class" TEXT NOT NULL DEFAULT 'STANDARD',
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADING',
    "legal_hold" BOOLEAN NOT NULL DEFAULT false,
    "current_version_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "object_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "scan_status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADING',
    "scan_detail" TEXT,
    "change_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_links" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "link_type" TEXT NOT NULL,
    "party_id" UUID,
    "property_id" UUID,
    "lease_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "document_links_exactly_one_target_check" CHECK (
        ((party_id IS NOT NULL)::int + (property_id IS NOT NULL)::int + (lease_id IS NOT NULL)::int) = 1
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "resident_profiles_party_id_key" ON "resident_profiles"("party_id");

-- CreateIndex
CREATE INDEX "resident_profiles_tenant_id_status_idx" ON "resident_profiles"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "resident_profiles_tenant_id_preferred_property_id_idx" ON "resident_profiles"("tenant_id", "preferred_property_id");

-- CreateIndex
CREATE UNIQUE INDEX "party_identifiers_tenant_id_identifier_type_lookup_hash_key" ON "party_identifiers"("tenant_id", "identifier_type", "lookup_hash");

-- CreateIndex
CREATE INDEX "party_identifiers_tenant_id_party_id_idx" ON "party_identifiers"("tenant_id", "party_id");

-- CreateIndex
CREATE INDEX "waitlist_entries_tenant_id_status_created_at_idx" ON "waitlist_entries"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "waitlist_entries_tenant_id_property_id_idx" ON "waitlist_entries"("tenant_id", "property_id");

-- CreateIndex
CREATE INDEX "do_not_rent_flags_tenant_id_party_id_status_idx" ON "do_not_rent_flags"("tenant_id", "party_id", "status");

-- CreateIndex
CREATE INDEX "do_not_rent_flags_tenant_id_status_review_at_idx" ON "do_not_rent_flags"("tenant_id", "status", "review_at");

-- CreateIndex
CREATE INDEX "documents_tenant_id_status_idx" ON "documents"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "documents_tenant_id_category_idx" ON "documents"("tenant_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_document_id_version_number_key" ON "document_versions"("document_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_object_key_key" ON "document_versions"("object_key");

-- CreateIndex
CREATE INDEX "document_versions_tenant_id_document_id_idx" ON "document_versions"("tenant_id", "document_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_links_document_id_link_type_party_id_property_id_lease_id_key" ON "document_links"("document_id", "link_type", "party_id", "property_id", "lease_id");

-- CreateIndex
CREATE INDEX "document_links_tenant_id_party_id_idx" ON "document_links"("tenant_id", "party_id");

-- CreateIndex
CREATE INDEX "document_links_tenant_id_property_id_idx" ON "document_links"("tenant_id", "property_id");

-- AddForeignKey
ALTER TABLE "resident_profiles" ADD CONSTRAINT "resident_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_profiles" ADD CONSTRAINT "resident_profiles_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_profiles" ADD CONSTRAINT "resident_profiles_preferred_property_id_fkey" FOREIGN KEY ("preferred_property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_identifiers" ADD CONSTRAINT "party_identifiers_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "do_not_rent_flags" ADD CONSTRAINT "do_not_rent_flags_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
