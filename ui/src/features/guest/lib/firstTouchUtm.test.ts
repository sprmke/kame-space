import { describe, expect, it } from 'vitest';

import {
  FIRST_TOUCH_KEY,
  captureFirstTouch,
  firstTouchPayload,
  parseFirstTouch,
  readFirstTouch,
} from '@/features/guest/lib/firstTouchUtm';

function storage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    map,
  };
}

describe('parseFirstTouch', () => {
  it('reads the three UTM values and the landing path', () => {
    expect(
      parseFirstTouch('?utm_source=facebook_page&utm_medium=social&utm_campaign=ks-abcd2345', '/properties/demo-stay')
    ).toEqual({
      utmSource: 'facebook_page',
      utmMedium: 'social',
      utmCampaign: 'ks-abcd2345',
      landingAt: '/properties/demo-stay',
    });
  });

  it('returns null when there is no campaign', () => {
    expect(parseFirstTouch('?guests=4', '/properties/demo-stay')).toBeNull();
    expect(parseFirstTouch('', '/')).toBeNull();
  });

  it('caps absurd values', () => {
    const parsed = parseFirstTouch(`?utm_source=${'x'.repeat(400)}`, '/');
    expect(parsed?.utmSource?.length).toBe(120);
  });
});

describe('captureFirstTouch', () => {
  it('keeps the first touch when a later visit has different params', () => {
    const store = storage();
    captureFirstTouch('?utm_source=instagram&utm_campaign=ks-first', '/properties/a', store);
    captureFirstTouch('?utm_source=facebook_page&utm_campaign=ks-second', '/properties/b', store);
    expect(readFirstTouch(store)?.utmCampaign).toBe('ks-first');
    expect(readFirstTouch(store)?.landingAt).toBe('/properties/a');
  });

  it('does not write on an untracked visit', () => {
    const store = storage();
    expect(captureFirstTouch('', '/', store)).toBeNull();
    expect(store.map.has(FIRST_TOUCH_KEY)).toBe(false);
  });

  it('lets a tracked link claim a later visit', () => {
    const store = storage();
    captureFirstTouch('', '/', store);
    captureFirstTouch('?utm_campaign=ks-later', '/properties/a', store);
    expect(readFirstTouch(store)?.utmCampaign).toBe('ks-later');
  });

  it('survives corrupt storage', () => {
    const store = storage({ [FIRST_TOUCH_KEY]: 'not json' });
    expect(readFirstTouch(store)).toBeNull();
    expect(captureFirstTouch('?utm_source=x', '/', store)?.utmSource).toBe('x');
  });
});

describe('firstTouchPayload', () => {
  it('serializes a stored touch and returns null when empty', () => {
    const store = storage();
    expect(firstTouchPayload(store)).toBeNull();
    captureFirstTouch('?utm_source=facebook_page&utm_campaign=ks-abcd2345', '/p', store);
    expect(JSON.parse(firstTouchPayload(store) ?? '{}')).toMatchObject({
      utmSource: 'facebook_page',
      utmCampaign: 'ks-abcd2345',
    });
  });
});
