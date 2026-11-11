import { describe, expect, it } from 'vitest';

import {
  SNAPSHOT_FOOTER,
  SNAPSHOT_NAV,
  injectSnapshotIntoHtml,
  renderSnapshotHtml,
  type SnapshotPage,
} from '@/lib/seo/snapshot/renderSnapshot';

const ORIGIN = 'https://kamespace.com';

const page: SnapshotPage = {
  id: 'property-detail',
  heading: 'Monaco 2604',
  intro: 'A studio in Azure North.',
  facts: [
    { label: 'Location', value: 'San Fernando, Pampanga' },
    { label: 'Guests', value: '2' },
  ],
  images: [{ src: 'https://cdn.example.com/a.jpg', alt: 'Living area of Monaco 2604' }],
  links: [{ href: '/properties', label: 'All stays' }],
  breadcrumbs: [
    { name: 'Home', path: '/' },
    { name: 'Stays', path: '/properties' },
    { name: 'Monaco 2604', path: '' },
  ],
};

describe('renderSnapshotHtml', () => {
  it('emits exactly one h1 with the page heading', () => {
    const html = renderSnapshotHtml(page, ORIGIN);
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toContain('<h1>Monaco 2604</h1>');
  });

  it('renders absolute links on the canonical origin', () => {
    const html = renderSnapshotHtml(page, ORIGIN);
    expect(html).toContain('href="https://kamespace.com/properties"');
    expect(html).not.toContain('href="/properties"');
  });

  it('includes a global nav and footer so crawlers can discover other routes', () => {
    const html = renderSnapshotHtml(page, ORIGIN);
    for (const item of [...SNAPSHOT_NAV, ...SNAPSHOT_FOOTER]) {
      expect(html).toContain(`href="https://kamespace.com${item.href}"`);
    }
  });

  it('renders facts, images with alt, and a breadcrumb trail', () => {
    const html = renderSnapshotHtml(page, ORIGIN);
    expect(html).toContain('<dt>Location</dt><dd>San Fernando, Pampanga</dd>');
    expect(html).toContain('alt="Living area of Monaco 2604"');
    expect(html).toContain('aria-label="Breadcrumb"');
  });

  it('escapes every interpolated value', () => {
    const html = renderSnapshotHtml(
      {
        id: 'x',
        heading: '<script>alert(1)</script>',
        intro: 'Ben & Jerry\'s "best"',
        facts: [{ label: '<b>', value: '>' }],
        links: [{ href: '/x?a=1&b=2', label: '<em>' }],
      },
      ORIGIN
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Ben &amp; Jerry&#39;s &quot;best&quot;');
    expect(html).toContain('href="https://kamespace.com/x?a=1&amp;b=2"');
  });

  it('drops empty facts and links instead of rendering blank rows', () => {
    const html = renderSnapshotHtml(
      {
        id: 'x',
        heading: 'H',
        facts: [{ label: ' ', value: '  ' }],
        links: [{ href: '', label: '' }],
      },
      ORIGIN
    );
    expect(html).not.toContain('<dl>');
    expect(html).not.toContain('<a href="">');
  });

  it('marks the mount point with the route id', () => {
    expect(renderSnapshotHtml(page, ORIGIN)).toContain('data-seo-route="property-detail"');
  });
});

describe('injectSnapshotIntoHtml', () => {
  it('replaces the empty root div', () => {
    const shell = '<html><body><div id="root"></div><script src="/a.js"></script></body></html>';
    const out = injectSnapshotIntoHtml(shell, '<div id="root"><main>hi</main></div>');
    expect(out).toBe(
      '<html><body><div id="root"><main>hi</main></div><script src="/a.js"></script></body></html>'
    );
  });

  it('replaces a root div that carries attributes', () => {
    const shell = '<body><div id="root" class="app">\n</div></body>';
    const out = injectSnapshotIntoHtml(shell, '<div id="root">x</div>');
    expect(out).toContain('<div id="root">x</div>');
    expect(out).not.toContain('class="app"');
  });

  it('returns the shell unchanged when there is no mount point', () => {
    expect(injectSnapshotIntoHtml('<body></body>', '<div></div>')).toBe('<body></body>');
  });
});
