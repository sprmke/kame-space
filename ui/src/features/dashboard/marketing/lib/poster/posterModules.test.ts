import { describe, expect, it } from 'vitest';

import type { PosterTypeRole } from '@/features/dashboard/marketing/lib/poster/posterFonts';
import {
  burstOrnament,
  createPosterCanvas,
  glassPanel,
  gradientScrim,
  iconElement,
  iconRow,
  infoBar,
  logoElement,
  organicClipSvgUrl,
  photoElement,
  pill,
  posterText,
  rect,
  stickerBadge,
} from '@/features/dashboard/marketing/lib/poster/posterModules';
import { derivePosterPalette } from '@/features/dashboard/marketing/lib/poster/posterColor';

const ROLE: PosterTypeRole = {
  family: 'Poppins',
  weight: '400',
  letterSpacing: 0,
  lineHeight: 1.2,
  widthFactor: 0.6,
};

const UPPER_ROLE: PosterTypeRole = { ...ROLE, uppercase: true, weight: '700' };

const PALETTE = derivePosterPalette({ accent: '#b86a2c' });

describe('createPosterCanvas', () => {
  it('describes a square feed post', () => {
    const canvas = createPosterCanvas(1080, 1080);

    expect(canvas).toMatchObject({
      width: 1080,
      height: 1080,
      short: 1080,
      isPortrait: false,
      isStory: false,
      isWide: false,
      pad: 65,
      minText: 21,
      safeBottom: 0,
    });
    expect(canvas.s(0.5)).toBe(540);
  });

  it('reserves a safe bottom band on a story', () => {
    const canvas = createPosterCanvas(1080, 1920);

    expect(canvas.isPortrait).toBe(true);
    expect(canvas.isStory).toBe(true);
    expect(canvas.safeBottom).toBe(192);
  });

  it('describes a landscape banner', () => {
    const canvas = createPosterCanvas(1920, 1080);

    expect(canvas.isWide).toBe(true);
    expect(canvas.isPortrait).toBe(false);
    expect(canvas.safeBottom).toBe(0);
  });

  it('never lets the legibility floor drop below 12px', () => {
    expect(createPosterCanvas(400, 400).minText).toBe(12);
  });
});

describe('posterText', () => {
  const base = {
    name: 'Headline',
    value: 'Sunset Villa',
    role: ROLE,
    x: 10.4,
    y: 20,
    width: 800,
    maxFontSize: 60,
    fill: '#111111',
  };

  it('returns nothing for empty copy', () => {
    expect(posterText({ ...base, value: '   ' })).toBeNull();
  });

  it('builds an editable text child with a fitter slot', () => {
    const placed = posterText(base);

    expect(placed).not.toBeNull();
    expect(placed!.child).toMatchObject({
      type: 'text',
      name: 'Headline',
      x: 10,
      y: 20,
      width: 800,
      fontFamily: 'Poppins',
      fontWeight: '400',
      align: 'center',
      fill: '#111111',
    });
    expect((placed!.child as { text: string }).text).toBe('Sunset Villa');
    expect(placed!.child).toHaveProperty('custom.posterSlot');
    expect(placed!.child).toHaveProperty('custom.posterSlot.anchor', 'top');
    expect(placed!.height).toBeGreaterThan(0);
  });

  it('measures a bottom-anchored slot upward from y', () => {
    const placed = posterText({ ...base, anchor: 'bottom', y: 500 });

    expect(placed!.child.y).toBe(500 - placed!.height);
    expect(placed!.child).toHaveProperty('custom.posterSlot.anchor', 'bottom');
  });

  it('applies the role transform and display effect', () => {
    const placed = posterText({
      ...base,
      role: UPPER_ROLE,
      effect: 'outline-shadow',
      outlineColor: '#ffcc00',
      shadowColor: '#123456',
    });

    expect(placed!.child).toMatchObject({
      textTransform: 'uppercase',
      fontWeight: '700',
      stroke: '#ffcc00',
      shadowEnabled: true,
      shadowColor: '#123456',
      shadowOpacity: 0.28,
    });
  });

  it('drops an optional slot instead of letting it overflow', () => {
    const placed = posterText({
      ...base,
      value: 'An extremely long headline that cannot possibly fit in a narrow box',
      width: 20,
      maxFontSize: 60,
      optional: true,
    });

    expect(placed).toBeNull();
  });

  it('records overflow when the copy still cannot fit', () => {
    const placed = posterText({
      ...base,
      value: 'An extremely long headline that cannot possibly fit in a narrow box',
      width: 20,
      maxFontSize: 60,
      maxLines: 1,
    });

    expect(placed!.child).toHaveProperty('custom.posterSlot.overflow', true);
  });
});

