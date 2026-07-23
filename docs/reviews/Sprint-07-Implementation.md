# Sprint-07 Implementation Summary

**Sprint ID:** Sprint-07 — Resident Management  
**Implementation date:** 2026-07-23  
**Scope:** Sprint-07 only (residents, waitlist, do-not-rent, documents; privacy notes; permission-filtered People nav)  
**Baseline:** [Sprint-07.md](../sprints/Sprint-07.md) · [Sprint-06-Review.md](./Sprint-06-Review.md) · [03-database-design.md](../03-database-design.md) · [04-api-specification.md](../04-api-specification.md) · [06-permission-system.md](../06-permission-system.md) · [CODING_RULES.md](../../CODING_RULES.md)  
**Out of scope:** Sprint-08 leases; move-in/out; resident portal; bulk resident import; Redis rate limit / MFA recovery / Playwright e2e (Mid-Project stretch deferred)

---

## Summary

Sprint-07 delivers Organization-scoped resident profiles (on `parties`), contacts, duplicate detection (no auto-merge), waitlist entries, do-not-rent flags with audit, and a document upload/scan/download pipeline with org-scoped object keys and short-lived URLs. Staff UI covers residents list/detail/create-edit, waitlist, and documents library/upload/detail. Architecture, tenancy, and RBAC patterns from prior sprints were extended—not redesigned.

**Quality gates (local):** `pnpm lint` · `pnpm typecheck` · `pnpm unit` (57) · `pnpm integration` (66) · `pnpm build` — all green.  
**Review:** [Sprint-07-Review.md](./Sprint-07-Review.md) — critical/high defects found and fixed in review (PII contact masking, authenticated local download, upload checksum, waitlist/document scope).

---

## Features implemented

| # | Feature | Status |
|---|---|---|
| 1 | Resident create/list/get/patch (Party PERSON + ResidentProfile) | Done |
| 2 | Contacts on create/update | Done |
| 3 | Duplicate-check (email/phone/identifier heuristics) | Done |
| 4 | PII masking without `residents.sensitive_data.view` | Done |
| 5 | Do-not-rent set/clear (permission + audit) | Done |
| 6 | Waitlist CRUD + remove with property scope | Done |
| 7 | Document upload-intent → complete → SCANNING → READY/REJECTED | Done |
| 8 | MIME/size allowlist; reject executables | Done |
| 9 | Short-lived download URLs (TTL clamped) | Done |
| 10 | Document links to resident party (`leaseId` reserved) | Done |
| 11 | Property-scoped PM visibility via `preferredPropertyId` | Done |
| 12 | Residents + Waitlist + Documents UI + People nav (permission-filtered) | Done |
| 13 | Isolation tests T07-01…12 (subset automated) | Done |
| 14 | Privacy/retention/redaction notes | Done |
| 15 | Demo residents seed script | Done |
| 16 | Portal activate/revoke, full identity-doc CRUD depth | Deferred / thin |
| 17 | External malware scanner / quarantine worker | Stub sync scanner |
| 18 | Staging human demo sign-off | Process remaining |

---

## Files created

### Prisma

- `prisma/schema/residents.prisma`
- `prisma/schema/documents.prisma`
- `prisma/schema/migrations/20260726120000_sprint_07_residents_documents/migration.sql`
- `prisma/seeds/demo-residents.ts`

### Contracts

- `packages/contracts/src/residents.ts`
- `packages/contracts/src/documents.ts`
- `packages/contracts/src/sprint-07.contracts.spec.ts`

### API — residents

- `apps/api/src/modules/residents/residents.module.ts`
- `apps/api/src/modules/residents/presentation/residents.controller.ts`
- `apps/api/src/modules/residents/application/resident.service.ts`
- `apps/api/src/modules/residents/application/waitlist.service.ts`
- `apps/api/src/modules/residents/domain/resident.rules.ts`
- `apps/api/src/modules/residents/residents.integration.spec.ts`

### API — documents

- `apps/api/src/modules/documents/documents.module.ts`
- `apps/api/src/modules/documents/presentation/documents.controller.ts`
- `apps/api/src/modules/documents/application/document.service.ts`
- `apps/api/src/modules/documents/domain/document.rules.ts`
- `apps/api/src/modules/documents/documents.integration.spec.ts`

### Web

- `apps/web/src/lib/residents-api.ts`
- `apps/web/src/lib/documents-api.ts`
- `apps/web/src/features/residents/**`
- `apps/web/src/features/documents/**`
- `apps/web/src/app/(app)/app/residents/**`
- `apps/web/src/app/(app)/app/documents/**`

