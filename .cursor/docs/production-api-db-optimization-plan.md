# Production API & DB optimization plan

**Date:** 2026-06-22  
**Scope:** Last ~7 days of product work + full request/DB path audit for speed, egress, and storage.

---

## 1. What changed this week (drives new load)

| Date | Change | API/DB impact |
|------|--------|----------------|
| 06-18 | Save limits (bits, formulas) on `rdm_config` + `/api/user/saved-content` cap checks | +2 `COUNT` queries per capped POST type |
| 06-19 | Chapter hub progress (`bits_test_attempts` + `subtopic_engagement`) | Extra reads on explore visibility refresh |
| 06-20 | Saved questions plan cap (`saved_question_limit`) | Cap check on `/api/user/saved-questions` |
| 06-20–21 | InstaCue dedupe + stable `rev-*` ids | Slightly smaller revision payloads; merge CPU on client |
| 06-21–22 | Revision recall (Tomorrow / Unsure / Know It) + `reviewAt` | Every status tap → **full `syncAllSavedContent` POST**; `refreshDueRevisionCards` every 60s (local only) |
| 06-22 | `useRecallNowMs` clock on dashboard + revision | No extra network; optional store write when cards promote |
| 06-22 | Prof Pi chat UI | Subject chat quota/language endpoints unchanged |
| Week | Razorpay checkout + subscription gates | Payment routes; no steady-state DB churn |

**Takeaway:** The biggest new steady-state risk is **revision recall** → more frequent **bulk saved-content syncs**, on top of an already heavy sync model.

---

## 2. Current request map (student session)

### 2.1 High-frequency (every active minute)

| Endpoint | Trigger | Interval | DB touch |
|----------|---------|----------|----------|
| `POST /api/user/site-presence` | `SitePresenceProvider` | ~50s heartbeat | `student_site_presence` upsert |
| `POST /api/user/study-days` | presence flush | ≥2s chunks, ~25s batch | `student_study_days` delta |
| `POST /api/user/learning-dwell` | lesson subtopic tab | 60s + panel switch | `student_learning_dwell_events` insert |
| `POST /api/user/learning-presence` | lesson subtopic tab | 90s + panel switch | `student_learning_presence` upsert (2min server dedupe) |
| `GET /api/buddy/activity-signal` | buddy panel | 50s | light read |
| `GET /api/buddy/dashboard` | buddy panel | 8min fallback | multi-table read |

### 2.2 Medium-frequency (lesson / revision)

| Endpoint | Trigger | Est. rate | DB touch |
|----------|---------|-----------|----------|
| `GET/POST /api/user/subtopic-engagement` | topic page state | debounced **400ms** on change | `SELECT * profiles` + **full `subtopic_engagement` JSONB rewrite** |
| `POST /api/user/bits-attempts` | quiz submit | per submit | `profiles.bits_test_attempts` JSONB merge |
| `PATCH /api/user/daily-checklist` | InstaCue read | **per card** after 600ms | `profiles` + engagement read |
| `GET/POST /api/user/saved-content` | login, dashboard, revision, every save | **3–5+ GETs/session**; **1 full POST per save action** | see §3 |

### 2.3 Login / navigation burst (duplicate GETs)

Same user often hits **`GET /api/user/saved-content`** from:

1. `hooks/useAuth.tsx` → `syncSavedFromProfile`
2. `DashboardMemoryRecallPanel` mount
3. `app/revision/page.tsx` mount
4. `app/revision/page.tsx` again when tab = saved \| community
5. `MockPageContent` (mock bookmarks)

No shared cache TTL → **redundant full-table reads** of `user_saved_items`.

---

## 3. Critical DB patterns (cost + space)

### 3.1 `saved-content` POST — **P0**

**File:** `app/api/user/saved-content/route.ts`

Current flow per sync:

```
Client: syncAllSavedContent() → entire Zustand snapshot (all 5 arrays)
Server:
  For each array present:
    checkCap → profiles SELECT + user_saved_items COUNT
    profiles UPDATE (JSONB columns)     ← legacy dual-write
    syncItemType:
      DELETE all rows (user_id + item_type)
      INSERT all rows again
```

**Problems:**

- One InstaCue **Tomorrow** tap re-uploads **all** bits, formulas, units, community posts, revision cards.
- **Delete-all + insert-all** per type = O(n) writes, index churn, WAL bloat.
- **Dual storage:** `profiles.saved_*` JSONB **and** `user_saved_items.data` JSONB (2× space for saved content).
- GET reads `user_saved_items` only (good) but POST still writes both.

**Rough cost (example user):** 80 revision cards + 40 bits + 20 formulas → ~140 rows deleted + 140 inserted **per sync**, plus profiles JSONB update (~200KB+).

