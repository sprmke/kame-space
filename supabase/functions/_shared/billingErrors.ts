/** Errors the billing endpoints turn into precise HTTP responses. */

export class BillingRuleError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, code = 'billing_rule', status = 400) {
    super(message);
    this.name = 'BillingRuleError';
    this.code = code;
    this.status = status;
  }
}

/** The price changed between the preview and the confirm. Carries the fresh quote. */
export class PriceChangedError extends BillingRuleError {
  readonly freshChargePhp: number;

  constructor(freshChargePhp: number) {
    super('The price changed. Review the new amount and confirm again.', 'price_changed', 409);
    this.name = 'PriceChangedError';
    this.freshChargePhp = freshChargePhp;
  }
}
