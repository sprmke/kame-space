import { describe, expect, it } from 'vitest';

import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import { parseVideoProjectV2 } from '@/features/dashboard/marketing/lib/video/v2/parseVideoProjectV2';
import { VIDEO_V2_FPS } from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import { buildDefaultVideoProject } from '@/features/dashboard/marketing/lib/video/videoProjectDefaults';

const BINDING: DesignBinding = {
  propertyName: 'Monaco 2604',
  propertyPhoto: 'https://img.test/hero.jpg',
  nightlyRate: '₱4,500',
  availabilityText: 'Open dates',
  monthLabel: 'November 2026',
  monthShort: 'Nov',
  openSlots: [{ dateNum: '12', dayName: 'Thu' }],
};

function parse(raw: unknown) {
  return parseVideoProjectV2(raw, 'quiet-morning', 'soft-stay', BINDING, 'instagram-story');
}

function mainTrack(raw: object) {
  return { id: 'main', kind: 'main', items: [raw] };
}

describe('parseVideoProjectV2', () => {
  it('falls back to the template project for a non-object', () => {
    const value = parse('nonsense');

    expect(value.version).toBe(2);
    expect(value.tracks[0]?.kind).toBe('main');
    expect(value.tracks[0]!.items.length).toBeGreaterThan(0);
  });

  it('loads a v2 project and sanitizes its items', () => {
    const value = parse({
      version: 2,
      templateId: 'my-template',
      campaignCategory: 'soft-stay',
      format: 'landscape',
      fps: 24,
      background: { color: '#112233', fill: 'blur' },
      tracks: [
        mainTrack({
          id: 'img-1',
          type: 'image',
          from: -10,
          durationInFrames: 5000,
          media: { url: 'https://img.test/a.jpg', source: 'library', width: 1200.6 },
          fit: 'contain',
          transform: { x: -999, y: 50, widthPct: 999, rotation: 720, opacity: 5 },
        }),
      ],
    });

    expect(value).toMatchObject({
      version: 2,
      templateId: 'my-template',
      format: 'landscape',
      fps: 24,
      background: { color: '#112233', fill: 'blur' },
    });

    const item = value.tracks[0]!.items[0]!;
    expect(item).toMatchObject({
      id: 'img-1',
      type: 'image',
      from: 0,
      durationInFrames: 1800,
      fit: 'contain',
    });
    expect(item).toHaveProperty('transform.x', -50);
    expect(item).toHaveProperty('transform.widthPct', 300);
    expect(item).toHaveProperty('transform.rotation', 360);
    expect(item).toHaveProperty('transform.opacity', 1);
    expect(item).toHaveProperty('media.width', 1201);
  });

  it('drops a transition of type none and clamps the duration of a real one', () => {
    const value = parse({
      version: 2,
      tracks: [
        mainTrack({
          type: 'image',
          media: { url: 'https://img.test/a.jpg' },
          transitionIn: { type: 'none', durationInFrames: 15 },
        }),
        mainTrack({
          type: 'image',
          media: { url: 'https://img.test/b.jpg' },
          transitionIn: { type: 'wipe', durationInFrames: 900 },
        }),
      ],
    });

    expect(value).toBeTruthy();
  });

  it('keeps only a supported playback rate and clamps volume', () => {
    const value = parse({
      version: 2,
      tracks: [
        mainTrack({
          type: 'video',
          media: { url: 'https://img.test/v.mp4', durationMs: 10_000 },
          playbackRate: 3,
          volume: 9,
        }),
      ],
    });

    const item = value.tracks[0]!.items[0]!;
    expect(item).not.toHaveProperty('playbackRate');
    expect(item).toHaveProperty('volume', 1);
  });

  it('drops an audio item without a url but keeps a playable one', () => {
    const value = parse({
      version: 2,
      tracks: [
        mainTrack({ type: 'image', media: { url: 'https://img.test/a.jpg' } }),
        { id: 'audio', kind: 'audio', items: [{ type: 'audio', media: {} }] },
      ],
    });

    const audio = value.tracks.find((track) => track.kind === 'audio');
    expect(audio?.items).toEqual([]);
  });

  it('keeps a layer item only when its layer kind is known', () => {
    const value = parse({
      version: 2,
      tracks: [
        mainTrack({ type: 'image', media: { url: 'https://img.test/a.jpg' } }),
        {
          id: 'text',
          kind: 'text',
          items: [
            { type: 'layer', layer: { kind: 'nope' } },
            {
              type: 'layer',
              layer: {
                kind: 'text',
                text: 'Sunset',
                position: { x: 200, y: 50, align: 'sideways' },
              },
              animationIn: { type: 'nope', durationInFrames: 10 },
            },
          ],
        },
      ],
    });

    const text = value.tracks.find((track) => track.kind === 'text');
    expect(text?.items).toHaveLength(1);
    const layer = (text!.items[0] as { layer: Record<string, unknown> }).layer;
    expect(layer.text).toBe('Sunset');
    expect(layer.position).toMatchObject({ x: 120, y: 50 });
    expect((layer.position as Record<string, unknown>).align).toBeUndefined();
  });

  it('folds extra main tracks into the first one', () => {
    const value = parse({
      version: 2,
      tracks: [
        { id: 'main-a', kind: 'main', items: [{ type: 'image', media: { url: 'a' } }] },
        { id: 'main-b', kind: 'main', items: [{ type: 'image', media: { url: 'b' } }] },
      ],
    });

    expect(value.tracks.filter((track) => track.kind === 'main')).toHaveLength(1);
    expect(value.tracks[0]!.items).toHaveLength(2);
  });

  it('makes duplicate ids unique', () => {
    const value = parse({
      version: 2,
      tracks: [
        { id: 'same', kind: 'main', items: [{ id: 'dup', type: 'image', media: { url: 'a' } }] },
        { id: 'same', kind: 'overlay', items: [{ id: 'dup', type: 'image', media: { url: 'b' } }] },
      ],
    });

    const ids = value.tracks.flatMap((track) => [track.id, ...track.items.map((item) => item.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('caps the number of tracks and items', () => {
    const tracks = Array.from({ length: 14 }, (_, index) => ({
      id: `overlay-${index}`,
      kind: 'overlay',
      items: [{ type: 'image', media: { url: `https://img.test/${index}.jpg` } }],
    }));

    const value = parse({ version: 2, tracks: [mainTrack({ type: 'image', media: { url: 'a' } }), ...tracks] });

    expect(value.tracks.length).toBeLessThanOrEqual(10);
  });

  it('drops a track with an unknown kind or no items array', () => {
    const value = parse({
      version: 2,
      tracks: [
        mainTrack({ type: 'image', media: { url: 'a' } }),
        { id: 'x', kind: 'video', items: [] },
        { id: 'y', kind: 'overlay' },
      ],
    });

    expect(value.tracks.map((track) => track.kind)).toEqual(['main']);
  });

  it('repairs a bad template id, category, format, fps and background', () => {
    const value = parse({
      version: 2,
      templateId: 42,
      campaignCategory: null,
      format: 'billboard',
      fps: 240,
      background: { color: 'red', fill: 'solid' },
      tracks: [mainTrack({ type: 'image', media: { url: 'a' } })],
    });

    expect(value.templateId).toBe('quiet-morning');
    expect(value.campaignCategory).toBe('soft-stay');
    expect(value.format).toBe('instagram-story');
    expect(value.fps).toBe(VIDEO_V2_FPS);
    expect(value.background).toEqual({ color: '#0f172a', fill: 'color' });
  });

  it('preserves a palette and a review id', () => {
    const palette = { primary: '#111111', secondary: '#222222', accent: '#333333', ink: '#000000' };
    const value = parse({
      version: 2,
      palette,
      sourceReviewId: 'review-1',
      tracks: [mainTrack({ type: 'image', media: { url: 'a' } })],
    });

    expect(value.palette).toEqual(palette);
    expect(value.sourceReviewId).toBe('review-1');
  });

  it('falls back when every track sanitizes away', () => {
    const value = parse({ version: 2, tracks: [] });

    expect(value.tracks[0]!.items.length).toBeGreaterThan(0);
  });

  it('migrates a v1 project instead of throwing', () => {
    const v1 = buildDefaultVideoProject(
      'quiet-morning',
      'soft-stay',
      BINDING,
      'instagram-story'
    );

    const value = parse(v1);

    expect(value.version).toBe(2);
    expect(value.tracks[0]?.kind).toBe('main');
    expect(value.tracks[0]!.items.length).toBeGreaterThan(0);
  });
});
