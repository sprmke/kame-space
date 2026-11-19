/**
 * Serve a production build with the real Content-Security-Policy and collect violations.
 *
 * Production readiness PR-012. `ui/vercel.json` is the one source of the policy. This plugin
 * applies it to `vite preview` so the mocked E2E suite can run against a production build
 * under the exact policy Vercel sends, and every violation the browser reports is written to
 * an ndjson file that `scripts/dev/assert-no-csp-violations.mjs` turns into a failing gate.
 *
 * Opt-in (`CSP_PREVIEW=1`), preview only. It never runs in a deploy build.
 *
 * Test-only additions, kept to the minimum the harness needs and listed in
 * `CSP_PREVIEW_EXTRA_SOURCES` so the difference from production is explicit:
 *   - `connect-src`: the local Supabase origin the E2E build points at.
 *   - `report-uri`: where violation reports land. Production sends none.
 */

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { Plugin } from 'vite';

export const CSP_REPORT_PATH = '/__csp-report';

export const CSP_PREVIEW_EXTRA_SOURCES: Record<string, string[]> = {
  'connect-src': ['http://127.0.0.1:54321', 'ws://127.0.0.1:54321'],
};

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

/** The enforcing or report-only policy for `/(.*)` from a parsed `vercel.json`. */
export function readCspFromVercelConfig(config: { headers?: HeaderRule[] }): string {
  for (const rule of config.headers ?? []) {
    if (rule.source !== '/(.*)') continue;
    for (const header of rule.headers) {
      if (/^content-security-policy(-report-only)?$/i.test(header.key)) return header.value;
    }
  }
  throw new Error('No Content-Security-Policy header for "/(.*)" in ui/vercel.json');
}

/**
 * Every header Vercel sends for `/(.*)` except the policy itself and transport headers that
 * mean nothing on `http://127.0.0.1`. `Permissions-Policy` matters here: a `camera=()` entry
 * blocks `getUserMedia` for the whole app, which a test on the dev server would never see.
 */
export function readOtherSecurityHeaders(config: { headers?: HeaderRule[] }): [string, string][] {
  const skip = /^(content-security-policy(-report-only)?|strict-transport-security)$/i;
  const out: [string, string][] = [];
  for (const rule of config.headers ?? []) {
    if (rule.source !== '/(.*)') continue;
    for (const header of rule.headers) {
      if (!skip.test(header.key)) out.push([header.key, header.value]);
    }
  }
  return out;
}

/** Append `extra` sources to existing directives and add `report-uri`. Pure, so it is tested. */
export function buildPreviewPolicy(
  policy: string,
  extra: Record<string, string[]> = CSP_PREVIEW_EXTRA_SOURCES,
  reportPath: string = CSP_REPORT_PATH
): string {
  const directives = policy
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !part.startsWith('report-uri'));
  const patched = directives.map((directive) => {
    const [name] = directive.split(/\s+/);
    const add = extra[name];
    return add ? `${directive} ${add.join(' ')}` : directive;
  });
  patched.push(`report-uri ${reportPath}`);
  return patched.join('; ');
}

export function cspPreview(options: { vercelConfigPath: string; reportFile: string }): Plugin {
  return {
    name: 'csp-preview',
    apply: 'serve',
    configurePreviewServer(server) {
      if (process.env.CSP_PREVIEW !== '1') return;
      const config = JSON.parse(readFileSync(options.vercelConfigPath, 'utf8'));
      const policy = buildPreviewPolicy(readCspFromVercelConfig(config));
      const otherHeaders = readOtherSecurityHeaders(config);
      const reportFile = resolve(options.reportFile);
      mkdirSync(dirname(reportFile), { recursive: true });

      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] === CSP_REPORT_PATH && req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (chunk) => chunks.push(chunk as Buffer));
          req.on('end', () => {
            try {
              const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              const report = body['csp-report'] ?? body;
              appendFileSync(
                reportFile,
                `${JSON.stringify({
                  directive: report['effective-directive'] ?? report['violated-directive'],
                  blocked: report['blocked-uri'],
                  document: report['document-uri'],
                  source: report['source-file'],
                  disposition: report.disposition,
                })}\n`
              );
            } catch {
              appendFileSync(
                reportFile,
                `${JSON.stringify({ directive: 'unparseable-report' })}\n`
              );
            }
            res.statusCode = 204;
            res.end();
          });
          return;
        }
        res.setHeader('Content-Security-Policy', policy);
        for (const [key, value] of otherHeaders) res.setHeader(key, value);
        next();
      });
    },
  };
}
