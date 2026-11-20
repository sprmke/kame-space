/**
 * ops-alert-ingest — HMAC-signed entry point for GitHub Actions, probes and the Sentry relay.
 *
 * POST /functions/v1/ops-alert-ingest
 * Headers: X-Ops-Signature: sha256=<hex hmac of the raw body>
 * Body: { key, tier, source, title, summary?, links?, context?, drill? }
 *
 * The dispatcher (`_shared/ops/opsAlert.ts`) owns dedupe, throttling, the storm guard and
 * channel delivery. This endpoint only authenticates and validates. Operator setup:
 * `OPS_ALERT_INGEST_SECRET` + `TELEGRAM_OPS_BOT_TOKEN` / `TELEGRAM_OPS_CHAT_ID` /
 * `OPS_ALERT_EMAILS`, and `OPS_ALERTS_ENABLED=true` in production.
 */

import { jsonError, jsonResponse, requireHttpMethod } from '../_shared/httpResponse.ts';
import { raiseOpsAlert, type OpsAlertSource, type OpsAlertTier } from '../_shared/ops/opsAlert.ts';
import { verifyOpsAlertSignature } from '../_shared/ops/opsAlertIngest.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { servePublic } from '../_shared/serveEdge.ts';

const TIERS: OpsAlertTier[] = ['p0', 'p1', 'p2', 'p3', 'drill'];
const SOURCES: OpsAlertSource[] = [
  'edge',
  'journey',
  'job',
  'ci',
  'deploy',
  'probe',
  'sentry',
  'log_scan',
  'vendor',
];

function asString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

servePublic('ops-alert-ingest', async (req) => {
  requireHttpMethod(req, 'POST');

  const secret = Deno.env.get('OPS_ALERT_INGEST_SECRET')?.trim();
  if (!secret) return jsonError(req, 'Alert ingest not configured', 503);

  // Read the raw body once: the signature covers the exact bytes, not a re-serialization.
  const rawBody = await req.text();
  const signature = req.headers.get('x-ops-signature');
  if (!(await verifyOpsAlertSignature(rawBody, signature, secret))) {
    return jsonError(req, 'Invalid signature', 401);
  }

  // Only a valid signature reaches the limiter, so an unauthenticated flood cannot exhaust a
  // real source's budget. A burst of real alerts is still capped and the storm guard compresses
  // what gets delivered.
  const limited = await rateLimitGate(req, {
    scope: 'ops-alert-ingest',
    identity: identityFromRequest(req),
    limit: 60,
    windowSec: 60,
  });
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return jsonError(req, 'Invalid JSON', 400);
  }

  const drill = body.drill === true;
  const key = asString(body.key, 120);
  const title = asString(body.title, 200);
  const tier = drill ? 'drill' : (asString(body.tier, 8) as OpsAlertTier | null);
  const source = (asString(body.source, 20) as OpsAlertSource | null) ?? 'probe';

  if (!key || !title) return jsonError(req, 'key and title are required', 400);
  if (!tier || !TIERS.includes(tier)) return jsonError(req, 'invalid tier', 400);
  if (!SOURCES.includes(source)) return jsonError(req, 'invalid source', 400);

  const rawLinks =
    body.links && typeof body.links === 'object' ? (body.links as Record<string, unknown>) : {};
  const links: Record<string, string> = {};
  for (const [label, url] of Object.entries(rawLinks).slice(0, 4)) {
    if (typeof url === 'string' && /^https:\/\//i.test(url)) links[label.slice(0, 24)] = url;
  }

  const context =
    body.context && typeof body.context === 'object'
      ? (body.context as Record<string, unknown>)
      : {};

  const outcome = await raiseOpsAlert({
    key,
    tier,
    source,
    title,
    summary: asString(body.summary, 500),
    links,
    context,
  });

  return jsonResponse(req, { accepted: true, ...outcome }, 202);
});
