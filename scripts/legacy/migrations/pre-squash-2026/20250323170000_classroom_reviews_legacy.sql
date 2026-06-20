-- ============================================================
-- Classroom Reviews — legacy migration (idempotent)
-- Replaces invalid remote history version "20250221" (8-digit) which
-- did not map to a local file under current Supabase CLI rules.
-- Safe to run on DBs that already have classroom_reviews from dashboard/manual.
-- ============================================================

CREATE TABLE IF NOT EXISTS classroom_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  video_rating SMALLINT CHECK (video_rating BETWEEN 1 AND 5),
  voice_rating SMALLINT CHECK (voice_rating BETWEEN 1 AND 5),
  is_explorer BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(classroom_id, user_id)
);

CREATE OR REPLACE VIEW classroom_rating_summary AS
SELECT
  classroom_id,
  COUNT(*)::int AS review_count,
  ROUND(AVG(rating)::numeric, 1) AS avg_rating,
  ROUND(AVG(video_rating)::numeric, 1) AS avg_video_rating,
  ROUND(AVG(voice_rating)::numeric, 1) AS avg_voice_rating
FROM classroom_reviews
GROUP BY classroom_id;

ALTER TABLE classroom_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read reviews" ON classroom_reviews;
CREATE POLICY "Anyone can read reviews"
  ON classroom_reviews FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own review" ON classroom_reviews;
CREATE POLICY "Users can insert own review"
  ON classroom_reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own review" ON classroom_reviews;
CREATE POLICY "Users can update own review"
  ON classroom_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
