# Teacher live-class quality bonus RDM (credit-only)

**Goal (investor ask):** students rate each live class 1–5★ right after it ends; a class that is genuinely loved earns the teacher an extra **+200 RDM** quality bonus — without letting a tiny number of raters fake it, and without unfairly dropping a teacher below the bar over one or two outliers.

**Hard rule: credit only, never debit.** The quality bonus can only *add* RDM. There are no penalties for low ratings and no claw-backs. Once a bonus is granted for a class it is permanent, even if later ratings drift below threshold.

## Where it plugs in

The "live class" that already earns delivery RDM is the **section schedule occurrence** (Path A), keyed by `(section_id, occurrence_at)` in `teacher_section_schedule_rdm_grants`
(`supabase/migrations/20260928120000_teacher_section_schedule_delivery_rdm.sql`).
The quality bonus reuses the same key and the same teacher-portal auto-award pattern, awarded in a **second pass after the ratings window closes** (delivery RDM is granted at class end; ratings arrive afterward).

There is **no per-occurrence attendance** for Path A, so the rating denominator is the **enrolled non-teacher roster of the section**.

## The two gates (why small samples can't fake it)

A class occurrence qualifies for +200 only if **all** hold:

1. **Window closed** — at least `window_hours` (default 24h) after the class ended.
2. **Quorum** — `raters ≥ min_ratings` (default 5) **and** `raters ≥ ceil(min_coverage_pct% × roster)` (default 50%).
3. **Smoothed score ≥ threshold** — Bayesian shrinkage average ≥ 4.5:

   ```
   adjusted = (sum_of_stars + m × prior_avg) / (raters + m)
   ```
   `m` = smoothing weight (default 8), `prior_avg` = platform prior (default 4.0).

Small samples get pulled toward the prior, so they can't spike; a large sample barely moves, so a couple of troll ratings can't unfairly tank a well-rated class. All raw averages are still credit-only — a low score just means "no bonus", never a deduction.

### Worked examples (m=8, prior=4.0, threshold 4.5)

| Raters | Raw avg | Adjusted | +200? |
|---|---|---|---|
| 5 | 4.6 | 4.23 | No |
| 5 | 5.0 | 4.38 | No (5 people can't decide, even at 5★) |
| 10 | 5.0 | 4.56 | Yes (smallest perfect class that clears) |
| 15 | 4.6 | 4.39 | No |
| 20 | 4.7 | 4.50 | Yes |
| 30 | 4.6 | 4.47 | No |
| 30 | 4.65 | 4.51 | Yes |

## Config (admin-tunable, `rdm_config`, integers; scores stored ×10)

| Key | Default | Meaning |
|---|---|---|
| `teacher_live_class_quality_bonus_rdm` | 200 | Bonus amount (credit) |
| `teacher_live_class_quality_min_avg_x10` | 45 | Threshold 4.5 |
| `teacher_live_class_quality_min_ratings` | 5 | Absolute rater floor |
| `teacher_live_class_quality_min_coverage_pct` | 50 | % of roster who must rate |
| `teacher_live_class_quality_smoothing_m` | 8 | Bayesian weight |
| `teacher_live_class_quality_prior_avg_x10` | 40 | Bayesian prior (4.0) |
| `teacher_live_class_quality_window_hours` | 24 | Rating window |
| `teacher_live_class_quality_monthly_cap` | 20 | Max quality bonuses / teacher / IST month (economy guard) |

## Data model

- **`live_class_ratings`** — `(section_id, occurrence_at, student_id)` unique; `stars smallint CHECK (stars BETWEEN 1 AND 5)`; editable within the window. RLS: a student may upsert only if they are a non-teacher member of that section's classroom; teachers/admins never read individual rows.
- **`teacher_section_schedule_rdm_grants`** gains nullable quality columns: `quality_rating_count`, `quality_avg_x10`, `quality_adjusted_x10`, `quality_bonus_rdm`, `quality_awarded_at`.

## RPCs

- `submit_live_class_rating(p_section_id, p_occurrence_at, p_stars)` — student-callable (SECURITY DEFINER); validates membership, star range, that the occurrence has ended, and that it is within the window; upserts one row.
- `award_teacher_section_schedule_quality_rdm(p_section_id, p_occurrence_at)` — credit-only; idempotent via `quality_awarded_at`; enforces both gates + monthly cap; `add_rdm(teacher, +bonus)` only when it qualifies.
- `award_eligible_teacher_live_class_quality_rdm(p_teacher_id)` — scans the teacher's delivery grants whose window has closed and `quality_awarded_at IS NULL`, calls the per-occurrence RPC.

## Surfaces

- **Student:** `POST /api/classroom/live-class/rate` → `submit_live_class_rating`. Star prompt component reused from the `ReviewPopup` pattern.
- **Teacher:** `POST /api/teacher/section-schedule/award-quality-rdm` → `award_eligible_...`; auto-run via `useTeacherLiveClassQualityRdmAwards` beside the delivery hook in `app/teacher-portal/page.tsx`; toast "+200 RDM · Class quality bonus".
- **Admin:** new keys added to `TEACHER_RDM_ADMIN_META` (`lib/teacherPortal/teacherRdmConfig.ts`).

## Pure logic + tests

`lib/teacherPortal/liveClassQualityRdm.ts` holds the scoring/quorum math (no DB) so it is unit-tested in `lib/teacherPortal/liveClassQualityRdm.test.ts` and mirrored exactly by the SQL RPC.
