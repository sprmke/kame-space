-- PayMongo webhook dedupe claim lease (ledger PR-019 / #163).
--
-- The dedupe row used to be written before processing and never removed, so a transient
-- failure or a crash mid-handler made every provider retry a no-op duplicate: the payment
-- event was lost. `processed_at` now separates "claim in flight" (NULL) from "done"
-- (timestamp). The handler releases the claim on failure and takes over a claim older than
-- its lease, so retries are processed at least once instead of dropped.

ALTER TABLE public.processed_paymongo_events
  ADD COLUMN IF NOT EXISTS processed_at timestamp with time zone;

-- Historical rows were fully processed under the old handler.
UPDATE public.processed_paymongo_events
SET processed_at = created_at
WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_processed_paymongo_events_open_claim
  ON public.processed_paymongo_events (created_at)
  WHERE processed_at IS NULL;

COMMENT ON COLUMN public.processed_paymongo_events.processed_at IS
  'NULL = webhook claim in flight (leased for 2 minutes); set when handling completed. A replay of a completed event is a no-op.';
