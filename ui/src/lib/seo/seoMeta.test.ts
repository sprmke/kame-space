import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DESCRIPTION,
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  buildPageTitle,
  buildPropertyJsonLd,
  buildRobotsTxt,
  developmentTitle,
  hostDescription,
  hostTitle,
  injectMetaIntoHtml,
  isCrawlerUserAgent,
  listingDescription,
  matchListingDetailPath,
  minNightlyRate,
  parkingTitle,
  placeDescription,
  placeTitle,
  propertyTitle,
  sanitizeMetaText,
  serializeJsonLd,
  socialImageMeta,
  truncateDescription,
} from '@/lib/seo/seoMeta';

describe('matchListingDetailPath', () => {
  it('matches detail routes only', () => {
    expect(matchListingDetailPath('/properties/monaco-2612')).toEqual({
      family: 'property',
      slug: 'monaco-2612',
    });
    expect(matchListingDetailPath('/parkings/slot-a1/')).toEqual({
      family: 'parking',
      slug: 'slot-a1',
    });
    expect(matchListingDetailPath('/developments/azure-north')?.family).toBe('development');
    expect(matchListingDetailPath('/properties/in/makati')).toBeNull();
    expect(matchListingDetailPath('/parkings/requests/abc')).toBeNull();
    expect(matchListingDetailPath('/developments/azure/properties')).toBeNull();
    expect(matchListingDetailPath('/properties/Bad_Slug')).toBeNull();
    expect(matchListingDetailPath('/org/x/property/y')).toBeNull();
  });
});

describe('isCrawlerUserAgent', () => {
  it('detects link preview and search crawlers', () => {
    expect(isCrawlerUserAgent('facebookexternalhit/1.1')).toBe(true);
    expect(isCrawlerUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(isCrawlerUserAgent('WhatsApp/2.23')).toBe(true);
    expect(isCrawlerUserAgent('Mozilla/5.0 (iPhone) Safari/604.1')).toBe(false);
    expect(isCrawlerUserAgent(null)).toBe(false);
  });
});

describe('injectMetaIntoHtml', () => {
  const shell =
    '<html><head><title>Old Brand</title><meta name="description" content="old" /></head><body></body></html>';

  it('replaces title + description and escapes values', () => {
    const html = injectMetaIntoHtml(shell, {
      title: 'Condo <b>"x"</b>',
      description: 'Nice & quiet',
      canonicalUrl: 'https://example.com/properties/a',
      image: 'https://img.example.com/a.jpg',
      jsonLd: { name: '</script><script>alert(1)</script>' },
    });
    expect(html).toContain('<title>Condo &lt;b&gt;&quot;x&quot;&lt;/b&gt;</title>');
    expect(html).not.toContain('content="old"');
    expect(html).toContain('content="Nice &amp; quiet"');
    expect(html).toContain('og:image');
    expect(html).not.toContain('</script><script>alert(1)');
    expect(html.match(/<title>/g)?.length).toBe(1);
  });

  it('replaces the index.html default description without duplicating it', () => {
    const indexHtml = readFileSync(resolve(__dirname, '../../../index.html'), 'utf8');
    expect(indexHtml).toContain(DEFAULT_DESCRIPTION);
    const html = injectMetaIntoHtml(indexHtml, {
      title: 'Condo',
      description: 'Listing description',
      canonicalUrl: 'https://example.com/properties/a',
    });
    expect(html.match(/name="description"/g)?.length).toBe(1);
    expect(html).not.toContain(DEFAULT_DESCRIPTION);
  });

  it('uses the branded card when a listing has no image', () => {
    const html = injectMetaIntoHtml(shell, {
      title: 'Condo',
      description: 'A stay',
      canonicalUrl: 'https://example.com/properties/a',
    });
    expect(html).toContain('https://example.com/brand/kame-space-social-f5.png');
    expect(html).toContain('content="summary_large_image"');
    expect(html).toContain('property="og:image:width" content="1200"');
  });

  it('replaces default card metadata with the listing image without stale dimensions', () => {
    const indexHtml = readFileSync(resolve(__dirname, '../../../index.html'), 'utf8');
    const html = injectMetaIntoHtml(indexHtml, {
      title: 'Condo',
      description: 'A stay',
      canonicalUrl: 'https://example.com/properties/a',
      image: 'https://example.com/condo.jpg',
    });
    expect(html.match(/property="og:image"/g)).toHaveLength(1);
    expect(html.match(/name="twitter:image"/g)).toHaveLength(1);
    expect(html).not.toContain('kame-space-social-f5.png');
    expect(html).not.toContain('og:image:width');
  });

  it('truncates long descriptions in tags', () => {
    const html = injectMetaIntoHtml(shell, {
      title: 't',
      description: 'long '.repeat(100),
      canonicalUrl: 'https://example.com/',
    });
    const content = html.match(/name="description" content="([^"]*)"/)?.[1] ?? '';
    expect(content.length).toBeLessThanOrEqual(160);
  });

  it('preloads the cover photo as the LCP image', () => {
    const html = injectMetaIntoHtml(shell, {
      title: 't',
      description: 'd',
      canonicalUrl: 'https://kamespace.com/properties/a',
      image: 'https://img.example.com/a.jpg',
    });
    expect(html).toContain('<link rel="preload" as="image" href="https://img.example.com/a.jpg"');
    expect(html).toContain('fetchpriority="high"');
  });

  it('does not preload the default brand card', () => {
    const html = injectMetaIntoHtml(shell, {
      title: 't',
      description: 'd',
      canonicalUrl: 'https://kamespace.com/',
    });
    expect(html).not.toContain('rel="preload"');
  });

  it('returns the input when there is no head', () => {
    expect(
      injectMetaIntoHtml('<p>x</p>', { title: 't', description: 'd', canonicalUrl: 'u' })
    ).toBe('<p>x</p>');
  });
});

