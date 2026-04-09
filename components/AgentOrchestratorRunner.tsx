"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { AlertCircle, CheckCircle2, Clock3, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchTopicContent,
  generateTopicContent,
  postCompleteSubtopic,
} from "@/lib/topicContentService";
import {
  fetchSubtopicContent,
  generateBitsQuestions,
  generateFormulaPractice,
  generateInstaCueCards,
  generateSubtopicContent,
} from "@/lib/subtopicContentService";
import { assessSubtopicRow } from "@/lib/subtopicCompleteness";
import {
  ORCHESTRATOR_LEVELS,
  getNextRunnableJob,
  useOrchestratorStore,
  type OrchestratorCursor,
  type OrchestratorJob,
  type OrchestratorLevel,
} from "@/store/useOrchestratorStore";

const ORCHESTRATOR_POLL_MS = 5_000;
const VERIFY_SETTLE_MS = 600;
const FORMULA_RETRY_DELAY_MS = 5_000;
// Vertex/Gemini quotas can 429 under bursty fan-out; keep concurrency moderate for stability.
const TOPIC_HUB_PARALLEL_LIMIT = 1;
const SUBTOPIC_PARALLEL_LIMIT = 2;
/** Parallel fetch+assess rows during final chapter audit */
const AUDIT_SUBTOPIC_PARALLEL = 6;
const CHAPTER_RETRY_BASE_DELAY_MS = 60_000;
/** One subtopic = deep dive + instacue + bits + formula retries; cap wall time so a hung fetch cannot stall the whole batch forever. */
const SUBTOPIC_PIPELINE_TIMEOUT_MS = 22 * 60_000;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function withSubtopicPipelineTimeout<T>(promise: Promise<T>, subtopicLabel: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(
        new Error(
          `Subtopic pipeline timed out after ${Math.round(
            SUBTOPIC_PIPELINE_TIMEOUT_MS / 60000
          )} min (still waiting on network or AI): ${subtopicLabel.slice(0, 120)}`
        )
      );
    }, SUBTOPIC_PIPELINE_TIMEOUT_MS);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function getChapterRetryDelayMs(retryCount: number) {
  return Math.min(CHAPTER_RETRY_BASE_DELAY_MS * Math.max(1, retryCount + 1), 10 * 60_000);
}

function getPreviewForSubtopic(
  previews: Array<{ subtopicName: string; preview: string }>,
  subtopicName: string
): string {
  const target = subtopicName.trim().toLowerCase();
  return (
    previews.find((row) => row.subtopicName.trim().toLowerCase() === target)?.preview ?? ""
  );
}

function getCurrentLevel(cursor: OrchestratorCursor): OrchestratorLevel {
  return ORCHESTRATOR_LEVELS[cursor.levelIndex] ?? ORCHESTRATOR_LEVELS[0] ?? "advanced";
}

function nextCursorAfterTopicHubBatch(job: OrchestratorJob, processedCount: number): OrchestratorCursor {
  const topicCount = job.topics.length;
  const nextTopicIndex = job.cursor.topicIndex + processedCount;
  const hasMoreTopicsAtCurrentLevel = nextTopicIndex < topicCount;
  if (hasMoreTopicsAtCurrentLevel) {
    return { ...job.cursor, topicIndex: nextTopicIndex };
  }

  const hasMoreLevels = job.cursor.levelIndex < ORCHESTRATOR_LEVELS.length - 1;
  if (hasMoreLevels) {
    return { ...job.cursor, topicIndex: 0, levelIndex: job.cursor.levelIndex + 1 };
  }

  return {
    phase: "subtopic",
    topicIndex: 0,
    levelIndex: 0,
    subtopicIndex: 0,
    subtopicStep: "deep_dive",
  };
}

function nextCursorAfterSubtopic(job: OrchestratorJob): OrchestratorCursor {
  const topic = job.topics[job.cursor.topicIndex];
  const subtopicCount = topic?.subtopics.length ?? 0;
  const hasMoreSubtopics = job.cursor.subtopicIndex < subtopicCount - 1;
  if (hasMoreSubtopics) {
    return {
      ...job.cursor,
      subtopicIndex: job.cursor.subtopicIndex + 1,
      subtopicStep: "deep_dive",
    };
  }

  const hasMoreLevels = job.cursor.levelIndex < ORCHESTRATOR_LEVELS.length - 1;
  if (hasMoreLevels) {
    return {
      ...job.cursor,
      levelIndex: job.cursor.levelIndex + 1,
      subtopicIndex: 0,
      subtopicStep: "deep_dive",
    };
  }

  const hasMoreTopics = job.cursor.topicIndex < job.topics.length - 1;
  if (hasMoreTopics) {
    return {
      ...job.cursor,
      topicIndex: job.cursor.topicIndex + 1,
      levelIndex: 0,
      subtopicIndex: 0,
      subtopicStep: "deep_dive",
    };
  }

  return {
    ...job.cursor,
    phase: "final_audit",
    subtopicStep: "deep_dive",
  };
}

