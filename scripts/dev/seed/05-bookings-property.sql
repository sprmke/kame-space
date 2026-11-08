-- 05 — Property bookings.
--
-- 60 deterministic bookings on kame-home spanning roughly a year around today.
-- Every workflow status is represented, every acquisition channel appears, and a
-- few bookings carry pets, parking requests, SD refunds or an imported marker.
--
-- Dates are relative to CURRENT_DATE so the calendar and dashboard always look
-- current. Safe to re-run: only rows tagged booking_source = 'local_seed' for
-- this property are replaced.


DO $$
DECLARE
  v_org uuid := '405ea07f-cc21-4bcc-b540-28729be79f0d';
  v_prop uuid := 'e5555555-5555-4555-8555-555555555501';
  v_guest uuid := '5eed0000-0000-4000-8000-000000000001';
  v_receipt text := 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80';
  v_id text := 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=800&q=80';
  v_pet text := 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80';
  v_vax text := 'https://images.unsplash.com/photo-1584515933487-779824d15320?w=800&q=80';
  v_first text[] := ARRAY['June','Lia','Marco','Owen','Quinn','Sam','Uma','Vince','Wendy','Xander','Yara','Zoe','Alma','Bruno','Carla','Dante','Elena','Felix','Gina','Hugo','Iris','Jules','Kara','Liam','Mia','Noah','Olive','Pia','Rafa','Sofia','Tomas','Ursula','Vera','Wes','Xenia','Yuri','Zara','Abel','Bella','Cesar','Dina','Emil','Faye','Gab','Hana','Ivan','Joy','Kiko','Lena','Migs'];
  v_last text[] := ARRAY['Vale','Parks','Diaz','Frost','Hale','Ibarra','James','Kwan','Lopez','Mendoza','Navarro','Ocampo','Perez','Quinto','Ramos','Santos','Torres','Uy','Vargas','Wong','Yap','Zamora','Aquino','Bautista','Cruz','Domingo','Enriquez','Flores','Garcia','Hernandez','Ilagan','Jimenez','Kalaw','Lim','Mercado','Nolasco','Ong','Pascual','Reyes','Salazar','Tan','Umali','Valdez','Wenceslao','Yuzon','Zubiri','Abad','Bueno','Cortez','Delgado'];
  v_channels text[] := ARRAY['Airbnb','Facebook','Instagram','Tiktok','Friend','Walk-in','Google Search','Returning Guest'];