### Docs

- `docs/privacy/resident-document-privacy.md`
- `docs/reviews/Sprint-07-Implementation.md` (this file)

---

## Files modified

| Area | Files |
|---|---|
| Prisma relations | `parties.prisma`, `tenancy.prisma`, `inventory.prisma` (Property/Unit relations) |
| Permissions | `packages/contracts/src/permissions.ts`, `packages/contracts/src/index.ts`, `permission-catalog.ts` |
| App wiring | `apps/api/src/app.module.ts` |
| Testing | `packages/testing/src/integration-database.ts`, `package.json` (`isolation`, `seed:demo-residents`) |
| Shell nav | `apps/web/src/components/layouts/app-shell.tsx` (People group; Q4 partial) |
| Sprint status | `docs/sprints/Sprint-07.md` → Implemented |

---

## Database changes

Migration: `20260726120000_sprint_07_residents_documents`

| Table | Purpose |
|---|---|
| `resident_profiles` | One resident extension per party; preferred property; DOB; notes; retention/hold |
| `party_identifiers` | Encrypted value + lookup hash for duplicate/ID checks |
| `waitlist_entries` | Property/unit preferences, priority, consent, expiry |
| `do_not_rent_flags` | Manual flags with reason, actor, review/expiry, clear trail |
| `documents` | Logical metadata + scan/lifecycle status |
| `document_versions` | Immutable versions; org-scoped `object_key` |
| `document_links` | Typed links (`party_id` / `property_id` / reserved `lease_id`); CHECK exactly one target |

---

## API changes

Org-scoped under `/v1/organizations/{organizationId}/…`:

| Area | Endpoints |
|---|---|
| Residents | `GET/POST /residents`, `GET/PATCH /residents/{id}` |
| Duplicates | `POST /residents/duplicate-check` |
| Do-not-rent | `POST/DELETE /residents/{id}/do-not-rent` |
| Waitlist | `GET/POST /waitlist-entries`, `PATCH …/{id}`, `POST …/{id}/remove` |
| Documents | `POST /documents/upload-intents`, `POST …/{id}/complete-upload`, `GET /documents`, `GET …/{id}`, `POST …/{id}/download-url`, `GET …/{id}/content` (authenticated local download), `POST …/{id}/links` |

**AuthZ keys (docs/06):** `residents.*`, `residents.sensitive_data.view`, `residents.do_not_rent.manage`, `waitlist.*`, `documents.*`.  
**Cross-cutting:** cursor pagination; If-Match → 412; org path 404; PM property scope; short-lived downloads; READY required for download.

---

## Test coverage

| Suite | Coverage |
|---|---|
| Contracts | `sprint-07.contracts.spec.ts` |
| Residents isolation | T07-01…06, T07-10, T07-11 + If-Match + document link |
| Documents isolation | T07-07, T07-08 (TTL clamp), T07-09, T07-12 + executable reject + non-READY deny |
| Isolation script | Includes residents + documents specs |
| Full integration | **66** tests green |

---

## Remaining work

1. Staging deploy + Sprint-07 demo / human sign-off.
2. Async malware scanner worker (replace sync stub) + quarantine UX depth.
3. Staff portal activate/revoke and richer identity-document APIs (API §12 extras).
4. Mid-Project stretch still open: Q5 Playwright, S3 Redis rate limit, S4 MFA recovery, D3 OpenAPI publish.
5. Full portfolio nav permission filtering beyond People/Imports/Operations (Q4 remainder).
6. KMS/vault for identifier encryption (local keyVersion placeholder today).

---

## Known limitations

- Document scan is **synchronous stub** (MIME allowlist → READY/REJECTED), not an external AV pipeline.
- Download “expiry rejection after TTL” is validated via TTL clamping (T07-08), not a live sleep-past-expiry E2E against S3.
- Occupancy/lease filters on residents list are hooks only until Sprint-08/09.
- Guarantor workflow depth not implemented.
- Demo seed metadata may reference object keys without local bytes until UI re-upload.
- Lease document links (`leaseId`) reserved but unused until Sprint-08.

---

## Handoff to Sprint-08

- Attach residents as lease parties without schema rewrite.
- Gate lease activation on active do-not-rent flags (warn/block per product rule).
- Populate `document_links.leaseId` for lease packs.
- Keep Resident ≠ Unit ≠ Lease vocabulary in UI copy.
