import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  computePaymentQuote,
  computePropertyTrueUpPhp,
  MINIMUM_CHARGE_PHP,
} from './orgBillingQuote.ts';

const base = { planLabel: 'Pro plan', ledgerBalancePhp: 0, unusedCreditPhp: 0 };

/** Ledger after payment = start balance - settled debt + consumed credit - new credit. */
function balanceAfter(startBalance: number, q: ReturnType<typeof computePaymentQuote>): number {
  return startBalance - q.settleDebtPhp + q.consumeCreditPhp - q.newCreditPhp;
}

Deno.test('plain purchase charges the full total', () => {
  const q = computePaymentQuote({ ...base, targetTotalPhp: 1600 });
  assertEquals(q.chargePhp, 1600);
  assertEquals(q.coveredByCredit, false);
  assertEquals(q.resultingBalancePhp, 0);
  assertEquals(q.lineItems.length, 1);
});

Deno.test('unused time reduces what is due', () => {
  const q = computePaymentQuote({ ...base, targetTotalPhp: 1600, unusedCreditPhp: 600 });
  assertEquals(q.chargePhp, 1000);
  assertEquals(q.newCreditPhp, 0);
});

Deno.test('credit larger than the plan is kept as account credit, not lost', () => {
  const q = computePaymentQuote({ ...base, targetTotalPhp: 800, unusedCreditPhp: 1000 });
  assertEquals(q.chargePhp, 0);
  assertEquals(q.coveredByCredit, true);
  assertEquals(q.newCreditPhp, 200);
  assertEquals(q.resultingBalancePhp, -200);
});

Deno.test('amount below the PayMongo minimum charges the minimum and keeps the excess', () => {
  const q = computePaymentQuote({ ...base, targetTotalPhp: 800, unusedCreditPhp: 790 });
  assertEquals(q.chargePhp, MINIMUM_CHARGE_PHP);
  assertEquals(q.newCreditPhp, MINIMUM_CHARGE_PHP - 10);
  assertEquals(q.resultingBalancePhp, -(MINIMUM_CHARGE_PHP - 10));
  assertEquals(q.lineItems.at(-1)?.kind, 'minimum_adjustment');
});

Deno.test('account credit is applied and consumed', () => {
  const q = computePaymentQuote({ ...base, targetTotalPhp: 1000, ledgerBalancePhp: -300 });
  assertEquals(q.chargePhp, 700);
  assertEquals(q.consumeCreditPhp, 300);
  assertEquals(balanceAfter(-300, q), 0);
});

Deno.test('owed true-ups are added to the payment and settled', () => {
  const q = computePaymentQuote({ ...base, targetTotalPhp: 1000, ledgerBalancePhp: 150 });
  assertEquals(q.chargePhp, 1150);
  assertEquals(q.settleDebtPhp, 150);
  assertEquals(balanceAfter(150, q), 0);
});

Deno.test('credit covers a whole renewal with a remainder left on the account', () => {
  const q = computePaymentQuote({ ...base, targetTotalPhp: 1000, ledgerBalancePhp: -1500 });
  assertEquals(q.chargePhp, 0);
  assertEquals(q.coveredByCredit, true);
  assertEquals(balanceAfter(-1500, q), -500);
  assertEquals(q.resultingBalancePhp, -500);
});

Deno.test('ledger always reconciles with the resulting balance', () => {
  const cases = [
    { t: 1000, u: 0, b: 0 },
    { t: 1000, u: 400, b: 250 },
    { t: 1000, u: 1500, b: 250 },
    { t: 300, u: 285, b: -10 },
    { t: 300, u: 0, b: -900 },
    { t: 0, u: 0, b: 0 },
    { t: 500, u: 480, b: 0 },
  ];
  for (const c of cases) {
    const q = computePaymentQuote({
      planLabel: 'x',
      targetTotalPhp: c.t,
      unusedCreditPhp: c.u,
      ledgerBalancePhp: c.b,
    });
    assertEquals(balanceAfter(c.b, q), q.resultingBalancePhp, JSON.stringify(c));
    // Cash charged + credit used always covers the plan plus debt minus unused time.
    const covered = q.chargePhp + q.ledgerCreditAppliedPhp + q.unusedCreditPhp - q.ledgerDebtPhp;
    assertEquals(covered - q.newCreditPhp, q.targetTotalPhp, JSON.stringify(c));
  }
});

Deno.test('fractional pesos are rounded to whole pesos', () => {
  const q = computePaymentQuote({ ...base, targetTotalPhp: 999.6, unusedCreditPhp: 100.4 });
  assertEquals(q.chargePhp, 900);
});

Deno.test('property true-up prorates only the added cost', () => {
  assertEquals(
    computePropertyTrueUpPhp({ totalBeforePhp: 800, totalAfterPhp: 1600, fractionRemaining: 0.5 }),
    400
  );
  assertEquals(
    computePropertyTrueUpPhp({ totalBeforePhp: 1600, totalAfterPhp: 1500, fractionRemaining: 0.5 }),
    0
  );
  assertEquals(
    computePropertyTrueUpPhp({ totalBeforePhp: 800, totalAfterPhp: 1600, fractionRemaining: 2 }),
    800
  );
});
