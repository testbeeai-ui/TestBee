"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  ExternalLink,
  Flame,
  Loader2,
  Plus,
  Settings,
  Star,
  Users,
  UserPlus,
  WandSparkles,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import InviteStudents from "@/components/InviteStudents";
import { useToast } from "@/hooks/use-toast";
import { useTopicTaxonomy } from "@/hooks/useTopicTaxonomy";
import { supabase } from "@/integrations/supabase/client";
import { safeGetSession } from "@/lib/safeSession";
import { fetchWithClientAuth } from "@/lib/clientApiAuth";
import GeneratedMcqReview from "@/components/classroom/GeneratedMcqReview";
import { getAdvancedSetBounds } from "@/lib/advancedQuizSets";
import { fetchSubtopicContent } from "@/lib/subtopicContentService";
import MeetSessionsStack from "@/components/teacher-portal/live/MeetSessionsStack";
import { redirectToGoogleCalendarConsent } from "@/lib/integrations/googleCalendarOAuthClient";
import {
  buildDefaultTasksForAssignmentType,
  normalizeTaskPositions,
  type AssignmentTaskStored,
} from "@/lib/classroom/assignmentTasks";
import ChapterQuizAssignmentFields from "@/components/teacher-portal/assignment/fields/ChapterQuizAssignmentFields";
import ConceptFocusAssignmentFields, {
  type ConceptFocusSelectionState,
  initialConceptFocusSelection,
  conceptFocusSelectionComplete,
} from "@/components/teacher-portal/assignment/fields/ConceptFocusAssignmentFields";
import ConceptFocusSubtopicPreview from "@/components/teacher-portal/assignment/fields/ConceptFocusSubtopicPreview";
import DailyDoseStreakAssignmentFields from "@/components/teacher-portal/assignment/fields/DailyDoseStreakAssignmentFields";
import GyanEngagementAssignmentFields from "@/components/teacher-portal/assignment/fields/GyanEngagementAssignmentFields";
import CreateAssignmentWizard from "@/components/teacher-portal/assignment/CreateAssignmentWizard";
import ScheduleLiveSessionPanel from "@/components/teacher-portal/live/ScheduleLiveSessionPanel";
import type { ScheduleLiveSessionPayload } from "@/components/teacher-portal/live/ScheduleLiveSessionPanel";
import CreateTestsView from "@/components/teacher-portal/views/tests/CreateTestsView";
import {
  fetchMockPapersFromSupabase,
  fetchMockQuestionsForPaper,
} from "@/lib/mockPapersFromSupabase";
import { fetchPastPapersFromSupabase } from "@/lib/pastPapersFromSupabase";
import {
  chapterQuizSelectionComplete,
  chapterQuizToRef,
  initialChapterQuizSelection,
  topicOptionLabel,
  topicsForChapter,
  type ChapterQuizSelectionState,
} from "@/lib/teacherPortal/chapterQuizUtils";
import type { MotivationNudgeGoal, MotivationRecommendActionId } from "@/lib/teacherPortal/queries";
import {
  DAILYDOSE_STREAK_TRACK_IDS,
  trackLabelById,
  type DailyDoseStreakTrackId,
} from "@/lib/teacherPortal/dailyDoseStreakTracks";
import WallTimeSelects from "@/components/teacher-portal/live/WallTimeSelects";
import type {
  TeacherPortalAssignmentItem,
  TeacherPortalClassroomCard,
  TeacherPortalClassroomDetail,
  TeacherPortalClassroomSection,
  TeacherPortalClassroomStudent,
  TeacherPortalChapterQuizRef,
  TeacherPortalDailyDoseStreakRef,
  TeacherPortalGyanEngagementRef,
  TeacherPortalMockNudgeLowScorer,
  TeacherPortalMockNudgeSubmittedAttempt,
  TeacherPortalMockPaperRef,
  TeacherPortalSummary,
} from "@/lib/teacherPortal/types";
import type { MockPaper, PastPaper } from "@/types";
import { assignmentPostDueStillActive } from "@/lib/teacherPortal/assignmentDueActive";
import { assignmentItemIsNudgeMcqTarget } from "@/lib/teacherPortal/nudgeMcqPosts";

