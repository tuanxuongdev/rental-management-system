# ADR 0003: Prisma Schema with Reviewed Raw SQL Migrations

**Status:** Proposed (stub — Sprint-01)  
**Date:** 2026-07-22  
**Owner:** Platform engineering  
**Review trigger:** Sprint-02 Prisma bootstrap and first migrations

## Context

Most relational schema is modeled in Prisma. PostgreSQL features such as GiST exclusion constraints for occupancy, partial indexes, and optional RLS require SQL beyond Prisma's declarative schema.

## Decision (to finalize)

- Prisma multi-file schema is the default modeling path under `prisma/schema/`.
- Unsupported DDL lives in `prisma/raw-sql/` fragments copied into ordered migrations with real PostgreSQL tests.
- Application code forbids `$queryRawUnsafe` / `$executeRawUnsafe`; approved migration helpers only.

## Alternatives considered

- ORM-only migrations (rejected — cannot express occupancy exclusions).
- Hand-written SQL without Prisma (rejected — loses type-safe client benefits).

## Consequences

- Migration reviews require DB owner sign-off for raw SQL sections.
- CI validates Prisma schema and runs integration tests against PostgreSQL.

## References

- [docs/03-database-design.md](../03-database-design.md)
- [docs/08-folder-structure.md](../08-folder-structure.md)
- [prisma/raw-sql/README.md](../../prisma/raw-sql/README.md)
