-- Multi-residence Phase 0: in-flight booking safety and a reversible settings history.
--
-- 1. guest_submissions.document_requirements_snapshot — the approval steps a booking
--    started with. Phase 3 writes it on the first entry into PENDING_DOCUMENTS. Until
--    then every row is null and resolves live, exactly as today.
-- 2. development_settings_history — one row per save, holding the previous settings, so a
--    bad super-admin edit to a live residence is reversible in one click (Phase 4).

ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS document_requirements_snapshot jsonb NULL;

COMMENT ON COLUMN public.guest_submissions.document_requirements_snapshot IS
  'Resolved DocumentRequirement list captured on first entry into PENDING_DOCUMENTS. Null means resolve live (all existing bookings and every booking before Phase 3).';

CREATE TABLE IF NOT EXISTS public.development_settings_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid NOT NULL REFERENCES public.developments(id) ON DELETE CASCADE,
  settings jsonb NOT NULL,
  saved_by uuid NULL,
  saved_by_email text NULL,
  saved_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.development_settings_history IS
  'Previous developments.settings values, one per save. Restore writes the row back and appends another row. Pruned in Phase 4 (keep the newest 30 per development).';

CREATE INDEX IF NOT EXISTS development_settings_history_development_idx
  ON public.development_settings_history (development_id, saved_at DESC);

ALTER TABLE public.development_settings_history ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.development_settings_history TO service_role;
