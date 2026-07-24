/** Display amount with ISO currency (Sprint-08: currency beside amounts). */
export function formatMoney(amount: string | null | undefined, currency: string): string {
  if (amount === null || amount === undefined || amount === '') {
    return `— ${currency}`;
  }
  return `${amount} ${currency}`;
}
