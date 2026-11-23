import { describe, expect, it } from 'vitest';

import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import { parseVideoProjectV2 } from '@/features/dashboard/marketing/lib/video/v2/parseVideoProjectV2';
import {
  applyTextLook,
  detectTextLook,
  LOOK_KEYS,
  TEXT_LOOKS,
  textLookById,
  type TextLookId,
} from '@/features/dashboard/marketing/lib/video/v2/textLooks';
import {
  caption,
  photo,
  project,
  track,
} from '@/features/dashboard/marketing/lib/video/v2/videoV2Fixtures';
import { typographyToCss } from '@/features/dashboard/marketing/lib/video/videoLayerTypography';
import type {
  VideoLayerTypography,
  VideoSceneLayer,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';

const BINDING: DesignBinding = {
  propertyName: 'Monaco 2604',
  propertyPhoto: 'https://img.test/hero.jpg',
  nightlyRate: '4,500',
  availabilityText: 'Open dates',
  monthLabel: 'November 2026',
  monthShort: 'Nov',
  openSlots: [{ dateNum: '12', dayName: 'Thu' }],
};

const layer = (): VideoSceneLayer => caption().layer;
const BASE: VideoLayerTypography = {
  fontFamily: 'Jost',
  fontSize: 60,
  fontWeight: 400,
  color: '#abcdef',
};

describe('TEXT_LOOKS', () => {
  it('has twelve looks with unique ids and plain labels', () => {
    expect(TEXT_LOOKS).toHaveLength(12);
    expect(new Set(TEXT_LOOKS.map((look) => look.id)).size).toBe(12);
    for (const look of TEXT_LOOKS) expect(look.label).toMatch(/^[A-Z][A-Za-z ]+$/);
  });

  it('only sets keys that applyTextLook knows how to clear', () => {
    const colors = { accent: '#ff0066', onAccent: '#000000' };
    for (const look of TEXT_LOOKS) {
      for (const key of Object.keys(look.typography(colors))) {
        expect(LOOK_KEYS as readonly string[]).toContain(key);
      }
    }
  });

  it('uses fonts that are preloaded for preview and export', async () => {
    const { VIDEO_FONT_FAMILIES } =
      await import('@/features/dashboard/marketing/lib/video/videoLayerTypography');
    const allowed = new Set<string>(VIDEO_FONT_FAMILIES.map((font) => font.value));
    for (const look of TEXT_LOOKS) {
      const font = look.typography({ accent: '#fff', onAccent: '#000' }).fontFamily;
      if (font) expect(allowed.has(font)).toBe(true);
    }
  });
});

describe('applyTextLook', () => {
  it('Classic removes every look and keeps the host size and layout', () => {
    const boxed = applyTextLook({ ...layer(), typography: { ...BASE, fontSize: 80 } }, 'boxed');
    const back = applyTextLook(boxed, 'classic');
    expect(back.typography?.boxColor).toBeUndefined();
    expect(back.typography?.fontSize).toBe(80);
    expect(back.position).toEqual(layer().position);
  });

  it('switching looks never stacks the old one underneath', () => {
    const glow = applyTextLook(layer(), 'neon', { accent: '#00ffcc', onAccent: '#000' });
    expect(glow.typography?.glowColor).toBe('#00ffcc');
    const outline = applyTextLook(glow, 'outline');
    expect(outline.typography?.glowColor).toBeUndefined();
    expect(outline.typography?.strokeWidth).toBe(3);
  });

  it('uses the brand accent for accent looks', () => {
    const tag = applyTextLook(layer(), 'tag', { accent: '#0d9488', onAccent: '#ffffff' });
    expect(tag.typography?.boxColor).toBe('#0d9488');
    expect(tag.typography?.color).toBe('#ffffff');
  });

  it('does not change the layer it was given', () => {
    const original = layer();
    const snapshot = JSON.stringify(original);
    applyTextLook(original, 'pop');
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});

describe('detectTextLook', () => {
  it('finds the look that was applied, and none for hand edits', () => {
    for (const look of TEXT_LOOKS) {
      expect(detectTextLook(applyTextLook(layer(), look.id))).toBe(look.id);
    }
    const edited = applyTextLook(layer(), 'boxed');
    edited.typography = { ...edited.typography!, color: '#ff0000' };
    expect(detectTextLook(edited)).toBeNull();
  });

  it('treats a layer without a look as Classic', () => {
    expect(detectTextLook(layer())).toBe('classic');
    expect(detectTextLook({ ...layer(), typography: { fontSize: 90 } as never })).toBe('classic');
    // A hand-picked font or colour is custom, not Classic.
    expect(detectTextLook({ ...layer(), typography: BASE })).toBeNull();
  });
});

describe('looks survive save and load', () => {
  it.each(TEXT_LOOKS.map((look) => look.id))('%s round-trips through the project parser', (id) => {
    const looked = applyTextLook({ ...layer(), typography: BASE }, id as TextLookId);
    const item = { ...caption(0, 60), layer: looked };
    const saved = JSON.parse(
      JSON.stringify(project([track('main', [photo(90)]), track('text', [item])]))
    );
    const loaded = parseVideoProjectV2(
      saved,
      'quiet-morning',
      'soft-stay',
      BINDING,
      'instagram-story'
    );
    const loadedLayer = loaded.tracks.flatMap((t) => t.items).find((i) => i.id === item.id);
    expect(loadedLayer && 'layer' in loadedLayer ? loadedLayer.layer.typography : null).toEqual(
      looked.typography
    );
  });
});

describe('typographyToCss for looks', () => {
  it('draws a box behind plain text', () => {
    const css = typographyToCss({ ...BASE, boxColor: '#112233', boxRadius: 14 }, 1);
    expect(css.backgroundColor).toBe('#112233');
    expect(css.borderRadius).toBe(14);
    expect(css.display).toBe('inline-block');
  });

  it('layers a glow with the soft shadow and scales with the frame', () => {
    const css = typographyToCss({ ...BASE, glowColor: '#ff00aa', shadow: true }, 0.5);
    expect(String(css.textShadow)).toContain('#ff00aa');
    expect(String(css.textShadow)).toContain('rgba(0,0,0,0.45)');
    expect(String(css.textShadow)).toContain('9px');
  });

  it('leaves plain text unchanged', () => {
    const css = typographyToCss(BASE, 1);
    expect(css.backgroundColor).toBeUndefined();
    expect(css.textShadow).toBeUndefined();
  });

  it('does not box a button, which has its own pill', () => {
    const css = typographyToCss({ ...BASE, boxColor: '#000', backgroundColor: '#ff0' }, 1, {
      isCta: true,
    });
    expect(css.backgroundColor).toBe('#ff0');
  });
});

describe('textLookById', () => {
  it('falls back to Classic for an unknown id', () => {
    expect(textLookById('nope' as TextLookId).id).toBe('classic');
  });
});
