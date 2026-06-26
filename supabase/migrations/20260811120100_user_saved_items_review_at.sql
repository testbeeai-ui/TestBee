-- Phase 2.5: recall scheduling column (status + saved_at already exist on user_saved_items).
ALTER TABLE public.user_saved_items
  ADD COLUMN IF NOT EXISTS review_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_user_saved_items_user_review_at
  ON public.user_saved_items (user_id, item_type, review_at)
  WHERE item_type = 'saved_revision_card' AND review_at IS NOT NULL;

-- Backfill indexed columns from legacy fat JSON rows.
UPDATE public.user_saved_items
SET
  status = COALESCE(status, NULLIF(data->>'status', '')),
  saved_at = COALESCE(saved_at, NULLIF(data->>'savedAt', '')::timestamptz),
  review_at = COALESCE(review_at, NULLIF(data->>'reviewAt', '')::timestamptz)
WHERE item_type = 'saved_revision_card'
  AND (
    status IS NULL
    OR saved_at IS NULL
    OR review_at IS NULL
  );
