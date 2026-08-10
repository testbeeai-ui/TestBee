"""
Parse Class 12 Maths Inverse Trigonometric Functions Learning Outcomes
→ MCQ JSON per curriculum subtopic.

Writes Web/tmp-itf-outcomes-parsed.json for seeding.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

TEXT = Path(r"C:\Users\rentk\Desktop\Edublast\Web\tmp-itf-lo.txt").read_text(encoding="utf-8")

DOC_TO_KEY = [
    ("sin", "sin"),
    ("cosec", "cosec"),
    ("cos", "cos"),
    ("tan", "tan"),
    ("sec", "sec"),
    ("cot", "cot"),
    ("Negative-Argument", "neg"),
    ("Complementary", "comp"),
    ("Addition of tan", "add_tan"),
    ("Double-Angle", "double"),
    ("Simplification of sin", "simp"),
]

MATCH_PREFIX = {
    "sin": "sin^-1x:",
    "cos": "cos^-1x:",
    "tan": "tan^-1x:",
    "cosec": "cosec^-1x:",
    "sec": "sec^-1x:",
    "cot": "cot^-1x:",
    "neg": "sin^-1(-x)",
    "comp": "sin^-1x + cos^-1x",
    "add_tan": "tan^-1x + tan^-1y",
    "double": "2tan^-1x",
    "simp": "Simplification:",
}

TOPIC_MAP = {
    "sin": "Domain and Range (Must Memorise)",
    "cos": "Domain and Range (Must Memorise)",
    "tan": "Domain and Range (Must Memorise)",
    "cosec": "Domain and Range (Must Memorise)",
    "sec": "Domain and Range (Must Memorise)",
    "cot": "Domain and Range (Must Memorise)",
    "neg": "Key Properties and Identities",
    "comp": "Key Properties and Identities",
    "add_tan": "Key Properties and Identities",
    "double": "Key Properties and Identities",
    "simp": "Key Properties and Identities",
}


def split_options(line: str) -> list[str]:
    parts = re.split(r"(?=[A-D]\.)", line.strip())
    opts = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        m = re.match(r"^([A-D])\.\s*(.+)$", p, re.S)
        if m:
            opts.append(m.group(2).strip())
    return opts


def parse_subtopic_block(block: str) -> list[dict]:
    lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
    key_idx = None
    for i, ln in enumerate(lines):
        if ln.lower() == "answer key":
            key_idx = i
            break
    if key_idx is None:
        return []
    answers = [ln.strip().upper() for ln in lines[key_idx + 1 :] if re.fullmatch(r"[A-D]", ln.strip(), re.I)]
    body = lines[:key_idx]

    questions: list[dict] = []
    i = 0
    while i < len(body):
        m = re.match(r"^(\d+)\.\s+(.+)$", body[i])
        if not m:
            i += 1
            continue
        qnum = int(m.group(1))
        q_parts = [m.group(2).strip()]
        i += 1
        while i < len(body) and not re.match(r"^A\.\s", body[i]) and not re.match(r"^\d+\.\s", body[i]):
            q_parts.append(body[i])
            i += 1
        qtext = " ".join(q_parts).strip()
        opts: list[str] = []
        if i < len(body) and re.match(r"^A\.\s", body[i]):
            opts = split_options(body[i])
            i += 1
        elif re.search(r"(?:^|\s)A\.\s*.+B\.", qtext):
            am = re.search(r"(?:^|\s)A\.", qtext)
            if am:
                opts = split_options(qtext[am.start() :].lstrip())
                qtext = qtext[: am.start()].strip()
        if len(opts) < 2:
            continue
        letter = answers[qnum - 1] if qnum - 1 < len(answers) else None
        if not letter or letter < "A" or letter > "D":
            continue
        idx = ord(letter) - ord("A")
        if idx >= len(opts):
            continue
        correct = opts[idx]
        difficulty = "simple" if qnum <= 3 else "medium" if qnum <= 7 else "tough"
        questions.append(
            {
                "question": qtext,
                "options": opts,
                "correctAnswer": correct,
                "solution": f"Correct option: {letter}. ({difficulty})",
                "difficulty": difficulty,
            }
        )
    return questions


def map_key(short: str) -> str:
    # Prefer longer / more specific doc titles first (cosec before cos, etc.)
    ordered = sorted(DOC_TO_KEY, key=lambda x: -len(x[0]))
    for doc_title, k in ordered:
        if doc_title.lower() in short.lower():
            return k
    raise SystemExit(f"Unmapped subtopic: {short!r}")


def main():
    parts = re.split(r"(?=^Subtopic\s+\d+\.\d+:)", TEXT, flags=re.M)
    parsed = []
    for part in parts:
        m = re.match(r"^Subtopic\s+\d+\.\d+:\s*(.+)$", part.strip(), re.M)
        if not m:
            continue
        short = m.group(1).strip()
        short_norm = (
            short.replace("\u2019", "'")
            .replace("\u2018", "'")
            .replace("\u2014", "-")
            .replace("\u2013", "-")
        )
        key = map_key(short_norm)
        qs = parse_subtopic_block(part)
        parsed.append(
            {
                "docTitle": short_norm,
                "matchKey": MATCH_PREFIX[key],
                "topic": TOPIC_MAP[key],
                "questions": qs,
                "count": len(qs),
            }
        )

    out = Path(r"C:\Users\rentk\Desktop\Edublast\Web\tmp-itf-outcomes-parsed.json")
    out.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", out)
    total = 0
    for p in parsed:
        total += p["count"]
        flag = "" if p["count"] == 10 else " << CHECK"
        print(f"{p['count']:2d}  {p['topic'][:34]:34s} | {p['matchKey'][:28]:28s} | {p['docTitle'][:50]}{flag}")
    print(f"blocks={len(parsed)} totalQs={total}")


if __name__ == "__main__":
    main()
