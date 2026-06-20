/**
 * Patch known KCET source JSON gaps using verified public references (Eneutron, BYJU'S).
 * Writes updated files to C:/Users/rentk/Downloads/KCET/KCET/
 *
 *   npx tsx scripts/patch-kcet-source-gaps.ts
 */

import fs from "node:fs";
import path from "node:path";

const dir = "C:/Users/rentk/Downloads/KCET/KCET";

type ExamJson = {
  totalQuestions?: number;
  questions?: Array<Record<string, unknown>>;
};

function load(name: string): ExamJson {
  return JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as ExamJson;
}

function save(name: string, data: ExamJson): void {
  fs.writeFileSync(path.join(dir, name), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function patch2011Q6866(): boolean {
  const file = "KCET-Previous-Question-Paper-KCET-2011.json";
  const data = load(file);
  const q = data.questions?.find((row) => String(row.questionId) === "6866");
  if (!q) {
    console.warn("2011 Q6866 not found");
    return false;
  }
  const html = String(q.questionText ?? "");
  if (html.includes("(1) 0.0693")) {
    console.log("2011 Q6866 already patched");
    return true;
  }
  const optionsBlock =
    "<p><strong>(1) 0.0693</strong></p>\r\n\r\n" +
    "<p><strong>(2) 69.3</strong></p>\r\n\r\n" +
    "<p><strong>(3) 6.93</strong></p>\r\n\r\n" +
    "<p><strong>(4) 6.93 × 10<sup>-4</sup></strong></p>\r\n";
  q.questionText = html.replace(/\s*<p>&nbsp;<\/p>\s*$/i, `\r\n\r\n${optionsBlock}`);
  save(file, data);
  console.log("Patched 2011 Q6866 with MCQ options (source: Eneutron KCET 2011 Chemistry Q31)");
  return true;
}

function patch2015Q126(): boolean {
  const file = "KCET-Previous-Question-Paper-KCET-2015.json";
  const data = load(file);
  const questions = data.questions ?? [];
  if (questions.some((q) => String(q.questionNumber) === "126")) {
    console.log("2015 Q126 already present");
    return true;
  }
  const idx125 = questions.findIndex((q) => String(q.questionNumber) === "125");
  if (idx125 < 0) {
    console.warn("2015 Q125 anchor not found");
    return false;
  }
  const template = { ...questions[idx125]! };
  const q126: Record<string, unknown> = {
    ...template,
    questionId: "7734",
    questionNumber: "126",
    set_question_number: "6",
    answer: "1",
    optionId: "1",
    fk_optionId: "1",
    questionText:
      "<p><strong>The ratio of angular speed of a second-hand to the hour-hand of a watch is </strong></p>\r\n\r\n" +
      "<p><strong>(1) 720 : 1 </strong></p>\r\n\r\n" +
      "<p><strong>(2) 60 : 1</strong></p>\r\n\r\n" +
      "<p><strong>(3) 3600 : 1 </strong></p>\r\n\r\n" +
      "<p><strong>(4) 72 : 1 </strong></p>\r\n",
    solutionText:
      "<p><strong>Angular speed of second-hand = <span class=\"math-tex\">\\(2\\pi/60\\)</span>; hour-hand = <span class=\"math-tex\">\\(2\\pi/(12\\times3600)\\)</span>. Ratio = 720 : 1.</strong></p>\r\n",
    topicName: "Rotational Motion",
    chapterName: "Rotational Motion",
    eqCommentId: "1251",
  };
  questions.splice(idx125 + 1, 0, q126);
  data.questions = questions;
  data.totalQuestions = questions.length;
  save(file, data);
  console.log("Inserted 2015 Q126 (source: BYJU'S KCET 2015 Physics Q6)");
  return true;
}

function report2005(): void {
  const data = load("KCET-Previous-Question-Paper-KCET-2005.json");
  const n = data.questions?.length ?? 0;
  console.warn(
    `KCET 2005 still ${n}/180 in source JSON — needs full Testbee export overwrite (examSetId 342 is truncated).`
  );
}

function main(): void {
  patch2011Q6866();
  patch2015Q126();
  report2005();
}

main();
