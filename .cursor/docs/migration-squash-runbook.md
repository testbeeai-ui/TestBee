# Migration squash runbook — completed 2026-06-15

## What we did (production-safe)

| Step | Action | Prod data touched? |
|------|--------|-------------------|
| 1 | `pg_dump --schema-only` from linked project → baseline file | **No** |
| 2 | Verified lessons + mock tables in dump | **No** |
| 3 | Insert `20260915120000_baseline_schema_from_prod` into `schema_migrations` only | **No** |
| 4 | Moved 255 old files → `scripts/legacy/migrations/pre-squash-2026/` | **No** |

## Row-count verification (after squash marker)

| Table | Rows |
|-------|-----:|
| curriculum_subtopics | 1,199 |
| subtopic_content | 1,853 |
| lessons_raw_posts | 29 |
| mock_papers | 99 |
| mock_questions | 9,170 |
| past_papers | 37 |
| past_paper_questions | 5,362 |
| cbse_mcq_chapters | 89 |

## Going forward

- **Prod schema changes:** add new dated files under `supabase/migrations/` (incremental), then `npx supabase db push`.
- **Do not** run `20260915120000_baseline_schema_from_prod.sql` on prod again.
- **Archive reference:** `scripts/legacy/migrations/pre-squash-2026/`

## If something looks wrong

1. Old migrations are still in git history and in the archive folder.
2. Prod still has all 258+ prior `schema_migrations` rows plus the new baseline marker.
3. Restore old layout: move SQL files back from archive to `supabase/migrations/` (do not delete baseline row on prod without DBA review).
