-- 19 — Super admin surfaces.
--
-- Pending recommendation on the listing, three ops reports, twenty audit events,
-- one announcement per severity and platform support settings.
--
-- Feature availability stays fully enabled (no overrides) on purpose. Use
-- `bun run seed:feature-flags` when you want to test the disabled state.
--
-- Safe to re-run.


DO $$
DECLARE
  v_org uuid := '405ea07f-cc21-4bcc-b540-28729be79f0d';
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
  v_owner uuid := 'd74b9d44-6244-40f0-9160-7c281738e8c0';
  v_now_iso text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  DELETE FROM public.ops_reports WHERE id::text LIKE '5eedc%';
  DELETE FROM public.super_admin_audit_events WHERE id::text LIKE '5eedc%';

  ---------------------------------------------------------------------------
  -- Listing authorization: approved base, recommendation pending review
  ---------------------------------------------------------------------------
  UPDATE public.properties
  SET settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
        'listingAuthorization', jsonb_build_object(
          'relationship', 'owner',
          'contractEndDate', NULL,
          'baseStatus', 'approved',
          'recommendedStatus', 'pending',
          'baseSubmittedAt', to_char(now() - interval '45 days', 'YYYY-MM-DD"T"HH24:MI:SSOF'),
          'recommendedSubmittedAt', to_char(now() - interval '3 days', 'YYYY-MM-DD"T"HH24:MI:SSOF'),
          'baseRejectionReason', NULL,
          'recommendedRejectionReason', NULL,
          'baseRejectionKind', NULL,
          'recommendedRejectionKind', NULL,
          'assets', jsonb_build_object(
            'proofPath', 'seed/listing/ownership-proof.jpg',
            'additionalProofPath', NULL,
            'azurePmoConfirmationPath', 'seed/listing/pmo-confirmation.jpg'
          ),
          'lifecycle', jsonb_build_object(
            'noticesSent', '{}'::jsonb,
            'accessLockedAt', NULL,
            'consideration', jsonb_build_object(
              'status', 'none',
              'note', NULL,
              'expectedDate', NULL,
              'grantedUntil', NULL,
              'proofPaths', '[]'::jsonb,
              'audit', '[]'::jsonb,
              'selfServeUsedThisCycle', false,
              'allowConsiderationOverride', false
            )
          )
        )
      ),
      updated_at = now()
  WHERE id = v_prop;

  ---------------------------------------------------------------------------
  -- Ops reports
  ---------------------------------------------------------------------------
  INSERT INTO public.ops_reports (
    id, environment, period_kind, period_start, period_end, overall_status,
    counts, summary, markdown, generated_by, generated_at
  )
  VALUES
    ('5eedc100-0000-4000-8000-000000000001', 'non-production', 'weekly',
     now() - interval '7 days', now(), 'ok',
     '{"bookings":18,"errors":0,"cronsFailed":0,"supportTickets":1}'::jsonb,
     '{"headline":"All checks green","notes":"No failed crons or open incidents."}'::jsonb,
     '# Weekly ops report\n\nAll checks green. No failed crons or open incidents.',
     'cron', now() - interval '1 day'),
    ('5eedc100-0000-4000-8000-000000000002', 'non-production', 'weekly',
     now() - interval '14 days', now() - interval '7 days', 'warn',
     '{"bookings":14,"errors":2,"cronsFailed":1,"supportTickets":2}'::jsonb,
     '{"headline":"One cron retried","notes":"Calendar sync retried once and recovered."}'::jsonb,
     '# Weekly ops report\n\nOne calendar sync cron failed and recovered on retry.',
     'cron', now() - interval '8 days'),
    ('5eedc100-0000-4000-8000-000000000003', 'non-production', 'manual',
     now() - interval '3 days', now(), 'ok',
     '{"bookings":6,"errors":0,"cronsFailed":0,"supportTickets":0}'::jsonb,
     '{"headline":"Manual check after deploy","notes":"Smoke checks passed."}'::jsonb,
     '# Manual ops report\n\nSmoke checks passed after deploy.',
     'manual', now() - interval '3 days')
  ON CONFLICT (id) DO UPDATE SET
    overall_status = EXCLUDED.overall_status,
    counts = EXCLUDED.counts,
    summary = EXCLUDED.summary,
    markdown = EXCLUDED.markdown,
    generated_at = EXCLUDED.generated_at;

  ---------------------------------------------------------------------------
  -- Super-admin audit
  ---------------------------------------------------------------------------
  INSERT INTO public.super_admin_audit_events (
    id, actor_user_id, actor_email, action, target_type, target_id, summary, metadata, created_at
  )
  SELECT
    format('5eedc200-0000-4000-8000-%s', lpad(g.i::text, 12, '0'))::uuid,
    v_owner,
    'sprmke.dev@gmail.com',
    (ARRAY[
      'pricing_plan_updated','org_subscription_changed','feature_availability_updated',
      'host_verification_approved','listing_authorization_approved','support_ticket_replied',
      'platform_settings_updated','ai_limit_profile_assigned','development_updated',
      'payout_marked_sent'
    ])[1 + (g.i % 10)],
    (ARRAY['organization','property','pricing_plan','support_ticket','platform'])[1 + (g.i % 5)],
    CASE WHEN g.i % 5 = 0 THEN v_org::text ELSE v_prop::text END,
    (ARRAY[
      'Changed the org plan to Business',
      'Approved host verification',
      'Updated platform support settings',
      'Replied to a support ticket',
      'Updated a development announcement',
      'Marked a parking payout as sent'
    ])[1 + (g.i % 6)],
    jsonb_build_object('seed', true, 'index', g.i),
    now() - ((g.i * 2) || ' days')::interval
  FROM generate_series(0, 19) AS g(i);

  ---------------------------------------------------------------------------
  -- Platform announcements
  ---------------------------------------------------------------------------
  INSERT INTO public.platform_host_settings (id, announcements)
  VALUES (true, '[]'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.platform_host_settings
  SET announcements = jsonb_build_array(
        jsonb_build_object(
          'id', 'ann-mock-platform-critical',
          'title', 'Verify payout account',
          'body', 'Some hosts must reconfirm payout details before the next billing cycle. Open Finance if you see a banner.',
          'severity', 'critical', 'active', true, 'startsAt', NULL, 'endsAt', NULL,
          'linkUrl', NULL, 'linkLabel', NULL, 'updatedAt', v_now_iso
        ),
        jsonb_build_object(
          'id', 'ann-mock-platform-warning',
          'title', 'Meta inbox reconnect',
          'body', 'Facebook and Instagram channels show Disconnected until you re-authorize from Inbox, Channels.',
          'severity', 'warning', 'active', true, 'startsAt', NULL, 'endsAt', NULL,
          'linkUrl', NULL, 'linkLabel', NULL, 'updatedAt', v_now_iso
        ),
        jsonb_build_object(
          'id', 'ann-mock-platform-info',
          'title', 'Platform maintenance window',
          'body', 'Dashboard and API may be briefly unavailable this Sunday, 2:00 to 4:00 AM Asia/Manila.',
          'severity', 'info', 'active', true, 'startsAt', NULL, 'endsAt', NULL,
          'linkUrl', 'https://kamespace.com/help-support/announcements',
          'linkLabel', 'Learn more', 'updatedAt', v_now_iso
        )
      ),
      updated_at = now()
  WHERE id = true;

  ---------------------------------------------------------------------------
  -- Platform settings
  ---------------------------------------------------------------------------
  UPDATE public.platform_settings
  SET support_email = 'support@kamespace.com',
      legal_terms_url = 'https://kamespace.com/terms',
      legal_privacy_url = 'https://kamespace.com/privacy',
      default_plan_code = 'free',
      signups_enabled = true,
      maintenance_mode = false,
      -- Local automated walkers load many routes quickly; keep the production
      -- limits in docs, not in the local fixture.
      public_rate_limit_per_min = greatest(public_rate_limit_per_min, 600),
      authenticated_rate_limit_per_min = greatest(authenticated_rate_limit_per_min, 600),
      updated_at = now()
  WHERE id = 1;

  ---------------------------------------------------------------------------
  -- System health: one heartbeat per cron job + cached credential probes
  ---------------------------------------------------------------------------
  INSERT INTO public.system_job_heartbeats (
    job_name, last_started_at, last_finished_at, last_success_at, last_failure_at,
    last_status, last_error, last_duration_ms, consecutive_failures,
    total_runs, total_failures, updated_at
  )
  SELECT
    job,
    now() - interval '10 minutes',
    now() - interval '9 minutes',
    CASE WHEN job = 'calendar-sync-cron' THEN now() - interval '2 hours' ELSE now() - interval '9 minutes' END,
    CASE WHEN job = 'calendar-sync-cron' THEN now() - interval '9 minutes' END,
    CASE WHEN job = 'calendar-sync-cron' THEN 'error' ELSE 'ok' END,
    CASE WHEN job = 'calendar-sync-cron' THEN 'Airbnb feed returned HTTP 502' END,
    1200 + (row_number() OVER () * 37)::int,
    CASE WHEN job = 'calendar-sync-cron' THEN 2 ELSE 0 END,
    240, CASE WHEN job = 'calendar-sync-cron' THEN 3 ELSE 0 END,
    now()
  FROM unnest(ARRAY[
    'sd-refund-cron','telegram-marketing-cron','telegram-staff-cron','telegram-admin-cron',
    'telegram-finance-cron','telegram-maintenance-cron','expire-parking-broadcasts',
    'send-parking-reminders','complete-parking-bookings','contract-expiry-cron',
    'dashboard-assistant-expire-pending-actions','meta-inbox-webhook-healthcheck',
    'platform-billing-cron','calendar-sync-cron','smart-pricing-cron','superhost-assessment-cron',
    'analytics-ai-review-cron','property-page-views-prune-cron','activity-log-retention-cron',
    'marketing-generation-sweeper','query-cache-sweep-cron','voice-receptionist-reaper',
    'voice-receptionist-canary','review-lifecycle-cron','ops-report-cron'
  ]) AS job
  ON CONFLICT (job_name) DO UPDATE SET
    last_started_at = EXCLUDED.last_started_at,
    last_finished_at = EXCLUDED.last_finished_at,
    last_success_at = EXCLUDED.last_success_at,
    last_failure_at = EXCLUDED.last_failure_at,
    last_status = EXCLUDED.last_status,
    last_error = EXCLUDED.last_error,
    last_duration_ms = EXCLUDED.last_duration_ms,
    consecutive_failures = EXCLUDED.consecutive_failures,
    total_runs = EXCLUDED.total_runs,
    total_failures = EXCLUDED.total_failures,
    updated_at = now();

  INSERT INTO public.system_health_probe_results (
    probe_id, status, detail, latency_ms, meta, checked_at
  )
  VALUES
    ('resend', 'ok', 'RESEND_API_KEY is configured', 180, '{"seed":true}'::jsonb, now()),
    ('gemini', 'off', 'GEMINI_API_KEY is not set locally', 0, '{"seed":true}'::jsonb, now()),
    ('groq', 'off', 'GROQ_API_KEY is not set locally', 0, '{"seed":true}'::jsonb, now()),
    ('paymongo', 'ok', 'PAYMONGO_SECRET_KEY is configured', 210, '{"seed":true}'::jsonb, now()),
    ('meta_app', 'off', 'META_APP_ID is not set locally', 0, '{"seed":true}'::jsonb, now()),
    ('meta_pages', 'off', 'No Meta page token locally', 0, '{"seed":true}'::jsonb, now()),
    ('telegram', 'off', 'No Telegram bot token locally', 0, '{"seed":true}'::jsonb, now()),
    ('turnstile', 'off', 'Turnstile is disabled locally', 0, '{"seed":true}'::jsonb, now()),
    ('jamendo', 'off', 'JAMENDO_CLIENT_ID is not set locally', 0, '{"seed":true}'::jsonb, now()),
    ('supabase_auth', 'ok', 'Local GoTrue responded', 95, '{"seed":true}'::jsonb, now())
  ON CONFLICT (probe_id) DO UPDATE SET
    status = EXCLUDED.status,
    detail = EXCLUDED.detail,
    latency_ms = EXCLUDED.latency_ms,
    meta = EXCLUDED.meta,
    checked_at = EXCLUDED.checked_at;

  RAISE NOTICE 'local seed: super-admin surfaces seeded';
END $$;