### 3.2 `subtopic-engagement` POST — **P0**

**File:** `app/api/user/subtopic-engagement/route.ts`

- `SELECT *` from `profiles` on every save.
- Merges one subtopic into **entire** `subtopic_engagement` map → `UPDATE profiles`.
- Topic page debounce **400ms** → up to **2–3 writes/sec** during active quiz navigation.
- Blob grows with every subtopic visited (trim exists but still one fat JSONB column).

### 3.3 Telemetry tables — **P1** (volume)

- Dwell events append-only; prune cron exists (`/api/cron/prune-telemetry-logs`) but **not in vercel.json by default** — confirm scheduled in prod.
- Retention: AI tokens 90d, dwell 180d.

### 3.4 Revision recall `reviewAt` — **P2** (small)

- +1 ISO field per scheduled card in `data` JSONB — negligible vs full-card content.

---

## 4. Optimization plan (phased)

### Phase 0 — Quick wins (1–2 days, no schema migration)

| # | Action | Saves | Effort |
|---|--------|-------|--------|
| 0.1 | **Saved-content fetch coordinator** — module cache `{ data, fetchedAt, userId }`, TTL 60s, dedupe in-flight promises. Use in `useAuth`, dashboard, revision, mock. | −2 to −4 GETs per session | S |
| 0.2 | **Debounce `syncAllSavedContent`** — queue writes, flush 2–5s, coalesce rapid InstaCue status taps. | −70% POSTs during recall sessions | S |
| 0.3 | **PATCH revision recall** — new `PATCH /api/user/saved-content/revision-cards` with `{ cardId, status, reviewAt? }` single-row upsert in `user_saved_items`; client calls this instead of full POST for recall actions. | −95% bytes + rows touched per tap | M |
| 0.4 | **Skip POST when unchanged** — compare hash/fingerprint of each array before sync; no-op if identical. | −idle syncs | S |
| 0.5 | **InstaCue read batching** — buffer `reportInstacueCardRead` 5s / max 10 ids → existing `instacue_read_batch`. | −PATCH spam on revision scroll | S |
| 0.6 | **Schedule prune cron** in Vercel — daily `POST /api/cron/prune-telemetry-logs` with `CRON_SECRET`. | disk growth cap | S |
| 0.7 | **Recall clock: promote without sync** — `refreshDueRevisionCards` already local; ensure **no** `syncAllSavedContent` on minute tick (verify — currently OK). | — | ✓ |

### Phase 1 — API shape (3–5 days)

| # | Action | Saves | Effort |
|---|--------|-------|--------|
| 1.1 | **Incremental `user_saved_items` sync** — replace delete-all+insert with `upsert` on `(user_id, item_type, content_id)` + `delete` only removed ids (diff client vs server). | −80% write amplification | M |
| 1.2 | **Stop profiles JSONB dual-write** for saved content (read from `user_saved_items` only; one-time backfill migration). | −50% saved-content storage | M |
| 1.3 | **Subtopic engagement: skip unchanged** — server hash `snapshot`; return 204 if equal. | −50% engagement writes | S |
| 1.4 | **Subtopic engagement debounce** — client 400ms → **1500ms**; flush on `visibilitychange` / route leave (already partial). | −60% engagement POSTs | S |
| 1.5 | **Cap check cache** — per-request memoize plan tier + limits (already one profile read; avoid repeat per type in same POST). | −3 queries per POST | S |

### Phase 2 — Schema & scale (1–2 weeks)

| # | Action | Saves | Effort |
|---|--------|-------|--------|
| 2.1 | **`subtopic_engagement` table** — one row per scope key (like `user_saved_items`); drop megabyte `profiles.subtopic_engagement`. | faster reads/writes, less TOAST | L |
| 2.2 | **`bits_test_attempts` table** — same pattern as above. | same | L |
| 2.3 | **GET saved-content: ETag / `If-None-Match`** — 304 when unchanged. | −egress on repeat GETs | M |
| 2.4 | **Partial GET** — `?types=revision_cards` for dashboard recall panel only. | −payload on dashboard | M |
| 2.5 | **Revision card `data` slim** — store `reviewAt` + `status` in indexed columns (already have `status`, `saved_at`); strip duplicate fields from `data` JSON. | −row size | M |

### Phase 3 — Observability

| # | Action |
|---|--------|
| 3.1 | Log slow saved-content POST duration + row counts (dev + sampled prod). |
| 3.2 | Supabase dashboard: monitor `user_saved_items` growth, `profiles` row size, dwell partition count. |
| 3.3 | Client metric: `saved_content_sync_bytes`, `saved_content_sync_duration_ms` via existing `track()`. |

---

## 5. Target architecture (saved content)

