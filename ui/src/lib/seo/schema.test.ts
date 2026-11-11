import { describe, expect, it } from 'vitest';

import {
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildItemListJsonLd,
  buildOrganizationJsonLd,
  buildPropertyJsonLd,
  buildSoftwareApplicationJsonLd,
  buildWebSiteJsonLd,
  combineJsonLd,
  renderMetaTags,
  serializeJsonLdGraph,
} from '@/lib/seo/seoMeta';

describe('buildOrganizationJsonLd', () => {
  it('keeps only absolute http(s) social profiles', () => {
    const org = buildOrganizationJsonLd({
      name: 'Kame Space',
      url: 'https://kamespace.com/',
      logo: 'https://kamespace.com/brand/logo.png',
      sameAs: ['https://facebook.com/kamespace', 'not-a-url', 'javascript:alert(1)'],
    });
    expect(org.sameAs).toEqual(['https://facebook.com/kamespace']);
  });

  it('adds a contact point only when there is contact data', () => {
    const without = buildOrganizationJsonLd({ name: 'K', url: 'u', logo: 'l' });
    expect(without.contactPoint).toBeUndefined();

    const withEmail = buildOrganizationJsonLd({
      name: 'K',
      url: 'u',
      logo: 'l',
      email: 'support@example.com',
    });
    expect(withEmail.contactPoint).toMatchObject({
      '@type': 'ContactPoint',
      email: 'support@example.com',
      areaServed: 'PH',
    });
  });
});

describe('buildWebSiteJsonLd', () => {
  it('emits a WebSite entity with the alternate name', () => {
    const site = buildWebSiteJsonLd({
      name: 'Kame Space',
      url: 'https://kamespace.com/',
      alternateName: 'Former Name',
    });
    expect(site['@type']).toBe('WebSite');
    expect(site.alternateName).toBe('Former Name');
  });
});

describe('buildBreadcrumbJsonLd', () => {
  it('numbers the trail from the home page down', () => {
    const crumbs = buildBreadcrumbJsonLd([
      { name: 'Home', url: 'https://kamespace.com/' },
      { name: 'Stays', url: 'https://kamespace.com/properties' },
      { name: 'Monaco 2604', url: 'https://kamespace.com/properties/monaco-2604' },
    ]);
    const items = (crumbs?.itemListElement ?? []) as Array<Record<string, unknown>>;
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ position: 1, name: 'Home' });
    expect(items[2]).toMatchObject({ position: 3, name: 'Monaco 2604' });
  });

  it('returns null for a single crumb', () => {
    expect(buildBreadcrumbJsonLd([{ name: 'Home', url: 'https://x/' }])).toBeNull();
    expect(buildBreadcrumbJsonLd([])).toBeNull();
  });
});

describe('buildItemListJsonLd', () => {
  it('caps the list and numbers the entries', () => {
    const items = Array.from({ length: 40 }, (_, index) => ({
      name: `Stay ${index}`,
      url: `https://kamespace.com/properties/stay-${index}`,
    }));
    const list = buildItemListJsonLd({ name: 'Stays', items });
    expect(list?.numberOfItems).toBe(24);
    const elements = (list?.itemListElement ?? []) as Array<Record<string, unknown>>;
    expect(elements[0]).toMatchObject({ position: 1, name: 'Stay 0' });
  });

  it('returns null when nothing usable is left', () => {
    expect(buildItemListJsonLd({ name: 'x', items: [] })).toBeNull();
    expect(buildItemListJsonLd({ name: 'x', items: [{ name: ' ', url: '' }] })).toBeNull();
  });
});

describe('buildFaqJsonLd', () => {
  it('drops empty questions and answers', () => {
    const faq = buildFaqJsonLd([
      { question: 'How do I book?', answer: 'Pick dates and submit the form.' },
      { question: ' ', answer: 'orphan answer' },
    ]);
    const entities = (faq?.mainEntity ?? []) as Array<Record<string, unknown>>;
    expect(entities).toHaveLength(1);
    expect(entities[0]?.['@type']).toBe('Question');
    expect(entities[0]?.acceptedAnswer).toMatchObject({ '@type': 'Answer' });
  });

  it('returns null when there are no FAQs', () => {
    expect(buildFaqJsonLd([])).toBeNull();
  });
});

