# Chapter PYQ — verifier agents (two-observer A)

**Status:** Draft — awaiting user review of this file  
**Product:** EduBlast Web / TestBee PYQ ingest (`files/`)  
**Date:** 2026-09-13  
**Predecessor:** [`2026-09-11-chapter-pyq-physics-import-design.md`](./2026-09-11-chapter-pyq-physics-import-design.md)  
**Locked roster:** user approved 2026-09-13

Turn one PDF chapter from rasters + skeleton into published `pyq_*` rows without a human walking pages one by one. The pipeline reports, then **stops and asks** on any disagreement. It does not claim 100% accuracy.

## Goal

For one named PDF chapter (default: the chapter the user names; first proof: Physics **Laws of Motion**, `chapter_no = 5`):

1. Digitise every question page in parallel (Document AI).
2. Upload that chapter’s figures (`p{page:03d}_x{xref}` keys, bucket `pyq`).
3. Parse stems/options, wrap math as `$…$`.
4. Run vision + solver + KaTeX agents.
5. Publish only rows that pass every gate as `auto_ok`.
6. Hold the rest. Write a chapter report. Ask the user before continuing.

Students still see only `review_status in ('auto_ok','human_ok')`.

## Non-goals

- Whole-book overnight run in v1 (the orchestrator is chapter-scoped; looping chapters is a later flag).
- Replacing Document AI with `gemma4`-only OCR.
- Sending page PNGs to `glm5.3`, `glm5.2`, or `deepseekv4-flash` (those endpoints return **400: image input is not supported** on this key).
- Gemini.
- Worked solutions (MathonGo does not print them). The PDF answer key is the key, not an LLM’s physics opinion.
- Touching EduDeca or EduBite.
- Quoting a percentage accuracy after a run.

## Model roster (this Sarvam key, probed 2026-09-13)

| Seat | Model | Endpoint | Sees PNG? |
|------|--------|----------|-----------|
| Layout OCR | Document AI digitise | `POST /doc-ai/v1/job/digitise` | page raster as file |
| Vision writer / observer 2 | `gemma4` | `POST /v2/chat/completions` | yes |
| Vision tie-break (disagreements only) | `glm5.3-flash` | `POST /v2/chat/completions` | yes — parse `content` or `reasoning_content`; `max_tokens` ≥ 2048 |
| Solver A | `glm5.3` | `POST /v2/chat/completions` | **no** — stored stem + options only |
| Solver B | `deepseekv4-flash` | `POST /v2/chat/completions` | **no** — stored stem + options only |
| Unused | `sarvam-105b`, `glm5.2`, `/v1/chat/completions` | — | skip (`content` often null; no images) |

Chat auth: header `api-subscription-key`. Temperature `0`.

## Agents

Each agent has one job, a JSON contract, and **cannot** set `auto_ok` by itself.

### 1. Digitise (parallel Document AI)

Reuse `pyq_common.digitise_page`. Cache `files/out/ocr/page_NNN.json`. Run a small worker pool (default 4) so pages are not walked one-at-a-time in the CLI. If the cache exists, do not re-pay. Failed jobs land in `failures.json` and block continue until retried.

### 2. Parse

Reuse `parse_ocr_page.parse_digitise_to_questions` + `format_ocr_math.format_ocr_math`. Skeleton `q_no` and `figure_keys` are the whitelist (`validate_page_response`). Option-as-image (no `(1)…(4)` text) stays **unreviewed**, never `auto_ok`.

### 3. Figure store

Reuse `upload_figures.py` scoped to the chapter’s keys. After upload, `GET` every public URL for those keys. Any non-200 is a miss → re-upload that key only, GET again. Still failing → hold.

### 4. Coverage

Compare parsed `q_no` set to the skeleton set for `chapter_no`. Missing `q_no` → re-digitise that page (ignore cache once) → re-parse. Still missing → hold `coverage_miss`. Extra `q_no` not in skeleton → `WhitelistError`, do not write.

### 5. Vision observer (`gemma4`)

For each chapter page PNG, ask `gemma4` for JSON `{ "questions": [ { "q_no", "mcq", "option_count", "has_figure", "body_preview" } ] }` constrained to the skeleton whitelist. Compare to the parse:

- Same `q_no` set, same MCQ/numerical, same option_count 0 or 4 → agree.
- Else → disagreement row.

`gemma4` may recover option-as-image **text** only when four printed options are readable in the PNG. Invented options are invalid: whitelist + shape check still apply.

### 6. Vision tie-break (`glm5.3-flash`)

Only rows/pages where Document AI parse and `gemma4` disagree. Same JSON contract. If flash agrees with the parse, keep the parse and record `tie_break=parse`. If it agrees with `gemma4`, adopt `gemma4` only when the result still passes the whitelist. If all three differ → hold `vision_conflict`.

### 7. KaTeX agent (deterministic first)

Order:

