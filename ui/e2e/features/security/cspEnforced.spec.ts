import { expect, test, type Page } from '@playwright/test';

/**
 * Content-Security-Policy contract (production readiness PR-012).
 *
 * Runs only in the `csp` Playwright project (`bun run test:e2e:csp`), which serves a production
 * build with the exact headers from `ui/vercel.json`. Two halves:
 *
 *  - Allowed: every kind of resource the app really loads must NOT be blocked. Each probe
 *    carries a unique `selftest=` marker so an unrelated violation cannot hide a real one.
 *  - Blocked: the classic injection routes must still be refused, so loosening the policy to
 *    make something work cannot pass silently.
 *
 * The page lives under `/__csp-selftest`; the violation gate ignores reports from that path
 * because the blocked half is expected to be reported.
 */

const CSP_RUN = process.env.PLAYWRIGHT_CSP === '1';
const SELFTEST_PATH = '/__csp-selftest';

type Violation = { directive: string; blocked: string };

async function openSelftestPage(page: Page) {
  // Answer every cross-origin request locally so the probe never touches the real network.
  await page.context().route(
    (url) => url.origin !== new URL(page.url() || 'http://127.0.0.1').origin,
    (route) => {
      const url = route.request().url();
      if (new URL(url).origin === 'http://127.0.0.1:4173') return route.fallback();
      const contentType = /\.pdf|storage\/v1\/object/.test(url)
        ? 'application/pdf'
        : /\.js|\/api\.js|maps\/api\/js/.test(url)
          ? 'text/javascript'
          : /css2/.test(url)
            ? 'text/css'
            : 'text/plain';
      return route.fulfill({
        status: 200,
        contentType,
        headers: { 'access-control-allow-origin': '*' },
        body: contentType === 'application/pdf' ? '%PDF-1.4\n%%EOF' : '',
      });
    }
  );
  const response = await page.goto(SELFTEST_PATH);
  await page.evaluate(() => {
    const w = window as unknown as { __violations: { directive: string; blocked: string }[] };
    w.__violations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      w.__violations.push({ directive: event.effectiveDirective, blocked: event.blockedURI });
    });
  });
  return response!;
}

/**
 * Violation events are queued in the order the browser refuses each request, so a blocked
 * sentinel inserted last arrives after every earlier probe's event. Waiting on it replaces a
 * fixed sleep with a deterministic signal.
 */
async function violations(page: Page): Promise<Violation[]> {
  await page.evaluate(() => {
    const sentinel = document.createElement('script');
    sentinel.src = 'https://evil.example/sentinel.js?selftest=sentinel';
    document.body.appendChild(sentinel);
  });
  await page.waitForFunction(() =>
    (window as unknown as { __violations: { blocked: string }[] }).__violations.some((v) =>
      v.blocked.includes('selftest=sentinel')
    )
  );
  const all = await page.evaluate(
    () =>
      (window as unknown as { __violations: { directive: string; blocked: string }[] }).__violations
  );
  return all.filter((v) => !v.blocked.includes('selftest=sentinel'));
}

function forMarker(all: Violation[], marker: string): Violation[] {
  return all.filter((v) => v.blocked.includes(marker));
}

