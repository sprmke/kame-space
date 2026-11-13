-- Marketing Planner: settings, calendar events, plans, plan items, post metrics,
-- planner plan entitlements, the `marketing.plan:edit` leaf, and notification types.
-- Plan: docs/workflow/in-progress/marketing-strategy-planner.md (§5.2, §5.7, §5.8)
--
-- Access is enforced in edge functions (house rule); RLS stays on with service-role grants.

BEGIN;

-- 1. Per-property planner settings ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.marketing_planner_settings (
  property_id UUID PRIMARY KEY REFERENCES public.properties (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  goals TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  cadence_preset TEXT NOT NULL DEFAULT 'steady',
  cadence JSONB,
  channels JSONB NOT NULL DEFAULT '[]'::JSONB,
  language TEXT NOT NULL DEFAULT 'en',
  tone TEXT NOT NULL DEFAULT 'warm',
  posting_windows JSONB,
  approval_mode TEXT NOT NULL DEFAULT 'ask',
  auto_plan BOOLEAN NOT NULL DEFAULT TRUE,
  plan_weekday SMALLINT NOT NULL DEFAULT 1,
  plan_time TEXT NOT NULL DEFAULT '08:00',
  reminders JSONB NOT NULL DEFAULT
    '{"inApp": true, "push": true, "telegram": false, "emailDigest": false, "leadMinutes": 30}'::JSONB,
  onboarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT marketing_planner_settings_goals_check CHECK (
    goals <@ ARRAY['fill_open_nights', 'weekends', 'direct_bookings', 'longer_stays', 'brand']::TEXT[]
  ),
  CONSTRAINT marketing_planner_settings_cadence_check CHECK (
    cadence_preset IN ('light', 'steady', 'active', 'custom')
  ),
  CONSTRAINT marketing_planner_settings_language_check CHECK (
    language IN ('en', 'fil', 'taglish')
  ),
  CONSTRAINT marketing_planner_settings_tone_check CHECK (tone IN ('warm', 'playful', 'premium')),
  CONSTRAINT marketing_planner_settings_approval_check CHECK (
    approval_mode IN ('ask', 'auto_publish_connected')
  ),
  CONSTRAINT marketing_planner_settings_weekday_check CHECK (plan_weekday BETWEEN 0 AND 6)
);

CREATE INDEX IF NOT EXISTS idx_marketing_planner_settings_org
  ON public.marketing_planner_settings (organization_id);

DROP TRIGGER IF EXISTS update_marketing_planner_settings_updated_at ON public.marketing_planner_settings;
CREATE TRIGGER update_marketing_planner_settings_updated_at
  BEFORE UPDATE ON public.marketing_planner_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.marketing_planner_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_planner_settings TO service_role;

COMMENT ON TABLE public.marketing_planner_settings IS
  'Per-property Marketing Planner setup: goals, cadence, channels, language, reminders.';

-- 2. Marketing calendar events (platform + property) ---------------------------------------

CREATE TABLE IF NOT EXISTS public.marketing_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  property_id UUID REFERENCES public.properties (id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations (id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  country TEXT NOT NULL DEFAULT 'PH',
  region TEXT,
  weight NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
  source TEXT,
  metadata JSONB,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_calendar_events_scope_check CHECK (scope IN ('platform', 'property')),
  CONSTRAINT marketing_calendar_events_kind_check CHECK (
    kind IN (
      'regular_holiday',
      'special_non_working',
      'long_weekend',
      'season',
      'payday',
      'school_break',
      'local_event',
      'commercial'
    )
  ),
  CONSTRAINT marketing_calendar_events_dates_check CHECK (ends_on >= starts_on),
  CONSTRAINT marketing_calendar_events_platform_scope_check CHECK (
    (scope = 'platform' AND property_id IS NULL)
    OR (scope = 'property' AND property_id IS NOT NULL AND organization_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_marketing_calendar_events_window
  ON public.marketing_calendar_events (starts_on, ends_on);

CREATE INDEX IF NOT EXISTS idx_marketing_calendar_events_property_window
  ON public.marketing_calendar_events (property_id, starts_on, ends_on);

DROP TRIGGER IF EXISTS update_marketing_calendar_events_updated_at ON public.marketing_calendar_events;
CREATE TRIGGER update_marketing_calendar_events_updated_at
  BEFORE UPDATE ON public.marketing_calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.marketing_calendar_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_calendar_events TO service_role;

COMMENT ON TABLE public.marketing_calendar_events IS
  'Platform holiday/season rows plus host-added local events that drive Marketing Planner campaigns.';

-- 3. Plans (one per generation run) --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.marketing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  horizon_start DATE NOT NULL,
  horizon_end DATE NOT NULL,
  mode TEXT NOT NULL DEFAULT 'rules',
  trigger TEXT NOT NULL DEFAULT 'host',
  playbook_version TEXT NOT NULL,
  signals_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  summary TEXT,
  ai_model TEXT,
  prompt_id TEXT,
  prompt_version TEXT,
  credits_consumed INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  superseded_at TIMESTAMPTZ,
  CONSTRAINT marketing_plans_mode_check CHECK (mode IN ('rules', 'ai')),
  CONSTRAINT marketing_plans_trigger_check CHECK (trigger IN ('host', 'weekly_cron', 'event')),
  CONSTRAINT marketing_plans_horizon_check CHECK (horizon_end >= horizon_start)
);

CREATE INDEX IF NOT EXISTS idx_marketing_plans_property_created
  ON public.marketing_plans (property_id, created_at DESC);

ALTER TABLE public.marketing_plans ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_plans TO service_role;

COMMENT ON TABLE public.marketing_plans IS
  'One Marketing Planner generation run. Items in marketing_plan_items point back here.';

-- 4. Plan items ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.marketing_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code TEXT NOT NULL,
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.marketing_plans (id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'rules',
  opportunity_type TEXT,
  opportunity_key TEXT,
  title TEXT NOT NULL,
  pillar TEXT,
  objective TEXT,
  channel_kind TEXT NOT NULL,
  connection_id UUID REFERENCES public.social_channel_connections (id) ON DELETE SET NULL,
  manual_targets TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  format TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ,
  post_by TIMESTAMPTZ,
  target_from DATE,
  target_to DATE,
  claims JSONB NOT NULL DEFAULT '{}'::JSONB,
  brief JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'suggested',
  status_reason TEXT,
  asset_kind TEXT,
  asset_id UUID,
  asset_version_id UUID,
  publication_ids UUID[] NOT NULL DEFAULT '{}'::UUID[],
  tracked_url TEXT,
  posted_url TEXT,
  posted_at TIMESTAMPTZ,
  skipped_reason TEXT,
  results JSONB,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT marketing_plan_items_short_code_check CHECK (length(short_code) BETWEEN 6 AND 12),
  CONSTRAINT marketing_plan_items_source_check CHECK (source IN ('rules', 'ai', 'host', 'event')),
  CONSTRAINT marketing_plan_items_channel_check CHECK (
    channel_kind IN (
      'facebook_page',
      'instagram',
      'facebook_group',
      'tiktok',
      'messenger',
      'viber',
      'whatsapp',
      'google_business',
      'other'
    )
  ),
  CONSTRAINT marketing_plan_items_format_check CHECK (
    format IN ('post', 'carousel', 'story', 'reel', 'calendar')
  ),
  CONSTRAINT marketing_plan_items_status_check CHECK (
    status IN (
      'suggested',
      'planned',
      'preparing',
      'ready',
      'scheduled',
      'publishing',
      'published',
      'posted_manually',
      'held',
      'stale',
      'skipped',
      'expired',
      'failed'
    )
  ),
  CONSTRAINT marketing_plan_items_asset_kind_check CHECK (
    asset_kind IS NULL OR asset_kind IN ('template', 'ai_session', 'media')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketing_plan_items_short_code
  ON public.marketing_plan_items (short_code);

CREATE INDEX IF NOT EXISTS idx_marketing_plan_items_property_scheduled
  ON public.marketing_plan_items (property_id, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_marketing_plan_items_status_scheduled
  ON public.marketing_plan_items (status, scheduled_for);

-- One live item per opportunity per property; regenerating merges instead of duplicating.
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketing_plan_items_active_opportunity
  ON public.marketing_plan_items (property_id, opportunity_key)
  WHERE opportunity_key IS NOT NULL
    AND deleted_at IS NULL
    AND status NOT IN ('skipped', 'expired', 'failed');

DROP TRIGGER IF EXISTS update_marketing_plan_items_updated_at ON public.marketing_plan_items;
CREATE TRIGGER update_marketing_plan_items_updated_at
  BEFORE UPDATE ON public.marketing_plan_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.marketing_plan_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_plan_items TO service_role;

COMMENT ON TABLE public.marketing_plan_items IS
  'Dated Marketing Planner items: what to post, why, and the claims that must stay true.';

-- 5. Post insight snapshots -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.marketing_post_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES public.marketing_publications (id) ON DELETE CASCADE,
  plan_item_id UUID REFERENCES public.marketing_plan_items (id) ON DELETE SET NULL,
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  age_bucket TEXT NOT NULL,
  views INTEGER,
  reach INTEGER,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  saves INTEGER,
  interactions INTEGER,
  raw JSONB,
  metric_version TEXT NOT NULL,
  CONSTRAINT marketing_post_metrics_age_check CHECK (age_bucket IN ('24h', '72h', '7d', '28d')),
  UNIQUE (publication_id, age_bucket, metric_version)
);

CREATE INDEX IF NOT EXISTS idx_marketing_post_metrics_plan_item
  ON public.marketing_post_metrics (plan_item_id, captured_at DESC);

ALTER TABLE public.marketing_post_metrics ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_post_metrics TO service_role;

COMMENT ON TABLE public.marketing_post_metrics IS
  'Meta insight snapshots per publication at 24h / 72h / 7d / 28d age buckets.';

-- 6. Publishing support columns -------------------------------------------------------------

ALTER TABLE public.marketing_publications
  ADD COLUMN IF NOT EXISTS plan_item_id UUID REFERENCES public.marketing_plan_items (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS permalink TEXT,
  ADD COLUMN IF NOT EXISTS media_items JSONB,
  ADD COLUMN IF NOT EXISTS request_payload JSONB,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error_code TEXT;

CREATE INDEX IF NOT EXISTS idx_marketing_publications_plan_item
  ON public.marketing_publications (plan_item_id);

CREATE INDEX IF NOT EXISTS idx_marketing_publications_due
  ON public.marketing_publications (next_attempt_at)
  WHERE status = 'scheduled';

ALTER TABLE public.marketing_publications DROP CONSTRAINT IF EXISTS marketing_publications_status_check;
ALTER TABLE public.marketing_publications ADD CONSTRAINT marketing_publications_status_check CHECK (
  status IN ('pending', 'published', 'failed', 'scheduled', 'publishing', 'held', 'cancelled')
);

ALTER TABLE public.marketing_publications DROP CONSTRAINT IF EXISTS marketing_publications_publish_type_check;
ALTER TABLE public.marketing_publications ADD CONSTRAINT marketing_publications_publish_type_check CHECK (
  publish_type IN ('post', 'story', 'reel', 'carousel')
);

-- 7. Attribution on guest submissions -------------------------------------------------------

ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS attribution JSONB;

COMMENT ON COLUMN public.guest_submissions.attribution IS
  'First-touch UTM values + plan item code. No identifiers or PII.';

CREATE INDEX IF NOT EXISTS idx_property_page_views_campaign
  ON public.property_page_views (property_id, utm_campaign, viewed_at);

-- 8. Planner plan entitlements --------------------------------------------------------------

UPDATE public.pricing_plans
SET features = features || '{ "marketingPlanner": false, "aiMarketingPlanner": false }'::JSONB
WHERE code IN ('free', 'starter', 'commission');

UPDATE public.pricing_plans
SET features = features || '{ "marketingPlanner": true, "aiMarketingPlanner": false }'::JSONB
WHERE code = 'growth';

UPDATE public.pricing_plans
SET features = features || '{ "marketingPlanner": true, "aiMarketingPlanner": true }'::JSONB
WHERE code IN ('pro', 'managed', 'business_plus');

-- 9. Property team leaf: marketing.plan:edit ------------------------------------------------

CREATE OR REPLACE FUNCTION public._gfm_grant_leaf_if_has(
  raw jsonb,
  source_leaves text[],
  new_leaf text
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF raw IS NULL OR jsonb_typeof(raw) <> 'array' THEN
    RETURN raw;
  END IF;
  IF raw ? new_leaf THEN
    RETURN raw;
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(source_leaves) AS s(leaf) WHERE raw ? s.leaf
  ) THEN
    RETURN raw || to_jsonb(new_leaf);
  END IF;
  RETURN raw;
END;
$$;

UPDATE public.property_members
SET permissions = public._gfm_grant_leaf_if_has(
      permissions,
      ARRAY['marketing.content:add', 'marketing.content:edit'],
      'marketing.plan:edit'
    ),
    saved_permissions = public._gfm_grant_leaf_if_has(
      saved_permissions,
      ARRAY['marketing.content:add', 'marketing.content:edit'],
      'marketing.plan:edit'
    );

UPDATE public.property_custom_roles
SET permissions = public._gfm_grant_leaf_if_has(
  permissions,
  ARRAY['marketing.content:add', 'marketing.content:edit'],
  'marketing.plan:edit'
);

UPDATE public.property_invitations
SET permissions = public._gfm_grant_leaf_if_has(
  permissions,
  ARRAY['marketing.content:add', 'marketing.content:edit'],
  'marketing.plan:edit'
);

DROP FUNCTION public._gfm_grant_leaf_if_has(jsonb, text[], text);

-- 10. Notification types --------------------------------------------------------------------

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'booking_pending_review',
    'booking_ready_for_checkin',
    'booking_ready_for_checkout',
    'booking_sd_refund_due',
    'booking_gaf_auto_approved',
    'booking_pet_auto_approved',
    'booking_parking_matched',
    'inbox_new_message',
    'calendar_sync_failing',
    'calendar_conflict',
    'booking_external_imported',
    'booking_guest_form_completed',
    'smart_pricing_updated',
    'property_settings_copied',
    'analytics_review_updated',
    'review_received',
    'review_due',
    'review_response_received',
    'maintenance_guest_reported',
    'guest_request_submitted',
    'booking_receipt_uploaded',
    'booking_trip_viewed',
    'marketing_plan_ready',
    'marketing_item_due',
    'marketing_opportunity_urgent',
    'marketing_publish_held',
    'marketing_publish_failed'
  )
);

-- 11. Platform calendar seed — Philippine holidays 2026 -------------------------------------
-- Source: Proclamation No. 1006 (2025). 2027 rows are added by a super admin after the next
-- proclamation lands; long weekends are derived in code, never seeded.

INSERT INTO public.marketing_calendar_events
  (scope, kind, name, starts_on, ends_on, country, weight, source)
VALUES
  ('platform', 'regular_holiday', 'New Year''s Day', '2026-01-01', '2026-01-01', 'PH', 1.00, 'Proclamation 1006 (2025)'),
  ('platform', 'special_non_working', 'Chinese New Year', '2026-02-17', '2026-02-17', 'PH', 0.80, 'Proclamation 1006 (2025)'),
  ('platform', 'special_non_working', 'EDSA People Power Revolution Anniversary', '2026-02-25', '2026-02-25', 'PH', 0.60, 'Proclamation 1006 (2025)'),
  ('platform', 'regular_holiday', 'Maundy Thursday', '2026-04-02', '2026-04-02', 'PH', 1.00, 'Proclamation 1006 (2025)'),
  ('platform', 'regular_holiday', 'Good Friday', '2026-04-03', '2026-04-03', 'PH', 1.00, 'Proclamation 1006 (2025)'),
  ('platform', 'special_non_working', 'Black Saturday', '2026-04-04', '2026-04-04', 'PH', 1.00, 'Proclamation 1006 (2025)'),
  ('platform', 'regular_holiday', 'Araw ng Kagitingan', '2026-04-09', '2026-04-09', 'PH', 0.80, 'Proclamation 1006 (2025)'),
  ('platform', 'regular_holiday', 'Labor Day', '2026-05-01', '2026-05-01', 'PH', 0.90, 'Proclamation 1006 (2025)'),
  ('platform', 'regular_holiday', 'Independence Day', '2026-06-12', '2026-06-12', 'PH', 0.80, 'Proclamation 1006 (2025)'),
  ('platform', 'special_non_working', 'Ninoy Aquino Day', '2026-08-21', '2026-08-21', 'PH', 0.60, 'Proclamation 1006 (2025)'),
  ('platform', 'regular_holiday', 'National Heroes Day', '2026-08-31', '2026-08-31', 'PH', 0.80, 'Proclamation 1006 (2025)'),
  ('platform', 'special_non_working', 'All Saints'' Day', '2026-11-01', '2026-11-01', 'PH', 0.90, 'Proclamation 1006 (2025)'),
  ('platform', 'regular_holiday', 'Bonifacio Day', '2026-11-30', '2026-11-30', 'PH', 0.90, 'Proclamation 1006 (2025)'),
  ('platform', 'special_non_working', 'Feast of the Immaculate Conception', '2026-12-08', '2026-12-08', 'PH', 0.70, 'Proclamation 1006 (2025)'),
  ('platform', 'regular_holiday', 'Christmas Day', '2026-12-25', '2026-12-25', 'PH', 1.00, 'Proclamation 1006 (2025)'),
  ('platform', 'regular_holiday', 'Rizal Day', '2026-12-30', '2026-12-30', 'PH', 0.90, 'Proclamation 1006 (2025)'),
  ('platform', 'special_non_working', 'Last Day of the Year', '2026-12-31', '2026-12-31', 'PH', 1.00, 'Proclamation 1006 (2025)')
ON CONFLICT DO NOTHING;

INSERT INTO public.marketing_calendar_events
  (scope, kind, name, starts_on, ends_on, country, weight, source)
VALUES
  ('platform', 'season', 'Summer', '2026-03-01', '2026-05-31', 'PH', 1.00, 'Product default'),
  ('platform', 'season', 'Ber months', '2026-09-01', '2026-12-31', 'PH', 1.00, 'Product default'),
  ('platform', 'commercial', 'Valentine''s', '2026-02-01', '2026-02-14', 'PH', 0.70, 'Product default'),
  ('platform', 'school_break', 'Summer school break', '2026-04-01', '2026-05-31', 'PH', 0.80, 'Product default')
ON CONFLICT DO NOTHING;

COMMIT;
