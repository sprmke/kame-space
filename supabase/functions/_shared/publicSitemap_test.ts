import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import {
  buildSitemapIndex,
  buildUrlset,
  developmentSubPath,
  escapeXml,
  listingPath,
  placePath,
  STATIC_SITEMAP_LASTMOD,
  STATIC_SITEMAP_PATHS,
} from './publicSitemap.ts';

Deno.test('escapeXml escapes markup characters', () => {
  assertEquals(escapeXml(`a&b<c>"d'`), 'a&amp;b&lt;c&gt;&quot;d&apos;');
});

Deno.test('paths encode slugs', () => {
  assertEquals(listingPath('property', 'azure-1'), '/properties/azure-1');
  assertEquals(placePath('parking', 'las piñas'), '/parkings/in/las%20pi%C3%B1as');
});

Deno.test('buildUrlset emits absolute locs and ISO lastmod dates', () => {
  const xml = buildUrlset('https://example.com', [
    { path: '/', lastmod: null },
    { path: '/properties/a', lastmod: '2026-08-05T10:00:00+00:00' },
    { path: '/x?y=1&z=2', lastmod: 'garbage' },
  ]);
  assertStringIncludes(xml, '<loc>https://example.com/</loc></url>');
  assertStringIncludes(xml, '<lastmod>2026-08-05</lastmod>');
  assertStringIncludes(xml, 'https://example.com/x?y=1&amp;z=2</loc></url>');
});

Deno.test('buildSitemapIndex lists numbered parts', () => {
  const xml = buildSitemapIndex('https://example.com', 2);
  assertStringIncludes(xml, '<sitemapindex');
  assertStringIncludes(xml, 'sitemap.xml?part=2');
});

Deno.test('every <loc> uses the canonical https apex', () => {
  const xml = buildUrlset('https://kamespace.com', [
    { path: '/properties/monaco-2604', lastmod: '2026-11-01' },
    { path: '/properties/in/san-fernando' },
  ]);

  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!);
  assertEquals(locs.length, 2);
  for (const loc of locs) {
    assertEquals(loc.startsWith('https://kamespace.com/'), true, loc);
    assertEquals(loc.includes('http://'), false, loc);
    assertEquals(new URL(loc).hostname, 'kamespace.com', loc);
  }
});

Deno.test('development sub-paths only exist for the listed segments', () => {
  assertEquals(
    developmentSubPath('azure-north', 'properties'),
    '/developments/azure-north/properties'
  );
  assertEquals(developmentSubPath('azure north', 'parking'), '/developments/azure%20north/parking');
});

Deno.test('static sitemap lastmod is a fixed date per path, never build time', () => {
  for (const path of STATIC_SITEMAP_PATHS) {
    const value = STATIC_SITEMAP_LASTMOD[path];
    assertEquals(typeof value, 'string', path);
    assertEquals(/^\d{4}-\d{2}-\d{2}$/.test(value), true, path);
    // A build-time date would always be today, which is exactly what Google ignores.
    assertEquals(value < '2026-12-31', true, path);
  }
  assertEquals(Object.keys(STATIC_SITEMAP_LASTMOD).sort(), [...STATIC_SITEMAP_PATHS].sort());
});

Deno.test('buildUrlset still emits lastmod for dates', () => {
  const xml = buildUrlset('https://kamespace.com', [
    { path: '/properties', lastmod: '2026-11-13' },
    { path: '/parkings', lastmod: null },
  ]);
  assertStringIncludes(
    xml,
    '<loc>https://kamespace.com/properties</loc><lastmod>2026-11-13</lastmod>'
  );
  assertEquals(xml.includes('/parkings</loc><lastmod>'), false);
});
