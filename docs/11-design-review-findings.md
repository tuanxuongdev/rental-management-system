# Design Review Findings

**Document ID:** RPM-REVIEW-11  
**Review type:** Architecture design review (pre-implementation)  
**Status:** Remediation applied to documents 00–10; commercial database specification completed in doc 03  
**Reviewer stance:** Extremely critical; commercial SaaS readiness for 30 → 10,000+ units

This document records weaknesses found during design review and the remediation direction applied to the specification set. It is not a substitute for the normative documents 00–10.

## 1. Verdict

The original documentation was a strong modular-monolith baseline, but it was **not yet production-commercial**. Critical gaps existed in boarding-house operating reality (cash/QR, deposits, arrears, utilities, holds), multi-tenant isolation mechanics (Prisma/RLS, confused deputy), database concurrency (allocation exclusion, billing locks), API completeness, authorization SoD, and delivery realism (payments soak, pen-test, 10k load gate).

Documents 00–10 were updated in place. Residual risks remain and must be tracked into implementation ADRs and pilot acceptance.

## 2. Critical findings (were launch-blocking if left unfixed)

| ID | Area | Finding | Remediation |
|---|---|---|---|
| C1 | Security / API | Organization context selection via header (`X-Tenant-ID`) and path/token mismatch enabled confused-deputy risk | Header selection forbidden; path `{organizationId}` must equal token `org_id` or 404; body org/tenant fields never authorize |
| C2 | Database | Lease/bed/unit overlap prevention relied on application checks without GiST exclusion constraints | `btree_gist` + half-open range `EXCLUDE` for WHOLE_UNIT/BED; CAPACITY uses transactional lock + recheck |
| C3 | Architecture | Prisma + PostgreSQL RLS described as if automatic | RLS optional defense-in-depth; Prisma does not set GUCs; primary control is repository `tenant_id` filters + composite FKs |
| C4 | Money | Monetary precision under-specified; float risk | `NUMERIC(19,4)` storage; currency minor-unit rounding; ban float |
| C5 | Auth | MFA for platform admins treated as roadmap | MFA mandatory for Platform Admin at GA; Org Owner strongly recommended / configurable |
| C6 | Reliability | Redis used for cache + queues without durability story | Outbox is source of truth for business events; Redis loss must not lose committed work; auth fails closed if limiter unavailable |
| C7 | Delivery | GA timeline optimistic for payments/reconciliation/migration/security | Roadmap extended: financial soak, two migration rehearsals, pen-test, 10k-unit gate before GA (~24 sprints under stated assumptions) |
| C8 | Database / product model | SaaS Organization conflated with Property Owner; missing ownership history and management agreements | `03-database-design.md` rewritten: `property_ownerships`, `management_agreements`, `owner_profiles`, effective-dated M:N ownership, Organization `manages` not `owns` Property; aligned with API/permissions docs |

## 3. Major findings (would cause expensive rework)

### 3.1 Missing business cases

Originally under-specified or absent; now added to requirements/API/UI/permissions:

- Soft inventory holds vs hard reservations with expiry
- Holdover occupancy after lease end
- Joint & several liability vs primary payer; guarantor workflow
- Late-fee preview/cap/idempotent runs
- Payment plans / installments (without rewriting posted charges)
- Partial payments, unapplied credits, write-offs with dual control
- Cash, bank transfer, QR/local wallet as first-class channels (card via PSP only)
- Deposit disposition checklist (deduct / refund / forfeit / transfer)
- Waitlist and do-not-rent flags with privacy caveats
- Shared utilities allocation; parking/laundry billable services
- Key/asset checkout at move-in/out
- Physical vs economic vacancy metrics
- Opening-balance migration provenance
- Configurable tax display without statutory filing claims
- Bulk meter reading import
- Arrears collection sequences with dispute pause
- Month-start concurrent billing-run safety

### 3.2 Scalability

| Finding | Remediation |
|---|---|
| No noisy-neighbor model | Per-Organization API/worker/storage/export quotas; fair queues |
| No concrete 10k load model | Architecture capacity assumptions: 10k units, ~12k leases, ~15k invoices/month, ~20k readings/month, ~500 concurrent users |
| Search strategy vague | PostgreSQL first; explicit evolution trigger to search platform |
| Connection pressure ignored | PgBouncer, statement timeouts, idle-in-transaction kills |
| Read-model lag undisclosed | Occupancy/dashboard freshness SLA (disclosed lag, e.g. ≤ 60s) |
| Cursor pagination under concurrency | Keyset + unique tie-breaker; unstable sort warning |

