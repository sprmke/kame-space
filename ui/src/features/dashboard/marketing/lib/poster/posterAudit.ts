import { POSTER_ARCHETYPE_FAMILY, type PosterArchetypeId } from '@/features/dashboard/marketing/lib/poster/posterSpec';
import type { PolotnoDesignDocument } from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';

/**
 * Deterministic layout QA for compiled posters (plan Phase 7.1). Runs on the
 * document model, so it works in unit tests and before anything is rendered.
 * Catches the failures that make a post look broken: text off canvas, text boxes
 * colliding, and copy too small to read on a phone.
 */

export type PosterAuditIssue = {
  kind:
    | 'out-of-bounds'
    | 'text-overlap'
    | 'text-too-small'
    | 'text-overflow'
    | 'empty-text'
    | 'invalid-geometry'
    | 'unsafe-zone'
    | 'too-many-fonts'
    | 'text-budget'
    | 'grid-unsafe'
    | 'logo-overlap'
    | 'script-misuse'
    | 'ornament-in-clean';
  element: string;
  detail: string;
};

type Box = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  allowOverlap: boolean;
};

/** ~19px on a 1080 canvas: the smallest size that still reads in a phone feed. */
const MIN_FONT_RATIO = 0.0175;
const EDGE_TOLERANCE = 2;
/** Stories and Reels cover the top 14% and bottom 18% with platform UI. */
const STORY_SAFE_TOP = 0.14;
const STORY_SAFE_BOTTOM = 0.18;
/** Tall enough to be a Story/Reel canvas (9:16). */
const STORY_RATIO = 1.6;

/** Two families plus one script accent; more reads as a ransom note. */
export const MAX_FONT_FAMILIES = 3;
/** Text elements on one poster (including chips, labels and info rows). */
export const MAX_TEXT_ELEMENTS = 18;
/** Script faces belong to the Flyer family only (plan 2.3); Clean and Lifestyle never use one. */
const SCRIPT_FAMILIES = new Set([
  'Great Vibes',
  'Allura',
  'Sacramento',
  'Parisienne',
  'Kaushan Script',
]);

/** The layout family a compiled poster came from, when it records one. */
function documentFamily(document: PolotnoDesignDocument): string | null {
  const poster = document.custom?.poster as { archetype?: string } | undefined;
  const id = poster?.archetype as PosterArchetypeId | undefined;
  return id && id in POSTER_ARCHETYPE_FAMILY ? POSTER_ARCHETYPE_FAMILY[id] : null;
}

/** 4:5 feed posts are cropped to 3:4 in the profile grid. */
const FEED_PORTRAIT_RATIO = 1.25;

function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Approximate ink box for a text node: aligned lines rarely fill the whole width. */
function textInkBox(child: Record<string, unknown>): Box {
  const x = Number(child.x);
  const width = Number(child.width);
  const fontSize = Number(child.fontSize);
  const lines = String(child.text ?? '').split('\n');
  const longest = Math.max(...lines.map((line) => line.length));
  const estimated = Math.min(width, longest * fontSize * 0.6);
  const align = child.align ?? 'center';
  const inkX =
    align === 'left' ? x : align === 'right' ? x + width - estimated : x + (width - estimated) / 2;
  return {
    name: String(child.name ?? child.id),
    x: inkX,
    y: Number(child.y),
    width: estimated,
    height: Number(child.height),
    allowOverlap: Boolean(
      (child.custom as { posterSlot?: { allowOverlap?: boolean } } | undefined)?.posterSlot
        ?.allowOverlap
    ),
  };
}

