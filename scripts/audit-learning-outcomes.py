"""Audit DOCX extract vs parsed JSON vs expected 20x10."""
from __future__ import annotations

import json
import re
from pathlib import Path

text = Path("tmp-outcomes.txt").read_text(encoding="utf-8")
parsed = json.loads(Path("tmp-outcomes-parsed.json").read_text(encoding="utf-8"))

blocks = re.findall(r"(?m)^Subtopic\s+\d+\.\d+:\s*(.+)$", text)
print("SOURCE subtopics:", len(blocks))

# Answer-key lengths per block
ans_counts = []
for part in re.split(r"(?m)^Answer Key\s*$", text)[1:]:
    lines = []
    for ln in part.splitlines():
        s = ln.strip()
        if re.match(r"^Subtopic\s+\d+\.\d+:", s) or re.match(r"^TOPIC\s+\d+", s):
            break
        if re.fullmatch(r"[A-Da-d]", s):
            lines.append(s.upper())
    ans_counts.append(len(lines))
print("SOURCE answer-key counts:", ans_counts)
print("SOURCE answer-key sum:", sum(ans_counts), "blocks:", len(ans_counts))

# Per-subtopic numbered question counts from source
src_parts = re.split(r"(?=^Subtopic\s+\d+\.\d+:)", text, flags=re.M)
src_q_counts = []
for part in src_parts:
    m = re.match(r"^Subtopic\s+\d+\.\d+:\s*(.+)$", part.strip(), re.M)
    if not m:
        continue
    body = part
    key_m = re.search(r"(?m)^Answer Key\s*$", body)
    if key_m:
        body = body[: key_m.start()]
    nums = [int(x) for x in re.findall(r"(?m)^(\d+)\.\s+", body)]
    src_q_counts.append((m.group(1).strip()[:50], nums, len(nums), nums == list(range(1, len(nums) + 1))))

print("\nSOURCE per-subtopic question numbers:")
missing_nums = []
for title, nums, n, sequential in src_q_counts:
    flag = "" if n == 10 and sequential else " << CHECK"
    print(f"  {n:2d} seq={sequential}  {title}{flag}")
    if n != 10 or not sequential:
        missing_nums.append((title, nums))

print("\nPARSED blocks:", len(parsed), "total Qs:", sum(p["count"] for p in parsed))
issues = []
for p in parsed:
    qs = p["questions"]
    if p["count"] != 10:
        issues.append(f"count!=10: {p['docTitle']} -> {p['count']}")
    if len(qs) != p["count"]:
        issues.append(f"len mismatch: {p['docTitle']}")
    for i, q in enumerate(qs, 1):
        if not (q.get("question") or "").strip():
            issues.append(f"empty stem {p['docTitle']} #{i}")
        opts = q.get("options") or []
        if len(opts) != 4:
            issues.append(f"opts!=4 {p['docTitle']} #{i} got {len(opts)}: {opts}")
        ca = q.get("correctAnswer")
        if not ca or ca not in opts:
            issues.append(f"bad correct {p['docTitle']} #{i} ans={ca!r}")
        if len(set(opts)) < len(opts):
            issues.append(f"dup opts {p['docTitle']} #{i}")

# Compare source answer letters to parsed correctAnswer index
print("\nAnswer-key letter check (source vs parsed):")
letter_mismatches = 0
src_ak = []
for part in re.split(r"(?m)^Answer Key\s*$", text)[1:]:
    letters = []
    for ln in part.splitlines():
        s = ln.strip()
        if re.match(r"^Subtopic\s+\d+\.\d+:", s) or re.match(r"^TOPIC\s+\d+", s):
            break
        if re.fullmatch(r"[A-Da-d]", s):
            letters.append(s.upper())
    src_ak.append(letters)

for bi, p in enumerate(parsed):
    letters = src_ak[bi] if bi < len(src_ak) else []
    if len(letters) != len(p["questions"]):
        print(f"  KEY LEN mismatch block {bi}: src={len(letters)} parsed={len(p['questions'])} {p['docTitle']}")
        letter_mismatches += 1
        continue
    for qi, q in enumerate(p["questions"]):
        expected = letters[qi]
        idx = ord(expected) - ord("A")
        opts = q["options"]
        if idx >= len(opts) or opts[idx] != q["correctAnswer"]:
            print(f"  MISMATCH {p['docTitle']} Q{qi+1}: key={expected} stored={q['correctAnswer']!r}")
            letter_mismatches += 1

print("PARSE structural issues:", len(issues))
for x in issues[:40]:
    print(" -", x)
print("Answer letter mismatches:", letter_mismatches)
print("Source missing/odd numbering blocks:", len(missing_nums))
print(
    "VERDICT:",
    "OK"
    if not issues and letter_mismatches == 0 and sum(ans_counts) == 200 and len(parsed) == 20
    else "NEEDS FIX",
)