### 3.3 Security

| Finding | Remediation |
|---|---|
| Invitation account takeover | Workforce vs resident invitation separation; existing email must authenticate; no credential overwrite |
| Service/M2M credentials “out of scope” | Hashed secrets, rotation, connection-bound webhooks, optional IP allowlists |
| Support impersonation vague | Ban silent impersonation; dual-identity audit; step-up elevation |
| Cookie/CSRF for split SPA/API hosting | Domain/Path scoping; CSRF when `SameSite=None` |
| Export/PII abuse | Separate rate limits; step-up + purpose audit for PII exports |
| No STRIDE summary | Architecture threat-model table for tenancy, payments, documents |

### 3.4 Database

| Finding | Remediation |
|---|---|
| Missing finance entities | Security deposits + disposition lines, late-fee policies, payment plans, holds, waitlists, do-not-rent flags, idempotency keys, assets/keys, opening balances, utility allocation runs, `invoice_status_history` |
| Missing ownership/commercial entities | `property_ownerships`, `management_agreements`, `owner_profiles`, `deployment_cells`, `tenant_placements`, `tenant_usage_counters` |
| SaaS tenant vs Property Owner confusion | Organization (`tenants`) manages portfolio; beneficial owners are `parties` + ownership junction; ERD uses `manages` not `owns` |
| Soft-delete uniqueness | Partial unique indexes with `deleted_at IS NULL` |
| `balance_due` denormalization | Controlled denormalization + rebuild/reconcile job |
| Prisma cannot express EXCLUDE | Raw SQL migrations required alongside Prisma; documented |
| Month-start billing races | Advisory locks per `(tenant_id, schedule_id, period)` |
| Field encryption hand-waved | KEK/DEK rotation design for sensitive party identifiers |

### 3.5 API design

| Finding | Remediation |
|---|---|
| Incomplete financial/ops catalog | Deposits, payment plans, late-fee runs, imports, bulk meters, waitlist, assets, arrears, legal holds, opening balances |
| No bulk pattern | Async bulk/operations resource; batch limits; partial failure model |
| Idempotency store vague | Scoped to org/actor/route; request hash; conflict on body mismatch; TTL |
| Webhook crypto unspecified | HMAC-SHA256, timestamp window, replay cache |
| Error taxonomy weak | Overbooking, capacity, deposit insufficient, currency mismatch, subscription limit |

### 3.6 Permissions / UI / process

| Finding | Remediation |
|---|---|
| Permission catalog incomplete | meters, utilities, late fees, payment plans, write-offs, deposits disposition, imports, assets, waitlist, arrears, legal holds, support elevate |
| SoD missing | Dual control for high-value refund/write-off/deposit release; custom-role combination bans |
| Ops UX missing for real properties | Bulk meters, billing-run workspace, arrears desk, move-out checkout, import wizard, cash payment + evidence |
| WCAG inconsistency | Normalized to WCAG 2.2 AA |
| RPO/RTO conflict across docs | Baseline RPO ≤ 15 min, RTO ≤ 4 h; higher tiers optional |
| Folder/module naming confusion | SaaS Organization under tenancy; CRM companies under parties |

## 4. Minor findings (accepted debt / watch items)

- Owner distribution / trust accounting / multi-country e-invoice remain deferred—must stay explicit in sales and contracts.
- Enterprise SSO/SCIM remain Phase 2+; break-glass paths must be tested before SSO enforcement.
- Exact currency rounding modes and tax engines are jurisdiction-specific; implementation needs per-market ADRs.
- Capacity-mode allocation cannot be fully expressed as a single exclusion constraint; tests and load must prove lock correctness.
- Resident portal household sharing remains intentionally narrow; product must not invent shared-unit data leakage.
- Analytics warehouse and dedicated search are evolution paths, not MVP.
- Document malware scanning depends on an external scanner SLA; quarantine UX must handle backlog.

## 5. Residual risks after remediation

