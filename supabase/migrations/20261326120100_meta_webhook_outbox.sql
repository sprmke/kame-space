-- Durable Meta webhook pipeline: an outbox between the acknowledgement and the work.
--
-- Meta wants a 200 within 5 seconds, retries a failed batch a few times, and after an hour
-- of failures unsubscribes the app and never resends. Doing the work inline meant one slow
-- event held the acknowledgement and one failure lost the message.
--
-- The webhook now writes one row per event and returns. The processor claims due rows with
-- FOR UPDATE SKIP LOCKED, applies them, and retries with backoff up to six attempts before
-- parking the row as `dead` for replay from /admin/health.
--
-- Phase 2 of docs/workflow/in-progress/guest-inbox-meta-sync-overhaul.md.

-- ---------------------------------------------------------------------------
-- social_messages: columns the outbox and the send path need
-- ---------------------------------------------------------------------------

ALTER TABLE public.social_messages
  ADD COLUMN IF NOT EXISTS client_message_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS sender_app TEXT,
  ADD COLUMN IF NOT EXISTS routing TEXT,
  ADD COLUMN IF NOT EXISTS reactions JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS send_error_code TEXT;

-- One row per composer submit, so a retried send cannot insert the message twice.
CREATE UNIQUE INDEX IF NOT EXISTS social_messages_client_message_id_unique
  ON public.social_messages (client_message_id)
  WHERE client_message_id IS NOT NULL;

ALTER TABLE public.social_messages
  DROP CONSTRAINT IF EXISTS social_messages_message_kind_check;
ALTER TABLE public.social_messages
  ADD CONSTRAINT social_messages_message_kind_check CHECK (
    message_kind IN (
      'text', 'template', 'postback', 'unsupported', 'story_reply', 'share', 'reaction', 'edit'
    )
  );

ALTER TABLE public.social_messages
  DROP CONSTRAINT IF EXISTS social_messages_sender_app_check;
ALTER TABLE public.social_messages
  ADD CONSTRAINT social_messages_sender_app_check CHECK (
    sender_app IS NULL OR sender_app IN ('kame', 'meta', 'other')
  );

ALTER TABLE public.social_messages
  DROP CONSTRAINT IF EXISTS social_messages_routing_check;
ALTER TABLE public.social_messages
  ADD CONSTRAINT social_messages_routing_check CHECK (
    routing IS NULL OR routing IN ('messaging', 'standby')
  );

ALTER TABLE public.social_messages
  DROP CONSTRAINT IF EXISTS social_messages_source_check;
ALTER TABLE public.social_messages
  ADD CONSTRAINT social_messages_source_check CHECK (
    source IS NULL OR source IN ('webhook', 'reconcile', 'import', 'kame_send', 'web_chat')
  );

COMMENT ON COLUMN public.social_messages.client_message_id IS
  'Composer submit id. Unique, so a retried send or a redelivered outbox row cannot duplicate the message.';
COMMENT ON COLUMN public.social_messages.source IS
  'How the row was written: webhook, reconcile, import, kame_send, web_chat.';
COMMENT ON COLUMN public.social_messages.sender_app IS
  'Which app sent an outbound message: kame, meta (Business Suite), or another app.';
COMMENT ON COLUMN public.social_messages.routing IS
  'Meta routing channel: messaging (app owns the chat) or standby (another app owns it).';
COMMENT ON COLUMN public.social_messages.reactions IS
  'Meta reactions on the message, keyed by kind. Empty when none.';

-- ---------------------------------------------------------------------------
-- meta_webhook_events: the outbox
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.meta_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations (id) ON DELETE CASCADE,
  object TEXT NOT NULL,
  platform TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_key TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ,
  last_error TEXT,
  result JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT meta_webhook_events_event_key_unique UNIQUE (event_key),
  CONSTRAINT meta_webhook_events_status_check CHECK (
    status IN ('pending', 'processing', 'done', 'skipped', 'retry', 'dead')
  ),
  CONSTRAINT meta_webhook_events_channel_check CHECK (channel IN ('messaging', 'standby'))
);

