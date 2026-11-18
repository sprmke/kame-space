-- Multi-channel calendar sync Phase 1b — close grant residue on the two calendar tables.
-- Plan: docs/workflow/in-progress/multi-channel-calendar-sync.md §8
--
-- Both tables were created earlier (20261213120000) with RLS enabled and no policies, but the
-- default Supabase schema grants leave TRUNCATE / TRIGGER / REFERENCES with anon and
-- authenticated. RLS does not cover those, so close them the same way as 20261343000600.

REVOKE ALL ON TABLE public.property_calendar_feeds, public.property_calendar_export
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.property_calendar_feeds, public.property_calendar_export
  TO service_role;
