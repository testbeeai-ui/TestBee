# Supabase table audit — TestBee main project

**Project ref:** `bytsiknhtcnlxwzgqkrd`  
**Audit date:** 2026-06-15  
**Constraint:** No production data loss. No `DROP TABLE` executed in this audit.

---

## Executive summary

The dashboard feels like “200–300 tables” because of **three different things added together**:

| What you see | Count | Notes |
|---|---:|---|
| `public` app tables (incl. partitions) | **154** | 93 core + 60 monthly dwell partitions + 1 partitioned parent |
| Supabase system schemas (`auth`, `storage`, `realtime`, `vault`, …) | **~43** | Managed by Supabase — do not drop |
| **Total DB relations** | **~197** | Not 200–300 |
| SQL files in `supabase/migrations/` | **257** | Migration **history**, not live tables |

**Bottom line:** There is no large set of orphan “one-time use” app tables to delete. ~**39%** of `public` table names are **monthly partition children** for `student_learning_dwell_events` (by design). Empty partitions cost ~2.4 MB total and must stay for Postgres partition routing unless we change the strategy.

**Recommendation:** Do **not** bulk-drop tables. Use retention pruning for telemetry **rows** (already implemented), optional **partition window** tightening in a future migration, and fix **types/code drift** (`session_attendance`, `notifications`).

---

## Where the 154 `public` tables come from

### 1. Dwell telemetry partitions (60 tables) — **KEEP**

Migration: `20260811150000_phase5_dwell_events_partition.sql`

- Parent: `student_learning_dwell_events` (`PARTITION BY RANGE (occurred_at)`)
- Children: `student_learning_dwell_2024_01` … `student_learning_dwell_2028_12` (60 months pre-created)
- Rows today: **1,210** total across **2** partitions (`2026_05`: 1,203, `2026_06`: 7); **58** partitions empty
- Disk: ~2.4 MB for all partition shells; **85 MB** is non-dwell data

These are **not** duplicate junk tables. Postgres requires a matching partition (or default) for each `occurred_at` on insert. `ensure_dwell_events_partition()` can create future months on demand.

**Safe row cleanup (no table drops):** `prune_telemetry_logs()` + `/api/cron/prune-telemetry-logs` deletes dwell **rows** older than 180 days (and `ai_token_logs` > 90 days). This preserves schema and recent data.

### 2. Core app tables (93) — **KEEP**

All 93 non-partition tables map to live product areas: auth/profile, classrooms, doubts, play, mocks, curriculum, RDM, admin, buddies, etc.

#### Empty but **actively referenced** (do not drop)

These have **0 rows** but are used in app code, RPCs, or RLS — they are feature scaffolding, not migration leftovers:

| Table | Rows | Why keep |
|---|---:|---|
| `admin_audit_log`, `admin_user_actions` | 0 | Admin audit trail |
| `cbse_mcq_community_share_rdm_claims` | 0 | CBSE share RDM RPC |
| `classroom_assignment_responses` | 0 | Assignment submissions |
| `classroom_generated_test_attempts` | 0 | Teacher MCQ attempts API |
| `classroom_reviews` | 0 | `ClassroomReviews.tsx` |
| `episodic_memory`, `user_memory_profile` | 0 | RAG memory schema (Modal) |
| `explorer_live_joins`, `live_session_joins` | 0 | Live/explore join caps |
| `lessons_raw_post_boosts` | 0 | Lessons feed boosts |
| `mock_*_rdm_*` (several) | 0 | Mock bonus / share claims |
| `platform_feedback_submissions` | 0 | Settings feedback API |
| `referral_weekly_bonuses` | 0 | Referral RPC |
| `student_*_presence` (3 tables) | 0 | Buddy “right now” heartbeats |
| `study_streak_milestone_claims` | 0 | Streak milestone payout |
| `teacher_motivation_rdm_grants` | 0 | Teacher motivation RDM |

Dropping any of these would break features when first used and violates the “no data loss / no surprises” rule.

---

## Tables in **types.ts** but **not in the database**

