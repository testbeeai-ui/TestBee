# Pre-squash migration archive (2026-06-15)

**255 incremental SQL files** moved here when production schema was squashed into a single baseline.

## Production (`bytsiknhtcnlxwzgqkrd`)

- **No migration SQL was re-run on prod.**
- Baseline version `20260915120000` was marked applied via `schema_migrations` insert only (repair).
- **All row data unchanged** — lessons (curriculum/subtopics), mock papers, past papers, etc.

## Active migrations folder

Only one file remains:

- `supabase/migrations/20260915120000_baseline_schema_from_prod.sql` — **schema structure only** (no row data)

## Fresh database setup

1. `supabase db reset` (or push on empty project) applies the baseline → empty tables with correct structure.
2. Load content using existing import scripts (same as before):
   - Curriculum seeds (archived migrations or taxonomy scripts)
   - `scripts/import-cbse-12-mcqs.ts`, `scripts/import-past-paper-json.ts`
   - Play pack migrations were data-heavy — use archived SQL or play import tooling as needed
   - `rdm_config` rows from archived `*_rdm_config*.sql` or admin UI

## Regenerate baseline (if schema changes)

```bash
# Docker Desktop must be running
npx supabase db dump --linked --schema public,storage -f scratch/baseline-schema-raw.sql --yes
node scripts/build-baseline-migration.js
```

Do **not** re-apply the new baseline on prod without a DBA review — use incremental migrations for prod changes going forward.
