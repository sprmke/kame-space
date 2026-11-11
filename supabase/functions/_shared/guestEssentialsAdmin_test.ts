/**
 * Guest essentials admin — validation of what a host saves.
 * Run: deno test supabase/functions/_shared/guestEssentialsAdmin_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildEssentialsPatch,
  DEFAULT_REVEAL_LEAD_HOURS,
  toEssentialsAdminDto,
} from './guestEssentialsAdmin.ts';

Deno.test('buildEssentialsPatch - only writes the fields that were sent', () => {
  const { patch, changed, error } = buildEssentialsPatch({ wifiName: 'Kame_2604' });
  assertEquals(error, undefined);
  assertEquals(patch, { wifi_name: 'Kame_2604' });
  assertEquals(changed, ['wifiName']);
});

Deno.test('buildEssentialsPatch - trims and treats null as clear', () => {
  const { patch } = buildEssentialsPatch({ doorCode: '  4821  ', wifiPassword: null });
  assertEquals(patch, { door_code: '4821', wifi_password: '' });
});

Deno.test('buildEssentialsPatch - rejects an over-long field', () => {
  const { error, patch } = buildEssentialsPatch({ wifiName: 'x'.repeat(121) });
  assertEquals(error, 'wifiName is too long');
  assertEquals(patch, {});
});

Deno.test('buildEssentialsPatch - rejects control characters', () => {
  const { error } = buildEssentialsPatch({ wifiPassword: 'abc\u0001def' });
  assertEquals(error, 'wifiPassword contains invalid characters');
});

Deno.test('buildEssentialsPatch - rejects a non-text field', () => {
  const { error } = buildEssentialsPatch({ doorCode: 4821 });
  assertEquals(error, 'doorCode must be text');
});

Deno.test('buildEssentialsPatch - clamps the reveal lead to 0..720', () => {
  assertEquals(buildEssentialsPatch({ revealLeadHours: 48 }).patch, { reveal_lead_hours: 48 });
  assertEquals(buildEssentialsPatch({ revealLeadHours: 4.6 }).patch, { reveal_lead_hours: 5 });
  assertEquals(buildEssentialsPatch({ revealLeadHours: -1 }).error, 'Reveal lead must be between 0 and 720 hours');
  assertEquals(buildEssentialsPatch({ revealLeadHours: 721 }).error, 'Reveal lead must be between 0 and 720 hours');
  assertEquals(
    buildEssentialsPatch({ revealLeadHours: 'soon' }).error,
    'Reveal lead must be a number of hours'
  );
});

Deno.test('toEssentialsAdminDto - missing cells become empty strings', () => {
  const dto = toEssentialsAdminDto({ wifi_name: 'Kame_2604' });
  assertEquals(dto.wifiName, 'Kame_2604');
  assertEquals(dto.doorCode, '');
  assertEquals(dto.revealLeadHours, DEFAULT_REVEAL_LEAD_HOURS);
});

Deno.test('toEssentialsAdminDto - an out-of-range stored lead falls back to the default', () => {
  assertEquals(toEssentialsAdminDto({ reveal_lead_hours: 9999 }).revealLeadHours, 24);
  assertEquals(toEssentialsAdminDto({ reveal_lead_hours: 12 }).revealLeadHours, 12);
  assertEquals(toEssentialsAdminDto(null).revealLeadHours, 24);
});
