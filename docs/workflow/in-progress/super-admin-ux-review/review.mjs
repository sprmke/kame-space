/**
 * Super admin UI/UX review harness.
 *
 * Signs in with the seeded local owner (super admin) against the local Supabase stack,
 * walks every /admin page at three widths, and writes screenshots plus a diagnostics
 * JSON next to this script. Not part of CI: this is the evidence collector for the
 * audit in ../README.md.
 *
 * Usage:
 *   node docs/workflow/in-progress/super-admin-ux-review/review.mjs            # headless
 *   SLOWMO=700 node .../review.mjs                                              # visible, slow (video)
 *   PAGES=overview,orgs node .../review.mjs                                     # subset
 *   VIEWPORTS=phone,desktop node .../review.mjs
 */
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, process.env.OUT ?? 'screenshots');
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5186';

// Public anon key from the local UI env; used only to call the local edge runtime.
const ANON_KEY = (
  await readFile(path.join(HERE, '../../../../ui/.env.development'), 'utf8')
)
  .split('\n')
  .find((line) => line.startsWith('VITE_SUPABASE_ANON_KEY='))
  ?.split('=')[1]
  ?.trim();

const VIEWPORTS = {
  phone: { width: 390, height: 844, isMobile: true, hasTouch: true },
  tablet: { width: 820, height: 1180, isMobile: true, hasTouch: true },
  desktop: { width: 1440, height: 900, isMobile: false, hasTouch: false },
};

const PAGES = [
  ['overview', '/admin'],
  ['orgs', '/admin/orgs'],
  ['org-hub', '/admin/orgs/kame-homes'],
  ['hosts', '/admin/hosts'],
  ['host-detail', '/admin/hosts/__HOST_ID__'],
  ['developments', '/admin/developments'],
  ['properties', '/admin/properties'],
  ['pricing-plans', '/admin/pricing/plans'],
  ['subscriptions', '/admin/pricing/subscriptions'],
  ['payment-settings', '/admin/pricing/payment-settings'],
  ['parking-payouts', '/admin/parking/payouts'],
  ['approvals', '/admin/approvals'],
  ['support', '/admin/support'],
  ['faqs', '/admin/support/faqs'],
  ['playbook', '/admin/playbook'],
  ['announcements', '/admin/announcements'],
  ['health', '/admin/health'],
  ['marketing-trends', '/admin/marketing-trends'],
  ['ops-reports', '/admin/ops-reports'],
  ['ai-usage', '/admin/ai?tab=usage'],
  ['ai-limits', '/admin/ai?tab=limits'],
  ['ai-profiles', '/admin/ai?tab=profiles'],
  ['ai-wallets', '/admin/ai?tab=wallets'],
  ['ai-controls', '/admin/ai?tab=controls'],
  ['rate-limits', '/admin/rate-limits'],
  ['audit', '/admin/audit'],
  ['platform-settings', '/admin/platform-settings'],
  ['feature-availability', '/admin/feature-availability'],
  ['not-found', '/admin/definitely-not-a-page'],
];

const only = (process.env.PAGES ?? '').split(',').filter(Boolean);
const wanted = only.length ? PAGES.filter(([slug]) => only.includes(slug)) : PAGES;
const viewportNames = (process.env.VIEWPORTS ?? 'phone,tablet,desktop').split(',').filter(Boolean);

const findings = [];

/**
 * MOCK=1 replays snapshots of the real local responses (fixes/fixtures) so before and
 * after screenshots show the same data even when the local edge runtime is slow.
 */
const FIXTURE_DIR = path.join(HERE, 'fixes/fixtures');

