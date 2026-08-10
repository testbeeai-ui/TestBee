import re
import zipfile
from pathlib import Path

FILES = [
    (
        Path(r"C:\Users\rentk\Downloads\Learning Outcomes of Class 12 Maths Inverse Trigonometric Functons.docx"),
        Path(r"C:\Users\rentk\Desktop\Edublast\Web\tmp-itf-lo.txt"),
    ),
    (
        Path(r"C:\Users\rentk\Downloads\Learning Outcomes Class 12 Maths Matrices.docx"),
        Path(r"C:\Users\rentk\Desktop\Edublast\Web\tmp-matrices-lo.txt"),
    ),
]

for docx, out in FILES:
    z = zipfile.ZipFile(docx)
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
    out.write_text("\n".join(paras), encoding="utf-8")
    print("\n===", docx.name, "paras", len(paras), "===")
    for i, line in enumerate(paras):
        low = line.strip().lower()
        if (
            re.match(r"^Subtopic\s+\d+", line, re.I)
            or re.match(r"^Topic\s+\d+", line, re.I)
            or low == "answer key"
            or low.startswith("chapter")
        ):
            safe = line[:180].encode("ascii", "replace").decode("ascii")
            print(f"{i:4d}  {safe}")
