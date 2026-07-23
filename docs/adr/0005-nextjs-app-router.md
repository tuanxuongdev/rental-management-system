# ADR 0005 — Next.js App Router for staff web

**Status:** Accepted  
**Date:** 2026-07-23  
**Deciders:** Engineering (foundation + mid-project audit)  
**Review trigger:** Mid-Project Improvement Plan A1; Vite vs Next.js documentation drift

## Context

Early architecture drafts and portions of `docs/08-folder-structure.md` described a Vite React SPA (`App.tsx`, `main.tsx`, `vite.config.ts`). The implemented foundation since Sprint-01 ships **Next.js App Router** under `apps/web` with TanStack Query and Zustand, as recorded in `CODING_RULES.md` and `README.md`.

Continuing dual narratives risks engineers scaffolding the wrong web stack.

## Decision

1. The staff web application **MUST** use **Next.js App Router** (`apps/web/src/app`).
2. Feature UI lives under `apps/web/src/features/<domain>`.
3. Vite SPA layout is **not** the delivery target and **MUST NOT** be reintroduced without a superseding ADR.
4. Shared transport contracts remain in `@rpm/contracts`; apps must not import each other’s source.

## Consequences

- Docs and generators should describe App Router trees, not Vite entrypoints.
- SSR/RSC capabilities are available but staff authenticated shells remain client-capable where session tokens stay memory-only.
- Migration of any residual Vite examples in `docs/08` is documentation debt tracked in the Mid-Project Improvement Plan (A2).

## Alternatives considered

| Option | Why rejected |
|---|---|
| Vite SPA | Would diverge from implemented foundation and CODING_RULES |
| Remix / other | No benefit over established Next.js choice |
