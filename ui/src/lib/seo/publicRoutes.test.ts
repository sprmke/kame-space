import { describe, expect, it } from 'vitest';

import {
  AI_CRAWLER_USER_AGENTS,
  PUBLIC_ROUTES,
  ROBOTS_DISALLOW,
  isAllowedByRobots,
  matchHostPath,
  matchPlacePath,
  matchStaticRoute,
  staticSitemapPaths,
} from '@/lib/seo/publicRoutes';

function samplePath(pattern: string): string {
  return pattern.replace(/:[\w]+/g, 'sample-slug').replace(/\*/g, 'anything');
}

describe('public route registry', () => {
  it('has unique ids and patterns', () => {
    const ids = PUBLIC_ROUTES.map((route) => route.id);
    const patterns = PUBLIC_ROUTES.map((route) => route.pattern);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(patterns).size).toBe(patterns.length);
  });

  it('starts every pattern with a slash', () => {
    for (const route of PUBLIC_ROUTES.filter((entry) => entry.pattern !== '*')) {
      expect(route.pattern.startsWith('/'), route.pattern).toBe(true);
    }
  });

  it('never sitemaps or canonicalizes a non-indexable route', () => {
    for (const route of PUBLIC_ROUTES.filter((entry) => !entry.indexable)) {
      expect(route.inSitemap, route.pattern).toBe(false);
      expect(route.canonical, route.pattern).toBe('none');
      expect(route.snapshot, route.pattern).toBe('none');
    }
  });

  it('describes and titles every indexable static route', () => {
    for (const route of PUBLIC_ROUTES.filter(
      (entry) => entry.indexable && entry.snapshot === 'static'
    )) {
      expect(route.title?.length, route.pattern).toBeGreaterThan(0);
      expect(route.description?.length, route.pattern).toBeGreaterThan(70);
      expect(route.description?.length, route.pattern).toBeLessThanOrEqual(200);
    }
  });

  it('keeps every indexable route crawlable', () => {
    for (const route of PUBLIC_ROUTES.filter((entry) => entry.indexable)) {
      expect(isAllowedByRobots(samplePath(route.pattern)), route.pattern).toBe(true);
      // Query strings on a listing stay indexable; only tracked/map params are scoped out.
      expect(isAllowedByRobots(samplePath(route.pattern)), route.pattern).toBe(true);
    }
  });

  it('derives the static sitemap paths from in-sitemap static routes', () => {
    expect(staticSitemapPaths()).toEqual([
      '/',
      '/properties',
      '/parkings',
      '/developments',
      '/for-hosts',
      '/for-hosts/pricing',
      '/about',
      '/contact',
      '/support',
      '/terms',
      '/privacy',
      '/cookies',
    ]);
  });
});

describe('robots matcher', () => {
  it('blocks private prefixes and their children', () => {
    expect(isAllowedByRobots('/account')).toBe(false);
    expect(isAllowedByRobots('/account/profile')).toBe(false);
    expect(isAllowedByRobots('/org/kame-homes/property/x')).toBe(false);
    expect(isAllowedByRobots('/ingest/capture')).toBe(false);
  });

  it('blocks token and booking pages', () => {
    expect(isAllowedByRobots('/properties/monaco-2604/form')).toBe(false);
    expect(isAllowedByRobots('/properties/monaco-2604/document')).toBe(false);
    expect(isAllowedByRobots('/properties/monaco-2604/parking/abc123')).toBe(false);
    expect(isAllowedByRobots('/parkings/slot-a1/form')).toBe(false);
    expect(isAllowedByRobots('/parkings/requests/abc')).toBe(false);
  });

  it('scopes trip pages to the query string so a listing called trip-house stays crawlable', () => {
    expect(isAllowedByRobots('/properties/monaco-2604/trip?bookingId=abc')).toBe(false);
    expect(isAllowedByRobots('/properties/trip-house')).toBe(true);
  });

  it('scopes map viewport params without blocking the list page', () => {
    expect(isAllowedByRobots('/properties?swLat=1&swLng=2')).toBe(false);
    expect(isAllowedByRobots('/properties?page=2')).toBe(true);
  });

  it('allows public catalogue routes', () => {
    for (const path of [
      '/',
      '/properties',
      '/properties/monaco-2604',
      '/properties/in/makati',
      '/parkings',
      '/developments',
      '/developments/azure-north',
      '/developments/azure-north/parking',
      '/hosts/kame-homes',
      '/for-hosts',
      '/for-hosts/pricing',
      '/about',
      '/support',
    ]) {
      expect(isAllowedByRobots(path), path).toBe(true);
    }
  });
});

describe('robots disallow list', () => {
  it('has no duplicates', () => {
    expect(new Set(ROBOTS_DISALLOW).size).toBe(ROBOTS_DISALLOW.length);
  });

  it('never blocks a family list path', () => {
    for (const path of ['/properties', '/parkings', '/developments']) {
      expect(isAllowedByRobots(path), path).toBe(true);
    }
  });
});

describe('AI crawler group', () => {
  it('lists the search and answer engines the plan allows', () => {
    for (const agent of [
      'OAI-SearchBot',
      'ChatGPT-User',
      'GPTBot',
      'ClaudeBot',
      'PerplexityBot',
      'Bingbot',
    ]) {
      expect(AI_CRAWLER_USER_AGENTS).toContain(agent);
    }
  });
});

describe('path matchers', () => {
  it('matches place browse pages only', () => {
    expect(matchPlacePath('/properties/in/makati')).toEqual({
      family: 'property',
      place: 'makati',
    });
    expect(matchPlacePath('/parkings/in/bgc/')).toEqual({ family: 'parking', place: 'bgc' });
    expect(matchPlacePath('/developments/in/cebu')).toEqual({
      family: 'development',
      place: 'cebu',
    });
    expect(matchPlacePath('/properties/monaco-2604')).toBeNull();
  });

  it('matches host pages only', () => {
    expect(matchHostPath('/hosts/kame-homes')).toEqual({ orgSlug: 'kame-homes' });
    expect(matchHostPath('/hosts')).toBeNull();
  });

  it('matches static routes and ignores parameterized ones', () => {
    expect(matchStaticRoute('/about')?.id).toBe('about');
    expect(matchStaticRoute('/about/')?.id).toBe('about');
    expect(matchStaticRoute('/')?.id).toBe('home');
    expect(matchStaticRoute('/properties/monaco-2604')).toBeNull();
  });
});
