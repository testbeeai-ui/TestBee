import zipfile
import re

z = zipfile.ZipFile(r"C:\Users\rentk\Downloads\Key Outomes for Electric Charges and Fields.docx")
xml = z.read("word/document.xml").decode("utf-8")
paras = []
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

out = r"C:\Users\rentk\Desktop\Edublast\Web\tmp-outcomes.txt"
with open(out, "w", encoding="utf-8") as f:
    f.write("\n".join(paras))
print("paras", len(paras))
print("written", out)
