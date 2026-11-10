-- Multi-residence Phase 0: link properties and parkings to developments by id.
--
-- See docs/workflow/in-progress/multi-residence-config-decoupling.md §4.5.
--
-- Additive and reversible. `residence_name` stays as the denormalized display column, so
-- every existing read path keeps working while nothing reads `development_id` yet.
-- Phase 1 moves resolution onto the FK. Phase 7 drops the name column.

-- Columns --------------------------------------------------------------------------

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS development_id uuid;

ALTER TABLE public.parkings
  ADD COLUMN IF NOT EXISTS development_id uuid;

COMMENT ON COLUMN public.properties.development_id IS
  'Residence profile this property belongs to. Null means unmatched: it resolves the generic profile, never Azure.';
COMMENT ON COLUMN public.parkings.development_id IS
  'Residence profile this parking belongs to. Null means unmatched: it resolves the generic profile, never Azure.';

-- RESTRICT: a development with linked assets cannot be deleted. `delete-development`
-- already blocks on a name count; the FK makes it a database fact, not a convention.
DO $$
BEGIN
  ALTER TABLE public.properties
    ADD CONSTRAINT properties_development_id_fkey
    FOREIGN KEY (development_id) REFERENCES public.developments(id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.parkings
    ADD CONSTRAINT parkings_development_id_fkey
    FOREIGN KEY (development_id) REFERENCES public.developments(id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Backfill by trimmed, case-insensitive name. Idempotent: only fills nulls.
UPDATE public.properties p
SET development_id = d.id
FROM public.developments d
WHERE p.development_id IS NULL
  AND p.residence_name IS NOT NULL
  AND lower(btrim(p.residence_name)) = lower(btrim(d.name));

UPDATE public.parkings k
SET development_id = d.id
FROM public.developments d
WHERE k.development_id IS NULL
  AND k.residence_name IS NOT NULL
  AND lower(btrim(k.residence_name)) = lower(btrim(d.name));

-- Indexes --------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS properties_development_id_idx
  ON public.properties (development_id);

CREATE INDEX IF NOT EXISTS parkings_development_id_idx
  ON public.parkings (development_id);

-- Unmatched-row report -------------------------------------------------------------

-- The migration cannot invent a link. This view is the review queue: every row here is
-- either linked by a super admin or knowingly left on the generic profile.
CREATE OR REPLACE VIEW public.development_unmatched_assets AS
SELECT
  'property'::text AS asset_type,
  p.id AS asset_id,
  p.organization_id,
  p.residence_name,
  p.name AS asset_name,
  p.status,
  p.created_at
FROM public.properties p
WHERE p.development_id IS NULL
UNION ALL
SELECT
  'parking'::text AS asset_type,
  k.id AS asset_id,
  k.organization_id,
  k.residence_name,
  k.name AS asset_name,
  k.status,
  k.created_at
FROM public.parkings k
WHERE k.development_id IS NULL;

COMMENT ON VIEW public.development_unmatched_assets IS
  'Properties and parkings with no development_id. Reviewed once in Phase 0, then expected empty before development_id becomes NOT NULL in Phase 7.';

GRANT SELECT ON public.development_unmatched_assets TO service_role;
