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
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Optional Phase 5 site-presence buffer |

## Supabase projects (two — do not merge RAG)
| Project | Ref | Use |
|---------|-----|-----|
| **TestBee** (main) | `bytsiknhtcnlxwzgqkrd` | App, auth, migrations in `supabase/migrations/` |
| **TestBee RAG** | `yobzgdsecnutzyvuidqz` | `textbook_chunks` only — **never merge/pause/migrate** (Phase 4 Option A) |

`NEXT_PUBLIC_SUPABASE_*` → main only. `RAG_SUPABASE_*` → Modal secret → RAG project only. Runbook: `docs/architecture/supabase-cost-phase4-infra-billing.md`.

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

**Long docs:** `docs/gyan/gyan++review.md`, `docs/branches/BRANCH_DESCRIPTION.md`, `docs/architecture/RESEARCH_RETROSPECTIVE.md`, `.cursor/docs/README.md`

## Do not commit
- `.env`, `.env.local`
- `data/local-cache/news-blog.local.sqlite*` (orphan local cache; was at project root)
- `.cursor/debug-*.log`
- `.next/`, `node_modules/`

## Repository layout (agents: follow every task)

See also `.cursor/rules/repo-layout.mdc` (always applied).

| Path | Purpose |
|------|---------|
| `app/`, `components/`, `lib/`, `hooks/`, `store/`, `types/` | Application code |
| `public/`, `supabase/`, `modal-rag/` | Static assets, DB migrations, Python RAG |
| `scripts/` | One-off/import tools; orphans → `scripts/legacy/` |
| `docs/` | Committed product/architecture docs (`docs/gyan/`, `docs/branches/`, `docs/architecture/`, `docs/cursor/`) |
| `docs/dev-notes/` | Transient logs, API dumps (mostly gitignored) |
| `data/local-cache/` | Local SQLite caches (gitignored) |
| `.cursor/memory.md` | This file |
| `.cursor/docs/` | Agent SQL notes, import runbooks |
| `.cursor/rules/*.mdc` | Cursor rules (`codegraph`, `karpathy-guidelines`, `repo-layout`) |
| `.cursor/skills/` | Optional skill copies (not app code) |
| `.codegraph/` | CodeGraph index (gitignored) |
| **Project root** | Next.js + package config only — no loose `.md` notes, logs, sqlite, or `__pycache__` |

**Wrong path (do not use):** `.cursor/.cursor/rules/` — nested duplicate; use `.cursor/rules/` only.

## Project root tidy (2026-05-23)
Anything that is not Next.js / tooling config now lives under:
- `docs/branches/`, `docs/architecture/`, `docs/gyan/`, `docs/cursor/` — permanent docs
- `docs/dev-notes/` — transient logs and ad-hoc dumps (`.tsc-check.txt`, `debug-*.log`, `out*.json`)
- `scripts/legacy/` — orphaned/unused scripts (e.g. `sqlite-init-stub.js`)
- `data/local-cache/` — local SQLite + other gitignored runtime caches

## Locale / content
- **Chinese (CJK)** in repo: only `.cursor/skills/*` (agent skills), not in `app/` / `lib/` / `modal-rag/`
- Student-facing copy: English (Hindi optional when student writes in Hindi)

## Key paths (Admin coupons)
| Area | Files |
|------|--------|
| Tab shell + URL state (`?tab=teacher\|student`) | `app/admin/coupons/page.tsx` |
| Teacher RDM coupon manager | `app/admin/coupons/TeacherCouponsTab.tsx` |
| Student plan coupon manager | `app/admin/coupons/StudentCouponsTab.tsx` |
| Teacher admin API | `app/api/admin/coupons/route.ts` |
| Student plan coupon API | `app/api/admin/coupons/student/route.ts` |
| Student directory (admin picker) | `app/api/admin/students/route.ts` |
| Student claim API | `app/api/user/coupons/claim-plan/route.ts` |
| Student claim UI | `components/profile/subscription/SubscriptionCoupon.tsx` |
| Coupon utils + extend logic | `lib/subscription/subscriptionCouponUtils.ts` |
| Teacher DB | `supabase/migrations/20260807000000_create_coupons_table.sql` |
| Student plan DB | `supabase/migrations/20260808120000_subscription_coupons.sql` |

