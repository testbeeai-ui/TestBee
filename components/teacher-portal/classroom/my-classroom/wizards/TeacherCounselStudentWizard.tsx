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
import { safeGetSession } from "@/lib/auth/safeSession";
import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import GeneratedMcqReview from "@/components/classroom/GeneratedMcqReview";
import { getAdvancedSetBounds } from "@/lib/play/quiz/advancedQuizSets";
import { fetchSubtopicContent } from "@/lib/curriculum/subtopicContentService";
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
} from "@/lib/mock/mockPapersFromSupabase";
import { fetchPastPapersFromSupabase } from "@/lib/mock/pastPapersFromSupabase";
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
  buildCounselMessage,
  counselApproachToMessageKind,
  counselApproachToNotificationTitle,
  type CounselApproach,
} from "@/lib/teacherPortal/studentNotificationCopy";
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
import { formatOptionalPercent, initials, statusPill } from "../utils/display";
import { normalizeTeacherMotivationExternalUrl } from "../utils/motivation-url";

export function TeacherCounselStudentWizard(props: {
  stepIdx: number; // 0..3
  classrooms: TeacherPortalClassroomCard[];
  classroomDetails: Record<string, TeacherPortalClassroomDetail>;
  onMotivateStudents: MyClassroomViewProps["onMotivateStudents"];
  toast: ReturnType<typeof useToast>["toast"];
  onDone: () => void;
  onJumpToStep?: (stepIdx: number) => void;
}) {
  const { toast } = props;
  const selectClassName =
    "h-10 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-[13px] outline-none focus:border-emerald-400 sm:text-sm";

  const defaultClassroomId = props.classrooms[0]?.id ?? "";
  const [classroomId, setClassroomId] = useState(defaultClassroomId);
  const detail = props.classroomDetails[classroomId];
  const rosterAll: TeacherPortalClassroomStudent[] = (detail?.students ?? []).filter(
    (s) => s.role !== "teacher"
  );
  const sections = detail?.sections ?? [];

  const [scope, setScope] = useState<
    { kind: "class" } | { kind: "unassigned" } | { kind: "section"; id: string }
  >({ kind: "class" });

  const roster = useMemo(() => {
    if (scope.kind === "class") return rosterAll;
    if (scope.kind === "unassigned") return rosterAll.filter((s) => s.sectionId == null);
    return rosterAll.filter((s) => (s.sectionId ?? null) === scope.id);
  }, [rosterAll, scope]);

  const sortedRoster = useMemo(
    () => [...roster].sort((a, b) => a.name.localeCompare(b.name)),
    [roster]
  );

  // IMPORTANT UX: start with no student selected. Don't auto-pick a student implicitly.
  const [studentId, setStudentId] = useState<string>("");
  const selectedStudent = useMemo(
    () => rosterAll.find((s) => s.userId === studentId) ?? null,
    [rosterAll, studentId]
  );

  const [weakAreasLoading, setWeakAreasLoading] = useState(false);
  const [weakAreasError, setWeakAreasError] = useState<string | null>(null);
  const [weakAreas, setWeakAreas] = useState<Array<{ topic: string; pct: number }>>([]);

  type CounsellingApproach = CounselApproach;
  const [approach, setApproach] = useState<CounsellingApproach>("remotivate");
  const [adviceTouched, setAdviceTouched] = useState(false);
  const [advice, setAdvice] = useState("");

  type RecommendActionId = "attempt_targeted_mock" | "post_doubt" | "watch_recorded" | "none";
  const recommendActions: Array<{ id: RecommendActionId; label: string }> = [
    { id: "attempt_targeted_mock", label: "Attempt a Testbee targeted mock" },
    { id: "post_doubt", label: "Post a doubt on Gyan++" },
    { id: "watch_recorded", label: "Watch recorded class on this topic" },
    { id: "none", label: "No specific action recommended" },
  ];
  const [recommendAction, setRecommendAction] =
    useState<RecommendActionId>("attempt_targeted_mock");
  const [recommendUrl, setRecommendUrl] = useState("");
  const [sending, setSending] = useState(false);

  const rankByAvgScore = useMemo(() => {
    if (!selectedStudent) return null;
    const ranked = [...rosterAll]
      .filter((s) => typeof s.avgScorePercent === "number")
      .sort((a, b) => (b.avgScorePercent ?? 0) - (a.avgScorePercent ?? 0));
    const idx = ranked.findIndex((s) => s.userId === selectedStudent.userId);
    if (idx < 0) return null;
    return idx + 1;
  }, [rosterAll, selectedStudent]);

  useEffect(() => {
    // When classroom changes, reset scope + student selection.
    setScope({ kind: "class" });
    setStudentId("");
  }, [classroomId]);

  useEffect(() => {
    // If current selection isn't in roster anymore (scope/classroom changed), clear it.
    if (!studentId) return;
    if (rosterAll.some((s) => s.userId === studentId)) return;
    setStudentId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    classroomId,
    scope.kind,
    "id" in scope ? scope.id : "",
    sortedRoster.length,
    rosterAll.length,
  ]);

  const scopeLabel =
    scope.kind === "class"
      ? "Whole classroom"
      : scope.kind === "unassigned"
        ? "Unassigned students"
        : (sections.find((s) => s.id === scope.id)?.name ?? "Section");

  const avgScore = selectedStudent?.avgScorePercent ?? null;
  const streakDays = selectedStudent?.streakDays ?? 0;
  const rdmBalance = selectedStudent?.rdm ?? 0;

  useEffect(() => {
    if (!classroomId || !selectedStudent?.userId) {
      setWeakAreas([]);
      setWeakAreasError(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setWeakAreasLoading(true);
      setWeakAreasError(null);
      try {
        const { session } = await safeGetSession();
        const res = await fetch(
          `/api/teacher/classrooms/${encodeURIComponent(classroomId)}/students/${encodeURIComponent(
            selectedStudent.userId
          )}/weak-areas`,
          {
            headers: session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {},
            credentials: "include",
          }
        );
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          weakAreas?: Array<{ topic: string; pct: number }>;
        };
        if (!res.ok) throw new Error(payload.error || `Request failed (${res.status})`);
        if (!cancelled) {
          setWeakAreas(Array.isArray(payload.weakAreas) ? payload.weakAreas : []);
        }
      } catch (e) {
        if (!cancelled) {
          setWeakAreas([]);
          setWeakAreasError(e instanceof Error ? e.message : "Could not load weak areas.");
        }
      } finally {
        if (!cancelled) setWeakAreasLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [classroomId, selectedStudent?.userId]);

  useEffect(() => {
    if (adviceTouched) return;
    if (!selectedStudent) {
      setAdvice("");
      return;
    }
    const avg = avgScore != null ? `${Math.round(avgScore)}%` : "your recent score";
    const streakLabel = streakDays > 0 ? `${streakDays}-day streak` : "streak restart";
    const rankLabel = rankByAvgScore != null ? `#${rankByAvgScore} in class` : "your rank";

    setAdvice(
      buildCounselMessage({
        approach,
        avgScoreLabel: avg,
        streakLabel,
        rankLabel,
      })
    );
  }, [approach, adviceTouched, selectedStudent, avgScore, streakDays, rankByAvgScore]);

  const actionKind = useMemo<"boost" | "nudge" | "urgent_nudge">(() => {
    if (!selectedStudent) return "nudge";
    if (selectedStudent.status === "at_risk") return "urgent_nudge";
    if (approach === "celebrate") return "boost";
    return "nudge";
  }, [selectedStudent, approach]);

  const step1 = (
    <div className="mt-3 space-y-2 sm:space-y-3">
      <div className="text-xs leading-relaxed text-slate-300">
        Choose the classroom + section, then pick the student you want to counsel.
      </div>

      <div className="grid gap-2 sm:gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-300">Classroom</label>
          <select
            value={classroomId}
            onChange={(e) => {
              setClassroomId(e.target.value);
              setAdviceTouched(false);
            }}
            className={selectClassName}
          >
            {props.classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-300">Section scope</label>
          <select
            value={
              scope.kind === "class"
                ? "__class__"
                : scope.kind === "unassigned"
                  ? "__unassigned__"
                  : scope.id
            }
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__class__") setScope({ kind: "class" });
              else if (v === "__unassigned__") setScope({ kind: "unassigned" });
              else setScope({ kind: "section", id: v });
              setAdviceTouched(false);
            }}
            className={selectClassName}
          >
            <option value="__class__">Whole classroom</option>
            <option value="__unassigned__">Unassigned students</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                Section: {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-300">Student</label>
        <select
          value={studentId}
          onChange={(e) => {
            setStudentId(e.target.value);
            setAdviceTouched(false);
          }}
          className={selectClassName}
          disabled={sortedRoster.length === 0}
        >
          {sortedRoster.length === 0 ? (
            <option value="" disabled>
              No students in this scope
            </option>
          ) : (
            <>
              <option value="" disabled>
                Select a student…
              </option>
              {sortedRoster.map((s) => (
                <option key={s.userId} value={s.userId}>
                  {s.name} — {s.status.replaceAll("_", " ")} {s.streakDays} days
                </option>
              ))}
            </>
          )}
        </select>
      </div>

      {selectedStudent ? (
        <div className="rounded-2xl border border-white/10 bg-[#0d0d1c] p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-xs font-bold text-slate-200">
              {initials(selectedStudent.name)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-slate-100 sm:text-sm">
                {selectedStudent.name}
              </div>
              <div className="text-[11px] text-slate-400">
                Scope: {scopeLabel} · Avg score{" "}
                {formatOptionalPercent(selectedStudent.avgScorePercent)} ·{" "}
                <span className={statusPill(selectedStudent.status)}>
                  {selectedStudent.status.replaceAll("_", " ")}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : sortedRoster.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-300">
          No students found in this scope.
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-300">
          No student selected yet. Pick a student to continue.
        </div>
      )}
    </div>
  );

  const emptyState = (body: string) => (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-300">
      <div className="font-semibold text-slate-100">No student selected</div>
      <div className="mt-1 text-slate-300">{body}</div>
      {props.onJumpToStep ? (
        <button
          type="button"
          onClick={() => props.onJumpToStep?.(0)}
          className="mt-3 inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
        >
          Go to Step 1 — Select student
        </button>
      ) : null}
    </div>
  );

  const step2 = (
    <div className="mt-3 space-y-2 sm:space-y-3">
      <div className="text-xs leading-relaxed text-slate-300">
        Here’s the student’s snapshot based on their real class data.
      </div>

      {!selectedStudent ? (
        emptyState("Pick a student in Step 1 to review their scores, streaks, and weak areas.")
      ) : (
        <div className="grid gap-2 sm:gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#0d0d1c] p-3 sm:p-4">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
              Avg mock score
            </div>
            <div className="mt-2 font-serif text-3xl text-violet-200">
              {avgScore != null ? `${Math.round(avgScore)}%` : "—"}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0d0d1c] p-3 sm:p-4">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
              Current streak
            </div>
            <div className="mt-2 font-serif text-3xl text-rose-200">{streakDays} days</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0d0d1c] p-3 sm:p-4">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
              RDM balance
            </div>
            <div className="mt-2 font-serif text-3xl text-amber-200">
              {rdmBalance.toLocaleString()}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0d0d1c] p-3 sm:p-4">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
              Class rank
            </div>
            <div className="mt-2 font-serif text-3xl text-emerald-200">
              {rankByAvgScore != null ? `#${rankByAvgScore}` : "—"}
            </div>
          </div>

          <div className="md:col-span-2 rounded-2xl border border-white/10 bg-[#0d0d1c] p-3 sm:p-4">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
              Weak areas (below 65%)
            </div>

            {weakAreasLoading ? (
              <div className="mt-3 text-xs text-slate-400">Loading weak areas…</div>
            ) : weakAreasError ? (
              <div className="mt-3 text-xs text-rose-200">{weakAreasError}</div>
            ) : weakAreas.length === 0 ? (
              <div className="mt-3 text-xs text-slate-400">
                No weak areas detected yet (or not enough data).
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {weakAreas.map((wa) => (
                  <div key={wa.topic} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-200">
                        {wa.topic}
                      </div>
                    </div>
                    <div className="flex w-48 items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full ${
                            wa.pct < 55
                              ? "bg-rose-400"
                              : wa.pct < 65
                                ? "bg-amber-400"
                                : "bg-emerald-400"
                          }`}
                          style={{ width: `${Math.max(0, Math.min(100, wa.pct))}%` }}
                        />
                      </div>
                      <div className="w-10 text-right text-xs font-semibold text-slate-200">
                        {wa.pct}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const step3 = (
    <div className="mt-3 space-y-2 sm:space-y-3">
      <div className="text-xs leading-relaxed text-slate-300">
        Choose a counselling approach (4 options) and write your personalised advice.
      </div>

      {!selectedStudent ? (
        emptyState("Pick a student in Step 1 to draft a counselling note.")
      ) : (
        <>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Counselling approach
            </label>
            <select
              value={approach}
              onChange={(e) => {
                setApproach(e.target.value as CounsellingApproach);
                setAdviceTouched(false);
              }}
              className={selectClassName}
            >
              <option value="remotivate">🔥 Re-motivate after break</option>
              <option value="weak_areas">📉 Address weak areas</option>
              <option value="celebrate">🏆 Celebrate progress</option>
              <option value="custom">✍ Write your own</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Your advice {selectedStudent ? `to ${selectedStudent.name.split(" ")[0]}` : ""}{" "}
              <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={5}
              value={advice}
              onChange={(e) => {
                setAdviceTouched(true);
                setAdvice(e.target.value);
              }}
              placeholder="Write your counselling note…"
              className="w-full rounded-xl border border-white/15 bg-[#070b17] px-3 py-2 text-[13px] leading-relaxed outline-none placeholder:text-slate-500 focus:border-emerald-400 sm:text-sm"
            />
          </div>
        </>
      )}
    </div>
  );

  const step4 = (
    <div className="mt-3 space-y-2 sm:space-y-3">
      <div className="text-xs leading-relaxed text-slate-300">
        Send your counselling message. RDM bonuses are only available on assignment-linked
        reminders (Assignment progress or Nudge wizard → Complete pending assignment).
      </div>

      {!selectedStudent ? (
        emptyState(
          "Select a student first. Once a student is chosen, you can send your advice here."
        )
      ) : (
        <>
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2.5 text-[11px] font-semibold leading-snug text-amber-200">
            Counselling is message-only for students. To attach an RDM bonus, use Assignment
            progress → Send reminder, or Nudge students with goal &quot;Complete pending
            assignment&quot;.
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Recommend a specific action
            </label>
            <select
              value={recommendAction}
              onChange={(e) => {
                const next = e.target.value as RecommendActionId;
                setRecommendAction(next);
                if (next !== "watch_recorded") setRecommendUrl("");
              }}
              className={selectClassName}
            >
              {recommendActions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {recommendAction === "watch_recorded" ? (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Recorded class link <span className="text-rose-300">*</span>
              </label>
              <input
                value={recommendUrl}
                onChange={(e) => setRecommendUrl(e.target.value)}
                placeholder="Paste the YouTube / Drive / website link…"
                className={selectClassName}
              />
              {!recommendUrl.trim() ? (
                <div className="mt-1 text-[11px] text-rose-200/90">
                  Link is required when recommending recorded classes.
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-[#070b17] p-3 sm:p-4">
            <div className="grid gap-2 text-xs">
              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-400">Sending to</span>
                <span className="text-slate-100 font-semibold">{selectedStudent?.name ?? "—"}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-400">RDM bonus</span>
                <span className="text-slate-100 font-semibold">None (advice only)</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-400">Delivery</span>
                <span className="text-slate-100 font-semibold">Notification bell</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={
                !selectedStudent ||
                !advice.trim() ||
                sending ||
                (recommendAction === "watch_recorded" && !recommendUrl.trim())
              }
              onClick={async () => {
                if (!selectedStudent) return;
                if (!advice.trim()) return;
                if (!classroomId) return;
                if (recommendAction === "watch_recorded" && !recommendUrl.trim()) return;
                setSending(true);
                try {
                  const actionText =
                    recommendActions.find((a) => a.id === recommendAction)?.label ?? "";
                  const recordedUrl =
                    recommendAction === "watch_recorded"
                      ? normalizeTeacherMotivationExternalUrl(recommendUrl)
                      : null;
                  if (recommendAction === "watch_recorded" && !recordedUrl) {
                    toast({
                      title: "Invalid link",
                      description: "Please paste a valid http(s) link (YouTube / Drive / website).",
                      variant: "destructive",
                    });
                    return;
                  }
                  await props.onMotivateStudents({
                    classroomId,
                    sectionId: scope.kind === "section" ? scope.id : null,
                    actionKind,
                    targetStudentIds: [selectedStudent.userId],
                    message: advice.trim(),
                    rdmDelta: 0,
                    recommendActionId: recommendAction,
                    recommendActionLabel: actionText || undefined,
                    recommendActionUrl:
                      recommendAction === "watch_recorded"
                        ? (recordedUrl ?? undefined)
                        : recommendAction === "attempt_targeted_mock"
                          ? "/mock-test"
                          : recommendAction === "post_doubt"
                            ? "/doubts"
                            : undefined,
                    studentMessageKind: counselApproachToMessageKind(approach, actionKind),
                    notificationTitle: counselApproachToNotificationTitle(approach),
                  });
                  toast({ title: "Counselling message sent" });
                  props.onDone();
                } catch (e) {
                  toast({
                    title: "Could not send message",
                    description: e instanceof Error ? e.message : "Try again.",
                    variant: "destructive",
                  });
                } finally {
                  setSending(false);
                }
              }}
              className="rounded-full bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-60 sm:px-6 sm:py-3"
            >
              {sending ? "Sending…" : "Send message"}
            </button>
          </div>
        </>
      )}
    </div>
  );

  if (!classroomId) {
    return (
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-300">
        No classroom found.
      </div>
    );
  }

  if (props.stepIdx === 0) return step1;
  if (props.stepIdx === 1) return step2;
  if (props.stepIdx === 2) return step3;
  return step4;
}
