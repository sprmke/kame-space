-- Host-set parking pricing: the public parking search price is the host's own weekday rate
-- (parking_settings.weekday_nightly_rate). Supersedes the platform-guest-rate read in
-- 20261327000000_parking_guest_rate_index_fix.sql. The pls_parking_settings_sync trigger on
-- parking_settings already refreshes a listing whenever its weekday rate changes, and the
-- platform-settings trigger is no longer needed because the platform no longer sets a guest rate.
--
-- This migration is the last definition of pls_refresh_parking(); a source-level test in
-- parkingHardeningGates.test.ts fails if a later migration reads the platform guest rate again.

BEGIN;

CREATE OR REPLACE FUNCTION public.pls_refresh_parking(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.parkings%ROWTYPE;
  s jsonb;
  weekday numeric;
  settings_city text;
  place text;
BEGIN
  IF p_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO r FROM public.parkings WHERE id = p_id;
  IF NOT FOUND OR r.status IS DISTINCT FROM 'ACTIVE' THEN
    DELETE FROM public.public_listing_search WHERE family = 'parking' AND id = p_id;
    PERFORM public.pls_bump_catalog_version('parking');
    RETURN;
  END IF;

  s := CASE WHEN jsonb_typeof(r.settings) = 'object' THEN r.settings ELSE '{}'::jsonb END;
  settings_city := NULLIF(public.pls_json_string(s -> 'city'), '');
  place := public.pls_normalize_city_place(settings_city);

  -- Hosts set their own rate. The guest service fee is added at checkout, so the public list
  -- price is the host's weekday rate (default matches DEFAULT_PARKING_WEEKDAY).
  SELECT ps.weekday_nightly_rate
  INTO weekday
  FROM public.parking_settings ps
  WHERE ps.parking_id = p_id;

  INSERT INTO public.public_listing_search AS t (
    family, id, slug, name, city, place_label, place_slug, residence_name, residence_key,
    residence_slug, tower, slot_label, type_key, price, lat, lng, created_at, refreshed_at
  )
  VALUES (
    'parking',
    r.id,
    r.slug,
    r.name,
    settings_city,
    place,
    public.pls_location_slug(place),
    NULLIF(public.pls_trim(COALESCE(r.residence_name, '')), ''),
    NULLIF(lower(public.pls_trim(COALESCE(r.residence_name, ''))), ''),
    CASE WHEN NULLIF(public.pls_trim(COALESCE(r.residence_name, '')), '') IS NOT NULL
      THEN public.pls_slugify_name(r.residence_name) END,
    r.tower,
    r.slot_label,
    r.parking_type,
    COALESCE(weekday::double precision, 300),
    public.pls_listing_lat(s, r.residence_name),
    public.pls_listing_lng(s, r.residence_name),
    r.created_at,
    now()
  )
  ON CONFLICT (family, id) DO UPDATE SET
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    city = EXCLUDED.city,
    place_label = EXCLUDED.place_label,
    place_slug = EXCLUDED.place_slug,
    residence_name = EXCLUDED.residence_name,
    residence_key = EXCLUDED.residence_key,
    residence_slug = EXCLUDED.residence_slug,
    tower = EXCLUDED.tower,
    slot_label = EXCLUDED.slot_label,
    type_key = EXCLUDED.type_key,
    price = EXCLUDED.price,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    created_at = EXCLUDED.created_at,
    refreshed_at = now();

  PERFORM public.pls_bump_catalog_version('parking');
END;
$$;

REVOKE ALL ON FUNCTION public.pls_refresh_parking(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pls_refresh_parking(uuid) TO service_role;

DROP TRIGGER IF EXISTS pls_platform_parking_settings_sync ON public.platform_parking_settings;
DROP FUNCTION IF EXISTS public.pls_trg_platform_parking_settings();

-- Re-index every parking so the stored price is the host rate.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.parkings LOOP
    PERFORM public.pls_refresh_parking(r.id);
  END LOOP;
END $$;

COMMIT;