## Decisions Log
- 2026-06-12: **Whitelist alexis36sg@gmail.com** — approved_emails + admin role live; migration `20260812120000_whitelist_alexis36sg_full_access.sql`.
- 2026-06-12: **Investor HTML** — platform optimization before/after (phases 0–6, no financial framing): `docs/architecture/platform-optimization-phases-0-6.html`.
- 2026-06-11: **Supabase cost Phases 0–6 summary** — before/after doc `docs/architecture/supabase-cost-phases-0-6-before-after.md`.
- 2026-06-11: **Supabase cost Phase 6** — topic hub UX: multi-level display bundle, `"-"` placeholder handling, `TopicHubOverviewSections`, admin coverage `/admin/topic-hub`; runbook `docs/architecture/supabase-cost-phase6-topic-hub-ux.md`.
- 2026-06-11: **Supabase cost Phase 5** — opt-in Upstash site-presence buffer; admin cache 15min + warm cron; dwell monthly partitions; MCQ chapter cached API; runbook `docs/architecture/supabase-cost-phase5-scale-architecture.md`.
- 2026-06-11: **Supabase cost Phase 4 (Option A)** — keep TestBee RAG `yobzgdsecnutzyvuidqz` separate permanently; defer Pro/`auth.edublast.in`; branch policy documented; billing checklist in `docs/architecture/supabase-cost-phase4-infra-billing.md`.
- 2026-06-11: **Supabase cost Phase 3** — buddy Realtime 4→1 table, 50s/8min polls; ClassFeed paginated (40); site-presence uses user RLS + DELETE policies; teacher portal poll 120s; runbook `docs/architecture/supabase-cost-phase3-connections-realtime.md` (Supavisor = dashboard step).
- 2026-06-11: **Supabase cost Phase 2 complete** — RLS initplan on 11 hot tables, 6 indexes dropped / 5 added, prune RPC + cron verified 200, admin analytics cache on all routes; phase2b migrations applied live; runbook `docs/architecture/supabase-cost-phase2-db-hygiene.md`.
- 2026-06-11: **Supabase cost Phase 1 quick wins** — IST-once reconcile opt-in, 50s presence heartbeat, profile Realtime debounce, subject-chat RAG cap 5, retriever skip multi-pass; runbook `docs/architecture/supabase-cost-phase1-quick-wins.md` (Modal redeploy for retriever).
- 2026-06-11: **Supabase cost Phase 0 crons** — removed all `vercel.json` cron schedules (no auto jobs in prod); routes remain for manual/external trigger; runbook `docs/architecture/supabase-cost-phase0-crons.md`.
- 2026-06-11: **Supabase cost audit** — `docs/architecture/supabase-cost-audit-2026-06-11.md` (live MCP + repo; methodology section; 250 migrations not 258).
- 2026-06-10: **Supabase OAuth branding (Step 1)** — use custom domain `auth.edublast.in` (CNAME → `bytsiknhtcnlxwzgqkrd.supabase.co`) so Google shows EduBlast domain not `*.supabase.co`; requires Pro + Custom Domains add-on (not enabled yet as of CLI check); runbook `docs/cursor/supabase-auth-custom-domain-step1.md`.
- 2026-06-10: **Waitlist UX** — no static mobile hint under phone field (silent `sanitizeMobileInput` only); after Step 1 “Join the waitlist” succeeds, auto-select `student` (or `?role=` from URL) and open ambassador modal — no extra “Register as Ambassador” click.
- 2026-06-08: **Waitlist refinements** — cleared `waitlist_submissions` test rows; sequential IDs from `EB-2026-200` via `lib/waitlist/waitlistId.ts`; duplicate email returns `alreadyRegistered` in UI except test inboxes (`michaelkillgta@gmail.com`, `testbeeai@gmail.com`, `mailidpwd@gmail.com`); ambassador urgency copy uses soft phrasing; waitlist emails use `www.edublast.in` + `join@edublast.in` footer.
- 2026-06-06: **Waitlist two-step funnel** — `/waitlist` Step 1 = email+phone quick signup (`signup_tier=waitlist`); Step 2 optional ambassador full form upgrades same row; migration `20260808120000_waitlist_signup_tier.sql`; admin WaitlistTab shows tier badge. **Waitlist emails** — Step 1 confirmation + Step 2 application receipt via `sendWaitlistEmails.ts` + `waitlistEmailTemplate.ts`; preview `scripts/send-waitlist-preview.ts`. — `subscription_coupons` table + `profiles.subscription_expires_at`; admin generates Starter/Pro + N months (public or per-student email); student claims at Profile → Subscription → Coupon code (`POST /api/user/coupons/claim-plan`); extend stacks months on remaining time; `normalizePlanTier` honors `subscription_expires_at`.
- 2026-06-05: **Admin coupons modularized** — `/admin/coupons` split into `TeacherCouponsTab` (full manager: list, filter, generate, redeem tracking) + `StudentCouponsTab` (premium coming-soon placeholder); unified `Tabs` shell in `page.tsx` with `?tab=teacher|student` URL sync via `router.replace`; production `npm run build` OK.
- 2026-06-04: Posts RLS recursion — cycle was `posts` policy → `teacher_motivation_rdm_grants` → `posts`; fixed with SECURITY DEFINER helpers + `row_security = off` (`20260806140000`: `student_has_active_grant_for_assignment`, `teacher_owns_motivation_post`, `student_can_read_post_via_teacher_nudge`).
- 2026-06-04: Posts RLS — students can read assignment posts linked from a teacher nudge (`relatedPostId` + `targetStudentIds`) or `teacher_motivation_rdm_grants`, even when section-history rules would hide them; migration `20260806120000_posts_read_linked_assignment_via_nudge.sql`.
- 2026-06-04: Teacher motivation RDM (policy A) — `POST /api/teacher/motivation/send` charges teacher when assignment-linked bonus (`rdmDelta × students`); `teacher_motivation_rdm_grants` pending until student completes all visible tasks on `relatedPostId`; fulfillment on task-progress / generated-test-attempt; non-linked nudges message-only (no grant/charge).
- 2026-05-30: Daily streak task sync — each t1–t6 completion PATCHes `sync_free_trial_daily_streak_task` into `profiles.free_trial_daily_streak` (partial `task_ids` + `tasks.{id}.completed_at`); claim RPC now requires all 6 on server; migration `20260730120000_free_trial_daily_streak_task_sync.sql`.
- 2026-05-30: Daily streak reopen reliability fix — removed stale session-level reopen dedupe gates for Day 2 tasks `t1/t2/t3` so each fresh flow completion dispatches checklist reopen after 5s; flow-only credit path unchanged.
- 2026-05-26: Site tour checklist UI — `OnboardingRewardDialog.tsx` sticky-board layout (10 notes + task detail drawer); same backend task IDs and completion hooks; no scroll list.
- 2026-05-23: Cursor layout — moved `karpathy-guidelines.mdc` to `.cursor/rules/`; added `repo-layout.mdc`; human doc at `docs/cursor/karpathy-guidelines-setup.md`; removed root `cursor.md` and `.cursor/.cursor/rules/` nest.
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
- 2026-05-24: Onboarding **Prep + Mock · Classes** — `lib/onboarding/prepClassesOnboardingFlow.ts`; reward popup Go → `/mock?onboarding_prep_classes=1` with violet **View all** hint on `ClassesSection`; tap → `/classrooms` + checklist complete via `maybeMarkPrepClassesOnboardingFromExplore()`.
- 2026-05-24: Onboarding **Earn & Learn · Buddy** — not marked on popup Go; `maybeMarkEarnBuddyOnboardingFromBuddyActivation()` when `buddy_invites.status = accepted` for inviter (`GET /api/buddy/state` → `hasBuddyInviteActivated`).
- 2026-05-24: Onboarding **Profile** — not marked on popup Go; `isStudentProfileBasicInfoComplete()` + `maybeMarkProfileOnboardingFromBasicInfo()` when Basic information required fields saved (`StudentProfilePersonalHub` save + profile page load).
- 2026-05-27: Site-tour checklist UI now **merges** `localStorage` onboarding progress with `profile.onboarding_reward_progress` (`getMergedOnboardingProgress`), and **hydrates** server data with a union-merge so stale profile + successful local sync cannot show “1/10” while tasks are done in-browser.
- 2026-05-27: Checklist **progress parsing** normalizes truthy flags from storage/DB; **Magic Wall** row also completes when all 3 substeps are true (`maybeCompleteCompanionTaskFromSteps`); site-tour dialog **re-syncs on pathname** while open.
- 2026-05-27: **Lessons /explore-1** — "Save changes" reappears when changing chapter picks after first unlock (`showChapterPickBanner`); first unlock still shows lock row until max chapters selected.
- 2026-05-27: Onboarding reward progress merge hardened — `getMergedOnboardingProgress` now unions local + profile flags; `/api/user/onboarding-reward` now parses truthy legacy flags (`true` / `"true"` / `1`) to prevent checklist regressions after quiz/task completion.
- 2026-05-27: **prep_mcq** Task Companion — added emerald clock “next action” row in `FloatingTaskCompanion.tsx` (same pattern as Earn & Learn Challenge) so step 4 guidance + time pill always shows under the checklist.
- 2026-05-29: Replaced layout positions of elements inside `ebc-phase-banner` in `EduBlastChallengeCard.tsx` (DailyDose card banner). Moved the "Answer options unlock in" text (`ebc-phase-sub`) to the top in small font, the active phase countdown timer (`untilChoicesSec`) to the center as the **big digital countdown timer** (e.g. `00:11` syncing with the SVG loader ring), and the "READ-ONLY PHASE" tag (`ebc-phase-label`) to the bottom in small font. Adjusted margins in `app/globals.css` to preserve correct spacing.
- 2026-05-29: Resolved 3 active ESLint warnings/errors: (1) Removed unused `savedChapters` local variable in `explore-1/page.tsx`, (2) Deferred synchronous `setDashboardClock` in `StudentHomeDashboard.tsx` via `setTimeout(..., 0)` to prevent cascading render cycles, and (3) Added `time_travel_offset_ms` to `OnboardingProfileFields` type inside `freeTrialClient.ts` to allow type-safe direct access and eliminate type-unsafe `any` cast.
- 2026-05-29: Disabled automatic popup triggers for `"Today's checklist"` (the dialog with items a, b, c, d, e shown in the second image) inside `StudentHomeDashboard.tsx` by turning `tryAutoOpenDailyChecklist` into a no-op. The checklist popup will no longer auto-open on home visits or after the 30-second onboarding cooldown, but can still be opened manually by clicking on the dashboard strip.
- 2026-05-29: Upgraded the `"Daily tasks — Day 2 of 10"` detail drawer in `OnboardingRewardDialog.tsx` with a premium dual-button design matching the onboarding detail drawer. Implemented `handleOpenDailyTask` which navigates the user straight to each task's page (e.g. `/play`, `/explore-1`, `/mock-test?tab=mcq`, `/doubts`, `/refer-earn?tab=challenges`, `/news-blog`) and automatically launches the corresponding step-by-step onboarding guide companion to guide them. Added a `useEffect` event listener for `ONBOARDING_PROGRESS_EVENT` that automatically synchronizes and checks off daily tasks when their respective activities are completed.
- 2026-05-29: Fixed absolute positioning layout clipping/overlap bugs inside the `OnboardingRewardDialog.tsx` detail drawer by limiting `.drawer`'s height to `max-height: calc(100% - 20px)` and converting it to a vertical flex container, and making `.dbody` scrollable via `overflow-y: auto; flex: 1;`. Removed redundant secondary `"Mark as done"` and `"Open page again"` buttons (since students can already manually check rows off via the circular list checkboxes directly on the main daily checklist popup, as shown in the second image), leaving a single clean premium CTA button at the bottom of the drawer (`Open task — earn +X RDM!` or `Done — Open again`). This keeps the drawer perfectly compact, visually beautiful, and eliminates any vertical scrollbars on desktop screens.
- 2026-06-02: Fixed inactive-penalty reconcile cadence in `lib/dashboard/studyDaysClient.ts` — run `reconcile_inactive_day_penalties` once per IST day (keyed by `today`) instead of once per browser session, so penalties apply without requiring a hard refresh after midnight.
- 2026-06-02: Added student-facing inactive-penalty notice wired to real reconcile results: `/api/user/study-days` now returns `{ reconcile: { penaltiesApplied, totalDeducted } }`; dashboard + profile show a supportive toast only when a deduction is actually applied.
- 2026-06-03: **New-user welcome email** — `lib/email/newUserWelcomeTemplate.ts`; `POST /api/user/login-notification` sends welcome once (`profiles.welcome_email_sent_at`, migration `20260803120000`) for accounts &lt;14d old, then login confirmation for returning students; triggers unchanged (`useAuth` sign-in, OAuth callback, OTP verify).
- 2026-06-03: **Admin email volume** — `transactional_email_logs` + `EMAIL_DAILY_SEND_CAP` (default 500/IST day); `/admin/emails` + Overview card; `GET /api/admin/email-logs`.
- 2026-06-04: **Trial-end decision gate** — `TrialExpirationGate` in `app/providers.tsx` blocks all student routes (z-index overlay) until card submit (`claim-bonus`) or **Continue with Free** (`exit-trial-to-free`); `shouldShowTrialExpirationOverlay` closes when `trial_original_ended_at` + `plan_tier=free`; exit API clears `free_trial_activated`.
- 2026-06-04: **Settings feedback survey** — investor form in `EduBlastFeedbackForm.tsx`; DB-only via `POST /api/platform-feedback` → `platform_feedback_submissions` (migrations `20260804125000`, `20260804130000`); admin inbox `/admin/feedback` — **no email on submit** (welcome/login emails unchanged).
- 2026-06-04: **`/performance` plan gating** — Performance nav always visible; **free/free_trial** click → Starter upgrade card only (no stats); **starter** → full page, category block → Pro; **pro** → full access.