1. **Jurisdiction law variance** (deposits, notice, privacy, messaging consent) cannot be “solved” in a generic schema—needs country packs and legal review.
2. **Utility allocation disputes** remain product-hard; explainability and evidence matter more than clever formulas.
3. **Payment provider KYC/onboarding lead time** can dominate schedule regardless of engineering velocity.
4. **Spreadsheet migration quality** will dominate pilot success; tooling alone is insufficient.
5. **Noisy-neighbor cells** may still be required earlier than planned if one enterprise Organization arrives before partitioning maturity.
6. **Prisma + raw SQL hybrid** increases migration discipline burden; CI drift detection is mandatory.
7. **Owner distribution / trust accounting** remain explicitly deferred; ownership and agreement tables support attribution only, not payout calculations.
8. **Platform cell migration** (`tenant_placements`) is modeled but operationally hard; requires rehearsed cutover playbooks before enterprise customers.

## 6. Documents updated

| Doc | Review focus applied |
|---|---|
| [00-overview.md](./00-overview.md) | Scope honesty, operating models, metrics, payment channels, limitations |
| [01-business-requirements.md](./01-business-requirements.md) | Missing FRs/BRs/stories, measurable NFRs, dual control, failure modes |
| [02-system-architecture.md](./02-system-architecture.md) | Isolation, Redis/outbox, RLS/Prisma, quotas, STRIDE, scale model |
| [03-database-design.md](./03-database-design.md) | Commercial rewrite: ownership/agreements, full table catalog, ER diagrams, `idempotency_keys`, placement tables, invoice status history, invariants, partitioning |
| [04-api-specification.md](./04-api-specification.md) | Confused deputy, bulk/async, financial endpoints, webhooks, errors |
| [05-authentication.md](./05-authentication.md) | MFA, invitations, M2M, CSRF/cookies, fail-closed auth |
| [06-permission-system.md](./06-permission-system.md) | Catalog gaps, SoD, export step-up, evaluation order |
| [07-ui-design.md](./07-ui-design.md) | Ops workspaces at scale, WCAG 2.2, org-switch cache purge |
| [08-folder-structure.md](./08-folder-structure.md) | Domain alignment, raw SQL, contracts, ADR placement |
| [09-coding-standard.md](./09-coding-standard.md) | Enforceable gates, money rules, ban tenant headers |
| [10-development-roadmap.md](./10-development-roadmap.md) | Realistic GA gates, staffing, pen-test, migration, 10k load |

## 7. Recommended next design actions (still documentation / decisions—not code)

1. Author ADRs for: money rounding, allocation concurrency, auth cookie topology, outbox/queue durability, Prisma+raw SQL migration policy.
2. Produce OpenAPI skeleton from [04-api-specification.md](./04-api-specification.md) as the machine contract.
3. Produce a threat-model worksheet per module before coding payments and documents.
4. Define pilot acceptance scripts for one boarding house and one apartment portfolio.
5. Freeze MVP country/payment-provider assumptions before Sprint 1.
6. Promote deferred screens from [ui/deferred-screens.md](./ui/deferred-screens.md) in roadmap order (approvals inbox, portal notices, charges/refunds, holds/reservations, security settings).

## 8. UI documentation set (post-synthesis)

| Artifact | Purpose |
|---|---|
| [ui/README.md](./ui/README.md) | Screen index and terminology |
| [ui/cross-cutting-patterns.md](./ui/cross-cutting-patterns.md) | Shared session, permission, high-risk, async, offline, and state conventions |
| [ui/deferred-screens.md](./ui/deferred-screens.md) | Backlog inventory for screens not yet individually specified |
| [navigation.md](./navigation.md) | Information architecture and user flows |
| [design-system.md](./design-system.md) | Visual and component tokens |
| `ui/[domain]/*.md` (90 screens) | Implementation-ready per-screen specifications |

Security, permission, and UX synthesis from design review is integrated into `cross-cutting-patterns.md` and reflected in individual screen specs. Residual UI backlog is tracked explicitly in `deferred-screens.md`.

## 9. Review closure criteria

This design review is closed for documentation when:

- Critical findings C1–C8 are reflected in 00–10 (done).
- Product, engineering, and security owners accept residual risks in Section 5.
- Implementation may begin only against the updated docs plus approved ADRs—not against informal chat decisions.
