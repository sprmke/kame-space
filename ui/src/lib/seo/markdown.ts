/**
 * Markdown variants of the static public pages (`/about.md`, `/for-hosts/pricing.md`, …).
 *
 * AI answer engines and CLI agents read Markdown far more reliably than HTML, and a plain
 * `.md` fetch is cheap. The content is the *same* snapshot the crawler HTML renders, so this
 * file never invents copy: heading, intro, facts and links come straight from
 * `renderSnapshot`'s page object.
 *
 * Pure and dependency-free, shared by the middleware and the unit tests.
 */

import type { SnapshotPage } from './snapshot/renderSnapshot';

export type MarkdownPageInput = {
  page: SnapshotPage;
  /** Absolute canonical URL of the HTML page this markdown mirrors. */
  canonicalUrl: string;
  siteName: string;
};

/** Escape the characters that would break a Markdown link or list line. */
function escapeInline(value: string): string {
  return value
    .replace(/([[\]()\\])/g, '\\$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildStaticPageMarkdown(input: MarkdownPageInput): string {
  const { page, canonicalUrl, siteName } = input;
  const lines: string[] = [`# ${escapeInline(page.heading)}`, ''];

  if (page.intro?.trim()) {
    lines.push(escapeInline(page.intro), '');
  }

  const facts = (page.facts ?? []).filter((fact) => fact.label.trim() && fact.value.trim());
  if (facts.length > 0) {
    lines.push('## At a glance', '');
    for (const fact of facts) {
      lines.push(`- **${escapeInline(fact.label)}:** ${escapeInline(fact.value)}`);
    }
    lines.push('');
  }

  const links = (page.links ?? []).filter((link) => link.href.trim() && link.label.trim());
  if (links.length > 0) {
    lines.push('## Links', '');
    for (const link of links) {
      const absolute = /^https?:\/\//i.test(link.href)
        ? link.href
        : `${canonicalUrl.split('/').slice(0, 3).join('/')}${link.href}`;
      lines.push(`- [${escapeInline(link.label)}](${absolute})`);
    }
    lines.push('');
  }

  if (page.breadcrumbs && page.breadcrumbs.length > 1) {
    lines.push('## Path', '');
    lines.push(page.breadcrumbs.map((crumb) => escapeInline(crumb.name)).join(' / '), '');
  }

  lines.push('---', '', `Canonical: ${canonicalUrl}`, `Site: ${siteName}`, '');

  return lines.join('\n');
}
