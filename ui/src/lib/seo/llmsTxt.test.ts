import { describe, expect, it } from 'vitest';

import {
  buildLlmsFullTxt,
  buildLlmsTxt,
  buildLlmsTxtUnavailable,
  isPublicSafe,
  renderListingLine,
} from '@/lib/seo/llmsTxt';

const base = {
  siteOrigin: 'https://kamespace.com',
  siteName: 'Kame Space',
  summary: 'Book condos, homes and parking across the Philippines.',
  places: [
    { label: 'Makati', path: '/properties/in/makati', count: 12 },
    { label: 'BGC', path: '/parkings/in/bgc' },
  ],
};

describe('buildLlmsTxt', () => {
  it('starts with an H1 and a blockquote summary', () => {
    const txt = buildLlmsTxt(base);
    expect(txt.startsWith('# Kame Space\n\n> Book condos')).toBe(true);
    expect(txt).toContain('Canonical site: https://kamespace.com/');
  });

  it('links guest, host and company sections with absolute URLs', () => {
    const txt = buildLlmsTxt(base);
    expect(txt).toContain('## For guests');
    expect(txt).toContain('(https://kamespace.com/properties)');
    expect(txt).toContain('## For hosts');
    expect(txt).toContain('(https://kamespace.com/for-hosts/pricing)');
    expect(txt).toContain('## Help and company');
    expect(txt).toContain('(https://kamespace.com/support)');
  });

  it('lists places with their counts', () => {
    const txt = buildLlmsTxt(base);
    expect(txt).toContain('- [Makati](https://kamespace.com/properties/in/makati): 12 listings');
    expect(txt).toContain('- [BGC](https://kamespace.com/parkings/in/bgc)');
  });

  it('never emits an em dash', () => {
    expect(buildLlmsTxt(base)).not.toContain('\u2014');
  });

  it('drops a place whose label carries contact data', () => {
    const txt = buildLlmsTxt({
      ...base,
      places: [{ label: 'Call 0917 123 4567', path: '/properties/in/x' }],
    });
    expect(txt).not.toContain('0917');
  });
});

describe('buildLlmsFullTxt', () => {
  const listings = [
    {
      name: 'Monaco 2604',
      path: '/properties/monaco-2604',
      kind: 'property',
      place: 'San Fernando',
      priceFrom: 2500,
    },
    { name: 'Slot A1', path: '/parkings/slot-a1', kind: 'parking', place: 'Makati' },
  ];

  it('keeps the map and appends one line per listing', () => {
    const txt = buildLlmsFullTxt({ ...base, listings });
    expect(txt).toContain('# Kame Space');
    expect(txt).toContain('## All Stay listings');
    expect(txt).toContain(
      '- [Monaco 2604](https://kamespace.com/properties/monaco-2604) (Stay, San Fernando, from PHP 2500 per night)'
    );
    expect(txt).toContain('Total listings in this file: 2');
  });

  it('caps the file at 2000 listings', () => {
    const many = Array.from({ length: 2100 }, (_, index) => ({
      name: `Stay ${index}`,
      path: `/properties/stay-${index}`,
      kind: 'property',
    }));
    const txt = buildLlmsFullTxt({ ...base, listings: many });
    expect(txt).toContain('Total listings in this file: 2000');
    expect(txt).not.toContain('Stay 2000');
  });

  it('skips a listing whose name looks like contact data', () => {
    const txt = buildLlmsFullTxt({
      ...base,
      listings: [{ name: 'host@example.com', path: '/properties/x', kind: 'property' }],
    });
    expect(txt).not.toContain('host@example.com');
  });
});

describe('renderListingLine', () => {
  it('omits a missing place and price instead of leaving gaps', () => {
    expect(renderListingLine({ name: 'Slot A1', path: '/parkings/a1', kind: 'parking' }, 'https://x')).toBe(
      '- [Slot A1](https://x/parkings/a1) (Parking)'
    );
  });
});

describe('isPublicSafe', () => {
  it('rejects emails, phone numbers and street addresses', () => {
    expect(isPublicSafe('host@example.com')).toBe(false);
    expect(isPublicSafe('Call +63 917 123 4567')).toBe(false);
    expect(isPublicSafe('Unit 12 Ayala Avenue')).toBe(false);
    expect(isPublicSafe('Monaco 2604, San Fernando')).toBe(true);
  });
});

describe('buildLlmsTxtUnavailable', () => {
  it('says the deployment is not public and points at production', () => {
    const txt = buildLlmsTxtUnavailable('Kame Space');
    expect(txt).toContain('# Kame Space');
    expect(txt).toContain('not public');
    expect(txt).toContain('https://kamespace.com');
  });
});
