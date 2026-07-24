# Architecture Decision Records

Accepted ADRs in this directory are mandatory before implementing or materially changing:

- Organization isolation and tenancy propagation
- Money representation, rounding, and ledger behavior
- Authentication/session/token strategy and cookie topology
- Transactional outbox and async delivery
- Prisma + raw SQL migration policy

| ID | Title | Status |
|---|---|---|
| [0001](./0001-cookie-topology.md) | Cookie topology for web authentication | Proposed (stub) |
| [0002](./0002-transactional-outbox.md) | Transactional outbox for async side effects | Proposed (stub) |
| [0003](./0003-prisma-raw-sql-policy.md) | Prisma schema with reviewed raw SQL migrations | Proposed (stub) |
| [0004](./0004-money-representation.md) | Money representation and rounding policy | Accepted |
| [0005](./0005-nextjs-app-router.md) | Next.js App Router for staff web | Accepted |
| [0006](./0006-billing-policy.md) | Billing period, rounding, due dates, tax display, invoice numbering | Accepted |

Sprint-01 shipped initial ADR stubs to satisfy M0 platform decision tracking. ADRs 0004–0006 are accepted for Sprint-08 lease commercial fields and Sprint-10 billing foundation.
