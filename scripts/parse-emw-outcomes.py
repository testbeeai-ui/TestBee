"""
Parse Class 12 Physics Electromagnetic Waves Learning Outcomes DOCX text
→ MCQ JSON per curriculum subtopic.

Writes Web/tmp-emw-outcomes-parsed.json for seeding.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

TEXT = Path(r"C:\Users\rentk\Desktop\Edublast\Web\tmp-emw-lo.txt").read_text(encoding="utf-8")

# Most specific first (doc title fragment → matchKey)
DOC_TO_KEY = [
    ("Need for Displacement Current", "Need for displacement current"),
    ("Displacement Current Formula", "Displacement current I_d"),
    ("Generalised Ampere", "Generalised Ampere's law"),
    ("Transverse Nature", "E and B are perpendicular"),
    ("Speed of Electromagnetic Waves in a Medium", "Speed in medium"),
    ("Speed of Electromagnetic Waves in Vacuum", "Speed in vacuum"),
    ("Relationship Between Electric and Magnetic Amplitudes", "E_0/B_0 = c"),
    ("Energy, Poynting Vector and Momentum", "EM waves carry energy"),
    ("Radio Waves", "Radio waves"),
    ("Microwaves", "Microwaves"),
    ("Infrared Radiation", "Infrared"),
    ("Visible Light", "Visible"),
    ("Ultraviolet Radiation", "Ultraviolet"),
    ("X-Rays", "X-rays"),
    ("Gamma Rays", "Gamma rays"),
]

MATCH_PREFIX = {
    "Need for displacement current": "Need for displacement current",
    "Displacement current I_d": "Displacement current I_d",
    "Generalised Ampere's law": "Generalised Ampere's law",
    "E and B are perpendicular": "E and B are perpendicular",
    "Speed in vacuum": "Speed in vacuum",
    "Speed in medium": "Speed in medium",
    "E_0/B_0 = c": "E_0/B_0 = c",
    "EM waves carry energy": "EM waves carry energy",
    "Radio waves": "Radio waves",
    "Microwaves": "Microwaves",
    "Infrared": "Infrared",
    "Visible": "Visible",
    "Ultraviolet": "Ultraviolet",
    "X-rays": "X-rays",
    "Gamma rays": "Gamma rays",
}

TOPIC_MAP = {
    "Need for displacement current": "Displacement Current",
    "Displacement current I_d": "Displacement Current",
    "Generalised Ampere's law": "Displacement Current",
    "E and B are perpendicular": "Properties of EM Waves",
    "Speed in vacuum": "Properties of EM Waves",
    "Speed in medium": "Properties of EM Waves",
    "E_0/B_0 = c": "Properties of EM Waves",
    "EM waves carry energy": "Properties of EM Waves",
    "Radio waves": "Electromagnetic Spectrum",
    "Microwaves": "Electromagnetic Spectrum",
    "Infrared": "Electromagnetic Spectrum",
    "Visible": "Electromagnetic Spectrum",
    "Ultraviolet": "Electromagnetic Spectrum",
    "X-rays": "Electromagnetic Spectrum",
    "Gamma rays": "Electromagnetic Spectrum",
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

    out = Path(r"C:\Users\rentk\Desktop\Edublast\Web\tmp-emw-outcomes-parsed.json")
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