async function installFixtureRoutes(context) {
  const read = async (name) => JSON.parse(await readFile(path.join(FIXTURE_DIR, `${name}.json`), 'utf8'));
  await context.route('**/functions/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/functions/v1/')[1] ?? '';
    const summary = url.searchParams.get('summary') === 'true';
    const facets = url.searchParams.get('facets') === 'true';
    const map = {
      'get-public-platform-status': 'platform-status',
      'get-feature-availability': 'feature-availability-shell',
      'feature-availability': 'feature-availability-admin',
      'super-admin-overview': 'overview',
      'get-organization-admin': 'org',
      'list-hosts': 'hosts',
      'list-platform-properties': 'properties',
      'list-developments': 'developments',
      'list-help-center-faqs-admin': 'faqs',
      'list-host-playbook-articles-admin': 'playbook',
      'host-announcements': 'announcements',
      'get-platform-host-settings': 'host-settings',
      'admin-marketing-trends': 'marketing-trends',
      'super-admin-ai-usage': 'ai-usage',
      'ai-platform-global-settings': 'ai-global-settings',
      'ai-platform-credit-wallet': 'ai-wallet',
      'super-admin-rate-limits': 'rate-limits',
      'platform-settings': 'settings',
      'pricing-plans': 'pricing-plans',
      'super-admin-ai-limits': 'ai-limits',
    };
    let name = map[endpoint];
    if (endpoint === 'list-organizations-admin') name = summary ? 'orgs-summary' : 'orgs';
    if (endpoint === 'list-super-admin-approvals') name = summary ? 'approvals-summary' : 'approvals';
    if (endpoint === 'list-support-tickets-admin') name = summary ? 'support-summary' : 'support';
    if (endpoint === 'list-super-admin-audit') name = facets ? 'audit-facets' : 'audit';
    if (endpoint === 'org-subscriptions-admin') name = url.searchParams.get('organizationId') ? 'billing-detail' : 'subscriptions';

    if (endpoint === 'list-organizations') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { organizations: [], isSuperAdmin: true } }) });
      return;
    }
    const emptyShapes = {
      'list-properties': { properties: [], total: 0 },
      'list-parkings': { parkings: [], total: 0 },
      'ai-platform-generation-overrides': { organizationId: '', organizationName: '', properties: [] },
      'ai-platform-credit-wallet': { organizationId: '', organizationName: '', balanceCredits: 0, ledger: [] },
      'org-subscriptions-admin': { organizations: [], total: 0 },
      'get-platform-host-settings': { announcements: [] },
    };
    try {
      const body = name ? await read(name) : { success: true, data: emptyShapes[endpoint] ?? {} };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    } catch {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
    }
  });
}


async function login(page) {
  // Password grant against the local stack, then seed the session exactly as supabase-js
  // stores it. Independent of the host login UI, which changes often.
  const response = await fetch('http://127.0.0.1:54321/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'seed-owner@example.com', password: 'seed-password' }),
  });
  if (!response.ok) throw new Error(`Local sign-in failed: ${response.status}`);
  const session = await response.json();
  const seeded = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
    token_type: session.token_type ?? 'bearer',
    user: session.user,
  };
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
    { key: 'sb-127-auth-token', value: seeded }
  );
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByRole('heading', { name: 'Overview' }).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(300);
}

