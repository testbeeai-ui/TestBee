import sys
from pathlib import Path

for rel in sys.argv[1:]:
    p = Path(rel)
    t = p.read_text(encoding="utf-8")
    t = t.replace("<" + "motion.div", "<" + "div")
    t = t.replace("</" + "motion.div>", "</" + "div>")
    p.write_text(t, encoding="utf-8")
    print("fixed", rel)