BEGIN
  DELETE FROM public.guest_submissions
  WHERE property_id = v_prop AND booking_source = 'local_seed';

  INSERT INTO public.guest_submissions (
    id, property_id, status, booking_source,
    guest_facebook_name, primary_guest_name, guest_email, guest_phone_number, guest_address,
    check_in_date, check_out_date, check_in_time, check_out_time,
    nationality, number_of_adults, number_of_children, number_of_nights, guest2_name,
    guest_special_requests, find_us, find_us_details,
    need_parking, car_plate_number, car_brand_model, car_color,
    has_pets, pet_name, pet_breed, pet_age, pet_type, pet_vaccination_date,
    pet_vaccination_url, pet_image_url,
    payment_receipt_url, valid_id_url,
    unit_owner, tower_and_unit_number, owner_onsite_contact_person, owner_contact_number,
    booking_rate, down_payment, balance, security_deposit, pet_fee,
    guest_balance_paid_amount, status_updated_at, created_at, updated_at, guest_user_id
  )
  SELECT
    format('5eed1000-0000-4000-8000-%s', lpad(g.i::text, 12, '0'))::uuid,
    v_prop,
    CASE
      WHEN g.i IN (15, 16) THEN 'CANCELLED'
      WHEN g.i IN (17, 18) THEN 'PENDING_SD_REFUND'
      WHEN g.i IN (19, 20) THEN 'READY_FOR_CHECKOUT'
      WHEN g.i IN (21, 22, 23) THEN 'COMPLETED'
      WHEN g.i IN (28, 29, 30, 31, 32) THEN 'PENDING_REVIEW'
      WHEN g.i IN (33, 34, 35) THEN 'PENDING_DOCUMENTS'
      WHEN g.i IN (36, 37) THEN 'PENDING_GAF'
      WHEN g.i IN (38, 39) THEN 'PENDING_PARKING_REQUEST'
      WHEN g.i IN (40, 41) THEN 'PENDING_PET_REQUEST'
      WHEN g.i = 42 THEN 'IMPORTED'
      WHEN g.i IN (25, 26, 27, 43, 46, 49, 52, 55, 58) THEN 'READY_FOR_CHECKIN'
      WHEN g.i % 4 = 0 THEN 'READY_FOR_CHECKIN'
      ELSE 'COMPLETED'
    END,
    'local_seed',
    v_first[1 + (g.i % array_length(v_first, 1))],
    v_first[1 + (g.i % array_length(v_first, 1))] || ' ' || v_last[1 + ((g.i * 3) % array_length(v_last, 1))],
    CASE WHEN g.i IN (25, 30, 35, 45) THEN 'guest.demo@example.com'
         ELSE 'guest' || g.i || '.demo@example.com' END,
    '0917' || lpad((6000000 + g.i * 137)::text, 7, '0'),
    (10 + g.i) || ' Demo Street, ' || (ARRAY['Makati','Pasig','Taguig','Quezon City','San Juan','Mandaluyong'])[1 + (g.i % 6)] || ', Metro Manila',
    to_char(CURRENT_DATE + ((g.i - 30) * 5), 'MM-DD-YYYY'),
    to_char(CURRENT_DATE + ((g.i - 30) * 5) + (1 + (g.i % 3)), 'MM-DD-YYYY'),
    '14:00', '11:00',
    CASE WHEN g.i % 9 = 0 THEN 'American' WHEN g.i % 7 = 0 THEN 'Korean' ELSE 'Filipino' END,
    1 + (g.i % 4), g.i % 3, 1 + (g.i % 3),
    CASE WHEN g.i % 2 = 0 THEN v_first[1 + ((g.i + 5) % array_length(v_first, 1))] || ' ' || v_last[1 + ((g.i + 2) % array_length(v_last, 1))] END,
    CASE WHEN g.i % 6 = 0 THEN 'Late check-out if possible' WHEN g.i % 6 = 1 THEN 'Extra towels please' END,
    v_channels[1 + (g.i % array_length(v_channels, 1))],
    CASE WHEN g.i % 8 = 0 THEN 'Referred by a friend' END,
    (g.i % 5 = 0),
    CASE WHEN g.i % 5 = 0 THEN 'ABC ' || lpad((1000 + g.i)::text, 4, '0') END,
    CASE WHEN g.i % 5 = 0 THEN (ARRAY['Toyota Vios','Honda Civic','Mitsubishi Xpander','Nissan Navara','Hyundai Tucson'])[1 + (g.i % 5)] END,
    CASE WHEN g.i % 5 = 0 THEN (ARRAY['White','Black','Silver','Blue','Red'])[1 + (g.i % 5)] END,
    (g.i % 7 = 0),
    CASE WHEN g.i % 7 = 0 THEN (ARRAY['Buddy','Mochi','Coffee','Pepper','Simba'])[1 + (g.i % 5)] END,
    CASE WHEN g.i % 7 = 0 THEN (ARRAY['Labrador','Shih Tzu','Poodle','Aspin','Corgi'])[1 + (g.i % 5)] END,
    CASE WHEN g.i % 7 = 0 THEN (1 + (g.i % 8)) || ' years old' END,
    CASE WHEN g.i % 7 = 0 THEN (CASE WHEN g.i % 2 = 0 THEN 'Dog' ELSE 'Cat' END) END,
    CASE WHEN g.i % 7 = 0 THEN to_char(CURRENT_DATE - interval '60 days', 'MM-DD-YYYY') END,
    CASE WHEN g.i % 7 = 0 THEN v_vax END,
    CASE WHEN g.i % 7 = 0 THEN v_pet END,
    v_receipt, v_id,
    'Demo Host', 'Monaco 2604', 'Demo Host', '0917 555 0101',
    3500 * (1 + (g.i % 3)),
    2000,
    CASE WHEN g.i % 4 = 0 THEN 0 ELSE 1500 * (1 + (g.i % 3)) END,
    2000,
    CASE WHEN g.i % 7 = 0 THEN 500 END,
    CASE WHEN g.i % 4 = 0 THEN 0 ELSE 1500 * (1 + (g.i % 3)) END,
    now() - ((g.i % 20) || ' days')::interval,
    (CURRENT_DATE + ((g.i - 30) * 5)) - interval '14 days',
    now(),
    CASE WHEN g.i IN (25, 30, 35, 45) THEN v_guest END
  FROM generate_series(0, 59) AS g(i);

  RAISE NOTICE 'local seed: % property bookings', (SELECT count(*) FROM public.guest_submissions WHERE property_id = v_prop AND booking_source = 'local_seed');
END $$;

