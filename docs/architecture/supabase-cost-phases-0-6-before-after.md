# Supabase cost work — Phases 0 to 6 (before & after)

**Date:** 2026-06-11  
**Purpose:** One place to see what changed, how things worked before, how they work now, and what to check if something feels wrong.

**Main Supabase project:** `bytsiknhtcnlxwzgqkrd` (your app, users, content)  
**RAG Supabase project:** `yobzgdsecnutzyvuidqz` (textbook chunks only — we did **not** touch or merge this)

---

## Quick summary

| Phase | What it was about | Main idea |
|-------|-------------------|-----------|
| **0** | Scheduled background jobs | Nothing runs on a timer in production anymore |
| **1** | Small code fixes | Fewer repeated DB calls and RAG lookups |
| **2** | Database cleanup | Faster security checks, leaner indexes, old logs can be pruned |
| **3** | Live updates & connections | Less Realtime traffic, smaller classroom feeds, safer presence |
| **4** | Billing & architecture rules | Keep two Supabase projects; no merge of RAG |
| **5** | Scale for more users | Optional Redis buffer, longer admin cache, MCQ cache, dwell partitions |
| **6** | Explore topic hub UX | Show content that was already in DB but looked empty |

---

## Phase 0 — Background jobs (crons)

### What was the problem?

Vercel could wake up your app on a schedule. Each wake-up uses server resources. Some jobs (like the Gyan bot) also call AI and the database, which adds cost even when nobody is using the app.

### Before

- `vercel.json` could list cron schedules that hit routes like refund bounties, archive classrooms, Gyan bot posts, etc.
- Those jobs might run automatically in production without you clicking anything.

### After

- `vercel.json` is empty — **no automatic schedules**.
- The API routes still exist. You (or an external scheduler) can call them manually when you want.
- Supabase `pg_cron` is also **not** enabled on production.

### What you might notice

- Expired doubt refunds and classroom archiving **do not happen by themselves** until you run the routes or add schedules back.
- Gyan bot posts **will not** run on a timer unless you schedule them again (this was intentional — that job is expensive).

### If something feels wrong

| Symptom | Likely cause | What to do |
|---------|--------------|------------|
| Bounties not refunding after 7 days | No cron running | Call `/api/cron/refund-doubt-bounties` manually or re-add a schedule |
| Old classrooms not archiving | Same | Call `/api/cron/archive-classroom-sections` |
| You wanted automatic daily cleanup | Phase 0 removed auto runs | Re-add only the safe jobs to `vercel.json` (see `supabase-cost-phase0-crons.md`) |

**Routes still available (manual only):**

- `/api/cron/refund-doubt-bounties`
- `/api/cron/archive-classroom-sections`
- `/api/cron/gyan-bot-post` — avoid scheduling without a budget review
- `/api/cron/prune-telemetry-logs`
- `/api/cron/flush-site-presence` (Phase 5)
- `/api/cron/warm-admin-analytics` (Phase 5)

---

## Phase 1 — Quick wins (less waste per user action)

### What was the problem?

Several features were hitting the database or RAG more often than needed for the same user experience.

### Before → After (each item)

#### 1. Study-day penalty check

| Before | After |
|--------|-------|
| Every profile/dashboard load could trigger a heavy “reconcile penalties” DB job | Reconcile runs **at most once per IST calendar day**, and only when the client asks with `reconcile=1` on the first load of that day |

**You might notice:** First visit of the day may still do a bit more work; later visits that day are lighter.

---

#### 2. “Who is online” heartbeat

| Before | After |
|--------|-------|
| Browser sent presence updates about every **20 seconds** | Updates about every **50 seconds** (client and server agree on this) |

**You might notice:** Buddy “online” status may update slightly slower (by ~30s). Still feels live for humans.

---

#### 3. Profile page Realtime reloads

| Before | After |
|--------|-------|
| A Realtime event could trigger **four separate reloads** in a row | Events are **batched for 450ms** — one reload burst instead of four |

**You might notice:** Profile panels feel the same, but fewer network spikes in the background.

---

#### 4. Subject chat RAG (student Q&A passages)

| Before | After |
|--------|-------|
| Could pull up to 10 textbook passages per question | Caps at **5 passages** for subject chat (admin/agent routes can still use more) |

**You might notice:** Answers might cite slightly fewer passages; Gyan+ / Prof-Pi still works — this only trims volume.

---

#### 5. Modal RAG retriever (Python sidecar)

| Before | After |
|--------|-------|
| Retriever could run 2–3 search passes even when the first pass was already good | **Skips extra passes** when pass 1 returns usable chunks |

**You might notice:** Faster/cheaper RAG calls after Modal redeploy.  
**Important:** This needs **`modal deploy`** — code change alone is not live until you redeploy Modal.

---

## Phase 2 — Database hygiene

### What was the problem?

- Row-level security (RLS) was re-checking `auth.uid()` on every row — slow on big tables.
- Some indexes were duplicates or unused — wasted disk and slower writes.
- Old AI logs and dwell events could grow forever.

### Before → After

#### RLS on busy tables

