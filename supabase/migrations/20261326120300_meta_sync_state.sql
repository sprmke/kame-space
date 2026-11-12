-- Server-owned Meta import and reconciliation.
--
-- The import used to be driven by the browser: the tab held the paging cursor and ran one
-- chunk per scroll. Close the tab and the import stopped. The cursor is server state now,
-- and reconciliation is what recovers whatever the webhooks missed.
--
-- Phase 3 of docs/workflow/in-progress/guest-inbox-meta-sync-overhaul.md.

CREATE TABLE IF NOT EXISTS public.meta_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.social_channel_connections (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  -- import
  import_cursor TEXT,
  import_phase TEXT NOT NULL DEFAULT 'messenger',
  import_completed_at TIMESTAMPTZ,
  conversations_imported INT NOT NULL DEFAULT 0,
  messages_imported INT NOT NULL DEFAULT 0,
  -- reconcile
  watermark TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lock_until TIMESTAMPTZ,
  consecutive_failures INT NOT NULL DEFAULT 0,
  last_error_code TEXT,
  last_checked_at TIMESTAMPTZ,
  last_change_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ,
  rate_limit_pct INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT meta_sync_state_connection_unique UNIQUE (connection_id),
  CONSTRAINT meta_sync_state_platform_check CHECK (platform IN ('facebook', 'instagram')),
  CONSTRAINT meta_sync_state_phase_check CHECK (
    import_phase IN ('messenger', 'instagram', 'complete')
  )
);

CREATE INDEX IF NOT EXISTS idx_meta_sync_state_due
  ON public.meta_sync_state (next_run_at)
  WHERE import_completed_at IS NULL OR next_run_at IS NOT NULL;

ALTER TABLE public.meta_sync_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meta_sync_state FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.meta_sync_state TO service_role;

COMMENT ON TABLE public.meta_sync_state IS
  'Per Meta connection sync state: import cursor and counters, reconcile watermark and schedule, rate-limit pressure. Service role only.';

ALTER TABLE public.social_conversations
  ADD COLUMN IF NOT EXISTS external_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS history_imported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS history_gap_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meta_message_count INT,
  ADD COLUMN IF NOT EXISTS thread_owner TEXT,
  ADD COLUMN IF NOT EXISTS last_message_direction TEXT,
  ADD COLUMN IF NOT EXISTS profile_refreshed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.social_conversations.external_updated_at IS
  'Meta conversation updated_time. The per-thread watermark reconciliation compares against.';
COMMENT ON COLUMN public.social_conversations.history_gap_at IS
  'Set when Meta returned no message we already had. Meta will not return anything older, so the thread shows a gap divider.';
COMMENT ON COLUMN public.social_conversations.thread_owner IS
  'Which app owns the chat: us, Meta Business AI, or another app. From GET /{page-id}/thread_owner.';
COMMENT ON COLUMN public.social_conversations.profile_refreshed_at IS
  'When the guest name and avatar were last read from Graph. Meta CDN avatar URLs expire.';

CREATE INDEX IF NOT EXISTS idx_social_conversations_org_updated
  ON public.social_conversations (organization_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_social_conversations_connection_last_message
  ON public.social_conversations (connection_id, last_message_at DESC, id);

-- One row per existing Meta connection, so the worker has somewhere to start.
INSERT INTO public.meta_sync_state (connection_id, organization_id, platform, next_run_at)
SELECT c.id, c.organization_id, c.platform, now()
FROM public.social_channel_connections c
WHERE c.platform IN ('facebook', 'instagram')
  AND c.status = 'connected'
ON CONFLICT (connection_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Claim a sync job. One active job per connection, SKIP LOCKED so workers do not collide.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.meta_sync_claim(
  p_limit int DEFAULT 5,
  p_lock_seconds int DEFAULT 40
)
RETURNS SETOF public.meta_sync_state
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.meta_sync_state s
  SET lock_until = now() + make_interval(secs => GREATEST(p_lock_seconds, 10)),
      updated_at = now()
  WHERE s.id IN (
    SELECT c.id
    FROM public.meta_sync_state c
    JOIN public.social_channel_connections conn ON conn.id = c.connection_id
    WHERE conn.status = 'connected'
      AND c.next_run_at <= now()
      AND (c.lock_until IS NULL OR c.lock_until < now())
    ORDER BY c.next_run_at
    FOR UPDATE OF c SKIP LOCKED
    LIMIT GREATEST(p_limit, 1)
  )
  RETURNING s.*;
$$;

COMMENT ON FUNCTION public.meta_sync_claim(int, int) IS
  'Lock due sync jobs. One active job per connection; FOR UPDATE SKIP LOCKED.';

-- Counters the API and the health panel read. Written after a job finishes.
CREATE OR REPLACE FUNCTION public.meta_sync_finish(
  p_connection_id uuid,
  p_next_run_at timestamptz,
  p_watermark timestamptz DEFAULT NULL,
  p_conversations_imported int DEFAULT 0,
  p_messages_imported int DEFAULT 0,
  p_import_cursor text DEFAULT NULL,
  p_import_phase text DEFAULT NULL,
  p_import_completed boolean DEFAULT false,
  p_rate_limit_pct int DEFAULT NULL,
  p_error_code text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.meta_sync_state s
  SET next_run_at = p_next_run_at,
      lock_until = NULL,
      watermark = GREATEST(COALESCE(s.watermark, p_watermark), p_watermark),
      conversations_imported = s.conversations_imported + GREATEST(p_conversations_imported, 0),
      messages_imported = s.messages_imported + GREATEST(p_messages_imported, 0),
      import_cursor = CASE WHEN p_import_cursor IS NOT NULL THEN p_import_cursor ELSE s.import_cursor END,
      import_phase = COALESCE(p_import_phase, s.import_phase),
      import_completed_at = CASE
        WHEN p_import_completed THEN COALESCE(s.import_completed_at, now())
        ELSE s.import_completed_at
      END,
      rate_limit_pct = COALESCE(p_rate_limit_pct, s.rate_limit_pct),
      last_error_code = p_error_code,
      consecutive_failures = CASE WHEN p_error_code IS NULL THEN 0 ELSE s.consecutive_failures + 1 END,
      last_checked_at = now(),
      updated_at = now()
  WHERE s.connection_id = p_connection_id;
$$;

COMMENT ON FUNCTION public.meta_sync_finish(
  uuid, timestamptz, timestamptz, int, int, text, text, boolean, int, text
) IS
  'Record a finished sync job: schedule the next run, advance the watermark, accumulate counters.';

REVOKE ALL ON FUNCTION public.meta_sync_claim(int, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.meta_sync_finish(
  uuid, timestamptz, timestamptz, int, int, text, text, boolean, int, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_sync_claim(int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.meta_sync_finish(
  uuid, timestamptz, timestamptz, int, int, text, text, boolean, int, text
) TO service_role;
