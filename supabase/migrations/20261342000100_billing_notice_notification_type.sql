-- Org billing notices (renewal ready, past due, suspended, trial ending, ...) in the in-app
-- notification list and web push. One org-level type; metadata.kind says which message.
-- Plan: docs/workflow/for-testing/plans-billing-lifecycle-hardening.md (Phase 4)

-- This list is a superset on purpose: every type allowed through 20261332, the marketing_* types
-- added by develop's 20261340000000_marketing_planner.sql (which sorts before this file), and
-- billing_notice. Any later migration that rewrites this CHECK must keep billing_notice.
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
    'booking_trip_viewed',
    'marketing_plan_ready',
    'marketing_item_due',
    'marketing_opportunity_urgent',
    'marketing_publish_held',
    'marketing_publish_failed',
    'billing_notice'
  )
);
