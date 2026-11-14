/** Scroll-spy for `AdminSectionNavLayout` settings sidebars. */

export const SCROLL_MARKER_OFFSET_PX = 24;
/** Only treat the scrollport as "at bottom" when essentially flush with the end. */
export const SCROLL_BOTTOM_SLACK_PX = 12;
export const MIN_VISIBLE_SECTION_PX = 32;
/** At true bottom, last section wins when it holds this share of the prior section's visible area. */
export const BOTTOM_LAST_SECTION_VISIBLE_RATIO = 0.4;

export type ScrollSpySectionMetrics = {
  id: string;
  /** Viewport Y from `getBoundingClientRect()`. */
  top: number;
  bottom: number;
};

export type ScrollSpyContainerMetrics = {
  top: number;
  bottom: number;
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
};

export function sectionVisibleHeight(
  section: Pick<ScrollSpySectionMetrics, 'top' | 'bottom'>,
  container: Pick<ScrollSpyContainerMetrics, 'top' | 'bottom'>
): number {
  const top = Math.max(section.top, container.top);
  const bottom = Math.min(section.bottom, container.bottom);
  return Math.max(0, bottom - top);
}

export function isScrollAtBottom(
  container: Pick<ScrollSpyContainerMetrics, 'scrollTop' | 'clientHeight' | 'scrollHeight'>,
  slackPx: number = SCROLL_BOTTOM_SLACK_PX
): boolean {
  return container.scrollTop + container.clientHeight >= container.scrollHeight - slackPx;
}

/**
 * Marker sits in the upper band of the scrollport so short cards can become
 * active once their heading crosses it (tall neighbors no longer monopolize).
 */
export function resolveScrollSpyMarkerOffsetPx(containerHeight: number): number {
  return Math.min(96, Math.max(SCROLL_MARKER_OFFSET_PX, Math.round(containerHeight * 0.2)));
}

/**
 * Active section = last section **by vertical position** whose top has crossed
 * the marker line. At true bottom, prefer the lowest section when it is on screen.
 *
 * Sort by `top` before walking so a nav list that is out of sync with DOM order
 * (e.g. Guest experience listed after Building Forms but rendered earlier) cannot
 * steal the highlight from Payment / Email.
 *
 * Do not use "largest visible height" — a tall Photos card would stay active
 * while short Amenities / House Rules cards are what the host is reading.
 */
export function findActiveSectionIdFromMetrics(
  container: ScrollSpyContainerMetrics,
  sections: ScrollSpySectionMetrics[],
  markerOffsetPx: number = resolveScrollSpyMarkerOffsetPx(container.clientHeight)
): string {
  if (sections.length === 0) return '';

  const markerY = container.top + markerOffsetPx;
  const entries = [...sections]
    .map((section) => ({
      ...section,
      visible: sectionVisibleHeight(section, container),
    }))
    .sort((a, b) => a.top - b.top || a.id.localeCompare(b.id));

  if (isScrollAtBottom(container)) {
    const last = entries[entries.length - 1]!;
    if (last.visible >= MIN_VISIBLE_SECTION_PX) {
      const previous = entries[entries.length - 2];
      if (!previous || last.visible >= previous.visible * BOTTOM_LAST_SECTION_VISIBLE_RATIO) {
        return last.id;
      }
    }
  }

  let active = entries[0]!.id;
  for (const entry of entries) {
    if (entry.top <= markerY) active = entry.id;
  }
  return active;
}

export function findActiveSectionIdInContainer(
  container: HTMLElement,
  sectionIds: string[],
  markerOffsetPx?: number
): string {
  if (sectionIds.length === 0) return '';

  const containerRect = container.getBoundingClientRect();
  const metrics: ScrollSpyContainerMetrics = {
    top: containerRect.top,
    bottom: containerRect.bottom,
    scrollTop: container.scrollTop,
    clientHeight: container.clientHeight,
    scrollHeight: container.scrollHeight,
  };

  const sections: ScrollSpySectionMetrics[] = [];
  for (const id of sectionIds) {
    const el = document.getElementById(`section-${id}`);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    sections.push({ id, top: rect.top, bottom: rect.bottom });
  }

  if (sections.length === 0) return sectionIds[0] ?? '';

  return findActiveSectionIdFromMetrics(
    metrics,
    sections,
    markerOffsetPx ?? resolveScrollSpyMarkerOffsetPx(metrics.clientHeight)
  );
}
