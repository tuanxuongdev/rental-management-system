# Sprint-07 Implementation Review

**Review ID:** RPM-REVIEW-SPRINT-07  
**Review date:** 2026-07-23  
**Reviewer role:** Principal Software Architect / Senior Code Reviewer  
**Scope:** Implementation of [Sprint-07](../sprints/Sprint-07.md) only — no Sprint-08+ features evaluated or implemented  
**Normative baselines:** [CODING_RULES.md](../../CODING_RULES.md) · [AGENTS.md](../../AGENTS.md) · [03-database-design.md](../03-database-design.md) · [04-api-specification.md](../04-api-specification.md) · [06-permission-system.md](../06-permission-system.md) · [Sprint-06-Review.md](./Sprint-06-Review.md) · [Sprint-07-Implementation.md](./Sprint-07-Implementation.md) · [privacy/resident-document-privacy.md](../privacy/resident-document-privacy.md)

---

## Summary

Sprint-07 delivers Organization-scoped residents (Party + profile), contacts, duplicate detection (no auto-merge), waitlist, do-not-rent with audit, and a document upload → scan → download pipeline with org-scoped object keys. Staff UI covers residents list/detail/create-edit, waitlist, and documents library/upload/detail under a permission-filtered People nav.

This review found **multiple critical/high defects** in PII masking, local document download, upload integrity, waitlist scope/pagination, and document property scoping. All critical/high items that could be safely corrected in-repo were fixed in this session. After fixes, local gates pass: lint, typecheck, unit (57), Sprint-07 integration (16), build. Full integration suite is expected at **66** (prior run had 65 pass + 1 stale assertion, now fixed).

The implementation **meets Sprint-07 technical acceptance for a conditional Go toward Sprint-08**, with residual process/evidence gaps (staging demo sign-off, external AV, KMS-backed identifier encryption) and intentional Mid-Project stretch deferrals.

---

## Critical Issues

### Critical (fixed during review)

| ID | Area | Issue | Severity |
|---|---|---|---|
| C1 | Security / PII | Contact values were returned in cleartext even when the caller lacked `residents.sensitive_data.view` (DOB/notes masked; contacts not). | Critical |
| C2 | Security / UX | Local (non-S3) download URLs pointed at relative `/v1/.../object-storage/...` paths with no authenticated handler; UI `window.open` hit the Next.js origin and failed. | Critical |
| C3 | Integrity | `completeUpload` trusted declared checksum/size without hashing stored object bytes; scan jumped UPLOADING→READY without a durable SCANNING step. | Critical |

### High (fixed during review)

| ID | Area | Issue | Severity |
|---|---|---|---|
| H1 | AuthZ / scope | Property-scoped waitlist create could omit `propertyId`, creating org-wide entries outside grants. | High |
| H2 | API / pagination | Waitlist cursor used `id > after` while sorting by priority/createdAt/id → unstable pages. | High |
| H3 | AuthZ / PII | PATCH allowed DOB/notes without sensitive permission; SELECTED_PROPERTIES actors could clear `preferredPropertyId` to null and escape scope. | High |
| H4 | AuthZ / docs | Document list ignored property/party link scope; web sent `residentId`/`propertyId` while API expected `partyId` (and preferred-property filter). | High |
| H5 | Validation | Upload-intent allowed both `partyId` and `propertyId`; duplicate create returned 422 instead of conflict semantics. | High |
| H6 | API / contracts | Download response lacked `mode`; no authenticated content endpoint for local storage. | High |

### Medium / High (open — document / defer)

| ID | Area | Issue | Severity |
|---|---|---|---|
| H7 | Security | Identifier “encryption” is a reversible placeholder (base64 + `keyVersion`), not KMS/vault-backed. | High (known debt) |
| H8 | Security | Malware scan is a synchronous MIME allowlist stub, not an external AV/quarantine worker. | High (known debt) |
| H9 | Testing / process | T07-08 proves TTL **clamp**, not live “reject after wall-clock expiry” against signed S3. Staging demo / human Sprint-07 sign-off not evidenced. | High (evidence) |
| H10 | Docs vs code | Sprint-07.md still names `residents.pii.reveal`; catalog/code use `residents.sensitive_data.view`. | Medium |
| H11 | UI depth | Resident detail is a compact layout (profile + DNR + docs hooks); full tabbed activity / emergency-contact depth in UI specs is thin. | Medium |
| H12 | Mid-Project | Q5 Playwright, S3 Redis rate limit, S4 MFA recovery, D3 OpenAPI remain deferred (out of Sprint-07 scope). | Medium |

### Low / partial (open)

| ID | Area | Issue | Severity |
|---|---|---|---|
| M1 | UI | Occupancy/lease filters on residents list are hooks only until Sprint-08/09. | Low |
| M2 | Seed | Demo resident document metadata may reference object keys without local bytes until re-upload. | Low |
| M3 | API | Staff portal activate/revoke and richer identity-document CRUD deferred (API §12 extras). | Low |
| M4 | A11y | Lists/forms use `role="alert"` / `role="status"`; full WCAG pass / Playwright a11y not automated. | Low |