async function auditBlueprintAdvancedCompleteness(
  job: OrchestratorJob,
  appendLog: (jobId: string, message: string) => void
) {
  const level = ORCHESTRATOR_LEVELS[0];
  type Task = { label: string; check: () => Promise<boolean> };
  const tasks: Task[] = [];
  for (const topic of job.topics) {
    for (const subtopicName of topic.subtopics) {
      tasks.push({
        label: `${topic.title} → ${subtopicName}`,
        check: async () => {
          const row = await fetchSubtopicContent({
            board: job.board,
            subject: job.subject,
            classLevel: job.classLevel,
            topic: topic.title,
            subtopicName,
            level,
          });
          const assess = assessSubtopicRow({
            theory: row.theory,
            instacue_cards: row.instacueCards,
            bits_questions: row.bitsQuestions,
            practice_formulas: row.practiceFormulas,
          });
          return (
            !assess.theoryMissingOrPlaceholder &&
            !assess.instacueGap &&
            !assess.bitsGap &&
            (!assess.formulasGap || assess.skipFormulasConceptual)
          );
        },
      });
    }
  }

  const gaps: string[] = [];
  for (let i = 0; i < tasks.length; i += AUDIT_SUBTOPIC_PARALLEL) {
    const slice = tasks.slice(i, i + AUDIT_SUBTOPIC_PARALLEL);
    const results = await Promise.all(
      slice.map(async (t) => ({ label: t.label, ok: await t.check() }))
    );
    for (const r of results) {
      if (!r.ok) gaps.push(r.label);
    }
  }

  if (gaps.length === 0) {
    appendLog(
      job.id,
      `Final audit: all ${tasks.length} advanced subtopic slot(s) in this chapter blueprint look complete.`
    );
    return;
  }
  appendLog(
    job.id,
    `Final audit: ${gaps.length} slot(s) may still be incomplete — open topic hub / regenerate if needed: ${gaps
      .slice(0, 10)
      .join("; ")}${gaps.length > 10 ? ` … +${gaps.length - 10} more` : ""}`
  );
}

function jobLabel(job: OrchestratorJob): string {
  if (job.status === "running") return "Running";
  if (job.status === "pending") return "Scheduled";
  if (job.status === "completed") return "Completed";
  if (job.status === "failed") return "Failed";
  return "Cancelled";
}

function stepLabel(job: OrchestratorJob): string {
  if (job.cursor.phase === "chapter_overview") return "Chapter overview";
  if (job.cursor.phase === "topic_hub") {
    const topic = job.topics[job.cursor.topicIndex];
    const level = getCurrentLevel(job.cursor);
    return `Topic hub · ${topic?.title ?? "Topic"} · ${level}`;
  }
  if (job.cursor.phase === "subtopic") {
    const topic = job.topics[job.cursor.topicIndex];
    const level = getCurrentLevel(job.cursor);
    const subtopic = topic?.subtopics[job.cursor.subtopicIndex] ?? "Subtopic";
    return `${job.cursor.subtopicStep.replace("_", " ")} · ${level} · ${subtopic}`;
  }
  if (job.cursor.phase === "final_audit") return "Final audit (advanced)";
  return "Completed";
}

