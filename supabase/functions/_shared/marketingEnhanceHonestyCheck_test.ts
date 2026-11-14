import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { ENHANCE_REFUSED_MESSAGE, parseHonestyVerdict } from './marketingEnhanceHonestyCheck.ts';

Deno.test('parseHonestyVerdict: SAME passes', () => {
  assertEquals(parseHonestyVerdict('SAME'), { ok: true });
  assertEquals(parseHonestyVerdict(' same.\n'), { ok: true });
});

Deno.test('parseHonestyVerdict: DIFFERENT fails with host wording', () => {
  assertEquals(parseHonestyVerdict('DIFFERENT'), { ok: false, reason: ENHANCE_REFUSED_MESSAGE });
  assertEquals(parseHonestyVerdict('different - a sofa moved'), {
    ok: false,
    reason: ENHANCE_REFUSED_MESSAGE,
  });
});

Deno.test('parseHonestyVerdict: unreadable answers fail open', () => {
  assertEquals(parseHonestyVerdict(''), { ok: true });
  assertEquals(parseHonestyVerdict('Maybe'), { ok: true });
});
