"""
Parse Key Outcomes DOCX text → MCQ JSON per curriculum subtopic.
Writes Web/tmp-outcomes-parsed.json for seeding.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

TEXT = Path(r"C:\Users\rentk\Desktop\Edublast\Web\tmp-outcomes.txt").read_text(encoding="utf-8")

# Short doc title → keyword used to match curriculum subtopic_name (most specific first)
DOC_TO_KEY = [
    ("Types of Charges", "Types of charges"),
    ("Quantization of Charge", "Quantization of charge"),
    ("Conservation of Charge", "Conservation of charge"),
    ("Additivity of Charges", "Additivity of charges"),
    ("Methods of Charging", "Methods of charging"),
    ("Vector Form of Coulomb", "Vector form"),
    ("Coulomb's Force Formula", "Force F = k"),
    ("Coulomb", "Force F = k"),
    ("Superposition Principle", "Superposition principle"),
    ("Continuous Charge Distribution", "Continuous charge distribution"),
    ("Electric Field Due to a Point Charge", "Field due to a point charge"),
    ("Electric Field Lines", "Electric field lines"),
    ("Electric Field Definition", "Electric field E = F"),
    ("Dipole Field on Axial", "Field on axial line"),
    ("Torque and Potential Energy", "Torque on dipole"),
    ("Electric Dipole", "Electric dipole: pair"),
    ("Electric Flux", "Electric flux"),
    ("Gauss", "Gauss's Theorem"),
    ("Infinite Straight Charged Wire", "Infinite straight wire"),
    ("Infinite Plane Sheet of Charge", "Infinite plane sheet"),
    ("Charged Spherical Shell", "Charged spherical shell"),
]

# Prefixes used to match curriculum subtopic_name (ilike key%)
MATCH_PREFIX = {
    "Types of charges": "Types of charges",
    "Quantization of charge": "Quantization of charge",
    "Conservation of charge": "Conservation of charge",
    "Additivity of charges": "Additivity of charges",
    "Methods of charging": "Methods of charging",
    "Force F = k": "Force F = k",
    "Vector form": "Vector form",
    "Superposition principle": "Superposition principle",
    "Continuous charge distribution": "Continuous charge distribution",
    "Electric field E = F": "Electric field E = F",
    "Field due to a point charge": "Field due to a point charge",
    "Electric field lines": "Electric field lines",
    "Electric dipole: pair": "Electric dipole: pair",
    "Field on axial line": "Field on axial line",
    "Torque on dipole": "Torque on dipole",
    "Electric flux": "Electric flux",
    "Gauss's Theorem": "Gauss's Theorem",
    # Curriculum names are "Application N - …"
    "Infinite straight wire": "Application 1 - Infinite straight wire",
    "Infinite plane sheet": "Application 2 - Infinite plane sheet",
    "Charged spherical shell": "Application 3 - Charged spherical shell",
}

TOPIC_MAP = {
    "Types of charges": "Electric Charge & Properties",
    "Quantization of charge": "Electric Charge & Properties",
    "Conservation of charge": "Electric Charge & Properties",
    "Additivity of charges": "Electric Charge & Properties",
    "Methods of charging": "Electric Charge & Properties",
    "Force F = k": "Coulomb's Law",
    "Vector form": "Coulomb's Law",
    "Superposition principle": "Coulomb's Law",
    "Continuous charge distribution": "Coulomb's Law",
    "Electric field E = F": "Electric Field",
    "Field due to a point charge": "Electric Field",
    "Electric field lines": "Electric Field",
    "Electric dipole: pair": "Electric Field",
    "Field on axial line": "Electric Field",
    "Torque on dipole": "Electric Field",
    "Electric flux": "Gauss's Law & Applications",
    "Gauss's Theorem": "Gauss's Law & Applications",
    "Infinite straight wire": "Gauss's Law & Applications",
    "Infinite plane sheet": "Gauss's Law & Applications",
    "Charged spherical shell": "Gauss's Law & Applications",
}


def split_options(line: str) -> list[str]:
    parts = re.split(r"(?=[A-D]\.\s)", line.strip())
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
    # Find answer key
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
        # Accumulate stem lines until options (A. ...) appear
        while i < len(body) and not re.match(r"^A\.\s", body[i]) and not re.match(r"^\d+\.\s", body[i]):
            q_parts.append(body[i])
            i += 1
        qtext = " ".join(q_parts).strip()
        opts: list[str] = []
        if re.search(r"\sA\.\s|^A\.\s", qtext):
            am = re.search(r"(?:^|\s)A\.\s", qtext)
            if am:
                opts = split_options(qtext[am.start() :].lstrip())
                qtext = qtext[: am.start()].strip()
        if not opts and i < len(body) and re.match(r"^A\.\s", body[i]):
            opts = split_options(body[i])
            i += 1
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


def main():
    # Split by Subtopic headers
    parts = re.split(r"(?=^Subtopic\s+\d+\.\d+:)", TEXT, flags=re.M)
    parsed = []
    for part in parts:
        m = re.match(r"^Subtopic\s+\d+\.\d+:\s*(.+)$", part.strip(), re.M)
        if not m:
            continue
        short = m.group(1).strip()
        # normalize fancy apostrophe
        short_norm = short.replace("\u2019", "'").replace("\u2018", "'")
        key = None
        for doc_title, k in DOC_TO_KEY:
            if doc_title.lower() in short_norm.lower():
                key = k
                break
        if key is None:
            key = short_norm.split(":")[0].strip()
        qs = parse_subtopic_block(part)
        topic = TOPIC_MAP.get(key, "Electric Charge & Properties")
        match_prefix = MATCH_PREFIX.get(key, key)
        parsed.append(
            {
                "docTitle": short_norm,
                "matchKey": match_prefix,
                "topic": topic,
                "questions": qs,
                "count": len(qs),
            }
        )

    out = Path(r"C:\Users\rentk\Desktop\Edublast\Web\tmp-outcomes-parsed.json")
    out.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", out)
    for p in parsed:
        print(f"{p['count']:2d}  {p['matchKey']}  |  {p['docTitle']}")


if __name__ == "__main__":
    main()
