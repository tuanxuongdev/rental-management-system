# Prisma

Single source of truth for relational persistence.

## Commands

```bash
pnpm prisma:generate
pnpm prisma:validate
```

Schema files live under `prisma/schema/` and will grow by domain module. No seed data in the foundation.

## Notes

- Migrations are added in later sprints.
- Raw SQL fragments for PostgreSQL-only DDL live under `prisma/raw-sql/`.
