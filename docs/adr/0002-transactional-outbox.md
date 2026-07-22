# ADR 0002: Transactional Outbox for Async Side Effects

**Status:** Accepted (Sprint-02)  
**Date:** 2026-07-22  
**Owner:** Platform engineering  
**Review trigger:** Sprint-02 persistence/outbox implementation

## Context

Business writes and externally visible async work (notifications, webhooks, billing runs) must remain consistent. Redis queue transport is not authoritative for financial or lease state.

## Decision (to finalize)

- Persist outbox rows in PostgreSQL in the same transaction as domain writes.
- Relay process publishes to Redis/BullMQ after commit with at-least-once delivery.
- Consumers implement idempotency keys and structured retry/dead-letter policies.

## Alternatives considered

- Dual-write to DB and queue (rejected — split-brain risk).
- Change-data-capture only (deferred — higher operational complexity for MVP).

## Consequences

- Requires outbox schema, relay worker module, and observability dashboards before domain modules emit events.
- Sprint-02 owns schema/migration workflow; Sprint-01 establishes ADR intent only.

## References

- [docs/02-system-architecture.md](../02-system-architecture.md)
- [docs/03-database-design.md](../03-database-design.md)