| Name in `integrations/supabase/types.ts` | In live DB? | Code usage |
|---|---|---|
| `notifications` | **No** | `NotificationBell` uses `posts` (type `motivation`), not this table |
| `session_attendance` | **No** | Queried in `app/api/user/learning-activity-breakdown/route.ts` (errors swallowed) |

These are **schema drift**, not extra DB tables. Fix options (separate task):

1. Add migrations to create them, **or**
2. Remove from generated types and fix the API to use `live_session_joins` / posts-based notifications.

---

## Migration files (257) — not tables

- One file ≈ one applied change; **do not delete** applied migrations from git.
- Squashing history breaks fresh clones unless you baseline-reset (high risk).
- Duplicate timestamps on same day (e.g. eight files on `20260430`) are messy but already applied — leave as-is unless doing a controlled baseline project.

---

## What we should **not** do

| Action | Risk |
|---|---|
| Bulk `DROP TABLE` on empty core tables | Breaks RPCs/RLS/features at first use |
| Drop dwell partition children | Inserts fail for that month unless recreated |
| Drop tables with any rows | **Data loss** (user constraint) |
| Delete migration SQL files | Breaks reproducible schema for new envs |
| Touch `auth.*`, `storage.*`, `realtime.*` | Supabase-managed |

---

## Phased plan (zero data loss)

### Phase 0 — Done (this audit)

Inventory, row counts, code cross-ref, partition explanation.

### Phase 1 — Hygiene (safe, no drops)

1. Regenerate or hand-fix `integrations/supabase/types.ts` to match live DB.
2. Fix `session_attendance` drift (migrate or remove dead query).
3. Schedule `/api/cron/prune-telemetry-logs` in production (row retention only).
4. Document in admin runbook: dwell partitions inflate table count in UI.

### Phase 2 — Rolling dwell partitions (deployed 2026-06-15)

Migration: `20260615112349_dwell_partitions_rolling_window.sql` (applied to `bytsiknhtcnlxwzgqkrd`).

**Function:** `prune_empty_dwell_partitions(months_ahead := 12, months_behind := 6)`

| Rule | Behavior |
|---|---|
| Partitions with **any rows** | Never dropped |
| Empty partitions inside window | Kept (insert routing) |
| Empty partitions outside window | `DROP TABLE` |
| Before drop | `ensure_dwell_events_partition` for current + next month |

**Window (example: June 2026):** keep empty shells from **2025-12-01** through **2027-06-30** (6 months behind, 12 ahead).

**One-time result:**

| Metric | Before | After |
|---|---:|---:|
| Dwell child partitions | 60 | **19** |
| `public` table count | 154 | **113** |
| Dwell telemetry rows | 1,210 | **1,210** (unchanged) |
| Partitions with data | `2026_05`, `2026_06` | same |

**Ongoing:** `/api/cron/prune-telemetry-logs` runs row prune then `prune_empty_dwell_partitions`.

---

## Decision

Phase 0–2 complete for dwell partition noise. Phase 3 (telemetry retention tuning) optional.

### Phase 3 — Telemetry row retention tuning (optional)

- Lower `ai_token_logs` from 90d → 60d if admin agrees (12k rows, ~7 MB today).
- Keep dwell at 180d unless product needs shorter buddy history.

This deletes **old rows only**, never user content (profiles, mocks, doubts, etc.).

---

## Data-bearing tables (never drop)

Top row counts (2026-06-15):

| Table | Rows | Size (approx) |
|---|---:|---|
| `ai_token_logs` | 12,202 | 7.5 MB |
| `mock_questions` | 9,250 | 12 MB |
| `past_paper_questions` | 5,362 | 11 MB |
| `subtopic_content` | 1,853 | 37 MB |
| `student_events` | 2,697 | 1.7 MB |
| `topic_content_runs` | 1,033 | 5.6 MB |
| `play_questions` | 900 | 0.9 MB |
| `curriculum_subtopics` | 1,199 | 0.4 MB |
| `student_learning_dwell_2026_05` | 1,203 | 0.5 MB |
| `profiles` | 38 | 0.6 MB |

Full public DB: **~87 MB** — small project; table **count** is the noise, not storage cost.
