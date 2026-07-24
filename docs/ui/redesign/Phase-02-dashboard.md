# Phase-02 — Dashboard

**Parent:** [`../UI_MASTER_SPEC.md`](../UI_MASTER_SPEC.md)  
**Status:** Documentation — ready for design/engineering planning  
**Depends on:** Phase-01 · [`../home/dashboard-home.md`](../home/dashboard-home.md) · platform dashboard specs

---

## Goal

Redesign Home (and aligned platform/portal home surfaces) into an **exception-first operations dashboard**: sparse metrics with mandatory scope/as-of, actionable queues, and calm empty/loading — Stripe-grade trust without vanity charts.

---

## Scope

**In**

- Staff Dashboard Home composition (metric row, exceptions, work queue, activity)
- Metric / exception / queue widget visual language
- As-of, Property scope, currency disclosure on financial widgets
- Skeleton and empty states for each widget region
- Permission-aware omission of unauthorized widgets (presentation only)
- Platform dashboard and resident portal home visual alignment (same foundations)

**Out**

- New metrics or API fields
- Changing `/dashboard/*` contracts
- Deep finance workspace redesign (covered via shared table/card phases)

---

## Components

| Component | Spec focus |
|---|---|
| `MetricCard` | Caption title, tabular value, delta, footer link, scope/as-of |
| `ExceptionCard` / list | Left semantic bar, drill-down |
| `WorkQueueList` | Count badge, priority without color-only |
| `ActivityTimeline` | Caption timestamps |
| `DashboardGrid` | 12-col desktop / stack mobile |
| Widget `Empty` / `Skeleton` | Geometry-matched |

---

## Pages affected

- [`home/dashboard-home.md`](../home/dashboard-home.md) → `/app`
- [`platform/platform-dashboard.md`](../platform/platform-dashboard.md)
- [`resident-portal/portal-home.md`](../resident-portal/portal-home.md)
- Any embedded “overview” tiles on Finance Overview that reuse metric pattern

---

## Acceptance criteria

1. Every financial/occupancy metric shows **scope + as-of** (and currency when money).
2. Max 2–4 primary metrics above the fold on 1280+; no decorative sparklines required.
3. Unauthorized widgets omit independently without empty “denied” noise.
4. Exceptions link to authorized destinations; cross-org IDs never disclosed.
5. Loading uses per-region skeletons; shell never blanks.
6. Empty copy is specific and calm; one primary CTA max per region.
7. Charts (if any) include text summary / table alternative; not color-only.
8. Matches Master Spec at 1440 light/dark and 390 stacked.

---

## Estimated effort

**6–10 engineering days** + **2–3 design days** (composition + role variants)

---

## Dependencies

- Phase-01 shell geometry signed off
- Dashboard screen specs and API summary endpoints unchanged
- Phase-03 metric/card primitives ideally in parallel or immediately after
