#!/usr/bin/env bun
/**
 * Prove that Cloudflare Turnstile is enforced on the public write endpoints of a project.
 * Production readiness PR-001 / PR-068. Read-only: one POST with an empty body, no token.
 *
 *   bun scripts/dev/verify-captcha-enforcement.ts --url https://<ref>.supabase.co/functions/v1
 *   bun scripts/dev/verify-captcha-enforcement.ts                 # local stack
 *   bun scripts/dev/verify-captcha-enforcement.ts --url ... --expect any   # report only
 *
 * With `--anon-key <public anon key>` it also probes Supabase Auth (PR-002) with a bad-credential
 * password sign-in, which creates no account and sends no email. The anon key is public.
 *
 * Exit 0: every probe enforcing (or `--expect any`). Exit 1: one is not enforcing. Exit 2: inconclusive.
 */
import {
  AUTH_CAPTCHA_PROBE_BODY,
  AUTH_CAPTCHA_PROBE_PATH,
  CAPTCHA_PROBE_FUNCTION,
  classifyAuthCaptchaProbe,
  classifyCaptchaProbe,
  type CaptchaProbeVerdict,
} from '../lib/captchaProbe.ts';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const base = (arg('url') ?? 'http://127.0.0.1:54321/functions/v1').replace(/\/$/, '');
const expectAny = arg('expect') === 'any';

function report(label: string, target: string, verdict: CaptchaProbeVerdict) {
  console.log(`${label}\n  target   ${target}\n  verdict  ${verdict.kind}`);
  if (verdict.kind !== 'enforcing') console.log(`  detail   ${verdict.detail}`);
}

const edge = await fetch(`${base}/${CAPTCHA_PROBE_FUNCTION}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{}',
});
const verdicts: CaptchaProbeVerdict[] = [classifyCaptchaProbe(edge.status, await edge.text())];
report('Edge functions (Turnstile)', `${base}/${CAPTCHA_PROBE_FUNCTION}`, verdicts[0]);

const anonKey = arg('anon-key') ?? process.env.SUPABASE_ANON_KEY;
if (anonKey) {
  const authBase = base.replace(/\/functions\/v1$/, '');
  const auth = await fetch(`${authBase}${AUTH_CAPTCHA_PROBE_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: anonKey },
    body: JSON.stringify(AUTH_CAPTCHA_PROBE_BODY),
  });
  const verdict = classifyAuthCaptchaProbe(auth.status, await auth.text());
  verdicts.push(verdict);
  report('Supabase Auth (Attack Protection)', `${authBase}${AUTH_CAPTCHA_PROBE_PATH}`, verdict);
} else {
  console.log('Supabase Auth: skipped (pass --anon-key or set SUPABASE_ANON_KEY)');
}

if (verdicts.some((v) => v.kind === 'inconclusive')) process.exit(2);
if (verdicts.every((v) => v.kind === 'enforcing')) process.exit(0);
process.exit(expectAny ? 0 : 1);