import type { MyClassroomViewProps } from "../types";
import {
  mergeTeacherWizardScores,
  readTeacherWizardScoresCache,
  writeTeacherWizardScoresCache,
  type TeacherWizardScoreRow,
} from "./wizard-scores-cache";
import { formatRelativeTime, initials } from "../utils/display";


export function TeacherAssignmentProgressWizard(props: {
  variant: "compact";
  teacherId: string;
  classrooms: TeacherPortalClassroomCard[];
  classroomDetails: Record<string, TeacherPortalClassroomDetail>;
  onMotivateStudents: MyClassroomViewProps["onMotivateStudents"];
  toast: ReturnType<typeof useToast>["toast"];
  stepIdx: number; // 0..2
  onDone: () => void;
}) {
  const { toast } = props;

  type AssignmentScoreRow = TeacherWizardScoreRow;

  const [classroomId, setClassroomId] = useState<string>("");
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [assignmentId, setAssignmentId] = useState<string>("");

  const [scoresLoading, setScoresLoading] = useState(false);
  const [scoresRefreshing, setScoresRefreshing] = useState(false);
  const [scoresReady, setScoresReady] = useState(false);
  const [scores, setScores] = useState<AssignmentScoreRow[]>([]);
  const [scoresError, setScoresError] = useState<string | null>(null);
  const [scoresLastUpdatedAt, setScoresLastUpdatedAt] = useState<string | null>(null);

  const [reminderTarget, setReminderTarget] = useState<string>("all_pending");
  // Default to "no extra RDM" to match the reference UI.
  const [extraRdm, setExtraRdm] = useState<number>(0);
  const [message, setMessage] = useState<string>("");
  const [messageTouched, setMessageTouched] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [sentToastKey, setSentToastKey] = useState(0);

  const assignmentDraft = classroomId && assignmentId ? props.classroomDetails[classroomId]?.assignments.find((a) => a.id === assignmentId) ?? null : null;

  const detail = classroomId ? props.classroomDetails[classroomId] ?? null : null;
  const sections = detail?.sections ?? [];
  const roster = useMemo(() => {
    if (!detail) return [];
    const students = detail.students.filter((s) => s.role !== "teacher");
    if (!sectionId) return students;
    return students.filter((s) => (s.sectionId ?? null) === sectionId);
  }, [detail, sectionId]);

  const scoresRef = useRef(scores);
  scoresRef.current = scores;
  const rosterRef = useRef(roster);
  rosterRef.current = roster;
  const scoresReadyRef = useRef(scoresReady);
  scoresReadyRef.current = scoresReady;
  const lastWizardPollAtRef = useRef(0);

  const scopedAssignments = useMemo(() => {
    if (!detail) return [];
    // Scope filtering:
    // - Whole class: show only classroom-level assignments (sectionId = null)
    // - Section: show only assignments for that section
    if (!sectionId) return detail.assignments.filter((a) => a.sectionId == null);
    return detail.assignments.filter((a) => a.sectionId === sectionId);
  }, [detail, sectionId]);

  const pendingStudents = useMemo(() => {
    if (!detail || !scoresReady) return [];
    const submittedIds = new Set(scores.map((s) => s.userId));
    return roster.filter((s) => !submittedIds.has(s.userId));
  }, [detail, roster, scores, scoresReady]);

  const submittedStudents = useMemo(() => {
    if (!detail || !scoresReady) return [];
    const byUser = new Map<string, AssignmentScoreRow>();
    for (const s of scores) byUser.set(s.userId, s);
    return scores
      .slice()
      .sort((a, b) => {
        const aTs = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const bTs = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return bTs - aTs;
      })
      .map((s) => ({
        student: roster.find((r) => r.userId === s.userId) ?? null,
        scoreRow: byUser.get(s.userId)!, // exists by construction
      }))
      .filter((x) => x.student !== null);
  }, [detail, roster, scores, scoresReady]);

  const computedMessage = useMemo(() => {
    if (!assignmentDraft) return "";
    const dueIso = assignmentDraft.dueDateIso;
    const base = assignmentDraft.rewardRdm;
    const extra = extraRdm;
    const totalRdm = base + extra;
    let duePart = assignmentDraft.dueDateLabel;
    if (dueIso) {
      const ms = new Date(dueIso).getTime() - Date.now();
      const days = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
      duePart = days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`;
    }
    const extraPart = extra > 0 ? ` (+${extra} extra RDM)` : "";
    return `Hi! ⚡ Quick reminder — ${assignmentDraft.title} is due ${duePart}.\nTakes about 20 minutes and you earn +${totalRdm} RDM on completion${extraPart}. Go for it!`;
  }, [assignmentDraft, extraRdm]);

  useEffect(() => {
    if (props.stepIdx < 2) return;
    if (messageTouched) return;
    setMessage(computedMessage);
  }, [computedMessage, props.stepIdx, messageTouched]);

  // Auto-fill message the first time an assignment is selected.
  useEffect(() => {
    if (!assignmentDraft) return;
    if (messageTouched) return;
    setMessage(computedMessage);
  }, [assignmentDraft, computedMessage, messageTouched]);

  // Hydrate from shared cache + fetch as soon as classroom + assignment are chosen (step 1 prefetch).
  useEffect(() => {
    if (!classroomId || !assignmentId) {
      setScores([]);
      setScoresReady(false);
      setScoresError(null);
      setScoresLastUpdatedAt(null);
      setScoresLoading(false);
      setScoresRefreshing(false);
      return;
    }

    const cacheId = `${classroomId}:${assignmentId}`;
    lastWizardPollAtRef.current = 0;
    const cached = readTeacherWizardScoresCache(cacheId);
    if (cached?.scores?.length) {
      setScores(cached.scores);
      setScoresLastUpdatedAt(cached.updatedAt);
      setScoresReady(true);
    } else {
      setScores([]);
      setScoresReady(false);
      setScoresLastUpdatedAt(null);
    }

    let cancelled = false;

    const run = async (silent: boolean) => {
      if (silent) setScoresRefreshing(true);
      else if (!cached?.scores?.length) setScoresLoading(true);
      setScoresError(null);
      try {
        const { session } = await safeGetSession();
        const res = await fetch(
          `/api/classroom/${classroomId}/posts/${assignmentId}/generated-test-scores`,
          {
            headers: session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {},
            credentials: "include",
          }
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          scores?: Array<{
            userId: string;
            score: number;
            total: number;
            submittedAt: string | null;
          }>;
        };
        if (!res.ok) throw new Error(data.error ?? `Failed to load scores (${res.status}).`);
        if (cancelled) return;
        const incoming = Array.isArray(data.scores) ? (data.scores as AssignmentScoreRow[]) : [];
        const now = new Date().toISOString();
        setScores((prev) => {
          const merged = mergeTeacherWizardScores(prev, incoming);
          writeTeacherWizardScoresCache(cacheId, merged, now);
          return merged;
        });
        setScoresLastUpdatedAt(now);
        setScoresReady(true);
      } catch (e) {
        if (cancelled) return;
        setScoresError(e instanceof Error ? e.message : "Failed to load scores.");
        if (!cached?.scores?.length) {
          setScores([]);
          setScoresReady(false);
        }
      } finally {
        if (!cancelled) {
          setScoresLoading(false);
          setScoresRefreshing(false);
        }
      }
    };

    void run(false);

    return () => {
      cancelled = true;
    };
  }, [assignmentId, classroomId]);

  // Background refresh while on steps 2–3 (~30s). When no one is pending, throttle to ~90s.
  useEffect(() => {
    if (props.stepIdx < 1) return;
    if (!classroomId || !assignmentId) return;

    const cacheId = `${classroomId}:${assignmentId}`;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const rosterLen = rosterRef.current.length;
      const sc = scoresRef.current;
      const sr = scoresReadyRef.current;
      const pendingApprox =
        sr && rosterLen > 0 ? rosterLen - new Set(sc.map((x) => x.userId)).size : 1;
      const now = Date.now();
      if (sr && rosterLen > 0 && pendingApprox <= 0) {
        if (now - lastWizardPollAtRef.current < 90_000) return;
      }
      lastWizardPollAtRef.current = now;

      setScoresRefreshing(true);
      try {
        const { session } = await safeGetSession();
        const res = await fetch(
          `/api/classroom/${classroomId}/posts/${assignmentId}/generated-test-scores`,
          {
            headers: session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {},
            credentials: "include",
          }
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          scores?: AssignmentScoreRow[];
        };
        if (!res.ok) throw new Error(data.error ?? `Failed to load scores (${res.status}).`);
        if (cancelled) return;
        const incoming = Array.isArray(data.scores) ? data.scores : [];
        const iso = new Date().toISOString();
        setScores((prev) => {
          const merged = mergeTeacherWizardScores(prev, incoming);
          writeTeacherWizardScoresCache(cacheId, merged, iso);
          return merged;
        });
        setScoresLastUpdatedAt(iso);
        setScoresReady(true);
      } catch {
        // silent refresh — keep last known scores
      } finally {
        if (!cancelled) setScoresRefreshing(false);
      }
    };

    const intervalId = window.setInterval(() => {
      void tick();
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [assignmentId, classroomId, props.stepIdx]);

  const completion = useMemo(() => {
    const total = roster.length;
    if (!scoresReady) {
      return { total, completed: null as number | null, pct: null as number | null };
    }
    const rosterIds = new Set(roster.map((s) => s.userId));
    const completed = scores.filter((s) => rosterIds.has(s.userId)).length;
    const pct = total > 0 ? Math.round((completed / Math.max(1, total)) * 100) : 0;
    return { total, completed, pct };
  }, [roster, scores, scoresReady]);

  const visibleRows = useMemo(() => {
    if (!scoresReady) return [];
    const rosterSorted = [...roster].sort((a, b) => a.name.localeCompare(b.name));
    const submittedIds = new Set(scores.map((s) => s.userId));
    // Submitted first (sorted by submittedAt), then pending.
    const merged: Array<{ student: TeacherPortalClassroomStudent; row: AssignmentScoreRow | null }> = [];
    for (const sr of submittedStudents) {
      if (sr.student) merged.push({ student: sr.student, row: sr.scoreRow });
    }
    for (const st of rosterSorted) {
      if (!submittedIds.has(st.userId)) merged.push({ student: st, row: null });
    }
    return merged;
  }, [roster, scores, submittedStudents, scoresReady]);

  const hiddenRows = useMemo(() => {
    return visibleRows.length > 5 ? visibleRows.slice(5) : [];
  }, [visibleRows]);

  const hiddenSubmittedCount = useMemo(() => {
    return hiddenRows.filter((r) => Boolean(r.row)).length;
  }, [hiddenRows]);

  const hiddenPendingCount = useMemo(() => {
    return hiddenRows.filter((r) => !r.row).length;
  }, [hiddenRows]);

  const pendingCount = pendingStudents.length;
  const allPendingIds = pendingStudents.map((s) => s.userId);

  const preferredPendingStudents = useMemo(
    () => pendingStudents.filter((s) => s.status !== "active"),
    [pendingStudents]
  );
  const preferredPendingIds = preferredPendingStudents.map((s) => s.userId);

  const targetIds =
    reminderTarget === "all_pending"
      ? allPendingIds
      : reminderTarget === "preferred_pending"
        ? preferredPendingIds
        : pendingStudents.find((s) => s.userId === reminderTarget)?.userId
          ? [reminderTarget]
          : [];

  const targetStudents = useMemo(() => {
    if (reminderTarget === "all_pending") return pendingStudents;
    if (reminderTarget === "preferred_pending") return preferredPendingStudents;
    const one = pendingStudents.find((s) => s.userId === reminderTarget);
    return one ? [one] : [];
  }, [pendingStudents, preferredPendingStudents, reminderTarget]);

  const actionKind = useMemo<"boost" | "nudge" | "urgent_nudge">(() => {
    if (!targetStudents.length) return "nudge";
    return targetStudents.some((s) => s.status === "at_risk") ? "urgent_nudge" : "nudge";
  }, [targetStudents]);

  const baseRewardRdm = assignmentDraft?.rewardRdm ?? 15;
  const selectCompactClassName =
    "h-9 w-full appearance-none rounded-lg border border-white/15 bg-[#0b1020] px-2 pr-8 text-xs outline-none focus:border-emerald-400";

  const step1 = (
    <div className="space-y-3">
      <div className="text-xs text-slate-400">
        Choose the classroom + section scope, then pick an assignment to review.
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-300">Classroom *</label>
          <select
            value={classroomId}
            onChange={(e) => {
              const next = e.target.value;
              setClassroomId(next);
              setSectionId(null);
              setAssignmentId("");
              setScores([]);
              setScoresReady(false);
              setScoresError(null);
              setScoresLastUpdatedAt(null);
              setReminderTarget("all_pending");
              setExtraRdm(0);
              setMessage("");
              setMessageTouched(false);
            }}
            className={selectCompactClassName}
          >
            <option value="">Select classroom</option>
            {props.classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-300">Notify</label>
          <select
            value={sectionId ?? "__class__"}
            onChange={(e) => {
              const next = e.target.value;
              const nextSectionId = next === "__class__" ? null : next;
              setSectionId(nextSectionId);
              // Keep step data consistent with the chosen scope.
              setAssignmentId("");
              setScores([]);
              setScoresReady(false);
              setScoresError(null);
              setScoresLastUpdatedAt(null);
              setReminderTarget("all_pending");
              setMessage("");
              setMessageTouched(false);
              setExtraRdm(0);
            }}
            disabled={!classroomId}
            className={selectCompactClassName}
          >
            <option value="__class__">Whole class (all students)</option>
            {sections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                Only {sec.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-300">Assignment *</label>
        <select
          value={assignmentId}
          onChange={(e) => {
            const next = e.target.value;
            setAssignmentId(next);
            setScores([]);
            setScoresReady(false);
            setScoresError(null);
            setScoresLastUpdatedAt(null);
            setReminderTarget("all_pending");
            setMessage("");
            setMessageTouched(false);
            setExtraRdm(0);
          }}
          disabled={!classroomId}
          className={selectCompactClassName}
        >
          <option value="">Select assignment</option>
          {scopedAssignments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
              {a.dueDateLabel ? ` · due ${a.dueDateLabel}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-slate-400">
        {assignmentDraft ? (
          (() => {
            const total = Math.max(0, roster.length);
            const completed = scoresReady && completion.completed != null ? Math.max(0, completion.completed) : null;
            const pending = completed == null ? null : Math.max(0, total - completed);
            const dueIso = assignmentDraft.dueDateIso;
            const dueInDays =
              dueIso != null
                ? Math.max(
                    0,
                    Math.ceil(
                      (new Date(dueIso).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    )
                  )
                : null;

            return (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-200">{assignmentDraft.title}</span>
                {assignmentDraft.dueDateLabel ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px]">
                    Due {assignmentDraft.dueDateLabel}
                  </span>
                ) : null}
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                  {completed == null ? (
                    <>Syncing…</>
                  ) : (
                    <>
                      {completed}/{total} submitted
                    </>
                  )}
                </span>
                <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-200">
                  {pending == null ? <>Syncing…</> : <>{pending} pending</>}
                </span>
                {dueInDays != null ? (
                  <span className="text-[11px] text-slate-500">
                    · due in {dueInDays} day{dueInDays === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
            );
          })()
        ) : (
          <>Pick an assignment to start.</>
        )}
      </div>
    </div>
  );

  const step2View = (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-[#0d0d1c] p-3">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
            Progress
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400 transition-[width] duration-300"
                style={{
                  width: `${completion.pct == null ? 0 : completion.pct}%`,
                }}
              />
            </div>
            <div className="text-xs font-semibold text-emerald-200">
              {completion.pct == null ? "—" : `${completion.pct}%`}
            </div>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {completion.completed == null ? (
              <>Submission status syncing…</>
            ) : (
              <>
                {completion.completed}/{completion.total} submitted
              </>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-[11px] text-slate-500">
            {scoresLoading
              ? "Loading submissions…"
              : scoresRefreshing
                ? "Updating…"
                : scoresLastUpdatedAt
                  ? `Updated ${formatRelativeTime(scoresLastUpdatedAt)}`
                  : ""}
          </div>
          {scoresError ? <div className="mt-2 text-[11px] text-rose-200">{scoresError}</div> : null}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0b1020] p-3">
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
          Submission status
        </div>

        {!scoresReady ? (
          <div className="rounded-lg border border-dashed border-white/10 bg-black/10 p-4 text-center text-xs text-slate-400">
            {roster.length === 0
              ? "No students found in this scope."
              : scoresError
                ? scoresError
                : scoresLoading
                  ? "Loading submission status…"
                  : "Syncing…"}
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 bg-black/10 p-4 text-center text-xs text-slate-400">
            No students found in this scope.
          </div>
        ) : (
          <div className="space-y-2">
            {visibleRows.slice(0, 5).map((r) => {
              const submitted = Boolean(r.row);
              const pct = submitted && r.row ? Math.round((r.row.score / Math.max(1, r.row.total)) * 100) : null;
              return (
                <div
                  key={r.student.userId}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
                    submitted
                      ? "border-emerald-400/25 bg-emerald-500/10"
                      : "border-rose-400/25 bg-rose-500/10"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-[11px] font-bold text-slate-200">
                      {initials(r.student.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-200">{r.student.name}</div>
                      {submitted && r.row?.submittedAt ? (
                        <div className="text-[11px] text-slate-400">Submitted {formatRelativeTime(r.row.submittedAt)}</div>
                      ) : (
                        <div className="text-[11px] text-slate-400">Pending</div>
                      )}
                    </div>
                  </div>
                  <div className={`text-right text-sm font-semibold ${submitted ? "text-emerald-200" : "text-rose-200"}`}>
                    {submitted ? `Submitted • ${pct}%` : "Pending"}
                  </div>
                </div>
              );
            })}

            {visibleRows.length > 5 ? (
              <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
                + {hiddenRows.length} more students ({hiddenSubmittedCount} submitted, {hiddenPendingCount} pending)
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );

  const step3Reminder = (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-[#0d0d1c] p-3 text-xs text-slate-300">
        {!scoresReady ? (
          <>Checking who still needs to submit…</>
        ) : (
          <>
            {pendingCount} student{pendingCount === 1 ? "" : "s"} haven&apos;t submitted yet. Send them a quick reminder.
          </>
        )}
      </div>

      {sentToastKey > 0 ? (
        <div
          key={sentToastKey}
          className="animate-in fade-in slide-in-from-bottom-1 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-100"
          role="status"
          aria-live="polite"
        >
          Reminder sent. Students will see it in Notifications (not in Posts).
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-300">Send reminder to</label>
          <div className="relative">
            <select
              value={reminderTarget}
              onChange={(e) => setReminderTarget(e.target.value)}
              className={selectCompactClassName}
            >
              <option value="all_pending">
                All {!scoresReady ? "…" : pendingCount} pending students
              </option>
              <option
                value="preferred_pending"
                disabled={!scoresReady || !preferredPendingStudents.length}
              >
                Preferred {!scoresReady ? "…" : preferredPendingStudents.length} pending students
              </option>
              {pendingStudents.map((s) => (
                <option key={s.userId} value={s.userId}>
                  {s.name} only
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-300">Add RDM incentive?</label>
          <div className="relative">
            <select
              value={String(extraRdm)}
              onChange={(e) => setExtraRdm(Number(e.target.value))}
              className={selectCompactClassName}
            >
              <option value="0">No extra RDM (they already earn +{baseRewardRdm} on completion)</option>
              <option value="5">Add +5 RDM extra for submitting today</option>
              <option value="10">Add +10 RDM extra for submitting today</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-300">Reminder message</label>
        <textarea
          rows={4}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setMessageTouched(true);
          }}
          placeholder="Write a quick reminder…"
          className="w-full rounded-xl border border-white/15 bg-[#070b17] px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400"
          disabled={!assignmentDraft}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        {(() => {
          const canSendReminder =
            Boolean(assignmentDraft) &&
            !sendingReminder &&
            pendingCount > 0 &&
            targetIds.length > 0 &&
            message.trim().length > 0;
          return (
        <button
          type="button"
          disabled={!canSendReminder}
          onClick={async () => {
            if (!assignmentDraft) return;
            if (sendingReminder) return;
            if (pendingCount === 0) {
              toast({
                title: "No pending students",
                description: "Everyone in this scope has already submitted.",
              });
              return;
            }
            if (!targetIds.length) {
              toast({
                title: "Pick recipients",
                description: "Choose who you want to remind.",
              });
              return;
            }
            try {
              setSendingReminder(true);
              await props.onMotivateStudents({
                classroomId,
                sectionId: sectionId ?? undefined,
                actionKind,
                targetStudentIds: targetIds,
                message,
                rdmDelta: extraRdm,
                relatedPostId: assignmentId,
                relatedPostTitle: assignmentDraft.title,
                nudgeGoal: "complete_pending_assignment",
                notificationTitle: assignmentDraft.title?.trim()
                  ? `Teacher nudge: complete this assignment — ${assignmentDraft.title.trim()}`
                  : "Teacher nudge: complete this assignment",
              });
              toast({
                title: targetIds.length > 1 ? "Reminders sent" : "Reminder sent",
                description:
                  targetIds.length > 1
                    ? `Sent to ${targetIds.length} students.`
                    : "Sent to 1 student.",
              });
              setSentToastKey((k) => k + 1);
              window.setTimeout(() => setSentToastKey(0), 2200);
              props.onDone();
            } catch (e) {
              toast({
                title: "Could not send reminder",
                description: e instanceof Error ? e.message : "Try again.",
                variant: "destructive",
              });
            } finally {
              setSendingReminder(false);
            }
          }}
          className={`group inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-2 text-xs font-semibold text-black transition hover:bg-emerald-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${
            !canSendReminder ? "pointer-events-none blur-[0.2px]" : ""
          }`}
        >
          {sendingReminder ? (
            <>
              <span className="inline-flex h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
              Sending…
            </>
          ) : targetIds.length > 1 ? (
            "Send reminders"
          ) : (
            "Send reminder"
          )}
        </button>
          );
        })()}
      </div>
    </div>
  );

  if (!classroomId && props.stepIdx > 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-sm text-slate-300">
        Select classroom + assignment in step 1 first.
      </div>
    );
  }

  return props.stepIdx === 0 ? step1 : props.stepIdx === 1 ? step2View : step3Reminder;
}

