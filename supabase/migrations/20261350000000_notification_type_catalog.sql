-- Notification type catalog (2026-11-22).
--
-- The CHECK constraint had drifted behind the NotificationType union in
-- `_shared/notificationService.ts`: several createNotification() calls (parking cancellation,
-- refund due, cancellation requests) were silently rejected by the database and only logged.
-- Re-add the full catalog, including `booking_help_requested` for SAFE-01.

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
    'parking_cancelled_by_host',
    'parking_request_cancelled',
    'parking_payment_expired',
    'parking_endorsement_failed',
    'inbox_new_message',
    'calendar_sync_failing',
    'calendar_conflict',
    'booking_external_imported',
    'booking_guest_form_completed',
    'booking_cancellation_requested',
    'booking_cancellation_request_resolved',
    'booking_cancelled_by_guest',
    'booking_refund_due',
    'smart_pricing_updated',
    'property_settings_copied',
    'analytics_review_updated',
    'review_received',
    'review_due',
    'review_response_received',
    'maintenance_guest_reported',
    'guest_request_submitted',
    'booking_help_requested',
    'booking_receipt_uploaded',
    'booking_trip_viewed',
    'marketing_plan_ready',
    'marketing_item_due',
    'marketing_opportunity_urgent',
    'marketing_publish_held',
    'marketing_publish_failed',
    'billing_notice'
  )
);
