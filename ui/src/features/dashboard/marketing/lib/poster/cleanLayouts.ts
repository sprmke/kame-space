import type { PolotnoChild } from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';
import type {
  PosterBuildContext,
  PosterBuildResult,
} from '@/features/dashboard/marketing/lib/poster/posterArchetypes';
import {
  contentBox,
  flowStack,
  space,
  typeSize,
  type FlowItem,
} from '@/features/dashboard/marketing/lib/poster/posterLayout';
import {
  iconRow,
  logoChip,
  photoElement,
  posterText,
  rect,
  type PosterTextInput,
} from '@/features/dashboard/marketing/lib/poster/posterModules';

/**
 * Clean layout family (plan Phase 2.10): few elements, one hero line, text on calm
 * ground. Photo-first puts type on a single bottom scrim; the framed, big-type and
 * info-card layouts put type on paper, so they hold up on any photo. All compose the
 * primitives in posterLayout.ts instead of hand-placed coordinates.
 */

type TextOptions = Omit<PosterTextInput, 'y' | 'name' | 'x' | 'width'>;

function textItem(
  ctx: PosterBuildContext,
  name: string,
  priority: number,
  gap: number,
  x: number,
  width: number,
  options: TextOptions
): FlowItem {
  return {
    name,
    priority,
    gap,
    build: () => {
      const placed = posterText({
        floor: ctx.canvas.minText,
        align: 'left',
        ...options,
        name,
        x,
        y: 0,
        width,
      });
      return placed ? { children: [placed.child], height: placed.height } : null;
    },
  };
}

/** The place, then the rate: facts the icon row does not repeat. */
function factsLine(ctx: PosterBuildContext): string {
  return ctx.spec.copy.chips.slice(0, 3).join('   ·   ');
}

function eyebrowValue(ctx: PosterBuildContext): string {
  return ctx.spec.copy.eyebrow || ctx.spec.copy.accent;
}

function heroPhoto(
  ctx: PosterBuildContext,
  frame: { x: number; y: number; width: number; height: number },
  treatment: { cornerRadius?: number; focusY?: number } = {}
): PolotnoChild | null {
  const hero = ctx.photos[0];
  if (!hero) return null;
  return photoElement({
    url: hero.url,
    ...frame,
    naturalSize: hero.size,
    name: 'Hero photo',
    treatment: { grade: true, focusY: 0.5, ...treatment },
  });
}

function logoFor(
  ctx: PosterBuildContext,
  corner: { x: number; y: number },
  size: number
): PolotnoChild[] {
  const { spec, facts, palette } = ctx;
  if (!spec.include.logo || !facts.logoUrl) return [];
  return logoChip({ url: facts.logoUrl, x: corner.x, y: corner.y, size, paper: palette.field });
}

function bottomScrim(
  ctx: PosterBuildContext,
  stackTop: number,
  strength: number
): PolotnoChild | null {
  const { canvas, palette } = ctx;
  const fade = canvas.s(0.2);
  const y = Math.max(0, stackTop - fade);
  const height = canvas.height - y;
  if (height <= 0) return null;
  const { r, g, b } = palette.scrimDark;
  const color = (alpha: number) => `rgba(${r},${g},${b},${alpha})`;
  const hold = Math.round(((stackTop - y) / height) * 100);
  return rect({
    name: 'Scrim bottom',
    x: 0,
    y,
    width: canvas.width,
    height,
    fill: `linear-gradient(180deg, ${color(0)} 0%, ${color(strength * 0.9)} ${hold}%, ${color(strength)} 100%)`,
  });
}

// ---------------------------------------------------------------------------
// photo-first: the photo is the poster; one hero line on one soft scrim.
// ---------------------------------------------------------------------------

