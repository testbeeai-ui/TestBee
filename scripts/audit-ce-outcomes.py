"""Audit Current Electricity parsed Learning Outcomes."""
from __future__ import annotations

import json
import re
from pathlib import Path

text = Path("tmp-ce-lo.txt").read_text(encoding="utf-8")
parsed = json.loads(Path("tmp-ce-outcomes-parsed.json").read_text(encoding="utf-8"))

print("SOURCE subtopics", len(re.findall(r"(?m)^Subtopic\s+\d+\.\d+:", text)))
print("PARSED blocks", len(parsed), "total", sum(p["count"] for p in parsed))

issues: list[str] = []
for p in parsed:
    if p["count"] != 10:
        issues.append(f"count {p['count']} {p['docTitle']}")
    for i, q in enumerate(p["questions"], 1):
        if len(q["options"]) != 4:
            issues.append(f"opts {p['docTitle']} #{i} got {len(q['options'])}")
        if q["correctAnswer"] not in q["options"]:
            issues.append(f"bad ans {p['docTitle']} #{i}")
        if not (q.get("question") or "").strip():
            issues.append(f"empty stem {p['docTitle']} #{i}")

print("structural issues", len(issues))
for x in issues[:30]:
    print(" -", x)

src_ak: list[list[str]] = []
for part in re.split(r"(?m)^Answer Key\s*$", text)[1:]:
    letters: list[str] = []
    for ln in part.splitlines():
        s = ln.strip()
        if re.match(r"^Subtopic\s+\d+\.\d+:", s) or re.match(r"^TOPIC\s+\d+", s):
            break
        if re.fullmatch(r"[A-Da-d]", s):
            letters.append(s.upper())
    src_ak.append(letters)

mm = 0
for bi, p in enumerate(parsed):
    letters = src_ak[bi] if bi < len(src_ak) else []
    if len(letters) != len(p["questions"]):
        print("KEY LEN", bi, len(letters), len(p["questions"]), p["docTitle"])
        mm += 1
        continue
    for qi, q in enumerate(p["questions"]):
        idx = ord(letters[qi]) - ord("A")
        if q["options"][idx] != q["correctAnswer"]:
            print("MISMATCH", p["docTitle"], qi + 1, letters[qi], q["correctAnswer"])
            mm += 1
print("letter mismatches", mm)