export function auditPosterDocument(document: PolotnoDesignDocument): PosterAuditIssue[] {
  const issues: PosterAuditIssue[] = [];
  const { width: W, height: H } = document;
  const minFont = Math.min(W, H) * MIN_FONT_RATIO;
  const texts: Box[] = [];
  const families = new Set<string>();
  const family = documentFamily(document);
  const logos: Box[] = [];
  const gridInset = Math.abs(H / W - FEED_PORTRAIT_RATIO) < 0.01 ? (W - (H * 3) / 4) / 2 : 0;

  for (const page of document.pages) {
    for (const child of page.children) {
      const name = String(child.name ?? child.id);
      const x = Number(child.x);
      const y = Number(child.y);
      const width = Number(child.width);
      const height = Number(child.height);
      if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height < 0) {
        issues.push({
          kind: 'invalid-geometry',
          element: name,
          detail: `${x},${y} ${width}x${height}`,
        });
        continue;
      }
      // Full-bleed photos and scrims may legitimately touch or exceed the edges.
      const isBackdrop = child.type === 'image' && /photo/i.test(name);
      const isScrim = /scrim/i.test(name);
      if (!isBackdrop && !isScrim) {
        if (
          x < -EDGE_TOLERANCE ||
          y < -EDGE_TOLERANCE ||
          x + width > W + EDGE_TOLERANCE ||
          y + height > H + EDGE_TOLERANCE
        ) {
          issues.push({
            kind: 'out-of-bounds',
            element: name,
            detail: `box ${Math.round(x)},${Math.round(y)} ${Math.round(width)}x${Math.round(height)} on ${W}x${H}`,
          });
        }
      }
      if (/logo/i.test(name) && child.type !== 'text') {
        logos.push({ name, x, y, width, height, allowOverlap: false });
      }
      if (family && family !== 'flyer' && /^ornament/i.test(name)) {
        issues.push({
          kind: 'ornament-in-clean',
          element: name,
          detail: 'Clean and Lifestyle layouts carry no ornament (plan 2.9)',
        });
      }
      if (child.type === 'text') {
        // The brand wordmark is its own mark, not part of the type system.
        if (
          name !== 'Brand' &&
          String(child.text ?? '').trim() &&
          typeof child.fontFamily === 'string'
        ) {
          families.add(child.fontFamily);
        }
        if (
          family &&
          family !== 'flyer' &&
          typeof child.fontFamily === 'string' &&
          SCRIPT_FAMILIES.has(child.fontFamily) &&
          String(child.text ?? '').trim()
        ) {
          issues.push({
            kind: 'script-misuse',
            element: name,
            detail: `${child.fontFamily} is reserved for the Flyer family`,
          });
        }
        if (!String(child.text ?? '').trim()) {
          issues.push({ kind: 'empty-text', element: name, detail: 'no text' });
          continue;
        }
        if (Number(child.fontSize) < minFont) {
          issues.push({
            kind: 'text-too-small',
            element: name,
            detail: `${child.fontSize}px < ${Math.round(minFont)}px`,
          });
        }
        const slot = (child.custom as { posterSlot?: { overflow?: boolean } } | undefined)
          ?.posterSlot;
        if (slot?.overflow) {
          issues.push({ kind: 'text-overflow', element: name, detail: 'copy exceeds its slot' });
        }
        texts.push(textInkBox(child));
        if (
          gridInset > 0 &&
          (x < gridInset - EDGE_TOLERANCE || x + width > W - gridInset + EDGE_TOLERANCE)
        ) {
          issues.push({
            kind: 'grid-unsafe',
            element: name,
            detail: `x ${Math.round(x)}-${Math.round(x + width)} outside the 3:4 grid crop ${Math.round(gridInset)}-${Math.round(W - gridInset)}`,
          });
        }
        if (H / W > STORY_RATIO) {
          // Text must clear the platform header and the reply/caption area.
          const top = H * STORY_SAFE_TOP - EDGE_TOLERANCE;
          const bottom = H * (1 - STORY_SAFE_BOTTOM) + EDGE_TOLERANCE;
          if (y < top || y + height > bottom) {
            issues.push({
              kind: 'unsafe-zone',
              element: name,
              detail: `y ${Math.round(y)}-${Math.round(y + height)} outside ${Math.round(top)}-${Math.round(bottom)}`,
            });
          }
        }
      }
    }
  }

  if (families.size > MAX_FONT_FAMILIES) {
    issues.push({
      kind: 'too-many-fonts',
      element: 'Typography',
      detail: `${families.size} families: ${[...families].join(', ')}`,
    });
  }
  if (texts.length > MAX_TEXT_ELEMENTS) {
    issues.push({
      kind: 'text-budget',
      element: 'Copy',
      detail: `${texts.length} text elements, budget ${MAX_TEXT_ELEMENTS}`,
    });
  }
  for (const logo of logos) {
    for (const text of texts) {
      if (
        overlapArea(logo, text) > 0 &&
        overlapArea(logo, text) / (text.width * text.height || 1) > 0.05
      ) {
        issues.push({
          kind: 'logo-overlap',
          element: `${logo.name} × ${text.name}`,
          detail: 'logo covers text',
        });
      }
    }
  }

  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      const a = texts[i]!;
      const b = texts[j]!;
      if (a.allowOverlap || b.allowOverlap) continue;
      const area = overlapArea(a, b);
      const smaller = Math.min(a.width * a.height, b.width * b.height);
      if (smaller > 0 && area / smaller > 0.12) {
        issues.push({
          kind: 'text-overlap',
          element: `${a.name} × ${b.name}`,
          detail: `${Math.round((area / smaller) * 100)}% of the smaller box`,
        });
      }
    }
  }
  return issues;
}
