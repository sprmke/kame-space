-- Calendar sync supports exactly three channels: Airbnb, Agoda and Booking.com.
-- Vrbo and "other calendar" are removed from the product, so the CHECKs stop accepting them.
-- Plan: docs/workflow/in-progress/multi-channel-calendar-sync.md §3
--
-- Guarded: each constraint is narrowed only when no row would violate it. If a stray row exists
-- the migration leaves that constraint as it was and says so. The engine already ignores
-- unsupported providers (`loadDueCalendarFeeds` filters them, `runFeedSync` skips them), so a
-- skipped narrowing is safe and can be retried after the rows are cleaned up.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.property_calendar_feeds
    WHERE provider NOT IN ('airbnb', 'agoda', 'booking_com')
  ) THEN
    RAISE NOTICE 'property_calendar_feeds has unsupported providers: provider CHECK left as is';
  ELSE
    ALTER TABLE public.property_calendar_feeds
      DROP CONSTRAINT IF EXISTS property_calendar_feeds_provider_check,
      ADD CONSTRAINT property_calendar_feeds_provider_check
        CHECK (provider IN ('airbnb', 'agoda', 'booking_com'));
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.guest_submissions
    WHERE external_source IS NOT NULL
      AND external_source NOT IN ('airbnb', 'agoda', 'booking_com')
  ) THEN
    RAISE NOTICE 'guest_submissions has unsupported external_source: CHECK left as is';
  ELSE
    ALTER TABLE public.guest_submissions
      DROP CONSTRAINT IF EXISTS guest_submissions_external_source_check,
      ADD CONSTRAINT guest_submissions_external_source_check
        CHECK (external_source IN ('airbnb', 'agoda', 'booking_com'));
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.calendar_export_reads
    WHERE channel NOT IN ('all', 'airbnb', 'agoda', 'booking_com')
  ) THEN
    RAISE NOTICE 'calendar_export_reads has unsupported channels: channel CHECK left as is';
  ELSE
    ALTER TABLE public.calendar_export_reads
      DROP CONSTRAINT IF EXISTS calendar_export_reads_channel_check,
      ADD CONSTRAINT calendar_export_reads_channel_check
        CHECK (channel IN ('all', 'airbnb', 'agoda', 'booking_com'));
  END IF;
END $$;
