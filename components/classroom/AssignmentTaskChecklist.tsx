"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { safeGetSession } from "@/lib/safeSession";
import type { AssignmentTaskStored } from "@/lib/classroom/assignmentTasks";
import { supabase } from "@/integrations/supabase/client";

interface QuizAttemptInfo {
  score: number;
  total: number;
  submittedAt: string;
}

interface AssignmentTaskChecklistProps {
  classroomId: string;
  postId: string;
  /** When true, show all tasks (including teacher-only) without checkboxes */
  isTeacherView: boolean;
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
  if (!href || task.kind !== "chapter_quiz") return href;
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
  isTeacherView,
}: AssignmentTaskChecklistProps) {
  const [tasks, setTasks] = useState<AssignmentTaskStored[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(() => new Set());
  const [progressAvailable, setProgressAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [quizScores, setQuizScores] = useState<Record<string, QuizAttemptInfo>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: HeadersInit = {};
      const { session } = await safeGetSession();
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
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
        setError(data?.error ?? "Could not load tasks");
        setTasks([]);
        setCompleted(new Set());
        setProgressAvailable(true);
        return;
      }
      const loadedTasks = Array.isArray(data.tasks) ? data.tasks : [];
      const loadedCompleted = new Set(
        Array.isArray(data.completedTaskIds) ? data.completedTaskIds : []
      );
      setTasks(loadedTasks);
      setCompleted(loadedCompleted);
      setProgressAvailable(data.progressAvailable !== false);

      // Auto-detect quiz completion from attempts table for chapter_quiz tasks
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
      setError("Network error");
      setProgressAvailable(true);
    } finally {
      setLoading(false);
    }
  }, [classroomId, postId, isTeacherView]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (isTeacherView) return;
    const onFocus = () => void load();
    const onVisibility = () => {
      if (!document.hidden) void load();
    };
    const interval = window.setInterval(() => void load(), 20000);
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
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground py-2">Loading checklist…</div>;
  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (tasks.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
      <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
        {isTeacherView ? "Task list (class view)" : "Your tasks"}
      </div>
      <ul className="space-y-3">
        {tasks.map((t) => {
          const isAutoTrackedTask = t.kind === "chapter_quiz";
          return (
            <li key={t.id} className="flex items-start gap-3 text-sm">
              {!isTeacherView && progressAvailable ? (
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
                {t.href ? (
                  /^https?:\/\//i.test(t.href) ? (
                    <a
                      href={withAssignmentTrackingParams(t.href, t, classroomId, postId)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-bold text-primary transition hover:bg-primary/15"
                    >
                      {taskLinkLabel(t)}
                    </a>
                  ) : t.href?.includes("/assignment-test/") || t.href?.includes("panel=quiz") ? (
                    <a
                      href={withAssignmentTrackingParams(t.href, t, classroomId, postId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-bold text-primary transition hover:bg-primary/15"
                    >
                      {taskLinkLabel(t)}
                    </a>
                  ) : (
                    <Link
                      href={withAssignmentTrackingParams(t.href, t, classroomId, postId)}
                      className="mt-2 inline-flex rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-bold text-primary transition hover:bg-primary/15"
                    >
                      {taskLinkLabel(t)}
                    </Link>
                  )
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
