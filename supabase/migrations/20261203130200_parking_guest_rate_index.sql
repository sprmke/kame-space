-- G-1: the public listing search index stored the HOST weekday rate in `price`, while
-- checkout charges the PLATFORM guest rate. Lists, filters and sort therefore advertised one
-- price and the guest paid another. Redefine the parking refresh to store the guest rate and
-- refresh every parking when the singleton changes.

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

  -- The amount checkout charges (platform guest rate), not the host payout rate.
  SELECT COALESCE(pgs.guest_rate_weekday, 300)
  INTO weekday
  FROM public.platform_parking_settings pgs
  WHERE pgs.id = 1;

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

CREATE OR REPLACE FUNCTION public.pls_trg_platform_parking_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.parkings LOOP
    PERFORM public.pls_refresh_parking(r.id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pls_platform_parking_settings_sync ON public.platform_parking_settings;
CREATE TRIGGER pls_platform_parking_settings_sync
  AFTER INSERT OR UPDATE OF guest_rate_weekday ON public.platform_parking_settings
  FOR EACH ROW EXECUTE FUNCTION public.pls_trg_platform_parking_settings();

-- Backfill existing rows with the corrected price.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.parkings LOOP
    PERFORM public.pls_refresh_parking(r.id);
  END LOOP;
END $$;