describe('buildSoftwareApplicationJsonLd', () => {
  it('emits one PHP offer per plan', () => {
    const app = buildSoftwareApplicationJsonLd({
      name: 'Kame Space for hosts',
      offers: [
        { name: 'Free', price: 0 },
        { name: 'Pro', price: 799, description: 'Automation and marketing' },
        { name: 'No price' },
      ],
    });
    const offers = app.offers as Array<Record<string, unknown>>;
    expect(offers).toHaveLength(3);
    expect(offers[0]).toMatchObject({ name: 'Free', price: '0', priceCurrency: 'PHP' });
    expect(offers[1]).toMatchObject({ name: 'Pro', price: '799' });
    expect(offers[2]?.price).toBeUndefined();
  });
});

describe('enriched listing entities', () => {
  const base = {
    name: 'Monaco 2604',
    url: 'https://kamespace.com/properties/monaco-2604',
    images: ['https://img/a.jpg'],
    address: { city: 'San Fernando', province: 'Pampanga', country: 'Philippines' },
  };

  it('includes geo, amenities, capacity, times and an offer when present', () => {
    const ld = buildPropertyJsonLd({
      ...base,
      geo: { latitude: 15.03, longitude: 120.69 },
      amenities: ['Wifi', 'Pool'],
      guests: 4,
      bedrooms: 2,
      checkinTime: '2:00 PM',
      checkoutTime: '12:00 PM',
      priceFrom: 2500,
      containedInName: 'Azure North',
      containedInUrl: 'https://kamespace.com/developments/azure-north',
    });
    expect(ld.geo).toMatchObject({ '@type': 'GeoCoordinates', latitude: 15.03 });
    expect(ld.amenityFeature).toHaveLength(2);
    expect(ld.numberOfRooms).toBe(2);
    expect(ld.occupancy).toMatchObject({ '@type': 'QuantitativeValue', maxValue: 4 });
    expect(ld.checkinTime).toBe('2:00 PM');
    expect(ld.containedInPlace).toMatchObject({ name: 'Azure North' });
    expect(ld.makesOffer).toMatchObject({ price: '2500', priceCurrency: 'PHP' });
    expect(ld.priceRange).toBe('From PHP 2500 / night');
  });

  it('omits every optional field rather than emitting nulls', () => {
    const ld = buildPropertyJsonLd(base);
    const json = JSON.stringify(ld);
    expect(json).not.toContain('null');
    expect(ld.geo).toBeUndefined();
    expect(ld.amenityFeature).toBeUndefined();
    expect(ld.makesOffer).toBeUndefined();
  });

  it('keeps aggregateRating only when reviews exist', () => {
    expect(
      buildPropertyJsonLd({ ...base, rating: 4.8, reviewCount: 0 }).aggregateRating
    ).toBeUndefined();
    expect(
      buildPropertyJsonLd({ ...base, rating: 4.8, reviewCount: 3 }).aggregateRating
    ).toBeDefined();
  });
});

describe('combineJsonLd', () => {
  it('returns the single node unchanged', () => {
    const node = { '@type': 'Thing', name: 'x' };
    expect(combineJsonLd([node])).toBe(node);
  });

  it('wraps several nodes in one @graph', () => {
    const graph = combineJsonLd([{ '@type': 'Organization' }, null, { '@type': 'WebSite' }]);
    expect((graph?.['@graph'] as unknown[]).length).toBe(2);
  });

  it('returns null when every node is missing', () => {
    expect(combineJsonLd([null, undefined])).toBeNull();
  });
});

describe('JSON-LD serialization', () => {
  it('renders a graph array as one script tag without a script breakout', () => {
    const html = renderMetaTags({
      title: 't',
      description: 'd',
      canonicalUrl: 'https://kamespace.com/',
      jsonLd: [
        { '@type': 'Organization', name: '</script><script>alert(1)</script>' },
        { '@type': 'WebSite' },
      ],
    });
    expect(html.match(/application\/ld\+json/g)).toHaveLength(1);
    expect(html).not.toContain('</script><script>alert(1)');
    expect(html).toContain('\\u003c/script');
  });

  it('serializes a single node without a graph wrapper', () => {
    const json = serializeJsonLdGraph({ '@type': 'Thing' });
    expect(json).toBe('{"@type":"Thing"}');
  });
});
