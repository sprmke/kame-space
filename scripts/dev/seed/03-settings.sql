-- 03 — Settings.
--
-- Fills every settings surface at org, property and parking level so the
-- settings pages have no empty sections:
--   organizations.settings   branding, contact, verification, socials
--   org_settings             email + social defaults
--   app_settings             payment methods, rates, GAF details, vouchers
--   parking_settings         rates, payment, notification templates
--
-- Safe to re-run.


DO $$
DECLARE
  v_owner uuid := 'd74b9d44-6244-40f0-9160-7c281738e8c0';
  v_org uuid := '405ea07f-cc21-4bcc-b540-28729be79f0d';
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
  v_park uuid := 'c3333333-3333-4333-8333-333333333301';
  v_owner_member uuid;
BEGIN
  ---------------------------------------------------------------------------
  -- Organization settings
  ---------------------------------------------------------------------------
  UPDATE public.organizations
  SET settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
        'tagline', 'Lagoon-side stays in San Fernando, Pampanga',
        'brandColor', '#0f766e',
        'contactName', 'Demo Host',
        'contactRole', 'property_manager',
        'contactPhone', '0917 555 0101',
        'contactEmail', 'host.demo@example.com',
        'emailLogoUrl', 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=80',
        'verification', jsonb_build_object(
          'baseStatus', 'approved',
          'enhancedStatus', 'approved',
          'baseSubmittedAt', to_char(now() - interval '60 days', 'YYYY-MM-DD"T"HH24:MI:SSOF'),
          'enhancedSubmittedAt', to_char(now() - interval '55 days', 'YYYY-MM-DD"T"HH24:MI:SSOF'),
          'propertyRelationship', 'owner',
          'socialPlatform', 'facebook',
          'platformAdminPlatform', 'facebook',
          'assets', jsonb_build_object(
            'validIdPath', 'seed/org-verification/valid-id.jpg',
            'socialProofPath', 'seed/org-verification/social-proof.jpg',
            'pmoEmailPaths', jsonb_build_array()
          )
        ),
        'setupGuide', jsonb_build_object(
          'version', 1,
          'completedAt', to_char(now() - interval '30 days', 'YYYY-MM-DD"T"HH24:MI:SSOF')
        )
      ),
      updated_at = now()
  WHERE id = v_org;

  INSERT INTO public.org_settings (
    organization_id, email_to, email_reply_to, parking_owner_emails,
    sd_refund_cron_email_lead_minutes, sd_refund_cron_max_checkout_age_days,
    public_guest_app_origin, facebook_reviews_url, email_logo_url,
    default_parking_rate_guest, instagram_url, tiktok_url, airbnb_url,
    automation_toggles
  )
  VALUES (
    v_org, 'host.demo@example.com', 'host.demo@example.com', 'parking.demo@example.com',
    1440, 7, 'http://localhost:5173', 'https://www.facebook.com/kamespace',
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=80',
    350, 'https://www.instagram.com/kamespace', 'https://www.tiktok.com/@kamespace',
    'https://www.airbnb.com/users/show/123456789',
    '{"emailNewBookingRequest":true,"emailGafRequest":true,"emailBookingAcknowledgement":true,"emailPetRequest":true,"emailReadyForCheckin":true,"emailSdRefundCheckout":true,"emailReviewRequest":true,"emailReviewReminder":true}'::jsonb
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    email_to = EXCLUDED.email_to,
    email_reply_to = EXCLUDED.email_reply_to,
    parking_owner_emails = EXCLUDED.parking_owner_emails,
    sd_refund_cron_email_lead_minutes = EXCLUDED.sd_refund_cron_email_lead_minutes,
    sd_refund_cron_max_checkout_age_days = EXCLUDED.sd_refund_cron_max_checkout_age_days,
    public_guest_app_origin = EXCLUDED.public_guest_app_origin,
    facebook_reviews_url = EXCLUDED.facebook_reviews_url,
    email_logo_url = EXCLUDED.email_logo_url,
    default_parking_rate_guest = EXCLUDED.default_parking_rate_guest,
    instagram_url = EXCLUDED.instagram_url,
    tiktok_url = EXCLUDED.tiktok_url,
    airbnb_url = EXCLUDED.airbnb_url,
    automation_toggles = EXCLUDED.automation_toggles,
    updated_at = now();

  ---------------------------------------------------------------------------
  -- Property app settings
  ---------------------------------------------------------------------------
  INSERT INTO public.app_settings (
    property_id, email_to, email_reply_to, parking_owner_emails,
    public_guest_app_origin, facebook_reviews_url, email_logo_url,
    default_parking_rate_guest, gcash_name, gcash_number, gcash_qr_image_url,
    gaf_unit_owner, gaf_tower_and_unit_number, gaf_guests_onsite_contact_person,
    gaf_owner_contact_number, payment_methods,
    payment_provider, automation_toggles, brand_color, airbnb_url,
    instagram_url, tiktok_url, weekday_nightly_rate, weekend_nightly_rate,
    default_down_payment, default_security_deposit, default_pet_fee,
    default_guest_additional_fee, pricing_holiday_rules, vouchers_enabled,
    voucher_prizes, voucher_reveal_style, external_reviews
  )
  VALUES (
    v_prop, 'host.demo@example.com', 'host.demo@example.com', 'parking.demo@example.com',
    'http://localhost:5173', 'https://www.facebook.com/kamespace',
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=80',
    350, 'Demo Host', '0917 555 0101', NULL,
    'Demo Host', 'Monaco 2604', 'Demo Host', '0917 555 0101',
    '[{"id":"pay-gcash","provider":"GCash","accountName":"Demo Host","accountNumber":"0917 555 0101","qrImageUrl":null,"isPrimary":true},{"id":"pay-gotyme","provider":"GoTyme","accountName":"Demo Host","accountNumber":"0123 4567 8901","qrImageUrl":null,"isPrimary":false}]'::jsonb,
    'GCash',
    '{"emailNewBookingRequest":true,"emailGafRequest":true,"emailBookingAcknowledgement":true,"emailPetRequest":true,"emailReadyForCheckin":true,"emailSdRefundCheckout":true,"emailReviewRequest":true,"emailReviewReminder":true}'::jsonb,
    '#0f766e', 'https://www.airbnb.com/rooms/12345678',
    'https://www.instagram.com/kamespace', 'https://www.tiktok.com/@kamespace',
    4500, 5200, 2000, 2000, 500, 0,
    '[{"id":"holiday-christmas","label":"Christmas week","startDate":"2026-12-20","endDate":"2026-12-27","rate":6500},{"id":"holiday-newyear","label":"New Year week","startDate":"2026-12-28","endDate":"2027-01-03","rate":7000}]'::jsonb,
    true,
    '[{"id":"prize-10","percentOff":10,"comment":"10% off your next stay"},{"id":"prize-15","percentOff":15,"comment":"15% off your next stay"},{"id":"prize-20","percentOff":20,"comment":"20% off your next stay"}]'::jsonb,
    'wheel',
    '[]'::jsonb
  )
  ON CONFLICT (property_id) WHERE property_id IS NOT NULL DO UPDATE SET
    email_to = EXCLUDED.email_to,
    email_reply_to = EXCLUDED.email_reply_to,
    parking_owner_emails = EXCLUDED.parking_owner_emails,
    public_guest_app_origin = EXCLUDED.public_guest_app_origin,
    facebook_reviews_url = EXCLUDED.facebook_reviews_url,
    email_logo_url = EXCLUDED.email_logo_url,
    default_parking_rate_guest = EXCLUDED.default_parking_rate_guest,
    gcash_name = EXCLUDED.gcash_name,
    gcash_number = EXCLUDED.gcash_number,
    gaf_unit_owner = EXCLUDED.gaf_unit_owner,
    gaf_tower_and_unit_number = EXCLUDED.gaf_tower_and_unit_number,
    gaf_guests_onsite_contact_person = EXCLUDED.gaf_guests_onsite_contact_person,
    gaf_owner_contact_number = EXCLUDED.gaf_owner_contact_number,
    payment_methods = EXCLUDED.payment_methods,
    payment_provider = EXCLUDED.payment_provider,
    automation_toggles = EXCLUDED.automation_toggles,
    brand_color = EXCLUDED.brand_color,
    airbnb_url = EXCLUDED.airbnb_url,
    instagram_url = EXCLUDED.instagram_url,
    tiktok_url = EXCLUDED.tiktok_url,
    weekday_nightly_rate = EXCLUDED.weekday_nightly_rate,
    weekend_nightly_rate = EXCLUDED.weekend_nightly_rate,
    default_down_payment = EXCLUDED.default_down_payment,
    default_security_deposit = EXCLUDED.default_security_deposit,
    default_pet_fee = EXCLUDED.default_pet_fee,
    default_guest_additional_fee = EXCLUDED.default_guest_additional_fee,
    pricing_holiday_rules = EXCLUDED.pricing_holiday_rules,
    vouchers_enabled = EXCLUDED.vouchers_enabled,
    voucher_prizes = EXCLUDED.voucher_prizes,
    voucher_reveal_style = EXCLUDED.voucher_reveal_style,
    updated_at = now();

  ---------------------------------------------------------------------------
  -- Parking settings
  ---------------------------------------------------------------------------
  INSERT INTO public.parking_settings (
    parking_id, payment_provider, gcash_name, gcash_number, gcash_qr_image_url,
    payment_methods, parking_notification_templates, weekday_nightly_rate,
    weekend_nightly_rate, automation_toggles
  )
  VALUES (
    v_park, 'GCash', 'Demo Parking Host', '0917 555 0202', NULL,
    '[{"id":"park-pay-gcash","provider":"GCash","accountName":"Demo Parking Host","accountNumber":"0917 555 0202","qrImageUrl":null,"isPrimary":true}]'::jsonb,
    '{"bookingReceived":"We received your parking request for slot 27.","paymentConfirmed":"Payment confirmed. Your slot is reserved.","checkInReminder":"Reminder: your parking slot is reserved for tomorrow."}'::jsonb,
    300, 350,
    '{"emailNewBookingRequest":true,"emailBookingAcknowledgement":true,"emailReadyForCheckin":true}'::jsonb
  )
  ON CONFLICT (parking_id) DO UPDATE SET
    payment_provider = EXCLUDED.payment_provider,
    gcash_name = EXCLUDED.gcash_name,
    gcash_number = EXCLUDED.gcash_number,
    payment_methods = EXCLUDED.payment_methods,
    parking_notification_templates = EXCLUDED.parking_notification_templates,
    weekday_nightly_rate = EXCLUDED.weekday_nightly_rate,
    weekend_nightly_rate = EXCLUDED.weekend_nightly_rate,
    automation_toggles = EXCLUDED.automation_toggles,
    updated_at = now();

  RAISE NOTICE 'local seed: settings seeded for org %, property %, parking %', v_org, v_prop, v_park;
END $$;

