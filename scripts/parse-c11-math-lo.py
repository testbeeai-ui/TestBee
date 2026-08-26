"""
Parse Class 11 Maths Learning Outcomes DOCX text into MCQ JSON
mapped onto curriculum (topic, subtopic_name) keys.

Writes Web/tmp-c11-math-lo-parsed.json
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(r"C:\Users\tempo\Downloads\EduBlast\Web")

HEADER_RE = re.compile(
    r"^(\d+[A-Z]?(?:\([ivx]+\))?)\.\s+(.+)$",
    re.I,
)
Q_RE = re.compile(r"^Q(\d+)\.\s*(.*)$")
INLINE_KEY_RE = re.compile(
    r"^Answer Key:\s*(.+)$",
    re.I,
)
TABLE_KEY_RE = re.compile(r"^Answer Key", re.I)
DIFFICULTY_TITLE = re.compile(
    r"^(simple|medium|tough)(?:\s*[—–-]\s*questions?\s+\d+[–-]\d+)?$",
    re.I,
)


def split_options(blob: str) -> list[str]:
    # Require whitespace after A./B./C./D. so "C.V." is not treated as option C.
    parts = re.split(r"(?=[A-D]\.\s)", blob.strip())
    opts: list[str] = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        m = re.match(r"^([A-D])\.\s*(.+)$", p, re.S)
        if m:
            opts.append(re.sub(r"\s+", " ", m.group(2)).strip())
    return opts


def parse_inline_answers(line: str) -> dict[int, str]:
    out: dict[int, str] = {}
    for m in re.finditer(r"(\d+)\s*[-–—:]\s*([A-D])", line, re.I):
        out[int(m.group(1))] = m.group(2).upper()
    return out


def parse_table_answers(lines: list[str]) -> dict[int, str]:
    out: dict[int, str] = {}
    i = 0
    while i < len(lines):
        ln = lines[i].strip()
        if ln.lower() in {"question", "answer"}:
            i += 1
            continue
        if re.fullmatch(r"\d+", ln) and i + 1 < len(lines):
            nxt = lines[i + 1].strip().upper()
            if re.fullmatch(r"[A-D]", nxt):
                out[int(ln)] = nxt
                i += 2
                continue
        i += 1
    return out


def parse_questions(body_lines: list[str], answers: dict[int, str], difficulty_fn) -> list[dict]:
    questions: list[dict] = []
    i = 0
    while i < len(body_lines):
        m = Q_RE.match(body_lines[i])
        if not m:
            i += 1
            continue
        qnum = int(m.group(1))
        q_parts = [m.group(2).strip()]
        i += 1
        while i < len(body_lines) and not Q_RE.match(body_lines[i]) and not re.match(r"^A\.\s", body_lines[i]):
            if HEADER_RE.match(body_lines[i]) or TABLE_KEY_RE.match(body_lines[i]):
                break
            q_parts.append(body_lines[i])
            i += 1
        qtext = " ".join(p for p in q_parts if p).strip()
        opts: list[str] = []
        if i < len(body_lines) and re.match(r"^A\.\s", body_lines[i]):
            opts = split_options(body_lines[i])
            i += 1
            while i < len(body_lines) and re.match(r"^[B-D]\.\s", body_lines[i]):
                opts.extend(split_options(body_lines[i]))
                i += 1
        elif re.search(r"(?:^|\s)A\.\s*.+B\.", qtext):
            am = re.search(r"(?:^|\s)A\.", qtext)
            if am:
                opts = split_options(qtext[am.start() :].lstrip())
                qtext = qtext[: am.start()].strip()
        if len(opts) < 2:
            continue
        letter = answers.get(qnum)
        if not letter:
            continue
        idx = ord(letter) - ord("A")
        if idx < 0 or idx >= len(opts):
            continue
        diff = difficulty_fn(qnum)
        questions.append(
            {
                "question": re.sub(r"\s+", " ", qtext).strip(),
                "options": opts,
                "correctAnswer": opts[idx],
                "solution": f"Correct option: {letter}. ({diff})",
                "difficulty": diff,
            }
        )
    return questions


def default_diff(qnum: int) -> str:
    if qnum <= 3:
        return "simple"
    if qnum <= 7:
        return "medium"
    return "tough"


def split_sections(text: str) -> list[tuple[str, str, str]]:
    """Return (code, title, block_text) for each numbered section that has questions."""
    lines = [ln.strip() for ln in text.splitlines()]
    indices: list[tuple[int, str, str]] = []
    for i, ln in enumerate(lines):
        m = HEADER_RE.match(ln)
        if not m:
            continue
        code, title = m.group(1), m.group(2).strip()
        low = title.lower()
        if DIFFICULTY_TITLE.match(title) or low == "standard results:":
            continue
        indices.append((i, code, title))

    sections: list[tuple[str, str, str]] = []
    for j, (i, code, title) in enumerate(indices):
        end = indices[j + 1][0] if j + 1 < len(indices) else len(lines)
        block = "\n".join(lines[i:end])
        if re.search(r"^Q\d+\.", block, re.M):
            sections.append((code, title, block))
    return sections


def parse_section(block: str) -> list[dict]:
    lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
    key_idx = None
    for i, ln in enumerate(lines):
        if TABLE_KEY_RE.match(ln):
            key_idx = i
            break
    if key_idx is None:
        return []
    key_line = lines[key_idx]
    inline = INLINE_KEY_RE.match(key_line)
    if inline:
        answers = parse_inline_answers(inline.group(1))
    else:
        answers = parse_table_answers(lines[key_idx + 1 :])
    body = lines[1:key_idx]
    return parse_questions(body, answers, default_diff)


# Each mapping: (file, section_code_prefix or exact code, curriculum topic, subtopic_name)
# More specific codes first when matching: exact code, then prefix.

LIMITS_MAP = [
    (("3A", "3B", "3C", "3D"), "12.1 Intuitive Idea of Limit", "Limit of a function at a point; left and right limits"),
    (("3E",), "12.2 Algebra of Limits", "Limits of sum, difference, product, quotient"),
    (("3F",), "12.3 Limits of Polynomial and Rational Functions", "Limits of polynomial and rational functions"),
    (("4A", "4B"), "12.4 Limits of Trigonometric Functions", "lim (sin x)/x as x → 0; related standard limits"),
    (("1A", "1B", "2A", "2B"), "12.6 Derivatives", "Derivative as rate of change; geometric interpretation (tangent)"),
    (("5A", "5B"), "12.6 Derivatives", "Derivative from first principle"),
    (("5C",), "12.7 Algebra of Derivatives", "Derivative of sum, difference, product, quotient (without proof of product rule)"),
    (("5D", "5E"), "12.8 Derivatives of Standard Functions", "Polynomials; sin x, cos x, tan x; exponential and logarithmic (as per NCERT scope)"),
]

TDG_MAP = [
    (("1", "2"), "11.1 Coordinate Axes and Coordinate Planes in Space", "Octants; coordinates of a point in space"),
    (("3",), "11.2 Distance between Two Points", "Distance formula in 3D"),
]

PROB_MAP = [
    (("1A", "1B"), "14.1 Random Experiments and Sample Space", "Random experiment; outcomes; sample space; events"),
    (("2A", "2B"), "14.2 Types of Events", "Impossible and sure events; simple events; complementary events"),
    (("2C", "2D", "2E"), "14.3 Algebra of Events", "Union, intersection, difference; mutually exclusive events"),
    (("3A", "3D"), "14.4 Axiomatic Approach to Probability", "Probability of an event; probability of complement"),
    (("3B", "3C"), "14.5 Classical Probability", "Equally likely outcomes; addition rule for mutually exclusive events"),
]

STAT_MAP = [
    (("1A", "1B", "2A", "2B", "3A", "3B"), "13.1 Measures of Dispersion", "Range; mean deviation; variance; standard deviation"),
    (("4A", "4B", "4C", "4D", "4E", "4F", "4G"), "13.2 Mean Deviation", "Ungrouped data; grouped data (discrete and continuous)"),
    (("5A", "5B", "5C", "5D", "5E", "5H"), "13.3 Variance and Standard Deviation", "Formulae for ungrouped and grouped data"),
    (("5F", "5G"), "13.3 Variance and Standard Deviation", "Shortcut method for grouped data"),
    (("6A",), "13.4 Coefficient of Variation", "Comparison of variability"),
    (("6B", "6C"), "13.5 Analysis of Frequency Distributions", "Combined mean and variance (elementary)"),
]


def code_matches(section_code: str, map_code: str) -> bool:
    if section_code == map_code:
        return True
    # 2B matches 2B(i) / 2B(ii); 2 does not match 2B or 2A
    rest = section_code[len(map_code) :]
    return bool(rest) and rest.startswith("(") and section_code.startswith(map_code)


def match_map(code: str, mapping: list[tuple[tuple[str, ...], str, str]]) -> tuple[str, str] | None:
    best = None
    best_len = -1
    for codes, topic, sub in mapping:
        for c in codes:
            if code_matches(code, c) and len(c) > best_len:
                best = (topic, sub)
                best_len = len(c)
    return best


def collect(path: Path, mapping, source: str, buckets: dict, reports: list):
    text = path.read_text(encoding="utf-8")
    sections = split_sections(text)
    unmatched = []
    for code, title, block in sections:
        mapped = match_map(code, mapping)
        qs = parse_section(block)
        if not mapped:
            unmatched.append((code, title, len(qs)))
            continue
        topic, sub = mapped
        key = (topic, sub, source)
        buckets[key].extend(qs)
        reports.append(
            {
                "source": source,
                "code": code,
                "title": title,
                "topic": topic,
                "subtopic": sub,
                "count": len(qs),
            }
        )
    return unmatched


def main():
    buckets: dict[tuple[str, str, str], list] = defaultdict(list)
    reports: list[dict] = []
    files = [
        (ROOT / "tmp-c11-limits-and-derivatives-lo.txt", LIMITS_MAP, "Learning Outcome Class 11 Mathematics - Limits and Derivatives.docx"),
        (ROOT / "tmp-c11-three-dimensional-geometry-lo.txt", TDG_MAP, "Learning Outcome Class 11 Mathematics - Three Dimensional Geometry.docx"),
        (ROOT / "tmp-c11-probability-lo.txt", PROB_MAP, "Learning Outcome Class 11 Mathematics - Probability.docx"),
        (ROOT / "tmp-c11-statistics-lo.txt", STAT_MAP, "Learning Outcome Class 11 Mathematics - Statistics.docx"),
    ]
    all_unmatched = []
    for path, mapping, source in files:
        u = collect(path, mapping, source, buckets, reports)
        all_unmatched.extend([(source, *row) for row in u])

    parsed = []
    for (topic, sub, source), qs in buckets.items():
        parsed.append(
            {
                "topic": topic,
                "subtopic_name": sub,
                "source": source,
                "questions": qs,
                "count": len(qs),
            }
        )
    parsed.sort(key=lambda p: p["topic"])
    out = ROOT / "tmp-c11-math-lo-parsed.json"
    out.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", out)
    print("\nPACKS:")
    total = 0
    for p in parsed:
        total += p["count"]
        flag = " << EMPTY" if p["count"] == 0 else ""
        print(f"  {p['count']:3d}  {p['topic'][:42]:42s} | {p['subtopic_name'][:40]}{flag}".encode("ascii", "replace").decode("ascii"))
    print(f"packs={len(parsed)} totalQs={total}")
    if all_unmatched:
        print("\nUNMATCHED SECTIONS:")
        for row in all_unmatched:
            print(" ", row)
    print("\nSECTION COUNTS:")
    for r in reports:
        flag = "" if r["count"] == 10 else " << not 10"
        print(f"  {r['count']:2d} {r['code']:8s} {r['title'][:40]:40s}{flag}")


if __name__ == "__main__":
    main()
