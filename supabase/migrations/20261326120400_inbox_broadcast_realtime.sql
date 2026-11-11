-- Realtime v2 for the Guest Inbox: one private Broadcast signal per org.
--
-- Postgres Changes was 84% of database time: two org-wide bindings per host tab plus two per
-- open thread, with REPLICA IDENTITY FULL on both tables. It also only admitted the org owner
-- and org ADMIN members, so a property-level member saw a frozen list.
--
-- A Broadcast signal carries ids and timestamps, never a name or a message body, so the
-- content still goes through the permission-checked edge path.
--
-- Phase 4 of docs/workflow/in-progress/guest-inbox-meta-sync-overhaul.md.

-- Delta cursor. `updated_at` is what a patch reads, so an edit or a reaction is a delta too.
ALTER TABLE public.social_messages
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.social_messages_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_social_messages_touch ON public.social_messages;
CREATE TRIGGER trg_social_messages_touch
  BEFORE UPDATE ON public.social_messages
  FOR EACH ROW EXECUTE FUNCTION public.social_messages_touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_social_messages_conversation_updated
  ON public.social_messages (conversation_id, updated_at, id);

-- ---------------------------------------------------------------------------
-- Broadcast trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.inbox_broadcast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, realtime, pg_temp
AS $fn$
DECLARE
  v_org uuid;
  v_kind text;
  v_conversation_id uuid;
  v_connection_id uuid;
  v_platform text;
  v_property_id uuid;
  v_parking_id uuid;