1. `format_ocr_math` already wrapped the strings.
2. `audit_paper_text.py` on the chapter `parsed.json` — exit 0 required (caption / `**` / table / watermark / heading / empty option).
3. Dollar-balance: every `$` run on stem and options is paired.
4. Render probe: extract inner math, `katex.renderToString(…, { throwOnError: true })` via `Web/node_modules/katex` (small Node helper). Fail → hold `katex_render`.
5. If the string has math glyphs (`√`, `^`, unicode sub/sup) but **no** `$…$`, call `glm5.3` **text-only** to propose wraps. Re-run 3–4. Still fail → hold. Never skip to the LLM first.

### 8. Solvers (`glm5.3` + `deepseekv4-flash`)

Input is the **stored** stem + options (or numerical blank), not the PNG. Output is a single MCQ option `1|2|3|4` or a numerical string. Compare to `files/out/answer_key.json` for `(chapter_no, q_no)`:

| GLM | DeepSeek | PDF key | Action |
|-----|----------|---------|--------|
| = key | = key | — | `solve_match` |
| either ≠ key | — | — | hold `solver_mismatch` — show user: q_no, stem preview, PDF key, GLM, DeepSeek |
| both ≠ key and GLM = DeepSeek | — | still hold | they may both be wrong; user decides |
| unparseable output | — | — | retry once; then hold `solver_parse` |

Figures: solvers see the public figure URL in the text prompt (they cannot take the PNG). If a question is figure-only and both solvers mismatch, hold — do not auto-trust the key without the user.

### 9. Publisher

Writes bodies/options like `write_and_publish.py`, but **`auto_ok` only** when every gate below is true. Otherwise `unreviewed` or `flagged`.

### 10. Conductor

CLI: `python run_chapter_agents.py --chapter 5`. Writes `files/out/agents/chapter_5/REPORT.md` + `hold.json`. Prints the report. Exits `0` if zero holds and all publishable; exits `2` if holds exist (user must answer). `--apply-holds hold.json` applies the user’s decisions (`keep_key` | `use_glm` | `use_deepseek` | `leave_unreviewed`) then re-runs KaTeX + publish for those q_nos only. A stem rewrite is out of v1: leave the row unreviewed and fix it in a later pass.

## Promotion rule (`auto_ok`)

All of:

1. Skeleton row exists for `(chapter_no, q_no)`.
2. Shape whitelist: MCQ has four non-junk options; numerical has `options: []` / no fabricated choices.
3. Coverage: q_no present after parse (and re-digitise retry if needed).
4. Vision: parse and `gemma4` agree, **or** `glm5.3-flash` tie-break selected a whitelist-valid side.
5. Every `[[fig:KEY]]` on the row exists in Storage and `GET` is 200.
6. `audit_paper_text` clean for that row.
7. KaTeX render probe passes (or the row has no math).
8. Both solvers match the PDF answer key (`solve_match`).
9. `extraction_confidence = 1.0` (two observers agreed). Single-observer remains `0.5` and **must not** be `auto_ok`.

Anything else: `unreviewed` (shape/miss) or `flagged` (mismatch). `human_ok` only after `--apply-holds`.

## Continue prompts

The conductor never silently continues past a hold class. One report per chapter, then stop.

Ask the user in this order:

1. Coverage / digitise failures (pages).
2. Figure GET misses.
3. Vision conflicts.
4. KaTeX holds.
5. Solver mismatches (always include PDF key vs GLM vs DeepSeek vs stored stem).

Yes on a section means “retry that class then re-report.” Applying `hold.json` is the only way a flagged solver row becomes `human_ok`.

## Data on disk

```
files/out/agents/chapter_{N}/
  parsed.json          # after format_ocr_math
  gemma4.json          # per-page observer
  disagreements.json
  glm53_flash.json     # tie-breaks only
  katex.json
  solvers.json         # { q_no: { glm, deepseek, key, match } }
  hold.json
  REPORT.md
```

OCR cache stays `files/out/ocr/`. Figures stay `files/out/figures/`. Do not write Maths rasters into Physics `out/` (existing skill rule).

## Error handling

- HTTP 429: respect `RateLimiter` (60/min chat). Digitise workers 4.
- Vision 400 “image not supported”: fail the run if the model id is wrong; do not fall back to a text-only model with the PNG stripped.
- Empty `content`: use `pyq_common.chat_content` (content or reasoning_content). Still empty → hold `empty_model`.
- Never invent a catalog chapter, tier, or `exam_date`.

## Testing

Python (stdlib `unittest`) under `files/tests/`, run with `C:\Python314\python.exe -m unittest`. No live Sarvam in unit tests — fixtures for JSON contracts, promotion, solver parse, coverage.

Web Vitest stays the authority for `cleanPyqOcrText` / KaTeX wrapping (`lib/chapter-pyq/pyqOcrHtml.test.ts`). Add a case when the KaTeX agent changes wrapping rules.

Pilot proof: `--chapter 5` (Laws of Motion). Browser: `/chapter-pyq/physics/laws-of-motion` after cache bump. Login wall ≠ skipped check — then count publishable rows in DB.

## Skill follow-up

When the orchestrator ships, update `.cursor/skills/chapter-pyq/SKILL.md`: OCR stays Document AI; v2 chat is allowed for vision observer + text solvers; `/v1` remains unused. Still never Gemini. Still never quote accuracy.
