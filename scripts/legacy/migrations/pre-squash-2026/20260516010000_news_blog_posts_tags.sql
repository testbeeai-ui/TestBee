-- SEO keywords stored as comma-separated text (app field name: tags).
-- Partial GIN index for future keyword search without indexing empty tags.

alter table public.news_blog_posts
  add column if not exists tags text not null default '';

create index if not exists idx_news_blog_posts_tags
  on public.news_blog_posts using gin (to_tsvector('simple', tags))
  where tags <> '';
