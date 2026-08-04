from pathlib import Path
import re

text = Path(r"C:\Users\rentk\Desktop\Edublast\Web\tmp-outcomes.txt").read_text(encoding="utf-8")
lines = text.splitlines()

# Find subtopic headers
subs = []
for i, line in enumerate(lines):
    if re.match(r"^Subtopic\s+\d+\.\d+:", line):
        subs.append((i, line))

print("subtopics", len(subs))
for i, line in subs:
    print(f"{i:4d}  {line}")
