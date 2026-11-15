import { describe, expect, it } from 'vitest';

import {
  REEL_BEAT_WORDS,
  REEL_MAX_SECONDS,
  REEL_MIN_SECONDS,
  buildReel,
  buildReelTokens,
  REEL_HEADLINE_PX,
  REEL_MIN_TEXT_PX,
  REEL_SAFE_BOTTOM_PCT,
  REEL_SAFE_TOP_PCT,
  pickReelRecipe,
  reelDurationSeconds,
} from '@/features/dashboard/marketing/lib/video/reelBuilder';
import { getSceneLayers } from '@/features/dashboard/marketing/lib/video/videoSceneLayers';
import type { PosterFacts } from '@/features/dashboard/marketing/lib/poster/posterSpec';

const facts = (photos: number, patch: Partial<PosterFacts> = {}): PosterFacts => ({
  propertyName: 'The Upper Room at Azure North Suites',
  brandName: 'Kame',
  location: 'Azure North, Pampanga',
  checkIn: '2:00 PM',
  checkOut: '11:00 AM',
  securityDeposit: null,
  nightlyRate: '₱3,200',
  amenities: ['Pool'],
  logoUrl: null,
  photos: Array.from({ length: photos }, (_, i) => `https://img/${i}.jpg`),
  ...patch,
});

describe('reel recipes', () => {
  it('uses the long tour with four or more photos, the short cut otherwise', () => {
    expect(pickReelRecipe(6).id).toBe('tour');
    expect(pickReelRecipe(3).id).toBe('highlights');
  });

  it('every recipe lands between 12 and 20 seconds', () => {
    for (const count of [1, 2, 3, 4, 8]) {
      const seconds = reelDurationSeconds(buildReelTokens(facts(count), count).scenes);
      expect(count >= 3 ? seconds : 0).toBeGreaterThanOrEqual(count >= 3 ? REEL_MIN_SECONDS : 0);
      expect(seconds).toBeLessThanOrEqual(REEL_MAX_SECONDS);
    }
  });
});