describe('rect', () => {
  it('rounds geometry and applies structural defaults', () => {
    const shape = rect({ name: 'Panel', x: 1.4, y: 2.6, width: 100.5, height: 40, fill: '#fff' });

    expect(shape).toMatchObject({
      type: 'figure',
      subType: 'rect',
      name: 'Panel',
      x: 1,
      y: 3,
      width: 101,
      height: 40,
      cornerRadius: 0,
      stroke: 'rgba(0,0,0,0)',
      strokeWidth: 0,
    });
  });

  it('supports a circle, a stroke, opacity and a shadow', () => {
    const shape = rect({
      name: 'Dot',
      subType: 'circle',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      fill: '#000',
      stroke: '#fff',
      strokeWidth: 2,
      opacity: 0.5,
      shadow: { blur: 8, offsetY: 2, opacity: 0.3 },
    });

    expect(shape).toMatchObject({
      subType: 'circle',
      stroke: '#fff',
      strokeWidth: 2,
      opacity: 0.5,
      shadowEnabled: true,
      shadowBlur: 8,
      shadowOffsetY: 2,
      shadowColor: '#000000',
    });
  });
});

describe('gradientScrim', () => {
  it('builds a vertical gradient between two alphas', () => {
    const scrim = gradientScrim({
      y: 0,
      height: 400,
      width: 1080,
      color: { r: 0, g: 0, b: 0 },
      from: 0,
      to: 0.6,
    });

    expect(scrim).toMatchObject({
      name: 'Scrim',
      width: 1080,
      height: 400,
      fill: 'linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.6))',
    });
  });
});

describe('iconElement', () => {
  it('embeds an svg data URI and keeps its ratio', () => {
    const icon = iconElement({ icon: 'wifi', x: 5, y: 6, size: 32, color: '#b86a2c' });

    expect(icon).toMatchObject({
      type: 'svg',
      name: 'Icon wifi',
      x: 5,
      y: 6,
      width: 32,
      height: 32,
      keepRatio: true,
    });
    expect(String((icon as { src: string }).src).startsWith('data:image/svg+xml;base64,')).toBe(
      true
    );
  });

  it('marks an icon that sits directly on a photo', () => {
    const icon = iconElement({
      icon: 'wifi',
      x: 0,
      y: 0,
      size: 20,
      color: '#fff',
      onPhoto: true,
    });

    expect(icon).toHaveProperty('custom.posterOnPhoto', true);
  });
});

describe('photoElement', () => {
  it('uses a full crop when the natural size is unknown', () => {
    const photo = photoElement({ url: 'https://img.test/a.jpg', x: 0, y: 0, width: 400, height: 300 });

    expect(photo).toMatchObject({
      type: 'image',
      name: 'Photo',
      src: 'https://img.test/a.jpg',
      keepRatio: false,
      cropX: 0,
      cropY: 0,
      cropWidth: 1,
      cropHeight: 1,
    });
  });

  it('crops a landscape photo inside a portrait frame', () => {
    const photo = photoElement({
      url: 'https://img.test/a.jpg',
      x: 0,
      y: 0,
      width: 300,
      height: 600,
      naturalSize: { width: 1600, height: 900 },
    });

    expect((photo as { cropWidth: number }).cropWidth).toBeLessThan(1);
    expect((photo as { cropHeight: number }).cropHeight).toBe(1);
  });

  it('applies treatment options', () => {
    const photo = photoElement({
      url: 'https://img.test/a.jpg',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      treatment: {
        clipSrc: 'data:image/svg+xml;base64,abc',
        cornerRadius: 12,
        grade: true,
        borderSize: 4,
        borderColor: '#ffffff',
      },
    });

    expect(photo).toMatchObject({
      clipSrc: 'data:image/svg+xml;base64,abc',
      cornerRadius: 12,
      brightnessEnabled: true,
      borderSize: 4,
      borderColor: '#ffffff',
    });
  });
});

describe('pill', () => {
  const base = {
    name: 'Badge',
    label: 'Pet friendly',
    role: ROLE,
    centerX: 540,
    y: 100,
    height: 60,
    maxWidth: 400,
    fill: '#ffffff',
    ink: '#111111',
  };

  it('returns nothing for an empty label', () => {
    expect(pill({ ...base, label: '  ' })).toEqual({
      children: [],
      width: 0,
      height: 0,
      overflow: false,
    });
  });

  it('builds a background shape plus a centered label', () => {
    const result = pill(base);

    expect(result.overflow).toBe(false);
    expect(result.children).toHaveLength(2);
    expect(result.children[0]).toMatchObject({ type: 'figure', cornerRadius: 30 });
    expect(result.children[1]).toMatchObject({ type: 'text', text: 'Pet friendly', align: 'center' });
    expect(result.width).toBeGreaterThan(0);
  });

  it('adds an icon when asked and keeps the pill inside the clamp', () => {
    const result = pill({ ...base, icon: 'paw-print', clampX: [0, 300] });

    expect(result.children).toHaveLength(3);
    expect(result.children[1]).toMatchObject({ type: 'svg' });
    expect((result.children[0] as { x: number }).x).toBeGreaterThanOrEqual(0);
    expect((result.children[0] as { x: number }).x + result.width).toBeLessThanOrEqual(300);
  });

  it('reports overflow for a label that cannot fit on one line', () => {
    const result = pill({ ...base, label: 'An extraordinarily long badge label', maxWidth: 40 });

    expect(result.overflow).toBe(true);
    expect(result.children).toEqual([]);
  });
});

