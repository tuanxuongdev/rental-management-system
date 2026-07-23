# Sprint-07 — Resident Management

**Sprint ID:** Sprint-07  
**Roadmap alignment:** [10-development-roadmap.md](../10-development-roadmap.md) Sprint 7 · Phase 4 start toward **M4**  
**Program references:** [project-roadmap.md](../project-roadmap.md) · [dependency-map.md](../dependency-map.md) · [03-database-design.md](../03-database-design.md) · [04-api-specification.md](../04-api-specification.md) · [06-permission-system.md](../06-permission-system.md)  
**UI references:** [ui/residents/residents-list.md](../ui/residents/residents-list.md) · [ui/residents/resident-detail.md](../ui/residents/resident-detail.md) · [ui/residents/resident-create-edit.md](../ui/residents/resident-create-edit.md) · [ui/residents/waitlist.md](../ui/residents/waitlist.md) · [ui/documents/documents-library.md](../ui/documents/documents-library.md) · [ui/documents/document-upload.md](../ui/documents/document-upload.md) · [ui/documents/document-detail.md](../ui/documents/document-detail.md) · [ui/cross-cutting-patterns.md](../ui/cross-cutting-patterns.md)  
**Duration:** 2 weeks  
**Status:** Implemented — see docs/reviews/Sprint-07-Implementation.md  
**Builds on:** [Sprint-04.md](./Sprint-04.md) · [Sprint-05.md](./Sprint-05.md) · [Sprint-06.md](./Sprint-06.md)

---

## Goal

Deliver Organization-scoped resident profiles, contacts, duplicate detection, waitlist and do-not-rent flags (privacy-aware), and secure document upload/download with short-lived access so authorized staff can safely create and manage resident records and documents ahead of leasing.

---

## Business Value

- Creates the people layer required for leases without conflating Resident identity with Unit occupancy or Lease contracts.
- Enables pilot operators to migrate/cleanse resident directories before activation workflows.
- Establishes PII-safe document handling reused by lease packs, move-in/out evidence, and portal.
- Independently deployable: residents + documents ship without lease activation or billing.

---

## Scope

### In scope

- Resident profiles (preferred vs legal name separation), contacts, emergency contacts, status, notes policy.
- Duplicate detection (email/phone/identifier heuristics) with merge guidance—not silent auto-merge.
- Property/occupancy filtering hooks (historical occupancy empty until Sprint-09).
- Waitlist entries tied to property/unit preferences.
- Do-not-rent flags with reason, actor, review date; masked display rules.
- Document metadata, upload to org-scoped object storage, virus-scan state machine (uploading/scanning/ready/rejected), short-lived download URLs.
- Document links to residents (and generic link model ready for leases in Sprint-08).
- Consent/retention/redaction/export behavior documented for personal data.
- Residents navigation + Documents library (resident-centric).
- Audit events for resident PII changes, flag changes, document access where required.
- Cross-Organization denial tests for residents and documents.

### Out of scope

- Lease create/activate (Sprint-08).
- Move-in/out and occupancy events (Sprint-09).
- Resident portal self-service (later).
- Online applications / screening pipeline (deferred).
- Guarantor workflow depth (thin party link only if trivial).
- Bulk resident import (may reuse import patterns later; not M3 inventory import).

---

## Features

1. Residents list with search, filters, cursor pagination, saved-view-ready query params.
2. Resident create/edit and detail (tabs: profile, contacts, documents, waitlist/flags, activity).
3. Duplicate warning on create/update.
4. Waitlist management screen.
5. Do-not-rent flag set/clear with permission and audit.
6. Document upload, scan status, preview/download via expiring URL.
7. Sensitive-field masking for roles without PII permissions.
8. Property-scoped visibility for Property Managers where residents are property-associated (association optional until lease—scope by created property preference or explicit property link).

---

## User Stories

1. **As a Property Manager**, I can create a resident with contacts and emergency contacts so leasing can proceed later without re-entry.
2. **As a Property Manager**, I am warned when a possible duplicate resident exists so we avoid split histories.
3. **As an Organization Administrator**, I can maintain a waitlist for a property so demand is tracked.
4. **As an authorized staff member**, I can upload resident documents and download them via short-lived links so files are not publicly exposed.
5. **As a user without PII permission**, I see masked identifiers and cannot reveal them without step-up/permission.
6. **As a security engineer**, cross-org resident or document IDs never confirm existence outside my Organization.
7. **As an Accountant**, I can view limited resident context needed later for finance without full HR-style notes (notes policy enforced).

---

## Database Changes

| Table | Purpose |
|---|---|
| `resident_profiles` | Resident extension on parties / dedicated profile |
| `party_identifiers` | Government/other IDs (encrypted/restricted as designed) |
| `waitlist_entries` | Waitlist |
| `do_not_rent_flags` | Privacy-sensitive flags |
| `documents` | Document metadata |
| `document_versions` | Versioned blobs |
| `document_links` | Polymorphic links (resident now; lease later) |
| Support | Encryption fields / KEK reference placeholders per DB design |

**Constraints:** `tenant_id` on all rows; unique active identifiers per policy; document object keys `org/{organizationId}/...`; soft-delete partial uniques as applicable.

---

## API Changes

Subset of API §12 Residents and §23 Documents:

