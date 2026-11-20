import { sanitizeToastMessage } from '@/lib/feedback/toastMessages';

/** Host-facing copy when Meta webhook verify / subscribe fails. */
export const FRIENDLY_META_WEBHOOK_ERROR =
  'Could not verify Meta. Try Fix connection in Channels.';

/** Host-facing copy when conversations fail to sync from Meta. */
export const FRIENDLY_META_SYNC_ERROR =
  'Could not load all conversations. Try Reconnect in Channels.';

/**
 * Map connection / sync error strings (often Graph dumps stored on the row) to
 * short host-facing copy. Never return subscribed_fields / (#100) / enum lists.
 */
export function friendlyMetaSyncError(message: string | null | undefined): string | null {
  if (!message) return null;
  const text = message.trim();
  if (!text) return null;

  const lower = text.toLowerCase();

  if (text.startsWith('Sync failed:') || lower.includes('sync failed')) {
    return FRIENDLY_META_SYNC_ERROR;
  }

  if (
    lower.includes('webhook verification failed') ||
    lower.includes('failed to subscribe meta') ||
    lower.includes('failed to verify meta') ||
    lower.includes('subscribed_fields') ||
    lower.includes('param subscribed_fields') ||
    /\(#\d{2,3}\)/.test(text) ||
    (lower.includes('must be one of') && lower.includes('{'))
  ) {
    return FRIENDLY_META_WEBHOOK_ERROR;
  }

  if (
    lower.includes('webhook subscription still missing') ||
    lower.includes('missing fields:') ||
    (lower.includes('live messages may not arrive') && lower.includes('missing'))
  ) {
    return 'Live messages may not arrive. Try Fix connection in Channels.';
  }

  // Belt-and-suspenders: anything that still looks like a provider dump.
  return sanitizeToastMessage(text, FRIENDLY_META_WEBHOOK_ERROR);
}

/** Hide internal sync errors from the Channels connection card detail line. */
export function isMetaSyncConnectionError(message: string | null | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    message.startsWith('Sync failed:') ||
    lower.includes('sync failed') ||
    lower.includes('webhook verification failed') ||
    lower.includes('subscribed_fields') ||
    /\(#\d{2,3}\)/.test(message)
  );
}
