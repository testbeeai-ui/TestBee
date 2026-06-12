# Phase 2 — Database hygiene

**Status:** Complete 2026-06-11 — applied to production (`bytsiknhtcnlxwzgqkrd`).

## Migrations

| File | What |
|------|------|
| `20260811120000_phase2_rls_initplan_hot_tables.sql` | `(select auth.uid())` on RLS for `posts`, `profiles`, `classroom_members`, `doubts` + post helper functions |
| `20260811120100_phase2_indexes_and_prune.sql` | Drop 2 unused indexes, add 4 hot FK indexes, `prune_telemetry_logs()` RPC |
| `20260811130000_phase2b_rls_initplan_extended.sql` | RLS initplan on `doubt_answers`, `doubt_votes`, `doubt_saves`, `doubt_answer_reports`, `classrooms`, `live_sessions`, `class_exploration_sessions` |
| `20260811130100_phase2b_index_cleanup.sql` | Drop duplicate/redundant indexes; `idx_live_sessions_teacher_id` |

## Apply to Supabase

```bash
npx supabase db push
```

Or run both SQL files in the Supabase SQL editor (main project `bytsiknhtcnlxwzgqkrd`).

## Code changes

| Area | Files |
|------|-------|
| Admin analytics cache | `lib/admin/adminAnalyticsCache.ts`, all `app/api/admin/analytics/*/route.ts` |
| Telemetry retention (manual cron) | `app/api/cron/prune-telemetry-logs/route.ts` |

## Manual retention run

```powershell
curl.exe -s http://localhost:3000/api/cron/prune-telemetry-logs
# Production (if CRON_SECRET set):
curl.exe -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR_DOMAIN/api/cron/prune-telemetry-logs
```

Deletes `ai_token_logs` older than **90 days**, `student_learning_dwell_events` older than **180 days**.

## Indexes dropped (verified redundant / unused)

- `idx_past_paper_questions_paper_sort` — redundant with UNIQUE `(paper_id, sort_order)`
- `ai_token_logs_action_type_idx` — ~1 MB; `created_at` + `user_id` indexes remain
- `doubt_answers_created_at_idx` — exact duplicate of `doubt_answers_created_at_idx1`
- `idx_doubt_votes_user_target` — redundant with UNIQUE `(user_id, target_type, target_id)`

## Indexes added

- `idx_classrooms_teacher_id`
- `idx_posts_teacher_id`
- `idx_live_sessions_classroom_id`
- `idx_classroom_assignment_responses_classroom_id`
- `idx_live_sessions_teacher_id`

## Admin cache TTLs

| Key | TTL |
|-----|-----|
| `analytics_summary` | 60s |
| `feature_adoption` | 120s |
| `conversion_funnel` | 120s |
| `dropoff_tracking` | 300s |
| `retention_cohorts` | 120s |
| `events_{days}` | 60s |
| `churn_risk` | 120s |

## Verification (2026-06-11, live DB)

| Check | Result |
|-------|--------|
| `prune_telemetry_logs` exists | Yes |
| `GET /api/cron/prune-telemetry-logs` (local) | HTTP 200, `ok: true` |
| Bare `auth.uid()` on hot tables (posts, doubts, classroom, live, …) | **0** policies |
| Dropped indexes still present | **0** |
| `idx_live_sessions_teacher_id` | Present |
| `admin_analytics_cache` rows | ≥1 (churn_risk seeded) |

## Intentionally deferred (Phase 3+ / later)

- ~80+ other indexes with `idx_scan = 0` — many are PK/UNIQUE or future features; do not bulk-drop
- RLS initplan on remaining ~70 tables (telemetry, admin, lessons, mock, etc.)
- Vercel cron schedule for prune — manual only (same as Phase 0 policy)
