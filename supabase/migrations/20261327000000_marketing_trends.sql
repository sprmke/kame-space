-- Marketing Trends — daily ranked Philippine trending topics.
-- Plan: docs/workflow/in-progress/marketing-trending-topics.md
--
-- Platform content, not org content: one ranked list a day that every host can
-- read. RLS is on and no policies exist, so only the service role (the edge
-- functions) can read or write. The publish step is one RPC so the swap between
-- two runs of the same day is a single transaction with an advisory lock.
--
-- Hosted pg_cron + pg_net only; no-ops cleanly on environments without
-- pg_cron / pg_net / Vault (same pattern as the other cron jobs).

-- ── Runs ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketing_trend_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  CONSTRAINT marketing_trend_runs_status_check
    CHECK (status IN ('running', 'published', 'failed', 'skipped')),
  trigger TEXT NOT NULL DEFAULT 'cron',
  CONSTRAINT marketing_trend_runs_trigger_check CHECK (trigger IN ('cron', 'manual')),
  triggered_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  source_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_provider TEXT,
  ai_model TEXT,
  ai_error TEXT,
  candidate_count INTEGER NOT NULL DEFAULT 0,
  topic_count INTEGER NOT NULL DEFAULT 0,
  ai_input_tokens INTEGER,
  ai_output_tokens INTEGER,
  ai_cost_usd NUMERIC(12, 6),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

COMMENT ON TABLE public.marketing_trend_runs IS
  'One row per Marketing Trends run. status: running | published | failed | skipped.';
COMMENT ON COLUMN public.marketing_trend_runs.run_date IS
  'Manila calendar date of the run (never UTC).';
COMMENT ON COLUMN public.marketing_trend_runs.source_stats IS
  'Per-source outcome: { google_trends: { ok, count, ms, error }, ... }.';
COMMENT ON COLUMN public.marketing_trend_runs.trigger IS
  'cron = the daily job, manual = a super admin pressed Run now.';

-- One published list per day. A rerun of the same date publishes a new row and
-- marks the older one skipped.
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_trend_runs_published_date
  ON public.marketing_trend_runs (run_date)
  WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_marketing_trend_runs_status_date
  ON public.marketing_trend_runs (status, run_date DESC);

ALTER TABLE public.marketing_trend_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketing_trend_runs FROM anon, authenticated;
GRANT ALL ON public.marketing_trend_runs TO service_role;