export function buildPhotoFirst(ctx: PosterBuildContext): PosterBuildResult {
  const { canvas, spec, fonts, palette } = ctx;
  const box = contentBox(canvas);
  const children: PolotnoChild[] = [];
  const photo = heroPhoto(ctx, { x: 0, y: 0, width: canvas.width, height: canvas.height });
  if (photo) children.push(photo);

  const textWidth = canvas.isWide ? box.width * 0.62 : box.width;
  const items: FlowItem[] = [
    textItem(ctx, 'Eyebrow', 2, space(canvas, 2), box.x, textWidth, {
      value: eyebrowValue(ctx),
      role: fonts.eyebrow,
      maxFontSize: typeSize(canvas, 'label'),
      maxLines: 1,
      fill: palette.lightInk,
      opacity: 0.9,
    }),
    textItem(ctx, 'Headline', 5, space(canvas, 3), box.x, textWidth, {
      value: spec.copy.headline,
      role: fonts.display,
      maxFontSize: typeSize(canvas, 'hero'),
      minFontSize: canvas.s(0.045),
      maxLines: canvas.isWide ? 2 : 3,
      fill: palette.lightInk,
    }),
    textItem(ctx, 'Subhead', 3, space(canvas, 3), box.x, textWidth, {
      value: spec.copy.subhead,
      role: fonts.body,
      maxFontSize: typeSize(canvas, 'support'),
      maxLines: 2,
      fill: palette.lightInk,
      opacity: 0.92,
      optional: true,
    }),
    textItem(ctx, 'Facts', 1, 0, box.x, textWidth, {
      value: factsLine(ctx),
      role: fonts.chip,
      maxFontSize: typeSize(canvas, 'label'),
      maxLines: 1,
      fill: palette.lightInk,
      opacity: 0.85,
      optional: true,
    }),
  ];
  // The stack never climbs past the middle of the photo.
  const flow = flowStack(
    items,
    { top: canvas.height * (canvas.isWide ? 0.2 : 0.42), bottom: box.bottom },
    'bottom'
  );
  const scrim = bottomScrim(ctx, flow.top - space(canvas, 4), 0.55);
  if (scrim) children.push(scrim);
  children.push(...flow.children);
  children.push(...logoFor(ctx, { x: box.x, y: box.y }, canvas.s(0.1)));
  return { background: palette.deep, children };
}

// ---------------------------------------------------------------------------
// framed-editorial: a framed photo on paper, type below (or beside, on wide).
// ---------------------------------------------------------------------------

export function buildFramedEditorial(ctx: PosterBuildContext): PosterBuildResult {
  const { canvas, spec, fonts, palette } = ctx;
  const { width: W, height: H, pad } = canvas;
  const box = contentBox(canvas);
  const children: PolotnoChild[] = [];

  const textX = canvas.isWide ? W * 0.5 + pad * 0.5 : box.x;
  const textWidth = canvas.isWide ? W * 0.5 - pad * 1.5 : box.width;
  const items: FlowItem[] = [
    textItem(ctx, 'Eyebrow', 2, space(canvas, 2), textX, textWidth, {
      value: eyebrowValue(ctx),
      role: fonts.eyebrow,
      maxFontSize: typeSize(canvas, 'label'),
      maxLines: 1,
      fill: palette.fieldMuted,
      onSurface: true,
    }),
    textItem(ctx, 'Headline', 5, space(canvas, 3), textX, textWidth, {
      value: spec.copy.headline,
      role: fonts.display,
      maxFontSize: typeSize(canvas, 'hero') * 0.9,
      minFontSize: canvas.s(0.04),
      maxLines: canvas.isWide ? 3 : 2,
      fill: palette.fieldInk,
      onSurface: true,
    }),
    textItem(ctx, 'Subhead', 3, space(canvas, 3), textX, textWidth, {
      value: spec.copy.subhead,
      role: fonts.body,
      maxFontSize: typeSize(canvas, 'support'),
      maxLines: 2,
      fill: palette.fieldInk,
      opacity: 0.85,
      optional: true,
      onSurface: true,
    }),
    textItem(ctx, 'Facts', 1, 0, textX, textWidth, {
      value: factsLine(ctx),
      role: fonts.chip,
      maxFontSize: typeSize(canvas, 'label'),
      maxLines: 1,
      fill: palette.fieldMuted,
      optional: true,
      onSurface: true,
    }),
  ];
  // The type is measured first; the photo takes whatever room it leaves.
  const flow = flowStack(
    items,
    { top: canvas.isWide ? box.y : H * 0.5, bottom: box.bottom },
    canvas.isWide ? 'center' : 'bottom'
  );
  const frameTop = Math.max(pad, canvas.safeTop * 0.5);
  const frame = canvas.isWide
    ? { x: pad, y: pad, width: W * 0.5 - pad, height: H - pad * 2 }
    : {
        x: pad,
        y: frameTop,
        width: W - pad * 2,
        height: flow.top - space(canvas, 5) - frameTop,
      };
  const photo = heroPhoto(ctx, frame, { cornerRadius: canvas.s(0.012) });
  if (photo) children.push(photo);
  children.push(...flow.children);
  // The disc sits on the photo corner, away from the paper copy.
  const chip = canvas.s(0.1);
  children.push(
    ...logoFor(
      ctx,
      { x: frame.x + frame.width - chip - space(canvas, 4), y: frame.y + space(canvas, 4) },
      chip
    )
  );
  return { background: palette.field, children };
}

