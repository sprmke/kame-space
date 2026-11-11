/**
 * Stay guide access window — the emailed link must work the day it is sent.
 * Run: deno test supabase/functions/_shared/guestStayGuideWindow_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { computeStayGuideValidityWindow } from './guestStayGuide.ts';

Deno.test('window opens at issue time, not on check-in day', () => {
  const now = new Date('2026-12-01T02:00:00.000Z');
  const window = computeStayGuideValidityWindow('2026-12-10', '2026-12-12', now);
  assertEquals(window?.validFrom, '2026-12-01T02:00:00.000Z');
});

Deno.test('window closes the day after check-out, Manila time', () => {
  const window = computeStayGuideValidityWindow(
    '2026-12-10',
    '2026-12-12',
    new Date('2026-12-01T02:00:00.000Z')
  );
  assertEquals(window?.validUntil, '2026-12-13T23:59:59+08:00');
});

Deno.test('a same-day or inverted window is refused', () => {
  const now = new Date('2026-12-01T02:00:00.000Z');
  assertEquals(computeStayGuideValidityWindow('2026-12-10', '2026-12-10', now), null);
  assertEquals(computeStayGuideValidityWindow('2026-12-12', '2026-12-10', now), null);
  assertEquals(computeStayGuideValidityWindow('', '2026-12-10', now), null);
});
