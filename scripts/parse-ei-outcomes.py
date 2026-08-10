"""
Parse Electromagnetic Induction Learning Outcomes DOCX text
→ MCQ JSON per curriculum subtopic.

Writes Web/tmp-ei-outcomes-parsed.json for seeding.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

TEXT = Path(r"C:\Users\rentk\Desktop\Edublast\Web\tmp-ei-lo.txt").read_text(encoding="utf-8")

# Longest / most specific titles first.
DOC_TO_KEY_ORDERED = [
    ("Faraday's Law for an N-Turn Coil", "For N-turn coil"),
    ("Faradays Law for an N-Turn Coil", "For N-turn coil"),
    ("Faraday's Second Law", "Faraday's Second Law"),
    ("Faradays Second Law", "Faraday's Second Law"),
    ("Faraday's First Law", "Faraday's First Law"),
    ("Faradays First Law", "Faraday's First Law"),
    ("Magnetic Flux", "Magnetic flux"),
    ("Magnet Approaching or Receding from a Coil", "Example: magnet approaching"),
    ("Lenz's Law and Conservation of Energy", "Lenz's Law is consequence"),
    ("Lenzs Law and Conservation of Energy", "Lenz's Law is consequence"),
    ("Direction of Induced Current", "Lenz's Law: direction"),
    ("Self-Inductance of a Long Solenoid", "Self-inductance of solenoid"),
    ("Energy Stored in an Inductor", "Energy stored in inductor"),
    ("Mutual Inductance", "Mutual inductance"),
    ("Self-Inductance", "Self-inductance L:"),
]

MATCH_PREFIX = {
    "Magnetic flux": "Magnetic flux",
    "Faraday's First Law": "Faraday's First Law",
    "Faraday's Second Law": "Faraday's Second Law",
    "For N-turn coil": "For N-turn coil",
    "Lenz's Law: direction": "Lenz's Law: direction",
    "Lenz's Law is consequence": "Lenz's Law is consequence",
    "Example: magnet approaching": "Example: magnet approaching",
    "Self-inductance L:": "Self-inductance L:",
    "Self-inductance of solenoid": "Self-inductance of solenoid",
    "Energy stored in inductor": "Energy stored in inductor",
    "Mutual inductance": "Mutual inductance",
}

TOPIC_MAP = {
    "Magnetic flux": "Magnetic Flux & Faraday's Laws",
    "Faraday's First Law": "Magnetic Flux & Faraday's Laws",
    "Faraday's Second Law": "Magnetic Flux & Faraday's Laws",
    "For N-turn coil": "Magnetic Flux & Faraday's Laws",
    "Lenz's Law: direction": "Lenz's Law",
    "Lenz's Law is consequence": "Lenz's Law",
    "Example: magnet approaching": "Lenz's Law",
    "Self-inductance L:": "Self and Mutual Inductance",
    "Self-inductance of solenoid": "Self and Mutual Inductance",
    "Energy stored in inductor": "Self and Mutual Inductance",
    "Mutual inductance": "Self and Mutual Inductance",
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


def map_key(short_norm: str) -> str:
    for doc_title, k in DOC_TO_KEY_ORDERED:
        if doc_title.lower() in short_norm.lower():
            return k
    raise SystemExit(f"Unmapped subtopic: {short_norm!r}")


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
            .replace("\ufffd", "'")
        )
        key = map_key(short_norm)
        qs = parse_subtopic_block(part)
        topic = TOPIC_MAP[key]
        match_prefix = MATCH_PREFIX[key]
        parsed.append(
            {
                "docTitle": short_norm,
                "matchKey": match_prefix,
                "topic": topic,
                "questions": qs,
                "count": len(qs),
            }
        )

    out = Path(r"C:\Users\rentk\Desktop\Edublast\Web\tmp-ei-outcomes-parsed.json")
    out.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", out)
    total = 0
    for p in parsed:
        total += p["count"]
        flag = "" if p["count"] == 10 else " << CHECK"
        print(f"{p['count']:2d}  {p['topic']:36s} | {p['matchKey'][:42]:42s} | {p['docTitle']}{flag}")
    print(f"blocks={len(parsed)} totalQs={total}")


if __name__ == "__main__":
    main()
