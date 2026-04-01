import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isAdminUser } from "@/lib/admin";
import { normalizeSubjectKey, normalizeSubtopicContentKey } from "@/lib/subtopicContentKeys";
import {
  SUBTOPIC_DIFFICULTY_LEVELS,
  type SubtopicDifficultyLevel,
  type TopicHubScope,
  assessSubtopicRow,
  extractSubtopicPreviewFromTopicRow,
  fetchTopicHubGateWithRows,
} from "@/lib/subtopicCompleteness";

const ALLOWED_LEVELS = new Set<string>(SUBTOPIC_DIFFICULTY_LEVELS);
const HUB_SCOPES = new Set<TopicHubScope>(["topic", "chapter"]);

const PRE_READ_SETTLE_MS = 600;
const VERIFY_RETRY_BACKOFF_MS = 2_000;
/** Space Gemini calls — mirrors topic page artifact pipeline idea. */
const BETWEEN_SUBTOPIC_ARTIFACT_STEPS_MS = 12_000;
const BETWEEN_LEVELS_MS = 6_000;

type BlockStatus =
  | "ok"
  | "skipped"
  | "would_fill"
  | "generated"
  | "failed"
  | "failed_after_retry";

type LevelReport = {
  theory: BlockStatus;
  instacue: BlockStatus;
  bits: BlockStatus;
  formulas: BlockStatus;
  warnings: string[];
};

async function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function forwardAgentPost(
  request: Request,
  pathname: string,
  json: Record<string, unknown>
): Promise<Response> {
  const u = new URL(request.url);
  const target = new URL(pathname, u.origin);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const auth = request.headers.get("authorization");
  if (auth) headers.Authorization = auth;
  const cookie = request.headers.get("cookie");
  if (cookie) headers.Cookie = cookie;
  return fetch(target.toString(), { method: "POST", headers, body: JSON.stringify(json) });
}

async function loadSubtopicRow(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseAndUser>>>["supabase"],
  keys: {
    board: string;
    subject: string;
    classLevel: number;
    topic: string;
    subtopicName: string;
    level: string;
  }
) {
  const { data, error } = await supabase
    .from("subtopic_content")
    .select("theory, instacue_cards, bits_questions, practice_formulas")
    .eq("board", keys.board)
    .eq("subject", keys.subject)
    .eq("class_level", keys.classLevel)
    .eq("topic", keys.topic)
    .eq("subtopic_name", keys.subtopicName)
    .eq("level", keys.level)
    .maybeSingle();
  if (error) {
    console.warn("[complete-subtopic] subtopic_content read error", error.message);
  }
  return data ?? null;
}

function emptyLevelReport(): LevelReport {
  return {
    theory: "ok",
    instacue: "ok",
    bits: "ok",
    formulas: "ok",
    warnings: [],
  };
}