describe('helpers', () => {
  it('truncates long descriptions on a word boundary', () => {
    const out = truncateDescription('word '.repeat(80));
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith('…')).toBe(true);
  });

  it('builds property JSON-LD without exact address and only rates with reviews', () => {
    const ld = buildPropertyJsonLd({
      name: 'Monaco 2612',
      url: 'https://example.com/properties/monaco-2612',
      images: ['a', 'b'],
      address: { city: 'San Fernando', province: 'Pampanga', country: 'Philippines' },
      rating: 4.8,
      reviewCount: 0,
    });
    expect(ld.aggregateRating).toBeUndefined();
    expect(JSON.stringify(ld)).not.toContain('streetAddress');
    expect(serializeJsonLd({ a: '<' })).toBe('{"a":"\\u003c"}');
  });

  it('robots.txt points at the canonical sitemap and blocks private areas', () => {
    const txt = buildRobotsTxt('https://example.com', ['example.com'], 'https://example.com');
    expect(txt).toContain('Sitemap: https://example.com/sitemap.xml');
    expect(txt).toContain('Disallow: /org/');
    expect(txt).toContain('Disallow: /account');
  });

  it('declares the AI crawlers with the same private-path disallows', () => {
    const txt = buildRobotsTxt('https://kamespace.com');
    for (const agent of ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Bingbot']) {
      expect(txt).toContain(`User-agent: ${agent}`);
    }
    expect(txt).toContain('User-agent: *');
    expect(txt).not.toContain('User-agent: CCBot\nDisallow: /\n');
  });
});

describe('robots trip pages', () => {
  it('keeps per-booking trip pages out of search', () => {
    expect(buildRobotsTxt('https://kamehomes.space')).toContain('Disallow: /*/trip?');
  });

  it('blocks all crawling on hosts outside the indexable list (dev, previews)', () => {
    for (const origin of ['https://dev.kamespace.com', 'https://kame-homes-git-x.vercel.app']) {
      expect(buildRobotsTxt(origin)).toBe('User-agent: *\nDisallow: /\n');
    }
    expect(buildRobotsTxt('https://app.kamehomes.space')).toContain('Allow: /');
    expect(buildRobotsTxt('https://app.kamehomes.space')).toContain('Sitemap:');
  });

  it('indexes the kamespace production domain', () => {
    // Regression: the rebrand moved production to kamespace.com but the host list
    // still only knew kamehomes.space, so production served `Disallow: /`.
    for (const origin of ['https://kamespace.com', 'https://www.kamespace.com']) {
      const txt = buildRobotsTxt(origin);
      expect(txt).toContain('Allow: /');
      // Every host points at the apex sitemap so ranking signals never split.
      expect(txt).toContain('Sitemap: https://kamespace.com/sitemap.xml');
    }
  });
});

