-- 13 — Public pages.
--
-- One published stay guide, one published showcase page and their page configs.
-- Safe to re-run.


DO $$
DECLARE
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
BEGIN
  INSERT INTO public.custom_pages (id, property_id, page_type, template_key)
  VALUES
    ('5eed7000-0000-4000-8000-000000000001', v_prop, 'stay_guide', 'coastal'),
    ('5eed7000-0000-4000-8000-000000000002', v_prop, 'property_showcase', 'gallery')
  ON CONFLICT (id) DO UPDATE SET
    page_type = EXCLUDED.page_type,
    template_key = EXCLUDED.template_key,
    updated_at = now();

  INSERT INTO public.public_page_configs (id, property_id, page_type, config)
  VALUES
    ('5eed7100-0000-4000-8000-000000000001', v_prop, 'stay_guide',
     '{"welcome":"Welcome to Monaco 2604. We are glad you are here.","wifiName":"AzureNorth-Guest","wifiPassword":"lagoon2026","checkIn":"Self check-in from 2pm. Keycard is in the lockbox beside the door.","checkOut":"Check-out is 11am. Leave the keycard on the kitchen counter.","rules":["No smoking indoors","Quiet hours 10pm to 7am","Please remove shoes indoors"],"contacts":[{"label":"Host","name":"Demo Host","phone":"0917 555 0101"}]}'::jsonb),
    ('5eed7100-0000-4000-8000-000000000002', v_prop, 'property_landing',
     '{"headline":"Lagoon-side living at Azure North","subheadline":"Two bedrooms, fast Wi-Fi, free parking.","showReviews":true,"showGallery":true}'::jsonb),
    ('5eed7100-0000-4000-8000-000000000003', v_prop, 'property_showcase',
     '{"sections":["gallery","amenities","location","reviews"],"heroImage":"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&q=85","hostBio":"We host a small set of lagoon-view units in San Fernando."}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET
    page_type = EXCLUDED.page_type,
    config = EXCLUDED.config,
    updated_at = now();

  RAISE NOTICE 'local seed: public pages seeded';
END $$;

