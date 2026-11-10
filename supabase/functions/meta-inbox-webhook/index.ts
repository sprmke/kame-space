/**
 * Meta webhook receiver — verify, enqueue, acknowledge, then process.
 *
 * Meta wants a 200 within five seconds and retries a failed batch. Everything that can be
 * slow (connection lookup, Graph profile call, notifications, the AI auto-reply) now runs
 * after the response, from the outbox. The static imports are deliberately small so a cold
 * start stays cheap.
 */

import { corsHeaders } from '../_shared/cors.ts';
import { runAfterResponse } from '../_shared/backgroundTask.ts';
import { metaWebhookVerifyToken } from '../_shared/metaInboxConfig.ts';
import { verifyMetaWebhookSignatureAsync } from '../_shared/metaInboxGraph.ts';
import { jsonError } from '../_shared/httpResponse.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { captureSentryException } from '../_shared/sentry.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { socialInboxDb } from '../_shared/socialInboxDb.ts';
import {
  flattenMetaWebhookPayload,
  platformFromMetaObject,
} from '../_shared/metaInboxEvents.ts';

// Public by contract: Meta calls this, and the signature check below is the boundary.
servePublic('meta-inbox-webhook', async (req) => {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token === metaWebhookVerifyToken() && challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const rawBody = await req.text();
  const signature = req.headers.get('X-Hub-Signature-256');
  const valid = await verifyMetaWebhookSignatureAsync(rawBody, signature);
  if (!valid) {
    const limited = await rateLimitGate(req, {
      scope: 'meta-inbox-webhook-bad-signature',
      identity: identityFromRequest(req),
      limit: 30,
      windowSec: 60,
    });
    if (limited) return limited;
    return jsonError(req, 'Invalid signature', 403);
  }

  let payload: { object?: string; entry?: unknown[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonError(req, 'Invalid JSON', 400);
  }

  const platform = platformFromMetaObject(payload.object);
  if (!platform) {
    // Not a messaging object. Acknowledge so Meta does not retry, and record nothing.
    console.warn('[meta-inbox-webhook] unsupported object:', payload.object ?? '(none)');
    return jsonOk(req);
  }

  const { events, skipped } = flattenMetaWebhookPayload(payload, platform);
  if (skipped > 0) {
    console.warn('[meta-inbox-webhook] skipped', skipped, 'unclassified entries');
  }
  if (!events.length) return jsonOk(req);

  let newIds: string[] = [];
  try {
    const sb = socialInboxDb();
    const { data, error } = await sb.rpc('meta_webhook_enqueue', {
      p_events: events.map((event) => ({
        object: event.object,
        platform: event.platform,
        entry_id: event.entryId,
        channel: event.channel,
        event_type: event.eventType,
        event_key: event.eventKey,
        event_time: event.eventTime,
        payload: event.payload,
      })),
    });
    if (error) throw new Error(error.message);
    newIds = Array.isArray(data) ? (data as string[]) : [];
  } catch (error) {
    // The enqueue is the one write that cannot be deferred: if it fails, Meta must retry or
    // the whole batch is lost. Safe to repeat, because the insert is unique on event_key.
    console.error('[meta-inbox-webhook] enqueue failed:', error);
    await captureSentryException(error, {
      logPrefix: 'meta-inbox-webhook',
      url: req.url,
      method: req.method,
      tags: { provider: 'meta', platform, stage: 'enqueue' },
      fingerprint: ['meta-inbox-webhook', 'enqueue'],
    });
    return jsonError(req, 'Temporary failure, retry', 500);
  }

  if (newIds.length) {
    // After the response: the processor imports AI, Telegram and notifications lazily, so a
    // cold start on the webhook path stays small.
    await runAfterResponse('meta-inbox-webhook process', async () => {
      const { processMetaWebhookBatch } = await import('../_shared/metaInboxProcessor.ts');
      await processMetaWebhookBatch();
    });
  }

  return jsonOk(req);
});

function jsonOk(req: Request): Response {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}
