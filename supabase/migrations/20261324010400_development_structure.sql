-- Multi-residence Phase 1: move tower / level / format rules into `settings.structure`.
--
-- Before this migration the only source of truth was TypeScript: `propertyResidences.ts`,
-- `parkingResidences.ts` and `propertyResidenceDefaults.ts`. The flat
-- `settings.propertyTowers` / `parkingTowers` / `parkingLevels` keys were write-only orphans.
--
-- This migration writes the structure shape the resolver reads. The flat keys are left in
-- place until Phase 7 so a rollback keeps working.
--
-- Azure North is set explicitly so its behaviour is byte-identical: Monaco / Bali /
-- Barbados, Bay parking ground-level only and outside the tower, 4-digit units, floors 29.

-- Azure North first, so the generic loop below does not overwrite it.
UPDATE public.developments
SET settings = jsonb_set(
  settings,
  '{structure}',
  '{
    "towerLabel": "Tower",
    "unitLabel": "Unit",
    "towersRequired": true,
    "propertyTowers": [
      { "name": "Monaco", "code": "Monaco", "active": true },
      { "name": "Bali", "code": "Bali", "active": true },
      { "name": "Barbados", "code": "Barbados", "active": true }
    ],
    "parkingTowers": [
      { "name": "Monaco", "code": "M", "active": true, "levels": ["Level 1", "Level 2", "Level 3"], "parkingType": "inside_tower" },
      { "name": "Bali", "code": "BL", "active": true, "levels": ["Level 1", "Level 2", "Level 3"], "parkingType": "inside_tower" },
      { "name": "Barbados", "code": "BB", "active": true, "levels": ["Level 1", "Level 2", "Level 3"], "parkingType": "inside_tower" },
      { "name": "Bay", "code": "BY", "active": true, "levels": ["Level 1"], "parkingType": "outside_tower" }
    ],
    "unitNumberFormat": { "preset": "digits4", "example": "2604" },
    "parkingSlotFormat": { "preset": "digits1to4", "example": "26" },
    "floorsMax": 29
  }'::jsonb,
  true
)
WHERE slug = 'azure-north-residences'
  AND settings -> 'structure' IS NULL;

-- Every other development: derive the shape from whatever flat keys it already has.
DO $$
DECLARE
  d record;
  v_flat_towers jsonb;
  v_flat_parking jsonb;
  v_flat_levels jsonb;
  v_property_towers jsonb;
  v_parking_towers jsonb;
  v_unit_preset text;
  v_unit_example text;
BEGIN
  FOR d IN
    SELECT id, type, settings
    FROM public.developments
    WHERE settings -> 'structure' IS NULL
  LOOP
    v_flat_towers := CASE
      WHEN jsonb_typeof(d.settings -> 'propertyTowers') = 'array' THEN d.settings -> 'propertyTowers'
      ELSE '[]'::jsonb
    END;
    v_flat_parking := CASE
      WHEN jsonb_typeof(d.settings -> 'parkingTowers') = 'array' THEN d.settings -> 'parkingTowers'
      ELSE '[]'::jsonb
    END;
    v_flat_levels := CASE
      WHEN jsonb_typeof(d.settings -> 'parkingLevels') = 'array' THEN d.settings -> 'parkingLevels'
      ELSE '[]'::jsonb
    END;

    SELECT COALESCE(
      jsonb_agg(jsonb_build_object('name', value, 'code', value, 'active', true)),
      '[]'::jsonb
    )
    INTO v_property_towers
    FROM jsonb_array_elements_text(v_flat_towers);

    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'name', value,
          'code', value,
          'active', true,
          'levels', v_flat_levels,
          'parkingType', 'inside_tower'
        )
      ),
      '[]'::jsonb
    )
    INTO v_parking_towers
    FROM jsonb_array_elements_text(v_flat_parking);

    -- A subdivision or townhouse has no tower concept by default.
    IF d.type IN ('SUBDIVISION', 'TOWNHOUSE') THEN
      v_unit_preset := 'alnum';
      v_unit_example := 'Blk 3 Lot 5';
    ELSE
      v_unit_preset := 'alnum';
      v_unit_example := '0101';
    END IF;

    UPDATE public.developments
    SET settings = jsonb_set(
      settings,
      '{structure}',
      jsonb_build_object(
        'towerLabel', CASE WHEN d.type IN ('SUBDIVISION', 'TOWNHOUSE') THEN 'Phase' ELSE 'Tower' END,
        'unitLabel', CASE WHEN d.type IN ('SUBDIVISION', 'TOWNHOUSE') THEN 'Block & Lot' ELSE 'Unit' END,
        'towersRequired', jsonb_array_length(v_property_towers) > 0,
        'propertyTowers', v_property_towers,
        'parkingTowers', v_parking_towers,
        'unitNumberFormat', jsonb_build_object('preset', v_unit_preset, 'example', v_unit_example),
        'parkingSlotFormat', jsonb_build_object('preset', 'digits1to4', 'example', '26'),
        'floorsMax', NULL
      ),
      true
    )
    WHERE id = d.id;
  END LOOP;
END $$;

COMMENT ON COLUMN public.developments.settings IS
  'Residence Profile. `structure` holds tower, unit/format and parking rules (Phase 1); `structure` is the runtime source of truth. Flat propertyTowers/parkingTowers/parkingLevels are retired in Phase 7.';
