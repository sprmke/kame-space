/**
 * One authoritative payment quote for every billing change — pure, no DB. The preview endpoint,
 * checkout creation, the renewal cron and the credit-only path all call this, so the amount a
 * host reviews is the amount charged.
 *
 * Money model (whole pesos, PHP):
 *  - Fresh-period purchases (first purchase, upgrade, reactivation) start a new period today.
 *    The host is credited for the unused share of what they paid for the current period.
 *  - Renewals charge the next period's total; they carry no proration credit.
 *  - The account ledger (org_billing_ledger) is applied on top: balance > 0 is owed (true-ups),
 *    balance < 0 is credit. Credit is applied automatically and is never paid out as cash.
 *  - Anything left over (credit larger than the charge, or a charge below the PayMongo minimum)
 *    goes back to the ledger instead of being lost.
 *
 * Client preview mirror (display only): see ui/.../plans/lib/orgPlanApi.ts types.
 */

/** PayMongo's practical minimum for hosted checkout. */
export const MINIMUM_CHARGE_PHP = 20;

export type QuoteLineKind =
  'plan' | 'credit_unused' | 'ledger_debt' | 'ledger_credit' | 'minimum_adjustment';

export type QuoteLineItem = {
  kind: QuoteLineKind;
  label: string;
  /** Signed: positive adds to the amount due, negative reduces it. */
  amountPhp: number;
};

export type PaymentQuoteInput = {
  /** Full price of the plan for the period being bought (rate x properties, or admin override). */
  targetTotalPhp: number;
  /** Fresh-period purchases only. 0 for renewals. */
  unusedCreditPhp: number;
  /** org_billing_ledger balance: positive = owed, negative = account credit. */
  ledgerBalancePhp: number;
  planLabel: string;
  minimumChargePhp?: number;
};

export type PaymentQuote = {
  targetTotalPhp: number;
  unusedCreditPhp: number;
  /** True-ups and other amounts the org owes, added to this payment. */
  ledgerDebtPhp: number;
  /** Account credit consumed by this payment. */
  ledgerCreditAppliedPhp: number;
  /** Amount to charge through PayMongo. 0 means the change is fully covered by credit. */
  chargePhp: number;
  coveredByCredit: boolean;
  /** Ledger entries to write once the payment is applied (all amounts positive; kind decides sign). */
  settleDebtPhp: number;
  consumeCreditPhp: number;
  newCreditPhp: number;
  /** Ledger balance after the payment is applied. */
  resultingBalancePhp: number;
  lineItems: QuoteLineItem[];
};

function whole(value: number): number {
  return Math.round(Number.isFinite(value) ? value : 0);
}

export function computePaymentQuote(input: PaymentQuoteInput): PaymentQuote {
  const minimum = input.minimumChargePhp ?? MINIMUM_CHARGE_PHP;
  const target = Math.max(0, whole(input.targetTotalPhp));
  const unused = Math.max(0, whole(input.unusedCreditPhp));
  const balance = whole(input.ledgerBalancePhp);
  const debt = Math.max(0, balance);
  const creditAvailable = Math.max(0, -balance);

  const lineItems: QuoteLineItem[] = [{ kind: 'plan', label: input.planLabel, amountPhp: target }];
  if (unused > 0) {
    lineItems.push({
      kind: 'credit_unused',
      label: 'Unused time on your current plan',
      amountPhp: -unused,
    });
  }
  if (debt > 0) {
    lineItems.push({ kind: 'ledger_debt', label: 'Added properties this period', amountPhp: debt });
  }
  if (creditAvailable > 0) {
    lineItems.push({ kind: 'ledger_credit', label: 'Account credit', amountPhp: -creditAvailable });
  }

  // total > 0: still owed. total <= 0: credit covers everything and -total is left over.
  const total = target - unused + debt - creditAvailable;

  let chargePhp: number;
  let resultingBalancePhp: number;
  let newCreditPhp = 0;

  if (total <= 0) {
    chargePhp = 0;
    resultingBalancePhp = total; // leftover credit (negative) or exactly zero
    newCreditPhp = -total;
  } else if (total < minimum) {
    chargePhp = minimum;
    newCreditPhp = minimum - total;
    resultingBalancePhp = -newCreditPhp;
    lineItems.push({
      kind: 'minimum_adjustment',
      label: 'Minimum payment (excess kept as account credit)',
      amountPhp: minimum - total,
    });
  } else {
    chargePhp = total;
    resultingBalancePhp = 0;
  }

  return {
    targetTotalPhp: target,
    unusedCreditPhp: unused,
    ledgerDebtPhp: debt,
    ledgerCreditAppliedPhp: creditAvailable,
    chargePhp,
    coveredByCredit: chargePhp === 0,
    settleDebtPhp: debt,
    consumeCreditPhp: creditAvailable,
    newCreditPhp,
    resultingBalancePhp,
    lineItems,
  };
}

/**
 * Prorated share of the added monthly cost for the rest of the period (D6: a property added
 * mid-period is covered immediately and the share is added to the next payment).
 * `fractionRemaining` is the unused share of the current period in [0, 1].
 */
export function computePropertyTrueUpPhp(input: {
  totalBeforePhp: number;
  totalAfterPhp: number;
  fractionRemaining: number;
}): number {
  const delta = Math.max(0, whole(input.totalAfterPhp) - whole(input.totalBeforePhp));
  const fraction = Math.min(1, Math.max(0, input.fractionRemaining));
  return Math.round(delta * fraction);
}
