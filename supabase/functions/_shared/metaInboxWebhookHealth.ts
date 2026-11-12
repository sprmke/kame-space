/**
 * Meta webhook subscription verification + lightweight recovery.
 */

import {
  getMetaAppCredentials,
  META_GRAPH_BASE,
  META_WEBHOOK_SUBSCRIBED_FIELDS,
  metaInboxPublicBaseUrl,
} from './metaInboxConfig.ts';
import {
  getPageAccessToken,
  parseMetaGraphJson,
  subscribeMetaPageWebhooks,
} from './metaInboxGraphHttp.ts';
import { socialInboxDb } from './socialInboxDb.ts';
import type { SocialChannelConnectionRow } from './socialInboxTypes.ts';

const EXPECTED_WEBHOOK_FIELDS = META_WEBHOOK_SUBSCRIBED_FIELDS.split(',')
  .map((field) => field.trim())
  .filter(Boolean);

type MetaSubscribedAppRow = {
  id?: string;
  app_id?: string;
  subscribed_fields?: string[] | string | null;
};

function normalizeSubscribedFields(value: MetaSubscribedAppRow['subscribed_fields']): string[] {
  if (Array.isArray(value)) {
    return value.map((field) => String(field).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean);
  }
  return [];
}

function sameNullableScope(a?: string | null, b?: string | null): boolean {
  return (a ?? null) === (b ?? null);
}

