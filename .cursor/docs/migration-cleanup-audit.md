# Migration & database cleanup audit

**Project:** `bytsiknhtcnlxwzgqkrd`  
**Date:** 2026-06-15  
**Scope:** `supabase/migrations/` SQL files vs live DB vs app code  
**Rule:** Do **not** delete applied migration history from the DB. File cleanup must not break `supabase db reset` or new environments.

---

## Mental model (why it feels messy)

| Layer | Count | What it is |
|------|------:|------------|
| SQL files in `supabase/migrations/` | **256** | Ordered **history** — each runs once per environment |
| Applied rows in `schema_migrations` | **258** | What prod actually ran (includes 2 MCP-only extras) |
| Live `public` tables | **~113** | Current schema (includes ~19 dwell partition shells after Phase 2 prune) |

**Important:** After a migration is pushed, you almost never “use” that file again on prod — that is normal. The file stays so **new clones** can replay history. Cleaning migrations ≠ dropping DB tables.

---

## What is safe vs unsafe to delete

| Action | Safe? | Notes |
|--------|-------|-------|
| Delete SQL never applied anywhere | ✅ | Or move to `scripts/legacy/migrations/` |
| Rename local file to match remote `version_name` | ✅ | When content is the same migration |
| Delete SQL already in `schema_migrations` | ❌ | Breaks fresh installs / branch DB resets |
| Squash 256 files into one baseline | ⚠️ | Big project; needs new baseline + cutover plan |
| Drop empty DB tables | ⚠️ | Many 0-row tables are still referenced in app code |

---

## Critical issue: timestamp collisions (3 files)

These local files use the **same version number** as a **different** migration on prod. The diff script looked “matched” by version, but the **SQL content is not what prod ran** at that slot.

| Version | On prod (`schema_migrations`) | Local filename (wrong) | Fix |
|--------:|--------------------------------|--------------------------|-----|
| `20260502120000` | `classroom_sections_archive_expired` | `achievement_marksheets_and_verification` | **Delete local** — superseded by `20260504110000_repair_profile_achievements_verified.sql` + prod uses `20260502120100` for archive |
| `20260514120000` | `numerals_pack_require_60pct` | `news_blog_posts_html_columns` | **Renumber local** → `20260514115000_news_blog_posts_html_columns.sql` |
| `20260621140000` | `cbse_mcq_rdm_config` | `cbse_mcq_rdm` | **Rename** → `20260621140000_cbse_mcq_rdm_config.sql` |

This explains “we don’t know why we created it like that” — two different features were assigned the same migration timestamp on different machines (local git vs MCP/dashboard apply).

---

## MCP-only migrations (on prod, no local file)

Applied via Supabase MCP / dashboard, not committed as SQL:

| Version | Name | Likely purpose |
|--------:|------|----------------|
| `20260502120000` | `classroom_sections_archive_expired` | First archive pass (duplicate of `…120100`) |
| `20260514120000` | `numerals_pack_require_60pct` | First numerals 60% pass (duplicate of `…120100`) |
| `20260611172908` | `clear_waitlist_funnel_data` | One-shot test data wipe |
| `20260808140000` | `clear_waitlist_submissions_test_data` | One-shot test data wipe |

**Recommendation:** Add idempotent SQL stubs to the repo (copy from prod or rewrite) **or** accept that prod history has 2 extra rows. Do not re-run clear/wipe migrations on prod.

---

## Duplicate migration names (prod ran twice)

| Name | Versions | Notes |
|------|----------|-------|
| `classroom_sections_archive_expired` | `20260502120000`, `20260502120100` | Local keeps `…120100`; first slot was MCP-only |
| `numerals_pack_require_60pct` | `20260514120000`, `20260514120100` | Local keeps `…120100`; first slot was MCP-only |

Harmless on prod (idempotent SQL). Confusing in history only.

---

## Migration categories (256 local files)

| Category | ~Count | “Used after push?” | Cleanup |
|----------|-------:|--------------------|---------|
| Core feature DDL/RPC | 112 | Schema stays; file is history | Keep |
| RDM / economy config inserts | 56 | Keys live in `rdm_config` | Keep (config churn) |
| Play question packs | 23 | Content in `play_questions` | Keep; content scripts duplicate some |
| RLS / policy / hotfix | 30 | Policies active | Keep |
| Seed / backfill / repair | 11 | Ran once | Keep; see redundant note below |
| Admin email grants | 3 | One-time per person | Keep (harmless idempotent) |
| Admin analytics RPCs | 7 | `/admin` dashboards | Keep |
| DB hygiene (indexes, partitions, prune) | 4 | Ongoing cron | Keep |
| Mock / past paper / CBSE | 8 | Active product | Keep |
| Schema DDL (baseline, buckets, tables) | 10 | Active | Keep |

---

## Files that look “unused” but are not

### One-shot data / dev migrations
- `20250226100000_seed_profile_mock_data.sql` — fake academics for early doubts demo; idempotent inserts
- `20260504130000_add_admin_*.sql` (×3) — grant admin by email
- MCP `clear_waitlist_*` — wipe test waitlist rows

**Do not delete from applied chain** unless squashing to baseline.

### Redundant with a later repair migration
- `20260502120000_achievement_marksheets_and_verification.sql` — **delete**; `20260504110000_repair_profile_achievements_verified.sql` re-applies the same schema idempotently and documents the history mismatch.

### Already removed (prior cleanup)
- Duplicate phase2/phase5/dwell timestamps (`20260811*`, `20260815*`) → renamed to `20260611*`, `20260615112349`
- Orphans: `whitelist_alexis36sg`, `past_paper_images_bucket` (bucket via script)

---

## Database tables: empty ≠ unused

~20 core tables have **0 rows** but are referenced in TypeScript (buddy presence, mock RDM claims, assignment responses, RAG memory, etc.). See `.cursor/docs/supabase-table-audit.md`.

**Do not drop tables** based on row count alone.

### Ghost types (fixed)
- `notifications`, `session_attendance` were in `types.ts` but never in DB — removed; API uses `live_session_joins` / `posts`.

---

## Recommended cleanup plan

### Phase A — File hygiene (low risk) ✅ do now
1. Delete `20260502120000_achievement_marksheets_and_verification.sql` (repair supersedes).
2. Renumber `news_blog_posts_html_columns` → `20260514115000_…`.
3. Rename `cbse_mcq_rdm` → `cbse_mcq_rdm_config`.
4. Keep `scratch/audit-migrations.js` + `scratch/diff-migrations.js` for future diffs.

### Phase B — History parity (optional)
1. Add local SQL for MCP-only migrations (archive v1, numerals v1, clear_waitlist ×2) under correct timestamps **only if** you need `supabase db reset` to match prod history exactly.
2. Otherwise document the 2-row gap (256 local vs 258 remote).

### Phase C — Long-term (big)
1. **Squashed baseline** — one `baseline_2026.sql` from `pg_dump --schema-only` + seed strategy.
2. **Archive** old chain to `scripts/legacy/migrations/pre-squash-2026/` (read-only reference).
3. **Telemetry retention** — row prune only (already cron’d); partition window already tightened.

---

## How to re-run this audit

```bash
node scratch/diff-migrations.js      # local vs remote-migrations.json
node scratch/audit-migrations.js     # categories + collisions
```

Refresh `scratch/remote-migrations.json` from Supabase MCP `list_migrations` after any prod apply.
