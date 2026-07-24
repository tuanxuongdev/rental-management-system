import { z } from 'zod';

/** ISO 4217 currency code (exact 3 letters). */
export const currencyCodeSchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO 4217 code');

/**
 * Decimal amount as a string (ADR-0004). Up to 19 digits total with at most 4 fractional digits.
 * Non-negative for Sprint-08 rent/deposit; signed amounts may be added for refunds later.
 */
export const moneyAmountStringSchema = z
  .string()
  .regex(
    /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/,
    'Amount must be a non-negative decimal string with at most 4 fractional digits',
  )
  .refine((value) => {
    const [wholePart, fraction = ''] = value.split('.');
    const whole = wholePart ?? '';
    return whole.length + fraction.length <= 19;
  }, 'Amount exceeds NUMERIC(19,4) precision');

export const moneySchema = z.object({
  amount: moneyAmountStringSchema,
  currency: currencyCodeSchema,
});

export type Money = z.infer<typeof moneySchema>;

export function formatMoney(amount: string, currency: string): string {
  return `${amount} ${currency}`;
}
