/**
 * paymongo-webhook — Verify signature, dedupe, delegate to subscriptionOrchestrator.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import {
  claimPaymongoEvent,
  completePaymongoEvent,
  releasePaymongoEvent,
} from '../_shared/paymongoEventDedupe.ts';
import { verifyPaymongoWebhookSignature } from '../_shared/paymongoWebhookVerify.ts';
import {
  handlePaymongoWebhookEvent,
  paymongoLivemodeFromEnv,
} from '../_shared/subscriptionOrchestrator.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { captureSentryException, captureSentryMessage } from '../_shared/sentry.ts';

servePublic('paymongo-webhook', async (req) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const secret = Deno.env.get('PAYMONGO_WEBHOOK_SECRET')?.trim();
  if (!secret) {
    console.error('[paymongo-webhook] PAYMONGO_WEBHOOK_SECRET not configured');
    return jsonError(req, 'Webhook not configured', 503);
  }

  const rawBody = await req.text();
  const signature = req.headers.get('Paymongo-Signature') ?? req.headers.get('paymongo-signature');
  if (!signature) return jsonError(req, 'Missing signature', 400);

  const valid = await verifyPaymongoWebhookSignature(rawBody, signature, secret, {
    livemode: paymongoLivemodeFromEnv(),
  });
  if (!valid) {
    const limited = await rateLimitGate(req, {
      scope: 'paymongo-webhook-bad-signature',
      identity: identityFromRequest(req),
      limit: 30,
      windowSec: 60,
    });
    if (limited) return limited;
    // Could be an attack or a rotated secret. A warning, tagged by provider, so a spike is
    // visible without every probe counting as an incident.
    await captureSentryMessage('paymongo webhook signature rejected', {
      logPrefix: 'paymongo-webhook',
      level: 'warning',
      tags: { provider: 'paymongo', webhook: 'signature' },
      fingerprint: ['webhook_signature', 'paymongo'],
    });
    return jsonError(req, 'Invalid signature', 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return jsonError(req, 'Invalid JSON', 400);
  }

  const data = payload.data as Record<string, unknown> | undefined;
  const attributes = data?.attributes as Record<string, unknown> | undefined;
  const eventId = typeof data?.id === 'string' ? data.id : null;
  const eventType = typeof attributes?.type === 'string' ? attributes.type : null;

  if (!eventId || !eventType) {
    return jsonError(req, 'Malformed webhook payload', 400);
  }

  const supabase = createServiceClient();
  const claim = await claimPaymongoEvent(supabase, eventId, eventType);
  if (claim === 'duplicate') {
    return jsonSuccess(req, { duplicate: true });
  }

  try {
    const result = await handlePaymongoWebhookEvent(eventType, payload);
    await completePaymongoEvent(supabase, eventId);
    return jsonSuccess(req, { eventType, ...result });
  } catch (err) {
    // Release the claim so PayMongo's retry is processed instead of answered as a duplicate.
    await releasePaymongoEvent(supabase, eventId);
    console.error('[paymongo-webhook]', err);
    // Captured here, inside the dedupe guard and after the event was accepted: this handler
    // answers its own 500, so the shared choke point never sees the throw. A failed payment
    // webhook is the highest-value fault in the system.
    await captureSentryException(err, {
      logPrefix: 'paymongo-webhook',
      requestId: req.headers.get('x-request-id') ?? undefined,
      method: req.method,
      tags: { provider: 'paymongo', webhook: 'processing', event_type: eventType },
      fingerprint: ['webhook', 'paymongo', 'processing'],
      extra: { eventType },
    });
    return jsonError(req, (err as Error).message, 500);
  }
});