BEGIN
  -- realtime.send lands only on recent Supabase stacks; skip cleanly elsewhere.
  IF to_regprocedure('realtime.send(jsonb, text, text, boolean)') IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'social_conversations' THEN
    v_org := NEW.organization_id;
    v_conversation_id := NEW.id;
    v_connection_id := NEW.connection_id;
    v_platform := NEW.platform;
    v_property_id := NEW.property_id;
    v_parking_id := NEW.parking_id;
    v_kind := CASE WHEN TG_OP = 'INSERT' THEN 'conversation_created' ELSE 'conversation_updated' END;
  ELSE
    v_org := NEW.organization_id;
    v_conversation_id := NEW.conversation_id;
    v_kind := 'message_updated';
    SELECT c.connection_id, c.platform, c.property_id, c.parking_id
    INTO v_connection_id, v_platform, v_property_id, v_parking_id
    FROM public.social_conversations c
    WHERE c.id = NEW.conversation_id;
  END IF;

  IF v_org IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM realtime.send(
    jsonb_build_object(
      'v', 1,
      'kind', v_kind,
      'conversation_id', v_conversation_id,
      'connection_id', v_connection_id,
      'platform', v_platform,
      'property_id', v_property_id,
      'parking_id', v_parking_id,
      'at', now()
    ),
    'inbox',
    'inbox:org:' || v_org::text,
    true  -- private topic, gated by the realtime.messages policy below
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN OTHERS THEN
    -- A live signal must never fail or slow the write it is reporting.
    RETURN COALESCE(NEW, OLD);
END;
$fn$;

COMMENT ON FUNCTION public.inbox_broadcast() IS
  'Pushes an ids-only signal to the private Realtime topic inbox:org:<organization_id> on conversation and message changes. Never carries a name or a message body.';

REVOKE ALL ON FUNCTION public.inbox_broadcast() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_inbox_conversations_broadcast ON public.social_conversations;
CREATE TRIGGER trg_inbox_conversations_broadcast
  AFTER INSERT OR UPDATE ON public.social_conversations
  FOR EACH ROW EXECUTE FUNCTION public.inbox_broadcast();

DROP TRIGGER IF EXISTS trg_inbox_messages_broadcast ON public.social_messages;
CREATE TRIGGER trg_inbox_messages_broadcast
  AFTER UPDATE ON public.social_messages
  FOR EACH ROW EXECUTE FUNCTION public.inbox_broadcast();

-- ---------------------------------------------------------------------------
-- Private-topic authorization
-- ---------------------------------------------------------------------------
--
-- Coarse on purpose: the payload carries no content, and the follow-up fetch enforces
-- `inbox:view` for the scope. This is what gives property- and parking-level members a
-- live inbox at all.

CREATE OR REPLACE FUNCTION public.user_can_read_inbox_broadcast(p_topic TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_raw TEXT := substring(p_topic FROM '^inbox:org:(.+)$');
  v_org UUID;
BEGIN
  IF v_raw IS NULL
     OR v_raw !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN FALSE;
  END IF;
  v_org := v_raw::uuid;

  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = v_org AND o.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = v_org
      AND om.user_id = auth.uid()
      AND om.status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.property_members pm
    JOIN public.properties p ON p.id = pm.property_id
    WHERE p.organization_id = v_org
      AND pm.user_id = auth.uid()
      AND pm.status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.parking_members pm
    JOIN public.parkings pk ON pk.id = pm.parking_id
    WHERE pk.organization_id = v_org
      AND pm.user_id = auth.uid()
      AND pm.status = 'active'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$fn$;

COMMENT ON FUNCTION public.user_can_read_inbox_broadcast(TEXT) IS
  'RLS helper for realtime.messages — true when the current user belongs to the org in inbox:org:<uuid>, including property- and parking-level members.';

REVOKE ALL ON FUNCTION public.user_can_read_inbox_broadcast(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_read_inbox_broadcast(TEXT) TO authenticated;

DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RAISE NOTICE 'realtime.messages not present — skipping inbox broadcast policy';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'realtime'
      AND tablename = 'messages'
      AND policyname = 'inbox_broadcast_read'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY inbox_broadcast_read ON realtime.messages
        FOR SELECT TO authenticated
        USING (
          realtime.messages.extension = 'broadcast'
          AND public.user_can_read_inbox_broadcast(
            (realtime.messages.topic)::text
          )
        )
    $pol$;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Delta reads
-- ---------------------------------------------------------------------------

/*
 * Threads changed since a cursor.
 *
 * The 30-second overlap is deliberate: `updated_at` comes from now() at transaction start,
 * so two commits can land out of order and a strict cursor would miss a row.
 */
CREATE OR REPLACE FUNCTION public.inbox_changed_conversations(
  p_organization_id uuid,
  p_since timestamptz,
  p_limit int DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  connection_id uuid,
  platform text,
  external_thread_id text,
  external_participant_id text,
  participant_name text,
  participant_avatar_url text,
  subject_preview text,
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  unread_count int,
  guest_unread_count int,
  reply_status text,
  messaging_window_expires_at timestamptz,
  property_id uuid,
  parking_id uuid,
  guest_last_read_at timestamptz,
  host_last_read_at timestamptz,
  history_gap_at timestamptz,
  thread_owner text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id, c.connection_id, c.platform, c.external_thread_id, c.external_participant_id,
    c.participant_name, c.participant_avatar_url, c.subject_preview, c.last_message_at,
    c.last_inbound_at, c.unread_count, c.guest_unread_count, c.reply_status,
    c.messaging_window_expires_at, c.property_id, c.parking_id, c.guest_last_read_at,
    c.host_last_read_at, c.history_gap_at, c.thread_owner, c.updated_at
  FROM public.social_conversations c
  WHERE c.organization_id = p_organization_id
    AND c.updated_at > (p_since - interval '30 seconds')
  ORDER BY c.updated_at, c.id
  LIMIT GREATEST(p_limit, 1);
$$;

COMMENT ON FUNCTION public.inbox_changed_conversations(uuid, timestamptz, int) IS
  'Threads updated after the cursor, with a 30-second overlap so out-of-order commits are not missed.';

/*
 * Messages changed since a cursor, for one open thread.
 *
 * `updated_at` covers inserts and updates, so a read receipt, an edit or a reaction is a
 * delta rather than a full refetch.
 */
CREATE OR REPLACE FUNCTION public.inbox_changed_messages(
  p_organization_id uuid,
  p_conversation_id uuid,
  p_since timestamptz,
  p_limit int DEFAULT 200
)
RETURNS SETOF public.social_messages
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.*
  FROM public.social_messages m
  WHERE m.organization_id = p_organization_id
    AND m.conversation_id = p_conversation_id
    AND m.updated_at > (p_since - interval '30 seconds')
  ORDER BY m.updated_at, m.id
  LIMIT GREATEST(p_limit, 1);
$$;

COMMENT ON FUNCTION public.inbox_changed_messages(uuid, uuid, timestamptz, int) IS
  'Messages inserted or updated after the cursor for one thread, with a 30-second overlap.';

REVOKE ALL ON FUNCTION public.inbox_changed_conversations(uuid, timestamptz, int)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inbox_changed_messages(uuid, uuid, timestamptz, int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_changed_conversations(uuid, timestamptz, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.inbox_changed_messages(uuid, uuid, timestamptz, int) TO service_role;
