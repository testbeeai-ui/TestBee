from pathlib import Path

OLD_OPEN = "<" + "motion" + ".div"
NEW_OPEN = "<" + "div"
OLD_CLOSE = "</" + "motion" + ".div>"
NEW_CLOSE = "</" + "div>"

for rel in ("app/mock/page.tsx", "app/mock-test/page.tsx"):
    p = Path(rel)
    if not p.exists():
        continue
    t = p.read_text(encoding="utf-8")
    t = t.replace(OLD_OPEN, NEW_OPEN).replace(OLD_CLOSE, NEW_CLOSE)
    p.write_text(t, encoding="utf-8")
    print("fixed", rel)
