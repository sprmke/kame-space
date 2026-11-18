import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { buildReceiptPdf, formatReceiptAmount } from './orgReceiptPdf.ts';

Deno.test('formatReceiptAmount prints PHP with grouping and a sign for credits', () => {
  assertEquals(formatReceiptAmount(1600), 'PHP 1,600');
  assertEquals(formatReceiptAmount(-300.4), '-PHP 300');
});

Deno.test('buildReceiptPdf produces a PDF even with non-Latin text', async () => {
  const bytes = await buildReceiptPdf({
    brandName: 'Kame Space',
    receiptNumber: 'KS-R-2026-000001',
    paidAtLabel: 'Nov 18, 2026',
    orgName: 'Maria’s Stays — 日本',
    legalName: 'Maria Stays Inc.',
    address: '12 Rizal St, Makati',
    tin: '123-456-789',
    planName: 'Pro plan (2 properties)',
    periodLabel: 'Nov 18, 2026 to Dec 18, 2026',
    paymentMethodLabel: 'GCash',
    lines: [
      { label: 'Pro plan (2 properties)', amountPhp: 1600 },
      { label: 'Unused time on your current plan', amountPhp: -400 },
    ],
    totalPaidPhp: 1200,
  });
  assert(bytes.length > 500);
  assertEquals(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
});
