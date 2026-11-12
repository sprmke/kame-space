import { describe, expect, it } from 'vitest';

import { buildStaticPageMarkdown } from '@/lib/seo/markdown';

const page = {
  id: 'about',
  heading: 'Philippine stays, one operating system',
  intro: 'Connect guest booking, host operations, messaging.',
  facts: [{ label: 'Based in', value: 'Manila' }],
  links: [{ href: '/for-hosts', label: 'For hosts' }],
  breadcrumbs: [
    { name: 'Home', path: '/' },
    { name: 'About', path: '' },
  ],
};

const base = {
  page,
  canonicalUrl: 'https://kamespace.com/about',
  siteName: 'Kame Space',
};

describe('buildStaticPageMarkdown', () => {
  it('starts with the heading the HTML page renders', () => {
    expect(
      buildStaticPageMarkdown(base).startsWith('# Philippine stays, one operating system')
    ).toBe(true);
  });

  it('renders intro, facts, absolute links and the path', () => {
    const md = buildStaticPageMarkdown(base);
    expect(md).toContain('Connect guest booking, host operations, messaging.');
    expect(md).toContain('- **Based in:** Manila');
    expect(md).toContain('- [For hosts](https://kamespace.com/for-hosts)');
    expect(md).toContain('Home / About');
    expect(md).toContain('Canonical: https://kamespace.com/about');
  });

  it('never emits an em dash', () => {
    expect(buildStaticPageMarkdown(base)).not.toContain('\u2014');
  });

  it('escapes characters that would break a Markdown link', () => {
    const md = buildStaticPageMarkdown({
      ...base,
      page: {
        id: 'x',
        heading: 'Café (Makati) [new]',
        intro: 'A stay with [brackets] and (parens).',
        links: [{ href: '/properties/a', label: 'A [b] (c)' }],
      },
    });
    expect(md).toContain('# Café \\(Makati\\) \\[new\\]');
    expect(md).toContain('\\[brackets\\]');
    expect(md).toContain('- [A \\[b\\] \\(c\\)](https://kamespace.com/properties/a)');
  });

  it('skips empty facts and links instead of rendering blank rows', () => {
    const md = buildStaticPageMarkdown({
      ...base,
      page: { id: 'x', heading: 'H', facts: [{ label: ' ', value: '' }], links: [] },
    });
    expect(md).not.toContain('## At a glance');
    expect(md).not.toContain('## Links');
  });

  it('keeps an absolute link as-is', () => {
    const md = buildStaticPageMarkdown({
      ...base,
      page: { id: 'x', heading: 'H', links: [{ href: 'https://example.com/x', label: 'X' }] },
    });
    expect(md).toContain('(https://example.com/x)');
  });
});
