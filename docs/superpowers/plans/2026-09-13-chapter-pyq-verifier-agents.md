# Chapter PYQ Verifier Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run one PDF chapter through parallel Document AI, `gemma4` vision, optional `glm5.3-flash` tie-break, KaTeX audit, and dual text solvers (`glm5.3` + `deepseekv4-flash`), then publish only two-observer `auto_ok` rows and stop with a report when anything disagrees.

**Architecture:** All new logic lives in `c:\Users\tempo\Downloads\files\` next to the existing ingest scripts. Pure functions (promotion, solver parse, coverage, vision compare) are unit-tested with stdlib `unittest` and fixtures — no live Sarvam in tests. `run_chapter_agents.py` is the conductor. `pyq_common.py` gains a `/v2/chat/completions` client that can attach page PNGs for vision models only.

**Tech Stack:** Python 3.14 (`C:\Python314\python.exe`), `httpx`, existing `supabase` client, Sarvam v2 + Document AI, KaTeX via `Web/node_modules/katex`, PowerShell.

**Spec:** `Web/docs/superpowers/specs/2026-09-13-chapter-pyq-verifier-agents-design.md`

## Global Constraints

- Web / `files/` only. Do not touch EduDeca or EduBite.
- Do not send page PNGs to `glm5.3`, `glm5.2`, `deepseekv4-flash`, or `/v1/chat/completions`.
- Do not use Gemini.
- Students see `review_status in ('auto_ok','human_ok')` only.
- `auto_ok` requires `extraction_confidence = 1.0` and `solve_match`. Single-observer stays `0.5` and must not publish.
- Figure keys stay `p{page:03d}_x{xref}`. Do not invent a new scheme.
- Numericals: `options: []`, never `buildNumericMcq`.
- Do not quote extraction accuracy.
- PowerShell: no `&&`. `$env:PYTHONUTF8 = "1"`. Pin `pymupdf==1.26.3` if PyMuPDF is imported.
- DB: TestBee project `bytsiknhtcnlxwzgqkrd`, tables `pyq_*`, bucket `pyq`.
- Commit only when the user explicitly asks. Skip every Commit step until then.
- Rate limit chat at 60 req/min (`RateLimiter`). Digitise workers default 4.

## File map

| File | Responsibility |
|------|----------------|
| `files/pyq_common.py` | **Modify** — `SARVAM_V2_CHAT_URL`, `call_sarvam_v2`, `page_image_message`, keep `chat_content` |
| `files/agents/models.py` | Frozen model ids and which ones may see images |
| `files/agents/promotion.py` | `auto_ok` / `flagged` / `unreviewed` decision |
| `files/agents/vision.py` | Compare parse vs `gemma4` JSON; tie-break with `glm5.3-flash` |
| `files/agents/solvers.py` | Parse solver replies; compare to answer key |
| `files/agents/coverage.py` | Missing/extra q_no vs skeleton |
| `files/agents/katex_check.py` | Dollar balance + Node KaTeX probe |
| `files/agents/figures_check.py` | Storage GET 200 for chapter keys |
| `files/run_chapter_agents.py` | Conductor CLI |
| `files/tests/test_promotion.py` | Promotion fixtures |
| `files/tests/test_solvers.py` | Solver parse fixtures |
| `files/tests/test_vision.py` | Agreement / disagreement fixtures |
| `files/tests/test_coverage.py` | Miss / extra q_no |
| `files/katex_probe.mjs` | `katex.renderToString` throwOnError |

### Names (single source of truth)

| Identifier | Shape |
|---|---|
| `VISION_MODEL` | `"gemma4"` |
| `TIEBREAK_MODEL` | `"glm5.3-flash"` |
| `SOLVER_A` | `"glm5.3"` |
| `SOLVER_B` | `"deepseekv4-flash"` |
| `IMAGE_MODELS` | `frozenset({"gemma4", "glm5.3-flash"})` |
| `GateResult.status` | `"auto_ok" \| "flagged" \| "unreviewed"` |
| `Hold.reason` | `"coverage_miss" \| "figure_get" \| "vision_conflict" \| "katex_render" \| "solver_mismatch" \| "solver_parse" \| "empty_model" \| "shape"` |

---

### Task 1: Model allow-list and v2 chat helper

**Files:**
- Create: `files/agents/__init__.py` (empty)
- Create: `files/agents/models.py`
- Create: `files/tests/test_models.py`
- Modify: `files/pyq_common.py` (add v2 helpers after `call_sarvam`)

**Interfaces:**
- Produces: `IMAGE_MODELS`, `assert_model_may_see_image(model: str) -> None`, `call_sarvam_v2(...)`, `page_image_message(png_path: Path, text: str) -> list`

- [ ] **Step 1: Write the failing test**

```python
# files/tests/test_models.py
import unittest
from agents.models import IMAGE_MODELS, assert_model_may_see_image

