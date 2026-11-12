-- 03b — Second residence for local multi-residence work.
--
-- Local dev must never be single-residence, or generic-fallback bugs hide. This row is
-- deliberately NOT Azure: no towers, alnum unit numbers, pets not allowed, and two
-- approval steps that exercise both a manual tick and a generated PDF.
--
-- INACTIVE on purpose: it must not appear in public search or the guest directory. No
-- property or parking is linked to it yet (Phase 1 adds the onboarding picker).
--
-- Safe to re-run. One DO block because the seed runner sends one statement per file.

DO $$
BEGIN
  INSERT INTO public.developments (
    id,
    slug,
    name,
    developer_name,
    type,
    status,
    location,
    city,
    description,
    settings
  )
  VALUES (
    'd0d0d0d0-0000-4000-8000-000000000002',
    'test-residence',
    'Test Residence',
    'Local Seed',
    'SUBDIVISION',
    'INACTIVE',
    'Local only',
    'Local only',
    'Local fixture residence used to prove a second building works without Azure values.',
    jsonb_build_object(
      'pmoEmail', 'admin@test-residence.local',
      'structure', jsonb_build_object(
        'towerLabel', 'Phase',
        'unitLabel', 'Block & Lot',
        'towersRequired', false,
        'propertyTowers', '[]'::jsonb,
        'parkingTowers', '[]'::jsonb,
        'unitNumberFormat', jsonb_build_object('preset', 'alnum', 'example', 'Blk 3 Lot 5'),
        'parkingSlotFormat', jsonb_build_object('preset', 'alnum', 'example', 'P-12'),
        'floorsMax', 2
      ),
      'occupancy', jsonb_build_object(
        'maxAdultsCap', 4,
        'maxChildrenCap', 3,
        'childMaxAge', 3,
        'adultMinAge', 18,
        'idRequiredFromAge', 18,
        'primaryGuestMinAge', 18
      ),
      'stay', jsonb_build_object(
        'checkInTime', '14:00',
        'checkOutTime', '12:00',
        'petsAllowed', false,
        'paidParkingAvailable', false,
        'surpriseDecorAllowed', true,
        'petTypes', '[]'::jsonb,
        'petVaccinationRequired', false
      ),
      'approvals', jsonb_build_object(
        'buildingAdminLabel', 'HOA',
        'ccPropertyEmail', false,
        'pdfTemplates', jsonb_build_array(
          jsonb_build_object(
            'id', 'move-in-permit',
            'name', 'Move-in permit',
            'storagePath', 'developments/test-residence/move-in-permit.pdf',
            'fieldMap', jsonb_build_object(
              'GuestName', 'guest.primary.nameWithAge',
              'UnitNumber', 'property.towerAndUnit',
              'MoveInDate', 'stay.checkInDate'
            ),
            'signatureField', 'OwnerSignature',
            'signatureNameField', 'OwnerName',
            'version', 1
          )
        )
      ),
      'workflowDefaults', jsonb_build_object(
        'documentRequirements', jsonb_build_array(
          jsonb_build_object(
            'id', 'move-in-permit',
            'label', 'Move-in permit',
            'order', 1,
            'pdfTemplateId', 'move-in-permit',
            'approvalSource', 'manual',
            'triggerCondition', 'always',
            'calendarIcon', '📄'
          ),
          jsonb_build_object(
            'id', 'hoa-clearance',
            'label', 'HOA clearance',
            'order', 2,
            'pdfTemplateId', null,
            'approvalSource', 'manual',
            'triggerCondition', 'always',
            'calendarIcon', null
          )
        )
      ),
      'terms', jsonb_build_object(
        'buildingAdmin', 'HOA',
        'buildingAdminLong', 'Homeowners association',
        'arrivalCheckpoint', 'the gate'
      )
    )
  )
  ON CONFLICT (slug) DO UPDATE
  SET settings = EXCLUDED.settings,
      type = EXCLUDED.type,
      status = EXCLUDED.status,
      updated_at = now();

  -- Link the canonical property and parking to their development. The Phase 0 migration
  -- backfills existing rows, but the seed creates these rows after migrations run, so the
  -- link is set here explicitly.
  UPDATE public.properties p
  SET development_id = d.id
  FROM public.developments d
  WHERE p.slug = 'kame-home'
    AND d.slug = 'azure-north-residences'
    AND p.development_id IS DISTINCT FROM d.id;

  UPDATE public.parkings k
  SET development_id = d.id
  FROM public.developments d
  WHERE k.slug = 'monaco-level-2-slot-27'
    AND d.slug = 'azure-north-residences'
    AND k.development_id IS DISTINCT FROM d.id;
END $$;