test.describe('@ci content security policy', () => {
  test.skip(!CSP_RUN, 'Runs in the csp project only (PLAYWRIGHT_CSP=1).');

  test('the policy is enforcing, not report-only, and keeps the camera available', async ({
    page,
  }) => {
    const response = await openSelftestPage(page);
    const headers = response.headers();
    expect(headers['content-security-policy']).toBeTruthy();
    expect(headers['content-security-policy-report-only']).toBeUndefined();
    expect(headers['content-security-policy']).toContain("frame-ancestors 'self'");
    expect(headers['permissions-policy']).toMatch(/camera=\(self\)/);
  });

  test('every resource kind the app uses is allowed', async ({ page }) => {
    await openSelftestPage(page);

    await page.evaluate(async () => {
      const add = (tag: string, attrs: Record<string, string>) => {
        const el = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        document.body.appendChild(el);
        return el;
      };

      // frames: signed Supabase document, blob PDF, Maps embeds, Turnstile
      add('iframe', {
        src: 'https://selftest.supabase.co/storage/v1/object/sign/d/r.pdf?selftest=frame-supabase',
      });
      add('iframe', { src: 'https://www.google.com/maps/embed?pb=1&selftest=frame-google' });
      add('iframe', { src: 'https://maps.google.com/maps?q=1&selftest=frame-maps' });
      add('iframe', { src: 'https://www.openstreetmap.org/export/embed.html?selftest=frame-osm' });
      add('iframe', {
        src: 'https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b?selftest=frame-turnstile',
      });

      // scripts the app loads on demand
      add('script', {
        src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?selftest=script-turnstile',
      });
      add('script', { src: 'https://maps.googleapis.com/maps/api/js?selftest=script-maps' });
      add('script', {
        src: 'https://maps.gstatic.com/maps-api-v3/api/js/x.js?selftest=script-gstatic',
      });
      add('script', {
        src: 'https://us-assets.i.posthog.com/static/exception-autocapture.js?selftest=script-posthog',
      });

      // images and media
      add('img', { src: 'https://images.unsplash.com/photo.png?selftest=img-https' });
      add('img', { src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=#selftest=img-data' });
      add('img', {
        src: `${URL.createObjectURL(new Blob(['x'], { type: 'image/png' }))}#selftest=img-blob`,
      });
      const audio = new Audio('https://cdn.example.com/clip.mp3?selftest=media-https');
      audio.preload = 'metadata';

      // stylesheets and inline style (Tailwind, Radix and Konva set style attributes)
      add('link', {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter&selftest=css-fonts',
      });
      add('div', { style: 'color: red' });
      const style = document.createElement('style');
      style.textContent = '.selftest{color:red}';
      document.head.appendChild(style);

      // fetch / XHR / websocket targets
      const calls = [
        'https://selftest.supabase.co/rest/v1/x?selftest=connect-supabase',
        'https://us.i.posthog.com/e/?selftest=connect-posthog',
        'https://us-assets.i.posthog.com/array/x/config?selftest=connect-posthog-assets',
        'https://maps.googleapis.com/maps/api/place?selftest=connect-maps',
        'https://staticmap.openstreetmap.de/staticmap.php?selftest=connect-osm',
        'https://o1.ingest.sentry.io/api/1/envelope/?selftest=connect-sentry',
        'https://fonts.googleapis.com/css2?family=Inter&selftest=connect-fonts-css',
        'https://fonts.gstatic.com/s/inter/v1/x.woff2?selftest=connect-fonts-file',
      ];
      await Promise.allSettled(calls.map((url) => fetch(url, { mode: 'no-cors' })));
      try {
        const ws = new WebSocket(
          'wss://selftest.supabase.co/realtime/v1/websocket?selftest=connect-ws'
        );
        ws.close();
      } catch {
        /* a refused handshake is fine, only a CSP report matters */
      }

      // workers (Polotno, Konva, the video editor)
      new Worker(
        URL.createObjectURL(new Blob(['self.onmessage=()=>{}'], { type: 'text/javascript' }))
      );
    });

    const all = await violations(page);
    const markers = [
      'frame-supabase',
      'frame-google',
      'frame-maps',
      'frame-osm',
      'frame-turnstile',
      'script-turnstile',
      'script-maps',
      'script-gstatic',
      'script-posthog',
      'img-https',
      'img-data',
      'img-blob',
      'media-https',
      'css-fonts',
      'connect-supabase',
      'connect-posthog',
      'connect-posthog-assets',
      'connect-maps',
      'connect-osm',
      'connect-sentry',
      'connect-fonts-css',
      'connect-fonts-file',
      'connect-ws',
    ];
    const blocked = markers.flatMap((marker) =>
      forMarker(all, marker).map((v) => ({ marker, ...v }))
    );
    expect(blocked, 'these resources were blocked by the policy').toEqual([]);
    // data: and blob: sources are reported by scheme only, so a blocked one has no marker.
    expect(all.filter((v) => v.blocked === 'data' || v.blocked === 'blob')).toEqual([]);
    // inline styles and the worker carry no URL, so they are checked by directive.
    expect(
      all.filter((v) =>
        ['style-src', 'style-src-attr', 'style-src-elem', 'worker-src'].includes(v.directive)
      )
    ).toEqual([]);
  });

  test('injection routes are still refused', async ({ page }) => {
    await openSelftestPage(page);

    await page.evaluate(() => {
      const add = (tag: string, attrs: Record<string, string> = {}, text = '') => {
        const el = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        if (text) el.textContent = text;
        document.body.appendChild(el);
        return el;
      };
      add('script', {}, 'window.__inlineRan = true');
      add('script', { src: 'https://evil.example/x.js?selftest=evil-script' });
      add('iframe', { src: 'https://evil.example/?selftest=evil-frame' });
      add('embed', {
        src: 'https://evil.example/x.swf?selftest=evil-object',
        type: 'application/x-shockwave-flash',
      });
      void fetch('https://evil.example/?selftest=evil-connect', { mode: 'no-cors' }).catch(
        () => undefined
      );
      // eval runs from a real same-origin script below; `page.evaluate` itself is exempt.
      const form = add('form', {
        action: 'https://evil.example/?selftest=evil-form',
        method: 'post',
      });
      const submit = document.createElement('button');
      submit.type = 'submit';
      form.appendChild(submit);
      form.addEventListener('submit', (event) => event.preventDefault(), { once: true });
      submit.click();
      const base = document.createElement('base');
      base.href = 'https://evil.example/';
      document.head.appendChild(base);
    });

    // A same-origin script is allowed to run; it tries eval, which must be refused.
    await page.context().route('**/__csp-selftest-eval.js', (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: 'try { eval("window.__evalRan = true"); } catch (error) { window.__evalBlocked = true; }',
      })
    );
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.src = '/__csp-selftest-eval.js';
      document.body.appendChild(script);
    });
    await page.waitForFunction(() => {
      const w = window as unknown as { __evalRan?: boolean; __evalBlocked?: boolean };
      return w.__evalRan === true || w.__evalBlocked === true;
    });

    const all = await violations(page);
    const ran = await page.evaluate(() => {
      const w = window as unknown as {
        __inlineRan?: boolean;
        __evalRan?: boolean;
        __evalBlocked?: boolean;
      };
      return {
        inline: w.__inlineRan === true,
        eval: w.__evalRan === true,
        blocked: w.__evalBlocked === true,
      };
    });
    expect(ran).toEqual({ inline: false, eval: false, blocked: true });

    const directives = new Set(all.map((v) => v.directive));
    for (const expected of [
      'script-src',
      'script-src-elem',
      'frame-src',
      'object-src',
      'connect-src',
      'base-uri',
    ]) {
      expect(directives.has(expected), `${expected} should have refused an injected resource`).toBe(
        true
      );
    }
    // Chrome reports some blocked URLs without their query string, so match on directive and origin.
    const refused = (directive: string) =>
      all.some(
        (v) => v.directive.startsWith(directive) && v.blocked.startsWith('https://evil.example')
      );
    expect(refused('script-src'), 'foreign script').toBe(true);
    expect(refused('frame-src'), 'foreign frame').toBe(true);
    expect(refused('connect-src'), 'foreign fetch').toBe(true);
  });
});