// ---------------------------------------------------------------------------
// big-type: an oversized hero line over a rounded photo.
// ---------------------------------------------------------------------------

export function buildBigType(ctx: PosterBuildContext): PosterBuildResult {
  const { canvas, spec, fonts, palette } = ctx;
  const { width: W, height: H, pad } = canvas;
  const box = contentBox(canvas);
  const children: PolotnoChild[] = [];

  const textWidth = canvas.isWide ? W * 0.46 - pad : box.width;
  const items: FlowItem[] = [
    textItem(ctx, 'Eyebrow', 2, space(canvas, 3), box.x, textWidth, {
      value: eyebrowValue(ctx),
      role: fonts.eyebrow,
      maxFontSize: typeSize(canvas, 'label'),
      maxLines: 1,
      fill: palette.fieldMuted,
      onSurface: true,
    }),
    textItem(ctx, 'Headline', 5, space(canvas, 4), box.x, textWidth, {
      value: spec.copy.headline,
      role: fonts.display,
      maxFontSize: typeSize(canvas, 'display'),
      minFontSize: canvas.s(0.05),
      maxLines: 3,
      fill: palette.fieldInk,
      onSurface: true,
    }),
    textItem(ctx, 'Subhead', 3, 0, box.x, textWidth, {
      value: spec.copy.subhead,
      role: fonts.body,
      maxFontSize: typeSize(canvas, 'support'),
      maxLines: 2,
      fill: palette.fieldInk,
      opacity: 0.85,
      optional: true,
      onSurface: true,
    }),
  ];
  const flow = flowStack(
    items,
    { top: box.y, bottom: canvas.isWide ? box.bottom : box.y + box.height * 0.5 },
    canvas.isWide ? 'center' : 'top'
  );
  children.push(...flow.children);

  const frame = canvas.isWide
    ? { x: W * 0.5, y: pad, width: W * 0.5 - pad, height: H - pad * 2 }
    : (() => {
        const top = flow.bottom + space(canvas, 5);
        const bottom = H - Math.max(pad, canvas.safeBottom * 0.6);
        return { x: pad, y: top, width: W - pad * 2, height: bottom - top };
      })();
  const photo = frame.height > 0 ? heroPhoto(ctx, frame, { cornerRadius: canvas.s(0.03) }) : null;
  if (photo) children.push(photo);
  const chip = canvas.s(0.09);
  children.push(
    ...logoFor(
      ctx,
      { x: frame.x + frame.width - chip - space(canvas, 4), y: frame.y + space(canvas, 4) },
      chip
    )
  );
  return { background: palette.field, children };
}

// ---------------------------------------------------------------------------
// info-card: photo above, a paper card with the stay facts below.
// ---------------------------------------------------------------------------

function infoCells(ctx: PosterBuildContext): Array<{ title: string; value: string }> {
  const { facts } = ctx;
  const cells: Array<{ title: string; value: string }> = [];
  if (facts.checkIn) cells.push({ title: 'Check-in', value: facts.checkIn });
  if (facts.checkOut) cells.push({ title: 'Check-out', value: facts.checkOut });
  if (facts.securityDeposit) cells.push({ title: 'Deposit', value: facts.securityDeposit });
  if (cells.length === 0 && facts.nightlyRate) {
    cells.push({ title: 'From', value: `${facts.nightlyRate} / night` });
  }
  return cells;
}

