import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { formatTin, validateBillingDetails } from './orgBillingDetails.ts';

Deno.test('formatTin groups 9 and 12 digit TINs', () => {
  assertEquals(formatTin('123456789'), '123-456-789');
  assertEquals(formatTin('123456789000'), '123-456-789-000');
  assertEquals(formatTin('123-456-789-00000'), '123-456-789-00000');
  assertEquals(formatTin('abc'), 'abc');
});

Deno.test('validateBillingDetails accepts empty details and normalizes input', () => {
  const empty = validateBillingDetails({});
  assertEquals(empty.ok, true);
  const result = validateBillingDetails({
    legalName: '  Kame Stays Inc.  ',
    address: '12 Rizal St\nMakati',
    tin: '123456789',
    billingEmail: ' Billing@Example.COM ',
  });
  assertEquals(result.ok && result.value, {
    legalName: 'Kame Stays Inc.',
    address: '12 Rizal St, Makati',
    tin: '123-456-789',
    billingEmail: 'billing@example.com',
  });
});

Deno.test('validateBillingDetails rejects a bad TIN, email and oversize text', () => {
  const tin = validateBillingDetails({ tin: '12-34' });
  assertEquals(tin.ok === false && tin.field, 'tin');
  const email = validateBillingDetails({ billingEmail: 'nope' });
  assertEquals(email.ok === false && email.field, 'billingEmail');
  const name = validateBillingDetails({ legalName: 'x'.repeat(121) });
  assertEquals(name.ok === false && name.field, 'legalName');
});
