# CBSE Class 12 MCQ Import
**Date:** 2026-05-20  
**Branch:** gyan++changes-4 (or current)  
**Status:** done — 44 chapters imported (4175 questions, 2026-05-20)

## Summary
Import 44 JSON files containing CBSE Class 12 MCQs (Physics, Chemistry, Mathematics) from the local Downloads folder into the Supabase `mock_papers` and `mock_questions` tables. This will be done via a new idempotent TypeScript script to ensure no data is duplicated and failures can be safely retried.

## Source Data
- **Location:** `C:\Users\rentk\Downloads\CBSE XII-20260519T150236Z-3-001\CBSE XII`
- **Files:** 44 JSON files total (15 Physics, 16 Chemistry, 13 Mathematics)
- **Format:** Each file represents one chapter (`examSetName`) and contains an array of `questions`.

## Deploy order
1. **Supabase migration** (run first):
   ```bash
   supabase db push
   ```
   Or paste [`supabase/migrations/20260520143000_cbse_class12_mcq_catalog.sql`](../../supabase/migrations/20260520143000_cbse_class12_mcq_catalog.sql) in the SQL Editor.

2. **Import JSON** (after migration):
   ```bash
   npx tsx --env-file-if-exists=.env scripts/import-cbse-12-mcqs.ts
   ```

## Schema
| Table | Role |
|-------|------|
| `cbse_mcq_chapters` | Catalog of 44 Class 12 PCM chapters (`chapter_id` = UI slug) |
| `mock_papers` | One row per chapter (`paper_type=chapter`, `board=CBSE`, `chapter_id` FK) |
| `mock_questions` | MCQs for that paper |

## Implementation
1. **Script:** `scripts/import-cbse-12-mcqs.ts`
2. **Mapping:** JSON `examSetName` → `MCQ_CHAPTERS[12]` id → `mock_papers.slug` + `chapter_id`
3. **Parsing:** `scripts/lib/mcq-json-import-core.ts`
4. **Idempotent import:** delete by slug, re-insert paper + questions (batched)

## Files touched
- `supabase/migrations/20260520143000_cbse_class12_mcq_catalog.sql` — **deploy this first**
- `scripts/import-cbse-12-mcqs.ts` — batch importer (idempotent by chapter slug = `MCQ_CHAPTERS` id)
- `scripts/lib/mcq-json-import-core.ts` — shared HTML MCQ parsing

## Env
| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Required for import |
| `CBSE_XII_JSON_ROOT` | Override JSON folder (default: Downloads path in memory.md) |
| `DRY_RUN=1` | Parse only, no DB |
| `ONLY_CHAPTER_ID=p12-12` | Retry one chapter |

## How to test
1. Dry run: `DRY_RUN=1 npx tsx --env-file-if-exists=.env scripts/import-cbse-12-mcqs.ts` → expect **44 success, 0 failed**.
2. Import: `npx tsx --env-file-if-exists=.env scripts/import-cbse-12-mcqs.ts` (needs stable Supabase; retries on timeout).
3. Retry one file: `ONLY_CHAPTER_ID=c12-11 npx tsx --env-file-if-exists=.env scripts/import-cbse-12-mcqs.ts`
4. Supabase: `mock_papers` rows with `paper_type=chapter`, `class_level=12`, slugs `p12-*`, `c12-*`, `m12-*`.
