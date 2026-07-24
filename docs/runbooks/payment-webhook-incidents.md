# Payment webhook incidents

**Status:** Draft · Sprint-11  
**Audience:** On-call engineers, finance ops

## Symptoms

- Provider retries flood Operations Center / `provider_webhook_events`
- Payments missing after sandbox/PSP success
- Duplicate receipts or ledger posts suspected
- `401/403 WEBHOOK_SIGNATURE_INVALID` spikes

## Immediate checks

1. Confirm `PAYMENTS_WEBHOOK_SECRET` matches the provider sandbox/production secret (default local/test value is `sandbox-secret`).
2. Inspect recent rows in `provider_webhook_events` for `processing_status`, `signature_valid`, and `error_message`.
3. Verify clock skew: HMAC payload is `{unixSeconds}.{rawBody}` with a **5-minute** timestamp window (`x-payments-timestamp`).
4. Confirm `external_event_id` uniqueness — duplicate events must return the prior result (`replayed: true`) without a second ledger post.
5. After recovery, complete the [daily reconciliation](./daily-reconciliation.md) checklist so provider settlements match internal payments.

## Signature verification

Headers (sandbox adapter convention):

| Header | Purpose |
|---|---|
| `x-payments-signature` | Hex HMAC-SHA256 of `{timestampSeconds}.{rawBody}` |
| `x-payments-timestamp` | Unix seconds (or ms) of event issuance |
| `x-payments-event-id` | Stable provider event id (also accepted in JSON body) |
| `x-payments-event-type` | e.g. `payment_intent.succeeded` |

Invalid signatures fail closed — no intent/payment mutation.

## Recovery

1. **Invalid HMAC:** Fix secret/header clock; do not manually invent ledger rows.
2. **Duplicate event:** Safe to ignore; confirm one `payment_transactions` row for `provider_payment_id`.
3. **Intent unknown (`IGNORED`):** Ensure the payment intent was created in this environment before the webhook fired.
4. **FAILED processing:** Read `error_message`, fix data (currency/invoice), then ask the provider to replay **the same** `external_event_id` (idempotent).

## Do not

- Store PAN / raw card data while debugging
- Re-post payments by hand when a webhook may still retry
- Bypass Organization isolation when inspecting rows

## Related

- Sprint-11 payments module (`apps/api/src/modules/payments`)
- [Daily reconciliation](./daily-reconciliation.md) (Sprint-12)
- [Reconciliation tolerance](../finance/reconciliation-tolerance.md)
