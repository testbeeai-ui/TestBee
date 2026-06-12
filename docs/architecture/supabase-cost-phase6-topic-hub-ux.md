# Phase 6 — Topic hub UX (Explore)

**Not a billing phase.** Fixes “data in DB but Explore overview looks empty/wrong.”

## Root causes

| Issue | Effect |
|-------|--------|
| Explore fetched only `level: basics` | Intermediate/advanced prose never shown |
| Agent gap-fill uses `"-"` for skipped sections | `topicContentExists` true but UI showed `—` |
| `hub_scope` `topic` vs `chapter` | Different `topic_content` rows for same chapter title |
| Subtopic AI gate needs all 3 levels viable | Admins had no coverage view |

## What shipped

1. **`lib/curriculum/topicHubDisplay.ts`** — treat `"-"` as empty; merge helpers across levels.
2. **`fetchTopicHubDisplayBundle`** in `lib/curriculum/topicContentService.ts` — parallel fetch basics/intermediate/advanced; merged overview + previews.
3. **`components/explore/TopicHubOverviewSections.tsx`** — shared Explore overview with honest empty states when previews exist.
4. **`app/explore-1/page.tsx`** — uses display bundle instead of basics-only fetch.
5. **`lib/curriculum/subtopicCompleteness.ts`** — gate viability ignores `"-"` placeholders.
6. **Admin coverage** — `GET /api/admin/topic-hub-coverage`, UI `/admin/topic-hub`.

## Verify

1. Open Explore chapter hub where only `intermediate` has `why_study` — overview should show that text.
2. Row with only `subtopic_previews` and `"-"` sections — message about previews, not bare `—`.
3. Admin → Topic hub — filter Physics 11, confirm missing gate levels match DB.
4. Generate basics hub — admin hint lists intermediate/advanced until those rows exist.

## Related docs

- Agent pipeline: `docs/topic-hub-agent-pipeline.md`
- Cost phases index: `docs/architecture/supabase-cost-audit-2026-06-11.md`