export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;
    if (!(await isAdminUser(supabase, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const board = normalizeSubtopicContentKey(body?.board);
    const subject = normalizeSubjectKey(body?.subject);
    const classLevel = Number(body?.classLevel);
    const topic = normalizeSubtopicContentKey(body?.topic);
    const subtopicName = normalizeSubtopicContentKey(body?.subtopicName);
    const hubScopeRaw = String(body?.hubScope ?? "topic").trim().toLowerCase();
    const hubScope: TopicHubScope = hubScopeRaw === "chapter" ? "chapter" : "topic";
    const dryRun = body?.dryRun === true;
    const includeTrace = body?.includeTrace === true;

    const levelsRaw = body?.levels;
    const levelsFilter: SubtopicDifficultyLevel[] = Array.isArray(levelsRaw)
      ? levelsRaw
          .map((x: unknown) => String(x ?? "").trim().toLowerCase())
          .filter((x): x is SubtopicDifficultyLevel => ALLOWED_LEVELS.has(x))
      : [];
    const levelsToRun: SubtopicDifficultyLevel[] =
      levelsFilter.length > 0
        ? SUBTOPIC_DIFFICULTY_LEVELS.filter((l) => levelsFilter.includes(l))
        : [...SUBTOPIC_DIFFICULTY_LEVELS];

    if (
      !board ||
      !subject ||
      !topic ||
      !subtopicName ||
      Number.isNaN(classLevel) ||
      ![11, 12].includes(classLevel) ||
      !HUB_SCOPES.has(hubScope) ||
      levelsToRun.length === 0
    ) {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    const { gate, rowsByLevel } = await fetchTopicHubGateWithRows(supabase, {
      board,
      subject,
      classLevel,
      topic,
      hubScope,
    });

    const report: Record<string, LevelReport> = {};
    const globalWarnings: string[] = [];
    const retries: { level: string; block: string }[] = [];

    if (!gate.ok) {
      if (dryRun) {
        for (const lv of levelsToRun) {
          report[lv] = emptyLevelReport();
          report[lv].warnings.push("Topic hub gate failed — subtopic fills not evaluated.");
        }
        return NextResponse.json({
          ok: false,
          dryRun: true,
          topicHubGate: {
            ok: false,
            missingTopicLevels: gate.missingTopicLevels,
            viableByLevel: gate.viableByLevel,
          },
          levels: report,
          warnings: globalWarnings,
          retries,
        });
      }
      return NextResponse.json(
        {
          error:
            "Topic hub must be generated for basics, intermediate, and advanced before subtopic AI work.",
          code: "TOPIC_HUB_INCOMPLETE",
          missingTopicLevels: gate.missingTopicLevels,
          viableByLevel: gate.viableByLevel,
        },
        { status: 412 }
      );
    }

    for (const level of levelsToRun) {
      report[level] = emptyLevelReport();
      const topicRowForLevel = rowsByLevel[level];
      const preview = extractSubtopicPreviewFromTopicRow(topicRowForLevel ?? null, subtopicName);

      let row = await loadSubtopicRow(supabase, {
        board,
        subject,
        classLevel,
        topic,
        subtopicName,
        level,
      });
      let assess = assessSubtopicRow(row);

      if (dryRun) {
        report[level].theory = assess.theoryMissingOrPlaceholder ? "would_fill" : "ok";
        report[level].instacue = assess.instacueGap ? "would_fill" : "ok";
        report[level].bits = assess.bitsGap ? "would_fill" : "ok";
        if (assess.skipFormulasConceptual) {
          report[level].formulas = "skipped";
          report[level].warnings.push(
            "Formulas skipped (conceptual heuristic — empty practice_formulas acceptable)."
          );
        } else {
          report[level].formulas = assess.formulasGap ? "would_fill" : "ok";
        }
        continue;
      }

      const baseJson = {
        board,
        subject,
        classLevel,
        topic,
        subtopicName,
        level,
        includeTrace: includeTrace === true,
      };

      if (assess.theoryMissingOrPlaceholder) {
        await delay(PRE_READ_SETTLE_MS);
        row = await loadSubtopicRow(supabase, {
          board,
          subject,
          classLevel,
          topic,
          subtopicName,
          level,
        });
        assess = assessSubtopicRow(row);
        if (!assess.theoryMissingOrPlaceholder) {
          report[level].theory = "ok";
        } else {
          const runTheory = async () =>
            forwardAgentPost(request, "/api/agent/generate-subtopic", {
              ...baseJson,
              preview,
              chapterTitle: "",
              includeTrace: includeTrace === true,
            });
          let res = await runTheory();
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { error?: string };
            globalWarnings.push(`[${level}] generate-subtopic: ${err.error ?? res.statusText}`);
            report[level].theory = "failed";
          } else {
            await delay(PRE_READ_SETTLE_MS);
            row = await loadSubtopicRow(supabase, {
              board,
              subject,
              classLevel,
              topic,
              subtopicName,
              level,
            });
            let a = assessSubtopicRow(row);
            if (!a.theoryMissingOrPlaceholder) {
              report[level].theory = "generated";
            } else {
              retries.push({ level, block: "theory" });
              await delay(VERIFY_RETRY_BACKOFF_MS);
              res = await runTheory();
              if (!res.ok) {
                report[level].theory = "failed_after_retry";
              } else {
                await delay(PRE_READ_SETTLE_MS);
                row = await loadSubtopicRow(supabase, {
                  board,
                  subject,
                  classLevel,
                  topic,
                  subtopicName,
                  level,
                });
                a = assessSubtopicRow(row);
                report[level].theory = a.theoryMissingOrPlaceholder
                  ? "failed_after_retry"
                  : "generated";
              }
            }
          }
        }
      } else {
        report[level].theory = "ok";
      }

      row = await loadSubtopicRow(supabase, {
        board,
        subject,
        classLevel,
        topic,
        subtopicName,
        level,
      });
      assess = assessSubtopicRow(row);

      async function runArtifact(
        block: "instacue" | "bits" | "formulas",
        gap: boolean,
        path: string,
        extra: Record<string, unknown> = {}
      ) {
        if (!gap) {
          report[level][block] = "ok";
          return;
        }
        await delay(PRE_READ_SETTLE_MS);
        row = await loadSubtopicRow(supabase, {
          board,
          subject,
          classLevel,
          topic,
          subtopicName,
          level,
        });
        assess = assessSubtopicRow(row);
        const stillGap =
          block === "instacue"
            ? assess.instacueGap
            : block === "bits"
              ? assess.bitsGap
              : assess.formulasGap;
        if (!stillGap) {
          report[level][block] = "ok";
          return;
        }

        let res = await forwardAgentPost(request, path, { ...baseJson, ...extra });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          globalWarnings.push(`[${level}] ${block}: ${err.error ?? res.statusText}`);
          report[level][block] = "failed";
          return;
        }
        await delay(PRE_READ_SETTLE_MS);
        row = await loadSubtopicRow(supabase, {
          board,
          subject,
          classLevel,
          topic,
          subtopicName,
          level,
        });
        assess = assessSubtopicRow(row);
        const afterGap =
          block === "instacue"
            ? assess.instacueGap
            : block === "bits"
              ? assess.bitsGap
              : assess.formulasGap;
        if (afterGap) {
          await delay(VERIFY_RETRY_BACKOFF_MS);
          retries.push({ level, block });
          res = await forwardAgentPost(request, path, { ...baseJson, ...extra });
          if (!res.ok) {
            report[level][block] = "failed_after_retry";
            return;
          }
          row = await loadSubtopicRow(supabase, {
            board,
            subject,
            classLevel,
            topic,
            subtopicName,
            level,
          });
          assess = assessSubtopicRow(row);
          const stillAfter =
            block === "instacue"
              ? assess.instacueGap
              : block === "bits"
                ? assess.bitsGap
                : assess.formulasGap;
          report[level][block] = stillAfter ? "failed_after_retry" : "generated";
        } else {
          report[level][block] = "generated";
        }
      }

      await runArtifact("instacue", assess.instacueGap, "/api/agent/generate-instacue");
      await delay(BETWEEN_SUBTOPIC_ARTIFACT_STEPS_MS);
      row = await loadSubtopicRow(supabase, {
        board,
        subject,
        classLevel,
        topic,
        subtopicName,
        level,
      });
      assess = assessSubtopicRow(row);

      await runArtifact("bits", assess.bitsGap, "/api/agent/generate-bits");
      await delay(BETWEEN_SUBTOPIC_ARTIFACT_STEPS_MS);
      row = await loadSubtopicRow(supabase, {
        board,
        subject,
        classLevel,
        topic,
        subtopicName,
        level,
      });
      assess = assessSubtopicRow(row);

      if (assess.skipFormulasConceptual) {
        report[level].formulas = "skipped";
        report[level].warnings.push(
          "Formulas skipped (conceptual heuristic — empty practice_formulas acceptable)."
        );
      } else {
        await runArtifact("formulas", assess.formulasGap, "/api/agent/generate-formulas");
      }

      await delay(BETWEEN_LEVELS_MS);
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      topicHubGate: { ok: true, viableByLevel: gate.viableByLevel },
      levels: report,
      warnings: globalWarnings,
      retries,
      ...(includeTrace
        ? {
            trace: {
              hubScope,
              levelsToRun,
              delays: {
                BETWEEN_SUBTOPIC_ARTIFACT_STEPS_MS,
                BETWEEN_LEVELS_MS,
              },
            },
          }
        : {}),
    });
  } catch (e) {
    console.error("complete-subtopic error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
