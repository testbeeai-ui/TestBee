# Phase 5 — Scale architecture

**Status:** Implemented 2026-06-11.

**Goal:** Telemetry and heavy reads do not scale linearly with every open tab / admin refresh.

---

## 1. Site presence buffer (Upstash Redis — opt-in)

When `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set:

| Path | Behavior |
|------|----------|
| `POST /api/user/site-presence` | Heartbeats go to **Redis only** (no Postgres write per tick) |
| Buddy `activity-signal` / `dashboard` | **Flush** buddy's Redis key → Postgres before read |
| `GET/POST /api/cron/flush-site-presence` | Flush all buffered keys (recommend every **5 min**) |

Without Upstash env vars → **unchanged** Postgres path (Phase 3).

**Setup:** [Upstash Redis](https://upstash.com/) → create DB → add env to Vercel + `.env.local`:

```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

---

## 2. Admin analytics cache (15 min + warm cron)

| Change | Files |
|--------|-------|
| TTL **60s–300s → 15 min** | `lib/admin/adminAnalyticsConfig.ts`, all `app/api/admin/analytics/*/route.ts` |
| Pre-warm cron | `lib/admin/warmAdminAnalyticsCache.ts`, `app/api/cron/warm-admin-analytics/route.ts` |

Manual warm (local):

```powershell
curl.exe -s http://localhost:3000/api/cron/warm-admin-analytics
```

Production (with `CRON_SECRET`):

```powershell
curl.exe -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR_DOMAIN/api/cron/warm-admin-analytics
```

Recommend external schedule every **10–15 min** while admins use dashboards (not in `vercel.json` by default).

---

## 3. Dwell events monthly partitions

| File | What |
|------|------|
| `20260811150000_phase5_dwell_events_partition.sql` | `PARTITION BY RANGE (occurred_at)`; monthly 2024-01 → 2028-12; `ensure_dwell_events_partition()` |

```bash
npx supabase db push
```

`prune-telemetry-logs` cron calls `ensure_dwell_events_partition()` before prune (creates next month if missing).

---

## 4. MCQ chapter preview server cache

| Change | Files |
|--------|-------|
| Cached API (`unstable_cache` 1h) | `app/api/mock/cbse-chapter-mcqs/route.ts` |
| Server fetch | `lib/mock/fetchCbseChapterMcqsServer.ts` |
| Client calls API | `lib/mock/fetchCbseChapterMcqs.ts` |

Prep → CBSE MCQ's chapter preview no longer hits Supabase directly from the browser on every open.

---

## New cron routes (manual / external only)

| Path | Purpose |
|------|---------|
| `/api/cron/flush-site-presence` | Redis → Postgres presence flush |
| `/api/cron/warm-admin-analytics` | Pre-warm admin analytics cache |

See also `supabase-cost-phase0-crons.md`.

---

## Verify

1. **Without Upstash** — site-presence still writes Postgres; buddy online works.
2. **With Upstash** — site-presence returns `buffered: true`; after buddy poll, Postgres row updates.
3. **Admin** — dashboard shows `fromCache: true` within 15 min; warm cron returns `keys` array.
4. **MCQ** — Network tab shows `/api/mock/cbse-chapter-mcqs` (not direct `mock_questions` from browser).
5. **Dwell** — `\d+ student_learning_dwell_events` shows partitions in SQL editor.

---

## Not in Phase 5

- Topic hub UX → Phase 6
- Merge RAG project → rejected (Phase 4 Option A)
