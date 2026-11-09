/**
 * Marketing publish scheduler — pure decisions for the publish cron.
 *
 * The cron owns claiming and calling Meta; this module owns "publish, hold, retry or give
 * up", so the rules can be tested without a database or a Page.
 */

/** Retry ladder for a failed publish, in minutes. Three attempts, then give up. */
export const PUBLISH_BACKOFF_MINUTES = [5, 30, 180] as const;

export type PublishClaimState = 'ok' | 'broken';

export type PublishDecision =
  | { kind: 'publish' }
  | { kind: 'hold'; reason: string }
  | { kind: 'retry'; nextAttemptInMinutes: number }
  | { kind: 'fail'; reason: string };

/**
 * Decide what to do with one due publication.
 *
 * Order matters: a false claim always wins over a retry, because publishing a stale date is
 * worse than publishing late. A missing connection token is a failure, not a retry.
 */
export function decidePublishAction(input: {
  claim: PublishClaimState;
  claimReason?: string | null;
  attempts: number;
  connectionHealthy: boolean;
}): PublishDecision {
  if (input.claim === 'broken') {
    return { kind: 'hold', reason: input.claimReason ?? 'The post is no longer accurate' };
  }
  if (!input.connectionHealthy) {
    return { kind: 'fail', reason: 'Reconnect the Facebook Page or Instagram account' };
  }
  if (input.attempts > 0) {
    const index = Math.min(input.attempts - 1, PUBLISH_BACKOFF_MINUTES.length - 1);
    if (input.attempts > PUBLISH_BACKOFF_MINUTES.length) {
      return { kind: 'fail', reason: 'Publishing kept failing' };
    }
    return { kind: 'retry', nextAttemptInMinutes: PUBLISH_BACKOFF_MINUTES[index] };
  }
  return { kind: 'publish' };
}

export function nextAttemptIso(now: Date, minutes: number): string {
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

/** A due publication is one that is scheduled and whose retry window has passed. */
export function isDue(input: {
  status: string;
  scheduledAt: string | null;
  nextAttemptAt: string | null;
  nowIso: string;
}): boolean {
  if (input.status !== 'scheduled') return false;
  if (input.nextAttemptAt) return input.nextAttemptAt <= input.nowIso;
  return Boolean(input.scheduledAt) && input.scheduledAt! <= input.nowIso;
}