-- ── Topics ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketing_trend_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.marketing_trend_runs (id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  "window" TEXT NOT NULL,
  CONSTRAINT marketing_trend_topics_window_check CHECK ("window" IN ('today', 'week', 'month')),
  rank SMALLINT NOT NULL,
  topic_key TEXT NOT NULL,
  title TEXT NOT NULL,
  CONSTRAINT marketing_trend_topics_title_len_check CHECK (char_length(title) BETWEEN 1 AND 120),
  summary TEXT NOT NULL DEFAULT '',
  CONSTRAINT marketing_trend_topics_summary_len_check CHECK (char_length(summary) <= 200),
  category TEXT NOT NULL DEFAULT 'other',
  CONSTRAINT marketing_trend_topics_category_check
    CHECK (category IN ('tv_film', 'music', 'celebrity', 'sports', 'food', 'travel',
                        'holiday_event', 'lifestyle', 'gaming', 'tech', 'other')),
  stay_fit SMALLINT NOT NULL DEFAULT 0,
  CONSTRAINT marketing_trend_topics_stay_fit_check CHECK (stay_fit BETWEEN 0 AND 3),
  score NUMERIC(12, 4) NOT NULL DEFAULT 0,
  momentum TEXT NOT NULL DEFAULT 'steady',
  CONSTRAINT marketing_trend_topics_momentum_check
    CHECK (momentum IN ('new', 'rising', 'steady')),
  days_trending SMALLINT NOT NULL DEFAULT 1,
  first_seen DATE,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Other keys this same topic appeared under on other days. Momentum and days
  -- trending resolve through these, so a respelling does not reset the streak.
  aliases TEXT[] NOT NULL DEFAULT '{}'::text[],
  angles JSONB NOT NULL DEFAULT '[]'::jsonb,
  caption_idea TEXT NOT NULL DEFAULT '',
  hashtags TEXT[] NOT NULL DEFAULT '{}'::text[],
  brand_guard TEXT[] NOT NULL DEFAULT '{}'::text[],
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  manual BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE public.marketing_trend_topics IS
  'The published lists. One row per topic per window; the week and month windows are precomputed so a host read never aggregates.';
COMMENT ON COLUMN public.marketing_trend_topics.topic_key IS
  'Stable key across days (pinoy-big-brother-collab-3-0). Momentum and overrides use it.';
COMMENT ON COLUMN public.marketing_trend_topics.sources IS
  'Per-source evidence: [{ source, rank, traffic, views, newsHeadlines }]. No third-party URLs except the Wikipedia article.';
COMMENT ON COLUMN public.marketing_trend_topics.aliases IS
  'Earlier topic keys the AI merged into this one, used to match yesterday''s position.';
COMMENT ON COLUMN public.marketing_trend_topics.angles IS
  'Three angles: [{ title, hook, output, goal, format, prompt }].';
COMMENT ON COLUMN public.marketing_trend_topics.brand_guard IS
  'Guard rules injected into the generation prompt: no_likeness, no_logo, no_endorsement.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_trend_topics_run_window_rank
  ON public.marketing_trend_topics (run_id, "window", rank);
CREATE INDEX IF NOT EXISTS idx_marketing_trend_topics_key
  ON public.marketing_trend_topics (topic_key);

ALTER TABLE public.marketing_trend_topics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketing_trend_topics FROM anon, authenticated;
GRANT ALL ON public.marketing_trend_topics TO service_role;

-- ── Overrides (super-admin moderation) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketing_trend_overrides (
  topic_key TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  CONSTRAINT marketing_trend_overrides_action_check CHECK (action IN ('hide', 'pin')),
  note TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.marketing_trend_overrides IS
  'Super-admin moderation. A hide takes effect at read time, so it applies within 5 minutes without a rerun.';
COMMENT ON COLUMN public.marketing_trend_overrides.expires_at IS
  'Overrides expire so a forgotten hide does not silently remove a topic forever.';

ALTER TABLE public.marketing_trend_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketing_trend_overrides FROM anon, authenticated;
GRANT ALL ON public.marketing_trend_overrides TO service_role;

-- ── Manual topics (super-admin additions) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketing_trend_manual_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  CONSTRAINT marketing_trend_manual_topics_title_len_check
    CHECK (char_length(title) BETWEEN 1 AND 120),
  notes TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  CONSTRAINT marketing_trend_manual_topics_category_check
    CHECK (category IN ('tv_film', 'music', 'celebrity', 'sports', 'food', 'travel',
                        'holiday_event', 'lifestyle', 'gaming', 'tech', 'other')),
  active_from DATE NOT NULL DEFAULT CURRENT_DATE,
  active_to DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '14 days'),
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_trend_manual_topics_dates_check CHECK (active_to >= active_from)
);

COMMENT ON TABLE public.marketing_trend_manual_topics IS
  'Topics a super admin added by hand (a TikTok sound, a local event). They go through the same classify and safety pass as feed topics.';

CREATE INDEX IF NOT EXISTS idx_marketing_trend_manual_topics_active
  ON public.marketing_trend_manual_topics (active_from, active_to);

ALTER TABLE public.marketing_trend_manual_topics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketing_trend_manual_topics FROM anon, authenticated;
GRANT ALL ON public.marketing_trend_manual_topics TO service_role;

-- ── Slow sources (weekly cache) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketing_trend_source_cache (
  source TEXT NOT NULL,
  period_start DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error TEXT,
  PRIMARY KEY (source, period_start)
);

COMMENT ON TABLE public.marketing_trend_source_cache IS
  'Sources fetched on their own schedule. The daily run reads Netflix from here instead of downloading 33 MB every morning.';

ALTER TABLE public.marketing_trend_source_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketing_trend_source_cache FROM anon, authenticated;
GRANT ALL ON public.marketing_trend_source_cache TO service_role;

