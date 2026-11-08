import { describe, expect, it } from 'vitest';

import {
  POSTER_ICON_NAMES,
  isPosterIconName,
  posterIconSvgMarkup,
  posterIconSvgUrl,
  posterSvgUrl,
  resolvePosterIcon,
  shortPosterLabel,
} from '@/features/dashboard/marketing/lib/poster/posterIcons';

describe('posterSvgUrl', () => {
  it('encodes markup as a base64 data URI that decodes back', () => {
    const markup = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>';
    const url = posterSvgUrl(markup);

    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true);
    expect(atob(url.split(',')[1]!)).toBe(markup);
  });
});

describe('poster icon names', () => {
  it('lists unique names', () => {
    expect(POSTER_ICON_NAMES.length).toBeGreaterThan(0);
    expect(new Set(POSTER_ICON_NAMES).size).toBe(POSTER_ICON_NAMES.length);
  });

  it('narrows names', () => {
    expect(isPosterIconName('wifi')).toBe(true);
    expect(isPosterIconName('not-an-icon')).toBe(false);
    expect(isPosterIconName(undefined)).toBe(false);
  });
});

describe('posterIconSvgMarkup', () => {
  it('renders a stroked svg at the requested size and colour', () => {
    const markup = posterIconSvgMarkup('wifi', { color: '#b86a2c', size: 48, strokeWidth: 2 });

    expect(markup).toContain('width="48" height="48"');
    expect(markup).toContain('viewBox="0 0 24 24"');
    expect(markup).toContain('stroke="#b86a2c"');
    expect(markup).toContain('stroke-width="2"');
    expect(markup).toContain('stroke-linecap="round"');
  });

  it('defaults to a 96px icon with a 1.6 stroke', () => {
    const markup = posterIconSvgMarkup('wifi', { color: '#000000' });

    expect(markup).toContain('width="96" height="96"');
    expect(markup).toContain('stroke-width="1.6"');
  });

  it('escapes attribute values', () => {
    const markup = posterIconSvgMarkup('wifi', { color: '"><script>' });

    expect(markup).not.toContain('<script>');
    expect(markup).toContain('&quot;');
    expect(markup).toContain('&lt;script>');
  });

  it('wraps markup in a data URI', () => {
    expect(posterIconSvgUrl('wifi', { color: '#000000' }).startsWith('data:image/svg+xml;base64,'))
      .toBe(true);
  });
});

describe('resolvePosterIcon', () => {
  it('maps common amenities onto one icon family', () => {
    expect(resolvePosterIcon('Free WiFi')).toBe('wifi');
    expect(resolvePosterIcon('Heated Jacuzzi')).toBe('bath');
    expect(resolvePosterIcon('Infinity pool')).toBe('waves');
    expect(resolvePosterIcon('PS5 + games')).toBe('gamepad-2');
    expect(resolvePosterIcon('Netflix')).toBe('monitor-play');
    expect(resolvePosterIcon('Aircon')).toBe('snowflake');
    expect(resolvePosterIcon('Pet friendly')).toBe('paw-print');
  });

  it('checks rules in order, so the first match wins', () => {
    // "pool" appears before the "private/villa/home" rule.
    expect(resolvePosterIcon('Private pool villa')).toBe('waves');
  });

  it('falls back to a neutral icon for unknown labels', () => {
    expect(resolvePosterIcon('Helipad')).toBe('sparkles');
  });
});

describe('shortPosterLabel', () => {
  it('shortens long amenity labels for tight icon rows', () => {
    expect(shortPosterLabel('Coffee Maker')).toBe('Coffee');
    expect(shortPosterLabel('Infinity pool')).toBe('Pool');
    expect(shortPosterLabel('Washer and dryer')).toBe('Laundry');
    expect(shortPosterLabel('55 inch television')).toBe('TV');
  });

  it('drops a label whose short form adds nothing', () => {
    expect(shortPosterLabel('Pool')).toBeNull();
    expect(shortPosterLabel('wifi')).toBeNull();
  });

  it('has no short form for unmapped labels', () => {
    expect(shortPosterLabel('Helipad')).toBeNull();
  });
});
