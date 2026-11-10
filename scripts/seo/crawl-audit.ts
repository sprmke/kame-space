#!/usr/bin/env bun
/**
 * Crawl audit for the public site (SEO-12.4).
 *
 * Reads the sitemap, fetches every URL twice (crawler UA and browser UA), and reports the
 * things a search engine judges us on:
 * - status codes and redirect chains
 * - missing / duplicate / over-long titles and descriptions
 * - canonical that does not match the fetched URL
 * - `noindex` on a sitemap URL
 * - crawler HTML with no real content (the SPA-shell problem) and more than one `<h1>`
 * - content images without alt text
 * - JSON-LD that does not parse
 *
 * Report-only by default so it can run on every PR. Pass `--fail-on-error` to make serious
 * findings exit non-zero.
 *
 * Usage:
 *   bun run seo:audit -- --origin https://kamespace.com --limit 100
 *   bun run seo:audit -- --origin https://preview-url.vercel.app --fail-on-error
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CRAWLER_UA = 'Mozilla/5.0 (compatible; KameSpaceSeoAudit/1.0; +https://kamespace.com)';
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36';

const TITLE_MIN = 15;
const TITLE_MAX = 65;
const DESCRIPTION_MIN = 70;
const DESCRIPTION_MAX = 165;

type Finding = { level: 'error' | 'warning'; code: string; message: string };
type PageAudit = {
  url: string;
  status: number | null;
  redirectTo: string | null;
  title: string | null;
  description: string | null;
  canonical: string | null;
  robots: string | null;
  h1Count: number;
  textLength: number;
  imagesWithoutAlt: number;
  jsonLdErrors: string[];
  findings: Finding[];
};

function parseArgs(argv: string[]) {
  const args = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args.set(key, next);
      i += 1;
    } else {
      args.set(key, true);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const originArg = typeof args.get('origin') === 'string' ? (args.get('origin') as string) : '';
const origin = originArg.replace(/\/+$/, '');
if (!origin) {
  console.error('seo:audit needs --origin <https://host>');
  process.exit(2);
}

const limitArg = Number.parseInt(
  typeof args.get('limit') === 'string' ? (args.get('limit') as string) : '50',
  10
);
const limit = Number.isFinite(limitArg) && limitArg > 0 ? limitArg : 50;
const failOnError = args.get('fail-on-error') === true;

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const outDir =
  typeof args.get('out') === 'string'
    ? resolve(root, args.get('out') as string)
    : join(root, 'docs/workflow/in-progress/seo-evidence');

async function fetchText(url: string, userAgent: string) {
  const res = await fetch(url, {
    headers: { 'user-agent': userAgent, accept: 'text/html,application/xml' },
    redirect: 'manual',
  });
  const body = res.status >= 300 && res.status < 400 ? '' : await res.text();
  return { status: res.status, location: res.headers.get('location'), body };
}

async function sitemapUrls(rootUrl: string): Promise<string[]> {
  const { body } = await fetchText(`${rootUrl}/sitemap.xml`, CRAWLER_UA);
  const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!.trim());
  if (!body.includes('<sitemapindex')) return locs;

  const urls: string[] = [];
  for (const child of locs) {
    const { body: childBody } = await fetchText(child, CRAWLER_UA);
    for (const match of childBody.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      urls.push(match[1]!.trim());
    }
  }
  return urls;
}

function decode(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function firstMatch(html: string, regex: RegExp): string | null {
  const match = html.match(regex);
  return match?.[1] ? decode(match[1].trim()) : null;
}

function countH1(html: string): number {
  return (html.match(/<h1[\s>]/gi) ?? []).length;
}

function visibleTextLength(html: string): number {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return withoutScripts.replace(/\s+/g, ' ').trim().length;
}

function imagesWithoutAlt(html: string): number {
  const images = html.match(/<img\b[^>]*>/gi) ?? [];
  return images.filter((tag) => !/\salt\s*=\s*("[^"]*"|'[^']*')/i.test(tag)).length;
}

function jsonLdErrors(html: string): string[] {
  const errors: string[] = [];
  const blocks = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of blocks) {
    const json = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    try {
      JSON.parse(json);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'invalid JSON-LD');
    }
  }
  return errors;
}

function truncate(value: string, max = 80): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

async function auditPage(url: string): Promise<PageAudit> {
  const findings: Finding[] = [];
  const crawler = await fetchText(url, CRAWLER_UA);
  const path = new URL(url).pathname;

  let status = crawler.status;
  let redirectTo: string | null = null;
  if (status >= 300 && status < 400) {
    redirectTo = crawler.location;
    findings.push({
      level: 'warning',
      code: 'redirect-in-sitemap',
      message: `Sitemap URL redirects to ${redirectTo ?? 'unknown'}`,
    });
  }

  const html = crawler.body;
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = firstMatch(html, /<meta\s+name="description"[^>]*content="([^"]*)"/i);
  const canonical = firstMatch(html, /<link\s+rel="canonical"[^>]*href="([^"]*)"/i);
  const robots = firstMatch(html, /<meta\s+name="robots"[^>]*content="([^"]*)"/i);
  const h1Count = countH1(html);
  const textLength = visibleTextLength(html);
  const missingAlt = imagesWithoutAlt(html);
  const ldErrors = jsonLdErrors(html);

  if (status !== 200) {
    findings.push({ level: 'error', code: 'status', message: `HTTP ${status}` });
  }
  if (/noindex/i.test(robots ?? '')) {
    findings.push({ level: 'error', code: 'noindex', message: 'Sitemap URL is noindex' });
  }
  if (!title) {
    findings.push({ level: 'error', code: 'title-missing', message: 'No <title>' });
  } else if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    findings.push({
      level: 'warning',
      code: 'title-length',
      message: `${title.length} chars: ${truncate(title)}`,
    });
  }
  if (!description) {
    findings.push({ level: 'error', code: 'description-missing', message: 'No meta description' });
  } else if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
    findings.push({
      level: 'warning',
      code: 'description-length',
      message: `${description.length} chars`,
    });
  }
  if (!canonical) {
    findings.push({ level: 'error', code: 'canonical-missing', message: 'No canonical link' });
  } else {
    const expected = `${origin}${path === '/' ? '/' : path.replace(/\/+$/, '')}`;
    if (canonical.replace(/\/+$/, '') !== expected.replace(/\/+$/, '')) {
      findings.push({
        level: 'warning',
        code: 'canonical-mismatch',
        message: `${canonical} (expected ${expected})`,
      });
    }
  }
  if (h1Count !== 1) {
    findings.push({
      level: 'error',
      code: 'h1-count',
      message: `${h1Count} <h1> elements in crawler HTML`,
    });
  }
  if (textLength < 400) {
    findings.push({
      level: 'error',
      code: 'thin-crawler-html',
      message: `Only ${textLength} characters of text without JS`,
    });
  }
  if (missingAlt > 0) {
    findings.push({
      level: 'warning',
      code: 'images-without-alt',
      message: `${missingAlt} image(s) without alt`,
    });
  }
  for (const error of ldErrors) {
    findings.push({ level: 'error', code: 'jsonld-parse', message: error });
  }

  // Browsers should get the app, not the snapshot: no snapshot marker.
  const browser = await fetchText(url, BROWSER_UA);
  if (browser.body.includes('data-seo-route=')) {
    findings.push({
      level: 'error',
      code: 'snapshot-leaked-to-browser',
      message: 'Browser user agent received the crawler snapshot',
    });
  }
  if (browser.status !== status) {
    findings.push({
      level: 'warning',
      code: 'ua-status-mismatch',
      message: `crawler ${status} vs browser ${browser.status}`,
    });
  }

  return {
    url,
    status,
    redirectTo,
    title,
    description,
    canonical,
    robots,
    h1Count,
    textLength,
    imagesWithoutAlt: missingAlt,
    jsonLdErrors: ldErrors,
    findings,
  };
}

function duplicateFindings(pages: PageAudit[]): Finding[] {
  const findings: Finding[] = [];
  for (const field of ['title', 'description'] as const) {
    const seen = new Map<string, string[]>();
    for (const page of pages) {
      const value = page[field];
      if (!value) continue;
      const list = seen.get(value) ?? [];
      list.push(page.url);
      seen.set(value, list);
    }
    for (const [value, urls] of seen) {
      if (urls.length < 2) continue;
      findings.push({
        level: 'warning',
        code: `duplicate-${field}`,
        message: `${urls.length} pages share ${truncate(value, 60)} (${urls
          .slice(0, 3)
          .join(', ')})`,
      });
    }
  }
  return findings;
}

function renderMarkdown(pages: PageAudit[], global: Finding[], sitemapCount: number): string {
  const lines: string[] = [];
  lines.push(`# SEO crawl audit — ${origin}`);
  lines.push('');
  lines.push(`Generated ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`- Sitemap URLs: ${sitemapCount}`);
  lines.push(`- Audited: ${pages.length}`);
  lines.push(`- Errors: ${[...global, ...pages.flatMap((p) => p.findings)].filter((f) => f.level === 'error').length}`);
  lines.push(`- Warnings: ${[...global, ...pages.flatMap((p) => p.findings)].filter((f) => f.level === 'warning').length}`);
  lines.push('');

  if (global.length > 0) {
    lines.push('## Global');
    lines.push('');
    for (const finding of global) lines.push(`- **${finding.level}** \`${finding.code}\` ${finding.message}`);
    lines.push('');
  }

  lines.push('## Pages');
  lines.push('');
  lines.push('| URL | Status | Title len | Desc len | H1 | Text |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const page of pages) {
    const path = new URL(page.url).pathname;
    lines.push(
      `| ${path} | ${page.status ?? '—'} | ${page.title?.length ?? 0} | ${page.description?.length ?? 0} | ${page.h1Count} | ${page.textLength} |`
    );
  }
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  for (const page of pages) {
    if (page.findings.length === 0) continue;
    lines.push(`### ${new URL(page.url).pathname}`);
    for (const finding of page.findings) lines.push(`- **${finding.level}** \`${finding.code}\` ${finding.message}`);
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  const sitemap = await sitemapUrls(origin);
  const targets = sitemap.slice(0, limit);
  const global: Finding[] = [];

  if (sitemap.length === 0) {
    global.push({ level: 'error', code: 'sitemap-empty', message: 'Sitemap returned no URLs' });
  }

  const pages: PageAudit[] = [];
  for (const url of targets) {
    try {
      pages.push(await auditPage(url));
    } catch (error) {
      pages.push({
        url,
        status: null,
        redirectTo: null,
        title: null,
        description: null,
        canonical: null,
        robots: null,
        h1Count: 0,
        textLength: 0,
        imagesWithoutAlt: 0,
        jsonLdErrors: [],
        findings: [
          {
            level: 'error',
            code: 'fetch-failed',
            message: error instanceof Error ? error.message : 'fetch failed',
          },
        ],
      });
    }
  }

  global.push(...duplicateFindings(pages));

  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const markdown = renderMarkdown(pages, global, sitemap.length);
  writeFileSync(join(outDir, `seo-audit-${stamp}.md`), `${markdown}\n`, 'utf8');
  writeFileSync(
    join(outDir, `seo-audit-${stamp}.json`),
    `${JSON.stringify({ origin, generatedAt: new Date().toISOString(), sitemapCount: sitemap.length, global, pages }, null, 2)}\n`,
    'utf8'
  );

  const errors = [...global, ...pages.flatMap((page) => page.findings)].filter(
    (finding) => finding.level === 'error'
  );
  console.log(`${markdown.split('\n').slice(0, 6).join('\n')}`);
  console.log(`\nReport written to ${outDir.replace(`${root}/`, '')}`);

  if (failOnError && errors.length > 0) process.exit(1);
}

await main();
