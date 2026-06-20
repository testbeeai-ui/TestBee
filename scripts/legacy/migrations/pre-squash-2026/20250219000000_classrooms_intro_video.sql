-- Optional intro/demo video URL for class (YouTube or Vimeo). Shown on Class Home.
ALTER TABLE public.classrooms
  ADD COLUMN IF NOT EXISTS intro_video_url text;

COMMENT ON COLUMN public.classrooms.intro_video_url IS 'Optional YouTube/Vimeo URL for class intro/demo video.';
