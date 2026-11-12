-- Multi-residence Phase 1: the development row owns the map pin and seed address.
--
-- Before this migration `create-property` / `create-parking` seeded Azure North's pin from
-- a TypeScript constant (`azureNorthLocationSeed`). The pin is now read from
-- `developments.settings`, so this backfills Azure North's exact values and leaves every
-- other residence with no pin (the host places it).
--
-- Only fills missing keys so a super admin who already set coordinates keeps them.

UPDATE public.developments
SET settings = settings || jsonb_build_object(
  'address', '2MWV+QVR, San Fernando, Pampanga, Philippines',
  'latitude', 15.1696,
  'longitude', 120.5598,
  'city', 'San Fernando',
  'province', 'Pampanga',
  'country', 'Philippines',
  'zipCode', '',
  'placeId', ''
)
WHERE slug = 'azure-north-residences'
  AND settings -> 'latitude' IS NULL
  AND settings -> 'longitude' IS NULL;

COMMENT ON COLUMN public.developments.settings IS
  'Residence Profile. `structure` (towers, formats, parking) and the map pin (`latitude` / `longitude` / `address` / `city` / `province` / `country`) are the runtime source of truth.';
