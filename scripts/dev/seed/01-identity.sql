-- 01 — Canonical local identity.
--
-- One organization, one development, one property, one parking.
--
--   org       kame-homes      Kame Space
--   property  kame-home       Monaco 2604, Azure North Residences
--   parking   monaco-level-2-slot-27
--
-- Also creates the seed owner login and the demo team / guest accounts used by
-- later files. Safe to re-run: every write is an upsert by fixed id/slug.
--
-- Cleanup rules (existing local DBs only):
--   * removes the retired Azure search fixtures only when every booking on them
--     is a seed/demo row;
--   * never touches rows outside the known fixture ids.


DO $$
DECLARE
  v_owner uuid := 'd74b9d44-6244-40f0-9160-7c281738e8c0';
  v_org uuid := '405ea07f-cc21-4bcc-b540-28729be79f0d';
  v_dev uuid := 'a1111111-1111-4111-8111-111111111100';
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
  v_park uuid := 'c3333333-3333-4333-8333-333333333301';
  v_guest uuid := '5eed0000-0000-4000-8000-000000000001';
  v_manager uuid := '5eed0000-0000-4000-8000-000000000002';
  v_ops uuid := '5eed0000-0000-4000-8000-000000000003';
  v_viewer uuid := '5eed0000-0000-4000-8000-000000000004';
  v_parking_staff uuid := '5eed0000-0000-4000-8000-000000000005';
