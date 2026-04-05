import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Board, Subject } from '@/types';

export const ORCHESTRATOR_LEVELS = ['advanced'] as const;
export type OrchestratorLevel = (typeof ORCHESTRATOR_LEVELS)[number];

export type OrchestratorSubtopicStep =
  | 'deep_dive'
  | 'instacue'
  | 'bits'
  | 'formulas';

export type OrchestratorPhase =
  | 'chapter_overview'
  | 'topic_hub'
  | 'subtopic'
  | 'final_audit'
  | 'done';

export type OrchestratorJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type OrchestratorRunMode = 'generate' | 'regenerate';

export type OrchestratorTopicBlueprint = {
  title: string;
  subtopics: string[];
};

export type OrchestratorCursor = {
  phase: OrchestratorPhase;
  topicIndex: number;
  levelIndex: number;
  subtopicIndex: number;
  subtopicStep: OrchestratorSubtopicStep;
};

export type OrchestratorJob = {
  id: string;
  board: Board;
  subject: Subject;
  classLevel: 11 | 12;
  mode: OrchestratorRunMode;
  unitLabel?: string | null;
  unitTitle?: string | null;
  chapterTitle: string;
  chapterKey: string;
  originalScheduledAt: string;
  scheduledAt: string;
  status: OrchestratorJobStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  delayedMs?: number;
  lastError?: string;
  currentAction?: string;
  retryCount: number;
  formulaRetryCount: number;
  logs: string[];
  topics: OrchestratorTopicBlueprint[];
  cursor: OrchestratorCursor;
};

type ScheduleChapterJobInput = {
  board: Board;
  subject: Subject;
  classLevel: 11 | 12;
  mode: OrchestratorRunMode;
  unitLabel?: string | null;
  unitTitle?: string | null;
  chapterTitle: string;
  scheduledAt: string;
  topics: OrchestratorTopicBlueprint[];
};

type ScheduleChapterJobResult =
  | { ok: true; job: OrchestratorJob }
  | { ok: false; existing: OrchestratorJob };

type OrchestratorState = {
  jobs: OrchestratorJob[];
  scheduleChapterJob: (input: ScheduleChapterJobInput) => ScheduleChapterJobResult;
  patchJob: (jobId: string, updater: Partial<OrchestratorJob> | ((job: OrchestratorJob) => OrchestratorJob)) => void;
  appendLog: (jobId: string, message: string) => void;
  shiftPendingJobsAfter: (jobId: string, delayMs: number) => void;
  cancelJob: (jobId: string) => void;
  clearFinishedJobs: () => void;
};

const DEFAULT_CURSOR: OrchestratorCursor = {
  phase: 'chapter_overview',
  topicIndex: 0,
  levelIndex: 0,
  subtopicIndex: 0,
  subtopicStep: 'deep_dive',
};

const ACTIVE_STATUSES: OrchestratorJobStatus[] = ['pending', 'running'];

function chapterKeyFor(input: {
  board: Board;
  subject: Subject;
  classLevel: 11 | 12;
  chapterTitle: string;
}): string {
  return [
    input.board.trim().toUpperCase(),
    input.subject.trim().toLowerCase(),
    String(input.classLevel),
    input.chapterTitle.trim().toLowerCase(),
  ].join('::');
}

