"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CheckCircle2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { safeGetSession } from "@/lib/safeSession";
import type { AssignmentTaskStored } from "@/lib/classroom/assignmentTasks";
import {
  CLASSROOM_ASSIGNMENT_PROGRESS_EVENT,
  dispatchClassroomAssignmentProgressChanged,
  type ClassroomAssignmentProgressDetail,
} from "@/lib/classroom/assignmentProgressSync";
import { supabase } from "@/integrations/supabase/client";

/** Short TTL GET dedupe for task-progress (reduces polling churn). Cleared on local mutations. */
const TASK_PROGRESS_GET_TTL_MS = 45_000;
const taskProgressGetCache = new Map<
  string,
  {
    expiresAt: number;
    data: {
      tasks: AssignmentTaskStored[];
      completedTaskIds: string[];
      progressAvailable: boolean;
    };
  }
>();

function taskProgressCacheKey(classroomId: string, postId: string, userId: string) {
  return `${classroomId}:${postId}:${userId}`;
}

function sameTaskList(a: AssignmentTaskStored[], b: AssignmentTaskStored[]): boolean {
  if (a.length !== b.length) return false;
  const ids = new Set(a.map((t) => t.id));
  for (const t of b) {
    if (!ids.has(t.id)) return false;
  }
  return true;
}

interface QuizAttemptInfo {
  score: number;
  total: number;
  submittedAt: string;
}

type TaskResponseRow = {
  task_id: string;
  response_text: string | null;
  links: string[] | null;
  updated_at: string;
};

interface AssignmentTaskChecklistProps {
  classroomId: string;
  postId: string;
  /** Post type for UX decisions (e.g. Concept Focus collapses to one task). */
  postType?: string;
  /** Optional post title for labeling a collapsed single-task view. */
  postTitle?: string;
  /** When true, show all tasks (including teacher-only) without checkboxes */
  isTeacherView: boolean;
  /** When set, render checklist immediately; progress hydrates from API in the background */
  initialTasks?: AssignmentTaskStored[];
}

function collapseConceptFocusTasks(input: {
  tasks: AssignmentTaskStored[];
  postTitle?: string;
}): AssignmentTaskStored[] {
  const list = input.tasks;
  if (list.length <= 1) return list;
  const pick =
    list.find((t) => t.kind === "topic_path" && typeof t.href === "string" && t.href.trim()) ??
    list.find((t) => typeof t.href === "string" && t.href.trim()) ??
    null;
  if (!pick?.href) return list;

  const normalizeHref = (href: string) => {
    try {
      const url = href.startsWith("http") ? new URL(href) : new URL(href, "https://edublast.local");
      if (url.searchParams.get("panel") === "quiz") url.searchParams.set("panel", "concepts");
      return href.startsWith("http") ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return href;
    }
  };

  const title = (input.postTitle ?? "").trim();
  return [
    {
      id: "concept-focus-subtopic",
      kind: "topic_path",
      label: title ? `Open subtopic: ${title}` : "Open subtopic",
      href: normalizeHref(pick.href),
      visible_to_student: true,
      position: 0,
      reward_rdm: null,
    },
  ];
}

function parseQuizSetFromHref(href: string): string | null {
  if (!href) return null;
  try {
    const url =
      href.startsWith("http://") || href.startsWith("https://")
        ? new URL(href)
        : new URL(href, "https://edublast.local");
    const set = url.searchParams.get("quizSet");
    return set && /^[1-3]$/.test(set) ? set : null;
  } catch {
    return null;
  }
}

function taskLinkLabel(task: AssignmentTaskStored): string {
  // Use the actual task label which contains subtopic info (e.g., "Quiz on Photosynthesis")
  // Fall back to generic labels only if no label is set (legacy tasks)
  if (task.label && task.label.trim()) {
    return task.label;
  }
  switch (task.kind) {
    case "chapter_quiz": {
      const set = task.href ? parseQuizSetFromHref(task.href) : null;
      return set ? `Open chapter quiz — Set ${set}` : "Open chapter quiz";
    }
    case "gyan_engagement":
      return "Open Gyan++";
    case "mock_paper":
      return "Open mock test";
    case "past_paper":
      return "Open past paper";
    case "daily_dose":
      return "Open DailyDose Play";
    case "topic_path":
      return "Open theory";
    case "instacue":
      return "Open InstaCue cards";
    case "bits":
      return "Open numerals practice";
    default:
      return "Open activity";
  }
}