-- ── Provenance on AI Studio sessions ───────────────────────────────────────
ALTER TABLE public.marketing_ai_sessions
  ADD COLUMN IF NOT EXISTS trend_topic_key TEXT;

COMMENT ON COLUMN public.marketing_ai_sessions.trend_topic_key IS
  'Marketing Trends topic this session was created from (null when it was not).';

-- ── Publish ────────────────────────────────────────────────────────────────
-- One transaction: advisory lock, skip the older run of the same date, insert
-- the today rows, compute the week and month windows from the last 30
-- published runs, insert those rows, mark the run published.
CREATE OR REPLACE FUNCTION public.publish_marketing_trend_run(
  p_run_id UUID,
  p_run_date DATE,
  p_today JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_locked BOOLEAN;
  v_today_count INTEGER := 0;
  v_week_count INTEGER := 0;
  v_month_count INTEGER := 0;
BEGIN
  -- A transaction-scoped advisory lock. The Supabase JS client opens a new
  -- transaction per call, so this only works inside one function call.
  v_locked := pg_try_advisory_xact_lock(hashtext('marketing-trends'));
  IF NOT v_locked THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'another run is in progress');
  END IF;

  -- A rerun of the same day replaces the published list.
  UPDATE public.marketing_trend_runs
     SET status = 'skipped', finished_at = NOW()
   WHERE run_date = p_run_date
     AND status = 'published'
     AND id <> p_run_id;

  DELETE FROM public.marketing_trend_topics WHERE run_id = p_run_id;

  INSERT INTO public.marketing_trend_topics (
    run_id, run_date, "window", rank, topic_key, title, summary, category, stay_fit,
    score, momentum, days_trending, first_seen, sources, aliases, angles, caption_idea,
    hashtags, brand_guard, pinned, manual
  )
  SELECT
    p_run_id,
    p_run_date,
    'today',
    (row_number() OVER (ORDER BY (elem ->> 'score')::numeric DESC, elem ->> 'topic_key'))::int,
    elem ->> 'topic_key',
    left(coalesce(elem ->> 'title', ''), 120),
    left(coalesce(elem ->> 'summary', ''), 200),
    coalesce(elem ->> 'category', 'other'),
    coalesce((elem ->> 'stay_fit')::int, 0),
    coalesce((elem ->> 'score')::numeric, 0),
    coalesce(elem ->> 'momentum', 'steady'),
    coalesce((elem ->> 'days_trending')::int, 1),
    nullif(elem ->> 'first_seen', '')::date,
    coalesce(elem -> 'sources', '[]'::jsonb),
    coalesce(
      ARRAY(SELECT jsonb_array_elements_text(coalesce(elem -> 'aliases', '[]'::jsonb))),
      '{}'::text[]
    ),
    coalesce(elem -> 'angles', '[]'::jsonb),
    left(coalesce(elem ->> 'caption_idea', ''), 400),
    coalesce(
      ARRAY(SELECT jsonb_array_elements_text(coalesce(elem -> 'hashtags', '[]'::jsonb))),
      '{}'::text[]
    ),
    coalesce(
      ARRAY(SELECT jsonb_array_elements_text(coalesce(elem -> 'brand_guard', '[]'::jsonb))),
      '{}'::text[]
    ),
    coalesce((elem ->> 'pinned')::boolean, FALSE),
    coalesce((elem ->> 'manual')::boolean, FALSE)
  FROM jsonb_array_elements(coalesce(p_today, '[]'::jsonb)) AS elem
  WHERE coalesce(elem ->> 'topic_key', '') <> '';

  GET DIAGNOSTICS v_today_count = ROW_COUNT;

  -- Week and month windows: a decayed sum of the same key's daily scores.
  -- The window rows copy the metadata of the newest run that had the topic.
  WITH combined AS (
    SELECT t.topic_key, t.score::numeric AS score, (p_run_date - r.run_date) AS age_days
      FROM public.marketing_trend_topics t
      JOIN public.marketing_trend_runs r ON r.id = t.run_id
     WHERE t."window" = 'today'
       AND r.run_date <= p_run_date
       AND r.run_date > p_run_date - INTERVAL '30 days'
       AND (r.status = 'published' OR r.id = p_run_id)
  ), weekly AS (
    SELECT topic_key,
           SUM(score * POWER(0.85::numeric, age_days)) AS window_score
      FROM combined
     WHERE age_days < 7
     GROUP BY topic_key
  ), meta AS (
    SELECT DISTINCT ON (t.topic_key)
           t.topic_key, t.title, t.summary, t.category, t.stay_fit, t.momentum,
           t.days_trending, t.first_seen, t.sources, t.aliases, t.angles, t.caption_idea,
           t.hashtags, t.brand_guard, t.pinned, t.manual, r.run_date
      FROM public.marketing_trend_topics t
      JOIN public.marketing_trend_runs r ON r.id = t.run_id
     WHERE t."window" = 'today'
       AND r.run_date <= p_run_date
       AND (r.status = 'published' OR r.id = p_run_id)
     ORDER BY t.topic_key, r.run_date DESC
  )
  INSERT INTO public.marketing_trend_topics (
    run_id, run_date, "window", rank, topic_key, title, summary, category, stay_fit,
    score, momentum, days_trending, first_seen, sources, aliases, angles, caption_idea,
    hashtags, brand_guard, pinned, manual
  )
  SELECT
    p_run_id, p_run_date, 'week',
    (row_number() OVER (ORDER BY w.window_score DESC, w.topic_key))::int,
    w.topic_key, m.title, m.summary, m.category, m.stay_fit,
    w.window_score, m.momentum, m.days_trending, m.first_seen, m.sources, m.aliases,
    m.angles, m.caption_idea, m.hashtags, m.brand_guard, m.pinned, m.manual
    FROM weekly w
    JOIN meta m ON m.topic_key = w.topic_key
   ORDER BY w.window_score DESC, w.topic_key
   LIMIT 25;

  GET DIAGNOSTICS v_week_count = ROW_COUNT;

  WITH combined AS (
    SELECT t.topic_key, t.score::numeric AS score, (p_run_date - r.run_date) AS age_days
      FROM public.marketing_trend_topics t
      JOIN public.marketing_trend_runs r ON r.id = t.run_id
     WHERE t."window" = 'today'
       AND r.run_date <= p_run_date
       AND r.run_date > p_run_date - INTERVAL '30 days'
       AND (r.status = 'published' OR r.id = p_run_id)
  ), monthly AS (
    SELECT topic_key,
           SUM(score * POWER(0.93::numeric, age_days)) AS window_score
      FROM combined
     WHERE age_days < 30
     GROUP BY topic_key
  ), meta AS (
    SELECT DISTINCT ON (t.topic_key)
           t.topic_key, t.title, t.summary, t.category, t.stay_fit, t.momentum,
           t.days_trending, t.first_seen, t.sources, t.aliases, t.angles, t.caption_idea,
           t.hashtags, t.brand_guard, t.pinned, t.manual, r.run_date
      FROM public.marketing_trend_topics t
      JOIN public.marketing_trend_runs r ON r.id = t.run_id
     WHERE t."window" = 'today'
       AND r.run_date <= p_run_date
       AND (r.status = 'published' OR r.id = p_run_id)
     ORDER BY t.topic_key, r.run_date DESC
  )
  INSERT INTO public.marketing_trend_topics (
    run_id, run_date, "window", rank, topic_key, title, summary, category, stay_fit,
    score, momentum, days_trending, first_seen, sources, aliases, angles, caption_idea,
    hashtags, brand_guard, pinned, manual
  )
  SELECT
    p_run_id, p_run_date, 'month',
    (row_number() OVER (ORDER BY mo.window_score DESC, mo.topic_key))::int,
    mo.topic_key, m.title, m.summary, m.category, m.stay_fit,
    mo.window_score, m.momentum, m.days_trending, m.first_seen, m.sources, m.aliases,
    m.angles, m.caption_idea, m.hashtags, m.brand_guard, m.pinned, m.manual
    FROM monthly mo
    JOIN meta m ON m.topic_key = mo.topic_key
   ORDER BY mo.window_score DESC, mo.topic_key
   LIMIT 25;

  GET DIAGNOSTICS v_month_count = ROW_COUNT;

  UPDATE public.marketing_trend_runs
     SET status = 'published', topic_count = v_today_count, finished_at = NOW()
   WHERE id = p_run_id;

  -- Keep 35 days of history, whatever the run's status. The week and month windows
  -- look back 30 days, so nothing reads a run this old, and leaving published rows
  -- behind would grow the table forever. Topics cascade.
  DELETE FROM public.marketing_trend_runs
   WHERE run_date < p_run_date - INTERVAL '35 days';
  DELETE FROM public.marketing_trend_source_cache
   WHERE period_start < p_run_date - INTERVAL '35 days';

  RETURN jsonb_build_object(
    'ok', TRUE,
    'today', v_today_count,
    'week', v_week_count,
    'month', v_month_count
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'publish_marketing_trend_run failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.publish_marketing_trend_run(UUID, DATE, JSONB) IS
  'Publishes one Marketing Trends run: today rows plus the precomputed week and month windows. One transaction with an advisory lock.';

REVOKE ALL ON FUNCTION public.publish_marketing_trend_run(UUID, DATE, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_marketing_trend_run(UUID, DATE, JSONB) TO service_role;

-- ── Cron registration ──────────────────────────────────────────────────────
-- 21:30 UTC daily = 05:30 Asia/Manila (low-traffic hour).
CREATE OR REPLACE FUNCTION public.sync_marketing_trends_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr text := '30 21 * * *';
  v_cmd_body text := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/marketing-trends-cron',
  headers := (
    CASE
      WHEN EXISTS (SELECT 1 FROM vault.decrypted_secrets ds WHERE ds.name = 'marketing_trends_cron_secret')
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'X-Marketing-Trends-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'marketing_trends_cron_secret')
      )
      ELSE jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
      )
    END
  ),
  body := '{}'::jsonb
);
$BODY$;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'pg_cron extension not installed');
  END IF;

  FOR r IN
    SELECT jobname FROM cron.job WHERE jobname = 'marketing-trends-daily'
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('marketing-trends-daily', cron_expr, v_cmd_body);

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_marketing_trends_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_marketing_trends_cron_job() IS
  'Rebuilds the marketing-trends-daily cron job (21:30 UTC = 05:30 Asia/Manila). SECURITY DEFINER; service_role only.';

