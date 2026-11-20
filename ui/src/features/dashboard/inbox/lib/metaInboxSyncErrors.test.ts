import { describe, expect, it } from 'vitest';

import {
  FRIENDLY_META_SYNC_ERROR,
  FRIENDLY_META_WEBHOOK_ERROR,
  friendlyMetaSyncError,
  isMetaSyncConnectionError,
} from '@/features/dashboard/inbox/lib/metaInboxSyncErrors';

const GRAPH_SUBSCRIBED_FIELDS_DUMP =
  'Webhook verification failed: (#100) Param subscribed_fields[6] must be one of {feed, mention, name, picture, category, description, conversations, messages, message_reactions, messaging_postbacks, message_reads, message_edits, standby, messaging_handovers, messaging_referrals}';

describe('friendlyMetaSyncError', () => {
  it('maps Sync failed prefix to reconnect copy', () => {
    expect(friendlyMetaSyncError('Sync failed: Graph timeout')).toBe(FRIENDLY_META_SYNC_ERROR);
  });

  it('maps Meta Graph subscribed_fields dumps to Fix connection copy', () => {
    expect(friendlyMetaSyncError(GRAPH_SUBSCRIBED_FIELDS_DUMP)).toBe(FRIENDLY_META_WEBHOOK_ERROR);
  });

  it('maps missing webhook fields to a short live-messages line', () => {
    expect(
      friendlyMetaSyncError(
        'Webhook subscription still missing after retry. Missing fields: messaging_seen.'
      )
    ).toBe('Live messages may not arrive. Try Fix connection in Channels.');
  });

  it('keeps already-friendly short copy', () => {
    expect(friendlyMetaSyncError('Meta session expired. Reconnect Facebook in Channels.')).toBe(
      'Meta session expired. Reconnect Facebook in Channels.'
    );
  });

  it('returns null for empty input', () => {
    expect(friendlyMetaSyncError(null)).toBeNull();
    expect(friendlyMetaSyncError('')).toBeNull();
  });
});

describe('isMetaSyncConnectionError', () => {
  it('hides sync and Graph dumps from the Channels detail line', () => {
    expect(isMetaSyncConnectionError('Sync failed: boom')).toBe(true);
    expect(isMetaSyncConnectionError(GRAPH_SUBSCRIBED_FIELDS_DUMP)).toBe(true);
  });

  it('does not hide host-facing reconnect copy', () => {
    expect(isMetaSyncConnectionError('Meta session expired. Reconnect Facebook in Channels.')).toBe(
      false
    );
  });
});
