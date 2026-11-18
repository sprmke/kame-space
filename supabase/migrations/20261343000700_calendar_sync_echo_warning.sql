-- Multi-channel calendar sync Phase 1b — per-channel echo warning.
-- Plan: docs/workflow/in-progress/multi-channel-calendar-sync.md §4.4
--
-- Booking.com can export "reserved and closed dates". When it does, our own exported nights come
-- back as events. Echo detection stops them becoming bookings, but the host still has to fix the
-- export setting, so the feed remembers that the last pull looked like a closed-dates echo.

ALTER TABLE public.property_calendar_feeds
  ADD COLUMN IF NOT EXISTS echo_warning_at timestamptz;

COMMENT ON COLUMN public.property_calendar_feeds.echo_warning_at IS
  'Set when the latest pull looked like the channel exported closed dates as well as reservations. '
  'Cleared automatically on the next pull without the tell.';