function sortJobs(jobs: OrchestratorJob[]): OrchestratorJob[] {
  return [...jobs].sort((a, b) => {
    const timeDelta =
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    if (timeDelta !== 0) return timeDelta;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function normalizeTopics(
  topics: OrchestratorTopicBlueprint[]
): OrchestratorTopicBlueprint[] {
  return topics
    .map((topic) => ({
      title: String(topic.title ?? '').trim(),
      subtopics: Array.from(
        new Set(
          (Array.isArray(topic.subtopics) ? topic.subtopics : [])
            .map((subtopic) => String(subtopic ?? '').trim())
            .filter(Boolean)
        )
      ),
    }))
    .filter((topic) => topic.title && topic.subtopics.length > 0);
}

function trimLogs(logs: string[]): string[] {
  return logs.slice(-120);
}

export function getNextRunnableJob(jobs: OrchestratorJob[], nowMs = Date.now()): OrchestratorJob | null {
  const sorted = sortJobs(jobs).filter((job) => job.status !== 'cancelled');
  const running = sorted.find((job) => job.status === 'running');
  if (running) return running;

  const firstPendingIndex = sorted.findIndex((job) => job.status === 'pending');
  if (firstPendingIndex === -1) return null;

  const candidate = sorted[firstPendingIndex]!;
  const scheduledMs = new Date(candidate.scheduledAt).getTime();
  const earlierJobs = sorted.slice(0, firstPendingIndex);
  const hasBlockingEarlierFailure = earlierJobs.some((job) => job.status === 'failed');
  if (hasBlockingEarlierFailure) return null;

  const canStartImmediately =
    earlierJobs.length > 0 &&
    earlierJobs.every((job) => job.status === 'completed' || job.status === 'cancelled') &&
    earlierJobs.some((job) => job.status === 'completed');

  if (scheduledMs <= nowMs || canStartImmediately) {
    return candidate;
  }
  return null;
}

export const useOrchestratorStore = create<OrchestratorState>()(
  persist(
    (set) => ({
      jobs: [],

      scheduleChapterJob: (input) => {
        const chapterTitle = String(input.chapterTitle ?? '').trim();
        const scheduledAt = String(input.scheduledAt ?? '').trim();
        const topics = normalizeTopics(input.topics);
        if (!chapterTitle || !scheduledAt || topics.length === 0) {
          throw new Error('Invalid orchestrator job payload');
        }

        const chapterKey = chapterKeyFor({
          board: input.board,
          subject: input.subject,
          classLevel: input.classLevel,
          chapterTitle,
        });

        let result: ScheduleChapterJobResult = {
          ok: false,
          existing: {} as OrchestratorJob,
        };

        set((state) => {
          const existing = sortJobs(state.jobs).find(
            (job) =>
              job.chapterKey === chapterKey &&
              ACTIVE_STATUSES.includes(job.status)
          );
          if (existing) {
            result = { ok: false, existing };
            return state;
          }

          const nowIso = new Date().toISOString();
          const job: OrchestratorJob = {
            id:
              typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `orch-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            board: input.board,
            subject: input.subject,
            classLevel: input.classLevel,
            mode: input.mode,
            unitLabel: input.unitLabel ?? null,
            unitTitle: input.unitTitle ?? null,
            chapterTitle,
            chapterKey,
            originalScheduledAt: new Date(scheduledAt).toISOString(),
            scheduledAt: new Date(scheduledAt).toISOString(),
            status: 'pending',
            createdAt: nowIso,
            retryCount: 0,
            formulaRetryCount: 0,
            logs: trimLogs([
              `${new Date().toLocaleString()}: Slot allocated for ${new Date(
                scheduledAt
              ).toLocaleString()}.`,
            ]),
            topics,
            cursor: { ...DEFAULT_CURSOR },
          };
          result = { ok: true, job };
          return { jobs: sortJobs([...state.jobs, job]) };
        });

        return result;
      },

      patchJob: (jobId, updater) =>
        set((state) => ({
          jobs: sortJobs(
            state.jobs.map((job) => {
              if (job.id !== jobId) return job;
              const next =
                typeof updater === 'function'
                  ? updater(job)
                  : { ...job, ...updater };
              return {
                ...next,
                logs: trimLogs(Array.isArray(next.logs) ? next.logs : []),
              };
            })
          ),
        })),

      appendLog: (jobId, message) =>
        set((state) => ({
          jobs: state.jobs.map((job) =>
            job.id === jobId
              ? {
                  ...job,
                  logs: trimLogs([
                    ...job.logs,
                    `${new Date().toLocaleString()}: ${message}`,
                  ]),
                }
              : job
          ),
        })),

      shiftPendingJobsAfter: (_jobId, delayMs) =>
        set((state) => {
          if (!(delayMs > 0)) return state;
          const pendingIds = new Set(
            state.jobs.filter((job) => job.status === 'pending').map((job) => job.id)
          );
          if (pendingIds.size === 0) return state;

          return {
            jobs: sortJobs(
              state.jobs.map((job) => {
                if (!pendingIds.has(job.id)) return job;
                const shiftedTime = new Date(new Date(job.scheduledAt).getTime() + delayMs).toISOString();
                return {
                  ...job,
                  scheduledAt: shiftedTime,
                  delayedMs: (job.delayedMs ?? 0) + delayMs,
                  logs: trimLogs([
                    ...job.logs,
                    `${new Date().toLocaleString()}: Delayed by ${Math.max(
                      1,
                      Math.round(delayMs / 60000)
                    )} minute(s) because the previous chapter was still running.`,
                  ]),
                };
              })
            ),
          };
        }),

      cancelJob: (jobId) =>
        set((state) => ({
          jobs: state.jobs.map((job) =>
            job.id === jobId
              ? {
                  ...job,
                  status: job.status === 'completed' ? job.status : 'cancelled',
                  finishedAt:
                    job.status === 'completed'
                      ? job.finishedAt
                      : new Date().toISOString(),
                  currentAction:
                    job.status === 'completed' ? job.currentAction : 'Cancelled',
                }
              : job
          ),
        })),

      clearFinishedJobs: () =>
        set((state) => ({
          jobs: state.jobs.filter(
            (job) => !['completed', 'failed', 'cancelled'].includes(job.status)
          ),
        })),
    }),
    {
      name: 'edublast-orchestrator',
      version: 2,
      partialize: (state) => ({ jobs: state.jobs }),
    }
  )
);
