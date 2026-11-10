/**
 * Pure parsers for Meta webhook payloads.
 *
 * The platform comes from the webhook `object` field. The recipient id was used before, and
 * Facebook Page ids and guest ids can both start with 17, so Messenger messages and
 * Business Suite echoes were filed under Instagram.
 */

export type MetaMessagingPlatform = 'facebook' | 'instagram';

/** Platform from the webhook `object` field. `null` when the object is not a messaging one. */
export function platformFromMetaObject(object: string | undefined): MetaMessagingPlatform | null {
  if (object === 'page') return 'facebook';
  if (object === 'instagram') return 'instagram';
  return null;
}

/**
 * True when a webhook failure looks like the database or network being unreachable, rather
 * than one event being bad.
 *
 * A bad event is captured and acknowledged so Meta stops retrying it. An infrastructure
 * failure must return 500 so Meta retries the batch: every write on this path is idempotent,
 * so a retry is safe, and without it the guest messages in the batch are lost.
 */
export function isTransientMetaWebhookError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();
  if (!message) return false;
  return (
    message.includes('fetch failed') ||
    message.includes('error sending request') ||
    message.includes('connection to server') ||
    message.includes('database system is starting up') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('enotfound') ||
    /\b50[234]\b/.test(message)
  );
}
