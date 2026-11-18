-- Multi-channel calendar sync Phase 1b — remember a channel that never read our export link.
-- Plan: docs/workflow/in-progress/multi-channel-calendar-sync.md §4.9, §9
--
-- "Agoda hasn't read your link yet" is the most common setup mistake (the link was never pasted,
-- or the channel deactivated it). Detection runs in the sweep and is emitted once per feed.

ALTER TABLE public.property_calendar_feeds
  ADD COLUMN IF NOT EXISTS export_never_read_at timestamptz;

COMMENT ON COLUMN public.property_calendar_feeds.export_never_read_at IS
  'Set once by the sweep when a feed older than 24 h has no export read for its channel. '
  'Host-visible setup hint and one PostHog outcome event; never cleared automatically.';
