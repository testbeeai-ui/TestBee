import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type CurriculumUnit = {
  id: string;
  subject: string;
  class_level: number;
  unit_label: string;
  unit_title: string;
  sort_order: number;
};
type CurriculumChapter = {
  id: string;
  unit_id: string;
  title: string;
  sort_order: number;
};
type CurriculumTopic = {
  id: string;
  chapter_id: string;
  title: string;
  sort_order: number;
};
type CurriculumSubtopic = {
  id: string;
  topic_id: string;
  name: string;
  sort_order: number;
};

type AiTokenLog = {
  id: string;
  created_at: string;
  action_type: string;
  model_id: string;
  prompt_tokens: number;
  candidates_tokens: number;
  total_tokens: number;
  cost_usd: number;
  metadata: Record<string, unknown> | null;
};

type ScopeDef = {
  key: string;
  label: string;
  subject: "chemistry" | "math";
  classLevel: 11 | 12;
  chapterFilter: (chapterSeq: number) => boolean;
};

type ScopeResult = {
  scope: ScopeDef;
  totalChapters: number;
  totalTopics: number;
  totalSubtopics: number;
  coveredChaptersByTopicLogs: number;
  coveredTopicsByLogs: number;
  coveredSubtopicsByLogs: number;
  remainingChapters: number;
  remainingTopics: number;
  remainingSubtopics: number;
  loggedRows: number;
  loggedCostUsd: number;
  loggedPromptTokens: number;
  loggedOutputTokens: number;
  loggedTotalTokens: number;
  avgPerTopicUsd: number;
  avgPerSubtopicUsd: number;
  avgPerSubtopicFullUsd: number;
  estRemainingTopicUsd: number;
  estRemainingSubtopicUsd: number;
  estRemainingSubtopicFullUsd: number;
  estRemainingGrandFullUsd: number;
  actionAverages: Record<
    string,
    { avgPrompt: number; avgOutput: number; avgTotal: number; avgUsd: number; sampleSubtopicsOrTopics: number }
  >;
};

