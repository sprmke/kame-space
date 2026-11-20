import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/*
 * Public parking cards show the host's own weekday rate. Supabase is stubbed at `fetch`, which
 * is the only boundary `loadParkingCards` crosses.
 */

Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role');

const PARKINGS = [
  { id: 'p-1', slug: 'slot-1', name: 'Slot 1', slot_label: '1', parking_type: 'covered' },
  { id: 'p-2', slug: 'slot-2', name: 'Slot 2', slot_label: '2', parking_type: 'covered' },
];

// p-1 has a host rate; p-2 has no settings row yet.
const SETTINGS = [{ parking_id: 'p-1', weekday_nightly_rate: 1250, weekend_nightly_rate: 1500 }];

globalThis.fetch = ((input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const table = url.match(/\/rest\/v1\/([a-z_]+)/)?.[1] ?? '';
  const rows = table === 'parkings' ? PARKINGS : table === 'parking_settings' ? SETTINGS : [];
  return Promise.resolve(
    new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  );
}) as typeof fetch;

const { loadParkingCards } = await import('./publicListingCards.ts');

Deno.test('a public parking card shows the host weekday rate, not a platform rate', async () => {
  const cards = await loadParkingCards(['p-1', 'p-2']);
  const byId = new Map(cards.map((card) => [card.id, card]));
  assertEquals(byId.get('p-1')?.ratePerNight, 1250);
});

Deno.test('a parking with no settings row falls back to the seeded weekday rate', async () => {
  const cards = await loadParkingCards(['p-1', 'p-2']);
  const byId = new Map(cards.map((card) => [card.id, card]));
  assertEquals(byId.get('p-2')?.ratePerNight, 300);
});