export default function AgentOrchestratorRunner() {
  const jobs = useOrchestratorStore((state) => state.jobs);
  const patchJob = useOrchestratorStore((state) => state.patchJob);
  const appendLog = useOrchestratorStore((state) => state.appendLog);
  const shiftPendingJobsAfter = useOrchestratorStore((state) => state.shiftPendingJobsAfter);
  const cancelJob = useOrchestratorStore((state) => state.cancelJob);
  const clearFinishedJobs = useOrchestratorStore((state) => state.clearFinishedJobs);
  const runningRef = useRef(false);

  const requeueFailedJob = useCallback(
    (job: OrchestratorJob, errorMessage: string) => {
      const retryCount = (job.retryCount ?? 0) + 1;
      const retryDelayMs = getChapterRetryDelayMs(job.retryCount ?? 0);
      const retryAt = new Date(Date.now() + retryDelayMs).toISOString();

      shiftPendingJobsAfter(job.id, retryDelayMs);
      appendLog(
        job.id,
        `Chapter failed and will auto-retry in ${Math.max(
          1,
          Math.round(retryDelayMs / 60000)
        )} minute(s). ${errorMessage}`
      );
      patchJob(job.id, {
        status: "pending",
        scheduledAt: retryAt,
        finishedAt: undefined,
        currentAction: `Auto-retrying soon (attempt ${retryCount})`,
        lastError: errorMessage,
        retryCount,
        formulaRetryCount: 0,
      });
    },
    [appendLog, patchJob, shiftPendingJobsAfter]
  );

  const ensureSubtopicLevelComplete = useCallback(
    async (
      job: OrchestratorJob,
      topic: OrchestratorJob["topics"][number],
      level: OrchestratorLevel,
      subtopicName: string,
      previewCache: Map<string, Awaited<ReturnType<typeof fetchTopicContent>>>
    ) => {
      const contentParams = {
        board: job.board,
        subject: job.subject,
        classLevel: job.classLevel,
        topic: topic.title,
        subtopicName,
        level,
      } as const;

      const isRegenerate = job.mode === "regenerate";
      let subtopicContent = await fetchSubtopicContent(contentParams);
      let assess = assessSubtopicRow({
        theory: subtopicContent.theory,
        instacue_cards: subtopicContent.instacueCards,
        bits_questions: subtopicContent.bitsQuestions,
        practice_formulas: subtopicContent.practiceFormulas,
      });

      if (
        !isRegenerate &&
        !assess.theoryMissingOrPlaceholder &&
        !assess.instacueGap &&
        !assess.bitsGap &&
        (!assess.formulasGap || assess.skipFormulasConceptual)
      ) {
        appendLog(job.id, `Subtopic already complete for ${subtopicName} (${level}). Skipping.`);
        return;
      }

      if (isRegenerate || assess.theoryMissingOrPlaceholder) {
        if (!isRegenerate) {
          subtopicContent = await fetchSubtopicContent(contentParams);
          assess = assessSubtopicRow({
            theory: subtopicContent.theory,
            instacue_cards: subtopicContent.instacueCards,
            bits_questions: subtopicContent.bitsQuestions,
            practice_formulas: subtopicContent.practiceFormulas,
          });
        }
        if (!isRegenerate && !assess.theoryMissingOrPlaceholder) {
          appendLog(
            job.id,
            `Deep dive for ${subtopicName} (${level}) appeared while orchestrator was running. Skipping generation.`
          );
        } else {
          const cacheKey = `${topic.title}::${level}`;
          let previewRow = previewCache.get(cacheKey);
          if (!previewRow) {
            previewRow = await fetchTopicContent({
              board: job.board,
              subject: job.subject,
              classLevel: job.classLevel,
              topic: topic.title,
              level,
              hubScope: "topic",
            });
            previewCache.set(cacheKey, previewRow);
          }

          await generateSubtopicContent({
            ...contentParams,
            chapterTitle: job.chapterTitle,
            preview: getPreviewForSubtopic(previewRow.subtopicPreviews, subtopicName),
            includeTrace: false,
          });
          await sleep(VERIFY_SETTLE_MS);
          subtopicContent = await fetchSubtopicContent(contentParams);
          assess = assessSubtopicRow({
            theory: subtopicContent.theory,
            instacue_cards: subtopicContent.instacueCards,
            bits_questions: subtopicContent.bitsQuestions,
            practice_formulas: subtopicContent.practiceFormulas,
          });
          if (assess.theoryMissingOrPlaceholder) {
            throw new Error(`Deep dive did not persist correctly for ${subtopicName} (${level}).`);
          }
          appendLog(job.id, `Deep dive completed for ${subtopicName} (${level}).`);
        }
      } else {
        appendLog(job.id, `Deep dive already exists for ${subtopicName} (${level}). Skipping.`);
      }

      if (!isRegenerate) {
        subtopicContent = await fetchSubtopicContent(contentParams);
        assess = assessSubtopicRow({
          theory: subtopicContent.theory,
          instacue_cards: subtopicContent.instacueCards,
          bits_questions: subtopicContent.bitsQuestions,
          practice_formulas: subtopicContent.practiceFormulas,
        });
      }

      const needInstacue = isRegenerate || assess.instacueGap;
      const needBits = isRegenerate || assess.bitsGap;

      if (needInstacue && needBits) {
        let runInstacue = true;
        let runBits = true;
        if (!isRegenerate) {
          subtopicContent = await fetchSubtopicContent(contentParams);
          assess = assessSubtopicRow({
            theory: subtopicContent.theory,
            instacue_cards: subtopicContent.instacueCards,
            bits_questions: subtopicContent.bitsQuestions,
            practice_formulas: subtopicContent.practiceFormulas,
          });
          runInstacue = assess.instacueGap;
          runBits = assess.bitsGap;
        }
        if (!runInstacue && !runBits) {
          appendLog(
            job.id,
            `InstaCue and Bits for ${subtopicName} (${level}) already present. Skipping generation.`
          );
        } else if (runInstacue && runBits) {
          // Run sequentially to reduce Vertex quota burst (429 RESOURCE_EXHAUSTED).
          await generateInstaCueCards({ ...contentParams, includeTrace: false });
          await sleep(VERIFY_SETTLE_MS);
          await generateBitsQuestions({ ...contentParams, includeTrace: false });
          await sleep(VERIFY_SETTLE_MS);
          subtopicContent = await fetchSubtopicContent(contentParams);
          assess = assessSubtopicRow({
            theory: subtopicContent.theory,
            instacue_cards: subtopicContent.instacueCards,
            bits_questions: subtopicContent.bitsQuestions,
            practice_formulas: subtopicContent.practiceFormulas,
          });
          if ((subtopicContent.instacueCards?.length ?? 0) === 0) {
            throw new Error(`InstaCue generation returned no cards for ${subtopicName} (${level}).`);
          }
          if ((subtopicContent.bitsQuestions?.length ?? 0) === 0) {
            throw new Error(`Bits generation returned no questions for ${subtopicName} (${level}).`);
          }
          appendLog(job.id, `InstaCue + Bits completed sequentially for ${subtopicName} (${level}).`);
        } else if (runInstacue) {
          await generateInstaCueCards({
            ...contentParams,
            includeTrace: false,
          });
          await sleep(VERIFY_SETTLE_MS);
          subtopicContent = await fetchSubtopicContent(contentParams);
          assess = assessSubtopicRow({
            theory: subtopicContent.theory,
            instacue_cards: subtopicContent.instacueCards,
            bits_questions: subtopicContent.bitsQuestions,
            practice_formulas: subtopicContent.practiceFormulas,
          });
          if ((subtopicContent.instacueCards?.length ?? 0) === 0) {
            throw new Error(`InstaCue generation returned no cards for ${subtopicName} (${level}).`);
          }
          appendLog(job.id, `InstaCue completed for ${subtopicName} (${level}).`);
        } else {
          await generateBitsQuestions({
            ...contentParams,
            includeTrace: false,
          });
          await sleep(VERIFY_SETTLE_MS);
          subtopicContent = await fetchSubtopicContent(contentParams);
          assess = assessSubtopicRow({
            theory: subtopicContent.theory,
            instacue_cards: subtopicContent.instacueCards,
            bits_questions: subtopicContent.bitsQuestions,
            practice_formulas: subtopicContent.practiceFormulas,
          });
          if ((subtopicContent.bitsQuestions?.length ?? 0) === 0) {
            throw new Error(`Bits generation returned no questions for ${subtopicName} (${level}).`);
          }
          appendLog(job.id, `Bits completed for ${subtopicName} (${level}).`);
        }
      } else if (needInstacue) {
        if (!isRegenerate) {
          subtopicContent = await fetchSubtopicContent(contentParams);
          assess = assessSubtopicRow({
            theory: subtopicContent.theory,
            instacue_cards: subtopicContent.instacueCards,
            bits_questions: subtopicContent.bitsQuestions,
            practice_formulas: subtopicContent.practiceFormulas,
          });
          if (!assess.instacueGap) {
            appendLog(
              job.id,
              `InstaCue for ${subtopicName} (${level}) already present. Skipping generation.`
            );
          } else {
            await generateInstaCueCards({
              ...contentParams,
              includeTrace: false,
            });
            await sleep(VERIFY_SETTLE_MS);
            subtopicContent = await fetchSubtopicContent(contentParams);
            assess = assessSubtopicRow({
              theory: subtopicContent.theory,
              instacue_cards: subtopicContent.instacueCards,
              bits_questions: subtopicContent.bitsQuestions,
              practice_formulas: subtopicContent.practiceFormulas,
            });
            if ((subtopicContent.instacueCards?.length ?? 0) === 0) {
              throw new Error(`InstaCue generation returned no cards for ${subtopicName} (${level}).`);
            }
            appendLog(job.id, `InstaCue completed for ${subtopicName} (${level}).`);
          }
        } else {
          await generateInstaCueCards({
            ...contentParams,
            includeTrace: false,
          });
          await sleep(VERIFY_SETTLE_MS);
          subtopicContent = await fetchSubtopicContent(contentParams);
          assess = assessSubtopicRow({
            theory: subtopicContent.theory,
            instacue_cards: subtopicContent.instacueCards,
            bits_questions: subtopicContent.bitsQuestions,
            practice_formulas: subtopicContent.practiceFormulas,
          });
          if ((subtopicContent.instacueCards?.length ?? 0) === 0) {
            throw new Error(`InstaCue generation returned no cards for ${subtopicName} (${level}).`);
          }
          appendLog(job.id, `InstaCue completed for ${subtopicName} (${level}).`);
        }
      } else if (needBits) {
        if (!isRegenerate) {
          subtopicContent = await fetchSubtopicContent(contentParams);
          assess = assessSubtopicRow({
            theory: subtopicContent.theory,
            instacue_cards: subtopicContent.instacueCards,
            bits_questions: subtopicContent.bitsQuestions,
            practice_formulas: subtopicContent.practiceFormulas,
          });
          if (!assess.bitsGap) {
            appendLog(
              job.id,
              `Bits for ${subtopicName} (${level}) already present. Skipping generation.`
            );
          } else {
            await generateBitsQuestions({
              ...contentParams,
              includeTrace: false,
            });
            await sleep(VERIFY_SETTLE_MS);
            subtopicContent = await fetchSubtopicContent(contentParams);
            assess = assessSubtopicRow({
              theory: subtopicContent.theory,
              instacue_cards: subtopicContent.instacueCards,
              bits_questions: subtopicContent.bitsQuestions,
              practice_formulas: subtopicContent.practiceFormulas,
            });
            if ((subtopicContent.bitsQuestions?.length ?? 0) === 0) {
              throw new Error(`Bits generation returned no questions for ${subtopicName} (${level}).`);
            }
            appendLog(job.id, `Bits completed for ${subtopicName} (${level}).`);
          }
        } else {
          await generateBitsQuestions({
            ...contentParams,
            includeTrace: false,
          });
          await sleep(VERIFY_SETTLE_MS);
          subtopicContent = await fetchSubtopicContent(contentParams);
          assess = assessSubtopicRow({
            theory: subtopicContent.theory,
            instacue_cards: subtopicContent.instacueCards,
            bits_questions: subtopicContent.bitsQuestions,
            practice_formulas: subtopicContent.practiceFormulas,
          });
          if ((subtopicContent.bitsQuestions?.length ?? 0) === 0) {
            throw new Error(`Bits generation returned no questions for ${subtopicName} (${level}).`);
          }
          appendLog(job.id, `Bits completed for ${subtopicName} (${level}).`);
        }
      } else {
        appendLog(
          job.id,
          `InstaCue and Bits already exist for ${subtopicName} (${level}). Skipping.`
        );
      }

      if (!isRegenerate) {
        subtopicContent = await fetchSubtopicContent(contentParams);
        assess = assessSubtopicRow({
          theory: subtopicContent.theory,
          instacue_cards: subtopicContent.instacueCards,
          bits_questions: subtopicContent.bitsQuestions,
          practice_formulas: subtopicContent.practiceFormulas,
        });
      }

      if (!isRegenerate && assess.skipFormulasConceptual) {
        appendLog(job.id, `Formulas not required for conceptual subtopic ${subtopicName} (${level}). Skipping.`);
        return;
      }

      if (!isRegenerate && !assess.formulasGap) {
        appendLog(job.id, `Formulas already exist for ${subtopicName} (${level}). Skipping.`);
        return;
      }

      let formulaAttempt = 0;
      while (formulaAttempt < 3) {
        if (!isRegenerate) {
          subtopicContent = await fetchSubtopicContent(contentParams);
          assess = assessSubtopicRow({
            theory: subtopicContent.theory,
            instacue_cards: subtopicContent.instacueCards,
            bits_questions: subtopicContent.bitsQuestions,
            practice_formulas: subtopicContent.practiceFormulas,
          });
          if (assess.skipFormulasConceptual) {
            appendLog(
              job.id,
              `Formulas for ${subtopicName} (${level}) not required (conceptual). Skipping generation.`
            );
            return;
          }
          if (!assess.formulasGap) {
            appendLog(
              job.id,
              `Formulas for ${subtopicName} (${level}) already present. Skipping generation.`
            );
            return;
          }
        }

        let formulaError = "";
        try {
          await generateFormulaPractice({
            ...contentParams,
            includeTrace: false,
          });
        } catch (error) {
          formulaError = error instanceof Error ? error.message : "Formula generation failed";
        }

        await sleep(VERIFY_SETTLE_MS);
        subtopicContent = await fetchSubtopicContent(contentParams);
        assess = assessSubtopicRow({
          theory: subtopicContent.theory,
          instacue_cards: subtopicContent.instacueCards,
          bits_questions: subtopicContent.bitsQuestions,
          practice_formulas: subtopicContent.practiceFormulas,
        });

        if (!assess.formulasGap || assess.skipFormulasConceptual) {
          appendLog(
            job.id,
            assess.skipFormulasConceptual
              ? `Formulas skipped for conceptual subtopic ${subtopicName} (${level}).`
              : `Formulas completed for ${subtopicName} (${level}).`
          );
          return;
        }

        formulaAttempt += 1;
        if (formulaAttempt < 3) {
          appendLog(
            job.id,
            `Formulas missing for ${subtopicName} (${level}) after attempt ${formulaAttempt}. Retrying in 5 seconds.${formulaError ? ` ${formulaError}` : ""}`
          );
          await sleep(FORMULA_RETRY_DELAY_MS);
        } else {
          appendLog(
            job.id,
            `Formulas still incomplete for ${subtopicName} (${level}) after 3 attempts. Activating completeness fallback agent.${formulaError ? ` ${formulaError}` : ""}`
          );
        }
      }

      try {
        await postCompleteSubtopic({
          board: job.board,
          subject: job.subject,
          classLevel: job.classLevel,
          topic: topic.title,
          subtopicName,
          hubScope: "topic",
          levels: [level],
          includeTrace: false,
        });
        await sleep(VERIFY_SETTLE_MS);
      } catch (fallbackError) {
        appendLog(
          job.id,
          `Fallback agent error for ${subtopicName} (${level}): ${
            fallbackError instanceof Error ? fallbackError.message : "Unknown error"
          }`
        );
      }

      const fallbackContent = await fetchSubtopicContent(contentParams);
      const fallbackAssess = assessSubtopicRow({
        theory: fallbackContent.theory,
        instacue_cards: fallbackContent.instacueCards,
        bits_questions: fallbackContent.bitsQuestions,
        practice_formulas: fallbackContent.practiceFormulas,
      });

      if (!fallbackAssess.formulasGap || fallbackAssess.skipFormulasConceptual) {
        appendLog(job.id, `Fallback completed formulas for ${subtopicName} (${level}).`);
        return;
      }

      appendLog(
        job.id,
        `Fallback could not complete formulas for ${subtopicName} (${level}). Proceeding so the chapter is not blocked.`
      );
    },
    [appendLog]
  );

  const runJob = useCallback(
    async (jobId: string) => {
      const previewCache = new Map<string, Awaited<ReturnType<typeof fetchTopicContent>>>();

      while (true) {
        const current = useOrchestratorStore.getState().jobs.find((job) => job.id === jobId);
        if (!current || ["completed", "failed", "cancelled"].includes(current.status)) {
          return;
        }

        if (current.status === "pending") {
          const delayedMs = Math.max(
            0,
            Date.now() - new Date(current.originalScheduledAt).getTime()
          );
          patchJob(jobId, {
            status: "running",
            startedAt: new Date().toISOString(),
            scheduledAt: new Date().toISOString(),
            delayedMs,
            currentAction: "Starting orchestrator",
            lastError: undefined,
          });
          appendLog(
            jobId,
            delayedMs > 0
              ? `Started with delay of ${Math.round(delayedMs / 60000)} minute(s).`
              : "Started on schedule."
          );
          continue;
        }

        if (current.cursor.phase === "done") {
          const pendingQueue = useOrchestratorStore
            .getState()
            .jobs.filter((job) => job.status === "pending")
            .sort(
              (a, b) =>
                new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
            );
          const nextPending = pendingQueue[0] ?? null;
          if (nextPending) {
            const lateByMs = Date.now() - new Date(nextPending.scheduledAt).getTime();
            if (lateByMs > 0) {
              shiftPendingJobsAfter(current.id, lateByMs);
              appendLog(
                current.id,
                `Upcoming chapters delayed by ${Math.max(
                  1,
                  Math.round(lateByMs / 60000)
                )} minute(s) to avoid overlap.`
              );
            }
          }
          patchJob(jobId, {
            status: "completed",
            finishedAt: new Date().toISOString(),
            currentAction: "Completed",
            formulaRetryCount: 0,
          });
          appendLog(jobId, "Chapter automation completed.");
          return;
        }

        try {
          if (current.cursor.phase === "final_audit") {
            patchJob(jobId, {
              currentAction: "Final audit: checking advanced completeness for all blueprint subtopics",
            });
            appendLog(
              jobId,
              "Starting final audit (GET checks only — no new AI generation). This can take 1–3 minutes on large chapters."
            );
            await auditBlueprintAdvancedCompleteness(current, appendLog);
            patchJob(jobId, {
              cursor: {
                phase: "done",
                topicIndex: 0,
                levelIndex: 0,
                subtopicIndex: 0,
                subtopicStep: "deep_dive",
              },
            });
            continue;
          }

          if (current.cursor.phase === "chapter_overview") {
            if (current.mode === "generate") {
              const existing = await fetchTopicContent({
                board: current.board,
                subject: current.subject,
                classLevel: current.classLevel,
                topic: current.chapterTitle,
                level: "basics",
                hubScope: "chapter",
              });
              const alreadyComplete =
                existing.exists &&
                (existing.whyStudy.trim() ||
                  existing.whatLearn.trim() ||
                  existing.realWorld.trim() ||
                  (existing.subtopicPreviews?.length ?? 0) > 0);
              if (alreadyComplete) {
                appendLog(jobId, "Chapter overview already exists. Skipping chapter overview generation.");
                patchJob(jobId, {
                  cursor: {
                    phase: "topic_hub",
                    topicIndex: 0,
                    levelIndex: 0,
                    subtopicIndex: 0,
                    subtopicStep: "deep_dive",
                  },
                });
                continue;
              }
            }

            patchJob(jobId, {
              currentAction: `Generating chapter overview for ${current.chapterTitle}`,
            });

            if (current.mode === "generate") {
              const late = await fetchTopicContent({
                board: current.board,
                subject: current.subject,
                classLevel: current.classLevel,
                topic: current.chapterTitle,
                level: "basics",
                hubScope: "chapter",
              });
              const nowComplete =
                late.exists &&
                (late.whyStudy.trim() ||
                  late.whatLearn.trim() ||
                  late.realWorld.trim() ||
                  (late.subtopicPreviews?.length ?? 0) > 0);
              if (nowComplete) {
                appendLog(
                  jobId,
                  "Chapter overview already present (filled while orchestrator was running). Skipping generation."
                );
                patchJob(jobId, {
                  cursor: {
                    phase: "topic_hub",
                    topicIndex: 0,
                    levelIndex: 0,
                    subtopicIndex: 0,
                    subtopicStep: "deep_dive",
                  },
                });
                await sleep(VERIFY_SETTLE_MS);
                continue;
              }
            }

            const allSubtopics = current.topics.flatMap((topic) => topic.subtopics);
            await generateTopicContent({
              board: current.board,
              subject: current.subject,
              classLevel: current.classLevel,
              topic: current.chapterTitle,
              level: "basics",
              hubScope: "chapter",
              unitLabel: current.unitLabel ?? undefined,
              unitTitle: current.unitTitle ?? undefined,
              chapterTitle: current.chapterTitle,
              subtopicNames: allSubtopics,
              memberTopicTitles: current.topics.map((topic) => topic.title),
              mode: "generate",
              includeTrace: false,
            });

            appendLog(jobId, "Chapter overview generated.");
            patchJob(jobId, {
              cursor: {
                phase: "topic_hub",
                topicIndex: 0,
                levelIndex: 0,
                subtopicIndex: 0,
                subtopicStep: "deep_dive",
              },
            });
            await sleep(VERIFY_SETTLE_MS);
            continue;
          }

          if (current.cursor.phase === "topic_hub") {
            const level = getCurrentLevel(current.cursor);
            const topicBatch = current.topics.slice(
              current.cursor.topicIndex,
              current.cursor.topicIndex + TOPIC_HUB_PARALLEL_LIMIT
            );
            if (topicBatch.length === 0) {
              patchJob(jobId, {
                cursor: {
                  phase: "subtopic",
                  topicIndex: 0,
                  levelIndex: 0,
                  subtopicIndex: 0,
                  subtopicStep: "deep_dive",
                },
              });
              continue;
            }

            patchJob(jobId, {
              currentAction: `Generating ${level} topic hubs for ${topicBatch.length} topic(s)`,
            });

            const hubSettled = await Promise.allSettled(
              topicBatch.map(async (topic) => {
                if (current.mode === "generate") {
                  const hubNow = await fetchTopicContent({
                    board: current.board,
                    subject: current.subject,
                    classLevel: current.classLevel,
                    topic: topic.title,
                    level,
                    hubScope: "topic",
                  });
                  const hubAlreadyComplete =
                    hubNow.exists &&
                    (hubNow.whyStudy.trim() ||
                      hubNow.whatLearn.trim() ||
                      hubNow.realWorld.trim() ||
                      (hubNow.subtopicPreviews?.length ?? 0) > 0);
                  if (hubAlreadyComplete) {
                    previewCache.set(`${topic.title}::${level}`, hubNow);
                    appendLog(
                      jobId,
                      `Topic hub already exists for ${topic.title} (${level}). Skipping generation.`
                    );
                    return;
                  }
                }

                await generateTopicContent({
                  board: current.board,
                  subject: current.subject,
                  classLevel: current.classLevel,
                  topic: topic.title,
                  level,
                  hubScope: "topic",
                  unitLabel: current.unitLabel ?? undefined,
                  unitTitle: current.unitTitle ?? undefined,
                  chapterTitle: current.chapterTitle,
                  subtopicNames: topic.subtopics,
                  mode: "generate",
                  includeTrace: false,
                });
                const refreshedHub = await fetchTopicContent({
                  board: current.board,
                  subject: current.subject,
                  classLevel: current.classLevel,
                  topic: topic.title,
                  level,
                  hubScope: "topic",
                });
                previewCache.set(`${topic.title}::${level}`, refreshedHub);
                appendLog(jobId, `Topic hub generated for ${topic.title} (${level}).`);
              })
            );
            const hubFailure = hubSettled.find((result) => result.status === "rejected");
            if (hubFailure?.status === "rejected") {
              throw hubFailure.reason instanceof Error
                ? hubFailure.reason
                : new Error("Parallel topic-hub generation failed");
            }

            const nextCursor = nextCursorAfterTopicHubBatch(current, topicBatch.length);
            if (nextCursor.phase === "subtopic") {
              const topicChecks = await Promise.all(
                current.topics.map(async (topicRow) => ({
                  topic: topicRow.title,
                  missingLevels: (
                    await Promise.all(
                      ORCHESTRATOR_LEVELS.map(async (requiredLevel) => {
                        const hub = await fetchTopicContent({
                          board: current.board,
                          subject: current.subject,
                          classLevel: current.classLevel,
                          topic: topicRow.title,
                          level: requiredLevel,
                          hubScope: "topic",
                        });
                        const hubReady =
                          hub.exists &&
                          (hub.whyStudy.trim() ||
                            hub.whatLearn.trim() ||
                            hub.realWorld.trim() ||
                            (hub.subtopicPreviews?.length ?? 0) > 0);
                        return hubReady ? null : requiredLevel;
                      })
                    )
                  ).filter((value): value is OrchestratorLevel => Boolean(value)),
                }))
              );
              const firstGap = topicChecks
                .find((entry) => entry.missingLevels.length > 0);
              if (firstGap) {
                const firstMissingLevel = firstGap.missingLevels[0] ?? ORCHESTRATOR_LEVELS[0];
                const missingLevelIndex = ORCHESTRATOR_LEVELS.findIndex(
                  (candidate) => candidate === firstMissingLevel
                );
                appendLog(
                  jobId,
                  `Verification found missing topic hub data for ${firstGap.topic} (${firstMissingLevel}). Re-running that level before subtopics.`
                );
                patchJob(jobId, {
                  cursor: {
                    phase: "topic_hub",
                    topicIndex: current.topics.findIndex((item) => item.title === firstGap.topic),
                    levelIndex: missingLevelIndex >= 0 ? missingLevelIndex : 0,
                    subtopicIndex: 0,
                    subtopicStep: "deep_dive",
                  },
                });
                continue;
              }
              appendLog(jobId, `Verified topic hubs for ${ORCHESTRATOR_LEVELS.join(", ")}.`);
            }

            patchJob(jobId, {
              cursor: nextCursor,
            });
            await sleep(VERIFY_SETTLE_MS);
            continue;
          }

          const topic = current.topics[current.cursor.topicIndex];
          const level = getCurrentLevel(current.cursor);
          if (!topic) {
            patchJob(jobId, {
              cursor: {
                ...current.cursor,
                phase: "final_audit",
              },
            });
            continue;
          }

          const batch = topic.subtopics.slice(
            current.cursor.subtopicIndex,
            current.cursor.subtopicIndex + SUBTOPIC_PARALLEL_LIMIT
          );
          if (batch.length === 0) {
            patchJob(jobId, (job) => ({
              ...job,
              cursor: nextCursorAfterSubtopic({
                ...job,
                cursor: {
                  ...job.cursor,
                  subtopicIndex: topic.subtopics.length - 1,
                },
              }),
            }));
            continue;
          }

          patchJob(jobId, {
            currentAction: `Running ${batch.length} subtopic request(s) for ${topic.title} (${level})`,
          });
          appendLog(
            jobId,
            `Dispatching ${batch.length} parallel subtopic request(s) for ${topic.title} (${level}): ${batch.join(", ")}`
          );

          const settled = await Promise.allSettled(
            batch.map((subtopic) =>
              withSubtopicPipelineTimeout(
                ensureSubtopicLevelComplete(current, topic, level, subtopic, previewCache),
                `${topic.title} · ${subtopic}`
              )
            )
          );

          const failed = settled.find((result) => result.status === "rejected");
          if (failed?.status === "rejected") {
            throw failed.reason instanceof Error
              ? failed.reason
              : new Error("Parallel subtopic processing failed");
          }

          const nextIndex = current.cursor.subtopicIndex + batch.length;
          const totalSubs = topic.subtopics.length;
          const hasMoreInLevel = nextIndex < totalSubs;
          appendLog(
            jobId,
            hasMoreInLevel
              ? `Subtopic batch finished for ${topic.title} (${level}). Progress ${nextIndex}/${totalSubs} — starting next batch.`
              : `Subtopic batch finished for ${topic.title} (${level}). Moving to next topic, final audit, or chapter complete.`
          );

          patchJob(jobId, (job) => {
            const nextIdx = job.cursor.subtopicIndex + batch.length;
            const moreInTopic =
              nextIdx < (job.topics[job.cursor.topicIndex]?.subtopics.length ?? 0);
            if (moreInTopic) {
              return {
                ...job,
                formulaRetryCount: 0,
                cursor: {
                  ...job.cursor,
                  subtopicIndex: nextIdx,
                  subtopicStep: "deep_dive",
                },
              };
            }
            return {
              ...job,
              formulaRetryCount: 0,
              cursor: nextCursorAfterSubtopic({
                ...job,
                cursor: {
                  ...job.cursor,
                  subtopicIndex: (job.topics[job.cursor.topicIndex]?.subtopics.length ?? 1) - 1,
                },
              }),
            };
          });
          await sleep(VERIFY_SETTLE_MS);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Orchestrator failed";
          requeueFailedJob(current, message);
          return;
        }
      }
    },
    [appendLog, ensureSubtopicLevelComplete, patchJob, requeueFailedJob, shiftPendingJobsAfter]
  );

  const tick = useCallback(async () => {
    if (runningRef.current) return;
    const snapshot = useOrchestratorStore.getState().jobs;
    const failedJob = [...snapshot]
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .find((job) => job.status === "failed");
    if (failedJob) {
      requeueFailedJob(failedJob, failedJob.lastError || "Recovered failed chapter from saved queue.");
      return;
    }

    const next = getNextRunnableJob(snapshot);
    if (!next) return;

    runningRef.current = true;
    try {
      await runJob(next.id);
    } finally {
      runningRef.current = false;
    }
  }, [requeueFailedJob, runJob]);

  useEffect(() => {
    void tick();
    const interval = window.setInterval(() => {
      void tick();
    }, ORCHESTRATOR_POLL_MS);
    return () => window.clearInterval(interval);
  }, [tick]);

  const sortedJobs = useMemo(
    () =>
      [...jobs].sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      ),
    [jobs]
  );
  const firstPendingIndex = sortedJobs.findIndex((job) => job.status === "pending");
  const firstPendingJob = firstPendingIndex >= 0 ? sortedJobs[firstPendingIndex] ?? null : null;
  const blockingFailedJob =
    firstPendingIndex > 0
      ? sortedJobs
          .slice(0, firstPendingIndex)
          .find((job) => job.status === "failed") ?? null
      : null;
  const activeJob =
    sortedJobs.find((job) => job.status === "running") ??
    blockingFailedJob ??
    firstPendingJob ??
    sortedJobs.find((job) => job.status === "failed") ??
    null;
  const nextPendingJob = sortedJobs.find(
    (job) => job.status === "pending" && job.id !== activeJob?.id
  ) ?? null;
  const finishedCount = sortedJobs.filter((job) =>
    ["completed", "failed", "cancelled"].includes(job.status)
  ).length;

  if (!activeJob && finishedCount === 0) return null;

  const isRunning = activeJob?.status === "running";
  const statusIcon = !activeJob ? (
    <CheckCircle2 className="h-4 w-4 text-green-600" />
  ) : activeJob.status === "running" ? (
    <Loader2 className="h-4 w-4 animate-spin text-primary" />
  ) : activeJob.status === "pending" ? (
    <Clock3 className="h-4 w-4 text-amber-600" />
  ) : activeJob.status === "failed" ? (
    <AlertCircle className="h-4 w-4 text-red-600" />
  ) : (
    <CheckCircle2 className="h-4 w-4 text-green-600" />
  );

  return (
    <div className="fixed bottom-4 right-4 z-[70] w-[min(92vw,380px)] rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {statusIcon}
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-foreground">
                Subtopic Completeness Agent
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {activeJob
                  ? `${jobLabel(activeJob)} · ${activeJob.chapterTitle}`
                  : `${finishedCount} finished job(s)`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeJob &&
              ["pending", "running"].includes(activeJob.status) && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-lg px-2 text-xs"
                  onClick={() => cancelJob(activeJob.id)}
                >
                  <XCircle className="mr-1 h-3.5 w-3.5" />
                  Cancel
                </Button>
              )}
            {finishedCount > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 rounded-lg px-2 text-xs"
                onClick={clearFinishedJobs}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        {activeJob ? (
          <>
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Current step
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {activeJob.currentAction || stepLabel(activeJob)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Scheduled: {new Date(activeJob.originalScheduledAt).toLocaleString()}
              </p>
              {activeJob.status === "pending" && activeJob.scheduledAt !== activeJob.originalScheduledAt && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Updated start: {new Date(activeJob.scheduledAt).toLocaleString()}
                </p>
              )}
              {activeJob.status === "pending" && activeJob.retryCount > 0 && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Auto-retry attempt {activeJob.retryCount} is queued for this chapter.
                </p>
              )}
              {blockingFailedJob && activeJob.id === blockingFailedJob.id && firstPendingJob && (
                <p className="text-[11px] text-red-700 dark:text-red-300">
                  Queue paused. `{firstPendingJob.chapterTitle}` cannot start until this failed chapter is cleared.
                </p>
              )}
              {typeof activeJob.delayedMs === "number" && activeJob.delayedMs > 0 && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Delayed by {Math.max(1, Math.round(activeJob.delayedMs / 60000))} minute(s)
                  because the previous chapter was still running.
                </p>
              )}
              {activeJob.status === "pending" &&
                !blockingFailedJob &&
                new Date(activeJob.scheduledAt).getTime() > Date.now() && (
                  <p className="text-[11px] text-muted-foreground">
                    Waiting for scheduled start time.
                  </p>
                )}
              {activeJob.lastError && activeJob.status === "pending" && activeJob.retryCount > 0 && (
                <p className="mt-1 text-[11px] text-red-700 dark:text-red-300">
                  Last error: {activeJob.lastError}
                </p>
              )}
              {nextPendingJob && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Next chapter: {nextPendingJob.chapterTitle} at{" "}
                  {new Date(nextPendingJob.scheduledAt).toLocaleString()}
                </p>
              )}
              {activeJob.lastError && activeJob.status === "failed" && (
                <p className="mt-1 text-[11px] text-red-700 dark:text-red-300">
                  {activeJob.lastError}
                </p>
              )}
            </div>

            <details className="rounded-xl border border-border/70 bg-background/70 p-3">
              <summary className="cursor-pointer text-xs font-bold text-foreground">
                Recent log
              </summary>
              <ul className="mt-2 space-y-1">
                {activeJob.logs.slice(-8).map((line, index) => (
                  <li
                    key={`${activeJob.id}-${index}-${line}`}
                    className="text-[11px] leading-snug text-muted-foreground"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </details>

            {!isRunning && (
              <p className="text-[11px] text-muted-foreground">
                The agent stays visible after refresh because the queue is saved locally in your browser.
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            No active scheduled chapter right now.
          </p>
        )}
      </div>
    </div>
  );
}
