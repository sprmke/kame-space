-- Forward-only conversation summary, and scrub the token-bearing backfill URL.
--
-- Before this, every writer set `last_message_at`, `subject_preview` and `reply_status`
-- unconditionally, and reset `unread_count` to 0 in the conversation upsert before adding 1
-- in a separate read-then-write. Meta does not guarantee event order, so an older event
-- could rewind a thread preview and the badge could never pass 1.
--
-- `inbox_bump_conversation` moves the summary into one statement that only moves forward:
--   - `last_message_at` is GREATEST(old, new)
--   - `subject_preview` and `reply_status` change only when the new message is the newest
--   - `last_inbound_at` and the messaging window only move forward
--   - `unread_count` is an atomic increment, never a reset, and is skipped for a message
--     the host has already read (`host_last_read_at`)
--
-- `p_direction` is the direction of the message being recorded. `p_last_inbound_at` is for
-- the import, which knows the newest inbound message from history even when the newest
-- message overall is the host's reply. (Postgres GREATEST ignores NULLs, so an outbound
-- event with no `p_last_inbound_at` leaves `last_inbound_at` alone.)
--
-- Phase 1, items 1.5 and 1.6 of
-- docs/workflow/in-progress/guest-inbox-meta-sync-overhaul.md.

CREATE OR REPLACE FUNCTION public.inbox_bump_conversation(
  p_conversation_id uuid,
  p_sent_at timestamptz,
  p_direction text,
  p_subject_preview text DEFAULT NULL,
  p_last_inbound_at timestamptz DEFAULT NULL,
  p_messaging_window_expires_at timestamptz DEFAULT NULL,
  p_unread_delta int DEFAULT 0,
  p_guest_unread_delta int DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- An inbound message is itself the newest inbound message; the import can also supply one
  -- explicitly when the newest message overall is outbound.
  v_newest_inbound timestamptz;
BEGIN
  IF p_direction IS NULL OR p_direction NOT IN ('inbound', 'outbound') THEN
    RAISE EXCEPTION 'inbox_bump_conversation: direction must be inbound or outbound';
  END IF;

  v_newest_inbound := GREATEST(
    CASE WHEN p_direction = 'inbound' THEN p_sent_at ELSE NULL END,
    p_last_inbound_at
  );

  UPDATE public.social_conversations c
  SET
    last_message_at = GREATEST(c.last_message_at, p_sent_at),
    subject_preview = CASE
      WHEN p_subject_preview IS NOT NULL AND p_sent_at >= c.last_message_at
        THEN LEFT(p_subject_preview, 500)
      ELSE c.subject_preview
    END,
    reply_status = CASE
      WHEN p_sent_at >= c.last_message_at
        THEN CASE WHEN p_direction = 'outbound' THEN 'replied' ELSE 'pending' END
      ELSE c.reply_status
    END,
    last_inbound_at = CASE
      WHEN v_newest_inbound IS NOT NULL
        THEN GREATEST(COALESCE(c.last_inbound_at, v_newest_inbound), v_newest_inbound)
      ELSE c.last_inbound_at
    END,
    messaging_window_expires_at = CASE
      WHEN p_messaging_window_expires_at IS NOT NULL
        THEN GREATEST(
          COALESCE(c.messaging_window_expires_at, p_messaging_window_expires_at),
          p_messaging_window_expires_at
        )
      ELSE c.messaging_window_expires_at
    END,
    unread_count = GREATEST(
      0,
      c.unread_count
      + CASE
          WHEN p_direction <> 'inbound' OR p_unread_delta = 0 THEN 0
          WHEN c.host_last_read_at IS NOT NULL AND p_sent_at <= c.host_last_read_at THEN 0
          ELSE p_unread_delta
        END
    ),
    guest_unread_count = GREATEST(0, c.guest_unread_count + p_guest_unread_delta),
    updated_at = now()
  WHERE c.id = p_conversation_id;
END;
$$;

COMMENT ON FUNCTION public.inbox_bump_conversation(
  uuid, timestamptz, text, text, timestamptz, timestamptz, int, int
) IS
  'Forward-only conversation summary bump. Atomic unread increment, never a reset. Phase 1 of the guest inbox meta sync overhaul.';

REVOKE ALL ON FUNCTION public.inbox_bump_conversation(
  uuid, timestamptz, text, text, timestamptz, timestamptz, int, int
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_bump_conversation(
  uuid, timestamptz, text, text, timestamptz, timestamptz, int, int
) TO service_role;

-- A guest read the host's messages.
--
-- `message_reads` is the guest's read state, not the host's. It marks the host's outbound
-- messages read up to the watermark and moves `guest_last_read_at`. It must never touch
-- `unread_count`, which counts what the host has not read yet.
--
-- One statement instead of the four round trips the TypeScript path needed (connection,
-- conversation, message update, conversation update), and no read-then-write race.
CREATE OR REPLACE FUNCTION public.inbox_apply_meta_read(
  p_organization_id uuid,
  p_platform text,
  p_external_thread_id text,
  p_read_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id uuid;
BEGIN
  SELECT c.id INTO v_conversation_id
  FROM public.social_conversations c
  WHERE c.organization_id = p_organization_id
    AND c.platform = p_platform
    AND c.external_thread_id = p_external_thread_id
  LIMIT 1;

  IF v_conversation_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.social_messages m
  SET read_at = p_read_at, delivery_status = 'read'
  WHERE m.conversation_id = v_conversation_id
    AND m.direction = 'outbound'
    AND m.read_at IS NULL
    AND m.deleted_at IS NULL
    AND m.sent_at <= p_read_at;

  UPDATE public.social_conversations c
  SET
    guest_last_read_at = GREATEST(COALESCE(c.guest_last_read_at, p_read_at), p_read_at),
    updated_at = now()
  WHERE c.id = v_conversation_id;
END;
$$;

COMMENT ON FUNCTION public.inbox_apply_meta_read(uuid, text, text, timestamptz) IS
  'Guest read watermark: marks the host outbound messages read and moves guest_last_read_at. Never touches the host unread count.';

REVOKE ALL ON FUNCTION public.inbox_apply_meta_read(uuid, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_apply_meta_read(uuid, text, text, timestamptz)
  TO service_role;

-- The import cursor must never be a URL. A Graph paging URL carries the Page access token,
-- and the old column was persisted and handed to the browser as-is.
ALTER TABLE public.social_channel_connections
  ADD COLUMN IF NOT EXISTS meta_backfill_cursor TEXT;

COMMENT ON COLUMN public.social_channel_connections.meta_backfill_cursor IS
  'Opaque Graph paging cursor for the Meta conversation import. Never a URL: a Graph paging URL carries the Page access token.';

-- Scrub every stored token-bearing paging URL.
UPDATE public.social_channel_connections
SET meta_backfill_next_url = NULL
WHERE meta_backfill_next_url IS NOT NULL;

COMMENT ON COLUMN public.social_channel_connections.meta_backfill_next_url IS
  'Deprecated. Held Graph paging URLs that carry the Page access token. Use meta_backfill_cursor. Cleared on deploy and removed in the cleanup phase.';
