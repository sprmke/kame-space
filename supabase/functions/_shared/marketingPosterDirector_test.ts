import { assertEquals } from 'jsr:@std/assert@1';

import {
  allowedPropertyPhotoUrls,
  clampCopyForLayout,
  clampCopyText,
  POSTER_DIRECTOR_PROMPT,
  groundPosterFeatures,
  loadPosterPhotos,
  posterPhotoFetchTarget,
  preferArchetypeFirst,
  preferredArchetypeLine,
  readPosterOffer,
  readPreferredArchetype,
  type PosterFactsInput,
  revisableSpec,
  sanitizeVariant,
  stripBannedCopy,
  stripInventedOffers,
} from './marketingPosterDirector.ts';

const FACTS: PosterFactsInput = {
  propertyName: 'Sample Stay',
  brandName: 'Sample Stay',
  location: 'Azure North, Pampanga',
  checkIn: '2:00 PM',
  checkOut: '12:00 PM',
  securityDeposit: '₱2,000',
  nightlyRate: null,
  amenities: ['WiFi', 'Swimming Pool', 'Coffee Maker'],
};

Deno.test('groundPosterFeatures drops amenities the property does not have', () => {
  assertEquals(
    groundPosterFeatures(['WiFi', 'Pool', 'Sauna', 'Rooftop bar'], 'sky-headline', FACTS, ''),
    ['WiFi', 'Pool']
  );
});

Deno.test('groundPosterFeatures accepts amenities the host named in the prompt', () => {
  assertEquals(
    groundPosterFeatures(['PS5 + games'], 'wave-duo', FACTS, 'Promote our new PS5 setup'),
    ['PS5 + games']
  );
});

Deno.test('groundPosterFeatures allows use-case labels on feature-sticker', () => {
  assertEquals(
    groundPosterFeatures(['Game nights', 'Family bonding'], 'feature-sticker', FACTS, ''),
    ['Game nights', 'Family bonding']
  );
});

Deno.test('allowedPropertyPhotoUrls reads gallery media and legacy images, skipping video', () => {
  const allowed = allowedPropertyPhotoUrls({
    media: [
      { id: '1', url: 'https://cdn.example.com/a.jpg', type: 'image' },
      { id: '2', url: 'https://cdn.example.com/b.mp4', type: 'video' },
    ],
    images: ['https://cdn.example.com/c.jpg'],
  });
  assertEquals([...allowed].sort(), [
    'https://cdn.example.com/a.jpg',
    'https://cdn.example.com/c.jpg',
  ]);
});

