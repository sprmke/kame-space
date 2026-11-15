import { assertEquals } from 'jsr:@std/assert@1';

import { sanitizeReelDirection } from './marketingReelDirector.ts';

Deno.test('reel direction drops bad and repeated photo indexes', () => {
  const out = sanitizeReelDirection(
    { recipe: 'highlights', photoIndexes: [2, 2, 9, -1, 0, 1.5, 1], copy: {} },
    3
  );
  assertEquals(out.photoIndexes, [2, 0, 1]);
  assertEquals(out.recipe, 'highlights');
});

Deno.test('reel direction falls back to tour for an unknown recipe', () => {
  assertEquals(sanitizeReelDirection({ recipe: 'spin', photoIndexes: [] }, 3).recipe, 'tour');
});

Deno.test('reel direction clamps words and strips banned phrases', () => {
  const out = sanitizeReelDirection(
    {
      recipe: 'tour',
      photoIndexes: [0],
      copy: {
        headline: 'one two three four five six seven eight nine',
        subheadline: 'Your perfect getaway',
        ctaLine: 'Book your stay with us today please',
      },
    },
    1
  );
  assertEquals(out.copy.headline, 'one two three four five six seven');
  assertEquals(out.copy.subheadline, '');
  assertEquals(out.copy.ctaLine, 'Book your stay with');
});