| Before | After |
|--------|-------|
| Policies used bare `auth.uid()` — evaluated per row | Hot tables use `(select auth.uid())` — evaluated once per query |

**Tables touched:** posts, profiles, classroom members, doubts, doubt answers/votes/saves/reports, classrooms, live sessions, class exploration sessions.

**You might notice:** You should not notice anything different in the app — same permissions, less CPU on Supabase.

---

#### Indexes

| Before | After |
|--------|-------|
| Extra duplicate/unused indexes on several tables | **Removed 4** redundant indexes; **added 5** useful ones (e.g. teacher_id, classroom_id on hot paths) |

**You might notice:** Nothing visible — this is internal speed/cleanup.

---

#### Log retention

| Before | After |
|--------|-------|
| `ai_token_logs` and dwell events kept growing | New function `prune_telemetry_logs()` — manual route can delete logs **older than 90 days** (AI logs) and **180 days** (dwell events) |

**You might notice:** Old analytics history disappears after a prune run — only if you actually call the cron.

---

#### Admin analytics cache (first version)

| Before | After |
|--------|-------|
| Every admin dashboard refresh hit heavy SQL | Short in-memory cache (60s–300s depending on report) |

*(Phase 5 later extended this to 15 minutes — see below.)*

---

## Phase 3 — Connections & Realtime

### What was the problem?

Too many live WebSocket subscriptions and large one-shot queries when users had buddy panel or classroom feed open.

### Before → After

#### Buddy dashboard live updates

| Before | After |
|--------|-------|
| Realtime listened to **4 tables**; polls could be aggressive | Realtime on **1 table** (`student_site_presence`); backup poll **50s**, full refresh **8 min** |

**You might notice:** Buddy list still updates; slightly less “instant” on edge cases that used to listen to extra tables.

---

#### Teacher portal backup poll

| Before | After |
|--------|-------|
| Refreshed bundle every **90 seconds** as fallback | Every **120 seconds** |

**You might notice:** Slightly slower fallback refresh if Realtime misses an event (rare).

---

#### Site presence API

| Before | After |
|--------|-------|
| Route could rely on service-role / elevated access patterns | Uses **normal logged-in user RLS**; users can delete their own presence rows (new migration) |

**You might notice:** Presence should work the same for students. Requires migration `20260811140000_phase3_presence_delete_own.sql` applied on main DB.

---

#### Classroom feed

| Before | After |
|--------|-------|
| Could load **all posts** at once | **40 posts per page** + “Load more” |

**You might notice:** Big classes show first 40 posts; user taps Load more for older posts.

---

#### Supavisor (connection pooling)

| Before | After |
|--------|-------|
| Not documented / may be off | **Recommended** — enable in Supabase Dashboard → Database → Connection pooling |

**You might notice:** No app code change needed for current setup. This is a dashboard toggle for when you have many concurrent users.

---

## Phase 4 — Infrastructure & billing (rules, not code)

### What was the problem?

Two Supabase projects cost money. There was a question: merge RAG into main to save one bill?

### Decision (locked)

| Before (question) | After (decision) |
|-------------------|------------------|
| Two projects: main + RAG | **Keep both separate forever** (Option A) |

**Why:** RAG holds textbook vectors. Merging would risk breaking Gyan+ Q&A and need a big migration. Cost is controlled in Phase 1 (fewer RAG calls) instead.

### Other Phase 4 outcomes (documentation only)

| Item | Status |
|------|--------|
| Merge / pause / delete RAG project | **Do not do** |
| Custom auth domain `auth.edublast.in` | **Deferred** until Pro + add-on is worth it |
| Supabase preview branches per PR | **Avoid** — each branch costs extra |
| `SUPABASE_FETCH_RETRIES=1` on Vercel | **Recommended** — fewer retry storms |

**You might notice:** Nothing changed in the running app from Phase 4 alone — it is policy and checklists.

---

## Phase 5 — Scale architecture

### What was the problem?

As more tabs stay open (presence heartbeats) or admins refresh dashboards, costs could grow linearly with every ping.

### Before → After

#### 1. Site presence buffer (optional Redis)

| Before | After |
|--------|-------|
| Every heartbeat wrote straight to Postgres | **If** Upstash env vars are set: heartbeats go to **Redis** first; Postgres updated on flush (buddy poll, dashboard, or cron every ~5 min) |
| | **If** Upstash **not** set: behaves exactly like Phase 3 (Postgres every heartbeat) |

**Env (optional):** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

**You might notice:** With Redis, “last seen” in DB may lag up to a few minutes until flush — buddy UI still feels live from Redis path.

---

#### 2. Admin analytics cache (longer)

| Before (Phase 2) | After (Phase 5) |
|------------------|-----------------|
| Cache 60s–300s | Cache **15 minutes** + optional warm cron `/api/cron/warm-admin-analytics` |

**You might notice:** Admin numbers can be up to 15 minutes stale. Faster loads, fewer heavy queries.

---

#### 3. Dwell events table partitions

| Before | After |
|--------|-------|
| One big table for lesson time samples | **Monthly partitions** (2024–2028); prune cron ensures next month exists |

**You might notice:** Nothing in UI — easier to drop old months later.