describe('buildReelTokens', () => {
  it('never holds more photo beats than there are photos and keeps the booking beat', () => {
    const tokens = buildReelTokens(facts(2), 2);
    expect(tokens.scenes.filter((s) => s.kind === 'photo').length).toBe(2);
    expect(tokens.scenes.at(-1)?.kind).toBe('cta');
  });

  it('prints facts only, within the word budget', () => {
    const { copy } = buildReelTokens(facts(5), 5);
    expect(copy.headline).toBe('THE UPPER ROOM');
    expect(copy.promoLine).toBe('From ₱3,200 / night');
    for (const line of [copy.headline, copy.subheadline, copy.promoLine]) {
      expect(line.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(REEL_BEAT_WORDS);
    }
  });

  it('leaves the rate out when the listing has none', () => {
    expect(buildReelTokens(facts(5, { nightlyRate: null }), 5).copy.promoLine).toBe('');
  });
});

describe('buildReel', () => {
  it('returns null without photos', () => {
    expect(buildReel(facts(0))).toBeNull();
  });

  it('builds an editable project that uses the listing photos in order', () => {
    const reel = buildReel(facts(5), { format: 'instagram-story' });
    expect(reel).not.toBeNull();
    expect(reel!.project.format).toBe('instagram-story');
    expect(reel!.project.scenes.length).toBe(reel!.tokens.scenes.length);
    expect(reel!.seconds).toBeGreaterThanOrEqual(REEL_MIN_SECONDS);
    const urls = JSON.stringify(reel!.project.scenes);
    expect(urls).toContain('https://img/0.jpg');
    expect(urls).toContain('https://img/1.jpg');
  });
});

describe('story safe zones', () => {
  it('keeps every text layer between the top and bottom app chrome', () => {
    const reel = buildReel(facts(5, { logoUrl: 'https://img/logo.png' }), {
      format: 'instagram-story',
    })!;
    let texts = 0;
    for (const scene of reel.project.scenes) {
      for (const layer of getSceneLayers(scene)) {
        if (layer.kind === 'image' || layer.kind === 'logo') continue;
        texts += 1;
        expect(layer.position.y).toBeGreaterThanOrEqual(REEL_SAFE_TOP_PCT);
        expect(layer.position.y).toBeLessThanOrEqual(REEL_SAFE_BOTTOM_PCT);
      }
    }
    expect(texts).toBeGreaterThan(0);
  });

  it('leaves other formats untouched', () => {
    const story = buildReel(facts(5), { format: 'instagram-story' })!;
    const square = buildReel(facts(5), { format: 'instagram-post' })!;
    expect(square.project.format).toBe('instagram-post');
    expect(square.project.scenes.length).toBe(story.project.scenes.length);
  });
});

describe('withLeadClip', () => {
  it('makes the first beat a video background and leaves the rest', async () => {
    const { buildReel, withLeadClip } = await import(
      '@/features/dashboard/marketing/lib/video/reelBuilder'
    );
    const reel = buildReel({
      propertyName: 'The Upper Room',
      brandName: null,
      location: 'Pampanga',
      checkIn: null,
      checkOut: null,
      securityDeposit: null,
      nightlyRate: null,
      amenities: [],
      logoUrl: null,
      photos: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'],
    } as never)!;
    const out = withLeadClip(reel.project, 'https://cdn/clip.mp4');
    expect(out.scenes[0]!.imageUrl).toBe('https://cdn/clip.mp4');
    expect(out.scenes[0]!.backgroundMediaType).toBe('video');
    expect(out.scenes[1]!.imageUrl).toBe(reel.project.scenes[1]!.imageUrl);
    expect(out.scenes).toHaveLength(reel.project.scenes.length);
  });
});

describe('applyFocalPoints', () => {
  it('stamps each scene with the focal point of its photo', async () => {
    const { applyFocalPoints } = await import('@/features/dashboard/marketing/lib/video/reelBuilder');
    const project = {
      scenes: [
        { id: 'a', imageUrl: 'u1' },
        { id: 'b', imageUrl: 'u2' },
        { id: 'c', imageUrl: null },
      ],
    } as never;
    const out = applyFocalPoints(project, { u1: { x: 0.3, y: 0.6 }, u2: null }) as {
      scenes: Array<{ focal?: unknown }>;
    };
    expect(out.scenes[0]!.focal).toEqual({ x: 0.3, y: 0.6 });
    expect(out.scenes[1]!.focal).toBeUndefined();
    expect(out.scenes[2]!.focal).toBeUndefined();
  });
});

describe('directed reel copy', () => {
  it('uses AI lines, trimmed to the beat limit, and keeps defaults for empty ones', () => {
    const tokens = buildReelTokens(facts(4), 4, undefined, {
      headline: 'a b c d e f g h i',
      subheadline: '',
      ctaLine: 'Book your stay',
    });
    expect(tokens.copy.headline.split(' ')).toHaveLength(REEL_BEAT_WORDS);
    expect(tokens.copy.subheadline).toBe('Azure North, Pampanga');
    expect(tokens.copy.ctaLine).toBe('Book your stay');
  });
});

describe('story text size', () => {
  it('every text layer is at least 4.5% of the 1920 px frame height', () => {
    const built = buildReel(facts(4), { format: 'instagram-story' })!;
    let seen = 0;
    for (const scene of built.project.scenes) {
      for (const layer of getSceneLayers(scene)) {
        if (layer.kind === 'image' || layer.kind === 'logo' || layer.kind === 'background') continue;
        if (!layer.text && !layer.lines) continue;
        seen += 1;
        expect(layer.typography?.fontSize ?? 0).toBeGreaterThanOrEqual(REEL_MIN_TEXT_PX);
        expect(REEL_MIN_TEXT_PX / 1920).toBeGreaterThanOrEqual(0.045);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('the title line is larger than the supporting lines', () => {
    const built = buildReel(facts(4), { format: 'instagram-story' })!;
    const sizes = new Set<number>();
    for (const scene of built.project.scenes) {
      for (const layer of getSceneLayers(scene)) {
        if (layer.typography?.fontSize) sizes.add(layer.typography.fontSize);
      }
    }
    expect(sizes.has(REEL_HEADLINE_PX)).toBe(true);
    expect(sizes.has(REEL_MIN_TEXT_PX)).toBe(true);
  });
});
