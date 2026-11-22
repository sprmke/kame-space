import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  hasBlockedUrl,
  validateVideoDesignJson,
  VIDEO_PROJECT_LIMITS,
} from './marketingVideoProject.ts';

const image = (from = 0, durationInFrames = 90, extra: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  type: 'image',
  from,
  durationInFrames,
  media: {
    url: 'https://example.test/storage/v1/object/public/marketing-media/a.jpg',
  },
  ...extra,
});

const project = (tracks: unknown[], extra: Record<string, unknown> = {}) => ({
  version: 2,
  tracks,
  ...extra,
});

const code = (value: unknown) => {
  const check = validateVideoDesignJson(value);
  return check.ok ? 'ok' : check.code;
};

Deno.test('a new empty draft and a normal project pass', () => {
  assertEquals(code({}), 'ok');
  assertEquals(code(project([{ kind: 'main', items: [image()] }])), 'ok');
});

Deno.test('v1 scene projects pass, and an absurd one does not', () => {
  assertEquals(code({ scenes: [{ id: 's1' }] }), 'ok');
  assertEquals(code({ version: 1, scenes: Array.from({ length: 41 }, () => ({})) }), 'bad_tracks');
});

Deno.test('rejects things that are not a project', () => {
  assertEquals(code(null), 'not_object');
  assertEquals(code([]), 'not_object');
  assertEquals(code({ version: 3, tracks: [] }), 'bad_version');
  assertEquals(code(project([])), 'bad_tracks');
  assertEquals(code(project(['nope'])), 'bad_tracks');
  assertEquals(code(project([{ kind: 'main', items: 'nope' }])), 'bad_tracks');
});

Deno.test('limits layers, clips and length', () => {
  const tracks = (n: number) => Array.from({ length: n }, () => ({ kind: 'overlay', items: [] }));
  assertEquals(code(project(tracks(VIDEO_PROJECT_LIMITS.maxTracks))), 'ok');
  assertEquals(code(project(tracks(VIDEO_PROJECT_LIMITS.maxTracks + 1))), 'too_many_tracks');

  const many = Array.from({ length: VIDEO_PROJECT_LIMITS.maxItems + 1 }, () => image(0, 3));
  assertEquals(code(project([{ kind: 'main', items: many }])), 'too_many_items');

  const long = image(0, VIDEO_PROJECT_LIMITS.maxDurationFrames + 1);
  assertEquals(code(project([{ kind: 'main', items: [long] }])), 'too_long');
  const exact = image(0, VIDEO_PROJECT_LIMITS.maxDurationFrames);
  assertEquals(code(project([{ kind: 'main', items: [exact] }])), 'ok');
});

Deno.test('caption lines count on their own and have size limits', () => {
  const line = (text = 'Hello', words = 2) => ({
    type: 'caption',
    from: 0,
    durationInFrames: 30,
    text,
    words: Array.from({ length: words }, () => ({ text: 'a', startMs: 0, endMs: 10 })),
  });
  const items = Array.from({ length: VIDEO_PROJECT_LIMITS.maxItems }, () => image(0, 3));
  const captions = Array.from({ length: VIDEO_PROJECT_LIMITS.maxCaptionItems }, () => line());
  assertEquals(
    code(
      project([
        { kind: 'main', items },
        { kind: 'captions', items: captions },
      ])
    ),
    'ok'
  );
  assertEquals(
    code(project([{ kind: 'captions', items: [...captions, line()] }])),
    'too_many_captions'
  );
  assertEquals(
    code(project([{ kind: 'captions', items: [line('x'.repeat(201))] }])),
    'bad_caption'
  );
  assertEquals(code(project([{ kind: 'captions', items: [line('ok', 101)] }])), 'bad_caption');
});

Deno.test('rejects projects over the size cap', () => {
  const big = project([
    {
      kind: 'main',
      items: [image(0, 90, { label: 'x'.repeat(600_000) })],
    },
  ]);
  assertEquals(code(big), 'too_large');
});

Deno.test('rejects data, blob and script URLs anywhere in the project', () => {
  const withUrl = (url: string) =>
    project([{ kind: 'main', items: [image(0, 90, { media: { url } })] }]);
  assertEquals(code(withUrl('https://example.test/a.jpg')), 'ok');
  assertEquals(code(withUrl('data:image/png;base64,AAAA')), 'bad_url');
  assertEquals(code(withUrl('blob:https://x/123')), 'bad_url');
  assertEquals(code(withUrl('javascript:alert(1)')), 'bad_url');
  assertEquals(code(withUrl('  FILE:///etc/passwd')), 'bad_url');
  // A layer image and a poster are checked too.
  assertEquals(
    code(
      project([
        { kind: 'main', items: [image()] },
        {
          kind: 'text',
          items: [
            {
              type: 'layer',
              from: 0,
              durationInFrames: 30,
              layer: { imageUrl: 'data:x' },
            },
          ],
        },
      ])
    ),
    'bad_url'
  );
  assertEquals(hasBlockedUrl({ media: { posterUrl: 'blob:abc' } }), true);
  // Text that merely mentions a scheme is not a URL key.
  assertEquals(hasBlockedUrl({ text: 'data: is a word' }), false);
});
