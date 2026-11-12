-- "Your guest opened their trip" (guest journey plan 7.5).
--
-- The trip page is the only screen a guest is told to open. Knowing they reached it is the
-- difference between "waiting for a reply" and "the guest has seen the dates, the directions and
-- the balance". Stamped once, on the first authorised read, so a refresh is not an event.
--
-- `guest_trip_first_viewed_at` is the idempotency key: the update is conditional on the column
-- being null, so two concurrent reads produce one stamp and one notification.

ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS guest_trip_first_viewed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.guest_submissions.guest_trip_first_viewed_at IS
  'First authorised read of the guest trip page. Drives the one-off booking_trip_viewed host notification.';

-- Rebuild the type check with the new value (every notification-type migration lists the full set).
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'booking_pending_review',
    'booking_ready_for_checkin',
    'booking_ready_for_checkout',
    'booking_sd_refund_due',
    'booking_gaf_auto_approved',
    'booking_pet_auto_approved',
    'booking_parking_matched',
    'inbox_new_message',
    'calendar_sync_failing',
    'calendar_conflict',
    'booking_external_imported',
    'booking_guest_form_completed',
    'smart_pricing_updated',
    'property_settings_copied',
    'analytics_review_updated',
    'review_received',
    'review_due',
    'review_response_received',
    'maintenance_guest_reported',
    'guest_request_submitted',
    'booking_receipt_uploaded',
    'booking_trip_viewed'
  )
);
