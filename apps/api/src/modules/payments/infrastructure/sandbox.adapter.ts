import { randomUUID } from 'node:crypto';

export type SandboxCheckoutResult = {
  providerIntentId: string;
  checkoutUrl: string;
};

/**
 * Fake PSP adapter — never stores PAN; returns hosted checkout URL only.
 */
export class SandboxPaymentAdapter {
  createCheckout(input: {
    organizationId: string;
    intentId: string;
    amount: string;
    currency: string;
    returnUrl?: string;
  }): SandboxCheckoutResult {
    const providerIntentId = `sandbox_pi_${input.intentId.replace(/-/g, '').slice(0, 16)}`;
    const checkoutUrl = `https://sandbox.payments.local/checkout/${providerIntentId}?amount=${encodeURIComponent(input.amount)}&currency=${encodeURIComponent(input.currency)}${input.returnUrl !== undefined ? `&returnUrl=${encodeURIComponent(input.returnUrl)}` : ''}`;
    return { providerIntentId, checkoutUrl };
  }

  static newProviderPaymentId(): string {
    return `sandbox_pay_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
  }
}
