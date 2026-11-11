/**
 * Guest Inbox sync status.
 *
 * One derivation for the header pill and the Channels health card, so the host never sees two
 * different answers to "is this working". Every state here maps to something Meta actually
 * does, not to an internal counter.
 */

export type InboxSyncState =
  'live' | 'importing' | 'updating' | 'delayed' | 'offline' | 'needs-attention' | 'paused';

export type InboxSyncAction = 'fix-connection' | 'reconnect' | 'check-now' | null;

export type InboxSyncStatus = {
  state: InboxSyncState;
  label: string;
  /** One short sentence, shown on tap or hover. */
  detail: string;
  action: InboxSyncAction;
  actionLabel: string | null;
  /** "warning" is amber, "danger" is red, "muted" is neutral. */
  tone: 'success' | 'muted' | 'warning' | 'danger';
};

export type InboxSyncStatusInput = {
  connected: boolean;
  /** Super-admin turned `inbox.meta.sync` off. */
  syncPaused?: boolean;
  importComplete: boolean;
  importRunning?: boolean;
  conversationsImported?: number;
  lastCheckedAt?: string | null;
  consecutiveFailures?: number;
  lastErrorCode?: string | null;
  /** Browser reachability, from `navigator.onLine` plus a failed fetch. */
  browserOnline: boolean;
  now?: number;
};

/** A check older than this means reconciliation is not keeping up. */
const STALE_CHECK_MS = 15 * 60_000;
/** A check older than this is "delayed" rather than "live". */
const WARN_CHECK_MS = 6 * 60_000;

const TOKEN_ERROR_CODES = new Set(['invalid_token', '190']);

export function minutesAgoLabel(iso: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
}

/**
 * Derive the pill state.
 *
 * Order matters: an unreachable browser outranks everything (the host cannot act on a Meta
 * problem they cannot see), then an admin pause, then a broken connection, then freshness.
 */
export function deriveInboxSyncStatus(input: InboxSyncStatusInput): InboxSyncStatus {
  const now = input.now ?? Date.now();

  if (!input.connected) {
    return {
      state: 'needs-attention',
      label: 'Not connected',
      detail: 'Connect Facebook or Instagram to see guest messages here.',
      action: 'reconnect',
      actionLabel: 'Connect',
      tone: 'muted',
    };
  }

  if (input.syncPaused) {
    return {
      state: 'paused',
      label: 'Paused',
      detail: 'Sync is turned off for this platform. Messages already here stay readable.',
      action: null,
      actionLabel: null,
      tone: 'muted',
    };
  }

  if (!input.browserOnline) {
    return {
      state: 'offline',
      label: 'Offline',
      detail: "You're offline. Replies send when you're back online.",
      action: null,
      actionLabel: null,
      tone: 'muted',
    };
  }

  const tokenBroken = input.lastErrorCode ? TOKEN_ERROR_CODES.has(input.lastErrorCode) : false;
  if (tokenBroken) {
    return {
      state: 'needs-attention',
      label: 'Reconnect',
      detail: "We can't read your messages. Reconnect Facebook to fix it.",
      action: 'reconnect',
      actionLabel: 'Reconnect',
      tone: 'danger',
    };
  }

  if (!input.importComplete) {
    const loaded = input.conversationsImported ?? 0;
    return {
      state: 'importing',
      label: loaded > 0 ? `Importing ${loaded} chats` : 'Importing chats',
      detail: 'Bringing in your recent chats. You can keep working.',
      action: null,
      actionLabel: null,
      tone: 'muted',
    };
  }

  if (input.importRunning) {
    return {
      state: 'updating',
      label: 'Updating',
      detail: 'Checking with Meta for new messages.',
      action: null,
      actionLabel: null,
      tone: 'muted',
    };
  }

  const failures = input.consecutiveFailures ?? 0;
  const lastChecked = input.lastCheckedAt ? new Date(input.lastCheckedAt).getTime() : null;
  const age = lastChecked === null ? null : now - lastChecked;

  if (failures > 0 || age === null || age > STALE_CHECK_MS) {
    const detail =
      failures > 0
        ? 'Meta is not answering right now. We keep retrying, so new messages can take up to 10 minutes.'
        : 'We have not reached Meta recently. New messages can take a few minutes.';
    return {
      state: 'delayed',
      label: 'Delayed',
      detail,
      action: 'fix-connection',
      actionLabel: 'Fix connection',
      tone: 'warning',
    };
  }

  if (age > WARN_CHECK_MS) {
    return {
      state: 'delayed',
      label: 'Delayed',
      detail: `Last checked with Meta ${minutesAgoLabel(input.lastCheckedAt!, now)}.`,
      action: 'check-now',
      actionLabel: 'Check now',
      tone: 'warning',
    };
  }

  return {
    state: 'live',
    label: 'Live',
    detail: `New messages arrive in seconds. Last checked with Meta ${minutesAgoLabel(
      input.lastCheckedAt!,
      now
    )}.`,
    action: null,
    actionLabel: null,
    tone: 'success',
  };
}
