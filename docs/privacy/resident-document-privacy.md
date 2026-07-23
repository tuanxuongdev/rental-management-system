# Resident & Document Privacy Handling (Sprint-07)

**Document ID:** RPM-PRIVACY-S07  
**Status:** Normative for Sprint-07 surfaces  
**Audience:** Engineers, operators, privacy counsel  
**Related:** [Sprint-07.md](../sprints/Sprint-07.md) · [03-database-design.md](../03-database-design.md) · [06-permission-system.md](../06-permission-system.md)

This note records consent, retention, redaction, and export behavior for personal data introduced with Residents and Documents. It does not redesign the platform privacy model.

---

## 1. Data classes

| Class | Examples | Access |
|---|---|---|
| Display identity | Preferred/display name, status, preferred property | `residents.view` |
| Contact | Email, phone (party contacts) | View; values masked without `residents.sensitive_data.view` |
| Sensitive identity | Date of birth, government identifiers (`party_identifiers`) | Reveal only with `residents.sensitive_data.view`; identifiers stored encrypted + lookup hash |
| Decision support | Do-not-rent flags (reason, evidence note) | `residents.do_not_rent.manage` to set/clear; warnings visible to authorized staff |
| Free-text notes | Resident notes | Restricted; omitted for roles without sensitive view |
| Documents | File bytes + metadata | Org-scoped object keys; short-lived download URLs; scan gate before READY |

---

## 2. Consent

- Waitlist entries record optional `consentAt` when the prospect consents to retention for demand tracking.
- Document `visibility` and `retentionClass` are set at upload; staff must choose an appropriate class.
- Do-not-rent is a **manual** decision-support flag: reason is mandatory; no automated adverse decisioning in Sprint-07.

---

## 3. Retention

| Artifact | Default | Notes |
|---|---|---|
| Resident profile | `retentionClass` (default `STANDARD`) | Soft-delete / archive; do not hard-delete while lease/finance history will exist (Sprint-08+) |
| Identifiers | Follow profile + crypto-erase policy | Plaintext never indexed; `lookupHash` for duplicate detection only |
| Documents | `retentionClass` + `legalHold` | Soft removal blocks access; purge only after hold clear and policy |
| Download URLs | 300s default (max 900s) | Regenerated per authorized request; not permanent ACLs |

Legal hold (`legalHold` on profile/document) blocks destructive purge paths (thin enforcement in Sprint-07; expand with counsel).

---

## 4. Redaction & masking

- UI and API **must not** put PII in URLs, toasts, page titles, or correlation logs.
- Without `residents.sensitive_data.view`: return `dateOfBirthMasked` only; mask contact values; omit identifier plaintext.
- Cross-org resident/document IDs return **404** (non-disclosure).
- Property-scoped staff only see residents whose `preferredPropertyId` is in grant (unscoped preferred property not listed to SELECTED_PROPERTIES actors).

---

## 5. Export

- **Out of scope for Sprint-07:** governed bulk export of resident PII.
- Operators may download individual READY documents via short-lived URLs under `documents` permissions.
- Future export jobs must require purpose, classification, and (where policy requires) step-up — reuse Sprint-06 export patterns with PII controls.

---

## 6. Audit

Emit audit events for: resident create/update/archive, do-not-rent set/clear, document upload complete, document download URL issue (where required), waitlist remove.

---

## 7. Handoff to Sprint-08

- Lease activation must surface active do-not-rent warnings (gate, not silent ignore).
- `document_links.leaseId` is reserved; attach lease packs without schema rewrite.
- Portal self-service remains out of scope until a later sprint.
