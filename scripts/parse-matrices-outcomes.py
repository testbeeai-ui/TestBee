"""
Parse Class 12 Maths Matrices Learning Outcomes
→ MCQ JSON per curriculum subtopic.

Writes Web/tmp-matrices-outcomes-parsed.json for seeding.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

TEXT = Path(r"C:\Users\rentk\Desktop\Edublast\Web\tmp-matrices-lo.txt").read_text(encoding="utf-8")

DOC_TO_KEY = [
    ("Order of a Matrix", "order"),
    ("Types of Matrices", "types"),
    ("Equality of Matrices", "equality"),
    ("Matrix Addition", "addition"),
    ("Scalar Multiplication", "scalar"),
    ("Matrix Multiplication", "multiply"),
    ("Non-Commutativity", "noncomm"),
    ("Associative and Distributive", "assoc"),
    ("Transpose of a Matrix", "transpose"),
    # Skew before Symmetric — "Symmetric Matrices" is a substring of "Skew-Symmetric Matrices"
    ("Skew-Symmetric Matrices", "skew"),
    ("Symmetric + Skew-Symmetric Decomposition", "decomp"),
    ("Symmetric Matrices", "symmetric"),
    ("Definition of an Invertible", "inv_def"),
    ("Uniqueness and Determinant", "inv_unique"),
    ("Finding the Inverse Using Elementary", "inv_ero"),
]

MATCH_PREFIX = {
    "order": "Matrix of order",
    "types": "Types:",
    "equality": "Equality:",
    "addition": "Addition",
    "scalar": "Scalar multiplication",
    "multiply": "Matrix multiplication",
    "noncomm": "Non-commutativity",
    "assoc": "Associativity",
    "transpose": "Transpose AT",
    "symmetric": "Symmetric:",
    "skew": "Skew-symmetric",
    "decomp": "Any matrix A",
    "inv_def": "A is invertible",
    "inv_unique": "Inverse is unique",
    "inv_ero": "Using elementary row",
}

TOPIC_MAP = {
    "order": "Matrix Basics",
    "types": "Matrix Basics",
    "equality": "Matrix Basics",
    "addition": "Matrix Operations",
    "scalar": "Matrix Operations",
    "multiply": "Matrix Operations",
    "noncomm": "Matrix Operations",
    "assoc": "Matrix Operations",
    "transpose": "Transpose and Symmetric",
    "symmetric": "Transpose and Symmetric",
    "skew": "Transpose and Symmetric",
    "decomp": "Transpose and Symmetric",
    "inv_def": "Invertible Matrices",
    "inv_unique": "Invertible Matrices",
    "inv_ero": "Invertible Matrices",
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

    out = Path(r"C:\Users\rentk\Desktop\Edublast\Web\tmp-matrices-outcomes-parsed.json")
    out.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", out)
    total = 0
    for p in parsed:
        total += p["count"]
        flag = "" if p["count"] == 10 else " << CHECK"
        print(f"{p['count']:2d}  {p['topic'][:28]:28s} | {p['matchKey'][:26]:26s} | {p['docTitle'][:48]}{flag}")
    print(f"blocks={len(parsed)} totalQs={total}")


if __name__ == "__main__":
    main()
