# Phase 0 — Scheduled jobs (manual only)

**Status:** No Vercel Cron schedules in `vercel.json` (removed 2026-06-11).

## Production behavior

| Environment | Automatic schedules? |
|-------------|-------------------|
| `npm run dev` / localhost | **No** |
| Vercel production | **No** — nothing in `vercel.json` `crons` |

Cron API routes still exist for **manual** or **external** triggers only. They do not run on a timer in production unless you add schedules again or use another scheduler.

## Available routes (not scheduled)

| Path | Purpose |
|------|---------|
| `/api/cron/refund-doubt-bounties` | Refund expired doubt bounties (7-day rule) |
| `/api/cron/archive-classroom-sections` | Deactivate classroom sections past `schedule_end_date` |
| `/api/cron/gyan-bot-post` | **Do not schedule** without budget review (AI + DB cost) |
| `/api/cron/prune-telemetry-logs` | Prune `ai_token_logs` >90d, dwell events >180d; ensures dwell partition (Phase 2/5) |
| `/api/cron/flush-site-presence` | Flush Upstash site-presence buffer → Postgres (Phase 5; needs Upstash env) |
| `/api/cron/warm-admin-analytics` | Pre-warm admin analytics cache (Phase 5) |

`pg_cron` is **not** enabled on production Supabase either.

## Manual run (when you choose)

```powershell
# Local dev (with .env service role):
curl.exe -s http://localhost:3000/api/cron/archive-classroom-sections
curl.exe -s http://localhost:3000/api/cron/refund-doubt-bounties

# Production (require CRON_SECRET if set):
curl.exe -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR_DOMAIN/api/cron/archive-classroom-sections
```

## If you want schedules later

Re-add to `vercel.json` only after you accept brief serverless invocations (not continuous RAM — each cron is one short HTTP request). Example:

```json
{
  "crons": [
    { "path": "/api/cron/refund-doubt-bounties", "schedule": "0 0 * * *" },
    { "path": "/api/cron/archive-classroom-sections", "schedule": "10 0 * * *" }
  ]
}
```

Set `CRON_SECRET` on Vercel when using scheduled crons.