function parseDotEnv(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    let v = trimmed.slice(eqIdx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function fmtUsd(v: number): string {
  return `$${v.toFixed(4)}`;
}

function fmtInt(v: number): string {
  return Math.round(v).toLocaleString();
}

function keyTopic(subject: string, classLevel: number, chapter: string, topic: string): string {
  return `${subject}|${classLevel}|${chapter}|${topic}`;
}

function keySubtopic(subject: string, classLevel: number, chapter: string, topic: string, subtopic: string): string {
  return `${subject}|${classLevel}|${chapter}|${topic}|${subtopic}`;
}

function readMetaString(meta: Record<string, unknown> | null, key: string): string {
  if (!meta) return "";
  const val = meta[key];
  return typeof val === "string" ? val : "";
}

function readMetaClassLevel(meta: Record<string, unknown> | null): number {
  if (!meta) return 0;
  const direct = meta.classLevel;
  if (typeof direct === "number") return direct;
  if (typeof direct === "string") return Number(direct) || 0;
  const snake = meta.class_level;
  if (typeof snake === "number") return snake;
  if (typeof snake === "string") return Number(snake) || 0;
  return 0;
}

function isGeminiFlashModel(modelId: string): boolean {
  const m = modelId.toLowerCase();
  return m.includes("gemini-3") && m.includes("flash");
}

function avg(vals: number[]): number {
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

async function main() {
  const envPath = path.resolve(process.cwd(), ".env");
  const env = parseDotEnv(envPath);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const [{ data: units }, { data: chapters }, { data: topics }, { data: subtopics }] = await Promise.all([
    supabase
      .from("curriculum_units")
      .select("id,subject,class_level,unit_label,unit_title,sort_order")
      .in("subject", ["chemistry", "math"])
      .in("class_level", [11, 12]),
    supabase.from("curriculum_chapters").select("id,unit_id,title,sort_order"),
    supabase.from("curriculum_topics").select("id,chapter_id,title,sort_order"),
    supabase.from("curriculum_subtopics").select("id,topic_id,name,sort_order"),
  ]);

  if (!units || !chapters || !topics || !subtopics) {
    throw new Error("Failed to fetch curriculum hierarchy");
  }

  const unitById = new Map((units as CurriculumUnit[]).map((u) => [u.id, u]));
  const chapterById = new Map((chapters as CurriculumChapter[]).map((c) => [c.id, c]));
  const topicById = new Map((topics as CurriculumTopic[]).map((t) => [t.id, t]));

  const chapterRows = (chapters as CurriculumChapter[])
    .map((ch) => {
      const u = unitById.get(ch.unit_id);
      if (!u) return null;
      return {
        id: ch.id,
        subject: u.subject as "chemistry" | "math",
        classLevel: u.class_level as 11 | 12,
        chapterTitle: ch.title,
        unitSort: u.sort_order,
        chapterSort: ch.sort_order,
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    subject: "chemistry" | "math";
    classLevel: 11 | 12;
    chapterTitle: string;
    unitSort: number;
    chapterSort: number;
  }>;

  const chapterSeqById = new Map<string, number>();
  for (const subject of ["chemistry", "math"] as const) {
    for (const cl of [11, 12] as const) {
      const rows = chapterRows
        .filter((r) => r.subject === subject && r.classLevel === cl)
        .sort((a, b) => a.unitSort - b.unitSort || a.chapterSort - b.chapterSort || a.chapterTitle.localeCompare(b.chapterTitle));
      rows.forEach((r, idx) => chapterSeqById.set(r.id, idx + 1));
    }
  }

  const topicRows = (topics as CurriculumTopic[])
    .map((t) => {
      const ch = chapterById.get(t.chapter_id);
      if (!ch) return null;
      const u = unitById.get(ch.unit_id);
      if (!u) return null;
      return {
        id: t.id,
        subject: u.subject as "chemistry" | "math",
        classLevel: u.class_level as 11 | 12,
        chapterId: ch.id,
        chapterTitle: ch.title,
        topicTitle: t.title,
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    subject: "chemistry" | "math";
    classLevel: 11 | 12;
    chapterId: string;
    chapterTitle: string;
    topicTitle: string;
  }>;

  const subtopicRows = (subtopics as CurriculumSubtopic[])
    .map((s) => {
      const t = topicById.get(s.topic_id);
      if (!t) return null;
      const topicRow = topicRows.find((x) => x.id === t.id);
      if (!topicRow) return null;
      return {
        id: s.id,
        subject: topicRow.subject,
        classLevel: topicRow.classLevel,
        chapterId: topicRow.chapterId,
        chapterTitle: topicRow.chapterTitle,
        topicTitle: topicRow.topicTitle,
        subtopicName: s.name,
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    subject: "chemistry" | "math";
    classLevel: 11 | 12;
    chapterId: string;
    chapterTitle: string;
    topicTitle: string;
    subtopicName: string;
  }>;

  const topicLookup = new Map<string, string[]>();
  for (const t of topicRows) {
    const k = keyTopic(t.subject, t.classLevel, t.chapterTitle, t.topicTitle);
    const arr = topicLookup.get(k) ?? [];
    arr.push(t.id);
    topicLookup.set(k, arr);
  }
  const subtopicLookup = new Map<string, string[]>();
  for (const s of subtopicRows) {
    const k = keySubtopic(s.subject, s.classLevel, s.chapterTitle, s.topicTitle, s.subtopicName);
    const arr = subtopicLookup.get(k) ?? [];
    arr.push(s.id);
    subtopicLookup.set(k, arr);
  }

  const interestingActions = [
    "generate_topic",
    "generate_topic_retry",
    "generate_subtopic",
    "generate_instacue",
    "generate_bits",
    "generate_formulas",
    "generate_formulas_verifier",
  ];

  const logs: AiTokenLog[] = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("ai_token_logs")
      .select("id,created_at,action_type,model_id,prompt_tokens,candidates_tokens,total_tokens,cost_usd,metadata")
      .in("action_type", interestingActions)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as AiTokenLog[];
    logs.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  const flashLogs = logs.filter((r) => isGeminiFlashModel(r.model_id));

  type MatchedLog = AiTokenLog & { matchedTopicIds: string[]; matchedSubtopicIds: string[] };
  const matchedLogs: MatchedLog[] = flashLogs.map((row) => {
    const meta = row.metadata ?? {};
    const subject = readMetaString(meta, "subject");
    const classLevel = readMetaClassLevel(meta);
    const chapterTitle = readMetaString(meta, "chapterTitle");
    const topicTitle = readMetaString(meta, "topic");
    const subtopicName = readMetaString(meta, "subtopicName");

    let matchedTopicIds: string[] = [];
    let matchedSubtopicIds: string[] = [];

    if (topicTitle && (subject === "chemistry" || subject === "math") && (classLevel === 11 || classLevel === 12)) {
      if (chapterTitle) {
        matchedTopicIds = topicLookup.get(keyTopic(subject, classLevel, chapterTitle, topicTitle)) ?? [];
      } else {
        // Fallback: match same topic title within subject+class across chapters.
        matchedTopicIds = topicRows
          .filter((t) => t.subject === subject && t.classLevel === classLevel && t.topicTitle === topicTitle)
          .map((t) => t.id);
      }
    }

    if (
      topicTitle &&
      subtopicName &&
      (subject === "chemistry" || subject === "math") &&
      (classLevel === 11 || classLevel === 12)
    ) {
      if (chapterTitle) {
        matchedSubtopicIds =
          subtopicLookup.get(keySubtopic(subject, classLevel, chapterTitle, topicTitle, subtopicName)) ?? [];
      } else {
        matchedSubtopicIds = subtopicRows
          .filter(
            (s) =>
              s.subject === subject &&
              s.classLevel === classLevel &&
              s.topicTitle === topicTitle &&
              s.subtopicName === subtopicName
          )
          .map((s) => s.id);
      }
    }

    return { ...row, matchedTopicIds, matchedSubtopicIds };
  });

  const scopes: ScopeDef[] = [
    {
      key: "chem11_ch6_plus",
      label: "Chemistry Class 11 (Chapter 6 onward)",
      subject: "chemistry",
      classLevel: 11,
      chapterFilter: (seq) => seq >= 6,
    },
    {
      key: "chem12_ch6_plus",
      label: "Chemistry Class 12 (Chapter 6 onward)",
      subject: "chemistry",
      classLevel: 12,
      chapterFilter: (seq) => seq >= 6,
    },
    {
      key: "math11_all",
      label: "Mathematics Class 11 (All chapters)",
      subject: "math",
      classLevel: 11,
      chapterFilter: () => true,
    },
    {
      key: "math12_all",
      label: "Mathematics Class 12 (All chapters)",
      subject: "math",
      classLevel: 12,
      chapterFilter: () => true,
    },
  ];

  const actionForTopic = new Set(["generate_topic", "generate_topic_retry"]);
  const actionForSubtopic = new Set([
    "generate_subtopic",
    "generate_instacue",
    "generate_bits",
    "generate_formulas",
    "generate_formulas_verifier",
  ]);

  const globalActionAverages: Record<string, { avgPrompt: number; avgOutput: number; avgTotal: number; avgUsd: number }> = {};
  for (const action of interestingActions) {
    const rows = matchedLogs.filter((r) => r.action_type === action);
    globalActionAverages[action] = {
      avgPrompt: avg(rows.map((r) => n(r.prompt_tokens))),
      avgOutput: avg(rows.map((r) => n(r.candidates_tokens))),
      avgTotal: avg(rows.map((r) => n(r.total_tokens))),
      avgUsd: avg(rows.map((r) => n(r.cost_usd))),
    };
  }

  const results: ScopeResult[] = scopes.map((scope) => {
    const chapterIds = new Set(
      chapterRows
        .filter((c) => c.subject === scope.subject && c.classLevel === scope.classLevel)
        .filter((c) => scope.chapterFilter(chapterSeqById.get(c.id) ?? 0))
        .map((c) => c.id)
    );
    const topicIds = new Set(
      topicRows
        .filter((t) => t.subject === scope.subject && t.classLevel === scope.classLevel && chapterIds.has(t.chapterId))
        .map((t) => t.id)
    );
    const subtopicIds = new Set(
      subtopicRows
        .filter((s) => s.subject === scope.subject && s.classLevel === scope.classLevel && chapterIds.has(s.chapterId))
        .map((s) => s.id)
    );

    const scopeLogs = matchedLogs.filter((log) => {
      if (actionForTopic.has(log.action_type)) return log.matchedTopicIds.some((id) => topicIds.has(id));
      if (actionForSubtopic.has(log.action_type)) return log.matchedSubtopicIds.some((id) => subtopicIds.has(id));
      return false;
    });

    const coveredTopicIds = new Set<string>();
    const coveredSubtopicIds = new Set<string>();
    const coveredChapterIdsByTopic = new Set<string>();
    for (const log of scopeLogs) {
      if (actionForTopic.has(log.action_type)) {
        for (const id of log.matchedTopicIds) {
          if (!topicIds.has(id)) continue;
          coveredTopicIds.add(id);
          const chId = topicRows.find((t) => t.id === id)?.chapterId;
          if (chId) coveredChapterIdsByTopic.add(chId);
        }
      } else if (actionForSubtopic.has(log.action_type)) {
        for (const id of log.matchedSubtopicIds) if (subtopicIds.has(id)) coveredSubtopicIds.add(id);
      }
    }

    const actionAverages: ScopeResult["actionAverages"] = {};
    for (const action of interestingActions) {
      const actionRows = scopeLogs.filter((r) => r.action_type === action);
      const idSet = new Set<string>();
      for (const r of actionRows) {
        if (actionForTopic.has(action)) {
          r.matchedTopicIds.filter((id) => topicIds.has(id)).forEach((id) => idSet.add(id));
        } else {
          r.matchedSubtopicIds.filter((id) => subtopicIds.has(id)).forEach((id) => idSet.add(id));
        }
      }
      const denom = idSet.size || 0;
      if (denom > 0) {
        actionAverages[action] = {
          avgPrompt: actionRows.reduce((a, r) => a + n(r.prompt_tokens), 0) / denom,
          avgOutput: actionRows.reduce((a, r) => a + n(r.candidates_tokens), 0) / denom,
          avgTotal: actionRows.reduce((a, r) => a + n(r.total_tokens), 0) / denom,
          avgUsd: actionRows.reduce((a, r) => a + n(r.cost_usd), 0) / denom,
          sampleSubtopicsOrTopics: denom,
        };
      } else {
        const g = globalActionAverages[action];
        actionAverages[action] = {
          avgPrompt: g.avgPrompt,
          avgOutput: g.avgOutput,
          avgTotal: g.avgTotal,
          avgUsd: g.avgUsd,
          sampleSubtopicsOrTopics: 0,
        };
      }
    }

    const avgPerTopicUsd = actionAverages.generate_topic.avgUsd + actionAverages.generate_topic_retry.avgUsd;
    const avgPerSubtopicUsd = actionAverages.generate_subtopic.avgUsd;
    const avgPerSubtopicFullUsd =
      actionAverages.generate_subtopic.avgUsd +
      actionAverages.generate_instacue.avgUsd +
      actionAverages.generate_bits.avgUsd +
      actionAverages.generate_formulas.avgUsd +
      actionAverages.generate_formulas_verifier.avgUsd;

    const remainingTopics = Math.max(0, topicIds.size - coveredTopicIds.size);
    const remainingSubtopics = Math.max(0, subtopicIds.size - coveredSubtopicIds.size);
    const remainingChapters = Math.max(0, chapterIds.size - coveredChapterIdsByTopic.size);
    const loggedRows = scopeLogs.length;
    const loggedCostUsd = scopeLogs.reduce((a, r) => a + n(r.cost_usd), 0);
    const loggedPromptTokens = scopeLogs.reduce((a, r) => a + n(r.prompt_tokens), 0);
    const loggedOutputTokens = scopeLogs.reduce((a, r) => a + n(r.candidates_tokens), 0);
    const loggedTotalTokens = scopeLogs.reduce((a, r) => a + n(r.total_tokens), 0);

    return {
      scope,
      totalChapters: chapterIds.size,
      totalTopics: topicIds.size,
      totalSubtopics: subtopicIds.size,
      coveredChaptersByTopicLogs: coveredChapterIdsByTopic.size,
      coveredTopicsByLogs: coveredTopicIds.size,
      coveredSubtopicsByLogs: coveredSubtopicIds.size,
      remainingChapters,
      remainingTopics,
      remainingSubtopics,
      loggedRows,
      loggedCostUsd,
      loggedPromptTokens,
      loggedOutputTokens,
      loggedTotalTokens,
      avgPerTopicUsd,
      avgPerSubtopicUsd,
      avgPerSubtopicFullUsd,
      estRemainingTopicUsd: remainingTopics * avgPerTopicUsd,
      estRemainingSubtopicUsd: remainingSubtopics * avgPerSubtopicUsd,
      estRemainingSubtopicFullUsd: remainingSubtopics * avgPerSubtopicFullUsd,
      estRemainingGrandFullUsd: remainingTopics * avgPerTopicUsd + remainingSubtopics * avgPerSubtopicFullUsd,
      actionAverages,
    };
  });

  const priceInput = Number(process.env.AI_COST_GEMINI_FLASH_INPUT_PER_1M ?? 0.35);
  const priceOutput = Number(process.env.AI_COST_GEMINI_FLASH_OUTPUT_PER_1M ?? 1.05);

  const total = results.reduce(
    (acc, r) => {
      acc.totalChapters += r.totalChapters;
      acc.totalTopics += r.totalTopics;
      acc.totalSubtopics += r.totalSubtopics;
      acc.remainingChapters += r.remainingChapters;
      acc.remainingTopics += r.remainingTopics;
      acc.remainingSubtopics += r.remainingSubtopics;
      acc.loggedRows += r.loggedRows;
      acc.loggedCost += r.loggedCostUsd;
      acc.loggedPrompt += r.loggedPromptTokens;
      acc.loggedOutput += r.loggedOutputTokens;
      acc.loggedTotal += r.loggedTotalTokens;
      acc.estTopic += r.estRemainingTopicUsd;
      acc.estSubtopicTheory += r.estRemainingSubtopicUsd;
      acc.estSubtopicFull += r.estRemainingSubtopicFullUsd;
      acc.estGrandFull += r.estRemainingGrandFullUsd;
      return acc;
    },
    {
      totalChapters: 0,
      totalTopics: 0,
      totalSubtopics: 0,
      remainingChapters: 0,
      remainingTopics: 0,
      remainingSubtopics: 0,
      loggedRows: 0,
      loggedCost: 0,
      loggedPrompt: 0,
      loggedOutput: 0,
      loggedTotal: 0,
      estTopic: 0,
      estSubtopicTheory: 0,
      estSubtopicFull: 0,
      estGrandFull: 0,
    }
  );

  console.log("\nGemini Flash Cost Analysis (token logs + curriculum)\n");
  console.log(`Model pricing used: input ${fmtUsd(priceInput)} / 1M, output ${fmtUsd(priceOutput)} / 1M`);
  console.log(`Logs considered: ${fmtInt(matchedLogs.length)} Gemini-3-Flash rows across actions.\n`);

  console.log("| Scope | Logged rows | Logged prompt tokens | Logged output tokens | Logged total tokens | Logged cost (USD) |");
  console.log("|---|---:|---:|---:|---:|---:|");
  for (const r of results) {
    console.log(
      `| ${r.scope.label} | ${fmtInt(r.loggedRows)} | ${fmtInt(r.loggedPromptTokens)} | ${fmtInt(r.loggedOutputTokens)} | ${fmtInt(
        r.loggedTotalTokens
      )} | ${fmtUsd(r.loggedCostUsd)} |`
    );
  }
  console.log(
    `| **Combined** | **${fmtInt(total.loggedRows)}** | **${fmtInt(total.loggedPrompt)}** | **${fmtInt(
      total.loggedOutput
    )}** | **${fmtInt(total.loggedTotal)}** | **${fmtUsd(total.loggedCost)}** |`
  );
  console.log("");

  console.log(
    "| Scope | Chapters (target) | Topics (target) | Subtopics (target) | Remaining chapters | Remaining topics | Remaining subtopics | Est. cost (topics) | Est. cost (subtopics full) | Est. grand total |"
  );
  console.log(
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|"
  );
  for (const r of results) {
    console.log(
      `| ${r.scope.label} | ${fmtInt(r.totalChapters)} | ${fmtInt(r.totalTopics)} | ${fmtInt(r.totalSubtopics)} | ${fmtInt(
        r.remainingChapters
      )} | ${fmtInt(r.remainingTopics)} | ${fmtInt(r.remainingSubtopics)} | ${fmtUsd(r.estRemainingTopicUsd)} | ${fmtUsd(
        r.estRemainingSubtopicFullUsd
      )} | ${fmtUsd(r.estRemainingGrandFullUsd)} |`
    );
  }
  console.log(
    `| **Combined** | **${fmtInt(total.totalChapters)}** | **${fmtInt(total.totalTopics)}** | **${fmtInt(
      total.totalSubtopics
    )}** | **${fmtInt(total.remainingChapters)}** | **${fmtInt(total.remainingTopics)}** | **${fmtInt(
      total.remainingSubtopics
    )}** | **${fmtUsd(total.estTopic)}** | **${fmtUsd(total.estSubtopicFull)}** | **${fmtUsd(total.estGrandFull)}** |`
  );

  console.log("\nPer-scope unit economics (USD per item):");
  console.log("| Scope | Avg/topic (generate_topic + retry) | Avg/subtopic (theory only) | Avg/subtopic (full pipeline*) |");
  console.log("|---|---:|---:|---:|");
  for (const r of results) {
    console.log(
      `| ${r.scope.label} | ${fmtUsd(r.avgPerTopicUsd)} | ${fmtUsd(r.avgPerSubtopicUsd)} | ${fmtUsd(r.avgPerSubtopicFullUsd)} |`
    );
  }
  console.log("* Full pipeline = generate_subtopic + generate_instacue + generate_bits + generate_formulas + generate_formulas_verifier");

  console.log("\nAction-level averages by scope (tokens and USD per generated item):");
  for (const r of results) {
    console.log(`\n## ${r.scope.label}`);
    console.log("| Action | Avg prompt tokens | Avg output tokens | Avg total tokens | Avg USD | Sample entities |");
    console.log("|---|---:|---:|---:|---:|---:|");
    for (const action of interestingActions) {
      const a = r.actionAverages[action];
      console.log(
        `| ${action} | ${fmtInt(a.avgPrompt)} | ${fmtInt(a.avgOutput)} | ${fmtInt(a.avgTotal)} | ${fmtUsd(a.avgUsd)} | ${fmtInt(
          a.sampleSubtopicsOrTopics
        )} |`
      );
    }
  }
}

main().catch((err) => {
  console.error("Analysis failed:", err?.message ?? err);
  process.exit(1);
});

