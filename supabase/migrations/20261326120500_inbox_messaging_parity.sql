-- Messaging parity: referral attribution, and the org switch for marking chats seen.
--
-- Phase 6 of docs/workflow/in-progress/guest-inbox-meta-sync-overhaul.md.

ALTER TABLE public.social_conversations
  ADD COLUMN IF NOT EXISTS referral JSONB,
  ADD COLUMN IF NOT EXISTS referral_at TIMESTAMPTZ;

COMMENT ON COLUMN public.social_conversations.referral IS
  'Where the guest came from: an ad, an m.me link, or a post. From the Meta referral payload.';

ALTER TABLE public.social_inbox_settings
  ADD COLUMN IF NOT EXISTS mark_seen_on_open BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.social_inbox_settings.mark_seen_on_open IS
  'Mark a Meta chat as seen when a host opens the thread, the way Business Suite does. Off keeps the guest on unread.';

-- Store the referral on the thread. Called from the processor for a `referral` event.
CREATE OR REPLACE FUNCTION public.inbox_apply_meta_referral(
  p_organization_id uuid,
  p_platform text,
  p_external_thread_id text,
  p_referral jsonb
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH updated AS (
    UPDATE public.social_conversations c
    SET referral = COALESCE(p_referral, c.referral),
        referral_at = COALESCE(c.referral_at, now()),
        updated_at = now()
    WHERE c.organization_id = p_organization_id
      AND c.platform = p_platform
      AND c.external_thread_id = p_external_thread_id
    RETURNING c.id
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;

COMMENT ON FUNCTION public.inbox_apply_meta_referral(uuid, text, text, jsonb) IS
  'Record where a guest came from on their thread. False when the thread is not stored yet.';

REVOKE ALL ON FUNCTION public.inbox_apply_meta_referral(uuid, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_apply_meta_referral(uuid, text, text, jsonb) TO service_role;