async function updateWebhookState(
  connection: SocialChannelConnectionRow,
  patch: {
    webhook_subscribed_at?: string | null;
    webhook_last_verified_at: string;
    webhook_verify_attempts: number;
    token_expires_at?: string | null;
    error_message: string | null;
  }
): Promise<void> {
  const sb = socialInboxDb();
  let query = sb
    .from('social_channel_connections')
    .update({
      ...patch,
      updated_at: patch.webhook_last_verified_at,
    })
    .eq('organization_id', connection.organization_id)
    .eq('meta_page_id', connection.meta_page_id)
    .in('platform', ['facebook', 'instagram']);

  if (connection.property_id) {
    query = query.eq('property_id', connection.property_id).is('parking_id', null);
  } else if (connection.parking_id) {
    query = query.eq('parking_id', connection.parking_id).is('property_id', null);
  } else {
    query = query.is('property_id', null).is('parking_id', null);
  }

  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function verifyMetaPageWebhookSubscription(
  pageId: string,
  pageAccessToken: string
): Promise<{
  isSubscribed: boolean;
  missingFields: string[];
  subscribedFields: string[];
}> {
  const { appId } = getMetaAppCredentials();
  const url = new URL(`${META_GRAPH_BASE}/${pageId}/subscribed_apps`);
  url.searchParams.set('fields', 'id,app_id,subscribed_fields');
  url.searchParams.set('access_token', pageAccessToken);
  const res = await fetch(url.toString());
  const json = await parseMetaGraphJson(res);
  if (!res.ok) {
    throw new Error(
      (json.error as { message?: string } | undefined)?.message ?? 'Failed to verify Meta webhooks'
    );
  }

  const rows = Array.isArray(json.data) ? (json.data as MetaSubscribedAppRow[]) : [];
  const matchedApp =
    rows.find((row) => row.app_id === appId) ?? rows.find((row) => row.id === appId) ?? null;
  const subscribedFields = normalizeSubscribedFields(matchedApp?.subscribed_fields ?? null);
  const missingFields = EXPECTED_WEBHOOK_FIELDS.filter(
    (field) => !subscribedFields.includes(field)
  );

  return {
    isSubscribed: !!matchedApp && missingFields.length === 0,
    missingFields,
    subscribedFields,
  };
}

/** One app-level webhook subscription, as Meta reports it. */
export type MetaAppSubscription = {
  object: string;
  callbackUrl: string | null;
  active: boolean;
  fields: string[];
};

/** The URL Meta must call. Anything else means deliveries go somewhere we do not own. */
export function expectedMetaWebhookCallbackUrl(): string {
  return `${metaInboxPublicBaseUrl()}/functions/v1/meta-inbox-webhook`;
}

/**
 * Fields Meta must have enabled at the app level.
 *
 * App-level and Page-level subscriptions are separate settings, and the app-level one is
 * what actually gates delivery. A Page can look perfectly subscribed while the app itself is
 * pointing at an ngrok tunnel or is switched off.
 */
export function requiredMetaAppFields(): string[] {
  return EXPECTED_WEBHOOK_FIELDS;
}

export type MetaAppSubscriptionProblem = {
  object: string;
  reason: 'missing' | 'inactive' | 'wrong_callback_url' | 'missing_fields';
  detail: string;
};

/**
 * Compare Meta's app subscriptions against what this deployment needs.
 *
 * Pure, so the decision can be tested without Graph.
 */
export function auditMetaAppSubscriptions(
  subscriptions: MetaAppSubscription[],
  opts: { expectedCallbackUrl: string; requiredFields: string[] }
): MetaAppSubscriptionProblem[] {
  const problems: MetaAppSubscriptionProblem[] = [];
  const normalize = (url: string | null) => (url ?? '').trim().replace(/\/+$/, '');

  for (const object of ['page', 'instagram'] as const) {
    const row = subscriptions.find((entry) => entry.object === object);
    if (!row) {
      problems.push({ object, reason: 'missing', detail: `No app subscription for ${object}.` });
      continue;
    }
    if (!row.active) {
      problems.push({ object, reason: 'inactive', detail: `App subscription for ${object} is off.` });
    }
    if (normalize(row.callbackUrl) !== normalize(opts.expectedCallbackUrl)) {
      problems.push({
        object,
        reason: 'wrong_callback_url',
        detail: `App subscription for ${object} points at ${row.callbackUrl ?? '(none)'}.`,
      });
    }
    const missing = opts.requiredFields.filter((field) => !row.fields.includes(field));
    if (missing.length > 0) {
      problems.push({
        object,
        reason: 'missing_fields',
        detail: `App subscription for ${object} is missing ${missing.join(', ')}.`,
      });
    }
  }

  return problems;
}

/** Read the app-level webhook subscriptions. Needs the app access token, not a Page token. */
export async function fetchMetaAppSubscriptions(): Promise<MetaAppSubscription[]> {
  const { appId, appSecret } = getMetaAppCredentials();
  const url = new URL(`${META_GRAPH_BASE}/app/subscriptions`);
  url.searchParams.set('access_token', `${appId}|${appSecret}`);
  const res = await fetch(url.toString());
  const json = await parseMetaGraphJson(res);
  if (!res.ok) {
    throw new Error(
      (json.error as { message?: string } | undefined)?.message ??
        'Failed to read app subscriptions'
    );
  }

  const rows = Array.isArray(json.data) ? (json.data as Record<string, unknown>[]) : [];
  return rows.map((row) => ({
    object: String(row.object ?? ''),
    callbackUrl: typeof row.callback_url === 'string' ? row.callback_url : null,
    active: row.active !== false,
    fields: normalizeSubscribedFields((row.fields as string[] | string | null) ?? null),
  }));
}

type MetaTokenDebugResult = {
  valid: boolean;
  expiresAt: string | null;
  expiringSoon: boolean;
};

export async function debugMetaConnectionToken(
  pageAccessToken: string
): Promise<MetaTokenDebugResult | null> {
  try {
    const { appId, appSecret } = getMetaAppCredentials();
    const appAccessToken = `${appId}|${appSecret}`;
    const url = new URL(`${META_GRAPH_BASE}/debug_token`);
    url.searchParams.set('input_token', pageAccessToken);
    url.searchParams.set('access_token', appAccessToken);
    const res = await fetch(url.toString());
    const json = await parseMetaGraphJson(res);
    if (!res.ok) return null;
    const data = (json.data ?? {}) as {
      is_valid?: boolean;
      expires_at?: number;
    };
    const expiresAt =
      typeof data.expires_at === 'number' && data.expires_at > 0
        ? new Date(data.expires_at * 1000).toISOString()
        : null;
    const expiringSoon =
      typeof data.expires_at === 'number' &&
      data.expires_at > 0 &&
      data.expires_at * 1000 - Date.now() <= 1000 * 60 * 60 * 24 * 7;
    return {
      valid: data.is_valid !== false,
      expiresAt,
      expiringSoon,
    };
  } catch {
    return null;
  }
}

/** Hours of history reconciliation should re-scan after a webhook outage. */
export const META_OUTAGE_RECOVERY_HOURS = 72;

/**
 * Point reconciliation at the outage window.
 *
 * `meta_sync_state.watermark` only moves forward inside `meta_sync_finish`, so lowering it
 * once is a one-shot wide look-back rather than a permanently wider scan.
 */
async function requestMetaOutageRecovery(
  connection: SocialChannelConnectionRow
): Promise<void> {
  const sb = socialInboxDb();
  const since = new Date(Date.now() - META_OUTAGE_RECOVERY_HOURS * 3_600_000).toISOString();
  const { error } = await sb
    .from('meta_sync_state')
    .update({ next_run_at: new Date().toISOString(), watermark: since, updated_at: new Date().toISOString() })
    .eq('connection_id', connection.id);
  if (error) console.warn('[metaInboxWebhookHealth] outage recovery:', error.message);
}

export async function reconcileMetaConnectionWebhook(
  connection: SocialChannelConnectionRow
): Promise<{
  verified: boolean;
  resubscribed: boolean;
  missingFields: string[];
}> {
  if (!connection.meta_page_id) {
    throw new Error('Missing Meta page id');
  }

  const now = new Date().toISOString();
  const previousAttempts = connection.webhook_verify_attempts ?? 0;
  const pageAccessToken = await getPageAccessToken(connection);

  try {
    const [tokenDebug, initialVerification] = await Promise.all([
      debugMetaConnectionToken(pageAccessToken),
      verifyMetaPageWebhookSubscription(connection.meta_page_id, pageAccessToken),
    ]);

    let verification = initialVerification;
    let resubscribed = false;

    if (!verification.isSubscribed) {
      await subscribeMetaPageWebhooks(connection.meta_page_id, pageAccessToken);
      verification = await verifyMetaPageWebhookSubscription(
        connection.meta_page_id,
        pageAccessToken
      );
      resubscribed = true;
    }

    const tokenInvalid =
      tokenDebug !== null && !tokenDebug.valid
        ? 'Meta access token is no longer valid - reconnect Meta.'
        : null;
    const tokenExpiringSoon =
      tokenDebug !== null && tokenDebug.valid && tokenDebug.expiringSoon
        ? 'Meta access token is expiring soon - reconnect Meta before replies start failing.'
        : null;

    if (!verification.isSubscribed) {
      const missingLabel =
        verification.missingFields.length > 0
          ? ` Missing fields: ${verification.missingFields.join(', ')}.`
          : '';
      const attempts = previousAttempts + 1;
      const errorParts = [`Webhook subscription still missing after retry.${missingLabel}`].filter(
        Boolean
      );
      await updateWebhookState(connection, {
        webhook_subscribed_at: connection.webhook_subscribed_at ?? null,
        webhook_last_verified_at: now,
        webhook_verify_attempts: attempts,
        token_expires_at: tokenDebug?.expiresAt ?? connection.token_expires_at ?? null,
        error_message: [...errorParts, tokenInvalid, tokenExpiringSoon].filter(Boolean).join(' '),
      });
      return {
        verified: false,
        resubscribed,
        missingFields: verification.missingFields,
      };
    }

    await updateWebhookState(connection, {
      webhook_subscribed_at: now,
      webhook_last_verified_at: now,
      webhook_verify_attempts: 0,
      token_expires_at: tokenDebug?.expiresAt ?? connection.token_expires_at ?? null,
      error_message: [tokenInvalid, tokenExpiringSoon].filter(Boolean).join(' ') || null,
    });

    // A re-subscribe means deliveries were missing for a while, and Meta never resends them.
    // Ask reconciliation for a 72-hour look-back now; the next successful run lifts the
    // watermark back to the newest thread on its own.
    if (resubscribed) {
      await requestMetaOutageRecovery(connection);
    }

    return {
      verified: true,
      resubscribed,
      missingFields: [],
    };
  } catch (error) {
    const attempts = previousAttempts + 1;
    const message = error instanceof Error ? error.message : 'Webhook verification failed';
    await updateWebhookState(connection, {
      webhook_subscribed_at: connection.webhook_subscribed_at ?? null,
      webhook_last_verified_at: now,
      webhook_verify_attempts: attempts,
      token_expires_at: connection.token_expires_at ?? null,
      error_message: `Webhook verification failed: ${message}`,
    });
    return { verified: false, resubscribed: false, missingFields: [] };
  }
}

export async function listConnectedFacebookMetaPagesForHealthcheck(): Promise<
  SocialChannelConnectionRow[]
> {
  const sb = socialInboxDb();
  const { data, error } = await sb
    .from('social_channel_connections')
    .select('*')
    .eq('platform', 'facebook')
    .eq('status', 'connected')
    .not('meta_page_id', 'is', null)
    .not('encrypted_access_token', 'is', null)
    .order('updated_at', { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as SocialChannelConnectionRow[];
  const deduped: SocialChannelConnectionRow[] = [];
  for (const row of rows) {
    const seen = deduped.some(
      (existing) =>
        existing.organization_id === row.organization_id &&
        existing.meta_page_id === row.meta_page_id &&
        sameNullableScope(existing.property_id, row.property_id) &&
        sameNullableScope(existing.parking_id, row.parking_id)
    );
    if (!seen) deduped.push(row);
  }
  return deduped;
}