class TestImageAllowList(unittest.TestCase):
    def test_gemma4_and_flash_may_see_png(self):
        assert_model_may_see_image("gemma4")
        assert_model_may_see_image("glm5.3-flash")

    def test_text_solvers_must_not_see_png(self):
        for model in ("glm5.3", "deepseekv4-flash", "glm5.2", "sarvam-105b"):
            with self.assertRaises(ValueError):
                assert_model_may_see_image(model)

    def test_image_models_frozen(self):
        self.assertEqual(IMAGE_MODELS, frozenset({"gemma4", "glm5.3-flash"}))

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
$env:PYTHONUTF8 = "1"
Set-Location c:\Users\tempo\Downloads\files
C:\Python314\python.exe -m unittest tests.test_models -v
```

Expected: FAIL — `agents.models` not found.

- [ ] **Step 3: Write minimal implementation**

```python
# files/agents/models.py
VISION_MODEL = "gemma4"
TIEBREAK_MODEL = "glm5.3-flash"
SOLVER_A = "glm5.3"
SOLVER_B = "deepseekv4-flash"
IMAGE_MODELS = frozenset({VISION_MODEL, TIEBREAK_MODEL})

def assert_model_may_see_image(model: str) -> None:
    if model not in IMAGE_MODELS:
        raise ValueError(f"{model} must not receive a PNG on this Sarvam key")
```

In `pyq_common.py` add:

```python
SARVAM_V2_CHAT_URL = "https://api.sarvam.ai/v2/chat/completions"

def page_image_message(png_path: Path, text: str) -> list:
    import base64
    b64 = base64.b64encode(png_path.read_bytes()).decode("ascii")
    return [{
        "role": "user",
        "content": [
            {"type": "text", "text": text},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
        ],
    }]

def call_sarvam_v2(model: str, messages: list, api_key: str, limiter: "RateLimiter",
                   max_tokens: int = 2048, json_object: bool = True,
                   timeout: float = 180.0) -> dict:
    from agents.models import IMAGE_MODELS
    blob = json.dumps(messages)
    if "image_url" in blob and model not in IMAGE_MODELS:
        raise ValueError(f"{model} must not receive a PNG on this Sarvam key")
    limiter.wait()
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0,
        "max_tokens": max_tokens,
    }
    if json_object:
        payload["response_format"] = {"type": "json_object"}
    r = httpx.post(
        SARVAM_V2_CHAT_URL,
        headers={"api-subscription-key": api_key, "Content-Type": "application/json"},
        json=payload,
        timeout=timeout,
    )
    r.raise_for_status()
    return r.json()
```

Keep existing `call_sarvam` (v1) unused by the conductor.

- [ ] **Step 4: Re-run tests**

```powershell
C:\Python314\python.exe -m unittest tests.test_models -v
```

Expected: PASS.

- [ ] **Step 5: Commit** — skip unless the user asks.

---

### Task 2: Promotion rule

**Files:**
- Create: `files/agents/promotion.py`
- Create: `files/tests/test_promotion.py`

**Interfaces:**
- Produces: `decide_status(gates: dict) -> str` returning `auto_ok` | `flagged` | `unreviewed`

- [ ] **Step 1: Failing test**

```python
# files/tests/test_promotion.py
import unittest
from agents.promotion import decide_status

BASE = {
    "skeleton": True,
    "shape_ok": True,
    "coverage_ok": True,
    "vision_ok": True,
    "figures_ok": True,
    "audit_ok": True,
    "katex_ok": True,
    "solve_match": True,
    "confidence": 1.0,
}

class TestDecideStatus(unittest.TestCase):
    def test_all_gates_auto_ok(self):
        self.assertEqual(decide_status(BASE), "auto_ok")

    def test_single_observer_never_auto_ok(self):
        g = {**BASE, "confidence": 0.5}
        self.assertNotEqual(decide_status(g), "auto_ok")

    def test_solver_mismatch_flagged(self):
        g = {**BASE, "solve_match": False}
        self.assertEqual(decide_status(g), "flagged")

    def test_shape_fail_unreviewed(self):
        g = {**BASE, "shape_ok": False}
        self.assertEqual(decide_status(g), "unreviewed")

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run — expect FAIL** (`agents.promotion` missing).

