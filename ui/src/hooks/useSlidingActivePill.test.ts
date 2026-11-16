import { describe, expect, it, vi } from 'vitest';

import { scrollActiveItemIntoView } from '@/hooks/useSlidingActivePill';

type Box = { top: number; bottom: number; left: number; right: number };

function mockScrollPort(opts: {
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
  scrollLeft?: number;
  scrollTop?: number;
  box: Box;
  itemBox: Box;
}) {
  const scrollTo = vi.fn();
  const container = {
    scrollWidth: opts.scrollWidth,
    clientWidth: opts.clientWidth,
    scrollHeight: opts.scrollHeight,
    clientHeight: opts.clientHeight,
    scrollLeft: opts.scrollLeft ?? 0,
    scrollTop: opts.scrollTop ?? 0,
    getBoundingClientRect: () => opts.box,
    scrollTo,
  } as unknown as HTMLElement;
  const item = {
    getBoundingClientRect: () => opts.itemBox,
  } as unknown as HTMLElement;
  return { container, item, scrollTo };
}

describe('scrollActiveItemIntoView', () => {
  it('scrolls vertically when the active item is below the fold', () => {
    const { container, item, scrollTo } = mockScrollPort({
      scrollWidth: 200,
      clientWidth: 200,
      scrollHeight: 800,
      clientHeight: 300,
      box: { top: 100, bottom: 400, left: 0, right: 200 },
      itemBox: { top: 500, bottom: 544, left: 8, right: 192 },
    });

    scrollActiveItemIntoView(container, item, false);

    expect(scrollTo).toHaveBeenCalledWith({
      left: 0,
      // item.bottom 544 - container.bottom 400 + gutter 24 = 168
      top: 168,
      behavior: 'auto',
    });
  });

  it('scrolls vertically when the active item is above the fold', () => {
    const { container, item, scrollTo } = mockScrollPort({
      scrollWidth: 200,
      clientWidth: 200,
      scrollHeight: 800,
      clientHeight: 300,
      scrollTop: 400,
      box: { top: 100, bottom: 400, left: 0, right: 200 },
      itemBox: { top: 40, bottom: 84, left: 8, right: 192 },
    });

    scrollActiveItemIntoView(container, item, true);

    expect(scrollTo).toHaveBeenCalledWith({
      left: 0,
      // scrollTop 400 + (item.top 40 - container.top 100 - gutter 24) = 316
      top: 316,
      behavior: 'smooth',
    });
  });

  it('does nothing when the item is already in view', () => {
    const { container, item, scrollTo } = mockScrollPort({
      scrollWidth: 200,
      clientWidth: 200,
      scrollHeight: 800,
      clientHeight: 300,
      scrollTop: 200,
      box: { top: 100, bottom: 400, left: 0, right: 200 },
      itemBox: { top: 180, bottom: 224, left: 8, right: 192 },
    });

    scrollActiveItemIntoView(container, item, false);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('scrolls horizontally when the active tab is past the right edge', () => {
    const { container, item, scrollTo } = mockScrollPort({
      scrollWidth: 600,
      clientWidth: 280,
      scrollHeight: 44,
      clientHeight: 44,
      box: { top: 0, bottom: 44, left: 0, right: 280 },
      itemBox: { top: 0, bottom: 44, left: 300, right: 380 },
    });

    scrollActiveItemIntoView(container, item, false);

    expect(scrollTo).toHaveBeenCalledWith({
      // item.right 380 - container.right 280 + gutter 24 = 124
      left: 124,
      top: 0,
      behavior: 'auto',
    });
  });
});