REVOKE ALL ON FUNCTION public.sync_marketing_trends_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_marketing_trends_cron_job() TO service_role;

-- Netflix publishes Tuesdays. 20:00 UTC Tuesday = 04:00 Asia/Manila Wednesday.
CREATE OR REPLACE FUNCTION public.sync_marketing_trends_weekly_cron_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $fn$
DECLARE
  r RECORD;
  cron_expr text := '0 20 * * 2';
  v_cmd_body text := $BODY$
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
         || '/functions/v1/marketing-trends-weekly-cron',
  headers := (
    CASE
      WHEN EXISTS (SELECT 1 FROM vault.decrypted_secrets ds WHERE ds.name = 'marketing_trends_cron_secret')
      THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
        'X-Marketing-Trends-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'marketing_trends_cron_secret')
      )
      ELSE jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
      )
    END
  ),
  body := '{}'::jsonb
);
$BODY$;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'pg_cron extension not installed');
  END IF;

  FOR r IN
    SELECT jobname FROM cron.job WHERE jobname = 'marketing-trends-netflix-weekly'
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;

  PERFORM cron.schedule('marketing-trends-netflix-weekly', cron_expr, v_cmd_body);

  RETURN jsonb_build_object('ok', TRUE, 'cronExpr', cron_expr);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'sync_marketing_trends_weekly_cron_job failed: ' || sqlerrm
    );
END;
$fn$;

COMMENT ON FUNCTION public.sync_marketing_trends_weekly_cron_job() IS
  'Rebuilds the marketing-trends-netflix-weekly cron job (20:00 UTC Tuesday = 04:00 Asia/Manila Wednesday). SECURITY DEFINER; service_role only.';

REVOKE ALL ON FUNCTION public.sync_marketing_trends_weekly_cron_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_marketing_trends_weekly_cron_job() TO service_role;

SELECT public.sync_marketing_trends_cron_job();
SELECT public.sync_marketing_trends_weekly_cron_job();
