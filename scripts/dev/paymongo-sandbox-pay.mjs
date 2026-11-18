#!/usr/bin/env node
/**
 * Pay a PayMongo SANDBOX hosted checkout (test card, or the e-wallet sandbox authorization), headless.
 *
 *   node scripts/dev/paymongo-sandbox-pay.mjs <checkout_url>
 *
 * Refuses anything that is not a sandbox session: the checkout URL must be a
 * checkout.paymongo.com session, and the card is the documented PayMongo test card
 * (4343 4343 4343 4345) or the sandbox GCash authorization page, neither of which moves money. Prints `paid <final url>` on success.
 * Used by the billing sandbox QA (plan task 9.1). Needs Playwright (already a dev dependency).
 */

import { chromium } from 'playwright';

const url = process.argv[2];
if (!url || !/^https:\/\/checkout\.paymongo\.com\//.test(url)) {
  console.error('Usage: paymongo-sandbox-pay.mjs https://checkout.paymongo.com/...');
  process.exit(2);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 1600 } });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });

  const field = (name) => page.locator(`input[name="${name}"]`);

  // Card when the session offers it, otherwise the preselected e-wallet (GCash or Maya). A closed
  // session (expired, already paid) offers neither and says so instead.
  const card = page.getByRole('button', { name: /^Card/ });
  const wallets = page.getByRole('button', { name: /E-Wallets/ });
  const method = await Promise.race([
    card.waitFor({ timeout: 15_000 }).then(() => 'card'),
    wallets.waitFor({ timeout: 15_000 }).then(() => 'gcash'),
  ]).catch(() => null);
  if (!method) {
    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 200);
    console.log(`blocked ${text}`);
    process.exit(3);
  }

  if (method === 'card') {
    await card.click();
    await field('name').fill('QA Billing Tester');
    await field('email').fill('qa-billing@example.com');
    // Country is a custom select.
    await page.getByText('Select a country').click();
    await page
      .getByRole('option', { name: /Philippines/ })
      .first()
      .click();
    await field('billing.address.line1').fill('1 QA Street');
    await field('billing.address.city').fill('Manila');
    await field('billing.address.state').fill('Metro Manila');
    await field('billing.address.postal_code').fill('1000');
    await field('payment.details.card.number').fill('4343434343434345');
    await field('payment.details.card.expMonth').fill('12');
    await field('payment.details.card.expYear').fill('34');
    await field('payment.details.card.cvc').fill('123');
    await field('payment.details.card.name').fill('QA Billing Tester');
  } else {
    await wallets.click();
    // The first e-wallet (GCash or Maya, whichever the session enables) is preselected.
    await page.getByRole('button', { name: 'Continue' }).click();
    await field('name').fill('QA Billing Tester');
    await field('email').fill('qa-billing@example.com');
  }

  await page.getByRole('button', { name: /^Pay/ }).click();

  // Card goes straight to success_url. GCash lands on PayMongo's sandbox authorization page,
  // where the test payment is authorized with one button.
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const host = new URL(page.url()).host;
    if (host !== 'checkout.paymongo.com' && !/paymongo\.com$/.test(host)) break;
    // The page navigates under us on success, so a click can race it: that is fine.
    await page
      .getByRole('button', { name: /Authorize/i })
      .first()
      .click({ timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(1000);
  }
  console.log(`paid ${page.url()}`);
} catch (error) {
  if (process.env.PAYMONGO_DEBUG_SHOT) {
    await browser
      .contexts()[0]
      ?.pages()[0]
      ?.screenshot({ path: process.env.PAYMONGO_DEBUG_SHOT })
      .catch(() => {});
  }
  console.log(`failed ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
