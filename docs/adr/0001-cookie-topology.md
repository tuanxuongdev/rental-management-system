# ADR 0001: Cookie Topology for Web Authentication

**Status:** Proposed (stub — Sprint-01)  
**Date:** 2026-07-22  
**Owner:** Platform engineering  
**Review trigger:** Sprint-03 authentication implementation

## Context

The web application must not store access or refresh tokens in `localStorage`, `sessionStorage`, IndexedDB, or readable cookies. Sprint-03 introduces real authentication; cookie names, domains, paths, and SameSite policy must be decided before implementation.

## Decision (to finalize)

- Use HTTP-only, Secure (in production), SameSite cookies for session/refresh handling.
- Separate cookie scope for staff, resident portal, and platform shells if required by navigation model.
- Organization-scoped JWT exchange occurs server-side; cookies carry session references only.

## Alternatives considered

- In-memory access token only (rejected for refresh UX without complementary secure refresh transport).
- Bearer tokens in SPA storage (forbidden by security standard).

## Consequences

- Requires BFF or API cookie issuance endpoints and CSRF strategy for mutating browser requests.
- Local development uses explicit cookie domain configuration documented in `.env.example`.

## References

- [docs/05-authentication.md](../05-authentication.md)
- [docs/09-coding-standard.md](../09-coding-standard.md)
