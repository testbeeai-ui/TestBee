-- Migration: Create news_blog_posts table with publish_date for scheduled publishing
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS news_blog_posts (
  id TEXT PRIMARY KEY,
  portal TEXT NOT NULL CHECK (portal IN ('news', 'blog')),
  section TEXT NOT NULL,
  exam TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  exam_date TEXT NOT NULL DEFAULT '',
  source_link TEXT NOT NULL DEFAULT '',
  hero_image_url TEXT NOT NULL DEFAULT '',
  inline_image_url TEXT NOT NULL DEFAULT '',
  hero_image_caption TEXT NOT NULL DEFAULT '',
  inline_image_caption TEXT NOT NULL DEFAULT '',
  revision_plan TEXT NOT NULL DEFAULT '',
  featured TEXT NOT NULL DEFAULT 'feed' CHECK (featured IN ('feed', 'hero', 'sidebar')),
  publish_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.news_blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published posts" ON public.news_blog_posts;
DROP POLICY IF EXISTS "Admins can insert posts" ON public.news_blog_posts;
DROP POLICY IF EXISTS "Admins can update posts" ON public.news_blog_posts;
DROP POLICY IF EXISTS "Admins can delete posts" ON public.news_blog_posts;
DROP POLICY IF EXISTS "Authenticated users can insert posts" ON public.news_blog_posts;
DROP POLICY IF EXISTS "Authenticated users can update posts" ON public.news_blog_posts;
DROP POLICY IF EXISTS "Authenticated users can delete posts" ON public.news_blog_posts;

-- Policy: Anyone can read published posts (anon + authenticated)
CREATE POLICY "Public can read published posts"
  ON public.news_blog_posts
  FOR SELECT
  TO anon, authenticated
  USING (publish_date <= now());

-- Policy: Only admins can insert posts (user_roles OR profiles.role, same as app isAdminUser)
CREATE POLICY "Admins can insert posts"
  ON public.news_blog_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'::public.app_role
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(p.role)) = 'admin'
    )
  );

-- Policy: Only admins can update posts
CREATE POLICY "Admins can update posts"
  ON public.news_blog_posts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'::public.app_role
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(p.role)) = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'::public.app_role
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(p.role)) = 'admin'
    )
  );

-- Policy: Only admins can delete posts
CREATE POLICY "Admins can delete posts"
  ON public.news_blog_posts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'::public.app_role
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(p.role)) = 'admin'
    )
  );

-- Index for efficient queries on publish_date
CREATE INDEX IF NOT EXISTS idx_news_blog_posts_publish_date
  ON news_blog_posts (publish_date DESC);

-- Index for filtering by portal and section
CREATE INDEX IF NOT EXISTS idx_news_blog_posts_portal_section
  ON news_blog_posts (portal, section);

-- Index for filtering by exam
CREATE INDEX IF NOT EXISTS idx_news_blog_posts_exam
  ON news_blog_posts (exam);

-- Auto-update updated_at (scoped name to avoid clashing with other triggers)
CREATE OR REPLACE FUNCTION public.news_blog_posts_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_news_blog_posts_updated_at ON public.news_blog_posts;
CREATE TRIGGER trigger_news_blog_posts_updated_at
  BEFORE UPDATE ON public.news_blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.news_blog_posts_set_updated_at();

GRANT SELECT ON public.news_blog_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.news_blog_posts TO authenticated;