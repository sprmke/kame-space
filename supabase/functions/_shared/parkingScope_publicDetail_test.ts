import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * Regression guard for the gap a live check almost missed: the public parking detail must carry
 * the host's own rate (not a platform guest-rate cap) plus the guest service fee fields, so the
 * guest-facing booking card can show rent + service fee = total. Supabase is stubbed at `fetch`.
 */

const FUNCTIONS_URL = 'http://127.0.0.1:54321';

Deno.env.set('SUPABASE_URL', FUNCTIONS_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

const PARKING_ID = 'parking-1';
const ORG_ID = 'org-1';

function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  );
}

globalThis.fetch = ((input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  if (url.includes('/rest/v1/parkings')) {
    return json([
      {
        id: PARKING_ID,
        slug: 'slot-1',
        name: 'Slot 1',
        residence_name: null,
        tower: null,
        level: null,
        slot_label: '1',
        parking_type: 'open',
        settings: {},
        organization_id: ORG_ID,
        organizations: { slug: 'org', name: 'Org', settings: {} },
      },
    ]);
  }
  if (url.includes('/rest/v1/parking_settings')) {
    return json([{ parking_id: PARKING_ID, weekday_nightly_rate: 350, weekend_nightly_rate: 500 }]);
  }
  if (url.includes('/rest/v1/platform_parking_settings')) {
    return json([
      {
        commission_pct: 0.1,
        direct_commission_pct: 0.05,
        guest_fee_pct: 0.05,
        guest_fee_fixed: 15,
        payment_fee_pct: 0.03125,
        payment_fee_fixed: 15,
        support_escalation_phone: null,
      },
    ]);
  }
  // parking_pricing_date_overrides, organizations (brand color lookup) — empty is fine.
  return json([]);
}) as typeof fetch;

const { loadPublicParkingBySlug } = await import('./parkingScope.ts');

Deno.test(
  'public parking detail carries the host rate and the guest fee fields, not a guest-rate cap',
  async () => {
    const detail = await loadPublicParkingBySlug('slot-1');

    assertEquals(detail?.ratePerNight, 350);
    assertEquals(detail?.pricing.weekdayNightlyRate, 350);
    assertEquals(detail?.pricing.weekendNightlyRate, 500);
    assertEquals(detail?.pricing.guestFeePct, 0.05);
    assertEquals(detail?.pricing.guestFeeFixed, 15);
  }
);
