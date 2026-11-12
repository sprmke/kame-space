-- Meta inbox worker cron, outbox retention, and the legacy thread-id backfill.
--
-- The worker runs every minute, but the SQL gate means pg_net only fires when there is due
-- work, so idle minutes cost no edge invocations.
--
-- Phase 2, items 2.8, 2.9 and 2.10 of
-- docs/workflow/in-progress/guest-inbox-meta-sync-overhaul.md.

CREATE OR REPLACE FUNCTION public.meta_inbox_outbox_due()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meta_webhook_events e
    WHERE e.status IN ('pending', 'retry')
      AND e.next_attempt_at <= now()
  );
$$;

COMMENT ON FUNCTION public.meta_inbox_outbox_due() IS
  'True when the webhook outbox has work due. The worker cron fires on this instead of every minute.';

REVOKE ALL ON FUNCTION public.meta_inbox_outbox_due() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_inbox_outbox_due() TO service_role;

CREATE OR REPLACE FUNCTION public.sync_meta_inbox_worker_cron()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cron_expr text := '* * * * *';
  v_cmd text := $CMD$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/meta-inbox-worker',
  headers := (
    CASE
      WHEN EXISTS (SELECT 1 FROM vault.decrypted_secrets ds WHERE ds.name = 'meta_inbox_worker_secret')
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'X-Meta-Inbox-Worker-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'meta_inbox_worker_secret')
      )
      ELSE jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
      )
    END
  ),
  body := '{}'::jsonb
)
WHERE public.meta_inbox_outbox_due();
$CMD$;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pg_cron is not installed');
  END IF;

  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname = 'meta-inbox-worker-every-minute';

  PERFORM cron.schedule('meta-inbox-worker-every-minute', cron_expr, v_cmd);
  RETURN jsonb_build_object('ok', true, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'sync_meta_inbox_worker_cron failed: ' || sqlerrm
    );
END;
$$;

COMMENT ON FUNCTION public.sync_meta_inbox_worker_cron() IS
  'Rebuilds the meta-inbox-worker cron. Gated on public.meta_inbox_outbox_due(), so idle minutes cost no invocations. Safe to call without pg_cron/Vault.';

REVOKE ALL ON FUNCTION public.sync_meta_inbox_worker_cron() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_meta_inbox_worker_cron() TO service_role;

-- Best effort at deploy time. Hosted environments call this after the Vault secrets exist.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM public.sync_meta_inbox_worker_cron();
  END IF;
END
$do$;

-- ---------------------------------------------------------------------------
-- Outbox retention
-- ---------------------------------------------------------------------------
--
-- The payload is the guest's message text. It is needed only while an event can still be
-- retried, so it is stripped the moment the event is settled, and the row follows later.

CREATE OR REPLACE FUNCTION public.prune_meta_webhook_events()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stripped int := 0;
  v_deleted int := 0;
  v_dead int := 0;
BEGIN
  UPDATE public.meta_webhook_events
  SET payload = '{}'::jsonb
  WHERE status IN ('done', 'skipped')
    AND payload <> '{}'::jsonb
    AND processed_at IS NOT NULL
    AND processed_at < now() - interval '24 hours';
  GET DIAGNOSTICS v_stripped = ROW_COUNT;

  DELETE FROM public.meta_webhook_events
  WHERE status IN ('done', 'skipped')
    AND processed_at IS NOT NULL
    AND processed_at < now() - interval '14 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  DELETE FROM public.meta_webhook_events
  WHERE status = 'dead'
    AND processed_at IS NOT NULL
    AND processed_at < now() - interval '30 days';
  GET DIAGNOSTICS v_dead = ROW_COUNT;

  RETURN jsonb_build_object(
    'stripped', v_stripped, 'deleted', v_deleted, 'dead_deleted', v_dead
  );
END;
$$;

COMMENT ON FUNCTION public.prune_meta_webhook_events() IS
  'Meta webhook outbox retention: payload stripped after 24h, settled rows deleted after 14 days, dead rows after 30. SECURITY DEFINER; service_role only.';

REVOKE ALL ON FUNCTION public.prune_meta_webhook_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_meta_webhook_events() TO service_role;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobname)
    FROM cron.job
    WHERE jobname = 'meta-inbox-outbox-retention-hourly';
    PERFORM cron.schedule(
      'meta-inbox-outbox-retention-hourly',
      '17 * * * *',
      'SELECT public.prune_meta_webhook_events();'
    );
  END IF;
END
$do$;

-- ---------------------------------------------------------------------------
-- Legacy thread id backfill (2.10)
-- ---------------------------------------------------------------------------
--
-- Older rows were keyed by the Meta conversation id. Every row that already carries a
-- participant id can be re-keyed here, so the runtime per-event migration only has to run
-- for rows the Graph API has not given us a participant for.
--
-- A collision is skipped rather than merged: an existing canonical row already holds that
-- thread, and merging conversations is not something a migration should guess at.

UPDATE public.social_conversations c
SET external_thread_id = c.platform || ':' || c.external_participant_id,
    updated_at = now()
WHERE c.platform IN ('facebook', 'instagram')
  AND c.conversation_type = 'dm'
  AND c.external_participant_id IS NOT NULL
  AND c.external_participant_id <> ''
  AND c.external_thread_id <> c.platform || ':' || c.external_participant_id
  AND NOT EXISTS (
    SELECT 1
    FROM public.social_conversations other
    WHERE other.organization_id = c.organization_id
      AND other.platform = c.platform
      AND other.external_thread_id = c.platform || ':' || c.external_participant_id
  );