function withAssignmentTrackingParams(
  href: string,
  task: AssignmentTaskStored,
  classroomId: string,
  postId: string
): string {
  if (!href) return href;
  const shouldTrack =
    task.kind === "chapter_quiz" ||
    task.kind === "mock_paper" ||
    task.kind === "past_paper" ||
    href.startsWith("/mock");
  if (!shouldTrack) return href;
  try {
    const isAbsolute = /^https?:\/\//i.test(href);
    const url = isAbsolute ? new URL(href) : new URL(href, "https://edublast.local");
    if (!url.searchParams.get("classroomId")) url.searchParams.set("classroomId", classroomId);
    if (!url.searchParams.get("postId")) url.searchParams.set("postId", postId);
    return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}

export default function AssignmentTaskChecklist({
  classroomId,
  postId,
  postType,
  postTitle,
  isTeacherView,
  initialTasks,
}: AssignmentTaskChecklistProps) {
  const hasInitialShell = Boolean(initialTasks?.length);
  const shouldCollapseConceptFocus = !isTeacherView && postType === "Concept Focus";
  const [tasks, setTasks] = useState<AssignmentTaskStored[]>(() => initialTasks ?? []);
  const [completed, setCompleted] = useState<Set<string>>(() => new Set());
  const [progressAvailable, setProgressAvailable] = useState(true);
  const [loading, setLoading] = useState(() => !Boolean(initialTasks?.length));
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [quizScores, setQuizScores] = useState<Record<string, QuizAttemptInfo>>({});
  const [responsesByTaskId, setResponsesByTaskId] = useState<Record<string, TaskResponseRow>>({});
  const [draftTextByTaskId, setDraftTextByTaskId] = useState<Record<string, string>>({});
  const [draftLinksByTaskId, setDraftLinksByTaskId] = useState<Record<string, string>>({});
  const [submitBusyTaskId, setSubmitBusyTaskId] = useState<string | null>(null);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const isInteractingRef = useRef(false);

  const responseTasks = useMemo(
    () => tasks.filter((t) => !t.href && t.kind === "free_text"),
    [tasks]
  );

  const responsesHydratedRef = useRef(false);

  useEffect(() => {
    responsesHydratedRef.current = false;
  }, [postId]);

  useEffect(() => {
    if (!initialTasks?.length) return;
    setTasks(shouldCollapseConceptFocus ? collapseConceptFocusTasks({ tasks: initialTasks, postTitle }) : initialTasks);
  }, [initialTasks, postTitle, shouldCollapseConceptFocus]);

  const load = useCallback(
    async (opts?: { silent?: boolean; bypassCache?: boolean }) => {
      const silent = opts?.silent === true && hasLoadedOnceRef.current;
      const bypassCache = opts?.bypassCache === true;

      if (!silent) {
        setError(null);
        if (!hasInitialShell) setLoading(true);
      }

      try {
        const headers: HeadersInit = {};
        const { session } = await safeGetSession();
        const uid = session?.user?.id ?? "";
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

        const ck = taskProgressCacheKey(classroomId, postId, uid);
        if (silent && !bypassCache && uid) {
          const hit = taskProgressGetCache.get(ck);
          if (hit && Date.now() < hit.expiresAt) {
            const { tasks: cachedTasks, completedTaskIds, progressAvailable: pa } = hit.data;
            const loadedCompleted = new Set(completedTaskIds);
            setTasks((prev) => (sameTaskList(prev, cachedTasks) ? prev : cachedTasks));
            setCompleted(loadedCompleted);
            setProgressAvailable(pa);
            hasLoadedOnceRef.current = true;
            return;
          }
        }

        const res = await fetch(`/api/classroom/${classroomId}/posts/${postId}/task-progress`, {
          headers,
          credentials: "include",
        });
        const data = (await res.json()) as {
          tasks?: AssignmentTaskStored[];
          completedTaskIds?: string[];
          progressAvailable?: boolean;
          error?: string;
        };
        if (!res.ok) {
          if (!silent) {
            setError(data?.error ?? "Could not load tasks");
            setTasks([]);
            setCompleted(new Set());
            setProgressAvailable(true);
          }
          return;
        }
        const loadedTasks = Array.isArray(data.tasks) ? data.tasks : [];
        const nextTasks = shouldCollapseConceptFocus
          ? collapseConceptFocusTasks({ tasks: loadedTasks, postTitle })
          : loadedTasks;
        const loadedCompleted = new Set(
          Array.isArray(data.completedTaskIds) ? data.completedTaskIds : []
        );

        if (uid) {
          taskProgressGetCache.set(ck, {
            expiresAt: Date.now() + TASK_PROGRESS_GET_TTL_MS,
            data: {
              tasks: nextTasks,
              completedTaskIds: Array.from(loadedCompleted),
              progressAvailable: data.progressAvailable !== false,
            },
          });
        }

        if (silent && hasLoadedOnceRef.current) {
          setTasks((prev) => (sameTaskList(prev, nextTasks) ? prev : nextTasks));
        } else {
          setTasks(nextTasks);
        }
        setCompleted(loadedCompleted);
        setProgressAvailable(data.progressAvailable !== false);
        hasLoadedOnceRef.current = true;

        const needsResponses =
          !isTeacherView &&
          nextTasks.some((t) => !t.href && t.kind === "free_text") &&
          (!silent || !responsesHydratedRef.current);

        if (needsResponses) {
          setResponsesLoading(true);
          const respRes = await fetch(`/api/classroom/${classroomId}/posts/${postId}/task-response`, {
            headers,
            credentials: "include",
          });
          const respData = (await respRes.json().catch(() => ({}))) as {
            responses?: TaskResponseRow[];
            error?: string;
          };
          if (respRes.ok && Array.isArray(respData.responses)) {
            responsesHydratedRef.current = true;
            const map: Record<string, TaskResponseRow> = {};
            for (const r of respData.responses) {
              if (r && typeof r.task_id === "string") map[r.task_id] = r;
            }
            setResponsesByTaskId(map);
            setDraftTextByTaskId((prev) => {
              const next = { ...prev };
              for (const t of nextTasks) {
                if (t.kind !== "free_text" || t.href) continue;
                if (next[t.id] != null) continue;
                next[t.id] = map[t.id]?.response_text ?? "";
              }
              return next;
            });
            setDraftLinksByTaskId((prev) => {
              const next = { ...prev };
              for (const t of nextTasks) {
                if (t.kind !== "free_text" || t.href) continue;
                if (next[t.id] != null) continue;
                next[t.id] = (map[t.id]?.links ?? []).join("\n");
              }
              return next;
            });
          } else if (respRes.status !== 404 && respData?.error) {
            console.warn(respData.error);
          }
          setResponsesLoading(false);
        }

        if (!isTeacherView) {
          const quizTask = loadedTasks.find((t) => t.kind === "chapter_quiz");
          if (quizTask) {
            try {
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (user) {
                const genericClient = supabase as unknown as {
                  from: (table: string) => {
                    select: (columns: string) => {
                      eq: (
                        column: string,
                        value: string
                      ) => {
                        eq: (
                          column: string,
                          value: string
                        ) => {
                          maybeSingle: () => Promise<{
                            data: {
                              score?: number | null;
                              total?: number | null;
                              submitted_at?: string | null;
                            } | null;
                          }>;
                        };
                      };
                    };
                  };
                };
                const { data: attemptData } = await genericClient
                  .from("classroom_generated_test_attempts")
                  .select("score,total,submitted_at")
                  .eq("post_id", postId)
                  .eq("user_id", user.id)
                  .maybeSingle();
                const attemptRow = attemptData as {
                  score?: number | null;
                  total?: number | null;
                  submitted_at?: string | null;
                } | null;
                if (attemptRow?.submitted_at) {
                  setQuizScores({
                    [quizTask.id]: {
                      score: Number(attemptRow.score) || 0,
                      total: Number(attemptRow.total) || 0,
                      submittedAt: attemptRow.submitted_at,
                    },
                  });
                  loadedCompleted.add(quizTask.id);
                  setCompleted(new Set(loadedCompleted));
                }
              }
            } catch {
              // silent fail — attempt detection is best-effort
            }
          }
        }
      } catch {
        if (!silent) setError("Network error");
        if (!silent) setProgressAvailable(true);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [classroomId, postId, isTeacherView, hasInitialShell]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (isTeacherView) return;
    const onProgress = (ev: Event) => {
      const d = (ev as CustomEvent<ClassroomAssignmentProgressDetail>).detail;
      if (!d || d.classroomId !== classroomId || d.postId !== postId) return;
      void load({ silent: true, bypassCache: true });
    };
    window.addEventListener(CLASSROOM_ASSIGNMENT_PROGRESS_EVENT, onProgress);
    return () => window.removeEventListener(CLASSROOM_ASSIGNMENT_PROGRESS_EVENT, onProgress);
  }, [classroomId, postId, isTeacherView, load]);

  useEffect(() => {
    if (isTeacherView) return;
    const onFocus = () => void load({ silent: true, bypassCache: true });
    const onVisibility = () => {
      if (!document.hidden) void load({ silent: true, bypassCache: true });
    };
    const interval = window.setInterval(() => {
      if (isInteractingRef.current) return;
      void load({ silent: true });
    }, 60_000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isTeacherView, load]);

  const toggle = async (taskId: string, next: boolean) => {
    if (isTeacherView) return;
    setBusyId(taskId);
    setError(null);
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      const { session } = await safeGetSession();
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await fetch(`/api/classroom/${classroomId}/posts/${postId}/task-progress`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ taskId, completed: next }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        progressAvailable?: boolean;
      };
      if (!res.ok) {
        setError(data?.error ?? "Update failed");
        return;
      }
      if (data.progressAvailable === false) {
        setProgressAvailable(false);
        return;
      }
      setCompleted((prev) => {
        const n = new Set(prev);
        if (next) n.add(taskId);
        else n.delete(taskId);
        return n;
      });
      if (next) {
        dispatchClassroomAssignmentProgressChanged({ classroomId, postId });
      }
      const uid = session?.user?.id ?? "";
      if (uid) taskProgressGetCache.delete(taskProgressCacheKey(classroomId, postId, uid));
    } finally {
      setBusyId(null);
    }
  };

  const submitResponse = async (taskId: string) => {
    if (isTeacherView) return;
    setSubmitBusyTaskId(taskId);
    setError(null);
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      const { session } = await safeGetSession();
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const responseText = (draftTextByTaskId[taskId] ?? "").trim();
      const linksRaw = (draftLinksByTaskId[taskId] ?? "")
        .split(/[\n,]+/g)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10);
      const res = await fetch(`/api/classroom/${classroomId}/posts/${postId}/task-response`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          taskId,
          responseText,
          links: linksRaw,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        response?: TaskResponseRow;
        error?: string;
      };
      if (!res.ok) {
        setError(data?.error ?? "Submit failed");
        return;
      }
      if (data.response?.task_id) {
        setResponsesByTaskId((prev) => ({ ...prev, [data.response!.task_id]: data.response! }));
      } else {
        // Refresh if response row isn't returned for some reason.
        void load();
      }

      // UX: submitting a response implies the student completed this task.
      // Mark the task as done so the feed/card shows the completion state.
      if (!completed.has(taskId) && progressAvailable) {
        setCompleted((prev) => {
          const n = new Set(prev);
          n.add(taskId);
          return n;
        });
        const progRes = await fetch(`/api/classroom/${classroomId}/posts/${postId}/task-progress`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ taskId, completed: true }),
        });
        const progData = (await progRes.json().catch(() => ({}))) as {
          error?: string;
          progressAvailable?: boolean;
        };
        if (progData.progressAvailable === false) setProgressAvailable(false);
        if (!progRes.ok && progData?.error) {
          // Non-fatal: response saved; progress tick can be retried manually.
          console.warn(progData.error);
        } else if (progRes.ok) {
          dispatchClassroomAssignmentProgressChanged({ classroomId, postId });
        }
      }
      const uid = session?.user?.id ?? "";
      if (uid) taskProgressGetCache.delete(taskProgressCacheKey(classroomId, postId, uid));
    } finally {
      setSubmitBusyTaskId(null);
    }
  };

  if (loading && !hasInitialShell)
    return <div className="text-sm text-muted-foreground py-2">Loading checklist…</div>;
  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (tasks.length === 0) return null;

  const conceptFocusStudentDone =
    !isTeacherView &&
    postType === "Concept Focus" &&
    tasks.some((t) => completed.has(t.id));

  const conceptFocusDisplayTitle = (() => {
    const raw = (postTitle ?? "").trim();
    if (raw) return raw;
    const pick = tasks.find((t) => t.id === "concept-focus-subtopic") ?? tasks[0];
    const lab = (pick?.label ?? "").replace(/^Open subtopic:\s*/i, "").trim();
    return lab || "Subtopic";
  })();

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
          {isTeacherView ? "Task list (class view)" : postType === "Concept Focus" ? "Your subtopic" : "Your tasks"}
        </div>
        {!isTeacherView && postType === "Concept Focus" && conceptFocusStudentDone ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Done for class
          </span>
        ) : null}
      </div>
      <ul className="space-y-3">
        {tasks.map((t) => {
          const isAutoTrackedTask = t.kind === "chapter_quiz";
          const showResponseBox = !isTeacherView && t.kind === "free_text" && !t.href;
          const responseRow = responsesByTaskId[t.id] ?? null;
          const canTick =
            !isTeacherView && progressAvailable && showResponseBox && submitBusyTaskId !== t.id;
          return (
            <li key={t.id} className="flex items-start gap-3 text-sm">
              {canTick ? (
                <Checkbox
                  checked={completed.has(t.id)}
                  disabled={busyId !== null || isAutoTrackedTask}
                  onCheckedChange={(v) => {
                    if (isAutoTrackedTask) return;
                    void toggle(t.id, v === true);
                  }}
                  className="mt-0.5"
                />
              ) : null}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground">{t.label}</div>
                {!isTeacherView &&
                postType === "Concept Focus" &&
                completed.has(t.id) &&
                t.href ? (
                  <div className="mt-2 rounded-xl border border-pink-500/25 bg-linear-to-br from-pink-500/8 to-transparent px-3 py-2.5 dark:border-pink-400/20 dark:from-pink-950/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-pink-600 dark:text-pink-300">
                          <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Subtopic
                        </div>
                        <p className="mt-1 text-sm font-semibold leading-snug text-foreground">
                          {conceptFocusDisplayTitle}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          You finished the lesson checklist and marked complete. Your teacher sees this as
                          submitted.
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/12 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200">
                        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                        Done
                      </span>
                    </div>
                  </div>
                ) : t.href ? (
                  /^https?:\/\//i.test(t.href) ? (
                    <a
                      href={withAssignmentTrackingParams(t.href, t, classroomId, postId)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-bold text-primary transition hover:bg-primary/15"
                      aria-label={`${taskLinkLabel(t)} (open)`}
                    >
                      {postType === "Concept Focus" ? "Open lesson" : "Open"}
                    </a>
                  ) : t.href?.includes("/assignment-test/") ||
                    t.href?.includes("panel=quiz") ||
                    t.href?.startsWith("/mock?paper=") ? (
                    <a
                      href={withAssignmentTrackingParams(t.href, t, classroomId, postId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-bold text-primary transition hover:bg-primary/15"
                      aria-label={`${taskLinkLabel(t)} (open)`}
                    >
                      {postType === "Concept Focus" ? "Open lesson" : "Open"}
                    </a>
                  ) : (
                    <Link
                      href={withAssignmentTrackingParams(t.href, t, classroomId, postId)}
                      className="mt-2 inline-flex rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-bold text-primary transition hover:bg-primary/15"
                      aria-label={`${taskLinkLabel(t)} (open)`}
                    >
                      {postType === "Concept Focus" ? "Open lesson" : "Open"}
                    </Link>
                  )
                ) : null}
                {!isTeacherView &&
                t.href &&
                !(postType === "Concept Focus" && completed.has(t.id)) ? (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {t.kind === "chapter_quiz"
                      ? "Open the quiz, answer all MCQs, and submit to record your score."
                      : t.kind === "mock_paper"
                        ? "Open the mock paper and complete it. Submit to record your score."
                        : t.kind === "past_paper"
                          ? "Open the past paper and complete it. Submit to record your score."
                        : postType === "Concept Focus"
                          ? "Open the lesson, complete the checklist, then tap Mark as complete on the topic page."
                          : "Open the link, complete the task, then come back here."}
                  </div>
                ) : null}
                {showResponseBox ? (
                  <div className="mt-2 space-y-2 rounded-lg border border-border bg-background/60 p-3">
                    <div className="text-[11px] text-muted-foreground">
                      Optional: submit text and/or links. You can still just tick “Mark as done”.
                    </div>
                    {responsesLoading ? (
                      <div className="space-y-2">
                        <div className="h-22 w-full animate-pulse rounded-md border border-border bg-muted/40" />
                        <div className="h-14 w-full animate-pulse rounded-md border border-border bg-muted/40" />
                        <div className="h-9 w-36 animate-pulse rounded-md bg-muted/40" />
                      </div>
                    ) : (
                      <>
                        <textarea
                          value={draftTextByTaskId[t.id] ?? ""}
                          onChange={(e) =>
                            setDraftTextByTaskId((prev) => ({ ...prev, [t.id]: e.target.value }))
                          }
                          onFocus={() => {
                            isInteractingRef.current = true;
                          }}
                          onBlur={() => {
                            isInteractingRef.current = false;
                          }}
                          rows={4}
                          placeholder="Write your answer here…"
                          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                          disabled={submitBusyTaskId === t.id}
                        />
                        <textarea
                          value={draftLinksByTaskId[t.id] ?? ""}
                          onChange={(e) =>
                            setDraftLinksByTaskId((prev) => ({ ...prev, [t.id]: e.target.value }))
                          }
                          onFocus={() => {
                            isInteractingRef.current = true;
                          }}
                          onBlur={() => {
                            isInteractingRef.current = false;
                          }}
                          rows={2}
                          placeholder="Links (one per line)"
                          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                          disabled={submitBusyTaskId === t.id}
                        />
                      </>
                    )}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void submitResponse(t.id)}
                        disabled={submitBusyTaskId !== null || responsesLoading}
                        className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-xs font-extrabold text-primary-foreground disabled:opacity-50"
                      >
                        {submitBusyTaskId === t.id ? "Submitting…" : "Submit response"}
                      </button>
                      {responseRow?.updated_at ? (
                        <div className="text-[11px] text-muted-foreground">
                          Submitted {new Date(responseRow.updated_at).toLocaleString()}
                        </div>
                      ) : null}
                    </div>
                    {responseRow?.links && responseRow.links.length > 0 ? (
                      <div className="text-[11px] text-muted-foreground">
                        Links:
                        <ul className="mt-1 list-disc pl-5 space-y-0.5">
                          {responseRow.links.map((l) => (
                            <li key={l} className="break-all">
                              <a
                                href={l}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary underline underline-offset-2"
                              >
                                {l}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {!isTeacherView && isAutoTrackedTask ? (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    This task is auto-checked after quiz submission.
                  </div>
                ) : null}
                {quizScores[t.id] ? (
                  <div className="text-[11px] text-emerald-600 mt-0.5 font-semibold">
                    Score: {quizScores[t.id].score} / {quizScores[t.id].total}
                  </div>
                ) : null}
                {t.reward_rdm != null && t.reward_rdm > 0 ? (
                  <div className="text-[11px] text-amber-600 mt-0.5">
                    +{t.reward_rdm} RDM (when payouts are enabled)
                  </div>
                ) : null}
                {isTeacherView && !t.visible_to_student ? (
                  <div className="text-[11px] text-muted-foreground mt-1">Hidden from students</div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {isTeacherView ? (
        <p className="text-[11px] text-muted-foreground">
          Students tick items as they finish. Class completion updates in Teacher portal → My
          Classroom → Assignments.
        </p>
      ) : null}
      {!isTeacherView && !progressAvailable ? (
        <p className="text-[11px] text-muted-foreground">
          Progress tracking is temporarily unavailable. You can still open task links and complete
          this assignment.
        </p>
      ) : null}
    </div>
  );
}
