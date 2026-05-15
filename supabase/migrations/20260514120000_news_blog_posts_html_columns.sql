-- HTML article storage (iframe body + format). Safe to run after 20260514000000_news_blog_posts_table.

ALTER TABLE public.news_blog_posts
  ADD COLUMN IF NOT EXISTS content_format text NOT NULL DEFAULT 'text';

ALTER TABLE public.news_blog_posts
  ADD COLUMN IF NOT EXISTS raw_html text NOT NULL DEFAULT '';
