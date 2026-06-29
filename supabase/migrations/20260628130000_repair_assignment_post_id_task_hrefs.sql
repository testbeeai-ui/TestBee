-- Repair assignment task hrefs where {{POST_ID}} was URL-encoded and never swapped at publish.

UPDATE public.posts p
SET content_json = jsonb_set(
  p.content_json,
  '{tasks}',
  (
    SELECT COALESCE(
      jsonb_agg(
        CASE
          WHEN jsonb_typeof(task) = 'object' AND (task->>'href') IS NOT NULL THEN
            jsonb_set(
              task,
              '{href}',
              to_jsonb(
                replace(
                  replace(
                    replace(
                      replace(task->>'href', '{{POST_ID}}', p.id::text),
                      '%7B%7BPOST_ID%7D%7D',
                      p.id::text
                    ),
                    '%7b%7bPOST_ID%7d%7d',
                    p.id::text
                  ),
                  '{{post_id}}',
                  p.id::text
                )
              )
            )
          ELSE task
        END
      ),
      '[]'::jsonb
    )
    FROM jsonb_array_elements(COALESCE(p.content_json->'tasks', '[]'::jsonb)) AS task
  )
)
WHERE p.content_json IS NOT NULL
  AND jsonb_typeof(p.content_json->'tasks') = 'array'
  AND (
    p.content_json::text LIKE '%{{POST_ID}}%'
    OR p.content_json::text ILIKE '%7B%7BPOST_ID%7D%7D%'
  );
