import fs from "node:fs";
import path from "node:path";

const dir = "C:/Users/rentk/Downloads/KCET/KCET";

type JsonQuestion = Record<string, unknown>;

function subjectCounts(questions: JsonQuestion[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const q of questions) {
    const s = String(q.subjectName ?? "unknown").trim().toLowerCase() || "unknown";
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return counts;
}

function hasParseableOptions(html: string): boolean {
  const h = html.trim();
  if (!h) return false;
  return (
    /\(\s*[A-Da-d]\s*\.?\s*\)/.test(h) ||
    /\(\s*[1-4]\s*\.?\s*\)/.test(h) ||
    /(?<!\()\b[1-4]\s*\)/.test(h) ||
    (h.includes("<img") && !/\(\s*[1-4]\s*\.?\s*\)/.test(h))
  );
}

for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as {
    totalQuestions?: number;
    questions?: JsonQuestion[];
  };
  const questions = j.questions ?? [];
  console.log(
    f.padEnd(45),
    "totalQuestions=",
    j.totalQuestions,
    "questions.length=",
    questions.length
  );

  if (f.includes("2005") || f.includes("2015") || f.includes("2011")) {
    console.log("  subjects:", subjectCounts(questions));
  }
}

const j2011 = JSON.parse(
  fs.readFileSync(path.join(dir, "KCET-Previous-Question-Paper-KCET-2011.json"), "utf8")
) as { questions?: JsonQuestion[] };
const q6866 = j2011.questions?.find((q) => String(q.questionId) === "6866");
if (q6866) {
  const html = String(q6866.questionText ?? "");
  console.log("\n2011 Q6866 parseable options:", hasParseableOptions(html));
  console.log("2011 Q6866 html length:", html.length);
} else {
  console.log("\n2011 Q6866: NOT FOUND");
}
