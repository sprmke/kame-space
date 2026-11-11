-- Link a web chat thread to the booking it is about.
--
-- Before this, the host Inbox had to guess the booking from the guest's name, and a guest
-- who had already booked could be offered a second booking form in the same thread.
-- `booking_id` makes the link explicit and exact (plan D9, findings E1, E2).
--
-- Nullable on purpose:
--   * Meta (Facebook / Instagram) threads are connection-scoped, not booking-scoped.
--   * A web chat can start before the guest has booked (a first inquiry).
--   * Deleting a booking must not delete the conversation, so it is `ON DELETE SET NULL`.

ALTER TABLE public.social_conversations
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.guest_submissions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_social_conversations_booking_id
  ON public.social_conversations (booking_id)
  WHERE booking_id IS NOT NULL;

COMMENT ON COLUMN public.social_conversations.booking_id IS
  'Booking this web chat thread is about. NULL for Meta threads and for pre-booking inquiries. Set on web chat start/resume when the guest has an active or upcoming booking for the property.';
