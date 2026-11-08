import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InfoHint } from '@/components/help/InfoHint';

/**
 * Component-level contract for the one touch-safe help control. This is the layer that
 * caught the 16px target: a unit test cannot see a rendered box, and the axe sweep only
 * runs on a handful of routes.
 */
describe('InfoHint', () => {
  beforeEach(() => {
    // Mouse/trackpad viewport by default; the hook reads matchMedia on mount.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('hover: hover'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));
  });

  it('is a real button with an accessible name and a touch target at the WCAG floor', () => {
    render(<InfoHint label="Total Bookings" text="Counts every booking in the range." />);

    const trigger = screen.getByRole('button', { name: 'About Total Bookings' });
    expect(trigger.getAttribute('type')).toBe('button');
    // h-6 w-6: axe target-size needs 24x24 on the element box, not the pseudo hit pad.
    expect(trigger.className).toContain('h-6');
    expect(trigger.className).toContain('w-6');
  });

  it('toggles the hint on click and reports its state to assistive tech', () => {
    render(<InfoHint label="Total Bookings" text="Counts every booking in the range." />);

    const trigger = screen.getByRole('button', { name: 'About Total Bookings' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders the hint copy when opened', () => {
    render(<InfoHint label="Total Bookings" text="Counts every booking in the range." />);

    fireEvent.click(screen.getByRole('button', { name: 'About Total Bookings' }));

    expect(screen.getByRole('tooltip').textContent).toContain('Counts every booking');
  });

  it('closes on Escape', async () => {
    render(<InfoHint label="Total Bookings" text="Counts every booking in the range." />);

    const trigger = screen.getByRole('button', { name: 'About Total Bookings' });
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('supplies screen-reader copy through describedById without opening', () => {
    const { container } = render(
      <InfoHint
        label="Total Bookings"
        text="Counts every booking in the range."
        describedById="hint-total-bookings"
      />
    );

    const described = container.querySelector('#hint-total-bookings');
    expect(described?.textContent).toContain('Counts every booking');
    expect(described?.className).toContain('sr-only');
  });

  it('renders the field glyph by default and the info glyph for metric hints', () => {
    const { container, unmount } = render(<InfoHint label="Total Bookings" text="x" />);
    expect(container.querySelector('svg')).not.toBeNull();
    unmount();

    const { container: metric } = render(
      <InfoHint label="Occupancy" text="x" variant="metric" />
    );
    // Two different Lucide glyphs, so the DOM markup must differ.
    expect(metric.querySelector('svg')?.innerHTML).not.toBe(
      container.querySelector('svg')?.innerHTML
    );
  });
});
