# Teacher welcome RDM first-claim lock

One-time `teacher_profile_welcome_rdm` is paid when a profile first becomes an onboarded teacher.

- Stamp `profiles.teacher_welcome_rdm_claimed_at` in a BEFORE trigger; never clear it.
- Credit in the AFTER trigger only when **this statement just stamped that row**.
- Just-stamped ids live in a **temp table** (`pg_temp.teacher_welcome_rdm_just_stamped`, one row per id). A session GUC is unsafe: PostgreSQL fires every BEFORE ROW stamp before any AFTER ROW credit.
- Restore `INSERT` of an already-stamped onboarded teacher has `NEW.claimed_at` set and no `OLD` row, so it must **not** be in the temp table and must not pay.
- Flipping `onboarding_complete` keeps the stamp on `OLD` and does not pay again.

Latest migration: `supabase/migrations/20261018140000_teacher_welcome_rdm_just_stamped_rows.sql`.
Spec mirror: `lib/teacherPortal/teacherWelcomeRdmClaim.ts`.
