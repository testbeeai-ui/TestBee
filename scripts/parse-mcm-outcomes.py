"""
Parse Moving Charges and Magnetism Learning Outcomes DOCX text
→ MCQ JSON per curriculum subtopic.

Writes Web/tmp-mcm-outcomes-parsed.json for seeding.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

TEXT = Path(r"C:\Users\rentk\Desktop\Edublast\Web\tmp-mcm-lo.txt").read_text(encoding="utf-8")

DOC_TO_KEY_ORDERED = [
    ("Conversion of a Galvanometer into a Voltmeter", "Conversion to voltmeter"),
    ("Conversion of a Galvanometer into an Ammeter", "Conversion to ammeter"),
    ("Moving-Coil Galvanometer and Current Sensitivity", "Moving coil galvanometer"),
    ("Moving Coil Galvanometer and Current Sensitivity", "Moving coil galvanometer"),
    ("Current Loop as a Magnetic Dipole", "Current loop as magnetic dipole"),
    ("Torque on a Current Loop", "Torque on a current loop"),
    ("Traditional Textbook Definition of the Ampere", "Definition of Ampere"),
    ("Direction of Force", "Parallel currents attract"),
    ("Magnitude of Force Between Parallel Conductors", "Force per unit length"),
    ("Magnetic Field Inside a Long Solenoid", "Field inside a long solenoid"),
    ("Field Due to an Infinitely Long Straight Wire", "Field due to infinitely long straight wire"),
    ("Ampere", "B.dl = mu_0"),  # Ampere's Circuital Law
    ("Magnetic Field Due to a Finite Straight Wire", "Field due to finite straight wire"),
    ("Magnetic Field at the Centre of a Circular Loop", "Field at centre of circular loop"),
    ("Biot", "dB = mu_0"),  # Biot-Savart Law
    ("Force on a Current-Carrying Conductor", "Force on current-carrying conductor"),
    ("Circular Motion of a Charged Particle", "Circular motion in B"),
    ("Lorentz Force on a Moving Charge", "Lorentz force"),
]

MATCH_PREFIX = {
    "Lorentz force": "Lorentz force",
    "Circular motion in B": "Circular motion in B",
    "Force on current-carrying conductor": "Force on current-carrying conductor",
    "dB = mu_0": "dB = mu_0",
    "Field at centre of circular loop": "Field at centre of circular loop",
    "Field due to finite straight wire": "Field due to finite straight wire",
    "B.dl = mu_0": "B.dl = mu_0",
    "Field due to infinitely long straight wire": "Field due to infinitely long straight wire",
    "Field inside a long solenoid": "Field inside a long solenoid",
    "Force per unit length": "Force per unit length",
    "Parallel currents attract": "Parallel currents attract",
    "Definition of Ampere": "Definition of Ampere",
    "Torque on a current loop": "Torque on a current loop",
    "Current loop as magnetic dipole": "Current loop as magnetic dipole",
    "Moving coil galvanometer": "Moving coil galvanometer",
    "Conversion to ammeter": "Conversion to ammeter",
    "Conversion to voltmeter": "Conversion to voltmeter",
}

TOPIC_MAP = {
    "Lorentz force": "Magnetic Force",
    "Circular motion in B": "Magnetic Force",
    "Force on current-carrying conductor": "Magnetic Force",
    "dB = mu_0": "Biot-Savart Law",
    "Field at centre of circular loop": "Biot-Savart Law",
    "Field due to finite straight wire": "Biot-Savart Law",
    "B.dl = mu_0": "Ampere's Circuital Law",
    "Field due to infinitely long straight wire": "Ampere's Circuital Law",
    "Field inside a long solenoid": "Ampere's Circuital Law",
    "Force per unit length": "Force Between Conductors",
    "Parallel currents attract": "Force Between Conductors",
    "Definition of Ampere": "Force Between Conductors",
    "Torque on a current loop": "Torque, Galvanometer & Conversions",
    "Current loop as magnetic dipole": "Torque, Galvanometer & Conversions",
    "Moving coil galvanometer": "Torque, Galvanometer & Conversions",
    "Conversion to ammeter": "Torque, Galvanometer & Conversions",
    "Conversion to voltmeter": "Torque, Galvanometer & Conversions",
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
    if re.search(r"ampere.?s?\s*circuital", short_norm, re.I):
        return "B.dl = mu_0"
    if re.search(r"biot.?savart", short_norm, re.I):
        return "dB = mu_0"
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

    out = Path(r"C:\Users\rentk\Desktop\Edublast\Web\tmp-mcm-outcomes-parsed.json")
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