describe('glassPanel', () => {
  it('builds a tinted translucent panel with a hairline border', () => {
    const panel = glassPanel({
      name: 'Glass',
      x: 0,
      y: 0,
      width: 400,
      height: 200,
      tint: { r: 255, g: 255, b: 255 },
      alpha: 0.2,
      radius: 20,
    });

    expect(panel).toMatchObject({
      fill: 'rgba(255,255,255,0.2)',
      cornerRadius: 20,
      stroke: 'rgba(255,255,255,0.38)',
      strokeWidth: 1,
    });
  });
});

describe('organicClipSvgUrl', () => {
  it('returns an svg data URI for each corner', () => {
    const corners = ['top-right', 'bottom-left', 'right', 'left'] as const;
    const urls = corners.map((corner) => organicClipSvgUrl(400, 300, corner));

    for (const url of urls) {
      expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true);
    }
    expect(new Set(urls).size).toBe(4);
  });
});

describe('iconRow', () => {
  it('returns nothing without features', () => {
    const result = iconRow({
      features: [],
      x: 0,
      y: 0,
      width: 800,
      iconSize: 48,
      iconColor: '#111',
      labelColor: '#222',
      labelRole: ROLE,
    });

    expect(result).toEqual({ children: [], height: 0 });
  });

  it('lays out one icon and one label per feature, with rings when asked', () => {
    const result = iconRow({
      features: [
        { label: 'Free WiFi', icon: 'wifi' },
        { label: 'Infinity pool', icon: 'waves' },
      ],
      x: 0,
      y: 0,
      width: 800,
      iconSize: 48,
      iconColor: '#111',
      labelColor: '#222',
      labelRole: ROLE,
      ring: true,
    });

    expect(result.height).toBeGreaterThan(0);
    // per feature: ring rect + icon svg + label text
    expect(result.children.length).toBe(6);
    expect(result.children.filter((child) => child.type === 'svg')).toHaveLength(2);
  });
});

describe('infoBar', () => {
  it('returns nothing when every value is blank', () => {
    expect(
      infoBar({
        items: [{ icon: 'calendar-days', title: 'Check-in', value: '  ' }],
        x: 0,
        y: 0,
        width: 800,
        height: 120,
        palette: PALETTE,
        titleRole: ROLE,
        valueRole: ROLE,
      })
    ).toEqual([]);
  });

  it('builds one cell per non-empty item', () => {
    const children = infoBar({
      items: [
        { icon: 'calendar-days', title: 'Check-in', value: '2:00 PM' },
        { icon: 'calendar-days', title: 'Check-out', value: '12:00 PM' },
      ],
      x: 0,
      y: 0,
      width: 800,
      height: 120,
      palette: PALETTE,
      titleRole: ROLE,
      valueRole: ROLE,
    });

    expect(children.length).toBeGreaterThan(2);
    expect(children.some((child) => child.type === 'svg')).toBe(true);
    expect(children.filter((child) => child.type === 'text').length).toBeGreaterThanOrEqual(4);
  });
});

describe('stickerBadge', () => {
  it('returns nothing for blank text', () => {
    expect(
      stickerBadge({
        text: '  ',
        centerX: 100,
        centerY: 100,
        diameter: 200,
        fill: '#fff',
        ink: '#111',
        role: ROLE,
        sparkleColor: '#f00',
      })
    ).toEqual([]);
  });

  it('builds a circle, a label and a sparkle', () => {
    const children = stickerBadge({
      text: 'PS5 + games',
      centerX: 100,
      centerY: 100,
      diameter: 200,
      fill: '#fff',
      ink: '#111',
      role: ROLE,
      sparkleColor: '#f00',
    });

    expect(children[0]).toMatchObject({ type: 'figure', subType: 'circle' });
    expect(children.some((child) => child.type === 'text')).toBe(true);
    expect(children.at(-1)).toMatchObject({ type: 'svg' });
  });
});

describe('burstOrnament', () => {
  it('returns an svg whose strokes mirror with the flag', () => {
    const normal = burstOrnament({ x: 0, y: 0, size: 48, color: '#f00' });
    const mirrored = burstOrnament({ x: 0, y: 0, size: 48, color: '#f00', mirror: true });

    expect(normal).toMatchObject({ type: 'svg', name: 'Ornament', keepRatio: true });
    expect((normal as { src: string }).src).not.toBe((mirrored as { src: string }).src);
  });
});

describe('logoElement', () => {
  it('builds an image and rounds it when asked', () => {
    expect(logoElement({ url: 'https://img.test/logo.png', x: 1, y: 2, size: 80 })).toMatchObject({
      type: 'image',
      name: 'Logo',
      src: 'https://img.test/logo.png',
      x: 1,
      y: 2,
      width: 80,
      height: 80,
      keepRatio: true,
    });

    expect(logoElement({ url: 'https://img.test/logo.png', x: 0, y: 0, size: 80, round: true })).toMatchObject(
      { cornerRadius: 40 }
    );
  });
});
