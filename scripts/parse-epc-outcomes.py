"""
Parse Electrostatic Potential and Capacitance Learning Outcomes DOCX text
→ MCQ JSON per curriculum subtopic.

Writes Web/tmp-epc-outcomes-parsed.json for seeding.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

TEXT = Path(r"C:\Users\rentk\Desktop\Edublast\Web\tmp-epc-lo.txt").read_text(encoding="utf-8")

# Doc subtopic title fragment → internal key (most specific first)
DOC_TO_KEY = [
    ("Potential Due to an Electric Dipole", "Potential due to dipole"),
    ("Relation Between Electric Field and Potential", "Relation between E and V"),
    ("Equipotential Surfaces", "Equipotential surface"),
    ("Potential Difference", "Potential difference"),
    ("Electric Potential", "Potential V = W/q_0"),
    ("Potential Energy of a Dipole", "PE of a dipole"),
    ("Potential Energy of Two Point Charges", "PE of two point charges"),
    ("Work Done in Assembling", "Work done in assembling"),
    ("Conductors in Electrostatic Equilibrium", "Conductor in equilibrium"),
    ("Parallel-Plate Capacitor", "Parallel plate capacitor"),
    ("Capacitors in Series", "Series combination"),
    ("Capacitors in Parallel", "Parallel combination"),
    ("Energy Stored in a Capacitor", "Energy stored"),
    ("Capacitance", "Capacitance C = Q/V"),
    ("Polarization and Dielectric Constant", "Electric polarization P"),
    ("Dielectrics", "Dielectric: non-conductor"),
]

MATCH_PREFIX = {
    "Potential V = W/q_0": "Potential V = W/q_0",
    "Potential difference": "Potential difference",
    "Potential due to dipole": "Potential due to dipole",
    "Equipotential surface": "Equipotential surface",
    "Relation between E and V": "Relation between E and V",
    "PE of two point charges": "PE of two point charges",
    "PE of a dipole": "PE of a dipole",
    "Work done in assembling": "Work done in assembling",
    "Conductor in equilibrium": "Conductor in equilibrium",
    "Dielectric: non-conductor": "Dielectric: non-conductor",
    "Electric polarization P": "Electric polarization P",
    "Capacitance C = Q/V": "Capacitance C = Q/V",
    "Parallel plate capacitor": "Parallel plate capacitor",
    "Series combination": "Series combination",
    "Parallel combination": "Parallel combination",
    "Energy stored": "Energy stored",
}

TOPIC_MAP = {
    "Potential V = W/q_0": "Electric Potential",
    "Potential difference": "Electric Potential",
    "Potential due to dipole": "Electric Potential",
    "Equipotential surface": "Electric Potential",
    "Relation between E and V": "Electric Potential",
    "PE of two point charges": "Potential Energy",
    "PE of a dipole": "Potential Energy",
    "Work done in assembling": "Potential Energy",
    "Conductor in equilibrium": "Conductors and Dielectrics",
    "Dielectric: non-conductor": "Conductors and Dielectrics",
    "Electric polarization P": "Conductors and Dielectrics",
    "Capacitance C = Q/V": "Capacitors",
    "Parallel plate capacitor": "Capacitors",
    "Series combination": "Capacitors",
    "Parallel combination": "Capacitors",
    "Energy stored": "Capacitors",
}


def split_options(line: str) -> list[str]:
    # DOCX often glues options: "0.5 μCB. 1.0 μC" — split on A./B./C./D. without requiring a space before.
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
        # Prefer a dedicated options line — stems can contain "to A." which false-triggers inline A.
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
        key = None
        for doc_title, k in DOC_TO_KEY:
            if doc_title.lower() in short_norm.lower():
                key = k
                break
        if key is None:
            raise SystemExit(f"Unmapped subtopic: {short_norm!r}")
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

    out = Path(r"C:\Users\rentk\Desktop\Edublast\Web\tmp-epc-outcomes-parsed.json")
    out.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", out)
    total = 0
    for p in parsed:
        total += p["count"]
        flag = "" if p["count"] == 10 else " << CHECK"
        print(f"{p['count']:2d}  {p['topic']:28s} | {p['matchKey'][:40]:40s} | {p['docTitle']}{flag}")
    print(f"blocks={len(parsed)} totalQs={total}")


if __name__ == "__main__":
    main()