function infoRowItem(ctx: PosterBuildContext, x: number, width: number): FlowItem {
  const { canvas, fonts, palette, spec } = ctx;
  return {
    name: 'Facts row',
    priority: 4,
    gap: space(canvas, 3),
    build: () => {
      const cells = infoCells(ctx);
      if (cells.length === 0) {
        // No stay facts: the standout amenities instead, as a one-line icon row.
        if (spec.features.length === 0) return null;
        const row = iconRow({
          features: spec.features.slice(0, 4),
          x,
          y: 0,
          width,
          iconSize: canvas.s(0.062),
          iconColor: palette.fieldInk,
          labelColor: palette.fieldInk,
          labelRole: fonts.body,
          labelScale: 0.4,
          floor: canvas.minText,
          onSurface: true,
          maxPerRow: 4,
        });
        return row.children.length > 0 ? { children: row.children, height: row.height } : null;
      }
      const cellWidth = width / cells.length;
      const children: PolotnoChild[] = [];
      let height = 0;
      cells.forEach((cell, index) => {
        const cellX = x + index * cellWidth;
        const label = posterText({
          floor: canvas.minText,
          name: `${cell.title} label`,
          value: cell.title,
          role: fonts.eyebrow,
          x: cellX,
          y: 0,
          width: cellWidth - space(canvas, 2),
          maxFontSize: typeSize(canvas, 'label'),
          maxLines: 1,
          fill: palette.fieldMuted,
          align: 'left',
          onSurface: true,
        });
        if (!label) return;
        const value = posterText({
          floor: canvas.minText,
          name: `${cell.title} value`,
          value: cell.value,
          role: fonts.display,
          x: cellX,
          y: label.height + space(canvas, 1),
          width: cellWidth - space(canvas, 2),
          maxFontSize: typeSize(canvas, 'fact'),
          minFontSize: canvas.minText,
          maxLines: 1,
          fill: palette.fieldInk,
          align: 'left',
          onSurface: true,
        });
        children.push(label.child);
        if (value) {
          children.push(value.child);
          height = Math.max(height, value.y + value.height);
        } else {
          height = Math.max(height, label.height);
        }
      });
      return children.length > 0 ? { children, height } : null;
    },
  };
}

export function buildInfoCard(ctx: PosterBuildContext): PosterBuildResult {
  const { canvas, spec, fonts, palette } = ctx;
  const { width: W, height: H, pad } = canvas;
  const box = contentBox(canvas);
  const children: PolotnoChild[] = [];

  const textX = canvas.isWide ? W * 0.5 + pad : box.x;
  const textWidth = canvas.isWide ? W * 0.5 - pad * 2 : box.width;
  const items: FlowItem[] = [
    textItem(ctx, 'Eyebrow', 2, space(canvas, 2), textX, textWidth, {
      value: eyebrowValue(ctx),
      role: fonts.eyebrow,
      maxFontSize: typeSize(canvas, 'label'),
      maxLines: 1,
      fill: palette.fieldMuted,
      onSurface: true,
    }),
    textItem(ctx, 'Headline', 5, space(canvas, 4), textX, textWidth, {
      value: spec.copy.headline,
      role: fonts.display,
      maxFontSize: typeSize(canvas, 'hero') * 0.85,
      minFontSize: canvas.s(0.04),
      maxLines: 2,
      fill: palette.fieldInk,
      onSurface: true,
    }),
    infoRowItem(ctx, textX, textWidth),
    textItem(ctx, 'Facts', 1, 0, textX, textWidth, {
      value: factsLine(ctx),
      role: fonts.chip,
      maxFontSize: typeSize(canvas, 'label'),
      maxLines: 1,
      fill: palette.fieldMuted,
      optional: true,
      onSurface: true,
    }),
  ];
  // The card hugs its content; the photo takes the rest of the canvas above it.
  const flow = flowStack(
    items,
    { top: canvas.isWide ? box.y : H * 0.46, bottom: box.bottom },
    canvas.isWide ? 'center' : 'bottom'
  );
  const cardTop = canvas.isWide ? 0 : flow.top - space(canvas, 5);
  const frame = canvas.isWide
    ? { x: 0, y: 0, width: W * 0.5, height: H }
    : { x: 0, y: 0, width: W, height: cardTop + canvas.s(0.05) };
  const photo = heroPhoto(ctx, frame);
  if (photo) children.push(photo);
  children.push(
    rect({
      name: 'Info card',
      x: canvas.isWide ? W * 0.5 : 0,
      y: cardTop,
      width: canvas.isWide ? W * 0.5 : W,
      height: H - cardTop,
      fill: palette.field,
      cornerRadius: canvas.isWide ? 0 : canvas.s(0.045),
    })
  );
  children.push(...flow.children);
  const chip = canvas.s(0.1);
  children.push(...logoFor(ctx, { x: box.x, y: box.y }, chip));
  return { background: palette.field, children };
}

