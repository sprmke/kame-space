import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { normalizeImportBookingSource } from './importNormalization.ts';

Deno.test('CSV import keeps every OTA source instead of collapsing it to Direct', () => {
  assertEquals(normalizeImportBookingSource('Agoda'), 'Agoda');
  assertEquals(normalizeImportBookingSource('agoda homes'), 'Agoda');
  assertEquals(normalizeImportBookingSource('Booking.com'), 'Booking.com');
  assertEquals(normalizeImportBookingSource('booking_com'), 'Booking.com');
  assertEquals(normalizeImportBookingSource('VRBO'), 'Vrbo');
});

Deno.test('CSV import still maps the original sources', () => {
  assertEquals(normalizeImportBookingSource('Airbnb'), 'Airbnb');
  assertEquals(normalizeImportBookingSource('FB'), 'Facebook');
  assertEquals(normalizeImportBookingSource('direct'), 'Direct');
  assertEquals(normalizeImportBookingSource(''), '');
});