```powershell
C:\Python314\python.exe -m unittest tests.test_promotion -v
```

- [ ] **Step 3: Minimal implementation**

```python
# files/agents/promotion.py
def decide_status(gates: dict) -> str:
    if not gates.get("skeleton") or not gates.get("shape_ok") or not gates.get("coverage_ok"):
        return "unreviewed"
    if gates.get("confidence") != 1.0:
        return "flagged"
    for key in ("vision_ok", "figures_ok", "audit_ok", "katex_ok", "solve_match"):
        if not gates.get(key):
            return "flagged"
    return "auto_ok"
```

- [ ] **Step 4: Re-run — expect PASS.**

- [ ] **Step 5: Commit** — skip unless asked.

---

### Task 3: Solver parse and key compare

**Files:**
- Create: `files/agents/solvers.py`
- Create: `files/tests/test_solvers.py`

**Interfaces:**
- Produces: `parse_mcq_choice(text: str) -> int | None`, `parse_numerical(text: str) -> str | None`, `solve_match(glm: str, deepseek: str, key_type: str, key_value: str) -> bool`

- [ ] **Step 1: Failing test**

```python
# files/tests/test_solvers.py
import unittest
from agents.solvers import parse_mcq_choice, solve_match

class TestSolvers(unittest.TestCase):
    def test_parse_option_number(self):
        self.assertEqual(parse_mcq_choice("(2)"), 2)
        self.assertEqual(parse_mcq_choice("2"), 2)
        self.assertEqual(parse_mcq_choice("option 3"), 3)

    def test_both_match_key(self):
        self.assertTrue(solve_match("2", "2", "mcq", "2"))

    def test_either_mismatch(self):
        self.assertFalse(solve_match("3", "2", "mcq", "2"))
        self.assertFalse(solve_match("3", "3", "mcq", "2"))

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**

```python
# files/agents/solvers.py
import re

_MCQ = re.compile(r"\b([1-4])\b")

def parse_mcq_choice(text: str) -> int | None:
    m = _MCQ.search(text or "")
    return int(m.group(1)) if m else None

def parse_numerical(text: str) -> str | None:
    t = (text or "").strip()
    return t or None

def solve_match(glm: str, deepseek: str, key_type: str, key_value: str) -> bool:
    key = str(key_value).strip()
    if key_type == "mcq":
        a = parse_mcq_choice(glm)
        b = parse_mcq_choice(deepseek)
        k = parse_mcq_choice(key)
        return a is not None and a == b == k
    return str(glm).strip() == str(deepseek).strip() == key
```

- [ ] **Step 4: Re-run — expect PASS.**

- [ ] **Step 5: Commit** — skip unless asked.

---

### Task 4: Coverage and vision compare

**Files:**
- Create: `files/agents/coverage.py`
- Create: `files/agents/vision.py`
- Create: `files/tests/test_coverage.py`
- Create: `files/tests/test_vision.py`

**Interfaces:**
- Produces: `coverage_diff(skeleton_q: set[int], parsed_q: set[int]) -> dict`, `vision_agree(parse_page: dict, gemma_page: dict) -> bool`

- [ ] **Step 1: Failing tests**

```python
# files/tests/test_coverage.py
import unittest
from agents.coverage import coverage_diff

class TestCoverage(unittest.TestCase):
    def test_ok(self):
        d = coverage_diff({1, 2, 3}, {1, 2, 3})
        self.assertEqual(d["missing"], [])
        self.assertEqual(d["extra"], [])

    def test_miss(self):
        d = coverage_diff({1, 2, 3}, {1, 3})
        self.assertEqual(d["missing"], [2])

if __name__ == "__main__":
    unittest.main()
```

```python
# files/tests/test_vision.py
import unittest
from agents.vision import vision_agree

class TestVision(unittest.TestCase):
    def test_same_q_set_and_shape(self):
        parse = {"questions": [{"q_no": 1, "mcq": True, "option_count": 4}]}
        gemma = {"questions": [{"q_no": 1, "mcq": True, "option_count": 4}]}
        self.assertTrue(vision_agree(parse, gemma))

    def test_missing_q(self):
        parse = {"questions": [{"q_no": 1, "mcq": True, "option_count": 4}]}
        gemma = {"questions": []}
        self.assertFalse(vision_agree(parse, gemma))

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run — expect FAIL.**

```powershell
C:\Python314\python.exe -m unittest tests.test_coverage tests.test_vision -v
```

- [ ] **Step 3: Implement**

