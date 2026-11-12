/**
 * Periodic verification of Meta page webhook subscriptions.
 */

import {
  auditMetaAppSubscriptions,
  expectedMetaWebhookCallbackUrl,
  fetchMetaAppSubscriptions,
  listConnectedFacebookMetaPagesForHealthcheck,
  reconcileMetaConnectionWebhook,
  requiredMetaAppFields,
  type MetaAppSubscriptionProblem,
} from './metaInboxWebhookHealth.ts';
import { verifyCronSecret } from './cronSecretGate.ts';
import { captureSentryException } from './sentry.ts';

export function verifyMetaInboxWebhookHealthcheckCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'META_INBOX_WEBHOOK_HEALTHCHECK_CRON_SECRET',
    headerName: 'x-meta-inbox-webhook-healthcheck-cron-secret',
  });
}

/**
 * App-level subscriptions gate delivery before any Page-level setting matters.
 *
 * A Page can look perfectly subscribed while the app itself points at an ngrok tunnel or is
 * switched off, so this runs first and reports separately.
 */
async function auditAppSubscription(): Promise<{
  problems: MetaAppSubscriptionProblem[];
  error: string | null;
}> {
  try {
    const subscriptions = await fetchMetaAppSubscriptions();
    const problems = auditMetaAppSubscriptions(subscriptions, {
      expectedCallbackUrl: expectedMetaWebhookCallbackUrl(),
      requiredFields: requiredMetaAppFields(),
    });
    if (problems.length > 0) {
      console.error('[meta-inbox-webhook-healthcheck] app subscription:', problems);
      await captureSentryException(new Error(problems.map((p) => p.detail).join(' ')), {
        logPrefix: 'meta-inbox-webhook-healthcheck',
        tags: { provider: 'meta', scope: 'app_subscription' },
        fingerprint: ['meta-inbox-webhook-healthcheck', 'app-subscription'],
        extra: { problems },
      });
    }
    return { problems, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'App subscription check failed';
    console.warn('[meta-inbox-webhook-healthcheck] app subscription check:', message);
    return { problems: [], error: message };
  }
}

export async function runMetaInboxWebhookHealthcheck(): Promise<Record<string, unknown>> {
  const appSubscription = await auditAppSubscription();
  const connections = await listConnectedFacebookMetaPagesForHealthcheck();
  let verified = 0;
  let resubscribed = 0;
  let failed = 0;

  for (const connection of connections) {
    const result = await reconcileMetaConnectionWebhook(connection);
    if (result.verified) {
      verified += 1;
      if (result.resubscribed) {
        resubscribed += 1;
      }
      continue;
    }
    failed += 1;
  }

  return {
    scanned: connections.length,
    verified,
    resubscribed,
    failed,
    appSubscription: {
      problems: appSubscription.problems.length,
      error: appSubscription.error,
      // Names only: the detail can carry a URL but never a token.
      reasons: appSubscription.problems.map((problem) => problem.reason),
    },
  };
}
