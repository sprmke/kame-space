-- Multi-residence Phase 0: tower + unit uniqueness is scoped to the residence.
--
-- Before: `properties_tower_unit_active_unique ON (lower(tower), unit_number)`, so
-- "Tower 1 / 0101" in two different residences collided.
-- After: the same tower + unit is still unique inside one residence, and two residences
-- can each have it.
--
-- `development_id` is nullable until Phase 7. Postgres treats NULLs as distinct in a
-- unique index, so unmatched rows are not blocked by this index. That is deliberate: it
-- never rejects data the old index rejected, and the unmatched-row report drives linking.

DROP INDEX IF EXISTS public.properties_tower_unit_active_unique;

CREATE UNIQUE INDEX IF NOT EXISTS properties_tower_unit_active_unique
  ON public.properties (development_id, lower(tower), unit_number)
  WHERE status = 'ACTIVE'
    AND tower IS NOT NULL
    AND unit_number IS NOT NULL;

COMMENT ON INDEX public.properties_tower_unit_active_unique IS
  'At most one ACTIVE property per residence + tower + unit. INACTIVE duplicates allowed for succession. Null development_id is unmatched and not constrained.';