---

## Changes Made

| Fix | What changed |
|---|---|
| C1 | `toResponse` masks contact values via `maskIdentifier` when `!includeSensitive`; create/get honor caller sensitive flags |
| C2 / H6 | `GET .../documents/:id/content` + download-url `mode: 's3' \| 'authenticated'`; web uses `authFetch` + blob when authenticated |
| C3 | `completeUpload` re-hashes stored bytes + size; status → SCANNING then READY/REJECTED; objectKey redacted in responses |
| H1 | Waitlist create requires `propertyId` for property-scoped actors |
| H2 | Waitlist keyset cursor on `(priority, createdAt, id)` |
| H3 | PATCH requires sensitive permission for DOB/notes; scoped actors cannot clear `preferredPropertyId` |
| H4 | Document list/get/download assert link/property scope; aliases `residentId`→`partyId`, `propertyId` filter; web sends `preferredPropertyId` / `partyId` |
| H5 | Upload-intent Zod refine (not both targets); duplicate create → `409 DUPLICATE_PARTY_SUSPECTED` |
| Tests | T07-05 asserts masked contacts; T07-02 expects ConflictException; T07-07 asserts authenticated download mode |
| Hygiene | Lint/type fixes (`maskIdentifier` import, Express `Response` type, `document` vs DOM `createElement` shadowing) |

---

## Minor Issues

Documented above as H7–H12 / M1–M4. None block technical merge after critical/high fixes. H7/H8/H9 should be tracked before claiming full privacy/security maturity for production PII volumes.

---

## Verification matrix

| Criterion | Status | Notes |
|---|---|---|
| Business requirements | ✅ Pass (post-fix) | Profiles, duplicates, waitlist, DNR, docs, masking, PM scope |
| Sprint scope (no Sprint-08) | ✅ Pass | No lease create/activate; `leaseId` reserved only |
| Architecture consistency | ✅ Pass | Nest `presentation → application → domain`; Prisma in services; contracts shared |
| Database consistency | ✅ Pass | Migration `20260726120000_sprint_07_residents_documents`; `tenant_id`; org object keys |
| API consistency | ✅ Pass (post-fix) | Org path + permissions; cursor; If-Match; download modes |
| UI consistency | ✅ Pass (post-fix) | Residents/waitlist/documents + People nav; download path fixed |
| Multi-tenant isolation | ✅ Pass (post-fix) | Cross-org 404; PM property/waitlist/doc scope; object key prefix |
| Security | ✅ Pass (post-fix) | PII mask; checksum verify; authenticated local download; AV stub residual |
| Performance | ✅ Pass | Cursor lists; no N+1 fan-out introduced for Sprint-07 surfaces |
| Error handling | ✅ Pass | Problem codes for duplicate, not-ready, checksum, scope |
| Validation | ✅ Pass (post-fix) | MIME/size; contact formats; upload link exclusivity |
| Accessibility | ⚠️ Partial | Status/alert roles present; no automated a11y suite |
| Testing | ✅ Pass (expanded) | T07-01…12 subset + review assertions; isolation script includes S07 |
| Documentation consistency | ✅ Pass | Implementation + privacy notes; sprint status Implemented |

---

## Remaining Risks

1. **Identifier encryption** — replace placeholder with KMS/vault before storing production government IDs at volume.
2. **External AV** — sync MIME stub can mark READY without malware inspection; plan async scan worker + quarantine UX.
3. **Staging proof** — deploy + human Sprint-07 demo (create resident, duplicate warn, DNR, upload/download) before M4 stakeholder claim.
4. **S3 TTL E2E** — when S3 is configured, add a short sleep/expired-URL negative test beyond clamp unit coverage.
5. **UI/spec depth** — activity tab, emergency contacts richness, and permission-name doc alignment (`pii.reveal` vs `sensitive_data.view`).
6. Mid-Project stretch leftovers intentionally deferred: Playwright, Redis rate limit, MFA recovery, OpenAPI publish.

---

## Overall Score

**8.0 / 10**

Solid Phase-4 people/documents foundation after review hardening. Deducted for pre-review PII/download/integrity defects, placeholder encryption + AV stub, and incomplete staging/TTL evidence.

---

## Recommendation

**Approve with conditions** for Sprint-07 technical merge / Conditional Go toward Sprint-08:

1. Ship review fixes (already applied in this session).
2. Before claiming full **resident/document privacy readiness**, schedule KMS encryption and external scan worker (can proceed to lease scaffolding with Conditional Go if product accepts stub risk for pilot-only data).
3. Complete staging demo + sign-off; do not treat Implementation.md process rows as closed until evidenced.
4. Align Sprint-07.md permission naming with the catalog on the next docs pass.
5. **Do not implement Sprint-08 in this review session** (none started).

---

## Quality gates (post-review)

- `pnpm lint` / `typecheck` / `unit` / `build` — pass after fixes  
- Sprint-07 integration: **16** tests (residents 10 + documents 6)  
- Full integration: **66** expected (re-run after T07-02 assertion fix)  
- Unit: **57**
