"""
Parse Magnetism and Matter Learning Outcomes DOCX text
→ MCQ JSON per curriculum subtopic.

Writes Web/tmp-mm-outcomes-parsed.json for seeding.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

TEXT = Path(r"C:\Users\rentk\Desktop\Edublast\Web\tmp-mm-lo.txt").read_text(encoding="utf-8")

DOC_TO_KEY = [
    ("Bar Magnet as an Equivalent Solenoid", "Bar magnet as equivalent solenoid"),
    ("Axial Magnetic Field of a Dipole", "Field on axial position"),
    ("Equatorial Magnetic Field of a Dipole", "Field on equatorial position"),
    ("Torque on a Bar Magnet", "Torque on bar magnet"),
    ("Magnetic-Field Lines", "Magnetic field lines"),
    ("Magnetic Field Lines", "Magnetic field lines"),
    ("Diamagnetic Materials", "Diamagnetic"),
    ("Paramagnetic Materials", "Paramagnetic"),
    ("Ferromagnetic Materials", "Ferromagnetic"),
    ("Curie", "Curie's law"),  # Curie's Law — refined below
    ("Curie Temperature", "Curie temperature"),
]

# More specific Curie mapping handled after DOC_TO_KEY scan
DOC_TO_KEY_ORDERED = [
    ("Curie Temperature", "Curie temperature"),
    ("Curie's Law", "Curie's law"),
    ("Curies Law", "Curie's law"),
    ("Bar Magnet as an Equivalent Solenoid", "Bar magnet as equivalent solenoid"),
    ("Axial Magnetic Field of a Dipole", "Field on axial position"),
    ("Equatorial Magnetic Field of a Dipole", "Field on equatorial position"),
    ("Torque on a Bar Magnet", "Torque on bar magnet"),
    ("Magnetic-Field Lines", "Magnetic field lines"),
    ("Magnetic Field Lines", "Magnetic field lines"),
    ("Diamagnetic Materials", "Diamagnetic"),
    ("Paramagnetic Materials", "Paramagnetic"),
    ("Ferromagnetic Materials", "Ferromagnetic"),
]

MATCH_PREFIX = {
    "Bar magnet as equivalent solenoid": "Bar magnet as equivalent solenoid",
    "Field on axial position": "Field on axial position",
    "Field on equatorial position": "Field on equatorial position",
    "Torque on bar magnet": "Torque on bar magnet",
    "Magnetic field lines": "Magnetic field lines",
    "Diamagnetic": "Diamagnetic",
    "Paramagnetic": "Paramagnetic",
    "Ferromagnetic": "Ferromagnetic",
    "Curie's law": "Curie's law",
    "Curie temperature": "Curie temperature",
}

TOPIC_MAP = {
    "Bar magnet as equivalent solenoid": "Magnetic Dipole",
    "Field on axial position": "Magnetic Dipole",
    "Field on equatorial position": "Magnetic Dipole",
    "Torque on bar magnet": "Magnetic Dipole",
    "Magnetic field lines": "Magnetic Dipole",
    "Diamagnetic": "Magnetic Properties of Materials",
    "Paramagnetic": "Magnetic Properties of Materials",
    "Ferromagnetic": "Magnetic Properties of Materials",
    "Curie's law": "Magnetic Properties of Materials",
    "Curie temperature": "Magnetic Properties of Materials",
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
    # Curie's Law with curly apostrophe / encoding glitches
    if re.search(r"curie.?s?\s*law", short_norm, re.I):
        return "Curie's law"
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

    out = Path(r"C:\Users\rentk\Desktop\Edublast\Web\tmp-mm-outcomes-parsed.json")
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
