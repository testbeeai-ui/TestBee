CREATE TABLE IF NOT EXISTS public.magic_wall_basket_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_key text NOT NULL,
  board text NOT NULL DEFAULT 'CBSE' CHECK (board IN ('CBSE', 'ICSE')),
  subject text NOT NULL CHECK (subject IN ('physics', 'chemistry', 'math', 'biology')),
  class_level integer NOT NULL CHECK (class_level IN (11, 12)),
  exam_type text NULL CHECK (exam_type IN ('JEE', 'JEE_Mains', 'JEE_Advance', 'NEET', 'KCET', 'other')),
  unit_name text NULL,
  chapter_title text NULL,
  topic_name text NOT NULL,
  source text NOT NULL DEFAULT 'magic_wall',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic_key)
);

CREATE INDEX IF NOT EXISTS idx_magic_wall_basket_user_created
  ON public.magic_wall_basket_items (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_magic_wall_basket_subject_class
  ON public.magic_wall_basket_items (subject, class_level);

ALTER TABLE public.magic_wall_basket_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own magic wall basket items" ON public.magic_wall_basket_items;
CREATE POLICY "Users select own magic wall basket items"
  ON public.magic_wall_basket_items FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own magic wall basket items" ON public.magic_wall_basket_items;
CREATE POLICY "Users insert own magic wall basket items"
  ON public.magic_wall_basket_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own magic wall basket items" ON public.magic_wall_basket_items;
CREATE POLICY "Users update own magic wall basket items"
  ON public.magic_wall_basket_items FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own magic wall basket items" ON public.magic_wall_basket_items;
CREATE POLICY "Users delete own magic wall basket items"
  ON public.magic_wall_basket_items FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.magic_wall_basket_items IS
  'Magic Wall reading basket selections persisted per user.';
