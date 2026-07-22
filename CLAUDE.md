# CLAUDE.md

Instructions for Claude (and compatible coding agents) in **rental-property-management**.

## Role

You are implementing inside a production-oriented multi-tenant Rental Property Management monorepo. Normative product and engineering docs live in `/docs`. Binding condensed rules live in [`CODING_RULES.md`](./CODING_RULES.md). Follow both.

## Always do

- Read [`CODING_RULES.md`](./CODING_RULES.md) before writing application code.
- Prefer the smallest change that satisfies the request and docs.
- Preserve Organization isolation, authorization, auditability, and monetary correctness.
- Match existing folder layout, naming, and module boundaries.
- Keep Next.js `app/` routes thin; put feature logic under `src/features/`.
- Keep Nest controllers thin; put transactions in application services; keep domain free of Prisma/Nest.
- Use TanStack Query for server state and Zustand only for minimal client/session UI state.
- Write or update tests for org-owned paths: same-org success, wrong-org non-disclosure, missing context, unauthorized role.
- Use Conventional Commits if committing.

## Never do

- Implement business features not requested or outside the agreed sprint/docs.
- Redesign architecture, DB schema, API contracts, or UI specs without a docs/ADR change.
- Add `X-Tenant-ID` / `X-Organization-ID` or trust body/query `organizationId` as tenancy proof.
- Use JS `number` for money; invent `/rooms` or `/tenants` APIs; treat Property Owner as login access.
- Store tokens in web storage / readable cookies / Zustand persistence.
- Import across apps; put Prisma in controllers; put Nest types in `packages/contracts`.
- Edit applied Prisma migrations; run `*RawUnsafe` in app code.
- Commit secrets, `.env` (except `.env.example`), or skip hooks without explicit approval.
- Create a git remote or push unless the human explicitly asks.

## Stack (foundation)

| Area | Choice |
|---|---|
| Web | Next.js 15 App Router, React, Tailwind, TanStack Query, Zustand, RHF, Zod |
| API / Worker | NestJS modular monolith |
| Data | PostgreSQL + Prisma; Redis cache/queue; S3-compatible storage |
| Workspace | pnpm monorepo |

Note: some `/docs` trees still mention Vite SPA. The **implemented** web app is Next.js—map feature-oriented rules from `docs/08-folder-structure.md` onto App Router as defined in `CODING_RULES.md`.

## Canonical vocabulary

Organization (SaaS tenant boundary), Resident, Lease, Unit, optional Bed, Property Owner ≠ Organization Owner. Hierarchy: Property → Unit → optional Bed. No Room entity.

## Verification commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm prisma:validate
pnpm build
```

## Checklists

Use [`CODING_RULES.md`](./CODING_RULES.md) §17 (PR) and §18 (code review) before finishing substantial work. Human process: [`CONTRIBUTING.md`](./CONTRIBUTING.md).
