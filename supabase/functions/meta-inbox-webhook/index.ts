/**
 * Meta webhook receiver — GET verify, POST messaging + read receipts.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { runAfterResponse } from '../_shared/backgroundTask.ts';
import { maybeAutoReplyToInboundDm } from '../_shared/metaInboxAutoReply.ts';
import { metaWebhookVerifyToken } from '../_shared/metaInboxConfig.ts';
import {
  handleMetaMessagingWebhook,
  handleMetaReadReceipt,
} from '../_shared/metaInboxWebhookHandler.ts';
import { verifyMetaWebhookSignatureAsync } from '../_shared/metaInboxGraph.ts';
import { jsonError } from '../_shared/httpResponse.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { captureSentryException } from '../_shared/sentry.ts';
import { withEdgeErrorCapture } from '../_shared/serveEdge.ts';
import { buildDmThreadId } from '../_shared/socialInboxService.ts';
import {
  isTransientMetaWebhookError,
  platformFromMetaObject,
  type MetaMessagingPlatform,
} from '../_shared/metaInboxEvents.ts';

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

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

  let payload: {
    object?: string;
    entry?: Array<{
      id: string;
      messaging?: unknown[];
      changes?: unknown[];
    }>;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonError(req, 'Invalid JSON', 400);
  }

  const platform = platformFromMetaObject(payload.object);
  if (!platform) {
    // Not a messaging object. Acknowledge so Meta does not retry, and record nothing.
    console.warn('[meta-inbox-webhook] unsupported object:', payload.object ?? '(none)');
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  }

  let infrastructureFailed = false;

  for (const entry of payload.entry ?? []) {
    const pageOrIgId = entry.id;

    for (const raw of (entry.messaging ?? []) as Record<string, unknown>[]) {
      // One bad event must not fail the batch. Meta retries the whole batch otherwise, and
      // a single poison event would keep the healthy ones from ever landing.
      try {
        await processMetaMessagingEvent(pageOrIgId, raw, platform);
      } catch (error) {
        // A database or network failure is not a bad event. Every write on this path is
        // idempotent, so let Meta retry the batch instead of acknowledging lost messages.
        if (isTransientMetaWebhookError(error)) infrastructureFailed = true;
        console.error('[meta-inbox-webhook] event failed:', error);
        await captureSentryException(error, {
          logPrefix: 'meta-inbox-webhook',
          url: req.url,
          method: req.method,
          tags: { provider: 'meta', platform },
          fingerprint: ['meta-inbox-webhook', platform],
        });
      }
    }

    void entry.changes;
  }

  if (infrastructureFailed) {
    return jsonError(req, 'Temporary failure, retry', 500);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
};

async function processMetaMessagingEvent(
  pageOrIgId: string,
  messaging: Record<string, unknown>,
  platform: MetaMessagingPlatform
): Promise<void> {
  if (messaging.read) {
    const senderId = (messaging.sender as { id?: string })?.id ?? '';
    const watermark = typeof messaging.watermark === 'number' ? messaging.watermark : undefined;
    await handleMetaReadReceipt(pageOrIgId, senderId, platform, watermark);
    return;
  }

  if (!messaging.message) return;

  const result = await handleMetaMessagingWebhook(pageOrIgId, messaging as never, platform);
  if (!result.inserted || result.isOutbound || !result.guestId || !result.organizationId) return;

  const inboundMid = (messaging.message as { mid?: string }).mid ?? '';
  const orgId = result.organizationId;
  const guestId = result.guestId;

  // After the 200 — Meta expects a fast ack; the AI call must not hold it open.
  await runAfterResponse('meta-inbox-webhook auto-reply', () =>
    maybeAutoReplyToInboundDm(orgId, buildDmThreadId(platform, guestId), platform, inboundMid)
  );
}

serve(withEdgeErrorCapture('meta-inbox-webhook', handler));
