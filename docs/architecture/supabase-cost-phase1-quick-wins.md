# Phase 1 — Quick wins (code)

**Status:** Implemented 2026-06-11.

## Changes

| # | Work | Files |
|---|------|-------|
| 1 | Study-day penalty reconcile **opt-in** (`reconcile=1`) once per **IST** day | `lib/dashboard/studyDaysClient.ts`, `app/api/user/study-days/route.ts` |
| 2 | Site presence heartbeat **20s → 50s** (client + server dedupe aligned) | `lib/dashboard/sitePresenceConstants.ts`, `SitePresenceProvider.tsx`, `site-presence/route.ts` |
| 3 | Profile Realtime: **450ms debounced** batch reload (4 loaders → 1 burst) | `StudentProfileHubPanels.tsx` |
| 4 | Subject chat RAG **`match_count` = 5** (explicit constant; agent routes keep 10–25) | `lib/gyanContentPolicy.ts`, `app/api/subject-chat/route.ts` |
| 5 | Modal retriever: skip Pass 2/3 when Pass 1 has usable chunks | `modal-rag/retriever.py` — **redeploy Modal** |

## Deploy note (item 5)

```powershell
cd modal-rag
$env:PYTHONIOENCODING="utf-8"
python -m modal deploy modal_app.py
```

## Verify locally

1. Open profile + dashboard — study-days GET should include `reconcile=1` only on first load per IST day; later loads omit it.
2. Network tab — site-presence POSTs ~every 50s per visible tab (not 20s).
3. Ask a subject-chat question — `[RAG] Enriched prompt with N passages` still appears; Prof-Pi/doubts unchanged.

## Not in Phase 1

- RLS initplan fixes, index cleanup, log retention → Phase 2
- Supavisor, buddy Realtime → Phase 3
