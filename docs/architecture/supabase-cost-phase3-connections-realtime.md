# Phase 3 — Connections & Realtime

**Status:** Implemented 2026-06-11 (code). Supavisor requires a one-time dashboard step.

## Code changes

| # | Work | Files |
|---|------|-------|
| 1 | Buddy Realtime: **4 tables → 1** (`student_site_presence`); polls **50s** / full refresh **8 min** | `hooks/useBuddyDashboardLive.ts`, `lib/dashboard/connectionRealtimeConstants.ts` |
| 2 | Teacher portal backup poll **90s → 120s** | `hooks/useTeacherPortalBundleAutoRefresh.ts` |
| 3 | Site presence via **authenticated RLS** (no service role) | `app/api/user/site-presence/route.ts` |
| 4 | Classroom feed **paginated** (40 per page + Load more) | `components/ClassFeed.tsx`, `lib/classroom/classroomFeedConstants.ts` |

## Migration

| File | What |
|------|------|
| `20260811140000_phase3_presence_delete_own.sql` | `DELETE` own row on `student_site_presence`, `student_learning_presence`, `student_gyan_presence` |

```bash
npx supabase db push
```

Or paste the SQL file in Supabase SQL editor (main project `bytsiknhtcnlxwzgqkrd`).

**Required before** site-presence works without service role in production.

## Supavisor (dashboard — you)

The Next.js app uses **supabase-js over HTTPS** (PostgREST), not a direct `postgres://` URL. Enabling Supavisor still reduces backend connection pressure on the database and is recommended before scaling concurrent users.

1. Supabase Dashboard → **Project Settings** → **Database** → **Connection pooling**
2. Enable **Supavisor** (transaction mode)
3. No app env change needed for current `createClient()` / `createAdminClient()` paths — they keep using `NEXT_PUBLIC_SUPABASE_URL`
4. If you add server-side direct SQL later, use the **pooler** host on port **6543** (transaction mode), not port 5432

## Verify locally

1. **Buddy panel** — open a buddy; Network tab: `activity-signal` ~every 50s (not 20s); one Realtime channel on `student_site_presence`.
2. **Site presence** — `POST /api/user/site-presence` works with only anon + user session (no `SUPABASE_SERVICE_ROLE_KEY` required for this route).
3. **Classroom feed** — class with 40+ posts shows **Load more posts** and `Showing N of total`.
4. **Teacher portal** — bundle still refreshes on attempts/progress Realtime; backup poll every 120s.

## Not in Phase 3

- Redis presence buffer → Phase 5
- RAG project merge → Phase 4 **rejected** (Option A: keep separate) — `supabase-cost-phase4-infra-billing.md`
- Bulk RLS initplan on remaining ~145 policies → later sweep
