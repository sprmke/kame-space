#!/usr/bin/env node
/**
 * Local seed UI walk.
 *
 * Signs in with the seeded accounts (owner, guest, local super admin) and visits
 * every org / property / parking / admin / guest / public route at 375 and
 * 1280 px. Records redirects, console errors, crashes, not-found pages,
 * horizontal overflow, missing phone bottom nav, and obvious empty states.
 *
 * Requires the local stack and UI dev server:
 *   ./dev.sh --ui-only
 *   bun run seed:attach-admin   (once, for the /admin routes)
 *   bun run seed:verify-ui
 *
 * Artifacts: ui/e2e/artifacts/local-seed/
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const UI = process.env.SEED_WALK_BASE_URL?.trim() || 'http://localhost:5173';
const ARTIFACTS = resolve(ROOT, 'ui/e2e/artifacts/local-seed');
const STORAGE_KEY = 'sb-127-auth-token';

function readEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) out[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const uiEnv = readEnv(resolve(ROOT, 'ui/.env.development'));
const SUPABASE_URL = (uiEnv.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321')
  .replace(/\/functions\/v1\/?$/, '')
  .replace(/\/$/, '');
const ANON_KEY = uiEnv.VITE_SUPABASE_ANON_KEY ?? '';
const SUPER_ADMIN_EMAIL = (uiEnv.VITE_SUPER_ADMIN_EMAILS ?? '').split(',')[0]?.trim() ?? '';

const ORG = 'kame-homes';
const PROP = 'kame-home';
const PARK = 'monaco-level-2-slot-27';
const P = `/org/${ORG}/property/${PROP}`;
const K = `/org/${ORG}/parking/${PARK}`;
const BOOKING = '5eed1000-0000-4000-8000-000000000001';
const PARK_BOOKING = '5eed1100-0000-4000-8000-000000000001';
const PAGE = '5eed7000-0000-4000-8000-000000000001';
const REPORT = '5eedc100-0000-4000-8000-000000000001';

const GROUPS = {
  host: {
    account: 'seed-owner@example.com',
    paths: [
      `/org/${ORG}/dashboard`,
      `/org/${ORG}/properties`,
      `/org/${ORG}/parkings`,
      `/org/${ORG}/bookings`,
      `/org/${ORG}/analytics`,
      `/org/${ORG}/reviews`,
      `/org/${ORG}/team`,
      `/org/${ORG}/inbox`,
      `/org/${ORG}/activity`,
      `/org/${ORG}/announcements`,
      `/org/${ORG}/help-support`,
      `/org/${ORG}/plans`,
      `/org/${ORG}/settings`,
      P,
      `${P}/bookings`,
      `${P}/bookings/${BOOKING}`,
      `${P}/finance`,
      `${P}/pricing`,
      `${P}/pricing/calendar`,
      `${P}/analytics`,
      `${P}/maintenance`,
      `${P}/marketing`,
      `${P}/team`,
      `${P}/inbox`,
      `${P}/reviews`,
      `${P}/activity`,
      `${P}/announcements`,
      `${P}/notifications`,
      `${P}/templates`,
      `${P}/public-pages`,
      `${P}/public-pages/${PAGE}/edit`,
      `${P}/settings`,
      `${P}/plans`,
      `${P}/help-support`,
      K,
      `${K}/bookings`,
      `${K}/bookings/${PARK_BOOKING}`,
      `${K}/finance`,
      `${K}/pricing`,
      `${K}/inbox`,
      `${K}/notifications`,
      `${K}/settings`,
      `${K}/team`,
      `${K}/activity`,
      `${K}/announcements`,
      `${K}/help-support`,
    ],
    empty: {
      [`${P}/bookings`]: /no bookings|no results|nothing here/i,
      [`${P}/finance`]: /no (transactions|line items|finance)/i,
      [`${P}/maintenance`]: /no maintenance/i,
      [`${P}/marketing`]: /no (templates|media|posts|themes)/i,
      [`${P}/inbox`]: /no (conversations|threads|messages)/i,
      [`${P}/reviews`]: /no reviews/i,
      [`${P}/team`]: /no (members|team)/i,
      [`${P}/activity`]: /no activity/i,
    },
  },
  admin: {
    account: SUPER_ADMIN_EMAIL || null,
    paths: [
      '/admin',
      '/admin/properties',
      '/admin/hosts',
      `/admin/hosts/d74b9d44-6244-40f0-9160-7c281738e8c0`,
      '/admin/orgs',
      `/admin/orgs/${ORG}`,
      '/admin/developments',
      '/admin/developments/azure-north-residences',
      '/admin/approvals',
      '/admin/pricing/plans',
      '/admin/pricing/subscriptions',
      '/admin/pricing/payment-settings',
      '/admin/parking/payouts',
      '/admin/feature-availability',
      '/admin/announcements',
      '/admin/ai',
      '/admin/ai-usage',
      '/admin/rate-limits',
      '/admin/health',
      '/admin/ops-reports',
      `/admin/ops-reports/${REPORT}`,
      '/admin/audit',
      '/admin/platform-settings',
      '/admin/support',
      '/admin/support/faqs',
      '/admin/playbook',
    ],
  },
  guest: {
    account: 'guest.demo@example.com',
    paths: [
      '/account',
      '/account/stays',
      '/account/trips',
      '/account/vouchers',
      '/account/favorites',
      '/account/wishlist',
      '/account/messages',
      '/account/tickets',
      '/account/reviews',
      '/account/settings',
      '/account/profile',
      '/account/help',
    ],
  },
  public: {
    account: null,
    paths: [
      '/',
      '/properties',
      `/properties/${PROP}`,
      `/properties/${PROP}/showcase`,
      `/properties/${PROP}/stay-guide`,
      `/properties/${PROP}/form`,
      `/properties/${PROP}/calendar`,
      '/parkings',
      `/parkings/${PARK}`,
      '/developments',
      '/search',
      '/for-hosts',
      '/for-hosts/pricing',
      '/support',
    ],
  },
};

async function signIn(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'seed-password' }),
  });
  const json = await res.json();
  if (!json.access_token) {
    throw new Error(
      `sign-in failed for ${email}: ${json.error_description ?? json.msg ?? res.status}`
    );
  }
  return json;
}

const VIEWPORTS = [
  { name: '375', width: 375, height: 812, mobile: true },
  { name: '1280', width: 1280, height: 800, mobile: false },
];

const CRASH_RE = /something went wrong|unexpected error|application error|this page crashed/i;
const EXPECTED_REDIRECTS = [
  /\/org\/[^/]+\/activity$/,
  /\/org\/[^/]+\/property\/[^/]+\/activity$/,
  /\/org\/[^/]+\/parking\/[^/]+\/activity$/,
  /\/org\/[^/]+\/property\/[^/]+\/plans$/,
  /\/pricing\/calendar$/,
  /\/admin\/ai-usage$/,
  /\/account$/,
  /\/account\/(settings|messages|wishlist)$/,
];
const IGNORED_CONSOLE = [
  /RefererNotAllowedMapError/,
  /useVideoConfig\(\)/,
  /status of 429/,
  /status of 400/,
  /status of 403/,
];
const isKnownEnvFailure = (url) =>
  /google\.com\/maps|property-page-view|get-public-platform-status/.test(url);
const NOT_FOUND_RE = /page not found|404|not found/i;

mkdirSync(ARTIFACTS, { recursive: true });
const browser = await chromium.launch();
const results = [];
const skipped = [];

for (const [group, spec] of Object.entries(GROUPS)) {
  let session = null;
  if (spec.account) {
    try {
      session = await signIn(spec.account);
    } catch (error) {
      skipped.push(`${group}: ${error.message}`);
      continue;
    }
  }

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      deviceScaleFactor: 1,
    });
    if (session) {
      await context.addInitScript(
        ([key, value]) => {
          if (!localStorage.getItem(key)) localStorage.setItem(key, value);
        },
        [STORAGE_KEY, JSON.stringify(session)]
      );
    }
    const page = await context.newPage();

    for (const path of spec.paths) {
      const errors = [];
      const failures = [];
      const onConsole = (msg) => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
        errors.push(text.slice(0, 180));
      };
      const onPageError = (err) => errors.push(`pageerror: ${String(err).slice(0, 180)}`);
      const onResponse = (res) => {
        if (res.status() >= 400 && !isKnownEnvFailure(res.url())) {
          failures.push(`${res.status()} ${res.url().slice(0, 160)}`);
        }
      };
      page.on('console', onConsole);
      page.on('pageerror', onPageError);
      page.on('response', onResponse);

      let status = null;
      let probe = { title: '', finalPath: '', overflowPx: 0, bottomNav: false, text: '' };
      for (let attempt = 0; attempt < 3; attempt++) {
        errors.length = 0;
        failures.length = 0;
        try {
          const response = await page.goto(UI + path, {
            waitUntil: 'domcontentloaded',
            timeout: 45_000,
          });
          status = response?.status() ?? null;
          await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {});
          await page.waitForTimeout(900);
        } catch (error) {
          errors.push(`nav: ${String(error).slice(0, 140)}`);
        }

        probe = await page
          .evaluate(() => {
            const doc = document.documentElement;
            const text = document.body?.innerText ?? '';
            const nav = [...document.querySelectorAll('nav')].find((node) => {
              const rect = node.getBoundingClientRect();
              return (
                rect.height > 0 &&
                rect.bottom >= window.innerHeight - 4 &&
                rect.top > window.innerHeight / 2
              );
            });
            return {
              title: document.title,
              finalPath: location.pathname,
              overflowPx: Math.max(0, doc.scrollWidth - doc.clientWidth),
              bottomNav: Boolean(nav),
              text: text.slice(0, 6000),
            };
          })
          .catch(() => ({ title: '', finalPath: '', overflowPx: 0, bottomNav: false, text: '' }));

        const retryable =
          (status !== null && status >= 500) || failures.some((f) => /^(502|503|504) /.test(f));
        if (!retryable || attempt === 2) break;
        await page.waitForTimeout(2000);
      }

      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      page.off('response', onResponse);

      const emptyRe = spec.empty?.[path];
      const mapFailed = /didn't load Google Maps correctly|did not load Google Maps correctly/i.test(
        probe.text
      );
      const row = {
        group,
        viewport: vp.name,
        path,
        status,
        finalPath: probe.finalPath,
        redirected: probe.finalPath !== path.split('?')[0],
        expectedRedirect:
          probe.finalPath !== path.split('?')[0] &&
          EXPECTED_REDIRECTS.some((re) => re.test(path.split('?')[0])),
        title: probe.title,
        overflowPx: probe.overflowPx,
        bottomNav: probe.bottomNav,
        crash: !mapFailed && CRASH_RE.test(probe.text),
        notFound: NOT_FOUND_RE.test(probe.text) && !/does-not-exist/.test(path),
        empty: emptyRe ? emptyRe.test(probe.text) : false,
        errors: [...new Set(errors)].slice(0, 5),
        failures: [...new Set(failures)].slice(0, 5),
      };
      results.push(row);

      const flags = [
        row.redirected
          ? `→ ${row.finalPath}${row.expectedRedirect ? ' (expected)' : ''}`
          : '',
        row.overflowPx ? `overflow ${row.overflowPx}px` : '',
        row.crash ? 'CRASH' : '',
        row.notFound ? 'NOT FOUND' : '',
        row.empty ? 'EMPTY STATE' : '',
        vp.width < 1024 && group !== 'public' && !row.bottomNav ? 'no bottom nav' : '',
        row.errors.length ? `${row.errors.length} console err` : '',
        row.failures.length ? `${row.failures.length} http err` : '',
      ]
        .filter(Boolean)
        .join(' · ');

      console.log(`${vp.name.padStart(4)} ${path.padEnd(56)} ${flags}`);
      await page.waitForTimeout(400);
    }

    await context.close();
  }
}

await browser.close();

const jsonPath = resolve(ARTIFACTS, 'walk.json');
writeFileSync(jsonPath, JSON.stringify({ results, skipped }, null, 2));

const isTransient = (value) => /status of 50[234]|\b50[234] /.test(value);
const hardErrors = (row) => row.errors.filter((error) => !isTransient(error));
const problems = results.filter(
  (row) => row.crash || row.notFound || row.overflowPx > 0 || hardErrors(row).length > 0
);
const transient = results.filter(
  (row) => !problems.includes(row) && (row.errors.length > 0 || row.failures.length > 0)
);
const empties = results.filter((row) => row.empty);

console.log('');
if (skipped.length) {
  console.log('Skipped groups:');
  for (const line of skipped) console.log(`  - ${line}`);
}
console.log(`${results.length} page loads`);
console.log(`${problems.length} with crash / not-found / overflow / hard console error`);
if (transient.length) {
  console.log(`${transient.length} with a transient local runtime 5xx (safe to ignore; retry the page)`);
}
if (empties.length) {
  console.log(`${empties.length} with an expected-data empty state:`);
  for (const row of empties) console.log(`  - ${row.viewport} ${row.path}`);
}
console.log(`JSON: ${jsonPath}`);

process.exit(problems.length > 0 ? 1 : 0);
