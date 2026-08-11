import re
import zipfile
from pathlib import Path

DOCX = Path(
    r"C:\Users\rentk\Downloads\Learning Outcomes Class 12 Physics Electromagnetic Waves.docx"
)
OUT = Path(r"C:\Users\rentk\Desktop\Edublast\Web\tmp-emw-lo.txt")

z = zipfile.ZipFile(DOCX)
xml = z.read("word/document.xml").decode("utf-8")
paras: list[str] = []
for p in re.findall(r"<w:p[\s\S]*?</w:p>", xml):
    texts = re.findall(r"<w:t[^>]*>(.*?)</w:t>", p)
    if texts:
        line = "".join(texts)
        line = (
            line.replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", '"')
        )
        paras.append(line)

OUT.write_text("\n".join(paras), encoding="utf-8")
print("paras", len(paras), "written", OUT)
for i, line in enumerate(paras):
    if re.match(r"^Subtopic\s+\d+\.\d+:", line) or line.strip().lower() == "answer key":
        print(f"{i:4d}  {line[:160]}")
    elif i > 0 and paras[i - 1].strip().lower() == "answer key":
        print(f"{i:4d}  KEY: {line[:80]!r}")
