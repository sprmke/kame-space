import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { contractEndDateForStay, stayBeyondContractEnd } from './stayContractWindow.ts';

function settings(contractEndDate: string | null) {
  return { listingAuthorization: { contractEndDate } };
}

Deno.test('contract window: a check-out on the contract end date is allowed', () => {
  assertEquals(contractEndDateForStay(settings('2026-12-31')), '2026-12-31');
  assertEquals(
    stayBeyondContractEnd({ settings: settings('2026-12-31'), checkOutDate: '2026-12-31' }),
    null
  );
  assertEquals(
    stayBeyondContractEnd({ settings: settings('2026-12-31'), checkOutDate: '2026-12-20' }),
    null
  );
});

Deno.test('contract window: a check-out after the end is refused', () => {
  assertEquals(
    stayBeyondContractEnd({ settings: settings('2026-12-31'), checkOutDate: '2027-01-01' }),
    '2026-12-31'
  );
});

Deno.test('contract window: MM-DD-YYYY form input is normalized', () => {
  assertEquals(
    stayBeyondContractEnd({ settings: settings('2026-12-31'), checkOutDate: '01-01-2027' }),
    '2026-12-31'
  );
  assertEquals(
    stayBeyondContractEnd({ settings: settings('2026-12-31'), checkOutDate: '12-31-2026' }),
    null
  );
});

Deno.test('contract window: no contract or malformed dates never block', () => {
  assertEquals(stayBeyondContractEnd({ settings: {}, checkOutDate: '2027-01-01' }), null);
  assertEquals(
    stayBeyondContractEnd({ settings: settings(null), checkOutDate: '2027-01-01' }),
    null
  );
  assertEquals(
    stayBeyondContractEnd({ settings: settings('2026-12-31'), checkOutDate: 'not-a-date' }),
    null
  );
  assertEquals(
    stayBeyondContractEnd({ settings: settings('bad'), checkOutDate: '2027-01-01' }),
    null
  );
});