// ---------------------------------------------------------------------------
// split-panel: the photo bleeds off the top (or the left), a paper panel holds the type.
// ---------------------------------------------------------------------------

export function buildSplitPanel(ctx: PosterBuildContext): PosterBuildResult {
  const { canvas, spec, fonts, palette } = ctx;
  const { width: W, height: H, pad } = canvas;
  const box = contentBox(canvas);
  const children: PolotnoChild[] = [];

  const textX = canvas.isWide ? W * 0.5 + pad : box.x;
  const textWidth = canvas.isWide ? W * 0.5 - pad * 2 : box.width;
  const items: FlowItem[] = [
    textItem(ctx, 'Eyebrow', 2, space(canvas, 2), textX, textWidth, {
      value: eyebrowValue(ctx),
      role: fonts.eyebrow,
      maxFontSize: typeSize(canvas, 'label'),
      maxLines: 1,
      fill: palette.fieldMuted,
      onSurface: true,
    }),
    textItem(ctx, 'Headline', 5, space(canvas, 3), textX, textWidth, {
      value: spec.copy.headline,
      role: fonts.display,
      maxFontSize: typeSize(canvas, 'hero') * 0.85,
      minFontSize: canvas.s(0.04),
      maxLines: canvas.isWide ? 3 : 2,
      fill: palette.fieldInk,
      onSurface: true,
    }),
    textItem(ctx, 'Subhead', 3, space(canvas, 3), textX, textWidth, {
      value: spec.copy.subhead,
      role: fonts.body,
      maxFontSize: typeSize(canvas, 'support'),
      maxLines: 2,
      fill: palette.fieldInk,
      opacity: 0.85,
      optional: true,
      onSurface: true,
    }),
    textItem(ctx, 'Facts', 1, space(canvas, 2), textX, textWidth, {
      value: factsLine(ctx),
      role: fonts.chip,
      maxFontSize: typeSize(canvas, 'label'),
      maxLines: 1,
      fill: palette.fieldMuted,
      optional: true,
      onSurface: true,
    }),
    textItem(ctx, 'Cta line', 1, 0, textX, textWidth, {
      value: spec.copy.cta,
      role: fonts.chip,
      maxFontSize: typeSize(canvas, 'label'),
      maxLines: 1,
      fill: palette.fieldInk,
      optional: true,
      onSurface: true,
    }),
  ];
  const flow = flowStack(
    items,
    { top: canvas.isWide ? box.y : H * 0.5, bottom: box.bottom },
    canvas.isWide ? 'center' : 'bottom'
  );
  // The photo is flush with the canvas edges: the panel is the only paper.
  const frame = canvas.isWide
    ? { x: 0, y: 0, width: W * 0.5, height: H }
    : { x: 0, y: 0, width: W, height: Math.max(0, flow.top - space(canvas, 5)) };
  const photo = frame.height > 0 ? heroPhoto(ctx, frame) : null;
  if (photo) children.push(photo);
  children.push(...flow.children);
  const chip = canvas.s(0.1);
  children.push(
    ...logoFor(ctx, { x: frame.x + frame.width - chip - pad, y: Math.max(pad, canvas.safeTop) }, chip)
  );
  return { background: palette.field, children };
}

// ---------------------------------------------------------------------------
// quote-card: centred headline set like a pull quote, a photo band beneath.
// ---------------------------------------------------------------------------

