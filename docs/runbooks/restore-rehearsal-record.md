# Restore Rehearsal Record

**Program:** Rental Property Management — Sprint-02  
**Template version:** 1.0

| Field | Value |
|---|---|
| Date (UTC) | _YYYY-MM-DD_ |
| Operator | _name_ |
| Source environment | _e.g. staging snapshot_ |
| Backup / snapshot ID | _provider reference_ |
| Restore target | _instance / database name_ |
| Application git SHA | _commit_ |
| Migration status at test | _output of `prisma migrate status`_ |

## Smoke results

| Check | Result | Notes |
|---|---|---|
| `GET /health` | ☐ Pass ☐ Fail | |
| `GET /ready` (`database: ok`) | ☐ Pass ☐ Fail | |
| `GET /v1/meta/version` | ☐ Pass ☐ Fail | |
| Platform tables present | ☐ Pass ☐ Fail | |

## Outcome

- ☐ **Success** — restore rehearsal complete; M1 recoverability evidence recorded
- ☐ **Failed** — see incident follow-up

## Follow-up actions

_List defects, runbook updates, or infrastructure gaps._