async function diagnostics(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const overflowX = doc.scrollWidth - doc.clientWidth;

    const describe = (el) => {
      const cls = typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 3).join('.') : '';
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls ? `.${cls}` : ''}`;
    };

    // Text that is visibly clipped by its own box (not a deliberate scroll container).
    const clipped = [];
    for (const el of document.querySelectorAll('h1,h2,h3,h4,p,span,td,th,label,dd')) {
      const style = getComputedStyle(el);
      if (style.overflowX === 'auto' || style.overflowX === 'scroll') continue;
      if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
        const text = (el.textContent ?? '').trim().slice(0, 60);
        if (text) clipped.push({ el: describe(el), text, over: el.scrollWidth - el.clientWidth });
      }
    }

    const tiny = [];
    for (const el of document.querySelectorAll('button,a[href],input:not([type="hidden"]),select,textarea')) {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.opacity === '0') continue;
      if (rect.height < 40 || rect.width < 40) {
        tiny.push({
          el: describe(el),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
        });
      }
    }

    const unnamed = [];
    for (const el of document.querySelectorAll('button,a[href],input:not([type="hidden"]),select,textarea')) {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 1 && rect.height <= 1) continue;
      if (el.getAttribute('aria-hidden') === 'true') continue;
      const name =
        el.getAttribute('aria-label')?.trim() ||
        (el.labels ? Array.from(el.labels).map((l) => l.textContent?.trim()).join(' ').trim() : '') ||
        el.getAttribute('title')?.trim() ||
        el.textContent?.trim();
      if (!name) unnamed.push(describe(el));
    }

    const headings = Array.from(document.querySelectorAll('h1,h2,h3')).map((el) => ({
      level: el.tagName,
      text: (el.textContent ?? '').trim().slice(0, 80),
    }));

    const bodyText = (document.body.innerText || '').slice(0, 1500);

    return { overflowX, clipped: clipped.slice(0, 12), tiny: tiny.slice(0, 15), unnamed: unnamed.slice(0, 10), headings, bodyText };
  });
}

const browser = await chromium.launch({
  headless: !process.env.SLOWMO,
  slowMo: Number(process.env.SLOWMO ?? 0) || undefined,
});

await mkdir(SHOTS, { recursive: true });

for (const viewportName of viewportNames) {
  const context = await browser.newContext({
    viewport: { width: VIEWPORTS[viewportName].width, height: VIEWPORTS[viewportName].height },
    isMobile: VIEWPORTS[viewportName].isMobile,
    hasTouch: VIEWPORTS[viewportName].hasTouch,
    timezoneId: 'Asia/Manila',
    locale: 'en-PH',
    recordVideo: process.env.VIDEO ? { dir: path.join(HERE, 'video') } : undefined,
  });
  if (process.env.MOCK === '1') await installFixtureRoutes(context);
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on('response', (res) => {
    if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url().slice(0, 160)}`);
  });

  await login(page);

  // Resolve a real host id once so the detail page renders.
  const hostId = await page.evaluate(async (anonKey) => {
    const raw = Object.keys(localStorage).find((k) => k.includes('auth-token'));
    const session = raw ? JSON.parse(localStorage.getItem(raw) ?? '{}') : null;
    const token = session?.access_token;
    if (!token) return null;
    const res = await fetch('http://127.0.0.1:54321/functions/v1/list-hosts?limit=1', {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.hosts?.[0]?.id ?? json?.hosts?.[0]?.id ?? null;
  }, ANON_KEY);

  for (const [slug, route] of wanted) {
    const url = `${BASE}${route.replace('__HOST_ID__', hostId ?? 'unknown')}`;
    consoleErrors.length = 0;
    failedRequests.length = 0;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      // Wait for the page header, then let data settle. A fixed sleep alone captured the
      // loading splash whenever the machine was busy.
      await page.locator('main h1, h1').first().waitFor({ timeout: 45_000 }).catch(() => {});
      await page.waitForTimeout(process.env.MOCK === '1' ? 700 : 2200);
      const diag = await diagnostics(page);
      const file = path.join(SHOTS, `${viewportName}--${slug}.png`);
      await page.screenshot({ path: file, fullPage: false, animations: 'disabled' });
      findings.push({
        viewport: viewportName,
        slug,
        url,
        ...diag,
        consoleErrors: [...new Set(consoleErrors)],
        failedRequests: [...new Set(failedRequests)],
        shot: path.relative(HERE, file),
      });
      console.log(`[${viewportName}] ${slug} overflowX=${diag.overflowX} tiny=${diag.tiny.length} clipped=${diag.clipped.length} unnamed=${diag.unnamed.length}`);
    } catch (error) {
      console.log(`[${viewportName}] ${slug} FAILED: ${error.message.split('\n')[0]}`);
      findings.push({
        viewport: viewportName,
        slug,
        url,
        error: error.message.split('\n')[0],
        consoleErrors: [...new Set(consoleErrors)],
        failedRequests: [...new Set(failedRequests)],
      });
    }
  }

  if (process.env.VIDEO) {
    await context.close();
  } else {
    await context.close();
  }
}

await browser.close();
await writeFile(
  path.join(HERE, viewportNames.length === 3 ? 'diagnostics.json' : `diagnostics-${viewportNames.join('-')}.json`),
  JSON.stringify(findings, null, 2)
);
console.log(`\nWrote ${findings.length} page checks + diagnostics.json to ${SHOTS}`);