BEGIN
  ---------------------------------------------------------------------------
  -- Auth users (email + password so local sign-in works without Google)
  ---------------------------------------------------------------------------
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES (
    v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'seed-owner@example.com', crypt('seed-password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  )
  VALUES (
    v_owner::text, v_owner,
    jsonb_build_object('sub', v_owner::text, 'email', 'seed-owner@example.com', 'email_verified', true),
    'email', now(), now(), now()
  )
  ON CONFLICT (provider_id, provider) DO NOTHING;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  SELECT entry.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         entry.email, crypt('seed-password', gen_salt('bf')), now(),
         '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  FROM (VALUES
    (v_guest, 'guest.demo@example.com'),
    (v_manager, 'manager.demo@example.com'),
    (v_ops, 'operations.demo@example.com'),
    (v_viewer, 'viewer.demo@example.com'),
    (v_parking_staff, 'parking.demo@example.com')
  ) AS entry(id, email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  )
  SELECT entry.id::text, entry.id,
         jsonb_build_object('sub', entry.id::text, 'email', entry.email, 'email_verified', true),
         'email', now(), now(), now()
  FROM (VALUES
    (v_guest, 'guest.demo@example.com'),
    (v_manager, 'manager.demo@example.com'),
    (v_ops, 'operations.demo@example.com'),
    (v_viewer, 'viewer.demo@example.com'),
    (v_parking_staff, 'parking.demo@example.com')
  ) AS entry(id, email)
  ON CONFLICT (provider_id, provider) DO NOTHING;

  -- GoTrue scans these token columns into strings; NULL breaks password sign-in.
  UPDATE auth.users
  SET confirmation_token = coalesce(confirmation_token, ''),
      email_change = coalesce(email_change, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      email_change_token_current = coalesce(email_change_token_current, ''),
      recovery_token = coalesce(recovery_token, ''),
      phone_change = coalesce(phone_change, ''),
      phone_change_token = coalesce(phone_change_token, ''),
      reauthentication_token = coalesce(reauthentication_token, '')
  WHERE id IN (v_owner, v_guest, v_manager, v_ops, v_viewer, v_parking_staff);

  ---------------------------------------------------------------------------
  -- Organization
  ---------------------------------------------------------------------------
  INSERT INTO public.organizations (id, owner_id, name, slug, description, host_modes, settings)
  VALUES (
    v_org, v_owner, 'Kame Space', 'kame-homes',
    'Local demo host for the canonical seed dataset.',
    ARRAY['property', 'parking']::text[],
    '{}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    owner_id = EXCLUDED.owner_id,
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    host_modes = EXCLUDED.host_modes;

  -- Org owner is implicit via owner_id. Seed one org admin membership.
  INSERT INTO public.organization_members (
    organization_id, user_id, role_id, status, display_name, permissions, all_listings
  )
  SELECT v_org, v_manager, 'ADMIN', 'active', 'Demo Manager', '[]'::jsonb, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = v_org AND user_id = v_manager
  );

  ---------------------------------------------------------------------------
  -- Development
  ---------------------------------------------------------------------------
  INSERT INTO public.developments (
    id, slug, name, developer_name, type, status, location, city, description,
    cover_image_url, settings
  )
  VALUES (
    v_dev, 'azure-north-residences', 'Azure North Residences', 'Century Properties',
    'CONDOMINIUM', 'ACTIVE', 'San Fernando, Pampanga', 'San Fernando',
    'Lagoon-themed resort residences in San Fernando, Pampanga.',
    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=85',
    jsonb_build_object(
      'images', jsonb_build_array(
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=85',
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=85',
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=85'
      ),
      'amenities', jsonb_build_array('Lagoon pool', 'Function room', 'Gym', '24/7 security'),
      'announcements', jsonb_build_array(
        jsonb_build_object(
          'id', 'ann-mock-dev-001',
          'severity', 'info',
          'title', 'Lagoon maintenance window',
          'body', 'The lagoon pool is closed for cleaning every first Tuesday, 6am to 10am.',
          'createdAt', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')
        )
      )
    )
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    developer_name = EXCLUDED.developer_name,
    type = EXCLUDED.type,
    status = EXCLUDED.status,
    location = EXCLUDED.location,
    city = EXCLUDED.city,
    description = EXCLUDED.description,
    cover_image_url = EXCLUDED.cover_image_url,
    settings = EXCLUDED.settings,
    updated_at = now();

  ---------------------------------------------------------------------------
  -- Property
  ---------------------------------------------------------------------------
  INSERT INTO public.properties (
    id, organization_id, name, slug, type, status, address, tower_and_unit,
    residence_name, max_guests, tower, unit_number, city, settings
  )
  VALUES (
    v_prop, v_org, 'Monaco 2604', 'kame-home', 'condo', 'ACTIVE',
    'Azure North Residences, Jose Abad Santos Ave, San Fernando, Pampanga',
    'Monaco 2604', 'Azure North Residences', 6, 'Monaco', '2604', 'San Fernando',
    jsonb_build_object(
      'description', 'Lagoon-view two-bedroom unit on the 26th floor of Monaco Tower. Fast Wi-Fi, full kitchen, and a balcony facing the resort lagoon.',
      'contactName', 'Demo Host',
      'contactRole', 'unit_owner',
      'contactPhone', '0917 555 0101',
      'contactEmail', 'host.demo@example.com',
      'city', 'San Fernando',
      'province', 'Pampanga',
      'country', 'Philippines',
      'zipCode', '2000',
      'latitude', 15.0286,
      'longitude', 120.6898,
      'mapsUrl', 'https://maps.google.com/?q=Azure+North+Residences+San+Fernando',
      'bedrooms', 2,
      'bathrooms', 2,
      'maxAdults', 4,
      'maxChildren', 2,
      'maxGuests', 6,
      'unitTypeId', '2br',
      'floors', 1,
      'checkInTime', '14:00',
      'checkOutTime', '11:00',
      'selfCheckIn', true,
      'cleaningBufferMinutes', 120,
      'allowPets', true,
      'allowParking', true,
      'allowSurpriseDecor', true,
      'preferredOwnerParkingId', v_park::text,
      'complimentaryOwnerParking', false,
      'cancellationPolicy', jsonb_build_object(
        'version', 2,
        'presetId', 'moderate',
        'tiers', jsonb_build_array(
          jsonb_build_object('daysBefore', 3, 'refundPercent', 100)
        ),
        'fallbackRefundPercent', 0
      ),
      'enabledAmenities', jsonb_build_array(
        'wifi', 'aircon', 'tv', 'kitchen', 'refrigerator', 'pool', 'parking',
        'balcony', 'smoke_alarm', 'security', 'gym', 'elevator', 'keycard_access',
        'scenic_view', 'cctv', 'fire_extinguisher', 'first_aid', 'smart_lock'
      ),
      'customAmenities', jsonb_build_array(
        jsonb_build_object('id', 'amenity-lagoon-view', 'name', 'Lagoon view', 'categoryId', 'outdoor')
      ),
      'enabledHouseRules', jsonb_build_array(
        'check_in_after', 'check_out_before', 'no_smoking', 'no_parties',
        'quiet_hours', 'pets_allowed', 'suitable_for_children', 'security_cameras'
      ),
      'customHouseRules', jsonb_build_array(
        jsonb_build_object('id', 'rule-shoes-off', 'name', 'Please remove shoes indoors', 'categoryId', 'general')
      ),
      'media', jsonb_build_array(
        jsonb_build_object('id', 'media-01', 'url', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=85', 'type', 'image', 'caption', 'Living area', 'isPrimary', true, 'order', 0),
        jsonb_build_object('id', 'media-02', 'url', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=85', 'type', 'image', 'caption', 'Bedroom', 'order', 1),
        jsonb_build_object('id', 'media-03', 'url', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=85', 'type', 'image', 'caption', 'Kitchen', 'order', 2),
        jsonb_build_object('id', 'media-04', 'url', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=85', 'type', 'image', 'caption', 'Balcony', 'order', 3),
        jsonb_build_object('id', 'media-05', 'url', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=85', 'type', 'image', 'caption', 'Lagoon', 'order', 4)
      ),
      'coverImage', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=85',
      'images', jsonb_build_array(
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=85',
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=85',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=85'
      )
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    type = EXCLUDED.type,
    status = EXCLUDED.status,
    address = EXCLUDED.address,
    tower_and_unit = EXCLUDED.tower_and_unit,
    residence_name = EXCLUDED.residence_name,
    max_guests = EXCLUDED.max_guests,
    tower = EXCLUDED.tower,
    unit_number = EXCLUDED.unit_number,
    city = EXCLUDED.city,
    settings = EXCLUDED.settings,
    inactive_reason = NULL,
    updated_at = now();

  ---------------------------------------------------------------------------
  -- Parking
  ---------------------------------------------------------------------------
  INSERT INTO public.parkings (
    id, organization_id, name, slug, status, residence_name, tower, level,
    slot_label, parking_type, rate_per_night, accepted_vehicle_types, settings
  )
  VALUES (
    v_park, v_org, 'Azure Monaco - Level 2 - Slot 27', 'monaco-level-2-slot-27',
    'ACTIVE', 'Azure North Residences', 'Monaco', 'Level 2', '27', 'inside_tower',
    350, ARRAY['car', 'motorcycle']::text[],
    jsonb_build_object(
      'description', 'Covered slot beside the Monaco lobby lift, fits one car or two motorcycles.',
      'coverImage', 'https://images.unsplash.com/photo-1590674899484-f5649e4292cf?w=1200&q=85',
      'images', jsonb_build_array(
        'https://images.unsplash.com/photo-1590674899484-f5649e4292cf?w=1200&q=85',
        'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=1200&q=85'
      ),
      'instantBooking', true,
      'minNights', 1,
      'maxNights', 30,
      'accessInstructions', 'Enter through the Monaco lobby, take the parking lift to Level 2, slot 27 is on the right.',
      'contactName', 'Demo Parking Host',
      'contactPhone', '0917 555 0202',
      'contactEmail', 'parking.demo@example.com'
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    status = EXCLUDED.status,
    residence_name = EXCLUDED.residence_name,
    tower = EXCLUDED.tower,
    level = EXCLUDED.level,
    slot_label = EXCLUDED.slot_label,
    parking_type = EXCLUDED.parking_type,
    rate_per_night = EXCLUDED.rate_per_night,
    accepted_vehicle_types = EXCLUDED.accepted_vehicle_types,
    settings = EXCLUDED.settings,
    updated_at = now();

  RAISE NOTICE 'local seed: canonical identity ready (org %, property %, parking %)', v_org, v_prop, v_park;
END $$;