```python
# files/agents/coverage.py
def coverage_diff(skeleton_q: set, parsed_q: set) -> dict:
    return {
        "missing": sorted(skeleton_q - parsed_q),
        "extra": sorted(parsed_q - skeleton_q),
    }
```

```python
# files/agents/vision.py
def _index(payload: dict) -> dict:
    out = {}
    for q in payload.get("questions") or []:
        out[int(q["q_no"])] = q
    return out

def vision_agree(parse_page: dict, gemma_page: dict) -> bool:
    a, b = _index(parse_page), _index(gemma_page)
    if set(a) != set(b):
        return False
    for q_no, pq in a.items():
        gq = b[q_no]
        if bool(pq.get("mcq")) != bool(gq.get("mcq")):
            return False
        if int(pq.get("option_count") or 0) != int(gq.get("option_count") or 0):
            return False
    return True
```

- [ ] **Step 4: Re-run — expect PASS.**

- [ ] **Step 5: Commit** — skip unless asked.

---

### Task 5: KaTeX dollar-balance + render probe

**Files:**
- Create: `files/agents/katex_check.py`
- Create: `files/katex_probe.mjs`
- Create: `files/tests/test_katex_check.py`

**Interfaces:**
- Produces: `dollar_runs_ok(text: str) -> bool`, `needs_llm_wrap(text: str) -> bool`

- [ ] **Step 1: Failing test**

```python
# files/tests/test_katex_check.py
import unittest
from agents.katex_check import dollar_runs_ok, needs_llm_wrap

class TestKatexCheck(unittest.TestCase):
    def test_paired_dollars(self):
        self.assertTrue(dollar_runs_ok(r"force $F = ma$ here"))

    def test_odd_dollars_fail(self):
        self.assertFalse(dollar_runs_ok("force $F = ma here"))

    def test_glyph_without_dollar_needs_wrap(self):
        self.assertTrue(needs_llm_wrap("sqrt of x is √x"))
        self.assertFalse(needs_llm_wrap(r"sqrt of x is $\sqrt{x}$"))

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**

```python
# files/agents/katex_check.py
import re

_GLYPH = re.compile(r"[√²³₁-₉]|[a-zA-Z]\^\d")

def dollar_runs_ok(text: str) -> bool:
    return (text or "").count("$") % 2 == 0

def needs_llm_wrap(text: str) -> bool:
    s = text or ""
    if "$" in s:
        return False
    return bool(_GLYPH.search(s))
```

```javascript
// files/katex_probe.mjs
import katex from "../EduBlast/Web/node_modules/katex/dist/katex.mjs";
// Prefer: run from Web with node -e, or set KATEX_MODULE.
const tex = process.argv[2] || "";
katex.renderToString(tex, { throwOnError: true });
```

Resolve KaTeX from `c:\Users\tempo\Downloads\EduBlast\Web\node_modules\katex`. If the ESM path fails, use:

```javascript
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const katex = require("c:/Users/tempo/Downloads/EduBlast/Web/node_modules/katex");
```

- [ ] **Step 4: Re-run unittest — expect PASS.** Manually: `node files/katex_probe.mjs "x^2"` should exit 0.

- [ ] **Step 5: Commit** — skip unless asked.

---

### Task 6: Parallel digitise + figure GET helper

**Files:**
- Modify: `files/pyq_common.py` (`digitise_pages_parallel`)
- Create: `files/agents/figures_check.py`
- Create: `files/tests/test_figures_check.py`

**Interfaces:**
- Produces: `digitise_pages_parallel(page_nos: list[int], api_key: str, workers: int = 4) -> dict[int, dict | str]`, `figure_url_ok(url: str) -> bool` (injectable GET)

- [ ] **Step 1: Failing test for GET helper** (no live Storage)

```python
# files/tests/test_figures_check.py
import unittest
from agents.figures_check import missing_figure_gets

class TestFiguresCheck(unittest.TestCase):
    def test_reports_non_200(self):
        def fake_get(url: str) -> int:
            return 200 if "ok" in url else 404
        missing = missing_figure_gets(
            {"a": "https://x/ok.png", "b": "https://x/bad.png"},
            get_status=fake_get,
        )
        self.assertEqual(missing, ["b"])

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**

```python
# files/agents/figures_check.py
def missing_figure_gets(key_to_url: dict[str, str], get_status) -> list[str]:
    bad = []
    for key, url in sorted(key_to_url.items()):
        if get_status(url) != 200:
            bad.append(key)
    return bad
```

Add `digitise_pages_parallel` using `concurrent.futures.ThreadPoolExecutor`, calling existing `digitise_page` (cache-aware).

