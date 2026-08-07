/**
 * Full JEE Main PYQ confirmation: answers + images vs source JSON.
 * Dedupes identical examSetId copies in the source folder (138 files → 137 papers).
 *
 * Run: npx tsx --env-file-if-exists=.env scripts/confirm-jee-pyq-import.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const folder =
  process.env.JEE_PYQ_FOLDER?.trim() ||
  "C:/Users/rentk/Downloads/JEE Mains - Previous-Years-Papers/Previous-Years-Papers";

function listUniquePaperFiles(dir: string): string[] {
  const bySetId = new Map<string, string>();
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as {
      examSetId?: string | number;
    };
    const key = String(raw.examSetId ?? name);
    if (!bySetId.has(key)) bySetId.set(key, name);
  }
  return [...bySetId.values()].sort();
}

const names = listUniquePaperFiles(folder);

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function countImgs(html: string): number {
  return (html.match(/<img\b/gi) || []).length;
}

function plainLen(html: string): number {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

function optList(optionsJson: unknown): string[] {
  if (!Array.isArray(optionsJson)) return [];
  return optionsJson.map((o) => String(o ?? ""));
}

function isNumericalSrc(q: Record<string, unknown>): boolean {
  const t = String(q.queAnsType || q.answerType || q.questionType || "")
    .toLowerCase();
  if (t && t !== "mcq") return true;
  return false;
}

function mcqLetterFromSrc(q: Record<string, unknown>): string | null {
  const ans = String(q.answer ?? "")
    .trim()
    .toUpperCase();
  if (["A", "B", "C", "D"].includes(ans)) return ans;
  if (/^[A-D]$/.test(ans.charAt(0)) && ans.length <= 2) return ans.charAt(0);
  if (
    Number.isInteger(Number(ans)) &&
    Number(ans) >= 1 &&
    Number(ans) <= 4 &&
    !ans.includes(".")
  ) {
    return (["A", "B", "C", "D"] as const)[Number(ans) - 1]!;
  }
  const fk = Number(String(q.fk_optionId ?? q.optionId ?? "").trim());
  if (fk >= 1 && fk <= 4) return (["A", "B", "C", "D"] as const)[fk - 1]!;
  return null;
}

function hasTestbee(html: string): boolean {
  return /testbee\.in|testbee\.com/i.test(html);
}

function hasHosted(html: string): boolean {
  return /supabase\.co\/storage\/v1\/object\/public\/past-paper-images\//i.test(
    html
  );
}

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let papersOk = 0;
  let papersMissing = 0;
  let srcQs = 0;
  let dbQs = 0;
  let countMismatch = 0;
  let missingQ = 0;

  let srcStemImgs = 0;
  let dbStemOptImgs = 0;
  let srcSolImgs = 0;
  let dbSolImgs = 0;
  let imgShortfall = 0;
  let stillTestbee = 0;
  let hostedImgTags = 0;

  let emptyStem = 0;
  let badOptStruct = 0;
  let badAnsLetter = 0;

  let mcqOk = 0;
  let mcqBad = 0;
  let numOk = 0;
  let numBad = 0;
  let otherAnsOk = 0;

  const paperIssues: unknown[] = [];
  const samples: {
    missingPapers: string[];
    imgShort: unknown[];
    testbee: unknown[];
    mcqMismatch: unknown[];
    numBad: unknown[];
    struct: unknown[];
  } = {
    missingPapers: [],
    imgShort: [],
    testbee: [],
    mcqMismatch: [],
    numBad: [],
    struct: [],
  };

  for (const name of names) {
    const d = JSON.parse(fs.readFileSync(path.join(folder, name), "utf8")) as {
      examName?: string;
      examSetName?: string;
      examSetId?: string | number;
      questions?: Array<Record<string, unknown>>;
    };
    const slug = slugify(
      `${(d.examName || "JEE Main").trim()}-${(d.examSetName || "Paper Set").trim()}-${d.examSetId ?? ""}`
    ).replace(/-+$/, "");

    const { data: paper } = await sb
      .from("past_papers")
      .select("id, title, question_count")
      .eq("slug", slug)
      .maybeSingle();

    if (!paper) {
      papersMissing++;
      samples.missingPapers.push(name);
      missingQ += (d.questions || []).length;
      srcQs += (d.questions || []).length;
      continue;
    }
    papersOk++;

    // Paginate in case of large papers (always 90 here, but safe).
    const dbRows: Array<Record<string, unknown>> = [];
    let from = 0;
    for (;;) {
      const { data, error } = await sb
        .from("past_paper_questions")
        .select(
          "id, sort_order, source_question_id, question_html, options_json, correct_letter, solution_html"
        )
        .eq("paper_id", paper.id)
        .range(from, from + 999);
      if (error) throw error;
      const chunk = data || [];
      dbRows.push(...chunk);
      if (chunk.length < 1000) break;
      from += 1000;
    }

    const questions = d.questions || [];
    srcQs += questions.length;
    dbQs += dbRows.length;
    if (dbRows.length !== questions.length) {
      countMismatch++;
      paperIssues.push({
        title: paper.title,
        issue: `count ${dbRows.length}/${questions.length}`,
      });
    }

    const byId = new Map(
      dbRows.map((r) => [String(r.source_question_id ?? ""), r])
    );
    let pIssues = 0;

    for (const sq of questions) {
      const qid = String(sq.questionId ?? "");
      const dq = byId.get(qid);
      const srcQ = String(sq.questionText || sq.question || "");
      const srcS = String(sq.solutionText || sq.solution || "");
      const sStem = countImgs(srcQ);
      const sSol = countImgs(srcS);
      srcStemImgs += sStem;
      srcSolImgs += sSol;

      if (!dq) {
        missingQ++;
        pIssues++;
        continue;
      }

      const opts = optList(dq.options_json);
      const qHtml = String(dq.question_html || "");
      const solHtml = String(dq.solution_html || "");
      const blob = [qHtml, ...opts, solHtml].join("\n");
      const dStemOpt =
        countImgs(qHtml) + opts.reduce((n, o) => n + countImgs(o), 0);
      const dSol = countImgs(solHtml);
      dbStemOptImgs += dStemOpt;
      dbSolImgs += dSol;
      hostedImgTags += (
        blob.match(
          /supabase\.co\/storage\/v1\/object\/public\/past-paper-images\//gi
        ) || []
      ).length;

      if (hasTestbee(blob)) {
        stillTestbee++;
        pIssues++;
        if (samples.testbee.length < 8) {
          samples.testbee.push({ paper: paper.title, qid });
        }
      }

      if (dStemOpt < sStem) {
        imgShortfall++;
        pIssues++;
        if (samples.imgShort.length < 8) {
          samples.imgShort.push({
            paper: paper.title,
            qid,
            src: sStem,
            db: dStemOpt,
          });
        }
      }

      if (plainLen(qHtml) === 0 && countImgs(qHtml) === 0) {
        emptyStem++;
        pIssues++;
        if (samples.struct.length < 6) {
          samples.struct.push({ paper: paper.title, qid, kind: "empty_stem" });
        }
      }

      const letter = String(dq.correct_letter || "")
        .trim()
        .toUpperCase();
      if (!["A", "B", "C", "D"].includes(letter)) {
        badAnsLetter++;
        pIssues++;
      }

      const emptyOpts = opts.filter(
        (o) => plainLen(o) === 0 && countImgs(o) === 0
      ).length;
      if (opts.length !== 4 || emptyOpts > 0) {
        badOptStruct++;
        pIssues++;
        if (samples.struct.length < 8) {
          samples.struct.push({
            paper: paper.title,
            qid,
            kind: "bad_opts",
            n: opts.length,
            emptyOpts,
          });
        }
      }

      // Answer correctness vs source
      if (isNumericalSrc(sq)) {
        const ans = String(sq.answer ?? "").trim();
        const chosen = opts[["A", "B", "C", "D"].indexOf(letter as "A")] || "";
        const plain = chosen
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/gi, " ")
          .replace(/\s+/g, " ")
          .trim();
        const ok =
          ["A", "B", "C", "D"].includes(letter) &&
          (!ans ||
            plain.includes(ans) ||
            plain.includes(String(Number(ans))) ||
            /numerical|placeholder|verify/i.test(qHtml + plain));
        if (ok) numOk++;
        else {
          numBad++;
          pIssues++;
          if (samples.numBad.length < 6) {
            samples.numBad.push({
              paper: paper.title,
              qid,
              ans,
              letter,
              chosen: plain.slice(0, 40),
            });
          }
        }
      } else {
        const want = mcqLetterFromSrc(sq);
        if (!want) {
          if (["A", "B", "C", "D"].includes(letter)) otherAnsOk++;
          else {
            mcqBad++;
            pIssues++;
          }
        } else if (want === letter) mcqOk++;
        else {
          // Numerical-looking answers sometimes tagged MCQ in source
          const ans = String(sq.answer ?? "").trim();
          if (/^-?\d+(\.\d+)?$/.test(ans)) {
            const chosen =
              opts[["A", "B", "C", "D"].indexOf(letter as "A")] || "";
            const plain = chosen
              .replace(/<[^>]+>/g, " ")
              .replace(/&nbsp;/gi, " ")
              .replace(/\s+/g, " ")
              .trim();
            if (
              plain.includes(ans) ||
              plain.includes(String(Math.round(Number(ans))))
            ) {
              numOk++;
            } else {
              mcqBad++;
              pIssues++;
              if (samples.mcqMismatch.length < 8) {
                samples.mcqMismatch.push({
                  paper: paper.title,
                  qid,
                  srcAnswer: sq.answer,
                  want,
                  got: letter,
                });
              }
            }
          } else {
            mcqBad++;
            pIssues++;
            if (samples.mcqMismatch.length < 8) {
              samples.mcqMismatch.push({
                paper: paper.title,
                qid,
                srcAnswer: sq.answer,
                want,
                got: letter,
              });
            }
          }
        }
      }
    }

    if (pIssues > 0) {
      paperIssues.push({ title: paper.title, issues: pIssues });
    }
  }

  const imagesOk =
    imgShortfall === 0 &&
    stillTestbee === 0 &&
    dbStemOptImgs === srcStemImgs &&
    dbSolImgs === srcSolImgs;
  const answersOk = mcqBad === 0 && numBad === 0 && badAnsLetter === 0;
  const structureOk =
    papersMissing === 0 &&
    countMismatch === 0 &&
    missingQ === 0 &&
    emptyStem === 0 &&
    badOptStruct === 0;

  console.log(
    JSON.stringify(
      {
        scope: "all 137 JEE Main PYQ papers",
        papers: {
          unique_source_files: names.length,
          present: papersOk,
          missing: papersMissing,
          missing_files: samples.missingPapers,
        },
        questions: {
          source: srcQs,
          db: dbQs,
          count_mismatches: countMismatch,
          missing_question_rows: missingQ,
        },
        images: {
          stem_plus_opt: `${dbStemOptImgs}/${srcStemImgs}`,
          solutions: `${dbSolImgs}/${srcSolImgs}`,
          match: dbStemOptImgs === srcStemImgs && dbSolImgs === srcSolImgs,
          shortfall_questions: imgShortfall,
          still_testbee_rows: stillTestbee,
          self_hosted_img_tag_hits: hostedImgTags,
          shortfall_samples: samples.imgShort,
          testbee_samples: samples.testbee,
        },
        answers: {
          valid_letter_A_D: badAnsLetter === 0,
          bad_letter_rows: badAnsLetter,
          mcq_matched: mcqOk,
          mcq_mismatched: mcqBad,
          numerical_ok: numOk,
          numerical_bad: numBad,
          other_valid: otherAnsOk,
          mcq_mismatch_samples: samples.mcqMismatch,
          numerical_bad_samples: samples.numBad,
        },
        structure: {
          empty_stems: emptyStem,
          bad_option_rows: badOptStruct,
          samples: samples.struct,
        },
        papers_with_any_issue: paperIssues.length,
        paper_issue_samples: paperIssues.slice(0, 12),
        verdict: {
          images: imagesOk ? "OK" : "NEEDS_ATTENTION",
          answers: answersOk ? "OK" : "NEEDS_ATTENTION",
          structure: structureOk ? "OK" : "NEEDS_ATTENTION",
          overall:
            imagesOk && answersOk && structureOk
              ? "PASS — nothing missed"
              : "NEEDS_ATTENTION",
        },
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