| Area | Endpoints (representative) |
|---|---|
| Residents | `GET/POST .../residents`, `GET/PATCH .../residents/{id}` |
| Contacts | nested or patch on resident |
| Duplicates | `POST .../residents/duplicate-check` |
| Waitlist | CRUD `.../waitlist-entries` |
| Do-not-rent | `POST/DELETE .../residents/{id}/do-not-rent` |
| Documents | initiate upload, complete, list, get download URL, delete/archive |
| Links | attach document to resident |

**Rules:** Cursor pagination; org path == token; short-lived signed URLs; no permanent public object ACLs; PII fields omitted unless permitted; `If-Match` on updates.

---

## UI Changes

| Screen | Spec |
|---|---|
| Residents list / detail / create-edit | `ui/residents/*` |
| Waitlist | `ui/residents/waitlist.md` |
| Documents library / upload / detail | `ui/documents/*` |
| Navigation | Add **Residents** and **Documents** |

Masking UI for sensitive fields; never put PII in toasts, titles, or URLs. Distinct empty states for no permission vs no records.

---

## Permissions

| Permission | Use |
|---|---|
| `residents.read/create/update` | Profile CRUD |
| `residents.pii.reveal` | Unmask sensitive identifiers |
| `residents.do_not_rent.manage` | Flag management |
| `waitlist.*` | Waitlist |
| `documents.read/upload/download/delete` | Document ops |
| Property scope | Filter residents/docs by grant when associated |

Notes: restrict free-text notes by role; export of resident PII is **not** in this sprint (governed export later).

---

## Validation Rules

1. Preferred name required for display; legal name rules per policy for contractual contexts later.
2. At least one contact method recommended; validate email/phone formats when present.
3. Duplicate check runs before create; user must confirm proceed if matches found.
4. Do-not-rent requires reason and actor; display warnings on lease start in Sprint-08 (store now).
5. Document MIME/size allowlists; reject executable types.
6. Download URLs expire quickly; regenerated per request; authz rechecked.
7. Scan rejected documents cannot be downloaded as ready.
8. Cross-org document id → 404.
9. Waitlist entries reference authorized properties only.
10. Retention labels stored; deletion respects legal hold if flag exists (thin).

---

## Test Cases

| ID | Case | Expected |
|---|---|---|
| T07-01 | Create resident happy path | Persisted; audited |
| T07-02 | Duplicate-check match | Warning payload; no silent merge |
| T07-03 | Property Manager out of scope | 404/empty |
| T07-04 | Cross-org resident id | 404 |
| T07-05 | User without PII reveal | Masked fields |
| T07-06 | Set/clear do-not-rent | Audited; permission enforced |
| T07-07 | Upload → scanning → ready | Status transitions |
| T07-08 | Download URL expiry | Rejected after TTL |
| T07-09 | Download without permission | Denied |
| T07-10 | Waitlist create for unauthorized property | Denied |
| T07-11 | Isolation suite residents/documents | Pass |
| T07-12 | Object key without org prefix | Rejected by storage helper |

---

## Acceptance Criteria

1. Authorized staff can safely create and manage a resident record and documents (**Sprint 7 demo**).
2. Resident identity is distinct from Unit and Lease in UI copy and data model.
3. Waitlist and do-not-rent flags work with privacy-aware display and audit.
4. Documents use org-scoped storage, scan states, and short-lived download URLs.
5. Cross-Organization access denial proven in tests.
6. Consent/retention/redaction/export behavior documented for PII.
7. Deployed to staging; Residents + Documents navigable.
8. Sprint-08 can attach residents and documents to leases without schema rewrite.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| PII in logs/URLs/toasts | Privacy incident | Redaction filters; UI rules; tests |
| Malware in uploads | Host compromise | Scan states; quarantine; CSV-sized limits |
| Duplicate sprawl | Bad lease parties | Duplicate check + SME process |
| Do-not-rent legal misuse | Discrimination/compliance | Reason codes; limited perms; counsel review |
| Premature portal exposure | Scope creep | Out of scope |

---

## Dependencies

| Dependency | Type | Required |
|---|---|---|
| Sprint-04 RBAC | Hard | Yes |
| Sprint-05/06 Properties for waitlist scope | Hard | Yes |
| S3 + signed URL capability (Sprint-02) | Hard | Yes |
| Privacy/retention decisions | Soft→Hard | For production PII |
| Sprint-08 | Downstream | Lease parties |

---

## Deliverables

1. Resident/waitlist/flag/document migrations.
2. Residents and documents APIs.
3. Residents + Documents UI.
4. PII masking and audit coverage.
5. Isolation tests for new endpoints.
6. Privacy handling notes (retention/redaction/export).
7. Staging demo dataset of residents + sample docs.

---

## Estimated Time

| Track | Estimate |
|---|---|
| Schema + resident domain | 2–3 days |
| Documents pipeline | 2–3 days |
| APIs + authz/masking | 2 days |
| UI (residents, waitlist, docs) | 2–3 days |
| Tests + privacy review | 1–2 days |
| **Sprint total** | **10 business days (2 weeks)** |

---

## Definition of Done

1. Acceptance criteria met; demo on staging.
2. Isolation, permission, and document security tests pass.
3. Coding standards, CI gates, reviews complete.
4. No critical/high PII or authz defects open.
5. Docs updated (API subset, permission keys, privacy notes).
6. Independently deployable without lease activation/billing.
7. Handoff: Sprint-08 lease parties, document links to leases, do-not-rent gate on activate.