export function buildQuoteCard(ctx: PosterBuildContext): PosterBuildResult {
  const { canvas, spec, fonts, palette } = ctx;
  const { width: W, height: H, pad } = canvas;
  const box = contentBox(canvas);
  const children: PolotnoChild[] = [];

  const textX = box.x;
  const textWidth = canvas.isWide ? W * 0.52 - pad : box.width;
  const align = 'center' as const;
  const items: FlowItem[] = [
    textItem(ctx, 'Eyebrow', 2, space(canvas, 3), textX, textWidth, {
      value: eyebrowValue(ctx),
      role: fonts.eyebrow,
      maxFontSize: typeSize(canvas, 'label'),
      maxLines: 1,
      align,
      fill: palette.fieldMuted,
      onSurface: true,
    }),
    textItem(ctx, 'Headline', 5, space(canvas, 3), textX, textWidth, {
      value: spec.copy.headline,
      role: fonts.display,
      maxFontSize: typeSize(canvas, 'display'),
      minFontSize: canvas.s(0.045),
      maxLines: 3,
      align,
      fill: palette.fieldInk,
      onSurface: true,
    }),
    textItem(ctx, 'Subhead', 3, 0, textX, textWidth, {
      value: spec.copy.subhead,
      role: fonts.body,
      maxFontSize: typeSize(canvas, 'support'),
      maxLines: 2,
      align,
      fill: palette.fieldInk,
      opacity: 0.85,
      optional: true,
      onSurface: true,
    }),
  ];
  const bandHeight = canvas.isWide ? 0 : H * (H / W > 1.5 ? 0.48 : 0.44);
  const flow = flowStack(
    items,
    {
      top: box.y + (canvas.isWide ? 0 : canvas.s(0.02)),
      bottom: canvas.isWide ? box.bottom : H - bandHeight - space(canvas, 5),
    },
    'center'
  );
  children.push(...flow.children);
  // One short accent rule above the quote: the only ornament.
  const ruleWidth = canvas.s(0.1);
  children.push(
    rect({
      name: 'Accent rule',
      x: textX + (textWidth - ruleWidth) / 2,
      y: Math.max(box.y, flow.top - space(canvas, 5)),
      width: ruleWidth,
      height: Math.max(3, canvas.s(0.005)),
      fill: palette.accent,
    })
  );
  const frame = canvas.isWide
    ? { x: W * 0.52, y: 0, width: W * 0.48, height: H }
    : { x: 0, y: H - bandHeight, width: W, height: bandHeight };
  const photo = heroPhoto(ctx, frame);
  if (photo) children.push(photo);
  const chip = canvas.s(0.09);
  children.push(
    ...logoFor(ctx, { x: frame.x + frame.width - chip - pad, y: frame.y + space(canvas, 4) }, chip)
  );
  return { background: palette.field, children };
}

// ---------------------------------------------------------------------------
// Lifestyle family: several real photos on paper, type beneath. With fewer photos
// than a layout wants, it uses what it has (never repeats a photo).
// ---------------------------------------------------------------------------

type Frame = { x: number; y: number; width: number; height: number };

function lifestylePhoto(
  ctx: PosterBuildContext,
  index: number,
  frame: Frame,
  cornerRadius: number
): PolotnoChild | null {
  const photo = ctx.photos[index];
  if (!photo || frame.width <= 0 || frame.height <= 0) return null;
  return photoElement({
    url: photo.url,
    ...frame,
    naturalSize: photo.size,
    name: index === 0 ? 'Hero photo' : `Photo ${index + 1}`,
    treatment: { grade: true, focusY: 0.5, cornerRadius },
  });
}

/** Text on paper in the lower part (or right half on wide); returns the area left for photos. */
function lifestyleLayout(
  ctx: PosterBuildContext,
  align: 'left' | 'center'
): { children: PolotnoChild[]; area: Frame } {
  const { canvas, spec, fonts, palette } = ctx;
  const { width: W, height: H, pad } = canvas;
  const box = contentBox(canvas);
  const textX = canvas.isWide ? W * 0.5 + pad * 0.5 : box.x;
  const textWidth = canvas.isWide ? W * 0.5 - pad * 1.5 : box.width;
  const items: FlowItem[] = [
    textItem(ctx, 'Eyebrow', 2, space(canvas, 2), textX, textWidth, {
      value: eyebrowValue(ctx),
      role: fonts.eyebrow,
      maxFontSize: typeSize(canvas, 'label'),
      maxLines: 1,
      align,
      fill: palette.fieldMuted,
      onSurface: true,
    }),
    textItem(ctx, 'Headline', 5, space(canvas, 3), textX, textWidth, {
      value: spec.copy.headline,
      role: fonts.display,
      maxFontSize: typeSize(canvas, 'hero') * 0.9,
      minFontSize: canvas.s(0.04),
      maxLines: canvas.isWide ? 3 : 2,
      align,
      fill: palette.fieldInk,
      onSurface: true,
    }),
    textItem(ctx, 'Subhead', 3, space(canvas, 3), textX, textWidth, {
      value: spec.copy.subhead,
      role: fonts.body,
      maxFontSize: typeSize(canvas, 'support'),
      maxLines: 2,
      align,
      fill: palette.fieldInk,
      opacity: 0.85,
      optional: true,
      onSurface: true,
    }),
    textItem(ctx, 'Facts', 1, 0, textX, textWidth, {
      value: factsLine(ctx),
      role: fonts.chip,
      maxFontSize: typeSize(canvas, 'label'),
      maxLines: 1,
      align,
      fill: palette.fieldMuted,
      optional: true,
      onSurface: true,
    }),
  ];
  const flow = flowStack(
    items,
    { top: canvas.isWide ? box.y : H * 0.5, bottom: box.bottom },
    canvas.isWide ? 'center' : 'bottom'
  );
  const top = Math.max(pad, canvas.safeTop * 0.5);
  const area: Frame = canvas.isWide
    ? { x: pad, y: pad, width: W * 0.5 - pad, height: H - pad * 2 }
    : { x: pad, y: top, width: W - pad * 2, height: flow.top - space(canvas, 5) - top };
  return { children: flow.children, area };
}