- [ ] **Step 4: Re-run — expect PASS.**

- [ ] **Step 5: Commit** — skip unless asked.

---

### Task 7: Conductor CLI

**Files:**
- Create: `files/run_chapter_agents.py`
- Modify: `files/write_and_publish.py` only if a `--from-agents` path is cleaner than duplicating upserts; prefer calling a new `agents/publish.py` that copies the upsert loop from `write_and_publish.py` and uses `decide_status`.

**Interfaces:**
- Consumes: Tasks 1–6, `parse_ocr_page`, `format_ocr_math`, `load_skeleton`, `load_answer_key`
- Produces: `files/out/agents/chapter_{N}/REPORT.md`, `hold.json`; process exit 0 or 2

- [ ] **Step 1: Write a dry-run test** that the conductor refuses `--chapter` with an empty skeleton fixture (temp dir). If wiring `OUT` is hard, test `build_report(holds: list) -> str` contains `solver_mismatch` and q_no.

```python
# files/tests/test_report.py
import unittest
from agents.report import build_report

class TestReport(unittest.TestCase):
    def test_lists_solver_hold(self):
        text = build_report(5, [{"q_no": 19, "reason": "solver_mismatch",
                                 "pdf_key": "2", "glm": "3", "deepseek": "2"}])
        self.assertIn("19", text)
        self.assertIn("solver_mismatch", text)
        self.assertIn("PDF key", text)

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `agents/report.py` and `run_chapter_agents.py`**

CLI:

```
C:\Python314\python.exe run_chapter_agents.py --chapter 5
C:\Python314\python.exe run_chapter_agents.py --chapter 5 --apply-holds out/agents/chapter_5/hold.json
```

Flow inside `main`:

1. Resolve pages from skeleton for `--chapter`.
2. `digitise_pages_parallel`.
3. Parse + `format_ocr_math` → `parsed.json`.
4. Coverage; one recache-busting digitise per missing page; still missing → hold.
5. Upload chapter figures if needed; GET check; re-upload misses.
6. `gemma4` per page (PNG); `vision_agree`; disagreements → `glm5.3-flash`.
7. `audit_paper_text` + dollar/katex; `glm5.3` wrap only if `needs_llm_wrap`.
8. Dual solvers vs `answer_key.json`.
9. `decide_status` per q_no; upsert like `write_and_publish.py`.
10. Write `REPORT.md` + `hold.json`. Exit 2 if holds.

`hold.json` shape:

```json
{
  "chapter_no": 5,
  "holds": [
    {
      "q_no": 19,
      "reason": "solver_mismatch",
      "pdf_key": "2",
      "glm": "3",
      "deepseek": "2",
      "decision": null
    }
  ]
}
```

`--apply-holds` reads `decision`: `keep_key` | `use_glm` | `use_deepseek` | `leave_unreviewed`. Then re-upsert those rows only (`human_ok` for keep_key / chosen solver after the user picked).

- [ ] **Step 4: Unit tests for report + apply-holds decision mapping PASS.** Do not call live Sarvam in CI.

- [ ] **Step 5: Manual chapter 5** only when the user says to run it (costs Document AI + v2 tokens). Then bump `chapter-pyq-questions-vN` / counts cache and open `/chapter-pyq/physics/laws-of-motion`.

- [ ] **Step 6: Commit** — skip unless asked.

---

### Task 8: Skill line

**Files:**
- Modify: `Web/.cursor/skills/chapter-pyq/SKILL.md` (workspace copy: `EduBlast/.cursor/skills/chapter-pyq/SKILL.md`)

Replace the OCR row that says chat is text-only with: Document AI remains the layout OCR; `gemma4` / `glm5.3-flash` may see page PNGs on `/v2`; `glm5.3` and `deepseekv4-flash` are text solvers only; never quote accuracy; conductor is `run_chapter_agents.py --chapter N`.

- [ ] **Step 1:** Edit the Hard rules table OCR / Whole book bullets.
- [ ] **Step 2:** No test.
- [ ] **Step 3:** Commit — skip unless asked.

---

## Spec coverage

| Spec section | Task |
|---|---|
| Parallel Document AI | 6, 7 |
| `gemma4` observer | 4, 7 |
| `glm5.3-flash` tie-break | 7 |
| Dual solvers | 3, 7 |
| KaTeX agent | 5, 7 |
| Coverage + re-digitise | 4, 7 |
| Figure GET + reupload | 6, 7 |
| `auto_ok` two-observer | 2, 7 |
| Continue / `hold.json` | 7 |
| No PNG to text models | 1 |
| Skill update | 8 |