---

#### 4. MCQ chapter preview

| Before | After |
|--------|-------|
| Browser could query Supabase directly for chapter MCQ previews | Browser calls **`/api/mock/cbse-chapter-mcqs`** with **1 hour server cache** |

**You might notice:** Prep → CBSE MCQs chapter preview loads the same; one less direct DB hit from the client.

---

## Phase 6 — Topic hub UX (Explore)

### What was the problem?

Content existed in the database but Explore showed blank lines (`—`) or wrong overview text.

### Before → After

#### Multi-level content

| Before | After |
|--------|-------|
| Explore only loaded **`basics`** level for overview | Loads **basics + intermediate + advanced** and shows the **best available** text for each section |

**You might notice:** Overviews appear when only intermediate/advanced had content.

---

#### Placeholder `"-"` from AI agent

| Before | After |
|--------|-------|
| Agent stores `"-"` when a section is skipped; UI treated it as real text or showed confusing empty state | `"-"` counts as **empty**; friendly message when **subtopic previews** exist but overview sections do not |

**You might notice:** Less “empty dash” confusion; clearer copy for admins.

---

#### Admin coverage page

| Before | After |
|--------|-------|
| No single view of which topics have all 3 levels ready for subtopic AI | **`/admin/topic-hub`** — table per topic/chapter showing basics / intermediate / advanced status |

**You might notice:** New item in Admin sidebar: **Topic hub**.

---

## Migrations applied (main DB)

Run these on `bytsiknhtcnlxwzgqkrd` if any environment is behind:

| Migration | Phase |
|-----------|-------|
| `20260811120000_phase2_rls_initplan_hot_tables.sql` | 2 |
| `20260811120100_phase2_indexes_and_prune.sql` | 2 |
| `20260811130000_phase2b_rls_initplan_extended.sql` | 2 |
| `20260811130100_phase2b_index_cleanup.sql` | 2 |
| `20260811140000_phase3_presence_delete_own.sql` | 3 |
| `20260811150000_phase5_dwell_events_partition.sql` | 5 |

---

## Still manual (not automatic today)

| Task | How |
|------|-----|
| Refund expired doubt bounties | Call cron route or add schedule |
| Archive old classroom sections | Call cron route or add schedule |
| Prune old AI / dwell logs | `/api/cron/prune-telemetry-logs` |
| Warm admin analytics | `/api/cron/warm-admin-analytics` |
| Flush Redis presence → Postgres | `/api/cron/flush-site-presence` (only if Upstash enabled) |
| Modal retriever skip multi-pass | Redeploy Modal (`modal-rag`) |
| Enable Supavisor | Supabase Dashboard |
| Enable Upstash presence buffer | Add env vars on Vercel |

---

## Decision checklist — “Did we break something?”

Use this if you want a fast yes/no review.

| Question | Expected answer | If “no” — investigate |
|----------|-----------------|------------------------|
| Can students still log in and use Gyan+ / subject chat? | Yes | RAG Modal URL + main Supabase env |
| Does RAG still use the **separate** RAG project? | Yes | Modal secret `RAG_SUPABASE_URL` → `yobzgdsecnutzyvuidqz` |
| Did we merge or delete the RAG Supabase project? | **No** | Should never happen (Phase 4) |
| Do buddy / online features still work? | Yes | Phase 3 migration applied; check site-presence API |
| Are classroom feeds usable in big classes? | Yes (paginated) | Load more button |
| Are Explore topic overviews less empty when DB has data? | Yes | Phase 6 bundle fetch |
| Are production crons running without you adding them back? | **No** | By design (Phase 0) |
| Is old telemetry deleting itself? | **No** | Only when you run prune cron |
| Is admin data always live to the second? | **No** | Up to 15 min cache (Phase 5) |
| Is presence in Postgres instant with Upstash on? | **No** | Buffered; flush on interval |

---

## What we deliberately did **not** do

- Merge RAG Supabase into main
- Schedule Gyan bot posts automatically
- Bulk-delete 80+ unused indexes (too risky without per-feature review)
- Fix RLS initplan on every remaining table (~70 left for a future sweep)
- Enable Pro + custom auth domain (cost deferred)
- Change math layout or Prof-Pi answer structure

---

## Related docs (detail per phase)

| Phase | Runbook |
|-------|---------|
| 0 | `docs/architecture/supabase-cost-phase0-crons.md` |
| 1 | `docs/architecture/supabase-cost-phase1-quick-wins.md` |
| 2 | `docs/architecture/supabase-cost-phase2-db-hygiene.md` |
| 3 | `docs/architecture/supabase-cost-phase3-connections-realtime.md` |
| 4 | `docs/architecture/supabase-cost-phase4-infra-billing.md` |
| 5 | `docs/architecture/supabase-cost-phase5-scale-architecture.md` |
| 6 | `docs/architecture/supabase-cost-phase6-topic-hub-ux.md` |
| Full audit | `docs/architecture/supabase-cost-audit-2026-06-11.md` |

---

## One-line memory entry

For agents: see `.cursor/memory.md` Decisions Log (2026-06-11 entries for Phases 0–6).
