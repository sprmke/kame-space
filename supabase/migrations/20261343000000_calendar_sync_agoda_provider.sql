-- Multi-channel calendar sync Phase 1a — allow the `agoda` provider.
-- Plan: docs/workflow/in-progress/multi-channel-calendar-sync.md §5 (M1)
--
-- Additive only. Constraint names verified against local Postgres (\d+):
--   property_calendar_feeds_provider_check, guest_submissions_external_source_check
-- No host can connect Agoda yet: `calendar-sync-settings#addFeed` still refuses anything
-- but the enabled providers, so this only makes the value storable.

ALTER TABLE public.property_calendar_feeds
  DROP CONSTRAINT IF EXISTS property_calendar_feeds_provider_check,
  ADD CONSTRAINT property_calendar_feeds_provider_check
    CHECK (provider IN ('airbnb', 'agoda', 'booking_com', 'vrbo', 'other'));

ALTER TABLE public.guest_submissions
  DROP CONSTRAINT IF EXISTS guest_submissions_external_source_check,
  ADD CONSTRAINT guest_submissions_external_source_check
    CHECK (external_source IN ('airbnb', 'agoda', 'booking_com', 'vrbo', 'other'));
