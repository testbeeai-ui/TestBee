# Project Memory

> Agents: read this file at the **start** of every task. Append **Decisions Log** after changes (see `.cursorrules`).

## Stack
- **App:** Next.js (App Router), TypeScript, Supabase (auth + DB), Tailwind
- **AI tutors:** Gyan++ / **Prof-Pi** — Sarvam (`lib/sarvamGyanClient.ts`), optional verifier (`PROF_PI_VERIFY=1`, `lib/profPiVerify.ts`)
- **RAG:** Modal sidecar `modal-rag/` → BGE-M3 + Supabase passages (`lib/rag.ts`, `lib/gyanBotAnswer.ts`)
- **Other:** Vertex/Gemini where used; subject chat `app/api/subject-chat/route.ts`

## Active git branch
- **`gyan++changes-4`** — Gyan++/Prof-Pi, CAS verify, Sarvam limits (push only when user asks)

## Key paths (Gyan++ / Prof-Pi)
| Area | Files |
|------|--------|
| Answer pipeline | `lib/gyanBotAnswer.ts` |
| Prompts / limits | `lib/gyanContentPolicy.ts`, `lib/gyanBotPersonas.ts` |
| Sarvam + strip thinking | `lib/sarvamGyanClient.ts` |
| Verifier | `lib/profPiVerify.ts` |
| CAS (chemistry) | `lib/casExtract.ts`, `lib/casVerify.ts`, `modal-rag/cas_verify.py` |
| Tests | `lib/sarvamGyanClient.thinking.test.ts` |
| Subject chat API | `app/api/subject-chat/route.ts` |

## Key paths (Mock test / MCQ library)
| Area | Files |
|------|--------|
| Library UI (`/mock-test`, MCQ tab) | `components/prep-mock/library/MockTestLibraryView.tsx` |
| Class 11/12 chapter lists + labels | `components/prep-mock/constants.ts` (`MCQ_CHAPTERS`, `SUBJECT_LABELS`, `subjectEmojis`) |
| Page shell | `components/prep-mock/MockPageContent.tsx`, `app/mock-test/page.tsx` |