describe('buildPageTitle', () => {
  it('puts the brand last', () => {
    expect(buildPageTitle('About', 'Kame Space')).toBe('About | Kame Space');
    expect(buildPageTitle('Host plans and pricing', 'Kame Space')).toBe(
      'Host plans and pricing | Kame Space'
    );
  });

  it('drops the brand suffix before shortening the page part', () => {
    const page = 'A very long listing name that runs well past the limit';
    const withBrand = buildPageTitle(page, 'Kame Space');
    expect(withBrand).toBe(page);
    expect(withBrand.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
  });

  it('truncates an over-long page part on a word boundary', () => {
    const title = buildPageTitle('word '.repeat(40), 'Kame Space');
    expect(title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
    expect(title.endsWith('…')).toBe(true);
    expect(title).not.toContain('  ');
  });

  it('never emits a trailing separator and handles an empty page', () => {
    expect(buildPageTitle('   ', 'Kame Space')).toBe('Kame Space');
    expect(buildPageTitle('About', '')).toBe('About');
  });

  it('collapses whitespace from data-driven names', () => {
    expect(buildPageTitle('  Monaco   2604  ', 'Kame Space')).toBe('Monaco 2604 | Kame Space');
  });
});

describe('title templates', () => {
  it('builds a property title with and without a unit type', () => {
    expect(propertyTitle({ name: 'Monaco 2604', unitType: 'Studio', city: 'San Fernando' })).toBe(
      'Monaco 2604, Studio in San Fernando'
    );
    expect(propertyTitle({ name: 'Monaco 2604', city: 'San Fernando' })).toBe(
      'Monaco 2604 in San Fernando'
    );
    expect(propertyTitle({ name: 'Monaco 2604', unitType: 'Studio' })).toBe('Monaco 2604, Studio');
    expect(propertyTitle({ name: 'Monaco 2604' })).toBe('Monaco 2604');
  });

  it('builds a parking title', () => {
    expect(parkingTitle({ name: 'Slot A1', place: 'Azure North' })).toBe(
      'Slot A1 parking in Azure North'
    );
    expect(parkingTitle({ name: 'Slot A1' })).toBe('Slot A1 parking');
  });

  it('builds a development title', () => {
    expect(developmentTitle({ name: 'Azure North', city: 'San Fernando' })).toBe(
      'Azure North, San Fernando condos and parking'
    );
    expect(developmentTitle({ name: 'Azure North' })).toBe('Azure North condos and parking');
  });

  it('builds place titles per family', () => {
    expect(placeTitle('property', 'Makati')).toBe('Condos and homes for rent in Makati');
    expect(placeTitle('parking', 'Makati')).toBe('Parking for rent in Makati');
    expect(placeTitle('development', 'Makati')).toBe('Condos and parking in Makati');
  });

  it('builds a host title', () => {
    expect(hostTitle('Kame Stays')).toBe('Kame Stays stays and parking');
  });
});

describe('sanitizeMetaText', () => {
  it('strips markdown, html, urls, emails, phones and emoji', () => {
    const dirty =
      '**Great** <b>stay</b> [book](https://evil.example) mail me a@b.co or 0917 123 4567 🔥🌴';
    const clean = sanitizeMetaText(dirty);
    expect(clean).toContain('Great stay');
    expect(clean).toContain('book');
    expect(clean).not.toContain('*');
    expect(clean).not.toContain('<b>');
    expect(clean).not.toContain('http');
    expect(clean).not.toContain('a@b.co');
    expect(clean).not.toContain('0917');
    expect(clean).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it('collapses whitespace and handles empty input', () => {
    expect(sanitizeMetaText('  a   b  ')).toBe('a b');
    expect(sanitizeMetaText(null)).toBe('');
  });
});

describe('listingDescription', () => {
  it('uses a usable host description as-is', () => {
    const host =
      'A bright studio steps from the mall with fast wifi and a balcony you can work from.';
    expect(listingDescription({ name: 'Monaco 2604', hostDescription: host })).toBe(host);
  });

  it('falls back to the data template and skips missing parts', () => {
    const text = listingDescription({
      name: 'Monaco 2604',
      unitType: 'Studio',
      city: 'San Fernando',
      guests: 2,
      bedrooms: 1,
      amenities: ['Wifi', 'Pool'],
      priceFrom: 2500,
    });
    expect(text).toContain('Monaco 2604: Studio in San Fernando');
    expect(text).toContain('sleeps 2');
    expect(text).toContain('1 bedroom');
    expect(text).toContain('Wifi and Pool');
    expect(text).toContain('From PHP 2500 per night');
    expect(text.length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
  });

  it('never renders undefined, NaN or a missing price', () => {
    const text = listingDescription({ name: 'Slot A1' });
    expect(text).toBe('Slot A1. Check dates and book online.');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('NaN');
  });

  it('ignores a host description that is too short to be useful', () => {
    const text = listingDescription({ name: 'Monaco 2604', hostDescription: 'Nice place' });
    expect(text).toContain('Monaco 2604');
    expect(text.length).toBeGreaterThan(40);
  });
});

describe('place and host descriptions', () => {
  it('builds a place description from the count and lowest price', () => {
    expect(
      placeDescription({ family: 'property', place: 'Makati', count: 12, priceFrom: 1800 })
    ).toBe(
      '12 stays in Makati, from PHP 1800 per night. Compare photos, check dates and book direct with the host.'
    );
    expect(placeDescription({ family: 'parking', place: 'BGC', count: 3 })).toBe(
      '3 parking slots in BGC. Check availability and reserve your slot by the night.'
    );
    expect(placeDescription({ family: 'development', place: 'Cebu', count: 2 })).toContain(
      '2 developments in Cebu'
    );
  });

  it('singularises a one-listing place and still clears the description floor', () => {
    const cases = [
      placeDescription({ family: 'property', place: 'Makati', count: 1 }),
      placeDescription({ family: 'parking', place: 'BGC', count: 1 }),
      placeDescription({ family: 'development', place: 'San Fernando', count: 1 }),
    ];
    for (const text of cases) {
      expect(text, text).not.toMatch(/\b1 (stays|parking slots|developments)\b/);
      // The crawl audit fails a meta description under 70 characters.
      expect(text.length, text).toBeGreaterThanOrEqual(70);
      expect(text.length, text).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
    }
    expect(cases[0]).toContain('1 stay in Makati');
    expect(cases[1]).toContain('1 parking slot in BGC');
    expect(cases[2]).toContain('1 development in San Fernando');
  });

  it('builds a host description', () => {
    expect(hostDescription({ name: 'Kame Stays', stays: 3, parking: 1 })).toBe(
      'Kame Stays lists 3 stays and 1 parking slot on Kame Space.'
    );
    expect(hostDescription({ name: 'Kame Stays', stays: 0, parking: 0 })).toBe(
      'Kame Stays lists stays and parking on Kame Space.'
    );
  });
});

describe('minNightlyRate', () => {
  it('reads the three card price fields and ignores junk', () => {
    expect(minNightlyRate([{ price: 3000 }, { price: 1800 }])).toBe(1800);
    expect(minNightlyRate([{ ratePerNight: 450 }])).toBe(450);
    expect(minNightlyRate([{ nightlyRate: 900 }])).toBe(900);
    expect(minNightlyRate([{ price: null }, { price: 0 }, { price: Number.NaN }])).toBeNull();
    expect(minNightlyRate([])).toBeNull();
  });
});

describe('social image', () => {
  const storage = 'https://abc.supabase.co/storage/v1/object/public/property-media/a.jpg';

  it('leaves the URL alone when transforms are off', () => {
    expect(socialImageMeta(storage, false)).toEqual({ image: storage });
  });

  it('builds a 1200x630 cover crop when transforms are on', () => {
    const meta = socialImageMeta(storage, true);
    expect(meta.image).toContain('/storage/v1/render/image/public/property-media/a.jpg');
    expect(meta.image).toContain('width=1200');
    expect(meta.image).toContain('height=630');
    expect(meta.image).toContain('resize=cover');
    expect(meta.imageWidth).toBe(1200);
    expect(meta.imageHeight).toBe(630);
  });

  it('passes non-storage URLs through untouched', () => {
    expect(socialImageMeta('https://images.unsplash.com/photo-1', true)).toEqual({
      image: 'https://images.unsplash.com/photo-1',
    });
  });

  it('returns null for a missing photo', () => {
    expect(socialImageMeta(null, true)).toEqual({ image: null });
  });
});