Deno.test('loadPosterPhotos never fetches URLs outside the allow-list', async () => {
  const calls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => {
    calls.push(String(input));
    return Promise.resolve(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'content-type': 'image/jpeg' },
      })
    );
  }) as typeof fetch;
  try {
    const result = await loadPosterPhotos(
      [
        'https://cdn.example.com/a.jpg',
        'http://169.254.169.254/latest',
        'https://evil.example/x.jpg',
      ],
      new Set(['https://cdn.example.com/a.jpg', 'http://169.254.169.254/latest'])
    );
    assertEquals(calls, ['https://cdn.example.com/a.jpg']);
    assertEquals(result.urls, ['https://cdn.example.com/a.jpg']);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('stripBannedCopy clears stock phrases but keeps the rest', () => {
  assertEquals(
    stripBannedCopy({
      tagline: 'Your perfect getaway.',
      headline: 'Slow',
      chips: ['Sweet escape', 'Hot coffee'],
    }),
    { tagline: '', headline: 'Slow', chips: ['Hot coffee'] }
  );
});

Deno.test('loadPosterPhotos keeps the combined payload under the inline budget', async () => {
  const realFetch = globalThis.fetch;
  const threeMb = new Uint8Array(3 * 1024 * 1024);
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(threeMb, { headers: { 'content-type': 'image/jpeg' } })
    )) as typeof fetch;
  try {
    const urls = [1, 2, 3, 4, 5, 6].map((n) => `https://cdn.example.com/${n}.jpg`);
    const result = await loadPosterPhotos(urls, new Set(urls));
    assertEquals(result.photos.length, 4);
    assertEquals(result.urls, urls.slice(0, 4));
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('loadPosterPhotos skips non-image and failed responses', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith('html.jpg')) {
      return Promise.resolve(new Response('<html>', { headers: { 'content-type': 'text/html' } }));
    }
    if (url.endsWith('404.jpg')) {
      return Promise.resolve(new Response('', { status: 404 }));
    }
    if (url.endsWith('boom.jpg')) return Promise.reject(new Error('network'));
    return Promise.resolve(
      new Response(new Uint8Array([1]), {
        headers: { 'content-type': 'image/webp' },
      })
    );
  }) as typeof fetch;
  try {
    const urls = ['html', '404', 'boom', 'ok'].map((n) => `https://cdn.example.com/${n}.jpg`);
    const result = await loadPosterPhotos(urls, new Set(urls));
    assertEquals(result.urls, ['https://cdn.example.com/ok.jpg']);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('sanitizeVariant drops photo indexes the model never saw and forces the goal', () => {
  const variant = sanitizeVariant(
    {
      archetype: 'sky-headline',
      goal: 'promo',
      photoIndexes: [0, 5, -1, 1.5, 1],
      features: ['WiFi', 'Sauna'],
      copy: { headline: 'Slow', tagline: 'Sweet escape' },
    },
    {
      organizationId: 'o',
      propertyId: 'p',
      goal: 'vibe',
      prompt: '',
      facts: FACTS,
      brandColor: null,
      photos: [
        { url: 'https://a/0.jpg', mimeType: 'image/jpeg', data: '' },
        { url: 'https://a/1.jpg', mimeType: 'image/jpeg', data: '' },
      ],
      count: 4,
    }
  );
  assertEquals(variant.goal, 'vibe');
  assertEquals(variant.photoIndexes, [0, 1]);
  assertEquals(variant.features, [{ label: 'WiFi' }]);
  assertEquals(variant.copy, { headline: 'Slow', tagline: '' });
});

Deno.test('revisableSpec sends only the art-direction fields of the current post', () => {
  const spec = {
    version: 1,
    archetype: 'wave-duo',
    fontPairing: 'tropical-script',
    goal: 'vibe',
    palette: { accent: '#ff8800' },
    copy: { headline: 'Slow mornings' },
    features: [{ label: 'WiFi', icon: 'wifi' }],
    include: { infoBar: true },
    photoIndexes: [0, 2],
    label: 'Morning',
  };
  assertEquals(revisableSpec(spec), {
    archetype: 'wave-duo',
    fontPairing: 'tropical-script',
    palette: { accent: '#ff8800' },
    copy: { headline: 'Slow mornings' },
    features: [{ label: 'WiFi', icon: 'wifi' }],
    photoIndexes: [0, 2],
    label: 'Morning',
  });
});

// ── AI Studio examples: picked layout ───────────────────────────────────────

const DIRECTOR_INPUT = {
  organizationId: 'org',
  propertyId: 'prop',
  goal: 'promo' as const,
  prompt: '',
  facts: FACTS,
  brandColor: null,
  photos: [],
  count: 4,
};

Deno.test('readPreferredArchetype keeps known layouts and drops anything else', () => {
  assertEquals(readPreferredArchetype('night-glass'), 'night-glass');
  assertEquals(readPreferredArchetype('not-a-layout'), null);
  assertEquals(readPreferredArchetype(42), null);
  assertEquals(readPreferredArchetype(undefined), null);
});

Deno.test('preferredArchetypeLine asks for the picked layout on new batches only', () => {
  assertEquals(preferredArchetypeLine({ ...DIRECTOR_INPUT }), null);
  const line = preferredArchetypeLine({ ...DIRECTOR_INPUT, preferredArchetype: 'sky-headline' });
  assertEquals(line?.includes('"sky-headline"'), true);
  assertEquals(
    preferredArchetypeLine({
      ...DIRECTOR_INPUT,
      preferredArchetype: 'sky-headline',
      revise: { spec: {}, instruction: 'shorter headline' },
    }),
    null
  );
});

Deno.test(
  'preferArchetypeFirst moves the picked layout to the front, keeping the rest in order',
  () => {
    const variants = [
      { archetype: 'wave-duo' },
      { archetype: 'feature-sticker' },
      { archetype: 'night-glass' },
      { archetype: 'sky-headline' },
    ];
    assertEquals(
      preferArchetypeFirst(variants, 'night-glass').map((v) => v.archetype),
      ['night-glass', 'wave-duo', 'feature-sticker', 'sky-headline']
    );
    assertEquals(preferArchetypeFirst(variants, 'wave-duo'), variants);
    assertEquals(preferArchetypeFirst(variants, 'magazine-cover'), variants);
    assertEquals(preferArchetypeFirst(variants, null), variants);
  }
);

Deno.test(
  'posterPhotoFetchTarget passes https and maps local Storage to the project origin',
  () => {
    const project = 'http://kong:8000';
    assertEquals(
      posterPhotoFetchTarget('https://cdn.example.com/a.jpg', project),
      'https://cdn.example.com/a.jpg'
    );
    assertEquals(
      posterPhotoFetchTarget(
        'http://127.0.0.1:54321/storage/v1/object/public/p/a.jpg?t=1',
        project
      ),
      'http://kong:8000/storage/v1/object/public/p/a.jpg?t=1'
    );
    assertEquals(
      posterPhotoFetchTarget('http://localhost:54321/storage/v1/object/public/p/a.jpg', project),
      'http://kong:8000/storage/v1/object/public/p/a.jpg'
    );
  }
);

Deno.test('posterPhotoFetchTarget refuses other http hosts and non-Storage paths', () => {
  const project = 'http://kong:8000';
  assertEquals(posterPhotoFetchTarget('http://169.254.169.254/latest', project), null);
  assertEquals(posterPhotoFetchTarget('http://127.0.0.1:54321/rest/v1/secret', project), null);
  assertEquals(posterPhotoFetchTarget('http://evil.example/storage/v1/x.jpg', project), null);
  assertEquals(posterPhotoFetchTarget('http://127.0.0.1:54321/storage/v1/x.jpg', null), null);
  assertEquals(posterPhotoFetchTarget('not a url', project), null);
});

Deno.test('clampCopyText trims to the word and character budget without cutting a word', () => {
  assertEquals(
    clampCopyText('Slow mornings by the sea', { words: 3, chars: 40 }),
    'Slow mornings by'
  );
  assertEquals(clampCopyText('Slow mornings by the sea', { words: 5, chars: 14 }), 'Slow mornings');
  assertEquals(clampCopyText('  spaced   out  ', { words: 5, chars: 40 }), 'spaced out');
  assertEquals(
    clampCopyText('Extraordinarilylongword here', { words: 2, chars: 10 }),
    'Extraordinarilylongword'
  );
  assertEquals(clampCopyText('', { words: 2, chars: 10 }), '');
  assertEquals(clampCopyText('Cozy,', { words: 2, chars: 10 }), 'Cozy');
});

Deno.test('clampCopyForLayout enforces each layout budget and tidies chips', () => {
  const copy = {
    headline: 'Sunrise over the quiet lagoon today',
    accent: 'Slow mornings forever and ever',
    subhead: 'Keep this as is.',
    chips: ['Sea view', 'sea view', 'Pet friendly guests welcome', '', 5, 'Kitchen', 'Extra'],
  };
  const magazine = clampCopyForLayout(copy, 'magazine-cover');
  assertEquals(magazine.headline, 'Sunrise');
  assertEquals(magazine.accent, 'Slow mornings');
  assertEquals(magazine.subhead, 'Keep this as is.');
  assertEquals(magazine.chips, ['Sea view', 'Pet friendly', 'Kitchen']);
  // An unknown layout is not trimmed beyond chips.
  assertEquals(clampCopyForLayout(copy, 'nope').headline, copy.headline);
});

Deno.test('sanitizeVariant clamps copy for the chosen layout', () => {
  const out = sanitizeVariant(
    { archetype: 'sky-headline', copy: { accent: 'Golden Hour Paradise', headline: 'Welcome' } },
    { facts: FACTS, goal: 'vibe', prompt: '', photos: [] } as never
  );
  assertEquals((out.copy as Record<string, unknown>).accent, 'Golden');
});

Deno.test('director prompt version moved with the v3 prompt', () => {
  assertEquals(POSTER_DIRECTOR_PROMPT.version, '2026-11-13.3');
});

Deno.test(
  'readPosterOffer keeps a good offer and drops expired, malformed or oversized ones',
  () => {
    const today = '2026-11-13';
    assertEquals(
      readPosterOffer(
        { text: '20% off weekdays', validUntil: '2026-12-31', code: 'summer10' },
        today
      ),
      { text: '20% off weekdays', validUntil: '2026-12-31', code: 'SUMMER10' }
    );
    assertEquals(
      readPosterOffer({ text: 'Free breakfast', validUntil: '2026-11-12' }, today),
      null
    );
    assertEquals(
      readPosterOffer({ text: 'Free breakfast', validUntil: '2026-11-13' }, today)?.validUntil,
      '2026-11-13'
    );
    assertEquals(
      readPosterOffer({ text: 'Free breakfast', validUntil: '2026-02-31', code: 'a b' }, today),
      { text: 'Free breakfast', validUntil: null, code: null }
    );
    assertEquals(
      readPosterOffer({ text: 'a very long offer that goes on and on forever and ever' }, today),
      null
    );
    assertEquals(readPosterOffer({ text: '   ' }, today), null);
    assertEquals(readPosterOffer('nope', today), null);
    assertEquals(readPosterOffer(null, today), null);
    assertEquals(readPosterOffer({ text: '10% off — weekdays' }, today)?.text, '10% off, weekdays');
  }
);

Deno.test('stripInventedOffers blanks deal wording and keeps plain copy', () => {
  const out = stripInventedOffers({
    headline: 'Cozy Corner',
    subhead: 'Save 20% on your stay',
    tagline: 'Limited time only',
    cta: 'Book direct',
    chips: ['Pool', '20% off', 'Wi-Fi'],
  });
  assertEquals(out.headline, 'Cozy Corner');
  assertEquals(out.subhead, '');
  assertEquals(out.tagline, '');
  assertEquals(out.cta, 'Book direct');
  assertEquals(out.chips, ['Pool', 'Wi-Fi']);
});

Deno.test(
  'sanitizeVariant strips invented offers unless the host gave one or it is a revision',
  () => {
    const base = {
      organizationId: 'o',
      propertyId: 'p',
      goal: 'promo' as const,
      prompt: '',
      brandColor: null,
      photos: [],
      count: 1,
      facts: {
        propertyName: 'X',
        brandName: null,
        location: null,
        checkIn: null,
        checkOut: null,
        securityDeposit: null,
        nightlyRate: null,
        amenities: [],
      },
    };
    const raw = {
      archetype: 'photo-first',
      copy: { headline: 'Save 20% today', subhead: 'Book now' },
    };
    const none = sanitizeVariant(raw, base).copy as Record<string, string>;
    assertEquals(none.headline, '');
    assertEquals(none.subhead, 'Book now');
    const withOffer = sanitizeVariant(raw, {
      ...base,
      facts: { ...base.facts, offer: { text: '20% off', validUntil: null, code: null } },
    }).copy as Record<string, string>;
    assertEquals(withOffer.headline, 'Save 20% today');
    const revised = sanitizeVariant(raw, {
      ...base,
      revise: { spec: {}, instruction: 'change' },
    }).copy as Record<string, string>;
    assertEquals(revised.headline, 'Save 20% today');
  }
);
