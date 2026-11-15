-- Flexible dates for public search (`/search?flex=N`).
--
-- `search_public_properties` and `search_public_parkings` accept an optional
-- `flexDays` (0 to 14, default 0). With dates set, a listing matches when the
-- requested stay, or the same-length stay shifted by up to `flexDays` days in
-- either direction, is free of non-cancelled bookings and owner blocks. Shifted
-- windows never start before today (Asia/Manila); the requested stay itself is
-- judged exactly as before, so a flexible search always returns at least what the
-- exact search returns. `flexDays = 0` is exactly the previous behavior.
-- Developments stay date-agnostic and are unchanged.
--
-- Both bodies are copied from 20261316126800_public_listing_search_index.sql with
-- only the declarations and the availability clause changed. Grants are unchanged
-- (CREATE OR REPLACE keeps the existing REVOKEs).

CREATE OR REPLACE FUNCTION public.search_public_properties(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_text_mode text := COALESCE(p ->> 'textMode', 'none');
  v_q text := lower(public.pls_trim(COALESCE(p ->> 'q', '')));
  v_pat text;
  v_terms text[] := ARRAY(
    SELECT DISTINCT lower(public.pls_trim(x))
    FROM unnest(public.pls_jsonb_text_array(p -> 'terms')) AS x
    WHERE public.pls_trim(x) <> ''
  );
  v_term_res text[];
  v_terms_any text;
  v_q_re text;
  v_concept_types text[] := ARRAY(SELECT upper(x) FROM unnest(public.pls_jsonb_text_array(p -> 'conceptTypes')) AS x);
  v_types text[] := ARRAY(SELECT lower(x) FROM unnest(public.pls_jsonb_text_array(p -> 'types')) AS x);
  v_amenities text[] := ARRAY(SELECT public.pls_trim(x) FROM unnest(public.pls_jsonb_text_array(p -> 'amenities')) AS x);
  v_devs text[] := ARRAY(SELECT lower(x) FROM unnest(public.pls_jsonb_text_array(p -> 'developments')) AS x);
  v_min double precision := (p ->> 'minPrice')::double precision;
  v_max double precision := (p ->> 'maxPrice')::double precision;
  v_bed double precision := (p ->> 'bedrooms')::double precision;
  v_guests integer := COALESCE((p ->> 'guests')::integer, 0);
  v_place text := NULLIF(lower(public.pls_trim(COALESCE(p ->> 'placeSlug', ''))), '');
  v_lat double precision := (p ->> 'lat')::double precision;
  v_lng double precision := (p ->> 'lng')::double precision;
  v_radius double precision := COALESCE((p ->> 'radiusKm')::double precision, 120);
  v_sw_lat double precision := (p ->> 'swLat')::double precision;
  v_sw_lng double precision := (p ->> 'swLng')::double precision;
  v_ne_lat double precision := (p ->> 'neLat')::double precision;
  v_ne_lng double precision := (p ->> 'neLng')::double precision;
  v_check_in date := (p ->> 'checkIn')::date;
  v_check_out date := (p ->> 'checkOut')::date;
  -- Flexible dates: also match a stay of the same length shifted up to N days either way.
  v_flex integer := LEAST(GREATEST(COALESCE((p ->> 'flexDays')::integer, 0), 0), 14);
  v_today date := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_order text := COALESCE(p ->> 'order', 'recommended');
  v_limit integer := LEAST(GREATEST(COALESCE((p ->> 'limit')::integer, 24), 0), 500);
  v_offset integer := GREATEST(COALESCE((p ->> 'offset')::integer, 0), 0);
  v_facets boolean := COALESCE((p ->> 'facets')::boolean, false);
  v_has_geo boolean;
  v_has_bbox boolean;
  v_has_dates boolean;
  result jsonb;
BEGIN
  v_has_geo := v_lat IS NOT NULL AND v_lng IS NOT NULL;
  v_has_bbox := v_sw_lat IS NOT NULL AND v_sw_lng IS NOT NULL AND v_ne_lat IS NOT NULL AND v_ne_lng IS NOT NULL;
  v_has_dates := v_check_in IS NOT NULL AND v_check_out IS NOT NULL AND v_check_in < v_check_out;
  IF v_text_mode IN ('ilike', 'literal') AND v_q <> '' THEN
    v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;
  v_q_re := public.pls_token_regex(v_q);
  v_term_res := ARRAY(SELECT public.pls_token_regex(t) FROM unnest(v_terms) WITH ORDINALITY AS u(t, ord) ORDER BY ord);
  -- One alternation regex = "any term is a substring of any field" (JS matchesExpandedTerms).
  v_terms_any := CASE WHEN cardinality(v_terms) > 0
    THEN '(' || array_to_string(ARRAY(SELECT public.pls_regex_escape(t) FROM unnest(v_terms) AS t), '|') || ')'
  END;

  WITH base AS MATERIALIZED (
    SELECT
      s.id,
      s.name,
      s.type_key,
      s.price,
      s.bedrooms,
      s.amenity_ids,
      s.rating,
      s.review_count,
      s.created_at,
      dev.slug AS dev_slug,
      dev.name AS dev_name,
      CASE WHEN v_has_geo THEN public.pls_haversine_km(v_lat, v_lng, s.lat, s.lng) END AS distance_km,
      CASE
        WHEN v_text_mode = 'literal' AND v_q <> ''
          THEN GREATEST(
            public.pls_field_rank(v_q, v_q_re, s.name),
            public.pls_field_rank(v_q, v_q_re, s.city),
            public.pls_field_rank(v_q, v_q_re, s.residence_name)
          )
        WHEN v_text_mode = 'concept'
          THEN (
            SELECT COALESCE(MAX(GREATEST(
              public.pls_field_rank(t.q, t.re, s.name),
              public.pls_field_rank(t.q, t.re, s.city),
              public.pls_field_rank(t.q, t.re, s.residence_name),
              (SELECT COALESCE(MAX(public.pls_field_rank(t.q, t.re, a)), 0) FROM unnest(s.amenity_ids) AS a)
            )), 0)
            FROM unnest(v_terms, v_term_res) AS t(q, re)
          )
        ELSE 0
      END AS text_rank
    FROM public.public_listing_search s
    LEFT JOIN (
      SELECT DISTINCT ON (lower(public.pls_trim(d.name)))
        lower(public.pls_trim(d.name)) AS name_key, d.slug, d.name
      FROM public.developments d
      WHERE d.status = 'ACTIVE'
      ORDER BY lower(public.pls_trim(d.name)), d.id DESC
    ) dev ON dev.name_key = s.residence_key
    WHERE s.family = 'property'
      AND (v_pat IS NULL OR s.name ILIKE v_pat OR s.city ILIKE v_pat OR s.residence_name ILIKE v_pat)
      AND (
        v_text_mode <> 'concept'
        OR upper(s.type_key) = ANY (v_concept_types)
        OR (
          v_terms_any IS NOT NULL
          AND lower(concat_ws(chr(31), s.name, s.city, s.residence_name, array_to_string(s.amenity_ids, chr(31)))) ~ v_terms_any
        )
      )
      AND (v_place IS NULL OR s.place_slug = v_place)
      AND (v_guests <= 0 OR s.capacity IS NULL OR s.capacity >= v_guests)
      AND (
        NOT v_has_geo
        OR (
          s.lat IS NOT NULL AND s.lng IS NOT NULL
          AND s.lat BETWEEN v_lat - v_radius / 111.0 AND v_lat + v_radius / 111.0
          AND public.pls_haversine_km(v_lat, v_lng, s.lat, s.lng) <= v_radius
        )
      )
      AND (
        NOT v_has_bbox
        OR (
          s.lat IS NOT NULL AND s.lng IS NOT NULL
          AND s.lat BETWEEN v_sw_lat AND v_ne_lat
          AND CASE WHEN v_sw_lng <= v_ne_lng
            THEN s.lng BETWEEN v_sw_lng AND v_ne_lng
            ELSE s.lng >= v_sw_lng OR s.lng <= v_ne_lng
          END
        )
      )
      AND (
        NOT v_has_dates
        OR EXISTS (
          SELECT 1
          FROM generate_series(-v_flex, v_flex) AS shift(d)
          WHERE (shift.d = 0 OR v_check_in + shift.d >= v_today)
            AND NOT EXISTS (
              SELECT 1 FROM public.guest_submissions g
              WHERE g.property_id = s.id
                AND g.status <> 'CANCELLED'
                AND g.check_in_date_sql < v_check_out + shift.d
                AND g.check_out_date_sql > v_check_in + shift.d
            )
            AND NOT EXISTS (
              SELECT 1 FROM public.property_blocked_dates b
              WHERE b.property_id = s.id
                AND b.start_date < v_check_out + shift.d
                AND b.end_date > v_check_in + shift.d
            )
        )
      )
  ),
  flags AS MATERIALIZED (
    SELECT
      b.*,
      (cardinality(v_types) = 0 OR b.type_key = ANY (v_types)) AS m_type,
      ((v_min IS NULL OR b.price >= v_min) AND (v_max IS NULL OR b.price <= v_max)) AS m_price,
      (
        v_bed IS NULL
        OR (b.bedrooms IS NOT NULL AND CASE WHEN v_bed >= 5 THEN b.bedrooms >= 5 ELSE b.bedrooms = v_bed END)
      ) AS m_bed,
      (cardinality(v_amenities) = 0 OR b.amenity_ids @> v_amenities) AS m_amen,
      (cardinality(v_devs) = 0 OR lower(b.dev_slug) = ANY (v_devs)) AS m_dev
    FROM base b
  ),
  hits AS (
    SELECT * FROM flags WHERE m_type AND m_price AND m_bed AND m_amen AND m_dev
  ),
  page AS (
    SELECT id, distance_km
    FROM hits
    ORDER BY
      CASE WHEN v_order = 'nearest' THEN distance_km END ASC NULLS LAST,
      CASE WHEN v_order = 'rank' THEN text_rank END DESC,
      CASE WHEN v_order IN ('recommended', 'rating') THEN COALESCE(rating, 0) END DESC,
      CASE WHEN v_order IN ('recommended', 'rating', 'reviews') THEN review_count END DESC,
      CASE WHEN v_order = 'reviews' THEN COALESCE(rating, 0) END DESC,
      CASE WHEN v_order = 'newest' THEN created_at END DESC,
      CASE WHEN v_order IN ('recommended', 'name', 'rank', 'nearest') THEN lower(name) END ASC,
      distance_km ASC NULLS LAST,
      id
    LIMIT v_limit OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM hits),
    'ids', COALESCE((SELECT jsonb_agg(id) FROM page), '[]'::jsonb),
    'facets', CASE WHEN v_facets THEN jsonb_build_object(
      'types', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('value', type_key, 'count', c) ORDER BY c DESC, type_key)
        FROM (
          SELECT type_key, count(*) AS c FROM flags
          WHERE m_price AND m_bed AND m_amen AND m_dev AND public.pls_trim(type_key) <> ''
          GROUP BY type_key
        ) x
      ), '[]'::jsonb),
      'price', (
        SELECT jsonb_build_object('min', COALESCE(min(price), 0), 'max', COALESCE(max(price), 0))
        FROM flags WHERE m_type AND m_bed AND m_amen AND m_dev
      ),
      'bedrooms', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('value', v, 'count', c) ORDER BY v)
        FROM (
          SELECT floor(bedrooms)::integer AS v, count(*) AS c FROM flags
          WHERE m_type AND m_price AND m_amen AND m_dev AND bedrooms IS NOT NULL
          GROUP BY floor(bedrooms)::integer
        ) x
      ), '[]'::jsonb),
      'amenities', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', a, 'count', c) ORDER BY c DESC, a)
        FROM (
          SELECT a, count(*) AS c FROM hits, unnest(amenity_ids) AS a GROUP BY a
        ) x
      ), '[]'::jsonb),
      'developments', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('slug', slug, 'name', name, 'count', c) ORDER BY c DESC, name)
        FROM (
          SELECT max(dev_slug) AS slug, max(dev_name) AS name, count(*) AS c FROM flags
          WHERE m_type AND m_price AND m_bed AND m_amen AND dev_slug IS NOT NULL
          GROUP BY lower(dev_slug)
        ) x
      ), '[]'::jsonb)
    ) END,
    'distances', CASE WHEN v_has_geo THEN COALESCE((
      SELECT jsonb_object_agg(id::text, distance_km) FROM page
    ), '{}'::jsonb) END
  )
  INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_public_parkings(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_text_mode text := COALESCE(p ->> 'textMode', 'none');
  v_q text := lower(public.pls_trim(COALESCE(p ->> 'q', '')));
  v_pat text;
  v_terms text[] := ARRAY(
    SELECT DISTINCT lower(public.pls_trim(x))
    FROM unnest(public.pls_jsonb_text_array(p -> 'terms')) AS x
    WHERE public.pls_trim(x) <> ''
  );
  v_term_res text[];
  v_terms_any text;
  v_q_re text;
  v_locations text[] := public.pls_jsonb_text_array(p -> 'locations');
  v_towers text[] := ARRAY(SELECT lower(x) FROM unnest(public.pls_jsonb_text_array(p -> 'towers')) AS x);
  v_dev_slug text := NULLIF(lower(public.pls_trim(COALESCE(p ->> 'developmentSlug', ''))), '');
  v_min double precision := (p ->> 'minPrice')::double precision;
  v_max double precision := (p ->> 'maxPrice')::double precision;
  v_place text := NULLIF(lower(public.pls_trim(COALESCE(p ->> 'placeSlug', ''))), '');
  v_lat double precision := (p ->> 'lat')::double precision;
  v_lng double precision := (p ->> 'lng')::double precision;
  v_radius double precision := COALESCE((p ->> 'radiusKm')::double precision, 120);
  v_sw_lat double precision := (p ->> 'swLat')::double precision;
  v_sw_lng double precision := (p ->> 'swLng')::double precision;
  v_ne_lat double precision := (p ->> 'neLat')::double precision;
  v_ne_lng double precision := (p ->> 'neLng')::double precision;
  v_check_in date := (p ->> 'checkIn')::date;
  v_check_out date := (p ->> 'checkOut')::date;
  -- Flexible dates: also match a stay of the same length shifted up to N days either way.
  v_flex integer := LEAST(GREATEST(COALESCE((p ->> 'flexDays')::integer, 0), 0), 14);
  v_today date := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_order text := COALESCE(p ->> 'order', 'tower');
  v_limit integer := LEAST(GREATEST(COALESCE((p ->> 'limit')::integer, 24), 0), 500);
  v_offset integer := GREATEST(COALESCE((p ->> 'offset')::integer, 0), 0);
  v_facets boolean := COALESCE((p ->> 'facets')::boolean, false);
  v_has_geo boolean;
  v_has_bbox boolean;
  v_has_dates boolean;
  result jsonb;
BEGIN
  v_has_geo := v_lat IS NOT NULL AND v_lng IS NOT NULL;
  v_has_bbox := v_sw_lat IS NOT NULL AND v_sw_lng IS NOT NULL AND v_ne_lat IS NOT NULL AND v_ne_lng IS NOT NULL;
  v_has_dates := v_check_in IS NOT NULL AND v_check_out IS NOT NULL AND v_check_in < v_check_out;
  IF v_text_mode IN ('ilike', 'literal') AND v_q <> '' THEN
    v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;
  v_q_re := public.pls_token_regex(v_q);
  v_term_res := ARRAY(SELECT public.pls_token_regex(t) FROM unnest(v_terms) WITH ORDINALITY AS u(t, ord) ORDER BY ord);
  -- One alternation regex = "any term is a substring of any field" (JS matchesExpandedTerms).
  v_terms_any := CASE WHEN cardinality(v_terms) > 0
    THEN '(' || array_to_string(ARRAY(SELECT public.pls_regex_escape(t) FROM unnest(v_terms) AS t), '|') || ')'
  END;

  WITH base AS MATERIALIZED (
    SELECT
      s.id,
      s.name,
      s.type_key,
      s.tower,
      s.price,
      s.created_at,
      CASE WHEN v_has_geo THEN public.pls_haversine_km(v_lat, v_lng, s.lat, s.lng) END AS distance_km,
      CASE
        WHEN v_text_mode = 'literal' AND v_q <> ''
          THEN GREATEST(
            public.pls_field_rank(v_q, v_q_re, s.name),
            public.pls_field_rank(v_q, v_q_re, s.residence_name),
            public.pls_field_rank(v_q, v_q_re, s.tower),
            public.pls_field_rank(v_q, v_q_re, s.city)
          )
        WHEN v_text_mode = 'concept'
          THEN (
            SELECT COALESCE(MAX(GREATEST(
              public.pls_field_rank(t.q, t.re, s.name),
              public.pls_field_rank(t.q, t.re, s.residence_name),
              public.pls_field_rank(t.q, t.re, s.tower),
              public.pls_field_rank(t.q, t.re, s.city)
            )), 0)
            FROM unnest(v_terms, v_term_res) AS t(q, re)
          )
        ELSE 0
      END AS text_rank
    FROM public.public_listing_search s
    LEFT JOIN (
      SELECT DISTINCT ON (lower(public.pls_trim(d.name)))
        lower(public.pls_trim(d.name)) AS name_key, d.slug
      FROM public.developments d
      WHERE d.status = 'ACTIVE'
      ORDER BY lower(public.pls_trim(d.name)), d.id DESC
    ) dev ON dev.name_key = s.residence_key
    WHERE s.family = 'parking'
      AND (v_dev_slug IS NULL OR lower(COALESCE(dev.slug, s.residence_slug)) = v_dev_slug)
      AND (
        v_pat IS NULL
        OR s.name ILIKE v_pat OR s.residence_name ILIKE v_pat OR s.tower ILIKE v_pat
        OR (v_text_mode = 'ilike' AND s.slot_label ILIKE v_pat)
        OR (v_text_mode = 'literal' AND s.city ILIKE v_pat)
      )
      AND (
        v_text_mode <> 'concept'
        OR (
          v_terms_any IS NOT NULL
          AND lower(concat_ws(chr(31), s.name, s.residence_name, s.tower, s.city)) ~ v_terms_any
        )
      )
      AND (v_place IS NULL OR s.place_slug = v_place)
      AND (
        NOT v_has_geo
        OR (
          s.lat IS NOT NULL AND s.lng IS NOT NULL
          AND s.lat BETWEEN v_lat - v_radius / 111.0 AND v_lat + v_radius / 111.0
          AND public.pls_haversine_km(v_lat, v_lng, s.lat, s.lng) <= v_radius
        )
      )
      AND (
        NOT v_has_bbox
        OR (
          s.lat IS NOT NULL AND s.lng IS NOT NULL
          AND s.lat BETWEEN v_sw_lat AND v_ne_lat
          AND CASE WHEN v_sw_lng <= v_ne_lng
            THEN s.lng BETWEEN v_sw_lng AND v_ne_lng
            ELSE s.lng >= v_sw_lng OR s.lng <= v_ne_lng
          END
        )
      )
      AND (
        NOT v_has_dates
        OR EXISTS (
          SELECT 1
          FROM generate_series(-v_flex, v_flex) AS shift(d)
          WHERE (shift.d = 0 OR v_check_in + shift.d >= v_today)
            AND NOT EXISTS (
              SELECT 1 FROM public.guest_submissions g
              WHERE g.parking_id = s.id
                AND g.status <> 'CANCELLED'
                AND public.pls_flexible_date(g.parking_check_in_date) < v_check_out + shift.d
                AND public.pls_flexible_date(g.parking_check_out_date) > v_check_in + shift.d
            )
            AND NOT EXISTS (
              SELECT 1 FROM public.parking_blocked_dates b
              WHERE b.parking_id = s.id
                AND b.start_date < v_check_out + shift.d
                AND b.end_date > v_check_in + shift.d
            )
        )
      )
  ),
  flags AS MATERIALIZED (
    SELECT
      b.*,
      (cardinality(v_locations) = 0 OR b.type_key = ANY (v_locations)) AS m_location,
      (cardinality(v_towers) = 0 OR (b.tower IS NOT NULL AND lower(b.tower) = ANY (v_towers))) AS m_tower,
      ((v_min IS NULL OR b.price >= v_min) AND (v_max IS NULL OR b.price <= v_max)) AS m_price
    FROM base b
  ),
  hits AS (
    SELECT * FROM flags WHERE m_location AND m_tower AND m_price
  ),
  page AS (
    SELECT id, distance_km
    FROM hits
    ORDER BY
      CASE WHEN v_order = 'nearest' THEN distance_km END ASC NULLS LAST,
      CASE WHEN v_order = 'rank' THEN text_rank END DESC,
      CASE WHEN v_order = 'tower' THEN COALESCE(tower, '') END ASC,
      CASE WHEN v_order = 'tower' THEN price END ASC,
      lower(name) ASC,
      distance_km ASC NULLS LAST,
      id
    LIMIT v_limit OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM hits),
    'ids', COALESCE((SELECT jsonb_agg(id) FROM page), '[]'::jsonb),
    'facets', CASE WHEN v_facets THEN jsonb_build_object(
      'locations', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('value', type_key, 'count', c) ORDER BY c DESC, type_key)
        FROM (
          SELECT type_key, count(*) AS c FROM flags
          WHERE m_tower AND m_price AND public.pls_trim(COALESCE(type_key, '')) <> ''
          GROUP BY type_key
        ) x
      ), '[]'::jsonb),
      'towers', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('value', v, 'count', c) ORDER BY c DESC, v)
        FROM (
          SELECT public.pls_trim(tower) AS v, count(*) AS c FROM flags
          WHERE m_location AND m_price AND type_key = 'inside_tower'
            AND public.pls_trim(COALESCE(tower, '')) <> ''
          GROUP BY public.pls_trim(tower)
        ) x
      ), '[]'::jsonb),
      'price', (
        SELECT jsonb_build_object('min', COALESCE(min(price), 0), 'max', COALESCE(max(price), 0))
        FROM flags WHERE m_location AND m_tower
      )
    ) END,
    'distances', CASE WHEN v_has_geo THEN COALESCE((
      SELECT jsonb_object_agg(id::text, distance_km) FROM page
    ), '{}'::jsonb) END
  )
  INTO result;

  RETURN result;
END;
$$;
