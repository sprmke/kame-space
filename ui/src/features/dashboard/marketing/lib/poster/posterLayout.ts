import type { PolotnoChild } from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';
import type { PosterCanvas } from '@/features/dashboard/marketing/lib/poster/posterModules';

/**
 * Layout primitives for poster design v2: a spacing scale, a type scale by role, the
 * safe content box of a canvas, and a flow stack that places modules top to bottom
 * and drops the least important ones when the box runs out of room. Layouts become
 * short compositions of these instead of hand-placed coordinates per format.
 */

/** Spacing steps at 1080px; scaled by the canvas short side. */
export const SPACING_SCALE = [4, 8, 12, 16, 24, 32, 48, 64] as const;
export type SpaceStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export function space(canvas: PosterCanvas, step: SpaceStep): number {
  return Math.round((SPACING_SCALE[step] * canvas.short) / 1080);
}

/** Type sizes as a fraction of the short side, by role. */
export const TYPE_SCALE = {
  /** The one hero line. */
  hero: 0.092,
  /** Oversized hero for the type-led layout. */
  display: 0.13,
  /** A single supporting sentence. */
  support: 0.032,
  /** Tracked caps labels and eyebrows. */
  label: 0.024,
  /** Fact values (times, rates). */
  fact: 0.04,
} as const;
export type TypeRoleName = keyof typeof TYPE_SCALE;

export function typeSize(canvas: PosterCanvas, role: TypeRoleName): number {
  return Math.max(canvas.minText, canvas.s(TYPE_SCALE[role]));
}

export type ContentBox = { x: number; y: number; width: number; height: number; bottom: number };

/**
 * The box text may use: inside the page padding, clear of the Story header and reply
 * bar, and inside the centered 3:4 grid crop on a 4:5 post.
 */
export function contentBox(canvas: PosterCanvas): ContentBox {
  const x = Math.max(canvas.pad, canvas.gridInset);
  const y = Math.max(canvas.pad, canvas.safeTop);
  const bottom = canvas.height - Math.max(canvas.pad, canvas.safeBottom);
  return { x, y, width: canvas.width - x * 2, height: bottom - y, bottom };
}

/** Insets a box on every side. */
export function inset(box: ContentBox, amount: number): ContentBox {
  return {
    x: box.x + amount,
    y: box.y + amount,
    width: Math.max(0, box.width - amount * 2),
    height: Math.max(0, box.height - amount * 2),
    bottom: box.bottom - amount,
  };
}

export type FlowItem = {
  name: string;
  /** Higher stays longer: when the stack does not fit, the lowest priority drops first. */
  priority: number;
  /** Space after the item; the last placed item's gap is ignored. */
  gap: number;
  /**
   * Builds the item at y = 0. Translating afterwards keeps measuring independent of
   * where the stack lands.
   */
  build: () => { children: PolotnoChild[]; height: number } | null;
};

export type FlowResult = {
  children: PolotnoChild[];
  /** Top edge of the placed stack. */
  top: number;
  /** Bottom edge of the placed stack. */
  bottom: number;
  height: number;
  /** Items removed to fit, lowest priority first. */
  dropped: string[];
};

function translate(children: PolotnoChild[], dy: number): void {
  if (dy === 0) return;
  for (const child of children) child.y = Math.round(Number(child.y) + dy);
}

/**
 * Stacks items in order inside `box`. Items that build to nothing are skipped, and
 * when the rest do not fit the lowest priority item is dropped until they do. A
 * stack that still overflows with one item left is returned as is (the audit flags it).
 */
export function flowStack(
  items: FlowItem[],
  box: { top: number; bottom: number },
  anchor: 'top' | 'bottom' | 'center' = 'top'
): FlowResult {
  let built = items.flatMap((item) => {
    const result = item.build();
    return result && result.height > 0 ? [{ item, result }] : [];
  });
  const heightOf = (list: typeof built) =>
    list.reduce(
      (sum, entry, index) =>
        sum + entry.result.height + (index < list.length - 1 ? entry.item.gap : 0),
      0
    );
  const available = box.bottom - box.top;
  const dropped: string[] = [];
  while (built.length > 1 && heightOf(built) > available) {
    // Lowest priority goes first; of equals, the later one.
    let victim = 0;
    built.forEach((entry, index) => {
      if (entry.item.priority <= built[victim]!.item.priority) victim = index;
    });
    dropped.push(built[victim]!.item.name);
    built = built.filter((_entry, index) => index !== victim);
  }

  const height = heightOf(built);
  const start =
    anchor === 'bottom'
      ? box.bottom - height
      : anchor === 'center'
        ? box.top + (available - height) / 2
        : box.top;
  const children: PolotnoChild[] = [];
  let cursor = start;
  built.forEach((entry, index) => {
    translate(entry.result.children, cursor);
    children.push(...entry.result.children);
    cursor += entry.result.height + (index < built.length - 1 ? entry.item.gap : 0);
  });
  return { children, top: start, bottom: start + height, height, dropped };
}
