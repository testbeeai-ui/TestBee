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
import { defaultDueDateIsoDaysAhead, normalizeTeacherMotivationExternalUrl } from "../utils/motivation-url";


const EMPTY_MOCK_LOW_SCORER_ROWS: TeacherPortalMockNudgeLowScorer[] = [];
const EMPTY_SUBMITTED_ATTEMPT_ROWS: TeacherPortalMockNudgeSubmittedAttempt[] = [];

export type TeacherNudgeWithRdmWizardProps = {
  stepIdx: number;
  classrooms: TeacherPortalClassroomCard[];
  classroomDetails: Record<string, TeacherPortalClassroomDetail>;
  mockPostIdsAssignedThisWeek: string[];
  mockNudgeLowScorersByPostId: Record<string, TeacherPortalMockNudgeLowScorer[]>;
  mockNudgeSubmittedAttemptsByPostId: Record<string, TeacherPortalMockNudgeSubmittedAttempt[]>;
  teacherId: string;
  onCreateAssignment: MyClassroomViewProps["onCreateAssignment"];
  /** When false, hide inline mock/quiz creation (admin impersonation). */
  allowStructuredAssignmentCreate: boolean;
  onRequireVerifiedAction?: MyClassroomViewProps["onRequireVerifiedAction"];
  onMotivateStudents: MyClassroomViewProps["onMotivateStudents"];
  toast: ReturnType<typeof useToast>["toast"];
  onDone: () => void;
  /** Jump wizard steps from modals (e.g. back to Choose who when no recipients). */
  onJumpToStep?: (stepIdx: number) => void;
};

export type TeacherNudgeWithRdmWizardHandle = {
  canProceedFromStep: (stepIdx: number) => { ok: boolean; message?: string };
};