function lifestyleLogo(ctx: PosterBuildContext, area: Frame): PolotnoChild[] {
  const chip = ctx.canvas.s(0.09);
  return logoFor(
    ctx,
    { x: area.x + area.width - chip - space(ctx.canvas, 4), y: area.y + space(ctx.canvas, 4) },
    chip
  );
}

export function buildArchFrame(ctx: PosterBuildContext): PosterBuildResult {
  const { canvas, palette } = ctx;
  const { children, area } = lifestyleLayout(ctx, 'center');
  const out: PolotnoChild[] = [];
  // A frame narrower than the area, centred; a full-radius corner makes the arch.
  const width = Math.min(area.width, area.height * 0.78);
  const frame: Frame = {
    x: area.x + (area.width - width) / 2,
    y: area.y,
    width,
    height: area.height,
  };
  const photo = lifestylePhoto(ctx, 0, frame, Math.round(width / 2));
  if (photo) out.push(photo);
  out.push(...children, ...lifestyleLogo(ctx, { ...frame, x: frame.x + canvas.s(0.04) }));
  return { background: palette.field, children: out };
}

export function buildDuoCollage(ctx: PosterBuildContext): PosterBuildResult {
  const { canvas, palette } = ctx;
  const { children, area } = lifestyleLayout(ctx, 'left');
  const out: PolotnoChild[] = [];
  const gap = space(canvas, 3);
  const radius = canvas.s(0.014);
  if (ctx.photos.length < 2) {
    const photo = lifestylePhoto(ctx, 0, area, radius);
    if (photo) out.push(photo);
  } else {
    // Two frames side by side; the second sits lower, so it reads as a collage.
    const width = (area.width - gap) / 2;
    const drop = Math.min(area.height * 0.12, canvas.s(0.08));
    const a = lifestylePhoto(ctx, 0, { x: area.x, y: area.y, width, height: area.height - drop }, radius);
    const b = lifestylePhoto(
      ctx,
      1,
      { x: area.x + width + gap, y: area.y + drop, width, height: area.height - drop },
      radius
    );
    if (a) out.push(a);
    if (b) out.push(b);
  }
  out.push(...children, ...lifestyleLogo(ctx, area));
  return { background: palette.field, children: out };
}

export function buildTrioGrid(ctx: PosterBuildContext): PosterBuildResult {
  const { canvas, palette } = ctx;
  const { children, area } = lifestyleLayout(ctx, 'left');
  const out: PolotnoChild[] = [];
  const gap = space(canvas, 3);
  const radius = canvas.s(0.014);
  if (ctx.photos.length < 3) {
    const rest = buildDuoCollage(ctx);
    return rest;
  }
  // One large frame and two stacked beside it.
  const bigWidth = (area.width - gap) * 0.6;
  const smallWidth = area.width - gap - bigWidth;
  const smallHeight = (area.height - gap) / 2;
  const frames: Array<[number, Frame]> = [
    [0, { x: area.x, y: area.y, width: bigWidth, height: area.height }],
    [1, { x: area.x + bigWidth + gap, y: area.y, width: smallWidth, height: smallHeight }],
    [
      2,
      {
        x: area.x + bigWidth + gap,
        y: area.y + smallHeight + gap,
        width: smallWidth,
        height: smallHeight,
      },
    ],
  ];
  for (const [index, frame] of frames) {
    const photo = lifestylePhoto(ctx, index, frame, radius);
    if (photo) out.push(photo);
  }
  out.push(...children, ...lifestyleLogo(ctx, area));
  return { background: palette.field, children: out };
}
