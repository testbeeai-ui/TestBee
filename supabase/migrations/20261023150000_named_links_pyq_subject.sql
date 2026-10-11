-- Chapter PYQ names carry a subject, same as Learn Hub names.

ALTER TABLE public.named_page_links
  DROP CONSTRAINT IF EXISTS named_page_links_destination_check;

ALTER TABLE public.named_page_links
  ADD CONSTRAINT named_page_links_destination_check CHECK (
    (
      destination = 'learnhub'
      AND subject IN ('physics', 'chemistry', 'math')
    )
    OR (
      destination = 'chapter_pyq'
      AND (
        subject IS NULL
        OR subject IN ('physics', 'chemistry', 'math')
      )
    )
  );
