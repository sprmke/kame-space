import { describe, expect, it } from 'vitest';

import {
  findActiveSectionIdFromMetrics,
  resolveScrollSpyMarkerOffsetPx,
  type ScrollSpyContainerMetrics,
  type ScrollSpySectionMetrics,
} from '@/features/dashboard/bookings/lib/adminSectionNavScroll';

function container(partial: Partial<ScrollSpyContainerMetrics> = {}): ScrollSpyContainerMetrics {
  return {
    top: 100,
    bottom: 700,
    scrollTop: 0,
    clientHeight: 600,
    scrollHeight: 2400,
    ...partial,
  };
}

describe('resolveScrollSpyMarkerOffsetPx', () => {
  it('clamps to an upper-band offset', () => {
    expect(resolveScrollSpyMarkerOffsetPx(200)).toBe(40);
    expect(resolveScrollSpyMarkerOffsetPx(600)).toBe(96);
    expect(resolveScrollSpyMarkerOffsetPx(80)).toBe(24);
  });
});

describe('findActiveSectionIdFromMetrics', () => {
  const marker = 24;

  it('keeps the first section while its heading is still under the marker', () => {
    const sections: ScrollSpySectionMetrics[] = [
      { id: 'photos', top: 100, bottom: 900 },
      { id: 'amenities', top: 920, bottom: 1040 },
    ];
    expect(findActiveSectionIdFromMetrics(container(), sections, marker)).toBe('photos');
  });

  it('activates a short section once its top crosses the marker, even if a taller card is still more visible', () => {
    // Viewport 100–700. Photos remnant 400px still visible; amenities 120px.
    // Max-visible would wrongly keep photos; marker line selects amenities.
    const sections: ScrollSpySectionMetrics[] = [
      { id: 'photos', top: -100, bottom: 500 },
      { id: 'amenities', top: 120, bottom: 240 },
      { id: 'rules', top: 260, bottom: 380 },
    ];
    expect(findActiveSectionIdFromMetrics(container(), sections, marker)).toBe('amenities');
  });

  it('walks through successive short sections as each heading crosses the marker', () => {
    const sections: ScrollSpySectionMetrics[] = [
      { id: 'photos', top: -400, bottom: 80 },
      { id: 'amenities', top: 90, bottom: 200 },
      { id: 'rules', top: 220, bottom: 330 },
      { id: 'guest-form', top: 350, bottom: 460 },
    ];
    expect(findActiveSectionIdFromMetrics(container(), sections, marker)).toBe('amenities');

    const rulesCrossed: ScrollSpySectionMetrics[] = [
      { id: 'photos', top: -500, bottom: -20 },
      { id: 'amenities', top: -10, bottom: 100 },
      { id: 'rules', top: 110, bottom: 220 },
      { id: 'guest-form', top: 240, bottom: 350 },
    ];
    expect(findActiveSectionIdFromMetrics(container(), rulesCrossed, marker)).toBe('rules');
  });

  it('selects the last section when scrolled to the bottom', () => {
    const sections: ScrollSpySectionMetrics[] = [
      { id: 'activity', top: 40, bottom: 200 },
      { id: 'listing-status', top: 220, bottom: 400 },
    ];
    expect(
      findActiveSectionIdFromMetrics(
        container({ scrollTop: 1788, clientHeight: 600, scrollHeight: 2400 }),
        sections,
        marker
      )
    ).toBe('listing-status');
  });

  it('returns empty for an empty section list', () => {
    expect(findActiveSectionIdFromMetrics(container(), [], marker)).toBe('');
  });

  it('ignores nav-list order when DOM tops disagree (Guest experience misplaced in the rail)', () => {
    // Nav array order: payment, building-forms, guest-experience.
    // DOM tops: guest-experience sits between rewards and payment.
    const sections: ScrollSpySectionMetrics[] = [
      { id: 'payment', top: 280, bottom: 420 },
      { id: 'building-forms', top: 440, bottom: 560 },
      { id: 'guest-experience', top: 130, bottom: 260 },
    ];
    // Marker at 124 (container.top 100 + 24). Only guest-experience has crossed.
    expect(findActiveSectionIdFromMetrics(container(), sections, marker)).toBe('guest-experience');

    // Scrolled so payment heading is under the marker — must not jump back to guest-experience
    // just because that id appears later in the nav array.
    const onPayment: ScrollSpySectionMetrics[] = [
      { id: 'payment', top: 110, bottom: 250 },
      { id: 'building-forms', top: 270, bottom: 390 },
      { id: 'guest-experience', top: -40, bottom: 90 },
    ];
    expect(findActiveSectionIdFromMetrics(container(), onPayment, marker)).toBe('payment');
  });
});
