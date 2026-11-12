import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_TIMEOUT_MS, PRIMARY_TIMEOUT_MS, handleSeoRequest } from '@/lib/seo/seoMiddleware';

const SHELL =
  '<html><head><title>Old Brand</title></head><body><div id="root"></div></body></html>';
const BOT = 'facebookexternalhit/1.1';
const GPT_BOT = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1';
const BROWSER = 'Mozilla/5.0 (iPhone) Safari/604.1';

function req(path: string, ua = BOT, method = 'GET') {
  return new Request(`https://kamehomes.space${path}`, { method, headers: { 'user-agent': ua } });
}

function deps(fetchImpl: typeof fetch) {
  return {
    functionsUrl: 'https://abc.supabase.co/functions/v1/',
    anonKey: 'anon',
    siteName: 'Old Brand',
    siteOrigin: 'https://kamespace.com',
    fetchImpl,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const shell = () => Promise.resolve(SHELL);

describe('edge fetch budgets', () => {
  // Measured against production on 2026-11-11: get-public-property cold 4.3 s, warm 1.8-2.5 s.
  // A 2.5 s cap on the payload that *is* the snapshot silently dropped property detail
  // snapshots in production. This keeps the split honest.
  it('gives the snapshot payload a bigger budget than optional enrichment', () => {
    expect(PRIMARY_TIMEOUT_MS).toBeGreaterThan(DEFAULT_TIMEOUT_MS * 2);
  });
});

describe('handleSeoRequest', () => {
  it('serves robots.txt pointing at the canonical sitemap', async () => {
    const res = await handleSeoRequest(req('/robots.txt', BROWSER), deps(vi.fn()), shell);
    expect(await res!.text()).toContain('Sitemap: https://kamespace.com/sitemap.xml');
  });

  it('keeps production hosts indexable even when SEO_INDEXABLE_HOSTS omits them', async () => {
    const res = await handleSeoRequest(
      new Request('https://kamespace.com/robots.txt', { headers: { 'user-agent': BROWSER } }),
      { ...deps(vi.fn()), indexableHosts: ['legacy.example.com'] },
      shell
    );
    const txt = await res!.text();
    expect(txt).toContain('Allow: /');
    expect(txt).toContain('Sitemap: https://kamespace.com/sitemap.xml');
    // The env list still adds hosts.
    const legacy = await handleSeoRequest(
      new Request('https://legacy.example.com/robots.txt', { headers: { 'user-agent': BROWSER } }),
      { ...deps(vi.fn()), indexableHosts: ['legacy.example.com'] },
      shell
    );
    expect(await legacy!.text()).toContain('Allow: /');
  });

  it('proxies sitemap.xml (with part param) and passes through on upstream failure', async () => {
    const fetchOk = vi.fn().mockResolvedValue(new Response('<urlset/>', { status: 200 }));
    const res = await handleSeoRequest(req('/sitemap.xml?part=2', BROWSER), deps(fetchOk), shell);
    expect(await res!.text()).toBe('<urlset/>');
    expect(fetchOk.mock.calls[0]![0]).toBe(
      'https://abc.supabase.co/functions/v1/public-sitemap?part=2'
    );

    const fetchFail = vi.fn().mockResolvedValue(new Response('', { status: 500 }));
    expect(await handleSeoRequest(req('/sitemap.xml', BROWSER), deps(fetchFail), shell)).toBeNull();
  });

  it('serves llms.txt with the map and llms-full.txt with listings', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        String(url).includes('place-groups')
          ? jsonResponse({
              // Real envelope from list-public-place-groups.
              groups: [
                { place: 'Makati', locationSlug: 'makati', title: 'Homes in Makati', total: 7 },
              ],
            })
          : jsonResponse({
              data: [
                {
                  slug: 'monaco-2604',
                  name: 'Monaco 2604',
                  locationLabel: 'San Fernando',
                  price: 2500,
                },
              ],
            })
      )
    );

    const map = await handleSeoRequest(req('/llms.txt', BROWSER), deps(fetchImpl), shell);
    const mapText = await map!.text();
    expect(mapText).toContain('# Old Brand');
    expect(mapText).toContain('https://kamespace.com/properties');
    expect(mapText).toContain(
      '- [Makati stays](https://kamespace.com/properties/in/makati): 7 listings'
    );

    const full = await handleSeoRequest(req('/llms-full.txt', BROWSER), deps(fetchImpl), shell);
    const fullText = await full!.text();
    expect(fullText).toContain('## All Stay listings');
    expect(fullText).toContain('Monaco 2604');
  });

  it('serves a minimal llms.txt on a host that must not be crawled', async () => {
    const res = await handleSeoRequest(
      new Request('https://preview-abc.vercel.app/llms.txt', {
        headers: { 'user-agent': BROWSER },
      }),
      deps(vi.fn()),
      shell
    );
    expect(await res!.text()).toContain('not public');
  });

  it('serves a markdown variant of a static page', async () => {
    const res = await handleSeoRequest(req('/about.md', BROWSER), deps(vi.fn()), shell);
    const md = await res!.text();
    expect(res!.headers.get('content-type')).toContain('text/markdown');
    expect(md.startsWith('# Philippine stays, one operating system')).toBe(true);
    expect(md).toContain('Canonical: https://kamespace.com/about');
    // Site nav is folded in so the file is a usable map, not just a hero line.
    expect(md).toContain('- [Home](https://kamespace.com/)');
    expect(md).toContain('- [Stays](https://kamespace.com/properties)');
  });

  it('does not serve markdown for a private or unknown route', async () => {
    for (const path of ['/services.md', '/account/profile.md', '/nope.md']) {
      expect(await handleSeoRequest(req(path, BROWSER), deps(vi.fn()), shell), path).toBeNull();
    }
  });

  it('serves the IndexNow key file when configured', async () => {
    const res = await handleSeoRequest(
      req('/abc123.txt', BROWSER),
      {
        ...deps(vi.fn()),
        indexNowKey: 'abc123',
      },
      shell
    );
    expect(await res!.text()).toBe('abc123\n');
  });

  it('301s a mixed-case path to lowercase for every user agent', async () => {
    for (const ua of [BROWSER, BOT]) {
      const res = await handleSeoRequest(req('/Properties/Monaco-2604', ua), deps(vi.fn()), shell);
      expect(res!.status).toBe(301);
      expect(res!.headers.get('location')).toBe('https://kamespace.com/properties/monaco-2604');
    }
  });

  it('passes browsers through untouched', async () => {
    const fetchImpl = vi.fn();
    expect(
      await handleSeoRequest(req('/properties/monaco-2612', BROWSER), deps(fetchImpl), shell)
    ).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('injects property meta and a content snapshot for crawlers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          name: 'Monaco 2612',
          description: null,
          locationLabel: 'San Fernando, Pampanga',
          images: ['https://img/a.jpg'],
          city: 'San Fernando',
          rating: 4.8,
          reviewCount: 8,
          pricing: { weekdayNightlyRate: 2500 },
        },
      })
    );
    const res = await handleSeoRequest(req('/properties/monaco-2612/'), deps(fetchImpl), shell);
    const html = await res!.text();
    expect(res!.headers.get('content-type')).toContain('text/html');
    expect(res!.headers.get('vary')).toContain('user-agent');
    expect(html).toContain('<title>Monaco 2612 in San Fernando | Old Brand</title>');
    expect(html).toContain('og:image" content="https://img/a.jpg"');
    expect(html).toContain('href="https://kamespace.com/properties/monaco-2612"');
    expect(html).toContain('"@type":"LodgingBusiness"');
    expect(html).toContain('"reviewCount":8');
    // The empty SPA shell is replaced with real content.
    expect(html).not.toContain('<div id="root"></div>');
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toContain('<h1>Monaco 2612</h1>');
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      'https://abc.supabase.co/functions/v1/get-public-property?property=monaco-2612'
    );
  });

  it('handles parking and development detail pages', async () => {
    const parkingFetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ data: { name: 'Slot A1', residenceName: 'Azure North', ratePerNight: 300 } })
      );
    const parking = await handleSeoRequest(req('/parkings/slot-a1'), deps(parkingFetch), shell);
    const parkingHtml = await parking!.text();
    expect(parkingHtml).toContain('<title>Slot A1 parking in Azure North | Old Brand</title>');
    expect(parkingHtml).toContain('<h1>Slot A1</h1>');

    const devFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: [{ name: 'Azure North', city: 'San Fernando' }] }));
    const dev = await handleSeoRequest(req('/developments/azure-north'), deps(devFetch), shell);
    expect(await dev!.text()).toContain('"@type":"Residence"');
  });

  it('renders a static page snapshot without touching the edge', async () => {
    const fetchImpl = vi.fn();
    const res = await handleSeoRequest(req('/about'), deps(fetchImpl), shell);
    const html = await res!.text();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(html).toContain('<h1>Philippine stays, one operating system</h1>');
    expect(html).toContain('href="https://kamespace.com/about"');
    expect(html).toContain('href="https://kamespace.com/properties"');
  });

  it('renders a place page snapshot from the public list endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          {
            slug: 'monaco-2604',
            name: 'Monaco 2604',
            locationLabel: 'San Fernando, Pampanga',
            coverImage: 'https://img/a.jpg',
            price: 2500,
          },
        ],
      })
    );
    const res = await handleSeoRequest(req('/properties/in/san-fernando'), deps(fetchImpl), shell);
    const html = await res!.text();
    expect(fetchImpl.mock.calls[0]![0]).toContain(
      'list-public-properties?locationSlug=san-fernando'
    );
    expect(html).toContain('<h1>Condos and homes for rent in San Fernando, Pampanga</h1>');
    expect(html).toContain('href="https://kamespace.com/properties/monaco-2604"');
  });

  it('links sideways to neighbouring places on a place page', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('place-groups')) {
        return Promise.resolve(
          jsonResponse({
            groups: [
              { place: 'San Fernando', locationSlug: 'san-fernando', total: 4 },
              { place: 'Angeles', locationSlug: 'angeles', total: 2 },
            ],
          })
        );
      }
      return Promise.resolve(
        jsonResponse({
          data: [
            {
              slug: 'monaco-2604',
              name: 'Monaco 2604',
              locationLabel: 'San Fernando',
              price: 2500,
            },
          ],
        })
      );
    });

    const res = await handleSeoRequest(req('/properties/in/san-fernando'), deps(fetchImpl), shell);
    const html = await res!.text();
    // The neighbour is linked as a stay list in that place.
    expect(html).toContain('href="https://kamespace.com/properties/in/angeles"');
    expect(html).toContain('>Homes in Angeles<');
  });

  it('renders a host page snapshot', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          name: 'Sample Host',
          description: null,
          tagline: 'Stays in Pampanga',
          logoUrl: 'https://img/logo.png',
          properties: [{ slug: 'monaco-2604', name: 'Monaco 2604' }],
          parkings: [{ slug: 'slot-a1', name: 'Slot A1' }],
        },
      })
    );
    const res = await handleSeoRequest(req('/hosts/sample-host'), deps(fetchImpl), shell);
    const html = await res!.text();
    expect(html).toContain('<h1>Sample Host</h1>');
    expect(html).toContain('href="https://kamespace.com/properties/monaco-2604"');
    expect(html).toContain('href="https://kamespace.com/parkings/slot-a1"');
  });

  it('301s a historical slug to the current URL', async () => {
    const fetchImpl = vi
      .fn()
      // First call: the listing lookup, which 404s because the slug was renamed.
      .mockResolvedValueOnce(jsonResponse({ error: 'not found' }, 404))
      // Second call: the redirect probe, which answers 301 with a Location.
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { location: '/properties/monaco-2604-renamed' },
        })
      );

    const res = await handleSeoRequest(req('/properties/old-name'), deps(fetchImpl), shell);
    expect(res!.status).toBe(301);
    expect(res!.headers.get('location')).toBe(
      'https://kamespace.com/properties/monaco-2604-renamed'
    );
  });

  it('answers a real 404 for a slug the catalogue does not have', async () => {
    const notFound = vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, 404));
    const res = await handleSeoRequest(req('/properties/missing'), deps(notFound), shell);
    expect(res!.status).toBe(404);
    const html = await res!.text();
    expect(html).toContain('content="noindex"');
    // Still the SPA shell, so a React render can take over.
    expect(html).toContain('id="root"');
  });

  it('serves GPTBot the same snapshot as a link-preview bot', async () => {
    const fetchImpl = vi.fn();
    const res = await handleSeoRequest(req('/support', GPT_BOT), deps(fetchImpl), shell);
    expect(await res!.text()).toContain('<h1>Answers for guests and hosts</h1>');
  });

  it('fails open on errors, non-GET, private routes, and a missing shell', async () => {
    const boom = vi.fn().mockRejectedValue(new Error('network'));
    expect(await handleSeoRequest(req('/properties/x'), deps(boom), shell)).toBeNull();

    const ok = vi.fn().mockResolvedValue(jsonResponse({ data: { name: 'x' } }));
    expect(await handleSeoRequest(req('/properties/x', BOT, 'HEAD'), deps(ok), shell)).toBeNull();
    expect(
      await handleSeoRequest(req('/properties/x'), deps(ok), () => Promise.resolve(null))
    ).toBeNull();

    // Private routes are never snapshotted; the SPA handles them.
    for (const path of ['/account/profile', '/properties/x/form', '/for-hosts/login', '/search']) {
      expect(await handleSeoRequest(req(path), deps(ok), shell), path).toBeNull();
    }

    // Unknown paths fall back to the SPA shell.
    expect(await handleSeoRequest(req('/definitely-not-a-route'), deps(ok), shell)).toBeNull();
  });
});