```
Today:
  [every save] → full POST → profiles JSONB + DELETE ALL + INSERT ALL × types

Target:
  [recall tap] → PATCH one card → upsert 1 row in user_saved_items
  [bulk import] → POST diff or batch upsert
  [login]       → GET with ETag → 304 or partial types
  [local]       → Zustand persist (source of truth until flush)
```

---

## 6. Priority order (production)

```
P0  0.1 fetch dedupe
P0  0.2 debounce sync
P0  0.3 PATCH single-card recall
P0  1.1 incremental upsert (replace delete-all)
P1  1.2 end profiles dual-write
P1  1.3–1.4 subtopic engagement throttle
P1  0.6 cron prune scheduled
P2  2.1–2.2 normalize JSONB blobs to tables
P2  2.3–2.4 ETag + partial GET
```

---

## 7. Files to touch (implementation index)

| Area | Files |
|------|--------|
| Saved fetch cache | `lib/saved/savedContentService.ts`, `hooks/useAuth.tsx`, `DashboardMemoryRecallPanel.tsx`, `app/revision/page.tsx` |
| Debounce / PATCH | `lib/saved/savedContentService.ts`, new `app/api/user/saved-content/revision-cards/route.ts` |
| Incremental sync | `app/api/user/saved-content/route.ts` → `syncItemType` rewrite |
| Recall client | `components/InstaCuePlayer.tsx`, `DashboardMemoryRecallPanel.tsx` |
| InstaCue read batch | `lib/rdm/reports/reportInstacueCardRead.ts`, `InstaCuePlayer.tsx` |
| Engagement | `app/[board]/.../page.tsx` debounce, `subtopic-engagement/route.ts` hash skip |
| Cron | `vercel.json` or external scheduler |

---

## 8. Success metrics

| Metric | Baseline (estimate) | Target |
|--------|---------------------|--------|
| `saved-content` POSTs per revision session (10 card reviews) | ~10 full POSTs | ≤2 (debounced) or 10 PATCHes |
| Rows written per recall tap | ~140 delete + ~140 insert | 1 upsert |
| `saved-content` GETs per home visit | 2–3 | 1 |
| `subtopic-engagement` POSTs per 10 min lesson | 50–150 | <15 |
| `profiles` saved JSONB size per active user | grows unbounded dual | single source in `user_saved_items` |

---

## 9. Out of scope (do not break)

- Learning buddy realtime (site presence heartbeat alignment).
- Plan cap enforcement (must stay server-side).
- Offline-first Zustand persist (local wins until merge).

---

## 10. Phase 1 — implemented (2026-06-22)

| Item | Status |
|------|--------|
| 1.1 Incremental `user_saved_items` upsert + delete removed ids only | Done — `lib/saved/userSavedItemsSync.ts` |
| 1.2 Stop profiles JSONB dual-write on saved-content POST | Done — writes `user_saved_items` only |
| 1.2 GET fallback from profiles when `user_saved_items` empty | Done — migration safety |
| 1.2 PATCH revision-cards profiles write removed | Done |
| 1.3 Subtopic engagement skip unchanged (204) | Done — `subtopicEngagementSnapshotHash.ts` |
| 1.4 Engagement debounce 400ms → 1500ms + flush on unmount | Done — topic page |
| 1.5 Cap check one profile read per POST | Done — `createCapContext` |

## 11. Phase 2 — implemented (2026-06-23)

| Item | Status |
|------|--------|
| 2.1 `student_subtopic_engagement` table + route table-first | Done — migration `20260811120000` |
| 2.2 `student_bits_attempts` table + route table-first | Done |
| 2.3 GET saved-content ETag / If-None-Match | Done — server + client |
| 2.4 Partial GET `?types=` | Done — dashboard + revision tabs |
| 2.5 Revision card `data` slim | Done — `review_at` column + `revisionCardRowPayload.ts` |
| 3.1–3.3 Observability | Done — slow POST log + `track()` sync/fetch metrics |
| Backfill script | Done — `scripts/backfill-user-saved-items.ts` |
| Sidebar InstaCue due badge | Done |

## 12. Dev network resilience (2026-06-23)

| Item | Status |
|------|--------|
| `supabaseNodeFetch` 30s total budget + tighter per-phase timeouts | Done |
| Middleware Supabase fetch 12s deadline | Done |
| Client API fetch 25s abort (`fetchWithClientAuth`, saved-content GET) | Done |
| Site-presence heartbeat in-flight skip (no pile-up) | Done |
| API 503 + `Retry-After` on upstream network errors | Done — saved-content, site-presence |

**If ECONNRESET persists on your ISP:** add `SUPABASE_FETCH_IP_FAMILY=4` to `.env` and restart dev server.