export const TeacherNudgeWithRdmWizard = forwardRef<TeacherNudgeWithRdmWizardHandle, TeacherNudgeWithRdmWizardProps>(
  function TeacherNudgeWithRdmWizard(props, ref) {
  const { toast, onCreateAssignment, onRequireVerifiedAction } = props;

  type NudgeTarget = "off_streak" | "low_scorers" | "specific_student";
  type NudgeGoal =
    | "restart_streak"
    | "complete_pending_assignment"
    | "attempt_mock"
    | "answer_doubts"
    | "revise_chapter"
    | "watch_recorded_class";

  const { taxonomy, loading: taxonomyLoading, error: taxonomyError } = useTopicTaxonomy();

  const selectCompactClassName =
    "h-10 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-[13px] outline-none focus:border-emerald-400 sm:text-sm";

  /** Hidden in UI for now; keep `attemptMockMode === "create"` branch below for easy re-enable. */
  const NUDGE_MOCK_SHOW_INLINE_CREATE = false;

  const rdmOptions: Array<{ label: string; value: number }> = [
    { label: "+5 RDM", value: 5 },
    { label: "+10 RDM", value: 10 },
    { label: "+25 RDM", value: 25 },
    { label: "+50 RDM", value: 50 },
    { label: "No RDM", value: 0 },
  ];

  const goalOptions: Array<{ id: NudgeGoal; label: string }> = [
    { id: "restart_streak", label: "Restart their study streak" },
    { id: "complete_pending_assignment", label: "Complete pending assignment" },
    { id: "attempt_mock", label: "Attempt a Testbee mock" },
    { id: "answer_doubts", label: "Answer doubts on Gyan++" },
    { id: "revise_chapter", label: "Concept focus" },
    { id: "watch_recorded_class", label: "Watch the recorded class" },
  ];

  const defaultClassroomId = props.classrooms[0]?.id ?? "";
  const [classroomId, setClassroomId] = useState(defaultClassroomId);
  const [target, setTarget] = useState<NudgeTarget>("off_streak");

  const weekMockClassroomIds = useMemo(() => {
    const ids = new Set<string>();
    for (const postId of props.mockPostIdsAssignedThisWeek) {
      for (const [cid, detail] of Object.entries(props.classroomDetails)) {
        if (detail.assignments.some((a) => a.id === postId && assignmentItemIsNudgeMcqTarget(a))) {
          ids.add(cid);
        }
      }
    }
    return ids;
  }, [props.mockPostIdsAssignedThisWeek, props.classroomDetails]);

  const classroomSelectList = useMemo(() => {
    if (target === "low_scorers") {
      return props.classrooms.filter((c) => weekMockClassroomIds.has(c.id));
    }
    return props.classrooms;
  }, [target, props.classrooms, weekMockClassroomIds]);

  const detail = props.classroomDetails[classroomId];
  const students: TeacherPortalClassroomStudent[] = (detail?.students ?? []).filter(
    (s) => s.role !== "teacher"
  );

  const offStreakStudents = useMemo(
    () => students.filter((s) => s.status === "off_streak"),
    [students]
  );

  const offStreakIdsKey = useMemo(() => {
    const roster = props.classroomDetails[classroomId]?.students ?? [];
    return roster
      .filter((s) => s.role !== "teacher" && s.status === "off_streak")
      .map((s) => s.userId)
      .sort()
      .join("|");
  }, [classroomId, props.classroomDetails]);

  const weekMocksForClassroom = useMemo(() => {
    const d = props.classroomDetails[classroomId];
    if (!d) return [];
    const ids = new Set(props.mockPostIdsAssignedThisWeek);
    return d.assignments.filter((a) => ids.has(a.id) && assignmentItemIsNudgeMcqTarget(a));
  }, [classroomId, props.classroomDetails, props.mockPostIdsAssignedThisWeek]);

  const [selectedMockPostId, setSelectedMockPostId] = useState("");
  const [selectedOffStreakIds, setSelectedOffStreakIds] = useState<Set<string>>(new Set());
  const [selectedLowScorerIds, setSelectedLowScorerIds] = useState<Set<string>>(new Set());
  const [selectedSpecificIds, setSelectedSpecificIds] = useState<Set<string>>(new Set());
  const [goal, setGoal] = useState<NudgeGoal>("restart_streak");
  const [pendingAssignmentPostId, setPendingAssignmentPostId] = useState("");
  /** Hub-only mock link removed from UI; state kept so stale bundles / partial HMR cannot ReferenceError. Always false. */
  const [attemptMockHubOnly, setAttemptMockHubOnly] = useState(false);
  const [attemptMockMode, setAttemptMockMode] = useState<"existing" | "create">("existing");
  const [mockExistingPostId, setMockExistingPostId] = useState("");
  const [mockCreateKind, setMockCreateKind] = useState<"mock" | "quiz">("quiz");
  const [chapterQuizSel, setChapterQuizSel] = useState<ChapterQuizSelectionState>(() =>
    initialChapterQuizSelection()
  );
  const [mockPapers, setMockPapers] = useState<MockPaper[]>([]);
  const [mockPapersLoading, setMockPapersLoading] = useState(false);
  const [mockPapersError, setMockPapersError] = useState<string | null>(null);
  const [selectedMockPaperId, setSelectedMockPaperId] = useState<string | null>(null);
  const [inlineCreateTitle, setInlineCreateTitle] = useState("");
  const [inlineCreateDueDate, setInlineCreateDueDate] = useState(() => defaultDueDateIsoDaysAhead(7));
  const [nudgeCreatedPostId, setNudgeCreatedPostId] = useState("");
  const [nudgeCreatedTitle, setNudgeCreatedTitle] = useState("");
  const [creatingInlineAssignment, setCreatingInlineAssignment] = useState(false);
  const [reviseConceptFocusSel, setReviseConceptFocusSel] = useState<ConceptFocusSelectionState>(() =>
    initialConceptFocusSelection()
  );
  /** Teacher-chosen due date for Concept Focus assignment (no default — pick in step 2). */
  const [conceptFocusDueDate, setConceptFocusDueDate] = useState("");
  const [watchRecordedUrl, setWatchRecordedUrl] = useState("");
  const [rdmDelta, setRdmDelta] = useState(10);
  const [messageTouched, setMessageTouched] = useState(false);
  const [message, setMessage] = useState(
    "Hey [name]! I noticed you haven't studied in 2 days. Your last score was great — don't let the streak break now. Come back today and I'm giving you a RDM boost to restart! 🔥"
  );
  const [sending, setSending] = useState(false);
  const [noRecipientsDialogOpen, setNoRecipientsDialogOpen] = useState(false);

  useEffect(() => {
    if (!attemptMockHubOnly) return;
    setAttemptMockHubOnly(false);
  }, [attemptMockHubOnly]);

  const lowScorerRows = useMemo(() => {
    const rows = props.mockNudgeLowScorersByPostId[selectedMockPostId];
    return rows ?? EMPTY_MOCK_LOW_SCORER_ROWS;
  }, [props.mockNudgeLowScorersByPostId, selectedMockPostId]);

  const lowScorerIdsKey = useMemo(
    () =>
      lowScorerRows
        .map((r) => r.userId)
        .sort()
        .join("|"),
    [lowScorerRows]
  );

  useEffect(() => {
    if (target === "low_scorers") {
      if (classroomSelectList.length === 0) return;
      if (!classroomSelectList.some((c) => c.id === classroomId)) {
        setClassroomId(classroomSelectList[0].id);
      }
      return;
    }
    if (props.classrooms.length === 0) return;
    if (!props.classrooms.some((c) => c.id === classroomId)) {
      setClassroomId(props.classrooms[0].id);
    }
  }, [target, classroomId, classroomSelectList, props.classrooms]);

  useEffect(() => {
    if (target !== "low_scorers") return;
    const mocks = weekMocksForClassroom;
    if (mocks.length === 0) {
      setSelectedMockPostId("");
      return;
    }
    if (!mocks.some((m) => m.id === selectedMockPostId)) {
      setSelectedMockPostId(mocks[0].id);
    }
  }, [target, classroomId, weekMocksForClassroom, selectedMockPostId]);

  useEffect(() => {
    if (target !== "off_streak") return;
    const ids = offStreakIdsKey ? offStreakIdsKey.split("|").filter(Boolean) : [];
    setSelectedOffStreakIds(new Set(ids));
  }, [target, classroomId, offStreakIdsKey]);

  useEffect(() => {
    if (target !== "low_scorers") return;
    const ids = lowScorerIdsKey ? lowScorerIdsKey.split("|").filter(Boolean) : [];
    setSelectedLowScorerIds(new Set(ids));
  }, [target, classroomId, selectedMockPostId, lowScorerIdsKey]);

  useEffect(() => {
    if (target !== "specific_student") return;
    setSelectedSpecificIds(new Set());
  }, [target, classroomId]);

  const selectedTargetStudentIds = useMemo(() => {
    if (target === "off_streak") {
      return offStreakStudents.filter((s) => selectedOffStreakIds.has(s.userId)).map((s) => s.userId);
    }
    if (target === "low_scorers") {
      const allowed = new Set(lowScorerRows.map((r) => r.userId));
      return [...selectedLowScorerIds].filter((id) => allowed.has(id));
    }
    if (target === "specific_student") {
      return [...selectedSpecificIds].filter((id) => students.some((s) => s.userId === id));
    }
    return [];
  }, [
    target,
    offStreakStudents,
    selectedOffStreakIds,
    lowScorerRows,
    selectedLowScorerIds,
    selectedSpecificIds,
    students,
  ]);

  useEffect(() => {
    if (selectedTargetStudentIds.length > 0) setNoRecipientsDialogOpen(false);
  }, [selectedTargetStudentIds.length]);

  const actionKind = useMemo<"boost" | "nudge" | "urgent_nudge">(() => {
    const anyAtRisk = selectedTargetStudentIds.some((id) => {
      const s = students.find((x) => x.userId === id);
      return s?.status === "at_risk";
    });
    return anyAtRisk ? "urgent_nudge" : "nudge";
  }, [selectedTargetStudentIds, students]);

  const classroomAssignments = useMemo(
    () => detail?.assignments ?? [],
    [detail?.assignments]
  );

  /** Pending-assignment nudge: omit past-due posts so teachers only pick still-active work. */
  const activePendingAssignments = useMemo(
    () => classroomAssignments.filter(assignmentPostDueStillActive),
    [classroomAssignments]
  );

  const mcqTargetAssignments = useMemo(
    () => classroomAssignments.filter((a) => assignmentItemIsNudgeMcqTarget(a)),
    [classroomAssignments]
  );

  const reviseConceptFocusSummary = useMemo(() => {
    const sel = reviseConceptFocusSel;
    if (!conceptFocusSelectionComplete(sel, taxonomy)) return "";
    if (sel.classLevel == null || !sel.subject || sel.chapterTitle == null || sel.topicIndex == null) return "";
    const topicRows = topicsForChapter(taxonomy, sel.subject, sel.classLevel, sel.chapterTitle);
    const node = topicRows[sel.topicIndex];
    const topicLbl = node ? topicOptionLabel(node) : "";
    const st = sel.subtopicName?.trim() ?? "";
    return [sel.chapterTitle, topicLbl, st].filter(Boolean).join(" · ");
  }, [reviseConceptFocusSel, taxonomy]);

  useEffect(() => {
    if (goal !== "attempt_mock" || mockCreateKind !== "mock") return;
    if (!props.allowStructuredAssignmentCreate) return;
    let cancelled = false;
    const run = async () => {
      setMockPapersLoading(true);
      setMockPapersError(null);
      try {
        const rows = await fetchMockPapersFromSupabase();
        if (!cancelled) {
          setMockPapers(rows);
          setSelectedMockPaperId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : rows[0]?.id ?? null));
        }
      } catch (e) {
        if (!cancelled) setMockPapersError(e instanceof Error ? e.message : "Could not load mock papers.");
      } finally {
        if (!cancelled) setMockPapersLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [goal, mockCreateKind, props.allowStructuredAssignmentCreate]);

  useEffect(() => {
    if (goal !== "complete_pending_assignment") return;
    if (activePendingAssignments.length === 0) {
      setPendingAssignmentPostId("");
      return;
    }
    setPendingAssignmentPostId((prev) =>
      prev && activePendingAssignments.some((a) => a.id === prev)
        ? prev
        : activePendingAssignments[0].id
    );
  }, [goal, activePendingAssignments]);

  useEffect(() => {
    if (goal === "attempt_mock" && !NUDGE_MOCK_SHOW_INLINE_CREATE && attemptMockMode === "create") {
      setAttemptMockMode("existing");
      setNudgeCreatedPostId("");
      setNudgeCreatedTitle("");
    }
  }, [goal, attemptMockMode, NUDGE_MOCK_SHOW_INLINE_CREATE]);

  useEffect(() => {
    if (goal !== "attempt_mock" || attemptMockMode !== "existing") return;
    if (mcqTargetAssignments.length === 0) {
      setMockExistingPostId("");
      return;
    }
    setMockExistingPostId((prev) =>
      prev && mcqTargetAssignments.some((a) => a.id === prev) ? prev : mcqTargetAssignments[0].id
    );
  }, [goal, attemptMockMode, mcqTargetAssignments]);

  useEffect(() => {
    setNudgeCreatedPostId("");
    setNudgeCreatedTitle("");
    setAttemptMockMode("existing");
    setAttemptMockHubOnly(false);
    setReviseConceptFocusSel(initialConceptFocusSelection());
    setConceptFocusDueDate("");
  }, [classroomId]);

  useImperativeHandle(ref, () => ({
    canProceedFromStep(stepIdx: number) {
      if (stepIdx === 0) {
        if (selectedTargetStudentIds.length === 0) {
          return { ok: false, message: "Select at least one student to nudge." };
        }
        return { ok: true };
      }
      if (stepIdx === 1) {
        switch (goal) {
          case "complete_pending_assignment":
            if (activePendingAssignments.length === 0) {
              return {
                ok: false,
                message:
                  "No active assignments (due date passed). Extend due dates in My Classroom or pick another goal.",
              };
            }
            if (
              !pendingAssignmentPostId ||
              !activePendingAssignments.some((a) => a.id === pendingAssignmentPostId)
            ) {
              return { ok: false, message: "Choose one active assignment for everyone to complete." };
            }
            return { ok: true };
          case "attempt_mock":
            if (attemptMockMode === "existing") {
              if (!mockExistingPostId || !mcqTargetAssignments.some((a) => a.id === mockExistingPostId)) {
                return {
                  ok: false,
                  message:
                    mcqTargetAssignments.length === 0
                      ? "No mock, chapter quiz, or MCQ assignment in this class to link. Add one from My Classroom, or pick another goal."
                      : "Choose a mock or quiz assignment.",
                };
              }
              return { ok: true };
            }
            if (!props.allowStructuredAssignmentCreate) {
              return { ok: false, message: "Inline assignment creation is unavailable in this mode." };
            }
            if (!nudgeCreatedPostId) {
              return { ok: false, message: 'Use "Create & attach assignment" before continuing.' };
            }
            return { ok: true };
          case "revise_chapter":
            if (!conceptFocusSelectionComplete(reviseConceptFocusSel, taxonomy)) {
              return {
                ok: false,
                message: "Complete Concept focus: class, subject, chapter, lesson, and subtopic.",
              };
            }
            if (props.allowStructuredAssignmentCreate) {
              const d = conceptFocusDueDate.trim();
              if (!d) {
                return { ok: false, message: "Choose a due date for the Concept Focus assignment." };
              }
              if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
                return { ok: false, message: "Enter a valid due date." };
              }
            }
            return { ok: true };
          case "watch_recorded_class":
            if (!normalizeTeacherMotivationExternalUrl(watchRecordedUrl)) {
              return { ok: false, message: "Paste a valid http(s) link for the recorded class." };
            }
            return { ok: true };
          default:
            return { ok: true };
        }
      }
      return { ok: true };
    },
  }), [
    goal,
    activePendingAssignments,
    pendingAssignmentPostId,
    attemptMockMode,
    mockExistingPostId,
    mcqTargetAssignments,
    props.allowStructuredAssignmentCreate,
    nudgeCreatedPostId,
    reviseConceptFocusSel,
    taxonomy,
    watchRecordedUrl,
    conceptFocusDueDate,
    selectedTargetStudentIds,
  ]);

  useEffect(() => {
    if (messageTouched) return;
    const rdmPart = rdmDelta > 0 ? ` (+${rdmDelta} RDM)` : "";
    const pendingTitle =
      classroomAssignments.find((a) => a.id === pendingAssignmentPostId)?.title?.trim() ?? "";
    const mockTitle =
      attemptMockMode === "existing"
        ? classroomAssignments.find((a) => a.id === mockExistingPostId)?.title?.trim() ?? ""
        : nudgeCreatedTitle.trim();
    const reviseBit = reviseConceptFocusSummary;
    const base = (() => {
      switch (goal) {
        case "restart_streak":
          return `Hey [name]! Let's keep the momentum going — continuing the streak you've started together really matters. Come back today and I'm giving you a RDM boost${rdmPart}! 🔥`;
        case "complete_pending_assignment":
          return `Hey [name]!${pendingTitle ? ` Please complete "${pendingTitle}"` : " Your pending assignment is waiting"} — finish it today and I'm giving you a RDM boost${rdmPart}!`;
        case "attempt_mock":
          return mockTitle
            ? `Hey [name]! Please attempt "${mockTitle}" today — I'm giving you a RDM boost${rdmPart}!`
            : `Hey [name]! I recommend a quick Testbee mock or chapter quiz to build momentum. Attempt it today and I'm giving you a RDM boost${rdmPart}!`;
        case "answer_doubts":
          return `Hey [name]! Post your doubts on Gyan++ today so we can clear them together — I'm giving you a RDM boost${rdmPart}!`;
        case "revise_chapter":
          return reviseBit
            ? `Hey [name]! Let's focus on ${reviseBit} and lock in concepts today — I'm giving you a RDM boost${rdmPart}!`
            : `Hey [name]! Let's lock in today's concept focus — I'm giving you a RDM boost${rdmPart}!`;
        case "watch_recorded_class":
          return `Hey [name]! Watch the recorded lesson${watchRecordedUrl.trim() ? " I've linked" : ""} and catch up quickly — I'm giving you a RDM boost${rdmPart}!`;
        default:
          return `Hey [name]! I'm nudging you to keep learning momentum going. Complete the next step and earn${rdmPart} 🎯`;
      }
    })();

    setMessage(base);
  }, [
    goal,
    rdmDelta,
    messageTouched,
    classroomAssignments,
    pendingAssignmentPostId,
    attemptMockMode,
    mockExistingPostId,
    nudgeCreatedTitle,
    reviseConceptFocusSummary,
    watchRecordedUrl,
  ]);

  const step2GoalSummaryDetail = useMemo(() => {
    switch (goal) {
      case "restart_streak":
        return "";
      case "complete_pending_assignment":
        return classroomAssignments.find((a) => a.id === pendingAssignmentPostId)?.title ?? "";
      case "attempt_mock":
        if (attemptMockMode === "existing") {
          return classroomAssignments.find((a) => a.id === mockExistingPostId)?.title ?? "";
        }
        return nudgeCreatedTitle.trim() || (nudgeCreatedPostId ? "New assignment attached" : "");
      case "answer_doubts":
        return "/doubts";
      case "revise_chapter": {
        const due = conceptFocusDueDate.trim();
        const dueBit = due ? `Due ${due}` : "";
        return [reviseConceptFocusSummary, dueBit].filter(Boolean).join(" · ");
      }
      case "watch_recorded_class":
        return watchRecordedUrl.trim();
      default:
        return "";
    }
  }, [
    goal,
    classroomAssignments,
    pendingAssignmentPostId,
    attemptMockMode,
    mockExistingPostId,
    nudgeCreatedTitle,
    nudgeCreatedPostId,
    reviseConceptFocusSummary,
    watchRecordedUrl,
    conceptFocusDueDate,
  ]);

  const motivationNudgeMeta = useMemo((): {
    nudgeGoal: MotivationNudgeGoal;
    notificationTitle?: string;
  } => {
    switch (goal) {
      case "restart_streak":
        return {
          nudgeGoal: "restart_streak",
          notificationTitle: "Teacher nudge: get back on your study streak",
        };
      case "complete_pending_assignment": {
        const t =
          classroomAssignments.find((a) => a.id === pendingAssignmentPostId)?.title?.trim() ?? "";
        return {
          nudgeGoal: "complete_pending_assignment",
          notificationTitle: t
            ? `Teacher nudge: complete this assignment — ${t}`
            : "Teacher nudge: complete this assignment",
        };
      }
      case "attempt_mock":
        return { nudgeGoal: "attempt_mock" };
      case "answer_doubts":
        return {
          nudgeGoal: "answer_doubts",
          notificationTitle: "Teacher nudge: share your doubt on Gyan++",
        };
      case "revise_chapter":
        return {
          nudgeGoal: "revise_chapter",
          notificationTitle: "Teacher nudge: focus this topic",
        };
      case "watch_recorded_class":
        return {
          nudgeGoal: "watch_recorded_class",
          notificationTitle: "Teacher nudge: watch the class recording",
        };
    }
  }, [goal, classroomAssignments, pendingAssignmentPostId]);

  const motivateExtras = useMemo(() => {
    switch (goal) {
      case "restart_streak":
        return {};
      case "complete_pending_assignment": {
        const a = classroomAssignments.find((x) => x.id === pendingAssignmentPostId);
        return {
          relatedPostId: pendingAssignmentPostId,
          relatedPostTitle: a?.title,
        };
      }
      case "attempt_mock": {
        const postId = attemptMockMode === "existing" ? mockExistingPostId : nudgeCreatedPostId;
        const a = classroomAssignments.find((x) => x.id === postId);
        const title = a?.title ?? nudgeCreatedTitle.trim() ?? "";
        return { relatedPostId: postId, relatedPostTitle: title };
      }
      case "answer_doubts":
        return {
          recommendActionId: "post_doubt" as const,
          recommendActionLabel: "Open Gyan++",
          recommendActionUrl: "/doubts",
        };
      case "revise_chapter":
        return {};
      case "watch_recorded_class": {
        const u = normalizeTeacherMotivationExternalUrl(watchRecordedUrl);
        if (!u) return {};
        return {
          recommendActionId: "watch_recorded" as const,
          recommendActionLabel: "Open link",
          recommendActionUrl: u,
        };
      }
      default:
        return {};
    }
  }, [
    goal,
    classroomAssignments,
    pendingAssignmentPostId,
    attemptMockMode,
    mockExistingPostId,
    nudgeCreatedPostId,
    nudgeCreatedTitle,
    watchRecordedUrl,
  ]);

  const selectedMockPaper = useMemo(
    () => mockPapers.find((p) => p.id === selectedMockPaperId) ?? null,
    [mockPapers, selectedMockPaperId]
  );

  const chapterQuizRefForCreate = useMemo(() => {
    if (mockCreateKind !== "quiz") return null;
    return chapterQuizToRef(chapterQuizSel, taxonomy);
  }, [mockCreateKind, chapterQuizSel, taxonomy]);

  const canSubmitInlineCreate = useMemo(() => {
    if (!props.allowStructuredAssignmentCreate) return false;
    if (attemptMockMode !== "create" || goal !== "attempt_mock") return false;
    if (mockCreateKind === "quiz") return chapterQuizSelectionComplete(chapterQuizSel, taxonomy);
    return Boolean(!mockPapersLoading && selectedMockPaper);
  }, [
    props.allowStructuredAssignmentCreate,
    attemptMockMode,
    goal,
    mockCreateKind,
    chapterQuizSel,
    taxonomy,
    mockPapersLoading,
    selectedMockPaper,
  ]);

  const runInlineCreateAssignment = useCallback(async () => {
    if (!canSubmitInlineCreate || selectedTargetStudentIds.length === 0) return;
    if (onRequireVerifiedAction) {
      const ok = await onRequireVerifiedAction("Create assignment");
      if (!ok) return;
    }
    setCreatingInlineAssignment(true);
    try {
      const assignLabel =
        selectedTargetStudentIds.length === students.length
          ? "All students"
          : `Custom (${selectedTargetStudentIds.length})`;
      if (mockCreateKind === "quiz") {
        const cq = chapterQuizRefForCreate;
        if (!cq) throw new Error("Chapter quiz selection incomplete.");
        const title = inlineCreateTitle.trim() || "Chapter Quiz (MCQs)";
        const tasks = normalizeTaskPositions(buildDefaultTasksForAssignmentType("Chapter Quiz (MCQs)"));
        const created = await onCreateAssignment({
          classroomId,
          sectionId: null,
          assignmentType: "quiz",
          title,
          dueDate: inlineCreateDueDate.trim() || null,
          assignToLabel: assignLabel,
          targetStudentIds: selectedTargetStudentIds,
          rewardRdm: 15,
          instructions: "",
          tasks,
          chapterQuiz: cq,
        });
        setNudgeCreatedPostId(created.id);
        setNudgeCreatedTitle(title);
      } else {
        if (!selectedMockPaper) throw new Error("Choose a mock paper.");
        const title =
          inlineCreateTitle.trim() || selectedMockPaper.title.trim() || "Mock Paper (full length)";
        const tasks = normalizeTaskPositions(buildDefaultTasksForAssignmentType("Mock Paper (full length)"));
        const created = await onCreateAssignment({
          classroomId,
          sectionId: null,
          assignmentType: "mock",
          title,
          dueDate: inlineCreateDueDate.trim() || null,
          assignToLabel: assignLabel,
          targetStudentIds: selectedTargetStudentIds,
          rewardRdm: 15,
          instructions: "",
          tasks,
          mockPaper: {
            id: selectedMockPaper.id,
            slug: (selectedMockPaper.slug ?? selectedMockPaper.id).trim(),
            title: selectedMockPaper.title.trim(),
          },
        });
        setNudgeCreatedPostId(created.id);
        setNudgeCreatedTitle(title);
      }
      toast({ title: "Assignment created", description: "It’s linked to this nudge." });
    } catch (e) {
      toast({
        title: "Could not create assignment",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setCreatingInlineAssignment(false);
    }
  }, [
    canSubmitInlineCreate,
    selectedTargetStudentIds,
    students.length,
    onCreateAssignment,
    onRequireVerifiedAction,
    mockCreateKind,
    chapterQuizRefForCreate,
    inlineCreateTitle,
    inlineCreateDueDate,
    classroomId,
    selectedMockPaper,
    toast,
  ]);

  const targetCount = selectedTargetStudentIds.length;

  const offStreakAlertNames = offStreakStudents
    .slice(0, 6)
    .map((s) => s.name.split(" ")[0]?.trim())
    .filter(Boolean);

  const rosterById = useMemo(() => new Map(students.map((s) => [s.userId, s])), [students]);

  /** Latest submitted score per student for selected test — used when nobody is under 60%. */
  const submittedAttemptRowsSorted = useMemo(() => {
    const raw =
      props.mockNudgeSubmittedAttemptsByPostId?.[selectedMockPostId] ??
      EMPTY_SUBMITTED_ATTEMPT_ROWS;
    return [...raw].sort((a, b) => {
      const na = rosterById.get(a.userId)?.name?.trim() ?? "";
      const nb = rosterById.get(b.userId)?.name?.trim() ?? "";
      const cmp = na.localeCompare(nb, undefined, { sensitivity: "base" });
      if (cmp !== 0) return cmp;
      return b.pct - a.pct;
    });
  }, [props.mockNudgeSubmittedAttemptsByPostId, selectedMockPostId, rosterById]);

  const sectionNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const sec of detail?.sections ?? []) {
      m.set(sec.id, sec.name);
    }
    return m;
  }, [detail?.sections]);

  const nudgeStudentSectionLabel = (s: TeacherPortalClassroomStudent) => {
    if (!s.sectionId) return "Unassigned";
    return sectionNameById.get(s.sectionId) ?? "Section";
  };

  const nudgeToggleButtonClass =
    "rounded-lg border border-white/15 bg-[#0d0d1c] px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-white/[0.04]";

  const step1 = (
    <div className="mt-3 space-y-2 sm:space-y-3">
      <div className="text-xs leading-relaxed text-slate-300">
        Choose a classroom, then who gets this nudge. Low scorers uses mocks, chapter quizzes, or generated MCQ tests assigned
        this calendar week (Mon–Sun, Asia/Kolkata).
      </div>

      {props.classrooms.length === 0 ? (
        <div
          role="status"
          className="rounded-xl border border-sky-500/35 bg-sky-950/40 px-3 py-3 text-[12px] leading-snug text-sky-100 sm:text-sm"
        >
          <span className="font-semibold text-sky-50">No classrooms yet.</span> Create a class first — then you can send nudges.
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-300">Classroom</label>
        <select
          value={classroomSelectList.length === 0 ? "" : classroomId}
          onChange={(e) => setClassroomId(e.target.value)}
          disabled={classroomSelectList.length === 0}
          className={`${selectCompactClassName} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {classroomSelectList.length === 0 ? (
            <option value="">
              {props.classrooms.length === 0 ? "No classrooms yet" : "No class with a test this week"}
            </option>
          ) : (
            classroomSelectList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))
          )}
        </select>
        <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
          Roster includes <span className="text-slate-400">all students in this class</span> (every section).
        </p>
      </div>

      {target === "low_scorers" && classroomSelectList.length === 0 && props.classrooms.length > 0 ? (
        <div
          role="status"
          className="rounded-xl border border-amber-400/50 bg-gradient-to-br from-amber-500/25 via-amber-600/15 to-transparent px-3 py-3 text-[12px] leading-snug shadow-[0_0_28px_-10px_rgba(251,191,36,0.45)] sm:px-4 sm:text-sm"
        >
          <p className="font-semibold text-amber-50">No test assigned this calendar week.</p>
          <p className="mt-1.5 text-amber-100/95">
            Use <span className="font-medium text-amber-50">Create assignment</span> (mock or chapter quiz) or{" "}
            <span className="font-medium text-amber-50">Create tests</span> (generated MCQ). Or switch to Off-streak or Specific
            students.
          </p>
        </div>
      ) : null}

      <div className="grid gap-2 sm:gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setTarget("off_streak")}
          className={`rounded-2xl border p-3 text-left transition sm:p-4 ${
            target === "off_streak"
              ? "border-amber-400/40 bg-amber-500/10"
              : "border-white/10 bg-[#0d0d1c] hover:bg-white/[0.03]"
          }`}
        >
          <div className="text-[13px] font-semibold text-slate-100 sm:text-sm">Off-streak students</div>
          <div className="mt-0.5 text-[11px] text-slate-400 sm:mt-1 sm:text-xs">
            {offStreakStudents.length === 0
              ? "No students are off-streak for 48+ hours in this class"
              : offStreakStudents.length === 1
                ? "1 student is 48+ hours off streak in this class"
                : `${offStreakStudents.length} students are 48+ hours off streak in this class`}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setTarget("low_scorers")}
          className={`rounded-2xl border p-3 text-left transition sm:p-4 ${
            target === "low_scorers"
              ? "border-emerald-400/40 bg-emerald-500/10"
              : "border-white/10 bg-[#0d0d1c] hover:bg-white/[0.03]"
          }`}
        >
          <div className="text-[13px] font-semibold text-slate-100 sm:text-sm">Low scorers this week</div>
          <div className="mt-0.5 text-[11px] text-slate-400 sm:mt-1 sm:text-xs">
            Under 60% on a test assigned this week (mock, chapter quiz, or generated MCQ — submitted attempt)
          </div>
        </button>

        <button
          type="button"
          onClick={() => setTarget("specific_student")}
          className={`rounded-2xl border p-3 text-left transition sm:p-4 ${
            target === "specific_student"
              ? "border-emerald-400/40 bg-emerald-500/10"
              : "border-white/10 bg-[#0d0d1c] hover:bg-white/[0.03]"
          } sm:col-span-2`}
        >
          <div className="text-[13px] font-semibold text-slate-100 sm:text-sm">Specific students</div>
          <div className="mt-0.5 text-[11px] text-slate-400 sm:mt-1 sm:text-xs">
            Pick one or more students from this class roster
          </div>
        </button>
      </div>

      {target === "off_streak" && offStreakStudents.length > 0 ? (
        <>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-rose-200 sm:px-4 sm:py-3 sm:text-xs">
            <span className="font-semibold">⚠ Off-streak alert:</span>{" "}
            {offStreakAlertNames.join(", ")}
            {offStreakStudents.length > offStreakAlertNames.length ? "…" : ""} — need a nudge in this
            class.
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={nudgeToggleButtonClass}
              onClick={() =>
                setSelectedOffStreakIds(new Set(offStreakStudents.map((s) => s.userId)))
              }
            >
              Select all
            </button>
            <button type="button" className={nudgeToggleButtonClass} onClick={() => setSelectedOffStreakIds(new Set())}>
              Clear
            </button>
          </div>
          <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
            {[...offStreakStudents]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((s) => (
                <label
                  key={s.userId}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-[#0d0d1c] px-2 py-2 text-[12px] text-slate-200"
                >
                  <input
                    type="checkbox"
                    className="rounded border-white/20"
                    checked={selectedOffStreakIds.has(s.userId)}
                    onChange={() => {
                      setSelectedOffStreakIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(s.userId)) next.delete(s.userId);
                        else next.add(s.userId);
                        return next;
                      });
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="shrink-0 text-[10px] text-slate-500">{nudgeStudentSectionLabel(s)}</span>
                </label>
              ))}
          </div>
        </>
      ) : null}

      {target === "low_scorers" && classroomSelectList.length > 0 ? (
        <>
          {weekMocksForClassroom.length > 0 ? (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">Test (this week)</label>
              <select
                value={selectedMockPostId}
                onChange={(e) => setSelectedMockPostId(e.target.value)}
                className={selectCompactClassName}
              >
                {weekMocksForClassroom.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                    {m.dueDateLabel ? ` · due ${m.dueDateLabel}` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 sm:text-xs">
              No qualifying test posted this week for this class.
            </div>
          )}

          {weekMocksForClassroom.length > 0 && lowScorerRows.length === 0 ? (
            submittedAttemptRowsSorted.length > 0 ? (
              <div className="space-y-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-3 sm:px-4">
                <p className="text-[12px] font-semibold text-sky-100 sm:text-sm">
                  No students under 60% for this test
                </p>
                <p className="text-[11px] leading-relaxed text-sky-200/95 sm:text-xs">
                  Everyone who submitted scored <span className="font-semibold text-sky-50">60% or above</span>.
                  Latest attempt per student:
                </p>
                <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                  {submittedAttemptRowsSorted.map((r) => {
                    const stu = rosterById.get(r.userId);
                    const name = stu?.name?.trim() || "Student";
                    return (
                      <li
                        key={r.userId}
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0d0d1c] px-2 py-2 text-[12px] text-slate-200"
                      >
                        <span className="min-w-0 flex-1 truncate">{name}</span>
                        <span className="shrink-0 text-[10px] text-slate-500">
                          {stu ? nudgeStudentSectionLabel(stu) : "—"}
                        </span>
                        <span className="shrink-0 text-[11px] font-semibold text-emerald-300 tabular-nums">
                          {r.pct}%
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[10px] text-sky-300/80">
                  Low scorers nudges only include students below 60%. Use Specific students to message anyone above that bar.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-slate-400 sm:text-xs">
                <p className="font-semibold text-slate-300">No submitted attempts yet</p>
                <p className="mt-1">
                  No scored attempt is recorded for this test in this class yet. Students who haven&apos;t submitted
                  won&apos;t appear here. If they completed it outside this classroom flow, scores may not sync.
                </p>
              </div>
            )
          ) : null}

          {weekMocksForClassroom.length > 0 && lowScorerRows.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={nudgeToggleButtonClass}
                  onClick={() =>
                    setSelectedLowScorerIds(new Set(lowScorerRows.map((r) => r.userId)))
                  }
                >
                  Select all under 60%
                </button>
                <button
                  type="button"
                  className={nudgeToggleButtonClass}
                  onClick={() => setSelectedLowScorerIds(new Set())}
                >
                  Clear
                </button>
              </div>
              <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                {lowScorerRows.map((r) => {
                  const stu = rosterById.get(r.userId);
                  const name = stu?.name ?? "Student";
                  return (
                    <label
                      key={r.userId}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-[#0d0d1c] px-2 py-2 text-[12px] text-slate-200"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-white/20"
                        checked={selectedLowScorerIds.has(r.userId)}
                        onChange={() => {
                          setSelectedLowScorerIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(r.userId)) next.delete(r.userId);
                            else next.add(r.userId);
                            return next;
                          });
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                      <span className="shrink-0 text-[10px] text-slate-500">
                        {stu ? nudgeStudentSectionLabel(stu) : "—"}
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-500">{r.pct}%</span>
                    </label>
                  );
                })}
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {target === "specific_student" ? (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={nudgeToggleButtonClass}
              onClick={() => setSelectedSpecificIds(new Set(students.map((s) => s.userId)))}
            >
              Select all
            </button>
            <button
              type="button"
              className={nudgeToggleButtonClass}
              onClick={() => setSelectedSpecificIds(new Set())}
            >
              Clear
            </button>
          </div>
          <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
            {[...students]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((s) => (
                <label
                  key={s.userId}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-[#0d0d1c] px-2 py-2 text-[12px] text-slate-200"
                >
                  <input
                    type="checkbox"
                    className="rounded border-white/20"
                    checked={selectedSpecificIds.has(s.userId)}
                    onChange={() => {
                      setSelectedSpecificIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(s.userId)) next.delete(s.userId);
                        else next.add(s.userId);
                        return next;
                      });
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="shrink-0 text-[10px] text-slate-500">{nudgeStudentSectionLabel(s)}</span>
                </label>
              ))}
          </div>
        </>
      ) : null}
    </div>
  );

  const step2 = (
    <div className="mt-3 space-y-2 sm:space-y-3">
      <div className="text-xs leading-relaxed text-slate-300">
        Select the specific action you want students to take. This helps personalise the message.
      </div>

      <div className="flex flex-wrap gap-2">
        {goalOptions.map((g) => {
          const on = goal === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setGoal(g.id)}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                on ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-[#0d0d1c] text-slate-300 hover:bg-white/[0.03]"
              }`}
            >
              {g.label}
            </button>
          );
        })}
      </div>

      {goal === "restart_streak" ? (
        <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-amber-100 sm:text-xs">
          Small consistency beats a perfect plan — nudge them back before the habit fades. The message below
          defaults to streak-focused copy you can edit in the next step.
        </div>
      ) : null}

      {goal === "complete_pending_assignment" ? (
        classroomAssignments.length === 0 ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100 sm:text-xs">
            No assignments in this classroom yet. Create one from My Classroom, or pick another goal.
          </div>
        ) : activePendingAssignments.length === 0 ? (
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100 sm:text-xs">
            No <span className="font-semibold text-amber-50">active</span> assignments (everything here is past due).
            Update due dates on older posts in My Classroom, or pick another goal.
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Assignment <span className="text-rose-400">*</span>
            </label>
            <select
              value={pendingAssignmentPostId}
              onChange={(e) => setPendingAssignmentPostId(e.target.value)}
              className={selectCompactClassName}
            >
              {activePendingAssignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                  {a.dueDateLabel ? ` · due ${a.dueDateLabel}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Active assignments only — past due dates are hidden. One assignment applies to all recipients in this
              nudge.
            </p>
          </div>
        )
      ) : null}

      {goal === "attempt_mock" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAttemptMockMode("existing");
                    setNudgeCreatedPostId("");
                    setNudgeCreatedTitle("");
                  }}
                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    attemptMockMode === "existing"
                      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                      : "border-white/10 bg-[#0d0d1c] text-slate-300 hover:bg-white/[0.03]"
                  }`}
                >
                  Existing assignment
                </button>
                {NUDGE_MOCK_SHOW_INLINE_CREATE && props.allowStructuredAssignmentCreate ? (
                  <button
                    type="button"
                    onClick={() => setAttemptMockMode("create")}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                      attemptMockMode === "create"
                        ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                        : "border-white/10 bg-[#0d0d1c] text-slate-300 hover:bg-white/[0.03]"
                    }`}
                  >
                    Create assignment
                  </button>
                ) : NUDGE_MOCK_SHOW_INLINE_CREATE && !props.allowStructuredAssignmentCreate ? (
                  <span className="self-center text-[11px] text-slate-500">
                    (Create assignment needs a full teacher login — pick an existing assignment from the list.)
                  </span>
                ) : null}
          </div>

              {attemptMockMode === "existing" ? (
                mcqTargetAssignments.length === 0 ? (
                  <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-amber-100 sm:text-xs">
                    <p className="font-semibold text-amber-50">No mock, chapter quiz, or MCQ assignment to link</p>
                    <p className="mt-1.5">
                      This list only includes assignments already on this class wall (full mock, chapter quiz, or
                      generated MCQ).
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-300">
                      Mock or quiz assignment <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={mockExistingPostId}
                      onChange={(e) => setMockExistingPostId(e.target.value)}
                      className={selectCompactClassName}
                    >
                      {mcqTargetAssignments.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title}
                          {a.dueDateLabel ? ` · due ${a.dueDateLabel}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              ) : (
                <div className="space-y-3 rounded-xl border border-white/10 bg-[#0a0f1c] p-3 sm:p-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setMockCreateKind("quiz")}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                        mockCreateKind === "quiz"
                          ? "border-violet-400/40 bg-violet-500/10 text-violet-100"
                          : "border-white/10 bg-[#0d0d1c] text-slate-300"
                      }`}
                    >
                      Chapter quiz (MCQs)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMockCreateKind("mock")}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                        mockCreateKind === "mock"
                          ? "border-violet-400/40 bg-violet-500/10 text-violet-100"
                          : "border-white/10 bg-[#0d0d1c] text-slate-300"
                      }`}
                    >
                      Full mock paper
                    </button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-400">Title</label>
                      <input
                        value={inlineCreateTitle}
                        onChange={(e) => setInlineCreateTitle(e.target.value)}
                        placeholder={mockCreateKind === "quiz" ? "Chapter Quiz (MCQs)" : "Mock title"}
                        className={selectCompactClassName}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-400">Due date</label>
                      <input
                        type="date"
                        value={inlineCreateDueDate}
                        onChange={(e) => setInlineCreateDueDate(e.target.value)}
                        className={selectCompactClassName}
                      />
                    </div>
                  </div>

                  {mockCreateKind === "quiz" ? (
                    <ChapterQuizAssignmentFields
                      taxonomy={taxonomy}
                      taxonomyLoading={taxonomyLoading}
                      taxonomyError={taxonomyError}
                      value={chapterQuizSel}
                      onChange={setChapterQuizSel}
                      selectClassName={selectCompactClassName}
                    />
                  ) : (
                    <div className="space-y-2">
                      {mockPapersLoading ? (
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading mock papers…
                        </div>
                      ) : null}
                      {mockPapersError ? (
                        <div className="text-xs text-rose-300">{mockPapersError}</div>
                      ) : null}
                      {!mockPapersLoading && mockPapers.length === 0 ? (
                        <div className="text-xs text-slate-500">No mock papers available.</div>
                      ) : null}
                      {mockPapers.length > 0 ? (
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-300">Mock paper</label>
                          <select
                            value={selectedMockPaperId ?? ""}
                            onChange={(e) => setSelectedMockPaperId(e.target.value || null)}
                            className={selectCompactClassName}
                          >
                            {mockPapers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {nudgeCreatedPostId ? (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
                      Attached: <span className="font-semibold">{nudgeCreatedTitle || "Assignment"}</span>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    disabled={!canSubmitInlineCreate || creatingInlineAssignment || selectedTargetStudentIds.length === 0}
                    onClick={() => void runInlineCreateAssignment()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-60 sm:text-sm"
                  >
                    {creatingInlineAssignment ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {creatingInlineAssignment ? "Creating…" : "Create & attach assignment"}
                  </button>
                  {selectedTargetStudentIds.length === 0 ? (
                    <p className="text-[11px] text-rose-300">Select students in step 1 first.</p>
                  ) : null}
                </div>
              )}
        </div>
      ) : null}

      {goal === "answer_doubts" ? (
        <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-sky-100 sm:text-xs">
          Encourage them to post on Gyan++. The notification will include a shortcut to{" "}
          <span className="font-mono text-[11px]">/doubts</span>.
        </div>
      ) : null}

      {goal === "revise_chapter" ? (
        <div className="space-y-3">
          <p className="text-[11px] leading-relaxed text-slate-400 sm:text-xs">
            Same syllabus picker as <span className="font-semibold text-slate-300">Concept Focus</span> assignments —
            class, subject, chapter, lesson, and subtopic.
          </p>
          <p className="text-[11px] leading-relaxed text-slate-500 sm:text-xs">
            In step 1, pick students from the <span className="font-semibold text-slate-300">whole class roster</span>{" "}
            (all sections). When you send, we create <span className="font-semibold text-slate-300">one assignment</span>{" "}
            scoped to the class with only the students you selected — including if they sit in different sections.
          </p>
          <ConceptFocusAssignmentFields
            taxonomy={taxonomy}
            taxonomyLoading={taxonomyLoading}
            taxonomyError={taxonomyError}
            value={reviseConceptFocusSel}
            onChange={setReviseConceptFocusSel}
            selectClassName={selectCompactClassName}
          />
          {props.allowStructuredAssignmentCreate ? (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Assignment due date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                value={conceptFocusDueDate}
                onChange={(e) => setConceptFocusDueDate(e.target.value)}
                className={selectCompactClassName}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Only students you selected in step 1 receive this assignment; they see this due date on the post.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {goal === "watch_recorded_class" ? (
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-300">
            Recorded class URL <span className="text-rose-400">*</span>
          </label>
          <input
            value={watchRecordedUrl}
            onChange={(e) => setWatchRecordedUrl(e.target.value)}
            placeholder="Paste a YouTube, Google Drive, Meet recording, or other https link…"
            className={selectCompactClassName}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Must be a full web address starting with <span className="font-mono text-slate-400">https://</span>
          </p>
          {!normalizeTeacherMotivationExternalUrl(watchRecordedUrl) && watchRecordedUrl.trim() ? (
            <div className="mt-1 text-[11px] text-rose-300">Enter a valid http(s) link.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const step3 = (
    <div className="mt-3 space-y-2 sm:space-y-3">
      <div className="text-xs leading-relaxed text-slate-300">
        Your message will appear as a personal notification from you. Students respond much better to personal
        messages than generic alerts.
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#070b17] p-3 sm:p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 2 — Nudge goal</div>
        <div className="mt-1 text-sm font-semibold text-slate-100">
          {goalOptions.find((g) => g.id === goal)?.label ?? "—"}
        </div>
        {step2GoalSummaryDetail ? (
          <div className="mt-2 text-[12px] leading-relaxed text-slate-400 break-words">{step2GoalSummaryDetail}</div>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-300">
          Your personalised message <span className="text-rose-400">*</span>
        </label>
        <textarea
          rows={3}
          value={message}
          onChange={(e) => {
            setMessageTouched(true);
            setMessage(e.target.value);
          }}
          placeholder="Write your personalised message…"
          className="w-full rounded-xl border border-white/15 bg-[#070b17] px-3 py-2 text-[13px] leading-relaxed outline-none placeholder:text-slate-500 focus:border-emerald-400 sm:text-sm"
        />
      </div>
    </div>
  );

  const step4 = (
    <div className="mt-3 space-y-2 sm:space-y-3">
      <div className="text-xs leading-relaxed text-slate-300">
        RDM bonuses from teachers are credited instantly to the student&apos;s balance and boost their
        EduFund progress.
      </div>

      <div>
        <div className="mb-1 text-xs font-semibold text-slate-300">RDM bonus to award</div>
        <div className="flex flex-wrap gap-2">
          {rdmOptions.map((o) => {
            const on = rdmDelta === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  setRdmDelta(o.value);
                }}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  on ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-[#0d0d1c] text-slate-300 hover:bg-white/[0.03]"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#070b17] p-3 sm:p-4">
        <div className="grid gap-2 text-xs">
          <div className="flex items-start justify-between gap-3">
            <span className="text-slate-400">Sending to</span>
            <span className="text-slate-100 font-semibold">
              {target === "off_streak"
                ? `Off-streak students (${targetCount} students)`
                : target === "low_scorers"
                  ? `Low mock scores (${targetCount} students)`
                  : `Selected students (${targetCount})`}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-slate-400">Goal</span>
            <span className="text-slate-100 font-semibold">
              {goalOptions.find((g) => g.id === goal)?.label ?? "—"}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-slate-400">RDM bonus</span>
            <span className="text-slate-100 font-semibold">
              {rdmDelta > 0 ? `+${rdmDelta} RDM per student` : "No RDM"}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-slate-400">Total RDM cost</span>
            <span className="text-slate-100 font-semibold">
              {rdmDelta > 0 ? `+${rdmDelta * targetCount} RDM` : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3 py-2.5 text-[11px] font-semibold text-amber-200 sm:px-4 sm:py-3 sm:text-xs">
        ⚡ Students are 3x more likely to re-engage when a teacher sends a personal message +
        RDM bonus within 48 hours of going off-streak.
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          disabled={sending || (targetCount > 0 && !message.trim())}
          onClick={async () => {
            if (selectedTargetStudentIds.length === 0) {
              setNoRecipientsDialogOpen(true);
              return;
            }
            if (!message.trim()) return;
            if (!classroomId) return;
            setSending(true);
            try {
              const metaNotificationTitle = motivationNudgeMeta.notificationTitle;
              const baseMotivate = {
                classroomId,
                actionKind,
                targetStudentIds: selectedTargetStudentIds,
                message,
                rdmDelta,
                sectionId: null as string | null,
                ...motivateExtras,
                nudgeGoal: motivationNudgeMeta.nudgeGoal,
              };

              if (goal === "revise_chapter" && props.allowStructuredAssignmentCreate) {
                if (onRequireVerifiedAction) {
                  const ok = await onRequireVerifiedAction("Create assignment");
                  if (!ok) return;
                }
                const cqRef = chapterQuizToRef(
                  {
                    ...reviseConceptFocusSel,
                    level: "advanced",
                    advancedSet: 1,
                  } as ChapterQuizSelectionState,
                  taxonomy
                );
                if (!cqRef) {
                  throw new Error("Concept focus selection is incomplete — go back to step 2 and finish the syllabus.");
                }
                const subtopicLabel = cqRef.subtopicName?.trim() || reviseConceptFocusSummary || "Concept Focus";
                const assignTitle = `Concept Focus · ${subtopicLabel}`;
                const defaultTasks = normalizeTaskPositions(
                  buildDefaultTasksForAssignmentType("Concept Focus").filter((t) => t.label.trim())
                );
                const created = await onCreateAssignment({
                  classroomId,
                  /** Class-wide post + explicit roster — works across teaching sections (RLS + targetStudentIds). */
                  sectionId: null,
                  assignmentType: "Concept Focus",
                  title: assignTitle,
                  dueDate: conceptFocusDueDate.trim(),
                  assignToLabel: `Selected students (${selectedTargetStudentIds.length})`,
                  targetStudentIds: selectedTargetStudentIds,
                  rewardRdm: 15,
                  instructions: "",
                  tasks: defaultTasks.length ? defaultTasks : undefined,
                  chapterQuiz: cqRef,
                });
                await props.onMotivateStudents({
                  ...baseMotivate,
                  relatedPostId: created.id,
                  relatedPostTitle: assignTitle,
                  recommendActionId: "concept_focus_resource",
                  recommendActionLabel: "Open lesson",
                  recommendActionUrl: `/classroom/${encodeURIComponent(classroomId)}?tab=posts&post=${encodeURIComponent(created.id)}`,
                  notificationTitle:
                    metaNotificationTitle ??
                    `Teacher nudge: focus — ${subtopicLabel.length > 72 ? `${subtopicLabel.slice(0, 69)}…` : subtopicLabel}`,
                });
              } else {
                await props.onMotivateStudents({
                  ...baseMotivate,
                  ...(metaNotificationTitle ? { notificationTitle: metaNotificationTitle } : {}),
                });
              }
              toast({ title: "Nudges sent" });
              props.onDone();
            } catch (e) {
              const msg = e instanceof Error ? e.message : "Try again.";
              toast({
                title: "Could not send nudges",
                description:
                  msg === "Failed to fetch"
                    ? "Network error — check your connection, VPN, or ad-blockers, then retry."
                    : msg,
                variant: "destructive",
              });
            } finally {
              setSending(false);
            }
          }}
          className={`rounded-full bg-amber-500 px-5 py-2.5 text-xs font-semibold text-black hover:bg-amber-400 sm:px-6 sm:py-3 ${
            sending || (targetCount > 0 && !message.trim()) ? "disabled:cursor-not-allowed disabled:opacity-60" : ""
          } ${targetCount === 0 && !sending ? "ring-1 ring-amber-400/50 ring-offset-2 ring-offset-[#0a0a12]" : ""}`}
        >
          {sending ? "Sending…" : "Send nudges + RDM →"}
        </button>
      </div>
    </div>
  );

  const noRecipientsDialog = (
    <Dialog open={noRecipientsDialogOpen} onOpenChange={setNoRecipientsDialogOpen}>
      <DialogContent className="max-w-md rounded-2xl border border-white/10 bg-[#0d1020] text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-left text-base text-slate-50 sm:text-lg">Select at least one student</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-1 text-left text-[13px] leading-relaxed text-slate-300 sm:text-sm">
              <p>
                Nudges are not sent until <span className="font-semibold text-slate-100">at least one student</span> is
                in the recipient list. Use <span className="font-semibold text-slate-100">step 1 — Choose who</span> and
                pick a classroom and mode that actually has students to nudge.
              </p>
              <ul className="list-inside list-disc space-y-1.5 pl-0.5 text-slate-300">
                <li>
                  <span className="font-semibold text-slate-100">Off-streak</span> — class has students 48+ hours off
                  their study streak; select who to include.
                </li>
                <li>
                  <span className="font-semibold text-slate-100">Low scorers this week</span> — a test (mock, chapter
                  quiz, or generated MCQ) was assigned this week and at least one student is under 60% on the attempt.
                </li>
                <li>
                  <span className="font-semibold text-slate-100">Mock / MCQ context</span> — &quot;Low scorers&quot;
                  depends on that weekly assignment; switch classroom or assign a test first if the list is empty.
                </li>
                <li>
                  <span className="font-semibold text-slate-100">Custom</span> — choose{" "}
                  <span className="font-semibold text-slate-100">Specific students</span> and tick one or more names from
                  the roster.
                </li>
              </ul>
              <p className="text-slate-400">
                After students appear under your chosen mode, select them and continue —{" "}
                <span className="font-medium text-slate-200">Send nudges + RDM</span> will work once the count is above
                zero.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-between">
          <button
            type="button"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 sm:text-sm"
            onClick={() => setNoRecipientsDialogOpen(false)}
          >
            Close
          </button>
          <button
            type="button"
            className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-black hover:bg-emerald-400 sm:text-sm"
            onClick={() => {
              setNoRecipientsDialogOpen(false);
              props.onJumpToStep?.(0);
            }}
          >
            Go to step 1 — Choose who
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (!classroomId) {
    return (
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-300">
        No classroom found for nudges.
      </div>
    );
  }

  const stepBody =
    props.stepIdx === 0 ? step1 : props.stepIdx === 1 ? step2 : props.stepIdx === 2 ? step3 : step4;

  return (
    <>
      {stepBody}
      {noRecipientsDialog}
    </>
  );
});

