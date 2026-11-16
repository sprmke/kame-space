import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

export const SLIDING_PILL_SPRING = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 38,
  mass: 0.82,
};

export type SlidingPillBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function pillBoundsEqual(a: SlidingPillBounds | null, b: SlidingPillBounds): boolean {
  if (!a) return false;
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

/** Avoid setState when layout is unchanged — prevents observer/layout effect loops. */
export function commitSlidingPillBounds(
  setBounds: Dispatch<SetStateAction<SlidingPillBounds | null>>,
  next: SlidingPillBounds
) {
  setBounds((prev) => (pillBoundsEqual(prev, next) ? prev : next));
}

function measureElementBounds(container: HTMLElement, item: HTMLElement): SlidingPillBounds {
  const containerRect = container.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  // Coordinates in the scroll container's content space so the pill scrolls with the list.
  // Viewport-relative top/left alone desync when scrollTop changes (modals, scrollIntoView).
  return {
    left: Math.round(itemRect.left - containerRect.left + container.scrollLeft),
    top: Math.round(itemRect.top - containerRect.top + container.scrollTop),
    width: Math.round(itemRect.width),
    height: Math.round(itemRect.height),
  };
}

/** Keep a little of the neighbour visible so the strip still reads as scrollable. */
export const SCROLL_ACTIVE_ITEM_GUTTER_PX = 24;

/**
 * Bring the active item into view inside its overflow container.
 * Horizontal: tab strips / mobile chips. Vertical: settings section nav on short
 * laptops where the rail scrolls under `max-h`. Uses viewport rects so nested
 * group labels do not break `offsetTop` math. No-op when nothing overflows or
 * the item is already in view.
 */
export function scrollActiveItemIntoView(
  container: HTMLElement,
  item: HTMLElement,
  smooth: boolean
) {
  const overflowX = container.scrollWidth - container.clientWidth;
  const overflowY = container.scrollHeight - container.clientHeight;
  if (overflowX <= 1 && overflowY <= 1) return;

  const containerRect = container.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  const gutter = SCROLL_ACTIVE_ITEM_GUTTER_PX;
  let nextLeft = container.scrollLeft;
  let nextTop = container.scrollTop;
  let changed = false;

  if (overflowX > 1) {
    if (itemRect.left < containerRect.left + gutter) {
      nextLeft = container.scrollLeft + (itemRect.left - containerRect.left - gutter);
      changed = true;
    } else if (itemRect.right > containerRect.right - gutter) {
      nextLeft = container.scrollLeft + (itemRect.right - containerRect.right + gutter);
      changed = true;
    }
    nextLeft = Math.max(0, Math.min(nextLeft, overflowX));
  }

  if (overflowY > 1) {
    if (itemRect.top < containerRect.top + gutter) {
      nextTop = container.scrollTop + (itemRect.top - containerRect.top - gutter);
      changed = true;
    } else if (itemRect.bottom > containerRect.bottom - gutter) {
      nextTop = container.scrollTop + (itemRect.bottom - containerRect.bottom + gutter);
      changed = true;
    }
    nextTop = Math.max(0, Math.min(nextTop, overflowY));
  }

  if (!changed) return;

  container.scrollTo({
    left: nextLeft,
    top: nextTop,
    behavior: smooth ? 'smooth' : 'auto',
  });
}

/** Coalesce observer/layout callbacks to one measure per animation frame. */
function useRafMeasure(measure: () => void) {
  const measureRef = useRef(measure);
  measureRef.current = measure;

  const rafIdRef = useRef<number | null>(null);

  const schedule = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      measureRef.current();
    });
  }, []);

  const cancel = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  useEffect(() => () => cancel(), [cancel]);

  return { schedule, cancel, flush: measure };
}

const EMPTY_REMEASURE_DEPS: unknown[] = [];

export function useSlidingActivePill(
  activeKey: string | null | undefined,
  remeasureDeps: unknown[] = EMPTY_REMEASURE_DEPS
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;
  /** First measure jumps; later ones glide, unless the viewer asked for less motion. */
  const hasMeasuredRef = useRef(false);

  const [bounds, setBounds] = useState<SlidingPillBounds | null>(null);
  /** Only scroll the overflow port when the active key changes — not on every remeasure. */
  const scrollActiveIntoViewOnMeasureRef = useRef(false);
  const prevActiveKeyForScrollRef = useRef<string | null | undefined>(undefined);

  const measure = useCallback(() => {
    if (!activeKey || !containerRef.current) return;

    const item = itemRefs.current[activeKey];
    if (!item) return;

    commitSlidingPillBounds(setBounds, measureElementBounds(containerRef.current, item));

    const activeKeyChanged = prevActiveKeyForScrollRef.current !== activeKey;
    prevActiveKeyForScrollRef.current = activeKey;

    const shouldScroll =
      scrollActiveIntoViewOnMeasureRef.current || activeKeyChanged || !hasMeasuredRef.current;
    scrollActiveIntoViewOnMeasureRef.current = false;

    if (shouldScroll) {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      scrollActiveItemIntoView(
        containerRef.current,
        item,
        hasMeasuredRef.current && !prefersReducedMotion
      );
    }
    hasMeasuredRef.current = true;
  }, [activeKey]);

  const { schedule, cancel } = useRafMeasure(measure);
  const scheduleRef = useRef(schedule);
  scheduleRef.current = schedule;

  const setItemRef = useCallback(
    (key: string) => (node: HTMLElement | null) => {
      itemRefs.current[key] = node;
      if (node && key === activeKeyRef.current) {
        scheduleRef.current();
      }
    },
    []
  );

  useLayoutEffect(() => {
    if (!activeKey) {
      setBounds((prev) => (prev === null ? prev : null));
      return;
    }

    scrollActiveIntoViewOnMeasureRef.current = true;

    // RAF after paint so Framer Motion can interpolate from the previous frame.
    schedule();
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remeasureDeps are intentional layout triggers
  }, [activeKey, schedule, cancel, ...remeasureDeps]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      schedule();
    });
    resizeObserver.observe(container);

    const onScroll = () => {
      schedule();
    };
    container.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', onScroll);
    };
  }, [schedule]);

  return { containerRef, setItemRef, bounds, remeasure: schedule };
}

/** Measures the active `[data-state="active"]` child — for Radix TabsList. */
export function useDomActiveSlidingPill(activeSelector = '[data-state="active"]') {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<SlidingPillBounds | null>(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const active = container.querySelector<HTMLElement>(activeSelector);
    if (!active) return;

    commitSlidingPillBounds(setBounds, measureElementBounds(container, active));
  }, [activeSelector]);

  const { schedule, cancel, flush } = useRafMeasure(measure);

  useLayoutEffect(() => {
    schedule();
    return cancel;
  }, [schedule, cancel]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      schedule();
    });
    resizeObserver.observe(container);

    const mutationObserver = new MutationObserver((mutations) => {
      const stateChanged = mutations.some(
        (mutation) => mutation.type === 'attributes' && mutation.attributeName === 'data-state'
      );
      if (stateChanged) flush();
      schedule();
    });
    mutationObserver.observe(container, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state'],
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [flush, schedule]);

  return { containerRef, bounds };
}
