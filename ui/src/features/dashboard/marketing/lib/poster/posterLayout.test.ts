import { describe, expect, it } from 'vitest';

import type { PolotnoChild } from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';
import {
  contentBox,
  flowStack,
  space,
  typeSize,
  type FlowItem,
} from '@/features/dashboard/marketing/lib/poster/posterLayout';
import { createPosterCanvas } from '@/features/dashboard/marketing/lib/poster/posterModules';

const block = (name: string, priority: number, height: number, gap = 10): FlowItem => ({
  name,
  priority,
  gap,
  build: () => ({
    children: [{ id: name, type: 'figure', name, x: 0, y: 0, width: 100, height } as PolotnoChild],
    height,
  }),
});

const yOf = (children: PolotnoChild[], name: string) =>
  Number(children.find((child) => child.name === name)?.y);

describe('spacing and type scale', () => {
  it('scales the spacing steps with the short side', () => {
    expect(space(createPosterCanvas(1080, 1350), 3)).toBe(16);
    expect(space(createPosterCanvas(540, 540), 3)).toBe(8);
  });

  it('never returns type below the legibility floor', () => {
    const tiny = createPosterCanvas(200, 200);
    expect(typeSize(tiny, 'label')).toBeGreaterThanOrEqual(tiny.minText);
  });
});

describe('contentBox', () => {
  it('keeps text inside the Story safe zones', () => {
    const canvas = createPosterCanvas(1080, 1920);
    const box = contentBox(canvas);
    expect(box.y).toBeGreaterThanOrEqual(1920 * 0.14 - 1);
    expect(box.bottom).toBeLessThanOrEqual(1920 * 0.82 + 1);
  });

  it('keeps text inside the 3:4 grid crop on a 4:5 post', () => {
    const canvas = createPosterCanvas(1080, 1350);
    const box = contentBox(canvas);
    expect(box.x).toBeGreaterThanOrEqual(canvas.gridInset);
    expect(box.x + box.width).toBeLessThanOrEqual(1080 - canvas.gridInset);
  });

  it('uses the plain page padding on a square', () => {
    const canvas = createPosterCanvas(1080, 1080);
    expect(contentBox(canvas).x).toBe(canvas.pad);
  });
});

describe('flowStack', () => {
  it('stacks items top to bottom with their gaps', () => {
    const flow = flowStack([block('a', 3, 50), block('b', 2, 30)], { top: 100, bottom: 500 });
    expect(yOf(flow.children, 'a')).toBe(100);
    expect(yOf(flow.children, 'b')).toBe(160);
    expect(flow.height).toBe(90);
    expect(flow.dropped).toEqual([]);
  });

  it('anchors to the bottom and the center of the box', () => {
    const items = () => [block('a', 3, 50, 0)];
    expect(flowStack(items(), { top: 0, bottom: 300 }, 'bottom').top).toBe(250);
    expect(flowStack(items(), { top: 0, bottom: 300 }, 'center').top).toBe(125);
  });

  it('drops the lowest priority item first when the stack does not fit', () => {
    const flow = flowStack(
      [block('hero', 5, 100), block('support', 2, 100), block('footer', 1, 100)],
      { top: 0, bottom: 230 }
    );
    expect(flow.dropped).toEqual(['footer']);
    expect(flow.children.map((child) => child.name)).toEqual(['hero', 'support']);
  });

  it('drops several items in priority order and keeps the hero', () => {
    const flow = flowStack(
      [block('hero', 5, 100), block('support', 2, 100), block('footer', 1, 100)],
      { top: 0, bottom: 120 }
    );
    expect(flow.dropped).toEqual(['footer', 'support']);
    expect(flow.children.map((child) => child.name)).toEqual(['hero']);
  });

  it('drops the later of two equal priorities', () => {
    const flow = flowStack([block('a', 1, 100), block('b', 1, 100)], { top: 0, bottom: 120 });
    expect(flow.dropped).toEqual(['b']);
  });

  it('skips items that build to nothing without leaving a gap', () => {
    const empty: FlowItem = { name: 'none', priority: 9, gap: 40, build: () => null };
    const flow = flowStack([block('a', 3, 50), empty, block('b', 2, 30)], { top: 0, bottom: 400 });
    expect(yOf(flow.children, 'b')).toBe(60);
  });

  it('returns an empty stack for no items and keeps a lone overflowing item', () => {
    expect(flowStack([], { top: 0, bottom: 100 }).children).toEqual([]);
    const lone = flowStack([block('a', 1, 500)], { top: 0, bottom: 100 });
    expect(lone.children).toHaveLength(1);
    expect(lone.dropped).toEqual([]);
  });
});