**CBSE NCERT question JSON (local, not in repo):**  
- **XII:** `C:\Users\rentk\Downloads\CBSE XII-20260519T150236Z-3-001\CBSE XII\` — 44 chapters (Physics 15, Chemistry 16, Math 13).  
- **XI:** `C:\Users\rentk\Downloads\CBSE XI-20260519T150202Z-3-001\CBSE XI\` — 45 chapters (Physics 15, Chemistry 14, Math 16).  
Import: `CBSE_CLASS_LEVEL=11|12` + `scripts/import-cbse-12-mcqs.ts` (see `.cursor/docs/cbse-12-mcq-import.md`).

## Prof-Pi answer shape (do not mix subjects)
- **Math / chem:** `PROF_PI_STRUCTURE_CONTRACT` — **Formula / Proof / Steps / Key intuition / Exam trap**
- **Physics only:** `PROF_PI_PHYSICS_STRUCTURE_CONTRACT` — **Given / Formula / Steps / Answer** (+ optional intuition / trap); no "Wait/Let me" walls
- Verifier must not replace good drafts with meta-review text; structured drafts often skip verify

## Env (names only — values in `.env`, never commit)
| Variable | Purpose |
|----------|---------|
| `SARVAM_API_KEY` | Prof-Pi + bots |
| `SARVAM_PROF_PI_MAX_TOKENS` | Completion cap (default 2048; model hard limit) |
| `SARVAM_MAX_OUTPUT_TOKENS` | Global cap |
| `PROF_PI_VERIFY` | `1` = second Sarvam pass |
| `PROF_PI_VERIFY_MAX_TOKENS` | Verifier cap (scales with draft) |
| `RAG_SIDECAR_URL` | Modal deploy URL |
| `RAG_INTERNAL_TOKEN` | Must match Modal secret `custom-secret` |
| `DEBUG_GYAN_PROMPT_SIZES` / `GYAN_LOG_SARVAM_USAGE` | Sarvam usage logs |

## Modal RAG
- **URL:** `https://testbeeai--testbee-rag-serve.modal.run`
- **Deploy:** `cd modal-rag` → `python -m modal deploy modal_app.py`
- **Secret:** Modal dashboard → `custom-secret` (`RAG_SUPABASE_URL`, `RAG_SUPABASE_ANON_KEY`, `RAG_INTERNAL_TOKEN`)
- **Windows:** `modal.exe` often not on PATH — use `python -m modal` or full path under `%APPDATA%\Python\Python314\Scripts\`

## Dev commands
```bash
npm run dev:turbo          # local app
npm run build              # production build check
npx vitest run lib/sarvamGyanClient.thinking.test.ts
```

## How we record changes
| Size | Where |
|------|--------|
| Quick fix / config / one file | One line in **Decisions Log** below |
| Big feature / long write-up | `.cursor/docs/<name>.md` + one-line link here |

**Long docs:** `gyan++review.md`, `.cursor/docs/README.md`

## Do not commit
- `.env`, `.env.local`
- `news-blog.local.sqlite*`
- `.cursor/debug-*.log`
- `.next/`, `node_modules/`

## Locale / content
- **Chinese (CJK)** in repo: only `.cursor/skills/*` (agent skills), not in `app/` / `lib/` / `modal-rag/`
- Student-facing copy: English (Hindi optional when student writes in Hindi)

## Decisions Log
- 2025-05-20: Migrated to Vertex AI SDK
- 2026-05-20: Prof-Pi physics uses **Given/Formula/Steps/Answer** contract; math contract unchanged; verifier skips meta-review and strips "Wait/Let me" narration.
- 2026-05-20: Modal RAG deployed at `https://testbeeai--testbee-rag-serve.modal.run`; Windows CLI: `python -m modal deploy modal_app.py` or `& "$env:APPDATA\Python\Python314\Scripts\modal.exe" deploy modal_app.py`.
- 2026-05-20: Branch `gyan++changes-4` — Gyan++/Prof-Pi, CAS verify, Sarvam limits pushed (`0fa59b9`, `027c801`, `3dca479`, `8113095`).
- 2026-05-20: Added `.cursorrules` — agents must read this file and append Decisions Log after significant changes.
- 2026-05-20: Chinese (CJK) text only in `.cursor/skills/*` (9 marketing/China skill docs); zero in `app/`, `lib/`, `components/`, `modal-rag/`.
- 2026-05-20: Memory policy — small changes → Decisions Log only; big changes → `.cursor/docs/<topic>.md` + one-line link (see `.cursorrules`).
- 2026-05-20: Expanded `.cursorrules` + `memory.md` with stack, paths, env names, git/deploy conventions.
- 2026-05-20: Mock-test **MCQ's** tab — `SUBJECT_LABELS` (Physics / Chemistry / Mathematics); Class 12 physics + **Communication Systems**, full semiconductor chapter title; UI in `MockTestLibraryView.tsx` (no raw `physics`/`chemistry`/`math` labels).
- 2026-05-20: CBSE XII NCERT MCQ bank on disk (44 JSON chapters) — path recorded above; align `MCQ_CHAPTERS[12]` with `examSetName` when importing.
- 2026-05-20: CBSE Class 12 MCQ — migration `20260520143000_cbse_class12_mcq_catalog.sql` deployed; import `scripts/import-cbse-12-mcqs.ts` **44/44 OK**, **4175** questions into `mock_papers`/`mock_questions` on `bytsiknhtcnlxwzgqkrd` (see `.cursor/docs/cbse-12-mcq-import.md`).
- 2026-05-20: CBSE Class 11 MCQ — same script with `CBSE_CLASS_LEVEL=11`; **45/45 OK**, **4095** questions; catalog upserted at import time; fixed duplicate **Thermodynamics** (physics `p11-12` vs chemistry `c11-6`) via `FOLDER_CHAPTER_ALIASES`. Log: `.cursor/cbse-11-import-log.txt`.
- 2026-05-20: Mock **MCQ's** tab UX — `McqChapterBrowser.tsx`: one subject at a time (tabs), chapter list only for active subject; chapter click → confirm → scrollable **preview all MCQs** (`McqChapterPreview.tsx`, `fetchCbseChapterMcqs.ts`) — not NTA next/prev exam.
- 2026-05-20: **MCQ's** library tab + preview — `profile.role === "admin"` only (`MockTestLibraryView` + `MockPageContent`); non-admins cannot see tab or `?tab=mcq`.
- 2026-05-20: Admin granted **mailidpwd@gmail.com** (`profiles.role` + `user_roles`); migration `20260521160000_add_admin_mailidpwd.sql`, script `scripts/grant-admin-by-email.ts`.
- 2026-05-20: Fixed TS2307 after partial `lib/gyan/` refactor — canonical Prof-Pi at `lib/gyan/bot/gyanBotAnswer.ts`; shared modules stay at `lib/*` (not `lib/gyan/bot/gyanContentPolicy` shims). Close stale `lib/gyanBotAnswer.ts` tab.
- 2026-05-27: Learning Buddy privacy hardening — mask private buddy RDM/right-now signals in APIs and honor presence privacy in RLS.
- 2026-05-27: Build fix — `computeStreakDays` accepts an optional anchor date for buddy Play Arena streak calculation.