CREATE INDEX IF NOT EXISTS idx_meta_webhook_events_due
  ON public.meta_webhook_events (status, next_attempt_at)
  WHERE status IN ('pending', 'retry');

CREATE INDEX IF NOT EXISTS idx_meta_webhook_events_org_received
  ON public.meta_webhook_events (organization_id, received_at DESC);

ALTER TABLE public.meta_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meta_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.meta_webhook_events TO service_role;

COMMENT ON TABLE public.meta_webhook_events IS
  'Meta webhook outbox. One row per event, unique on event_key so a retried batch is a no-op. Service role only.';

-- Enqueue. Returns only the ids that were actually new, so the caller knows what to process.
CREATE OR REPLACE FUNCTION public.meta_webhook_enqueue(p_events jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH incoming AS (
    SELECT
      (e->>'object') AS object,
      (e->>'platform') AS platform,
      (e->>'entry_id') AS entry_id,
      (e->>'channel') AS channel,
      (e->>'event_type') AS event_type,
      (e->>'event_key') AS event_key,
      COALESCE((e->>'event_time')::timestamptz, now()) AS event_time,
      COALESCE(e->'payload', '{}'::jsonb) AS payload
    FROM jsonb_array_elements(COALESCE(p_events, '[]'::jsonb)) AS e
    WHERE COALESCE(e->>'event_key', '') <> ''
  ), inserted AS (
    INSERT INTO public.meta_webhook_events
      (object, platform, entry_id, channel, event_type, event_key, event_time, payload)
    SELECT object, platform, entry_id, channel, event_type, event_key, event_time, payload
    FROM incoming
    ON CONFLICT (event_key) DO NOTHING
    RETURNING id
  )
  SELECT COALESCE(jsonb_agg(id), '[]'::jsonb) FROM inserted;
$$;

COMMENT ON FUNCTION public.meta_webhook_enqueue(jsonb) IS
  'Insert webhook events, ignoring duplicates by event_key. Returns the new row ids.';

-- Claim due rows. SKIP LOCKED so two workers never take the same row.
CREATE OR REPLACE FUNCTION public.meta_webhook_claim(
  p_limit int DEFAULT 20,
  p_lock_seconds int DEFAULT 120
)
RETURNS SETOF public.meta_webhook_events
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.meta_webhook_events e
  SET status = 'processing',
      attempts = e.attempts + 1,
      locked_until = now() + make_interval(secs => GREATEST(p_lock_seconds, 10))
  WHERE e.id IN (
    SELECT c.id
    FROM public.meta_webhook_events c
    WHERE c.status IN ('pending', 'retry')
      AND c.next_attempt_at <= now()
    ORDER BY c.next_attempt_at, c.event_time
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(p_limit, 1)
  )
  RETURNING e.*;
$$;

COMMENT ON FUNCTION public.meta_webhook_claim(int, int) IS
  'Lock and return due webhook events. FOR UPDATE SKIP LOCKED; holds a processing lease.';

CREATE OR REPLACE FUNCTION public.meta_webhook_complete(
  p_id uuid,
  p_status text,
  p_result jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.meta_webhook_events
  SET status = CASE WHEN p_status IN ('done', 'skipped') THEN p_status ELSE 'done' END,
      result = p_result,
      last_error = NULL,
      locked_until = NULL,
      processed_at = now()
  WHERE id = p_id;
$$;

COMMENT ON FUNCTION public.meta_webhook_complete(uuid, text, jsonb) IS
  'Mark a claimed webhook event finished (done or skipped).';

CREATE OR REPLACE FUNCTION public.meta_webhook_fail(
  p_id uuid,
  p_error text,
  p_retry_in_seconds int,
  p_dead boolean DEFAULT false,
  p_organization_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.meta_webhook_events
  SET status = CASE WHEN p_dead THEN 'dead' ELSE 'retry' END,
      last_error = LEFT(COALESCE(p_error, 'unknown error'), 1000),
      next_attempt_at = now() + make_interval(secs => GREATEST(p_retry_in_seconds, 1)),
      locked_until = NULL,
      organization_id = COALESCE(organization_id, p_organization_id),
      processed_at = CASE WHEN p_dead THEN now() ELSE processed_at END
  WHERE id = p_id;
$$;

COMMENT ON FUNCTION public.meta_webhook_fail(uuid, text, int, boolean, uuid) IS
  'Schedule a retry, or park the event as dead after the final attempt.';

REVOKE ALL ON FUNCTION public.meta_webhook_enqueue(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.meta_webhook_claim(int, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.meta_webhook_complete(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.meta_webhook_fail(uuid, text, int, boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_webhook_enqueue(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.meta_webhook_claim(int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.meta_webhook_complete(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.meta_webhook_fail(uuid, text, int, boolean, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- One writer for Meta messages
-- ---------------------------------------------------------------------------
--
-- Webhooks, reconciliation, import and Kame sends all come through here, so the message
-- and the conversation can never disagree about what the newest message is.
--
-- `sent_at` and the thread id come from the caller. `event_time` is Meta's own timestamp,
-- which is what orders the summary; `received_at` would reorder a retried event.

CREATE OR REPLACE FUNCTION public.inbox_apply_meta_message(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := NULLIF(p->>'organization_id', '')::uuid;
  v_connection uuid := NULLIF(p->>'connection_id', '')::uuid;
  v_platform text := NULLIF(p->>'platform', '');
  v_thread text := NULLIF(p->>'external_thread_id', '');
  v_direction text := NULLIF(p->>'direction', '');
  v_mid text := NULLIF(p->>'external_message_id', '');
  v_sent_at timestamptz := COALESCE(NULLIF(p->>'sent_at', '')::timestamptz, now());
  v_conv_id uuid;
  v_conversation_created boolean := false;
  v_message_id uuid;
  v_inserted boolean := false;
BEGIN
  IF v_org IS NULL OR v_connection IS NULL OR v_platform IS NULL OR v_thread IS NULL
     OR v_mid IS NULL OR v_direction NOT IN ('inbound', 'outbound') THEN
    RAISE EXCEPTION
      'inbox_apply_meta_message: organization_id, connection_id, platform, external_thread_id, external_message_id and inbound|outbound direction are required';
  END IF;

  INSERT INTO public.social_conversations (
    organization_id, connection_id, platform, conversation_type, external_thread_id,
    external_participant_id, participant_name, participant_avatar_url, last_message_at
  ) VALUES (
    v_org, v_connection, v_platform, 'dm', v_thread,
    NULLIF(p->>'external_participant_id', ''),
    NULLIF(p->>'participant_name', ''),
    NULLIF(p->>'participant_avatar_url', ''),
    v_sent_at
  )
  ON CONFLICT (organization_id, platform, external_thread_id) DO NOTHING
  RETURNING id INTO v_conv_id;

  IF v_conv_id IS NOT NULL THEN
    v_conversation_created := true;
  ELSE
    SELECT id INTO v_conv_id
    FROM public.social_conversations
    WHERE organization_id = v_org AND platform = v_platform AND external_thread_id = v_thread;

    -- Identity is filled when missing and never overwritten: a webhook name is often absent
    -- and an import should not clobber a good profile with an empty one.
    UPDATE public.social_conversations c
    SET
      participant_name = COALESCE(
        NULLIF(c.participant_name, ''), NULLIF(p->>'participant_name', ''), c.participant_name
      ),
      participant_avatar_url = COALESCE(
        NULLIF(c.participant_avatar_url, ''),
        NULLIF(p->>'participant_avatar_url', ''),
        c.participant_avatar_url
      ),
      external_participant_id = COALESCE(
        c.external_participant_id, NULLIF(p->>'external_participant_id', '')
      )
    WHERE c.id = v_conv_id;
  END IF;

  INSERT INTO public.social_messages (
    organization_id, conversation_id, direction, external_message_id, body_text,
    attachments, sent_at, delivery_status, sent_by_user_id, is_ai_generated,
    message_tag, reply_to_message_id, reply_preview_text, template_snapshot,
    message_kind, client_message_id, source, sender_app, routing
  ) VALUES (
    v_org, v_conv_id, v_direction, v_mid, NULLIF(p->>'body_text', ''),
    COALESCE(p->'attachments', '[]'::jsonb),
    v_sent_at,
    NULLIF(p->>'delivery_status', ''),
    NULLIF(p->>'sent_by_user_id', '')::uuid,
    COALESCE(NULLIF(p->>'is_ai_generated', '')::boolean, false),
    NULLIF(p->>'message_tag', ''),
    NULLIF(p->>'reply_to_message_id', '')::uuid,
    NULLIF(p->>'reply_preview_text', ''),
    p->'template_snapshot',
    COALESCE(NULLIF(p->>'message_kind', ''), 'text'),
    NULLIF(p->>'client_message_id', ''),
    COALESCE(NULLIF(p->>'source', ''), 'webhook'),
    NULLIF(p->>'sender_app', ''),
    NULLIF(p->>'routing', '')
  )
  ON CONFLICT (external_message_id) DO UPDATE SET
    -- Fill metadata that is still null, so an echo that lands before the send row does not
    -- wipe sent_by_user_id, the AI flag or the reply link.
    sent_by_user_id = COALESCE(social_messages.sent_by_user_id, EXCLUDED.sent_by_user_id),
    is_ai_generated = social_messages.is_ai_generated OR EXCLUDED.is_ai_generated,
    message_tag = COALESCE(social_messages.message_tag, EXCLUDED.message_tag),
    reply_to_message_id = COALESCE(
      social_messages.reply_to_message_id, EXCLUDED.reply_to_message_id
    ),
    reply_preview_text = COALESCE(social_messages.reply_preview_text, EXCLUDED.reply_preview_text),
    template_snapshot = COALESCE(social_messages.template_snapshot, EXCLUDED.template_snapshot),
    client_message_id = COALESCE(social_messages.client_message_id, EXCLUDED.client_message_id),
    sender_app = COALESCE(social_messages.sender_app, EXCLUDED.sender_app),
    routing = COALESCE(social_messages.routing, EXCLUDED.routing),
    delivery_status = COALESCE(social_messages.delivery_status, EXCLUDED.delivery_status),
    -- Stored text never regresses to null.
    body_text = COALESCE(NULLIF(social_messages.body_text, ''), EXCLUDED.body_text),
    -- Attachments only fill in when the stored copy has none.
    attachments = CASE
      WHEN jsonb_typeof(social_messages.attachments) = 'array'
        AND jsonb_array_length(social_messages.attachments) > 0
        THEN social_messages.attachments
      ELSE EXCLUDED.attachments
    END
  RETURNING id, (xmax = 0) INTO v_message_id, v_inserted;

  IF v_inserted THEN
    PERFORM public.inbox_bump_conversation(
      v_conv_id,
      v_sent_at,
      v_direction,
      NULLIF(p->>'subject_preview', ''),
      NULLIF(p->>'last_inbound_at', '')::timestamptz,
      NULLIF(p->>'messaging_window_expires_at', '')::timestamptz,
      COALESCE(
        NULLIF(p->>'unread_delta', '')::int,
        CASE WHEN v_direction = 'inbound' THEN 1 ELSE 0 END
      ),
      COALESCE(NULLIF(p->>'guest_unread_delta', '')::int, 0)
    );
  END IF;

  RETURN jsonb_build_object(
    'conversation_id', v_conv_id,
    'message_id', v_message_id,
    'inserted', v_inserted,
    'conversation_created', v_conversation_created
  );
END;
$$;

COMMENT ON FUNCTION public.inbox_apply_meta_message(jsonb) IS
  'Single writer for Meta messages and their conversation summary. Idempotent on external_message_id; side effects key off inserted.';

REVOKE ALL ON FUNCTION public.inbox_apply_meta_message(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_apply_meta_message(jsonb) TO service_role;

-- Instagram `messaging_seen` carries a message id, not a watermark.
CREATE OR REPLACE FUNCTION public.inbox_apply_meta_seen(
  p_organization_id uuid,
  p_external_message_id text,
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
  UPDATE public.social_messages m
  SET read_at = COALESCE(m.read_at, p_read_at), delivery_status = 'read'
  WHERE m.organization_id = p_organization_id
    AND m.external_message_id = p_external_message_id
    AND m.direction = 'outbound'
  RETURNING m.conversation_id INTO v_conversation_id;

  IF v_conversation_id IS NOT NULL THEN
    UPDATE public.social_conversations c
    SET guest_last_read_at = GREATEST(COALESCE(c.guest_last_read_at, p_read_at), p_read_at),
        updated_at = now()
    WHERE c.id = v_conversation_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.inbox_apply_meta_seen(uuid, text, timestamptz) IS
  'Instagram seen receipt: marks one outbound message read and moves guest_last_read_at.';

REVOKE ALL ON FUNCTION public.inbox_apply_meta_seen(uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_apply_meta_seen(uuid, text, timestamptz) TO service_role;

-- Reactions arrive as a full map of what the guest has on the message.
CREATE OR REPLACE FUNCTION public.inbox_apply_meta_reaction(
  p_organization_id uuid,
  p_external_message_id text,
  p_reactions jsonb
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH updated AS (
    UPDATE public.social_messages m
    SET reactions = COALESCE(p_reactions, '{}'::jsonb)
    WHERE m.organization_id = p_organization_id
      AND m.external_message_id = p_external_message_id
    RETURNING m.id
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;

COMMENT ON FUNCTION public.inbox_apply_meta_reaction(uuid, text, jsonb) IS
  'Store the guest reaction map on one message. False when the message is not stored yet.';

-- A guest edited a Messenger message.
CREATE OR REPLACE FUNCTION public.inbox_apply_meta_edit(
  p_organization_id uuid,
  p_external_message_id text,
  p_body_text text,
  p_edited_at timestamptz
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH updated AS (
    UPDATE public.social_messages m
    SET body_text = COALESCE(NULLIF(p_body_text, ''), m.body_text),
        edited_at = GREATEST(COALESCE(m.edited_at, p_edited_at), p_edited_at)
    WHERE m.organization_id = p_organization_id
      AND m.external_message_id = p_external_message_id
      AND m.deleted_at IS NULL
    RETURNING m.id, m.conversation_id, m.sent_at
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;

COMMENT ON FUNCTION public.inbox_apply_meta_edit(uuid, text, text, timestamptz) IS
  'Apply a guest message edit. False when the message is unknown or already deleted.';

-- A guest unsent a message. Instagram only; Meta sends `is_deleted`.
CREATE OR REPLACE FUNCTION public.inbox_apply_meta_unsend(
  p_organization_id uuid,
  p_external_message_id text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH updated AS (
    UPDATE public.social_messages m
    SET deleted_at = now(),
        body_text = NULL,
        attachments = '[]'::jsonb
    WHERE m.organization_id = p_organization_id
      AND m.external_message_id = p_external_message_id
      AND m.deleted_at IS NULL
    RETURNING m.id
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;

COMMENT ON FUNCTION public.inbox_apply_meta_unsend(uuid, text) IS
  'Soft-delete a guest message the guest unsent. Idempotent.';

-- The host opened the thread. One statement instead of the two-update read path.
CREATE OR REPLACE FUNCTION public.inbox_mark_host_read(
  p_organization_id uuid,
  p_conversation_id uuid,
  p_read_at timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.social_messages m
  SET read_at = p_read_at, delivery_status = 'read'
  WHERE m.organization_id = p_organization_id
    AND m.conversation_id = p_conversation_id
    AND m.direction = 'inbound'
    AND m.read_at IS NULL
    AND m.deleted_at IS NULL;

  UPDATE public.social_conversations c
  SET unread_count = 0, host_last_read_at = p_read_at, updated_at = now()
  WHERE c.organization_id = p_organization_id AND c.id = p_conversation_id;
END;
$$;

COMMENT ON FUNCTION public.inbox_mark_host_read(uuid, uuid, timestamptz) IS
  'Host opened the thread: clear the host unread badge and mark inbound messages read.';

REVOKE ALL ON FUNCTION public.inbox_apply_meta_reaction(uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inbox_apply_meta_edit(uuid, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inbox_apply_meta_unsend(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inbox_mark_host_read(uuid, uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_apply_meta_reaction(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.inbox_apply_meta_edit(uuid, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.inbox_apply_meta_unsend(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.inbox_mark_host_read(uuid, uuid, timestamptz) TO service_role;
