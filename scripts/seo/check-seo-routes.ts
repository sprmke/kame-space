#!/usr/bin/env bun
/**
 * Keeps the public SEO surfaces from drifting apart.
 *
 * Checks:
 * 1. `ui/public/robots.txt` matches `buildRobotsTxt` for the apex (the static fallback that
 *    ships when the middleware is not running).
 * 2. The Deno sitemap's `STATIC_SITEMAP_PATHS` matches the registry's static, in-sitemap
 *    routes, so a page added to the sitemap always has a registry entry and vice versa.
 * 3. Every indexable route is allowed by robots, and every indexable static route has a
 *    title and a description.
 * 4. Every `path="…"` literal in the guest route modules is classified in the registry.
 *
 * Run: `bun run check:seo-routes`
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PUBLIC_ROUTES,
  isAllowedByRobots,
  staticSitemapPaths,
  type PublicRouteEntry,
} from '../../ui/src/lib/seo/publicRoutes';
import { buildRobotsTxt, DEFAULT_INDEXABLE_HOSTS } from '../../ui/src/lib/seo/seoMeta';
import { STATIC_SITEMAP_PATHS } from '../../supabase/functions/_shared/publicSitemap';
import { PRODUCTION_SITE_ORIGIN } from '../../ui/src/lib/seo/siteOrigin';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const problems: string[] = [];

function fail(message: string): void {
  problems.push(message);
}

/** `:param` → `sample`, `*` → `anything`, so robots rules can be evaluated on a real path. */
function samplePath(pattern: string): string {
  return pattern.replace(/:[\w]+/g, 'sample-slug').replace(/\*/g, 'anything');
}

// 1. Static robots fallback.
const robotsPath = join(root, 'ui/public/robots.txt');
const robotsFile = readFileSync(robotsPath, 'utf8')
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'))
  .join('\n')
  .trim();
const expectedRobots = buildRobotsTxt(
  PRODUCTION_SITE_ORIGIN,
  DEFAULT_INDEXABLE_HOSTS,
  PRODUCTION_SITE_ORIGIN
)
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'))
  .join('\n')
  .trim();
if (robotsFile !== expectedRobots) {
  fail(
    'ui/public/robots.txt is out of date. Run `bun run seo:generate-robots` and commit the result.'
  );
}

// 2. Sitemap static paths vs registry.
const registryStatic = [...staticSitemapPaths()].sort();
const denoStatic = [...STATIC_SITEMAP_PATHS].sort();
const missingInDeno = registryStatic.filter((path) => !denoStatic.includes(path));
const missingInRegistry = denoStatic.filter((path) => !registryStatic.includes(path));
for (const path of missingInDeno) {
  fail(`Sitemap is missing "${path}" (indexable + inSitemap in the registry).`);
}
for (const path of missingInRegistry) {
  fail(`publicSitemap.ts lists "${path}" but no indexable static route in the registry owns it.`);
}

// 3. Indexable routes must be crawlable and described.
for (const route of PUBLIC_ROUTES) {
  if (!route.indexable) continue;
  const sampled = samplePath(route.pattern);
  if (!isAllowedByRobots(sampled)) {
    fail(`Indexable route "${route.pattern}" is blocked by ROBOTS_DISALLOW.`);
  }
  if (route.snapshot === 'static' && !route.title) {
    fail(`Indexable static route "${route.pattern}" needs a registry title.`);
  }
  if (route.snapshot === 'static' && !route.description) {
    fail(`Indexable static route "${route.pattern}" needs a registry description.`);
  }
}

// 4. Router coverage.
const guestRoot = join(root, 'ui/src/features/guest');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (full.includes(`${join('', 'routes')}`) && /\.tsx?$/.test(full)) {
      out.push(full);
    }
  }
  return out;
}

const ROUTE_LITERAL = /path(?:=|:\s*)["'`]([^"'`]+)["'`]/g;
const registrySuffixes = PUBLIC_ROUTES.map((route: PublicRouteEntry) =>
  route.pattern.replace(/^\//, '')
);

function isClassified(literal: string): boolean {
  const normalized = literal.replace(/^\//, '').replace(/\/+$/, '');
  if (!normalized) return true;
  return registrySuffixes.some(
    (suffix) => suffix === normalized || suffix.endsWith(`/${normalized}`)
  );
}

for (const file of walk(guestRoot)) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(ROUTE_LITERAL)) {
    const literal = match[1]?.trim();
    if (!literal || literal.startsWith('http')) continue;
    if (!isClassified(literal)) {
      fail(
        `${file.replace(`${root}/`, '')}: route path "${literal}" is not classified in ` +
          'ui/src/lib/seo/publicRoutes.ts'
      );
    }
  }
}

if (problems.length > 0) {
  console.error(`check:seo-routes failed with ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `check:seo-routes OK — ${PUBLIC_ROUTES.length} routes classified, ` +
    `${registryStatic.length} static sitemap paths, robots.txt in sync.`
);
