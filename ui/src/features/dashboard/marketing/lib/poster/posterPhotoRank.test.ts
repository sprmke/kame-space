import { describe, expect, it } from 'vitest';

import type { PhotoAnalysis } from '@/features/dashboard/marketing/lib/poster/posterPhotoAnalysis';
import {
  rankPhotos,
  scorePhoto,
  type RankablePhoto,
} from '@/features/dashboard/marketing/lib/poster/posterPhotoRank';

const zone = (busyness = 0.05) => ({ luma: 0.5, busyness });
function analysis(over: Partial<PhotoAnalysis> = {}): PhotoAnalysis {
  return {
    luma: 0.5,
    contrast: 0.2,
    sharpness: 0.03,
    clipped: 0,
    zones: Array.from({ length: 9 }, () => zone()),
    dHash: '0000000000000000',
    focal: { x: 0.5, y: 0.5 },
    ...over,
  };
}
const photo = (url: string, over: Partial<RankablePhoto> = {}): RankablePhoto => ({
  url,
  width: 1600,
  height: 1200,
  analysis: analysis({
    dHash: url
      .padEnd(16, '0')
      .slice(0, 16)
      .replace(/[^0-9a-f]/g, '0'),
  }),
  ...over,
});

describe('rankPhotos', () => {
  it('returns an empty list for no photos', () => {
    expect(rankPhotos([])).toEqual([]);
  });

  it('keeps the gallery order when photos are otherwise equal', () => {
    const list = [
      photo('a', { analysis: analysis({ dHash: '1' + '0'.repeat(15) }) }),
      photo('b', { analysis: analysis({ dHash: 'f'.repeat(16) }) }),
    ];
    expect(rankPhotos(list).map((p) => p.url)).toEqual(['a', 'b']);
  });

  it('ranks a dark, clipped frame below a well exposed one even when listed first', () => {
    const dark = photo('dark', {
      analysis: analysis({ luma: 0.05, clipped: 0.8, contrast: 0.02, dHash: '1' + '0'.repeat(15) }),
    });
    const good = photo('good', { analysis: analysis({ dHash: 'f'.repeat(16) }) });
    expect(rankPhotos([dark, good]).map((p) => p.url)).toEqual(['good', 'dark']);
  });

  it('penalises low resolution', () => {
    const small = photo('small', {
      width: 300,
      height: 200,
      analysis: analysis({ dHash: '1' + '0'.repeat(15) }),
    });
    const big = photo('big', { analysis: analysis({ dHash: 'f'.repeat(16) }) });
    expect(rankPhotos([small, big]).map((p) => p.url)[0]).toBe('big');
  });

  it('drops near-duplicates and keeps the better one', () => {
    const better = photo('better', { analysis: analysis({ dHash: 'ff00ff00ff00ff00' }) });
    const worse = photo('worse', {
      analysis: analysis({ luma: 0.05, clipped: 0.7, dHash: 'ff00ff00ff00ff01' }),
    });
    expect(rankPhotos([worse, better]).map((p) => p.url)).toEqual(['better']);
  });

  it('never drops everything and tolerates photos with no analysis', () => {
    const list = [photo('a', { analysis: null }), photo('b', { analysis: null })];
    expect(rankPhotos(list)).toHaveLength(2);
  });

  it('prefers a calm top when the layout needs one', () => {
    const busyTop = photo('busy', {
      analysis: analysis({
        dHash: '1' + '0'.repeat(15),
        zones: Array.from({ length: 9 }, (_, i) => zone(i < 3 ? 0.9 : 0.05)),
      }),
    });
    const calmTop = photo('calm', { analysis: analysis({ dHash: 'f'.repeat(16) }) });
    expect(rankPhotos([busyTop, calmTop], null, { calmTop: true })[0]!.url).toBe('calm');
  });

  it('prefers portrait sources for tall layouts and a close aspect for the target', () => {
    const landscape = photo('land', {
      width: 1600,
      height: 900,
      analysis: analysis({ dHash: '1' + '0'.repeat(15) }),
    });
    const portrait = photo('port', {
      width: 900,
      height: 1600,
      analysis: analysis({ dHash: 'f'.repeat(16) }),
    });
    expect(
      rankPhotos([landscape, portrait], { width: 1080, height: 1920 }, { portrait: true })[0]!.url
    ).toBe('port');
  });

  it('keeps scores inside 0..1', () => {
    const extreme = photo('x', {
      analysis: analysis({ luma: 0, clipped: 1, contrast: 0, sharpness: 0 }),
      width: 10,
      height: 10,
    });
    const s = scorePhoto(
      extreme,
      5,
      6,
      { width: 1080, height: 1920 },
      { calmTop: true, portrait: true }
    );
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});
