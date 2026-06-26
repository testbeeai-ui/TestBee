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

- **Prod schema changes:** add new dated files under `supabase/migrations/` with a **fresh timestamp** (never reuse a version already on prod).
- **Do not** run `20260915120000_baseline_schema_from_prod.sql` on prod again.
- **Archive reference:** `scripts/legacy/migrations/pre-squash-2026/`

### Why `db push` fails after squash

Prod `schema_migrations` still lists ~250 archived versions that no longer have files under `supabase/migrations/`. The CLI blocks push until histories align.

**One-time history cleanup (schema unchanged):**

```bash
node scripts/generate-migration-repair.js
# Review output, then run the printed repair --status reverted ... command
npx supabase db push
```

`repair --status reverted` only edits the migration history table — it does **not** undo applied SQL.

### Deploy without full repair (single migration)

When push is blocked or you need a hotfix:

```bash
node scripts/apply-linked-migrations.js --phase2
# or: node scripts/apply-linked-migrations.js 20260811120000_student_engagement_bits_tables.sql
```

This runs `supabase db query --linked -f …` then `migration repair --status applied <version>`.

### Version slug conflicts (critical)

If local file `20260623120000_foo.sql` shares a version with remote `admin_analytics_conversion_funnel`, prod already recorded that version — your SQL was **not** applied. Rename the local file to a new timestamp (e.g. `20260811120000_foo.sql`) before push or `apply-linked-migrations`.

## If something looks wrong

1. Old migrations are still in git history and in the archive folder.
2. Prod still has all 258+ prior `schema_migrations` rows plus the new baseline marker.
3. Restore old layout: move SQL files back from archive to `supabase/migrations/` (do not delete baseline row on prod without DBA review).
