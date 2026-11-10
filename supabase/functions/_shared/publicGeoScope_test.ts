import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  MAP_MARKER_CAP,
  readGeoOrigin,
  readMapBbox,
  resolveListingCoords,
} from './publicGeoScope.ts';

/*
 * Public listing geo scoping. `search-listings` resolves "Nearby" to lat/lng, and the
 * category endpoints have to scope the same way or a Nearby tab returns zero results.
 * A wrong parse here empties a public search rather than erroring, which is the kind of
 * bug nobody reports.
 */

function params(entries: Record<string, string>): URLSearchParams {
  return new URLSearchParams(entries);
}

Deno.test('readGeoOrigin needs both coordinates', () => {
  assertEquals(readGeoOrigin(params({ lat: '15.1', lng: '120.5' })), { lat: 15.1, lng: 120.5 });
  assertEquals(readGeoOrigin(params({ lat: '15.1' })), null);
  assertEquals(readGeoOrigin(params({ lng: '120.5' })), null);
  assertEquals(readGeoOrigin(params({})), null);
});

Deno.test('readGeoOrigin rejects blank and non-numeric values', () => {
  assertEquals(readGeoOrigin(params({ lat: '', lng: '120.5' })), null);
  assertEquals(readGeoOrigin(params({ lat: '   ', lng: '120.5' })), null);
  assertEquals(readGeoOrigin(params({ lat: 'north', lng: '120.5' })), null);
});

Deno.test('readGeoOrigin accepts zero as a real coordinate', () => {
  assertEquals(readGeoOrigin(params({ lat: '0', lng: '0' })), { lat: 0, lng: 0 });
});

Deno.test('resolveListingCoords reads numeric and string settings values', () => {
  assertEquals(resolveListingCoords({ latitude: 15.2, longitude: 120.6 }, 'Solea'), {
    lat: 15.2,
    lng: 120.6,
  });
  assertEquals(resolveListingCoords({ latitude: '15.2', longitude: '120.6' }, 'Solea'), {
    lat: 15.2,
    lng: 120.6,
  });
});

Deno.test('resolveListingCoords falls back to the Azure North default', () => {
  assertEquals(resolveListingCoords({}, 'Azure North'), { lat: 15.1696, lng: 120.5598 });
  assertEquals(resolveListingCoords(null, '  AZURE NORTH Residences '), {
    lat: 15.1696,
    lng: 120.5598,
  });
});

Deno.test('resolveListingCoords prefers real settings over the default', () => {
  assertEquals(resolveListingCoords({ latitude: 1, longitude: 2 }, 'Azure North'), {
    lat: 1,
    lng: 2,
  });
});

Deno.test('resolveListingCoords returns null without coordinates or a known residence', () => {
  assertEquals(resolveListingCoords({}, 'Solea Mactan'), null);
  assertEquals(resolveListingCoords({ latitude: 15.2 }, 'Azure North'), {
    lat: 15.1696,
    lng: 120.5598,
  });
  assertEquals(resolveListingCoords('not-an-object', 'Solea'), null);
  assertEquals(resolveListingCoords([1, 2], 'Solea'), null);
});

Deno.test('readMapBbox needs all four corners and a sane orientation', () => {
  assertEquals(
    readMapBbox(params({ swLat: '14.9', swLng: '120.4', neLat: '15.3', neLng: '120.7' })),
    { swLat: 14.9, swLng: 120.4, neLat: 15.3, neLng: 120.7 }
  );

  assertEquals(readMapBbox(params({ swLat: '14.9', swLng: '120.4', neLat: '15.3' })), null);
  assertEquals(readMapBbox(params({})), null);
});

Deno.test('readMapBbox rejects an inverted latitude span', () => {
  assertEquals(
    readMapBbox(params({ swLat: '15.3', swLng: '120.4', neLat: '14.9', neLng: '120.7' })),
    null
  );
});

Deno.test('readMapBbox allows a degenerate single-point box', () => {
  assertEquals(
    readMapBbox(params({ swLat: '15', swLng: '120', neLat: '15', neLng: '120' })),
    { swLat: 15, swLng: 120, neLat: 15, neLng: 120 }
  );
});

Deno.test('the marker cap stays small enough for one payload', () => {
  assertEquals(MAP_MARKER_CAP, 200);
});
