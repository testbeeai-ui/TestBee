# EduBlast Student — Mobile (Expo)

Android-first React Native app. **Isolated from the Next.js website** — reuses the same Supabase project and `app/api/*` backend.

## Structure

```
mobileapp/
├── app/           # Expo Router (thin routes)
├── features/      # Product modules (dashboard, gyan, …)
├── shared/        # Cross-feature UI
├── core/          # Pure TS (config, errors, routes)
├── services/      # API + Supabase + cache
├── providers/     # React providers
└── assets/
```

## Setup

1. `cd mobileapp`
2. Copy `.env.example` → `.env` and set `EXPO_PUBLIC_SUPABASE_*` from the repo root `.env.local`
3. Start the website API: from repo root `npm run dev:turbo`
4. `npm start` then press `a` for Android emulator

## Auth

- **Google sign-in** via Supabase OAuth → **`/auth/mobile-callback`** (minimal “returning to app” page, not the full website sign-in UI) → deep link back to the app.
- Works in **Expo Go** (no native Google SDK required).
- Same whitelist as the website (`approved_emails`).

### Supabase redirect URLs (required)

Add in Supabase → Authentication → URL Configuration:

- `https://www.edublast.in/auth/mobile-callback**`
- Local dev (if using LAN website): `http://YOUR_PC_IP:3000/auth/mobile-callback**`
- Expo Go: `exp://**` (dev hint on sign-in screen shows exact app callback URL)

Incomplete onboarding → finish once on the website, then return to the app.

Run `npm start` after editing `.env` (runs `sync-env`). Production defaults: `https://www.edublast.in` for API, web, and OAuth bridge.

Incomplete onboarding → finish once on the website, then return to the app.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm start` | Expo dev server |
| `npm run android` | Open on Android emulator/device |
| `npm run typecheck` | TypeScript check |
| `npx eas build -p android --profile preview` | Internal APK (requires EAS account) |
| `npx eas build -p android --profile production` | Play Store AAB |

## EAS / Play Store

1. `npm i -g eas-cli` and `eas login`
2. From `mobileapp/`: `eas init` → copy project UUID to `.env` as `EAS_PROJECT_ID`
3. Preview APK: `eas build -p android --profile preview`
4. Production AAB: `eas build -p android --profile production`

Push notifications require a **physical device** and a valid EAS project ID. Emulator skips token registration.

**Database:** `mobile_push_tokens` migration is applied on TestBee Supabase (`bytsiknhtcnlxwzgqkrd`).

## Module status (student app)

| Module | Status |
|--------|--------|
| Dashboard | ✅ Checklist, streak, RDM, quick links |
| Lessons | ✅ Curriculum browser + topic player |
| Gyan++ | ✅ Feed, ask doubt, Prof-Pi detail |
| Subject Chat | ✅ Prof-Pi chat + quota |
| Earn & Learn | ✅ Buddy, referrals, leaderboard |
| EduFund | ✅ Demo proposals (read-only) |
| News & Blogs | ✅ Feeds + article reader |
| Notifications | ✅ Inbox + push alerts |
| Profile | ✅ Wallet, stats, activity, subscription summary |
| Settings | ✅ Push toggle, legal links, sign out |
| Offline | ✅ Query persist + banner |
| Push | ✅ Token registration + teacher motivation delivery |

## Intentionally web-only

These need the full website UI or are out of student-mobile scope:

- **Play / DailyDose / Instacue** — checklist habits still sync from API; complete on edublast.in
- **Classroom feed & assignments** — teacher classroom UX
- **Magic Wall**
- **Subscription checkout** — read plan/trial on mobile; pay on web

## Phase history

Phases 0–4 delivered the scaffold, core learning modules, engagement features, offline/push/EAS prep, profile hub, and push delivery.

## API / cache strategy

- **React Query** deduplicates in-flight requests by `queryKey` — same key = one network call shared across screens.
- **Batched hooks** (`Promise.all` inside one `queryFn`): dashboard (2 APIs → 1 hook), profile hub (4 APIs → 1 hook), earn hub (3 APIs → 1 hook).
- **Shared caches**: `news-blog/all` (news + blogs + article reader), `profile/hub` (profile + settings), `notifications/{userId}` (bell + inbox).
- **Offline persist** (7 days): dashboard, curriculum, news-blog, notifications, profile hub.
- **Stale times**: curriculum 24h, news 10m, profile/earn/dashboard 30–60s.
