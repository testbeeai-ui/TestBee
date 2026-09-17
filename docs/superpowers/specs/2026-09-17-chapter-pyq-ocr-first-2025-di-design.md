# Chapter PYQ — OCR-first 2025 Definite Integration

**Status:** Implemented  
**Product:** EduBlast Web / TestBee PYQ (`files/` + `/chapter-pyq`)  
**Date:** 2026-09-17  
**Predecessor:** yearbook ingest `files/ingest_di_yearbooks.py`

## Goal

Rebuild Mathematics **Definite Integration** for JEE Main **2025** from the official MathonGo session chapter-wise PDFs, with **OCR as step 1**.

## Sources

- `C:\Users\tempo\Downloads\Mathematics - JEE Main 2025 January Chapter-wise Question Bank - MathonGo.pdf`
- `C:\Users\tempo\Downloads\Mathematics - JEE Main 2025 April Chapter-wise Question Bank - MathonGo.pdf`

## Count gate (paper, not TOC)

| Book | Printed DI pages | Printed Qs | Answer-key lines | Named count (rejected) |
|---|---|---|---|---|
| January | 37–39 | Q1–Q13 | p.68, 13 keys | 37 (TOC start page) |
| April | 37–38 | Q1–Q9 | p.65, 9 keys | 28 |

Do **not** invent Area Under Curves / Differential Equations rows to fake 37+28. OCR every printed DI question (22). Isolated caches: `files/out-math-2025-jan-di/`, `files/out-math-2025-apr-di/`.

## Pipeline

1. Inventory January and April in parallel. Gate: unique Q numbers on DI title pages = that chapter’s Answer Keys block.
2. Crop each question full-width (both columns; stitch continuation onto the next DI page) plus the chapter key strip.
3. **gemma4** OCR in one `ThreadPoolExecutor(max_workers=len(jobs))`. Cache `ocr/q_NN.json`. Retry failures in a second parallel wave. Document AI is not first. No Gemini. No glm until packets exist.
4. `format_ocr_math` + KaTeX + paper audit. Publish `human_ok` with the PDF key. Hold the rest.
5. Overwrite existing 2025 rows `q_no` 144–165 in place (`source_bbox.booklet` + `pdf_q`). Leave 2026 `166–179` untouched. These books do not print per-question day/shift; keep month dates `2025-01-01` / `2025-04-01` unless the crop shows a real day.
6. Regen 2025 `solution_md` only (`run_pyq_solutions.py --book math --chapter 19 --year 2025 --overwrite`), parallel. Bust `CHAPTER_PYQ_CACHE_VERSION`.

## Script

`files/ingest_math_2025_di_ocr.py`

## Non-goals

- 2020–2024 rebuild
- 2026 rows
- Physics even-split
- EduDeca / EduBite
- Gemini
