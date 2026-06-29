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
  UserMinus,
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
import { useTeacherRdmCosts } from "@/hooks/TeacherRdmCostsContext";
import {
  chargeTeacherRdm,
  formatTeacherRdmCost,
  formatTeacherRdmDeductionCompact,
  refundTeacherRdm,
} from "@/lib/teacherPortal/rdmCharges";
import { useTopicTaxonomy } from "@/hooks/useTopicTaxonomy";
import { supabase } from "@/integrations/supabase/client";
import { safeGetSession } from "@/lib/auth/safeSession";
import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import GeneratedMcqReview from "@/components/classroom/GeneratedMcqReview";
import type { AdvancedQuizSetIndex } from "@/lib/play/quiz/advancedQuizSets";
import { fetchSubtopicContent } from "@/lib/curriculum/subtopicContentService";
import MeetSessionsStack from "@/components/teacher-portal/live/MeetSessionsStack";
import ClassroomSessionsDialog from "@/components/teacher-portal/live/ClassroomSessionsDialog";
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
import { BookLiveClassSlotPanel } from "@/components/teacher-portal/classroom/BookLiveClassSlotPanel";
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
import { formatSectionScheduleDeliveryRdmLabel } from "@/lib/teacherPortal/liveClassDeliveryRdm";
import { assignmentPostDueStillActive } from "@/lib/teacherPortal/assignmentDueActive";
import {
  TEACHER_ASSIGNMENT_INCENTIVE_DETAIL_PREFIX,
  TEACHER_ASSIGNMENT_INCENTIVE_HELP,
  TEACHER_ASSIGNMENT_INCENTIVE_LABEL,
  TEACHER_ASSIGNMENT_NO_RDM_LABEL,
  formatCompletionEscrowSummary,
  teacherAssignmentPublishIncentiveLine,
} from "@/lib/teacherPortal/assignmentCompletionRdmCopy";
import SubtopicUnlockCostPanel, {
  conceptFocusPublishGrandTotal,
} from "@/components/teacher-portal/assignment/SubtopicUnlockCostPanel";
import AssignmentCompletionRewardPanel, {
  assignmentCompletionPublishGrandTotal,
} from "@/components/teacher-portal/assignment/AssignmentCompletionRewardPanel";
import AssignmentInfoHelp from "@/components/teacher-portal/assignment/AssignmentInfoHelp";
import { assignmentItemIsNudgeMcqTarget } from "@/lib/teacherPortal/nudgeMcqPosts";
import { resolveAssignmentTrackingInHref } from "@/lib/teacherPortal/assignmentPostIdTemplate";
import {
  CLASSROOM_ASSIGNMENT_PROGRESS_EVENT,
  type ClassroomAssignmentProgressDetail,
} from "@/lib/classroom/assignmentProgressSync";

import type { MyClassroomViewProps } from "./types";
import type {
  JoinRequestRow,
  ClassroomCohortTab,
  DetailTab,
  MotivationMessageType,
  MotivationTarget,
} from "./types";
import { WIZARD_TASKS, type WizardTask } from "./wizard/constants";
import {
  buildWizardShellInitialState,
  ClassroomHelpChip,
  readWizardShellPersisted,
  writeWizardShellPersisted,
  type WizardShellPersistedV2,
  type WizardSectionDraftPersist,
} from "./wizard/shell-persist";
import { StatCard } from "./components/StatCard";
import { AssignmentCard } from "./components/AssignmentCard";
import { TaskPreviewBody } from "./components/TaskPreviewBody";
import { TeacherWizardPopup } from "./wizards/TeacherWizardPopup";
import {
  SUBJECT_OPTIONS,
  PUC_OPTIONS,
  EXAM_OPTIONS,
  WEEKDAYS,
  SHOW_CLASSROOM_SCHEDULE_FORM,
} from "./constants";
import * as display from "./utils/display";
import * as assignmentHelpers from "./assignment/helpers";
import { normalizeTeacherMotivationExternalUrl } from "./utils/motivation-url";
import { emptyClassroomDetail } from "./defaults";
import {
  clearTeacherWizardDismiss,
  dismissTeacherWizardForMs,
  isTeacherWizardDismissed,
} from "@/lib/teacherPortal/teacherWizardDismiss";
import { buildStudentNotificationTitle } from "@/lib/teacherPortal/studentNotificationCopy";

export default function MyClassroomView({
  summary,
  classrooms,
  classroomDetails,
  mockPostIdsAssignedThisWeek = [],
  mockNudgeLowScorersByPostId = {},
  mockNudgeSubmittedAttemptsByPostId = {},
  onCreateClassroom,
  onCreateAssignment,
  onMotivateStudents,
  onRewardTopStudents,
  teacherId,
  onUpdateClassroom,
  onDeleteClassroom,
  onRefreshTeacherPortal,
  onScheduleLiveSession,
  onRequireVerifiedAction,
  allowNudgeStructuredAssignmentCreate = true,
}: MyClassroomViewProps) {
  const { toast } = useToast();
  const { costs: teacherRdmCosts } = useTeacherRdmCosts();
  const createClassroomRdmLabel = formatTeacherRdmCost("create_classroom", teacherRdmCosts);
  const createSectionRdmLabel = formatTeacherRdmCost("create_section", teacherRdmCosts);
  const createClassroomRdmCompact = formatTeacherRdmDeductionCompact(
    "create_classroom",
    teacherRdmCosts
  );
  const createSectionRdmCompact = formatTeacherRdmDeductionCompact(
    "create_section",
    teacherRdmCosts
  );
  const searchParams = useSearchParams();
  const qpClassroom = searchParams.get("classroom");
  const qpDetailRaw = searchParams.get("portalDetail");
  const qpWizard = searchParams.get("wizard");
  const qpScheduleLive = searchParams.get("scheduleLive");
  const qpDetail: DetailTab | null =
    qpDetailRaw === "students" ||
    qpDetailRaw === "assignments" ||
    qpDetailRaw === "progress" ||
    qpDetailRaw === "streaks" ||
    qpDetailRaw === "settings"
      ? qpDetailRaw
      : null;
  const [activeClassroomId, setActiveClassroomId] = useState<string | null>(null);
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("students");
  const [open, setOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentSubmitting, setAssignmentSubmitting] = useState(false);
  const [motivationOpen, setMotivationOpen] = useState(false);
  const [motivationSubmitting, setMotivationSubmitting] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<TeacherPortalClassroomStudent | null>(
    null
  );
  const [motivationAction, setMotivationAction] = useState<"boost" | "nudge" | "urgent_nudge">(
    "boost"
  );
  const [motivationTarget, setMotivationTarget] = useState<MotivationTarget>("");
  const [motivationMessageType, setMotivationMessageType] =
    useState<MotivationMessageType>("streak_reengagement");
  const [motivationMessage, setMotivationMessage] = useState(
    "Great effort. Keep your streak alive!"
  );
  const [assignmentDetail, setAssignmentDetail] = useState<TeacherPortalAssignmentItem | null>(
    null
  );
  const [taskPreview, setTaskPreview] = useState<{
    open: boolean;
    href: string;
    mode:
      | "assignment-test"
      | "mock-paper"
      | "chapter-quiz-preview"
      | "concept-focus-preview"
      | "iframe";
    title: string;
    chapterQuizRef?: {
      board: string;
      subject: string;
      classLevel: number;
      topic: string;
      subtopicName: string;
      level: string;
      advancedSet?: AdvancedQuizSetIndex;
    };
  } | null>(null);

  type AssignmentScoreRow = {
    userId: string;
    score: number;
    total: number;
    submittedAt: string | null;
  };
  const [assignmentScores, setAssignmentScores] = useState<AssignmentScoreRow[]>([]);
  const [assignmentScoresLoading, setAssignmentScoresLoading] = useState(false);
  const [assignmentScoresError, setAssignmentScoresError] = useState<string | null>(null);
  const [assignmentScoresLastUpdatedAt, setAssignmentScoresLastUpdatedAt] = useState<string | null>(
    null
  );
  type ConceptFocusCompletionRowApi = {
    userId: string;
    completed: boolean;
    completedAt: string | null;
    sources?: { assignmentProgress: boolean; lessonMarkedComplete: boolean };
  };
  const [conceptFocusCompletion, setConceptFocusCompletion] = useState<
    ConceptFocusCompletionRowApi[]
  >([]);
  const [conceptFocusCompletionLoading, setConceptFocusCompletionLoading] = useState(false);
  const [conceptFocusCompletionError, setConceptFocusCompletionError] = useState<string | null>(
    null
  );
  const ASSIGNMENT_SCORES_CACHE_KEY = "teacherPortal.assignmentScoresCache.v1";

  const wizardAutoOpenOnceRef = useRef(false);
  const wizardDismissedRef = useRef(false);
  const wizardOpenRef = useRef(false);
  const scheduleLiveHandledRef = useRef(false);

  const assignmentScoresCacheRef = useRef<
    Record<string, { scores: AssignmentScoreRow[]; updatedAt: string }>
  >({});

  const [assignmentResponsesLoading, setAssignmentResponsesLoading] = useState(false);
  const [assignmentResponsesError, setAssignmentResponsesError] = useState<string | null>(null);
  const [assignmentResponses, setAssignmentResponses] = useState<
    Array<{
      taskId: string;
      userId: string;
      responseText: string | null;
      links: string[];
      updatedAt: string;
      student: { name: string | null; email: string | null };
    }>
  >([]);
  const [gyanCompletionsLoading, setGyanCompletionsLoading] = useState(false);
  const [gyanCompletionsError, setGyanCompletionsError] = useState<string | null>(null);
  const [gyanCompletions, setGyanCompletions] = useState<
    Array<{
      userId: string;
      studentName: string;
      doubtId: string;
      doubtTitle: string;
      doubtBody: string;
      subject: string | null;
      completedAt: string;
      hasTeacherAnswer: boolean;
    }>
  >([]);

  const [answerReviewOpen, setAnswerReviewOpen] = useState(false);
  const [answerReviewLoading, setAnswerReviewLoading] = useState(false);
  const [answerReviewError, setAnswerReviewError] = useState<string | null>(null);
  const [answerReviewStudent, setAnswerReviewStudent] = useState<{
    userId: string;
    name: string;
    scoreLabel: string;
  } | null>(null);
  const [answerReviewPayload, setAnswerReviewPayload] = useState<{
    testTitle: string;
    questions: Array<{
      id: string;
      question: string;
      options: string[];
      correctAnswerIndex: number | null;
    }>;
    attempt: { answers: number[]; score: number; total: number; submittedAt: string | null } | null;
  } | null>(null);

  const [rewardSubmitting, setRewardSubmitting] = useState(false);
  const googleOauthToastKeyRef = useRef<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState<(typeof SUBJECT_OPTIONS)[number]>("Physics");
  const [pucLevel, setPucLevel] = useState<(typeof PUC_OPTIONS)[number]>("PUC 1");
  const [examTarget, setExamTarget] = useState<(typeof EXAM_OPTIONS)[number]>("JEE Advanced");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [repeatDays, setRepeatDays] = useState<string[]>(["Mon", "Wed", "Fri"]);
  /** Optional YYYY-MM-DD last recurrence day (open-ended if empty). */
  const [scheduleEndDate, setScheduleEndDate] = useState("");
  const [allowAdhocTrial, setAllowAdhocTrial] = useState(true);
  const [googleSeriesStopping, setGoogleSeriesStopping] = useState(false);
  const [googleDisconnecting, setGoogleDisconnecting] = useState(false);
  const [googleInviteSyncing, setGoogleInviteSyncing] = useState(false);
  const [assignmentType, setAssignmentType] = useState("Mock Paper (full length)");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentDueDate, setAssignmentDueDate] = useState("");
  const [assignToLabel, setAssignToLabel] = useState("All students");
  const [assignmentTargetSectionId, setAssignmentTargetSectionId] = useState<string | null>(null);
  const [assignmentCustomStudentIds, setAssignmentCustomStudentIds] = useState<string[]>([]);
  const [assignmentCustomSearch, setAssignmentCustomSearch] = useState("");
  const [rewardRdm, setRewardRdm] = useState(0);
  const [assignmentInstructions, setAssignmentInstructions] = useState("");
  const [sectionPickerStudentId, setSectionPickerStudentId] = useState<string | null>(null);
  const assignmentScopeTouchedRef = useRef(false);
  const assignmentDraftHydratingRef = useRef(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsSubject, setSettingsSubject] = useState("");
  const [settingsSection, setSettingsSection] = useState("");
  const [settingsIntroVideoUrl, setSettingsIntroVideoUrl] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsDeleting, setSettingsDeleting] = useState(false);
  const [joinRequests, setJoinRequests] = useState<JoinRequestRow[]>([]);
  const [actingJoinRequestId, setActingJoinRequestId] = useState<string | null>(null);
  const [cohortTab, setCohortTab] = useState<ClassroomCohortTab>({ kind: "class" });
  const [autoOpenScheduleSectionId, setAutoOpenScheduleSectionId] = useState<string | null>(null);
  /** Assignments tab: default Active assignments; Past due = deadline passed */
  const [assignmentDueBucket, setAssignmentDueBucket] = useState<"active" | "pastDue">("active");
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [sessionsDialogClassroom, setSessionsDialogClassroom] =
    useState<TeacherPortalClassroomCard | null>(null);
  const [googleCalendarEmail, setGoogleCalendarEmail] = useState<string | null>(
    summary.googleCalendarEmail ?? null
  );
  const [newSectionName, setNewSectionName] = useState("");
  const [sectionScheduleDate, setSectionScheduleDate] = useState("");
  const [sectionScheduleTime, setSectionScheduleTime] = useState("");
  const [sectionDurationMinutes, setSectionDurationMinutes] = useState(90);
  const [sectionRepeatDays, setSectionRepeatDays] = useState<string[]>(["Mon", "Wed", "Fri"]);
  const [sectionScheduleEndDate, setSectionScheduleEndDate] = useState("");
  const [sectionCreating, setSectionCreating] = useState(false);
  const [sectionNameDrafts, setSectionNameDrafts] = useState<Record<string, string>>({});
  const [sectionNameSavingId, setSectionNameSavingId] = useState<string | null>(null);
  const [sectionDeletingId, setSectionDeletingId] = useState<string | null>(null);
  const [mockPapers, setMockPapers] = useState<MockPaper[]>([]);
  const [mockPapersLoading, setMockPapersLoading] = useState(false);
  const [mockPapersLoadError, setMockPapersLoadError] = useState<string | null>(null);
  const [selectedMockPaperId, setSelectedMockPaperId] = useState<string | null>(null);
  const [pastPapers, setPastPapers] = useState<PastPaper[]>([]);
  const [pastPapersLoading, setPastPapersLoading] = useState(false);
  const [pastPapersLoadError, setPastPapersLoadError] = useState<string | null>(null);
  const [selectedPastPaperId, setSelectedPastPaperId] = useState<string | null>(null);
  const [chapterQuizSel, setChapterQuizSel] = useState<ChapterQuizSelectionState>(() =>
    initialChapterQuizSelection()
  );
  const [chapterQuizPreviewLoading, setChapterQuizPreviewLoading] = useState(false);
  const [chapterQuizPreviewError, setChapterQuizPreviewError] = useState<string | null>(null);
  const [chapterQuizPreviewQuestions, setChapterQuizPreviewQuestions] = useState<
    Array<{ id: string; question: string; options: string[]; correctAnswerIndex: number | null }>
  >([]);
  const [conceptFocusSel, setConceptFocusSel] = useState<ConceptFocusSelectionState>(() =>
    initialConceptFocusSelection()
  );
  const [dailyDoseTrackId, setDailyDoseTrackId] = useState<DailyDoseStreakTrackId>(
    () => DAILYDOSE_STREAK_TRACK_IDS[0]
  );
  const [gyanTopicFocus, setGyanTopicFocus] = useState("");
  const [gyanSubtopicHint, setGyanSubtopicHint] = useState("");

  const {
    taxonomy: curriculumTaxonomy,
    loading: curriculumLoading,
    error: curriculumError,
  } = useTopicTaxonomy();

  useEffect(() => {
    // Avoid modal overlaps: wizard drawer should be the only "top-level" surface.
    if (!wizardOpen) return;
    setAssignmentOpen(false);
    setOpen(false);
  }, [wizardOpen]);

  useEffect(() => {
    wizardOpenRef.current = wizardOpen;
  }, [wizardOpen]);

  const dismissWizardForOneHour = useCallback(() => {
    wizardDismissedRef.current = true;
    dismissTeacherWizardForMs(teacherId);
    setWizardOpen(false);
  }, [teacherId]);

  const tryAutoOpenWizard = useCallback(() => {
    if (typeof window === "undefined") return;
    if (activeClassroomId) return;
    if (wizardOpenRef.current) return;
    if (wizardDismissedRef.current) return;
    if (isTeacherWizardDismissed(teacherId)) return;
    // Prevent reopen loops during the same page view.
    if (wizardAutoOpenOnceRef.current) return;
    wizardAutoOpenOnceRef.current = true;
    window.setTimeout(() => setWizardOpen(true), 250);
  }, [activeClassroomId, teacherId]);

  useEffect(() => {
    // Auto-open on Teacher Portal landing (per page load).
    wizardAutoOpenOnceRef.current = false;
    wizardDismissedRef.current = isTeacherWizardDismissed(teacherId);
    tryAutoOpenWizard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  useEffect(() => {
    setGoogleCalendarEmail(summary.googleCalendarEmail ?? null);
  }, [summary.googleCalendarEmail]);

  useEffect(() => {
    if (!summary.googleCalendarConnected) {
      setGoogleCalendarEmail(null);
      return;
    }
    let cancelled = false;
    void fetchWithClientAuth("/api/integrations/google/status")
      .then(async (res) => {
        const body = (await res.json()) as { googleAccountEmail?: string | null };
        if (!cancelled && body.googleAccountEmail) {
          setGoogleCalendarEmail(body.googleAccountEmail);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [summary.googleCalendarConnected]);

  useEffect(() => {
    // Auto-open after login (even if counts don't change).
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        wizardAutoOpenOnceRef.current = false;
        wizardDismissedRef.current = isTeacherWizardDismissed(teacherId);
        tryAutoOpenWizard();
      }
      if (event === "SIGNED_OUT") {
        wizardAutoOpenOnceRef.current = false;
        wizardDismissedRef.current = false;
        // Ask for Google connect again after relogin.
        try {
          window.sessionStorage.removeItem(
            `teacherPortal.googleConnectPrompted.session.v1:${teacherId}`
          );
        } catch {
          // ignore
        }
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [tryAutoOpenWizard, teacherId]);

  useEffect(() => {
    // URL-driven open: /teacher-portal?section=myClassroom&wizard=1
    if (typeof window === "undefined") return;
    if (qpWizard !== "1") return;
    wizardDismissedRef.current = false;
    clearTeacherWizardDismiss(teacherId);
    setWizardOpen(true);
    // Remove the param so it doesn't re-trigger on every re-render.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("wizard");
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore
    }
  }, [qpWizard, teacherId]);

  useEffect(() => {
    const isQuizAssignmentTemplateLocal =
      assignmentType.toLowerCase().includes("quiz") &&
      !assignmentType.toLowerCase().includes("mock");
    if (!isQuizAssignmentTemplateLocal) return;
    if (!curriculumTaxonomy || curriculumTaxonomy.length === 0) return;
    if (!chapterQuizSelectionComplete(chapterQuizSel, curriculumTaxonomy)) {
      setChapterQuizPreviewLoading(false);
      setChapterQuizPreviewError(null);
      setChapterQuizPreviewQuestions([]);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setChapterQuizPreviewLoading(true);
      setChapterQuizPreviewError(null);
      try {
        const ref = chapterQuizToRef(chapterQuizSel, curriculumTaxonomy);
        if (!ref) {
          setChapterQuizPreviewQuestions([]);
          return;
        }

        const qs = new URLSearchParams();
        qs.set("board", ref.board);
        qs.set("subject", ref.subject);
        qs.set("classLevel", String(ref.classLevel));
        qs.set("topic", ref.topic);
        qs.set("subtopicName", ref.subtopicName);
        qs.set("level", ref.level);

        const res = await fetch(`/api/subtopic-content?${qs.toString()}`, {
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          bitsQuestions?: Array<{
            question?: unknown;
            options?: unknown;
            correctAnswer?: unknown;
          }>;
        };
        if (!res.ok) throw new Error(data.error || `Failed to load quiz (${res.status})`);

        const raw = Array.isArray(data.bitsQuestions) ? data.bitsQuestions : [];
        const parsed = raw
          .map((q, idx) => {
            const question = typeof q?.question === "string" ? q.question.trim() : "";
            const options = Array.isArray(q?.options)
              ? q.options
                  .map((o) => (typeof o === "string" ? o.trim() : String(o ?? "").trim()))
                  .filter((o) => Boolean(o))
              : [];
            const correctRaw =
              typeof q?.correctAnswer === "string" || typeof q?.correctAnswer === "number"
                ? String(q.correctAnswer).trim()
                : "";
            if (!question || options.length < 2) return null;

            let correctAnswerIndex: number | null = null;
            if (correctRaw) {
              const n = Number.parseInt(correctRaw, 10);
              if (Number.isFinite(n)) {
                if (n >= 1 && n <= options.length) correctAnswerIndex = n - 1;
                else if (n >= 0 && n < options.length) correctAnswerIndex = n;
              } else if (/^[A-D]$/i.test(correctRaw)) {
                const c = correctRaw.toUpperCase().charCodeAt(0) - 65;
                if (c >= 0 && c < options.length) correctAnswerIndex = c;
              } else {
                const byOpt = options.findIndex(
                  (o) => o.trim().toLowerCase() === correctRaw.toLowerCase()
                );
                if (byOpt >= 0) correctAnswerIndex = byOpt;
              }
            }

            return {
              id: `bits-${idx + 1}`,
              question,
              options,
              correctAnswerIndex,
            };
          })
          .filter(
            (
              x
            ): x is {
              id: string;
              question: string;
              options: string[];
              correctAnswerIndex: number | null;
            } => Boolean(x)
          );

        // Split into 3 sets for preview (Set 1/2/3) to match the teacher selection.
        const setNum = ref.advancedSet ?? 1;
        const chunkSize = Math.max(1, Math.ceil(parsed.length / 3));
        const start = (Math.max(1, Math.min(3, setNum)) - 1) * chunkSize;
        const subset = parsed.slice(start, start + chunkSize);

        if (!cancelled) setChapterQuizPreviewQuestions(subset.length ? subset : parsed);
      } catch (e) {
        if (!cancelled) {
          setChapterQuizPreviewError(
            e instanceof Error ? e.message : "Could not load quiz preview."
          );
          setChapterQuizPreviewQuestions([]);
        }
      } finally {
        if (!cancelled) setChapterQuizPreviewLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [assignmentType, chapterQuizSel, curriculumTaxonomy]);

  const isMockAssignmentTemplate = assignmentType.toLowerCase().includes("mock");
  const isPastPaperAssignmentTemplate = assignmentType.toLowerCase().includes("past paper");
  const isQuizAssignmentTemplate =
    assignmentType.toLowerCase().includes("quiz") && !assignmentType.toLowerCase().includes("mock");
  const isConceptFocusTemplate = assignmentType === "Concept Focus";
  const isDailyDoseAssignmentTemplate = assignmentType.toLowerCase().includes("dailydose");
  const isGyanEngagementTemplate = assignmentType.toLowerCase().includes("gyan");

  const schedulePreview = useMemo(() => {
    if (!scheduleDate || !scheduleTime) return "e.g. Mon / Wed / Fri · 6:00–7:30 PM";
    const start = new Date(`${scheduleDate}T${scheduleTime}:00`);
    if (Number.isNaN(start.getTime())) return "e.g. Mon / Wed / Fri · 6:00–7:30 PM";
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const startLabel = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const endLabel = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const repeat = repeatDays.length ? repeatDays.join(" / ") : "One-time";
    return `${repeat} · ${startLabel}–${endLabel}`;
  }, [durationMinutes, repeatDays, scheduleDate, scheduleTime]);

  const toggleRepeat = (day: string) => {
    setRepeatDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const toggleSectionRepeat = (day: string) => {
    setSectionRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const resetForm = () => {
    setName("");
    setSubject("Physics");
    setPucLevel("PUC 1");
    setExamTarget("JEE Advanced");
    setScheduleDate("");
    setScheduleTime("");
    setScheduleEndDate("");
    setDurationMinutes(90);
    setRepeatDays(["Mon", "Wed", "Fri"]);
    setAllowAdhocTrial(true);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await onCreateClassroom({
        name,
        subject,
        pucLevel,
        examTarget,
        scheduleDate: SHOW_CLASSROOM_SCHEDULE_FORM ? scheduleDate || null : null,
        scheduleTime: SHOW_CLASSROOM_SCHEDULE_FORM ? scheduleTime || null : null,
        durationMinutes: SHOW_CLASSROOM_SCHEDULE_FORM ? durationMinutes : 90,
        repeatDays: SHOW_CLASSROOM_SCHEDULE_FORM ? repeatDays : [],
        scheduleEndDate: SHOW_CLASSROOM_SCHEDULE_FORM ? scheduleEndDate.trim() || null : null,
        allowAdhocTrial,
      });
      toast({
        title: "Classroom created",
        description:
          "Students can now join this classroom. Add sections to set schedules and sync Google Calendar.",
      });
      setOpen(false);
      resetForm();
    } catch (err) {
      toast({
        title: "Could not create classroom",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const activeClassroom = classrooms.find((c) => c.id === activeClassroomId) ?? null;
  const assignmentDraftKey = useMemo(() => {
    if (!activeClassroomId) return null;
    return `teacherPortal.setAssignmentDraft.v1:${teacherId}:${activeClassroomId}`;
  }, [activeClassroomId, teacherId]);

  useEffect(() => {
    if (classrooms.length === 0) return;

    if (qpClassroom && classrooms.some((c) => c.id === qpClassroom)) {
      setActiveClassroomId(qpClassroom);
      if (qpDetail) setDetailTab(qpDetail);
      return;
    }

    // Sidebar / deep link: portalDetail without classroom (e.g. Progress Reports) → first class + tab
    if (qpDetail && !qpClassroom) {
      setActiveClassroomId((prev) => prev ?? classrooms[0]!.id);
      setDetailTab(qpDetail);
    }
  }, [qpClassroom, qpDetail, classrooms]);

  useEffect(() => {
    const g = searchParams.get("google");
    if (g !== "connected" && g !== "error") return;
    const dedupeKey = `${g}:${searchParams.get("reason") ?? ""}`;
    if (googleOauthToastKeyRef.current === dedupeKey) return;
    googleOauthToastKeyRef.current = dedupeKey;
    if (g === "connected") {
      toast({
        title: "Google Calendar connected",
        description:
          "Creating a class with a schedule will add Meet links to your calendar automatically.",
      });
      void onRefreshTeacherPortal({ silent: true });
    } else {
      const reason = searchParams.get("reason");
      toast({
        title: "Google connection failed",
        description: reason ? `Reason: ${reason}` : "Try again from Connect Google Calendar.",
        variant: "destructive",
      });
    }
  }, [searchParams, toast, onRefreshTeacherPortal]);

  const activeDetail = activeClassroomId
    ? (classroomDetails[activeClassroomId] ?? emptyClassroomDetail)
    : emptyClassroomDetail;

  const openAssignmentFromBundle = useMemo(() => {
    if (!assignmentDetail?.id) return null;
    return activeDetail.assignments.find((a) => a.id === assignmentDetail.id) ?? null;
  }, [activeDetail.assignments, assignmentDetail?.id]);

  /** When Realtime refreshes the bundle, keep the open detail modal in sync (no polling). */
  useEffect(() => {
    if (!openAssignmentFromBundle || !assignmentDetail) return;
    if (
      openAssignmentFromBundle.completedCount !== assignmentDetail.completedCount ||
      openAssignmentFromBundle.completionPercent !== assignmentDetail.completionPercent
    ) {
      setAssignmentDetail(openAssignmentFromBundle);
    }
  }, [openAssignmentFromBundle, assignmentDetail]);

  useEffect(() => {
    if (autoOpenScheduleSectionId) return;
    setCohortTab({ kind: "class" });
  }, [activeClassroomId, autoOpenScheduleSectionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (qpScheduleLive !== "1" || scheduleLiveHandledRef.current) return;
    scheduleLiveHandledRef.current = true;

    const cid = activeClassroomId ?? classrooms[0]?.id ?? null;
    if (!cid) {
      toast({
        title: "Create a classroom first",
        description: "Add a class under My Classroom, then schedule a live lesson.",
      });
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("scheduleLive");
        window.history.replaceState({}, "", url.toString());
      } catch {
        // ignore
      }
      return;
    }
    if (!activeClassroomId) setActiveClassroomId(cid);

    const sections = classroomDetails[cid]?.sections ?? [];
    const firstSection =
      sections.find((s) => s.isActive !== false) ?? sections[0] ?? null;

    setDetailTab("students");
    if (firstSection) {
      setCohortTab({ kind: "section", id: firstSection.id });
      setAutoOpenScheduleSectionId(firstSection.id);
    } else {
      toast({
        title: "Add a section first",
        description: "Create a section under this class, then schedule a live lesson.",
      });
    }

    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("scheduleLive");
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore
    }
  }, [
    qpScheduleLive,
    activeClassroomId,
    classrooms,
    classroomDetails,
    toast,
  ]);

  const cohortStudents = useMemo(() => {
    const roster = activeDetail.students.filter((s) => s.role !== "teacher");
    if (cohortTab.kind === "class") return roster;
    if (cohortTab.kind === "unassigned") return roster.filter((s) => s.sectionId == null);
    return roster.filter((s) => s.sectionId === cohortTab.id);
  }, [activeDetail.students, cohortTab]);

  const conceptFocusRosterRows = useMemo(() => {
    if (!conceptFocusCompletion.length) return [];
    return [...conceptFocusCompletion]
      .map((r) => {
        const st = activeDetail.students.find((s) => s.userId === r.userId);
        return {
          ...r,
          name: st?.name?.trim() || "Student",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [conceptFocusCompletion, activeDetail.students]);

  const cohortAssignments = useMemo(() => {
    if (cohortTab.kind === "class")
      return activeDetail.assignments.filter((a) => a.sectionId == null);
    if (cohortTab.kind === "unassigned") return [];
    return activeDetail.assignments.filter((a) => a.sectionId === cohortTab.id);
  }, [activeDetail.assignments, cohortTab]);

  const assignmentDueCounts = useMemo(() => {
    const now = Date.now();
    let active = 0;
    let pastDue = 0;
    for (const a of cohortAssignments) {
      if (assignmentHelpers.isTeacherAssignmentPastDue(a, now)) pastDue += 1;
      else active += 1;
    }
    return { active, pastDue };
  }, [cohortAssignments]);

  const displayedCohortAssignments = useMemo(() => {
    const now = Date.now();
    return cohortAssignments.filter((a) =>
      assignmentDueBucket === "pastDue"
        ? assignmentHelpers.isTeacherAssignmentPastDue(a, now)
        : !assignmentHelpers.isTeacherAssignmentPastDue(a, now)
    );
  }, [cohortAssignments, assignmentDueBucket]);

  const cohortTabSectionKey = cohortTab.kind === "section" ? cohortTab.id : "";
  useEffect(() => {
    setAssignmentDueBucket("active");
  }, [activeClassroomId, cohortTab.kind, cohortTabSectionKey]);

  const cohortMotivationLog = useMemo(() => {
    if (cohortTab.kind === "class")
      return activeDetail.motivationLog.filter((m) => m.sectionId == null);
    if (cohortTab.kind === "unassigned") return [];
    return activeDetail.motivationLog.filter((m) => m.sectionId === cohortTab.id);
  }, [activeDetail.motivationLog, cohortTab]);

  const studentCountBySectionId = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of activeDetail.students) {
      if (s.role === "teacher") continue;
      if (!s.sectionId) continue;
      map.set(s.sectionId, (map.get(s.sectionId) ?? 0) + 1);
    }
    return map;
  }, [activeDetail.students]);

  const sectionById = useMemo(() => {
    const map = new Map<string, { name: string; scheduleLabel?: string | null }>();
    for (const sec of activeDetail.sections) {
      map.set(sec.id, { name: sec.name, scheduleLabel: sec.scheduleLabel ?? null });
    }
    return map;
  }, [activeDetail.sections]);

  useEffect(() => {
    if (!activeClassroom) return;
    setSettingsName(activeClassroom.name);
    setSettingsSubject(activeClassroom.subject ?? "");
    setSettingsSection(activeClassroom.section ?? "");
    setSettingsIntroVideoUrl(activeClassroom.introVideoUrl ?? "");
  }, [activeClassroom]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const sec of activeDetail.sections) next[sec.id] = sec.name;
    setSectionNameDrafts(next);
  }, [activeDetail.sections]);

  useEffect(() => {
    if (!assignmentOpen) return;
    const tryRestoreDraft = () => {
      if (!assignmentDraftKey) return false;
      const raw = window.sessionStorage.getItem(assignmentDraftKey);
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object") return false;
        const d = parsed as Record<string, unknown>;
        if (d.v !== 1) return false;
        assignmentDraftHydratingRef.current = true;

        if (typeof d.assignmentType === "string") setAssignmentType(d.assignmentType);
        if (typeof d.assignmentTitle === "string") setAssignmentTitle(d.assignmentTitle);
        if (typeof d.assignmentDueDate === "string") setAssignmentDueDate(d.assignmentDueDate);
        if (typeof d.assignToLabel === "string") setAssignToLabel(d.assignToLabel);
        if (typeof d.rewardRdm === "number") setRewardRdm(d.rewardRdm);
        if (typeof d.assignmentInstructions === "string")
          setAssignmentInstructions(d.assignmentInstructions);
        if (typeof d.assignmentTargetSectionId === "string" || d.assignmentTargetSectionId === null)
          setAssignmentTargetSectionId(d.assignmentTargetSectionId as string | null);
        if (Array.isArray(d.assignmentCustomStudentIds))
          setAssignmentCustomStudentIds(
            d.assignmentCustomStudentIds.filter((x): x is string => typeof x === "string")
          );
        if (typeof d.assignmentCustomSearch === "string")
          setAssignmentCustomSearch(d.assignmentCustomSearch);
        if (typeof d.selectedMockPaperId === "string" || d.selectedMockPaperId === null)
          setSelectedMockPaperId(d.selectedMockPaperId as string | null);

        if (d.chapterQuizSel && typeof d.chapterQuizSel === "object")
          setChapterQuizSel(d.chapterQuizSel as ChapterQuizSelectionState);
        if (d.conceptFocusSel && typeof d.conceptFocusSel === "object")
          setConceptFocusSel(d.conceptFocusSel as ConceptFocusSelectionState);
        if (typeof d.dailyDoseTrackId === "string")
          setDailyDoseTrackId(d.dailyDoseTrackId as DailyDoseStreakTrackId);
        if (typeof d.gyanTopicFocus === "string") setGyanTopicFocus(d.gyanTopicFocus);
        if (typeof d.gyanSubtopicHint === "string") setGyanSubtopicHint(d.gyanSubtopicHint);

        window.setTimeout(() => {
          assignmentDraftHydratingRef.current = false;
        }, 0);
        return true;
      } catch {
        return false;
      }
    };

    const restored = tryRestoreDraft();
    setAssignToLabel((prev) => {
      const v = prev.trim().toLowerCase();
      if (v === "top performers" || v === "off-streak students") return "All students";
      return prev;
    });
    if (!restored) {
      setChapterQuizSel(initialChapterQuizSelection());
      setConceptFocusSel(initialConceptFocusSelection());
      setDailyDoseTrackId(DAILYDOSE_STREAK_TRACK_IDS[0]);
      setGyanTopicFocus("");
      setGyanSubtopicHint("");
      setAssignmentTargetSectionId(cohortTab.kind === "section" ? cohortTab.id : null);
      assignmentScopeTouchedRef.current = false;
      setAssignmentCustomStudentIds([]);
      setAssignmentCustomSearch("");
      setSelectedMockPaperId(null);
      setRewardRdm(15);
    }
    // Only reset when dialog opens; cohortTab is read from the open transition render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentOpen, assignmentDraftKey]);

  useEffect(() => {
    if (!assignmentOpen) return;
    if (!assignmentDraftKey) return;
    if (assignmentDraftHydratingRef.current) return;
    const t = window.setTimeout(() => {
      try {
        const draft = {
          v: 1,
          assignmentType,
          assignmentTitle,
          assignmentDueDate,
          assignToLabel,
          assignmentTargetSectionId,
          assignmentCustomStudentIds,
          assignmentCustomSearch,
          rewardRdm,
          assignmentInstructions,
          selectedMockPaperId,
          chapterQuizSel,
          conceptFocusSel,
          dailyDoseTrackId,
          gyanTopicFocus,
          gyanSubtopicHint,
        };
        window.sessionStorage.setItem(assignmentDraftKey, JSON.stringify(draft));
      } catch {
        // ignore
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [
    assignmentOpen,
    assignmentDraftKey,
    assignmentType,
    assignmentTitle,
    assignmentDueDate,
    assignToLabel,
    assignmentTargetSectionId,
    assignmentCustomStudentIds,
    assignmentCustomSearch,
    rewardRdm,
    assignmentInstructions,
    selectedMockPaperId,
    chapterQuizSel,
    conceptFocusSel,
    dailyDoseTrackId,
    gyanTopicFocus,
    gyanSubtopicHint,
  ]);

  useEffect(() => {
    if (!assignmentOpen) return;
    if (assignmentScopeTouchedRef.current) return;
    setAssignmentTargetSectionId(cohortTab.kind === "section" ? cohortTab.id : null);
  }, [assignmentOpen, cohortTab]);

  const assignmentAudienceCandidates = useMemo(() => {
    const students = activeDetail.students.filter((s) => s.role !== "teacher");
    const scoped =
      assignmentTargetSectionId == null
        ? students
        : students.filter((s) => (s.sectionId ?? null) === assignmentTargetSectionId);
    return [...scoped].sort((a, b) => a.name.localeCompare(b.name));
  }, [activeDetail.students, assignmentTargetSectionId]);

  const assignmentAudienceFiltered = useMemo(() => {
    const q = assignmentCustomSearch.trim().toLowerCase();
    if (!q) return assignmentAudienceCandidates;
    return assignmentAudienceCandidates.filter((s) => s.name.toLowerCase().includes(q));
  }, [assignmentAudienceCandidates, assignmentCustomSearch]);

  const toggleCustomStudent = useCallback((userId: string) => {
    setAssignmentCustomStudentIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }, []);

  useEffect(() => {
    if (!isQuizAssignmentTemplate) {
      setChapterQuizSel(initialChapterQuizSelection());
    }
    if (!isConceptFocusTemplate) {
      setConceptFocusSel(initialConceptFocusSelection());
    }
  }, [isQuizAssignmentTemplate, isConceptFocusTemplate]);

  useEffect(() => {
    if (!activeClassroomId) return;
    const onProgress = (ev: Event) => {
      const detail = (ev as CustomEvent<ClassroomAssignmentProgressDetail>).detail;
      if (!detail || detail.classroomId !== activeClassroomId) return;
      void onRefreshTeacherPortal({ silent: true });
    };
    window.addEventListener(CLASSROOM_ASSIGNMENT_PROGRESS_EVENT, onProgress);
    return () => window.removeEventListener(CLASSROOM_ASSIGNMENT_PROGRESS_EVENT, onProgress);
  }, [activeClassroomId, onRefreshTeacherPortal]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ASSIGNMENT_SCORES_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return;
      assignmentScoresCacheRef.current = parsed as Record<
        string,
        { scores: AssignmentScoreRow[]; updatedAt: string }
      >;
    } catch {
      assignmentScoresCacheRef.current = {};
    }
  }, [ASSIGNMENT_SCORES_CACHE_KEY]);

  useEffect(() => {
    if (!assignmentDetail || !activeClassroomId) return;
    const cacheId = `${activeClassroomId}:${assignmentDetail.id}`;
    assignmentScoresCacheRef.current[cacheId] = {
      scores: assignmentScores,
      updatedAt: assignmentScoresLastUpdatedAt ?? new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(
        ASSIGNMENT_SCORES_CACHE_KEY,
        JSON.stringify(assignmentScoresCacheRef.current)
      );
    } catch {
      // Ignore storage write failures (private mode/quota)
    }
  }, [
    ASSIGNMENT_SCORES_CACHE_KEY,
    activeClassroomId,
    assignmentDetail,
    assignmentScores,
    assignmentScoresLastUpdatedAt,
  ]);

  useEffect(() => {
    if (!assignmentDetail || !activeClassroomId) return;
    // Concept Focus uses engagement / "marked complete", not generated-test rows or bits scores.
    const hasGeneratedTest =
      assignmentDetail.type !== "Concept Focus" &&
      assignmentDetail.tasks?.some(
        (t) =>
          t.kind === "chapter_quiz" ||
          t.kind === "mock_paper" ||
          t.kind === "past_paper" ||
          t.href?.includes("/assignment-test/") ||
          t.href?.includes("panel=quiz") ||
          t.href?.includes("/mock") ||
          t.href?.includes("/mock-test")
      );
    if (!hasGeneratedTest) {
      setAssignmentScores([]);
      setAssignmentScoresError(null);
      setAssignmentScoresLastUpdatedAt(null);
      return;
    }
    let cancelled = false;

    // Show cached scores immediately (prevents flicker while we check for new submissions).
    const cacheId = `${activeClassroomId}:${assignmentDetail.id}`;
    const cached = assignmentScoresCacheRef.current[cacheId];
    if (cached?.scores?.length) {
      setAssignmentScores((prev) => (prev.length ? prev : cached.scores));
      setAssignmentScoresLastUpdatedAt((prev) => prev ?? cached.updatedAt);
    }

    const load = async () => {
      if (cancelled) return;
      setAssignmentScoresLoading(true);
      setAssignmentScoresError(null);
      try {
        const { session } = await safeGetSession();
        const res = await fetch(
          `/api/classroom/${activeClassroomId}/posts/${assignmentDetail.id}/generated-test-scores`,
          {
            headers: session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {},
            credentials: "include",
          }
        );
        const data = (await res.json()) as {
          error?: string;
          scores?: Array<{
            userId: string;
            score: number;
            total: number;
            submittedAt: string | null;
          }>;
        };
        if (!res.ok) {
          if (!cancelled) setAssignmentScoresError(data.error ?? "Failed to load scores.");
          return;
        }
        if (!cancelled) {
          const scores = (data.scores ?? []) as AssignmentScoreRow[];
          setAssignmentScores(scores);
          setAssignmentScoresLastUpdatedAt(new Date().toISOString());
        }
      } catch {
        if (!cancelled) setAssignmentScoresError("Network error while loading scores.");
      } finally {
        if (!cancelled) setAssignmentScoresLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [
    assignmentDetail,
    activeClassroomId,
    cohortStudents.length,
    openAssignmentFromBundle?.completedCount,
  ]);

  useEffect(() => {
    if (!assignmentDetail || !activeClassroomId) return;
    if (assignmentDetail.type !== "Concept Focus") {
      setConceptFocusCompletion([]);
      setConceptFocusCompletionError(null);
      setConceptFocusCompletionLoading(false);
      return;
    }
    let cancelled = false;
    setConceptFocusCompletion([]);
    const load = async () => {
      if (!cancelled) {
        setConceptFocusCompletionLoading(true);
        setConceptFocusCompletionError(null);
      }
      try {
        const { session } = await safeGetSession();
        const res = await fetch(
          `/api/classroom/${activeClassroomId}/posts/${assignmentDetail.id}/concept-focus-completion`,
          {
            headers: session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {},
            credentials: "include",
          }
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          students?: ConceptFocusCompletionRowApi[];
        };
        if (!res.ok) {
          if (!cancelled) {
            setConceptFocusCompletionError(data.error ?? "Failed to load lesson completion.");
            setConceptFocusCompletion([]);
          }
          return;
        }
        if (!cancelled) {
          const rows = Array.isArray(data.students) ? data.students : [];
          setConceptFocusCompletion(rows);
        }
      } catch {
        if (!cancelled) {
          setConceptFocusCompletionError("Network error while loading lesson completion.");
          setConceptFocusCompletion([]);
        }
      } finally {
        if (!cancelled) setConceptFocusCompletionLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [assignmentDetail, activeClassroomId, openAssignmentFromBundle?.completedCount]);

  useEffect(() => {
    if (!assignmentDetail || !activeClassroomId) return;
    let cancelled = false;
    setAssignmentResponsesLoading(true);
    setAssignmentResponsesError(null);
    const load = async () => {
      try {
        const { session } = await safeGetSession();
        const res = await fetch(
          `/api/classroom/${activeClassroomId}/posts/${assignmentDetail.id}/task-responses`,
          {
            headers: session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {},
            credentials: "include",
          }
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          responses?: Array<{
            taskId: string;
            userId: string;
            responseText: string | null;
            links: string[];
            updatedAt: string;
            student: { name: string | null; email: string | null };
          }>;
        };
        if (!res.ok) {
          if (!cancelled) {
            setAssignmentResponsesError(data?.error ?? "Failed to load student responses.");
            setAssignmentResponses([]);
          }
          return;
        }
        if (!cancelled) setAssignmentResponses(Array.isArray(data.responses) ? data.responses : []);
      } catch {
        if (!cancelled) {
          setAssignmentResponsesError("Network error while loading student responses.");
          setAssignmentResponses([]);
        }
      } finally {
        if (!cancelled) setAssignmentResponsesLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [assignmentDetail, activeClassroomId]);

  useEffect(() => {
    if (!assignmentDetail || !activeClassroomId) return;
    const isGyan =
      Boolean(assignmentDetail.gyanEngagement) ||
      assignmentDetail.tasks?.some((t) => t.kind === "gyan_engagement");
    if (!isGyan) {
      setGyanCompletions([]);
      setGyanCompletionsError(null);
      return;
    }
    let cancelled = false;
    setGyanCompletionsLoading(true);
    setGyanCompletionsError(null);
    const load = async () => {
      try {
        const { session } = await safeGetSession();
        const res = await fetch(
          `/api/classroom/${activeClassroomId}/posts/${assignmentDetail.id}/gyan-completions`,
          {
            headers: session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {},
            credentials: "include",
          }
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          completions?: typeof gyanCompletions;
        };
        if (!res.ok) {
          if (!cancelled) {
            setGyanCompletionsError(data?.error ?? "Failed to load Gyan++ submissions.");
            setGyanCompletions([]);
          }
          return;
        }
        if (!cancelled) {
          setGyanCompletions(Array.isArray(data.completions) ? data.completions : []);
        }
      } catch {
        if (!cancelled) {
          setGyanCompletionsError("Network error while loading Gyan++ submissions.");
          setGyanCompletions([]);
        }
      } finally {
        if (!cancelled) setGyanCompletionsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [assignmentDetail, activeClassroomId, openAssignmentFromBundle?.completedCount]);

  const openStudentAnswerReview = useCallback(
    async (input: { userId: string; name: string; score: number; total: number }) => {
      if (!assignmentDetail || !activeClassroomId) return;
      setAnswerReviewOpen(true);
      setAnswerReviewLoading(true);
      setAnswerReviewError(null);
      setAnswerReviewPayload(null);
      setAnswerReviewStudent({
        userId: input.userId,
        name: input.name,
        scoreLabel: `${input.score}/${input.total}`,
      });
      try {
        const { session } = await safeGetSession();
        const reviewEndpoint = assignmentDetail.mockPaper
          ? `/api/classroom/${activeClassroomId}/posts/${assignmentDetail.id}/mock-paper-attempt?reviewAs=${encodeURIComponent(input.userId)}`
          : `/api/classroom/${activeClassroomId}/posts/${assignmentDetail.id}/generated-test-attempt?reviewAs=${encodeURIComponent(input.userId)}`;
        const res = await fetch(reviewEndpoint, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
          credentials: "include",
        });
        const data = (await res.json()) as
          | {
              error?: string;
            }
          | {
              testTitle: string;
              questions: Array<{
                id: string;
                question: string;
                options: string[];
                correctAnswerIndex: number | null;
              }>;
              attempt: {
                answers: number[];
                score: number;
                total: number;
                submittedAt: string | null;
              } | null;
            };
        if (!res.ok) {
          setAnswerReviewError(
            "error" in data && typeof data.error === "string"
              ? data.error
              : "Failed to load student answers."
          );
          return;
        }
        if (!("testTitle" in data)) {
          setAnswerReviewError("Failed to load student answers.");
          return;
        }
        setAnswerReviewPayload({
          testTitle: data.testTitle,
          questions: data.questions,
          attempt: data.attempt,
        });
      } catch {
        setAnswerReviewError("Network error while loading student answers.");
      } finally {
        setAnswerReviewLoading(false);
      }
    },
    [assignmentDetail, activeClassroomId]
  );

  useEffect(() => {
    if (!assignmentOpen) return;
    let cancelled = false;
    setMockPapersLoading(true);
    setMockPapersLoadError(null);
    setPastPapersLoading(true);
    setPastPapersLoadError(null);
    void fetchMockPapersFromSupabase()
      .then((papers) => {
        if (cancelled) return;
        setMockPapers(papers);
        setSelectedMockPaperId((prev) => {
          if (prev && papers.some((p) => p.id === prev)) return prev;
          return papers[0]?.id ?? null;
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setMockPapersLoadError(err instanceof Error ? err.message : "Could not load mock papers");
        setMockPapers([]);
        setSelectedMockPaperId(null);
      })
      .finally(() => {
        if (!cancelled) setMockPapersLoading(false);
      });
    void fetchPastPapersFromSupabase()
      .then((papers) => {
        if (cancelled) return;
        setPastPapers(papers);
        setSelectedPastPaperId((prev) => {
          if (prev && papers.some((p) => p.id === prev)) return prev;
          return papers[0]?.id ?? null;
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setPastPapersLoadError(err instanceof Error ? err.message : "Could not load past papers");
        setPastPapers([]);
        setSelectedPastPaperId(null);
      })
      .finally(() => {
        if (!cancelled) setPastPapersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assignmentOpen]);

  const refetchJoinRequests = useCallback(async () => {
    if (!activeClassroomId) return;
    try {
      const headers: HeadersInit = {};
      const currentSession = (await safeGetSession()).session;
      if (currentSession?.access_token)
        headers.Authorization = `Bearer ${currentSession.access_token}`;
      const res = await fetch(`/api/classroom/${activeClassroomId}/join-requests`, {
        headers,
        credentials: "include",
      });
      const data: unknown = await res.json();
      if (res.ok) setJoinRequests(Array.isArray(data) ? (data as JoinRequestRow[]) : []);
      else setJoinRequests([]);
    } catch {
      setJoinRequests([]);
    }
  }, [activeClassroomId]);

  useEffect(() => {
    setJoinRequests([]);
  }, [activeClassroomId]);

  useEffect(() => {
    if (!activeClassroomId || detailTab !== "students") return;
    const tick = async () => {
      await refetchJoinRequests();
      await onRefreshTeacherPortal({ silent: true });
    };
    void tick();
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void tick();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [activeClassroomId, detailTab, onRefreshTeacherPortal, refetchJoinRequests]);

  const approveJoinRequest = async (req: JoinRequestRow) => {
    if (!activeClassroomId || !teacherId) return;
    setActingJoinRequestId(req.id);
    try {
      const res = await fetchWithClientAuth(
        `/api/teacher/classroom/${encodeURIComponent(activeClassroomId)}/join-requests/${encodeURIComponent(req.id)}/approve`,
        { method: "POST" }
      );
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast({
          title: res.status === 403 ? "Student limit reached" : "Could not approve",
          description: body.error ?? "Try again.",
          variant: "destructive",
        });
        return;
      }
    } catch {
      toast({
        title: "Could not approve",
        description: "Could not verify student limit. Try again.",
        variant: "destructive",
      });
      return;
    } finally {
      setActingJoinRequestId(null);
    }
    setJoinRequests((prev) => prev.filter((r) => r.id !== req.id));
    await onRefreshTeacherPortal({ silent: true });
    const sectionsWithSeries = activeDetail.sections.filter((s) => s.googleSeriesLinked);
    if (sectionsWithSeries.length > 0) {
      // Section-first: new members are unassigned — Google invites run when they are placed in a section.
    } else if (activeClassroom?.googleSeriesLinked) {
      try {
        const currentSession = (await safeGetSession()).session;
        const headers: HeadersInit = {};
        if (currentSession?.access_token)
          headers.Authorization = `Bearer ${currentSession.access_token}`;
        const res = await fetch(
          `/api/integrations/google/classrooms/${activeClassroomId}/attendees`,
          {
            method: "POST",
            headers,
            credentials: "include",
          }
        );
        if (res.ok) {
          toast({
            title: "Calendar invite sent",
            description: "The approved student will get a Google Calendar email invite.",
          });
        }
      } catch {
        // best-effort
      }
    }
    toast({
      title: "Student added",
      description: `${req.profiles?.name ?? "Student"} can access this class now.`,
    });
    setActingJoinRequestId(null);
  };

  const createSection = async () => {
    if (!activeClassroomId || !activeClassroom) return;
    if (activeDetail.sections.length >= 6) {
      toast({
        title: "Section limit reached",
        description: "You can create up to 6 sections per classroom.",
        variant: "destructive",
      });
      return;
    }
    const sectionName = newSectionName.trim();
    if (!sectionName) {
      toast({ title: "Section name required", variant: "destructive" });
      return;
    }
    setSectionCreating(true);
    try {
      await chargeTeacherRdm("create_section", teacherRdmCosts);
      let createdRow: { id?: string } | null = null;
      try {
        const { data: created, error } = await supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from("classroom_sections" as any)
          .insert({
            classroom_id: activeClassroomId,
            name: sectionName,
            sort_order: activeDetail.sections.length,
          })
          .select("id")
          .single();
        createdRow = created as { id?: string } | null;
        if (error || !createdRow?.id) throw error ?? new Error("Could not create section.");
      } catch (e) {
        await refundTeacherRdm("create_section", teacherRdmCosts).catch(() => {});
        throw e;
      }

      toast({
        title: "Section created",
        description: "Book a Google Calendar live class below (Settings is open).",
      });
      setSectionDialogOpen(false);
      setNewSectionName("");
      setCohortTab({ kind: "section", id: createdRow.id });
      setDetailTab("settings");
      await onRefreshTeacherPortal({ silent: true });
    } catch (e) {
      toast({
        title: "Could not create section",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSectionCreating(false);
    }
  };

  const saveSectionName = async (sectionId: string) => {
    if (!activeClassroomId) return;
    const draft = (sectionNameDrafts[sectionId] ?? "").trim();
    if (!draft) {
      toast({ title: "Section name required", variant: "destructive" });
      return;
    }
    setSectionNameSavingId(sectionId);
    try {
      const { error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("classroom_sections" as any)
        .update({ name: draft })
        .eq("id", sectionId)
        .eq("classroom_id", activeClassroomId);
      if (error) throw error;
      toast({ title: "Section updated" });
      await onRefreshTeacherPortal({ silent: true });
    } catch (err) {
      toast({
        title: "Could not update section",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSectionNameSavingId(null);
    }
  };

  const deleteSection = async (sectionId: string) => {
    if (!activeClassroomId) return;
    const sec = activeDetail.sections.find((s) => s.id === sectionId);
    const ok =
      typeof window !== "undefined" &&
      window.confirm(
        `Delete section \"${sec?.name ?? "this section"}\"? This will:\n\n- remove its Google Calendar series (if linked)\n- delete section-scoped sessions and assignments\n- move students in this section to Unassigned\n\nThis cannot be undone.`
      );
    if (!ok) return;
    setSectionDeletingId(sectionId);
    try {
      const { data: sectionRow, error: sectionLoadErr } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("classroom_sections" as any)
        .select("id, name, google_recurring_event_id")
        .eq("id", sectionId)
        .eq("classroom_id", activeClassroomId)
        .maybeSingle();

      if (sectionLoadErr) throw sectionLoadErr;
      if (!sectionRow) {
        toast({
          title: "Section not found",
          description: "Refresh and try again.",
          variant: "destructive",
        });
        return;
      }

      const sectionSeriesRaw = (
        sectionRow as unknown as { google_recurring_event_id?: string | null }
      ).google_recurring_event_id;
      const sectionSeriesId =
        typeof sectionSeriesRaw === "string" && sectionSeriesRaw.trim()
          ? sectionSeriesRaw.trim()
          : "";

      // Remove the Calendar series from Google whenever this row still references one — do not rely on
      // cached portal flags (googleSeriesLinked), which can be stale.
      if (sectionSeriesId) {
        setGoogleSeriesStopping(true);
        try {
          const res = await fetchWithClientAuth(
            `/api/integrations/google/classrooms/${activeClassroomId}/stop`,
            {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode: "delete_series", sectionId }),
            }
          );
          const payload = (await res.json().catch(() => ({}))) as { error?: string };
          // If Calendar isn't connected or nothing is linked, allow deletion to proceed.
          if (!res.ok && res.status !== 409) {
            toast({
              title: "Section deleted, but Google reminders may continue",
              description:
                payload.error ||
                `We couldn't remove the Google Calendar series (${res.status}). If needed, reconnect Google and use “Stop future dates”.`,
              variant: "destructive",
            });
          }
        } catch (e) {
          toast({
            title: "Section deleted, but Google reminders may continue",
            description:
              e instanceof Error
                ? e.message
                : "We couldn't remove the Google Calendar series. If needed, reconnect Google and use “Stop future dates”.",
            variant: "destructive",
          });
        }
      }

      // Remove section-scoped content BEFORE deleting the section, otherwise FK ON DELETE SET NULL
      // would make these look like whole-class items in counts.
      const [{ error: sessionsErr }, { error: postsErr }] = await Promise.all([
        supabase
          .from("live_sessions")
          .delete()
          .eq("classroom_id", activeClassroomId)
          .eq("section_id", sectionId),
        supabase
          .from("posts")
          .delete()
          .eq("classroom_id", activeClassroomId)
          .eq("section_id", sectionId),
      ]);
      if (sessionsErr) throw sessionsErr;
      if (postsErr) throw postsErr;

      const { error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("classroom_sections" as any)
        .delete()
        .eq("id", sectionId)
        .eq("classroom_id", activeClassroomId);
      if (error) throw error;

      // If no sections remain, clear whole-class Google fields too — otherwise cards still show
      // “Google Calendar series active”, Join Meet (Whole class), etc. from stale classrooms.google_*.
      const { count: remainingSectionCount, error: cntErr } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("classroom_sections" as any)
        .select("id", { count: "exact", head: true })
        .eq("classroom_id", activeClassroomId);

      if (cntErr) throw cntErr;

      if ((remainingSectionCount ?? 0) === 0) {
        const { data: roomRow, error: roomErr } = await supabase
          .from("classrooms")
          .select("google_recurring_event_id, google_meet_link, google_rrule")
          .eq("id", activeClassroomId)
          .maybeSingle();

        if (roomErr) throw roomErr;

        const classSeriesId =
          typeof (roomRow as { google_recurring_event_id?: unknown } | null)
            ?.google_recurring_event_id === "string"
            ? String(
                (roomRow as { google_recurring_event_id: string }).google_recurring_event_id
              ).trim()
            : "";
        const meetingOrRuleLeft =
          Boolean(
            String(
              (roomRow as { google_meet_link?: string | null } | null)?.google_meet_link ?? ""
            ).trim()
          ) ||
          Boolean(
            String((roomRow as { google_rrule?: string | null } | null)?.google_rrule ?? "").trim()
          );

        if (classSeriesId) {
          setGoogleSeriesStopping(true);
          const res = await fetchWithClientAuth(
            `/api/integrations/google/classrooms/${activeClassroomId}/stop`,
            {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode: "delete_series" }),
            }
          );
          const payload = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok)
            throw new Error(
              payload.error || `Failed to remove class Google series (${res.status})`
            );
        } else if (meetingOrRuleLeft) {
          const { error: orphanErr } = await supabase
            .from("classrooms")
            .update({
              google_meet_link: null,
              google_rrule: null,
              google_recurrence_end_date: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", activeClassroomId);
          if (orphanErr) throw orphanErr;
        }
      }

      const calendarWasRemoved = Boolean(sectionSeriesId) || Boolean(sec?.googleSeriesLinked);

      toast({
        title: "Section deleted",
        description: calendarWasRemoved
          ? "Google Calendar series was removed, section content deleted, and students are now Unassigned."
          : "Section content deleted and students are now Unassigned.",
      });
      if (cohortTab.kind === "section" && cohortTab.id === sectionId) {
        setCohortTab({ kind: "class" });
      }
      await onRefreshTeacherPortal();
    } catch (err) {
      toast({
        title: "Could not delete section",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setGoogleSeriesStopping(false);
      setSectionDeletingId(null);
    }
  };

  const assignStudentToSection = async (studentUserId: string, nextSectionId: string | null) => {
    if (!activeClassroomId) return;
    try {
      const res = await fetchWithClientAuth(
        `/api/classroom/${activeClassroomId}/members/assign-section`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: studentUserId, sectionId: nextSectionId }),
        }
      );
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? `Failed (${res.status})`);
      await onRefreshTeacherPortal({ silent: true });
      toast({ title: "Section updated" });
    } catch (e) {
      toast({
        title: "Could not update section",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const removeStudentFromClassroom = async (studentUserId: string, studentName: string) => {
    if (!activeClassroomId) return;
    if (
      !confirm(`Remove ${studentName} from this class? They will need to request to join again.`)
    ) {
      return;
    }
    setRemovingStudentId(studentUserId);
    try {
      const { error } = await supabase
        .from("classroom_members")
        .delete()
        .eq("classroom_id", activeClassroomId)
        .eq("user_id", studentUserId);

      if (error) throw error;

      await onRefreshTeacherPortal({ silent: true });
      toast({
        title: "Student removed",
        description: `${studentName} has been removed from this classroom.`,
      });
    } catch (e) {
      toast({
        title: "Could not remove student",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setRemovingStudentId(null);
    }
  };

  const rejectJoinRequest = async (req: JoinRequestRow) => {
    if (!teacherId) return;
    setActingJoinRequestId(req.id);
    const { error } = await supabase
      .from("classroom_join_requests")
      .update({
        status: "rejected",
        responded_at: new Date().toISOString(),
        responded_by: teacherId,
      })
      .eq("id", req.id);
    if (error) {
      toast({ title: "Could not decline", description: error.message, variant: "destructive" });
      setActingJoinRequestId(null);
      return;
    }
    setJoinRequests((prev) => prev.filter((r) => r.id !== req.id));
    toast({ title: "Request declined" });
    setActingJoinRequestId(null);
  };

  const assignmentAudienceStudentCount = useMemo(() => {
    const isCustom = assignToLabel.trim().toLowerCase().startsWith("custom");
    if (isCustom) return assignmentCustomStudentIds.length;
    return assignmentAudienceCandidates.length;
  }, [assignToLabel, assignmentCustomStudentIds.length, assignmentAudienceCandidates.length]);

  const conceptFocusPublishTotalRdm = useMemo(
    () =>
      conceptFocusPublishGrandTotal(
        teacherRdmCosts.create_assignment,
        assignmentAudienceStudentCount,
        rewardRdm
      ),
    [teacherRdmCosts.create_assignment, assignmentAudienceStudentCount, rewardRdm]
  );

  const standardAssignmentPublishTotalRdm = useMemo(
    () =>
      assignmentCompletionPublishGrandTotal(
        teacherRdmCosts.create_assignment,
        assignmentAudienceStudentCount,
        rewardRdm
      ),
    [teacherRdmCosts.create_assignment, assignmentAudienceStudentCount, rewardRdm]
  );

  const submitAssignment = async () => {
    if (!activeClassroomId) return;
    const derivedType = assignmentType.toLowerCase().includes("mock")
      ? "mock"
      : assignmentType.toLowerCase().includes("quiz")
        ? "quiz"
        : assignmentType === "Concept Focus"
          ? "Concept Focus"
          : "assignment";
    if (
      derivedType === "mock" &&
      !mockPapersLoading &&
      mockPapers.length > 0 &&
      !selectedMockPaperId
    ) {
      toast({
        title: "Select a mock paper",
        description: "Choose which published mock paper this assignment refers to.",
        variant: "destructive",
      });
      return;
    }
    if (derivedType === "quiz") {
      if (curriculumLoading) {
        toast({
          title: "Syllabus still loading",
          description:
            "Wait for the curriculum to finish loading before creating this quiz assignment.",
          variant: "destructive",
        });
        return;
      }
      if (!chapterQuizSelectionComplete(chapterQuizSel, curriculumTaxonomy)) {
        toast({
          title: "Finish chapter quiz setup",
          description:
            "Select class, subject, chapter, topic, subtopic, and difficulty (including Set 1–6 for Advanced).",
          variant: "destructive",
        });
        return;
      }
    }
    if (isConceptFocusTemplate) {
      if (curriculumLoading) {
        toast({
          title: "Syllabus still loading",
          description: "Wait for the curriculum to finish loading before creating this assignment.",
          variant: "destructive",
        });
        return;
      }
      if (!conceptFocusSelectionComplete(conceptFocusSel, curriculumTaxonomy)) {
        toast({
          title: "Finish concept focus setup",
          description: "Select class, subject, chapter, topic, and subtopic.",
          variant: "destructive",
        });
        return;
      }
    }
    const isCustomAudience = assignToLabel.trim().toLowerCase().startsWith("custom");
    if (isCustomAudience && assignmentCustomStudentIds.length === 0) {
      toast({
        title: "Pick at least one student",
        description: "Select the students who should receive this assignment.",
        variant: "destructive",
      });
      return;
    }
    const confirmEscrow = rewardRdm > 0 && assignmentAudienceStudentCount > 0;
    const confirmUnlock = isConceptFocusTemplate && assignmentAudienceStudentCount > 0;
    await runAssignmentSubmit(confirmEscrow, confirmUnlock);
  };

  const runAssignmentSubmit = async (
    confirmCompletionEscrow: boolean,
    confirmSubtopicUnlock: boolean
  ) => {
    if (!activeClassroomId) return;
    const derivedType = assignmentType.toLowerCase().includes("mock")
      ? "mock"
      : assignmentType.toLowerCase().includes("quiz")
        ? "quiz"
        : assignmentType === "Concept Focus"
          ? "Concept Focus"
          : "assignment";
    const isCustomAudience = assignToLabel.trim().toLowerCase().startsWith("custom");
    setAssignmentSubmitting(true);
    try {
      const defaultTasks = normalizeTaskPositions(
        buildDefaultTasksForAssignmentType(assignmentType).filter((t) => t.label.trim())
      );
      const selectedPaper = mockPapers.find((p) => p.id === selectedMockPaperId);
      const mockPaper: TeacherPortalMockPaperRef | undefined =
        derivedType === "mock" && selectedPaper
          ? {
              id: selectedPaper.id,
              slug: (selectedPaper.slug ?? selectedPaper.id).trim(),
              title: selectedPaper.title.trim(),
            }
          : undefined;
      const chapterQuizRef: TeacherPortalChapterQuizRef | null =
        derivedType === "quiz"
          ? chapterQuizToRef(chapterQuizSel, curriculumTaxonomy)
          : isConceptFocusTemplate
            ? chapterQuizToRef(
                {
                  ...conceptFocusSel,
                  level: "advanced",
                  advancedSet: 1,
                } as ChapterQuizSelectionState,
                curriculumTaxonomy
              )
            : null;
      const dailyDoseStreak: TeacherPortalDailyDoseStreakRef | null = assignmentType
        .toLowerCase()
        .includes("dailydose")
        ? { trackId: dailyDoseTrackId, trackLabel: trackLabelById(dailyDoseTrackId) }
        : null;
      const gyanEngagement: TeacherPortalGyanEngagementRef | null = isGyanEngagementTemplate
        ? { topicFocus: gyanTopicFocus.trim(), subtopicHint: gyanSubtopicHint.trim() }
        : null;
      await onCreateAssignment({
        classroomId: activeClassroomId,
        sectionId: assignmentTargetSectionId,
        assignmentType: derivedType,
        title: assignmentTitle,
        dueDate: assignmentDueDate || null,
        assignToLabel,
        targetStudentIds: isCustomAudience ? assignmentCustomStudentIds : null,
        rewardRdm,
        instructions: assignmentInstructions,
        tasks: defaultTasks.length ? defaultTasks : undefined,
        mockPaper: derivedType === "mock" ? (mockPaper ?? null) : undefined,
        chapterQuiz:
          derivedType === "quiz" || derivedType === "Concept Focus" ? chapterQuizRef : undefined,
        dailyDoseStreak: dailyDoseStreak ?? undefined,
        gyanEngagement: gyanEngagement ?? undefined,
        confirmCompletionEscrow,
        confirmSubtopicUnlock,
      });
      await onRefreshTeacherPortal({ silent: true });
      window.setTimeout(() => {
        void onRefreshTeacherPortal({ silent: true });
      }, 1200);
      setAssignmentOpen(false);
      setAssignmentTitle("");
      setAssignmentDueDate("");
      setAssignmentInstructions("");
      if (assignmentDraftKey) window.sessionStorage.removeItem(assignmentDraftKey);
    } finally {
      setAssignmentSubmitting(false);
    }
  };

  const openMotivation = (
    student: TeacherPortalClassroomStudent,
    action: "boost" | "nudge" | "urgent_nudge"
  ) => {
    setSelectedStudent(student);
    setMotivationAction(action);
    setMotivationTarget(student.userId);
    const defaultType: MotivationMessageType =
      action === "boost" ? "top_performer" : "streak_reengagement";
    setMotivationMessageType(defaultType);
    setMotivationMessage(display.messageTemplate(action, defaultType, student.name));
    setMotivationOpen(true);
  };

  const submitMotivation = async () => {
    if (!activeClassroomId) return;
    const classroomStudents = cohortStudents;
    const targetStudentIds =
      motivationTarget === "all_students"
        ? classroomStudents.map((student) => student.userId)
        : motivationTarget === "off_streak"
          ? classroomStudents
              .filter((student) => student.status === "off_streak" || student.status === "at_risk")
              .map((student) => student.userId)
          : [motivationTarget || selectedStudent?.userId].filter((id): id is string => Boolean(id));
    if (!targetStudentIds.length) return;
    setMotivationSubmitting(true);
    try {
      await onMotivateStudents({
        classroomId: activeClassroomId,
        actionKind: motivationAction,
        targetStudentIds,
        message: motivationMessage,
        rdmDelta: 0,
        sectionId: cohortTab.kind === "section" ? cohortTab.id : null,
        studentMessageKind:
          motivationAction === "boost" || motivationMessageType === "top_performer"
            ? "recognition"
            : motivationAction === "urgent_nudge"
              ? "urgent_checkin"
              : "teacher_nudge",
        notificationTitle: buildStudentNotificationTitle({
          kind:
            motivationAction === "boost" || motivationMessageType === "top_performer"
              ? "recognition"
              : motivationAction === "urgent_nudge"
                ? "urgent_checkin"
                : "teacher_nudge",
          actionKind: motivationAction,
        }),
      });
      setMotivationOpen(false);
      setSelectedStudent(null);
    } finally {
      setMotivationSubmitting(false);
    }
  };

  const rewardTopStudents = async () => {
    if (!activeClassroomId) return;
    const topIds = [...cohortStudents]
      .filter((s) => s.streakDays > 0)
      .sort((a, b) => b.streakDays - a.streakDays)
      .slice(0, 5)
      .map((s) => s.userId);
    if (topIds.length === 0) return;
    setRewardSubmitting(true);
    try {
      await onRewardTopStudents({
        classroomId: activeClassroomId,
        targetStudentIds: topIds,
        message: "Rewarded top tier students for highest streak consistency.",
        rdmDelta: 0,
        sectionId: cohortTab.kind === "section" ? cohortTab.id : null,
      });
    } finally {
      setRewardSubmitting(false);
    }
  };

  const saveClassroomSettings = async () => {
    if (!activeClassroom) return;
    const trimmedName = settingsName.trim();
    if (!trimmedName) {
      toast({
        title: "Class name required",
        description: "Enter a name before saving.",
        variant: "destructive",
      });
      return;
    }
    setSettingsSaving(true);
    try {
      await onUpdateClassroom({
        classroomId: activeClassroom.id,
        name: trimmedName,
        subject: settingsSubject.trim() || null,
        section: settingsSection.trim() || null,
        introVideoUrl: settingsIntroVideoUrl.trim() || null,
      });
    } catch (err) {
      toast({
        title: "Could not save",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSettingsSaving(false);
    }
  };

  const stopGoogleCalendarSeriesForDelete = async (): Promise<{
    attempted: number;
    removed: number;
    failed: Array<{ scope: "classroom" | "section"; sectionId?: string | null; error: string }>;
  }> => {
    if (!activeClassroom) return { attempted: 0, removed: 0, failed: [] };
    const classroomId = activeClassroom.id;
    const linkedSections = (activeDetail?.sections ?? []).filter((s) => s.googleSeriesLinked);
    const targets: Array<{ scope: "classroom" | "section"; sectionId: string | null }> = [
      { scope: "classroom" as const, sectionId: null },
      ...linkedSections.map((s) => ({ scope: "section" as const, sectionId: s.id })),
    ];

    let removed = 0;
    const failed: Array<{
      scope: "classroom" | "section";
      sectionId?: string | null;
      error: string;
    }> = [];
    for (const t of targets) {
      try {
        const res = await fetchWithClientAuth(
          `/api/integrations/google/classrooms/${classroomId}/stop`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "delete_series", sectionId: t.sectionId }),
          }
        );
        if (res.ok) {
          removed += 1;
          continue;
        }
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        // If Calendar isn't connected or nothing is linked, we still allow deleting the classroom.
        if (res.status === 409) continue;
        failed.push({
          scope: t.scope,
          sectionId: t.sectionId,
          error: payload.error || `Request failed (${res.status})`,
        });
      } catch (e) {
        failed.push({
          scope: t.scope,
          sectionId: t.sectionId,
          error: e instanceof Error ? e.message : "Request failed",
        });
      }
    }
    return { attempted: targets.length, removed, failed };
  };

  const removeClassroom = async () => {
    if (!activeClassroom || !teacherId) return;
    const ok =
      typeof window !== "undefined" &&
      window.confirm(
        `Delete "${activeClassroom.name}"? Students lose access and enrollments are removed. We'll also try to remove Google Calendar reminders for this class. This cannot be undone.`
      );
    if (!ok) return;
    setSettingsDeleting(true);
    try {
      const calendarRes = await stopGoogleCalendarSeriesForDelete();
      if (calendarRes.failed.length) {
        toast({
          title: "Deleted class, but calendar cleanup had issues",
          description:
            "Some Google Calendar reminders may still appear because we couldn't remove all linked series (try: Meet & Google Calendar → Stop future dates / Reset Google).",
          variant: "destructive",
        });
      }
      await onDeleteClassroom({ classroomId: activeClassroom.id });
      setActiveClassroomId(null);
      setDetailTab("students");
    } catch (err) {
      toast({
        title: "Could not delete classroom",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSettingsDeleting(false);
    }
  };

  const disconnectGoogleCalendar = async () => {
    const ok =
      typeof window !== "undefined" &&
      window.confirm(
        "Disconnect Google Calendar? New classes will not sync to Google until you connect again. Existing calendar events are not deleted."
      );
    if (!ok) return;
    setGoogleDisconnecting(true);
    try {
      const res = await fetchWithClientAuth("/api/integrations/google/disconnect", {
        method: "POST",
        credentials: "include",
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || `Request failed (${res.status})`);
      toast({
        title: "Google Calendar disconnected",
        description:
          "You can reconnect anytime; Meet links in EduBlast stay until you remove them.",
      });
      await onRefreshTeacherPortal();
    } catch (err) {
      toast({
        title: "Could not disconnect",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setGoogleDisconnecting(false);
    }
  };

  const syncStudentCalendarInvites = async () => {
    if (!activeClassroom) return;
    setGoogleInviteSyncing(true);
    try {
      const sectionsWithSeries = activeDetail.sections.filter((s) => s.googleSeriesLinked);
      if (sectionsWithSeries.length > 0) {
        for (const sec of sectionsWithSeries) {
          const res = await fetchWithClientAuth(
            `/api/integrations/google/classrooms/${activeClassroom.id}/attendees`,
            {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sectionId: sec.id }),
            }
          );
          const payload = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) throw new Error(payload.error || `Request failed (${res.status})`);
        }
        toast({
          title: "Calendar invites updated",
          description: `Synced ${sectionsWithSeries.length} section calendar(s).`,
        });
      } else {
        const res = await fetchWithClientAuth(
          `/api/integrations/google/classrooms/${activeClassroom.id}/attendees`,
          {
            method: "POST",
            credentials: "include",
          }
        );
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          addedStudentEmails?: number;
          totalAttendees?: number;
          studentsWithoutEmail?: number;
          enrolledStudents?: number;
        };
        if (!res.ok) throw new Error(payload.error || `Request failed (${res.status})`);
        toast({
          title: "Calendar invites updated",
          description: `Google emailed ${payload.addedStudentEmails ?? 0} student address(es); ${payload.totalAttendees ?? 0} attendee(s) on the event. ${payload.studentsWithoutEmail ?? 0} of ${payload.enrolledStudents ?? 0} enrolled students had no account email.`,
        });
      }
      await onRefreshTeacherPortal({ silent: true });
    } catch (err) {
      toast({
        title: "Could not sync invites",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setGoogleInviteSyncing(false);
    }
  };

  const stopGoogleSeries = async (
    mode: "until_today" | "delete_series",
    sectionId?: string | null
  ) => {
    if (!activeClassroom) return;
    const msg =
      mode === "delete_series"
        ? sectionId
          ? "Remove the entire Google Calendar series for this section?"
          : "Remove the entire Google Calendar series for this class? Past instances may disappear from Google Calendar."
        : sectionId
          ? "Stop future dates for this section from today in Google Calendar?"
          : "Stop future class dates from today in Google Calendar? Past sessions stay on the calendar.";
    if (typeof window !== "undefined" && !window.confirm(msg)) return;
    setGoogleSeriesStopping(true);
    try {
      const res = await fetchWithClientAuth(
        `/api/integrations/google/classrooms/${activeClassroom.id}/stop`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, sectionId: sectionId ?? null }),
        }
      );
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        cleared?: boolean;
      };
      if (!res.ok) throw new Error(payload.error || `Request failed (${res.status})`);
      toast({
        title: mode === "delete_series" ? "Calendar series removed" : "Future classes stopped",
        description:
          payload.message ??
          "Google Calendar was updated. Refresh if Meet links still show cached values.",
      });
      await onRefreshTeacherPortal();
    } catch (err) {
      toast({
        title: "Could not update Google Calendar",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setGoogleSeriesStopping(false);
    }
  };

  /** Deletes Calendar events from Google when possible, then clears all google_* fields on the class and sections. */
  const resetAllGoogleForClassroom = async () => {
    if (!activeClassroom) return;
    const ok =
      typeof window !== "undefined" &&
      window.confirm(
        "Clear all Google Calendar and Meet data for this class? This removes recurring events from Google (when Calendar is connected) and clears Meet links on this class and every section. Students and assignments are not deleted—only Google linkage."
      );
    if (!ok) return;
    setGoogleSeriesStopping(true);
    try {
      const res = await fetchWithClientAuth(
        `/api/integrations/google/classrooms/${activeClassroom.id}/reset-google`,
        { method: "POST", credentials: "include" }
      );
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || `Request failed (${res.status})`);
      toast({
        title: "Google data cleared",
        description: "This class no longer has Calendar series or Meet links stored.",
      });
      await onRefreshTeacherPortal();
    } catch (err) {
      toast({
        title: "Could not clear Google data",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setGoogleSeriesStopping(false);
    }
  };

  const copyJoinCode = async () => {
    const code = activeClassroom?.joinCode?.trim();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: "Join code copied" });
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  const connectGoogleCalendarFromToolbar = async () => {
    try {
      const r = await redirectToGoogleCalendarConsent();
      if (r.mode === "popup" && r.connected) {
        toast({ title: "Google Calendar connected" });
        await onRefreshTeacherPortal({ silent: true });
      }
    } catch (err) {
      toast({
        title: "Could not start Google connect",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const selectClassName =
    "h-10 sm:h-11 w-full appearance-none rounded-xl border border-white/15 bg-[#070b17] px-3 pr-10 text-sm outline-none focus:border-emerald-400";

  return (
    <div className="space-y-3 sm:space-y-5">
      {!activeClassroom ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-serif text-3xl leading-tight sm:text-4xl lg:text-5xl">
                My <span className="text-emerald-400 italic">Classrooms</span>
              </h1>
              <p className="text-xs text-slate-400 sm:text-sm lg:text-base">
                Create and manage your student batches — assign tasks, track progress and motivate
                students.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs text-slate-200 hover:bg-white/5 sm:px-4 sm:py-2.5 sm:text-sm"
              >
                <Star className="h-4 w-4" />
                Send Group RDM
              </button>
              {summary.googleCalendarConnected ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-10 items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15 sm:h-11 sm:px-3.5 sm:text-sm"
                      title="Google Calendar connected"
                    >
                      <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Connected
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-52 border-white/10 bg-[#15162b] p-1 shadow-xl"
                  >
                    <button
                      type="button"
                      onClick={() => void connectGoogleCalendarFromToolbar()}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-200 hover:bg-white/10"
                    >
                      Reconnect Google
                    </button>
                    <button
                      type="button"
                      disabled={googleDisconnecting}
                      onClick={() => void disconnectGoogleCalendar()}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-300 hover:bg-white/10 disabled:opacity-50"
                    >
                      {googleDisconnecting ? "Disconnecting…" : "Disconnect Google"}
                    </button>
                  </PopoverContent>
                </Popover>
              ) : (
                <button
                  type="button"
                  onClick={() => void connectGoogleCalendarFromToolbar()}
                  className="inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-500/15 sm:px-4 sm:py-2.5 sm:text-sm"
                >
                  Connect Google Calendar
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-3 py-2 text-xs font-semibold text-black hover:bg-emerald-400 sm:px-4 sm:py-2.5 sm:text-sm"
              >
                <Plus className="h-4 w-4" />
                <span className="inline-flex items-baseline gap-1.5">
                  New Classroom
                  {createClassroomRdmCompact ? (
                    <span className="text-[10px] font-normal opacity-80">{createClassroomRdmCompact}</span>
                  ) : null}
                </span>
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:gap-3.5 md:grid-cols-4">
            <StatCard
              label="Active classrooms"
              value={String(summary.activeClassrooms)}
              sub={`${summary.totalStudents} total students`}
              accent="text-emerald-300"
            />
            <StatCard
              label="Assignments active"
              value={String(summary.assignmentsActive)}
              sub="Across your classes"
              accent="text-violet-300"
            />
            <StatCard
              label="Avg completion"
              value={display.formatOptionalPercent(summary.avgCompletionPercent)}
              sub={
                summary.avgCompletionPercent == null
                  ? "Not tracked yet"
                  : "Derived from live activity"
              }
              accent={summary.avgCompletionPercent == null ? "text-slate-400" : "text-amber-300"}
            />
            <StatCard
              label="RDM distributed"
              value={summary.rdmDistributedMonth.toLocaleString("en-IN")}
              sub="This month"
              accent="text-rose-300"
            />
          </div>

          <div className="mb-2 text-xs uppercase tracking-widest text-slate-500">
            Your classrooms
          </div>
        </>
      ) : null}
      {activeClassroom ? (
        <div className="space-y-2.5 sm:space-y-3">
          <button
            type="button"
            onClick={() => {
              setActiveClassroomId(null);
              setDetailTab("students");
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.05] px-3.5 py-2 text-xs font-semibold tracking-tight text-slate-200 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] transition hover:border-white/20 hover:bg-white/[0.1] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0c14] active:scale-[0.98]"
          >
            <ChevronLeft className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            Back to classrooms
          </button>
          <div className="flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-linear-to-b from-[#12172b] to-[#101426] p-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:p-5">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-3">
                <div
                  title={activeClassroom.name}
                  className="min-w-0 flex-1 truncate font-serif text-xl leading-tight sm:text-[30px] lg:text-[36px]"
                >
                  {activeClassroom.name}
                </div>
                <button
                  type="button"
                  onClick={() => setSessionsDialogClassroom(activeClassroom)}
                  className="shrink-0 rounded-full border border-violet-500/35 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-violet-200 hover:bg-violet-500/20"
                >
                  Sessions
                </button>
              </div>
              <div className="mt-1 text-xs text-slate-400 sm:text-sm lg:text-base break-words">
                {(activeClassroom.subject ?? "General").trim()} ·{" "}
                {activeClassroom.section ?? "Section"} · {activeClassroom.studentCount} students ·{" "}
                {activeClassroom.scheduleLabel}
                {" · "}
                <MeetSessionsStack
                  sessions={activeClassroom.meetSessions ?? null}
                  fallbackLabel={activeClassroom.nextSessionLabel}
                  hostJoin
                  googleCalendarEmail={googleCalendarEmail}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {!summary.googleCalendarConnected ? (
                <button
                  type="button"
                  onClick={() => void connectGoogleCalendarFromToolbar()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 text-xs font-semibold text-sky-100 hover:bg-sky-500/20"
                >
                  Connect Google Calendar
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setInviteDialogOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 px-3 text-xs font-semibold"
              >
                <UserPlus className="h-3.5 w-3.5" /> Invite Student
              </button>
              <button
                type="button"
                onClick={() => {
                  setAssignmentOpen(true);
                }}
                disabled={cohortTab.kind === "unassigned"}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 px-3 text-xs font-semibold disabled:opacity-50"
              >
                <BookOpen className="h-3.5 w-3.5" /> Set Assignment
              </button>
            </div>
          </div>
          <div
            role="tablist"
            aria-label="Class cohorts"
            className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-white/10 bg-[#101426] p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <button
              role="tab"
              aria-selected={cohortTab.kind === "class" || cohortTab.kind === "unassigned"}
              type="button"
              onClick={() => setCohortTab({ kind: "class" })}
              className={`shrink-0 h-9 rounded-full border px-4 text-sm font-semibold ${
                cohortTab.kind === "class" || cohortTab.kind === "unassigned"
                  ? "border-violet-400/40 bg-violet-500/15 text-violet-200"
                  : "border-white/15 text-slate-400 hover:border-white/25 hover:text-slate-200"
              }`}
            >
              Class
            </button>
            {activeDetail.sections.map((sec) => (
              <button
                key={sec.id}
                role="tab"
                aria-selected={cohortTab.kind === "section" && cohortTab.id === sec.id}
                type="button"
                onClick={() => setCohortTab({ kind: "section", id: sec.id })}
                className={`shrink-0 flex min-w-[160px] flex-col items-start rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                  cohortTab.kind === "section" && cohortTab.id === sec.id
                    ? "border-violet-400/40 bg-violet-500/15 text-violet-200"
                    : "border-white/15 text-slate-400 hover:border-white/25 hover:text-slate-200"
                }`}
              >
                <span className="max-w-[200px] truncate leading-tight">{sec.name}</span>
                <span className="text-[10px] font-semibold text-slate-500">
                  {sec.scheduleLabel?.trim() ||
                    (sec.googleSeriesLinked ? "Legacy calendar series" : "No live class booked")}
                </span>
                {(() => {
                  const rdmLine = formatSectionScheduleDeliveryRdmLabel({
                    hasSchedule: Boolean(sec.scheduleLabel?.trim() || sec.googleSeriesLinked),
                    expectedDeliveryRdm: sec.expectedDeliveryRdm,
                    deliveryRdmGrantedTotal: sec.deliveryRdmGrantedTotal,
                  });
                  return rdmLine ? (
                    <span className="mt-0.5 max-w-[200px] truncate text-[10px] font-semibold text-amber-300/90">
                      {rdmLine}
                    </span>
                  ) : null;
                })()}
              </button>
            ))}
            <div className="ml-auto flex shrink-0 items-center gap-2 pl-1">
              {(cohortTab.kind === "class" || cohortTab.kind === "unassigned") && (
                <div className="flex overflow-hidden rounded-full border border-white/10 bg-black/20">
                  <button
                    type="button"
                    onClick={() => setCohortTab({ kind: "class" })}
                    className={`px-3 py-1 text-xs font-semibold ${
                      cohortTab.kind === "class"
                        ? "bg-white/10 text-white"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setCohortTab({ kind: "unassigned" })}
                    className={`px-3 py-1 text-xs font-semibold ${
                      cohortTab.kind === "unassigned"
                        ? "bg-white/10 text-white"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    }`}
                  >
                    Unassigned
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setSectionDialogOpen(true)}
                className="inline-flex items-baseline gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10"
              >
                + Add section
                {createSectionRdmCompact ? (
                  <span className="text-[10px] font-normal text-slate-400">{createSectionRdmCompact}</span>
                ) : null}
              </button>
            </div>
          </div>
          {activeClassroom.isDemoShowcase ? (
            <>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-slate-300">
                <span className="font-semibold text-emerald-300">🔥 Streak alert:</span> 4 students
                haven&apos;t studied in 2+ days — send a personalised nudge and +10 RDM each to
                re-engage them.
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-slate-300">
                <span className="font-semibold text-amber-300">
                  👥 Ad-hoc EduBlast Students — 10-min Trial Active:
                </span>{" "}
                3 members currently in free trial. They can continue by paying 50 RDM; you earn +30
                RDM per conversion.
              </div>
            </>
          ) : null}
          <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-white/10 bg-[#101426] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] min-[520px]:grid-cols-3 sm:grid-cols-5">
            {[
              {
                key: "students" as const,
                label: `Students (${cohortStudents.length})`,
              },
              {
                key: "assignments" as const,
                label: `Assignments (${cohortAssignments.length})`,
              },
              { key: "progress" as const, label: "Progress" },
              { key: "streaks" as const, label: "Streaks & RDM" },
              { key: "settings" as const, label: "Settings", icon: Settings },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setDetailTab(tab.key)}
                className={`inline-flex items-center justify-center gap-1 px-2 py-2 text-[11px] font-semibold sm:py-2.5 sm:text-xs ${
                  detailTab === tab.key
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5"
                }`}
              >
                {"icon" in tab && tab.icon ? (
                  <tab.icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                ) : null}
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>
          {detailTab === "students" ? (
            <div className="space-y-3">
              {cohortTab.kind === "class" ? (
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3.5 sm:p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-violet-100">
                      Join requests ({joinRequests.length} pending)
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">Auto-refresh ~8s</span>
                      <button
                        type="button"
                        onClick={() => void refetchJoinRequests()}
                        className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/5"
                      >
                        Refresh now
                      </button>
                    </div>
                  </div>
                  <p className="mb-3 text-xs text-slate-400">
                    Students who tap &quot;Request to join&quot; from Explore show up here before
                    they appear in Enrolled Students.
                  </p>
                  {joinRequests.length === 0 ? (
                    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-500">
                      No pending requests. This list updates automatically while you keep this class
                      open.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {joinRequests.map((req) => (
                        <div
                          key={req.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#111529] px-3 py-2.5"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[11px] font-bold text-violet-200">
                              {(req.profiles?.name ?? "?").slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-100">
                                {req.profiles?.name ?? "Student"}
                              </div>
                              <div className="text-[11px] text-slate-500">Requested to join</div>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => void approveJoinRequest(req)}
                              disabled={actingJoinRequestId !== null}
                              className="inline-flex h-8 items-center gap-1 rounded-full bg-emerald-500 px-3 text-xs font-semibold text-black disabled:opacity-50"
                            >
                              {actingJoinRequestId === req.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => void rejectJoinRequest(req)}
                              disabled={actingJoinRequestId !== null}
                              className="inline-flex h-8 items-center gap-1 rounded-full border border-rose-500/40 px-3 text-xs font-semibold text-rose-200 hover:bg-rose-500/10 disabled:opacity-50"
                            >
                              {actingJoinRequestId === req.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <X className="h-3.5 w-3.5" />
                              )}
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
              {cohortTab.kind === "section" && activeClassroomId
                ? (() => {
                    const sec =
                      activeDetail.sections.find((s) => s.id === cohortTab.id) ?? null;
                    if (!sec || sec.isActive === false) return null;
                    return (
                      <BookLiveClassSlotPanel
                        variant="compact"
                        classroomId={activeClassroomId}
                        sectionId={sec.id}
                        sectionName={sec.name}
                        googleCalendarConnected={summary.googleCalendarConnected}
                        googleCalendarEmail={googleCalendarEmail}
                        onConnectGoogle={() => void connectGoogleCalendarFromToolbar()}
                        onBooked={() => void onRefreshTeacherPortal({ silent: true })}
                        autoOpenSchedule={autoOpenScheduleSectionId === sec.id}
                        onAutoOpenScheduleHandled={() => setAutoOpenScheduleSectionId(null)}
                      />
                    );
                  })()
                : null}
              <div className="rounded-xl border border-white/10 bg-[#15162b] p-3.5 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Enrolled Students</div>
                  <div className="flex items-center gap-2">
                    <input
                      placeholder="search students..."
                      className="h-8 w-40 rounded-full border border-white/10 bg-[#0c1020] px-3 text-xs text-slate-300 outline-none placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      className="h-8 rounded-full border border-white/10 bg-[#0c1020] px-3 text-xs text-slate-300"
                    >
                      Filter
                    </button>
                  </div>
                </div>
                <div className="mb-2 grid grid-cols-[1.2fr_0.7fr_0.6fr_0.5fr_0.5fr_0.5fr_1.4fr] gap-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  <div>Student</div>
                  <div>Last active</div>
                  <div>Avg score</div>
                  <div>Streak</div>
                  <div>RDM</div>
                  <div>Status</div>
                  <div>Action</div>
                </div>
                <div className="space-y-2">
                  {cohortStudents.length === 0 ? (
                    <div className="text-sm text-slate-400">
                      No students enrolled yet.
                      <span className="mt-1 block text-xs text-slate-500">
                        Approve a join request above (or invite with your join code from Settings) —
                        the roster also refreshes automatically.
                      </span>
                    </div>
                  ) : (
                    cohortStudents.map((s) => (
                      <div
                        key={s.userId}
                        className="grid grid-cols-[1.2fr_0.7fr_0.6fr_0.5fr_0.5fr_0.5fr_1.4fr] items-center gap-2 rounded-lg border border-white/10 bg-[#111529] px-3 py-2.5 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/15 text-[11px] font-bold text-violet-200">
                            {display.initials(s.name)}
                          </div>
                          <div>
                            <div className="font-semibold">{s.name}</div>
                            <div className="text-[11px] text-slate-500">
                              {activeClassroom.section ?? "PUC"}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-slate-400">
                          {s.lastActiveAt ? display.formatRelativeTime(s.lastActiveAt) : "—"}
                        </div>
                        <div
                          className={`font-semibold ${s.avgScorePercent == null ? "text-slate-500" : "text-amber-300"}`}
                        >
                          {display.formatOptionalPercent(s.avgScorePercent)}
                        </div>
                        <div className="text-slate-300">{s.streakDays} days</div>
                        <div className="font-semibold text-violet-300">{s.rdm}</div>
                        <div className={display.statusPill(s.status)}>
                          {s.status === "off_streak"
                            ? "Off-streak"
                            : s.status === "at_risk"
                              ? "At risk"
                              : "Active"}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Popover
                              open={sectionPickerStudentId === s.userId}
                              onOpenChange={(open) =>
                                setSectionPickerStudentId(open ? s.userId : null)
                              }
                            >
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex h-6 items-center gap-1 rounded-full border border-white/15 bg-[#0c1020] px-2 text-[10px] font-semibold text-slate-200 hover:border-white/25"
                                >
                                  {(s.sectionId ? sectionById.get(s.sectionId)?.name : null) ||
                                    "Unassigned"}
                                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent
                                align="end"
                                sideOffset={8}
                                className="w-[320px] rounded-2xl border border-white/15 bg-[#0f1329] p-2 text-slate-100 shadow-xl"
                              >
                                <div className="px-2 pb-2 pt-1">
                                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                    Assign student to
                                  </div>
                                  <div className="text-xs text-slate-400">
                                    Choose a section (or keep unassigned)
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSectionPickerStudentId(null);
                                      void assignStudentToSection(s.userId, null);
                                    }}
                                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-xs font-semibold ${
                                      s.sectionId == null
                                        ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                                        : "border-white/10 bg-black/20 text-slate-200 hover:border-white/20"
                                    }`}
                                  >
                                    <div>
                                      <div className="text-slate-100">Unassigned</div>
                                      <div className="mt-0.5 text-[11px] font-medium text-slate-500">
                                        Not in any section yet
                                      </div>
                                    </div>
                                    {s.sectionId == null ? (
                                      <Check className="h-4 w-4 text-emerald-300" />
                                    ) : null}
                                  </button>
                                  {activeDetail.sections.map((sec) => {
                                    const selected = s.sectionId === sec.id;
                                    const meta = sectionById.get(sec.id);
                                    const schedule = meta?.scheduleLabel?.trim() || "No schedule";
                                    const count = studentCountBySectionId.get(sec.id) ?? 0;
                                    return (
                                      <button
                                        key={sec.id}
                                        type="button"
                                        onClick={() => {
                                          setSectionPickerStudentId(null);
                                          void assignStudentToSection(s.userId, sec.id);
                                        }}
                                        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-xs font-semibold ${
                                          selected
                                            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                                            : "border-white/10 bg-black/20 text-slate-200 hover:border-white/20"
                                        }`}
                                      >
                                        <div className="min-w-0">
                                          <div className="truncate text-slate-100">{sec.name}</div>
                                          <div className="mt-0.5 text-[11px] font-medium text-slate-500">
                                            {count} students · {schedule}
                                          </div>
                                        </div>
                                        {selected ? (
                                          <Check className="h-4 w-4 text-emerald-300" />
                                        ) : null}
                                      </button>
                                    );
                                  })}
                                </div>
                              </PopoverContent>
                            </Popover>
                            <button
                              type="button"
                              onClick={() => openMotivation(s, display.recommendedAction(s))}
                              className={`h-6 rounded-full border px-2.5 text-[10px] font-semibold ${display.actionClass(display.recommendedAction(s))}`}
                            >
                              {display.actionLabel(display.recommendedAction(s))}
                            </button>
                            <button
                              type="button"
                              disabled={removingStudentId === s.userId}
                              onClick={() => void removeStudentFromClassroom(s.userId, s.name)}
                              className="inline-flex h-6 items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2 text-[10px] font-semibold text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
                              title={`Remove ${s.name}`}
                            >
                              {removingStudentId === s.userId ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <UserMinus className="h-3 w-3" />
                              )}
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
          {detailTab === "assignments" ? (
            <div className="rounded-xl border border-white/10 bg-[#15162b] p-3 sm:p-4">
              <div className="mb-2.5 flex flex-col gap-3 sm:mb-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    View
                  </span>
                  <div
                    className="inline-flex max-w-full rounded-xl border border-white/10 bg-black/30 p-0.5"
                    role="tablist"
                    aria-label="Assignment due status"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={assignmentDueBucket === "active"}
                      onClick={() => setAssignmentDueBucket("active")}
                      className={`flex min-h-[36px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-left text-[11px] font-semibold transition sm:flex-initial sm:px-3.5 sm:text-xs ${
                        assignmentDueBucket === "active"
                          ? "bg-emerald-500/20 text-emerald-100 shadow-sm ring-1 ring-emerald-400/35"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      }`}
                    >
                      Active assignments
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                          assignmentDueBucket === "active"
                            ? "bg-emerald-500/25 text-emerald-200"
                            : "bg-white/10 text-slate-400"
                        }`}
                      >
                        {assignmentDueCounts.active}
                      </span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={assignmentDueBucket === "pastDue"}
                      onClick={() => setAssignmentDueBucket("pastDue")}
                      className={`flex min-h-[36px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-left text-[11px] font-semibold transition sm:flex-initial sm:px-3.5 sm:text-xs ${
                        assignmentDueBucket === "pastDue"
                          ? "bg-amber-500/15 text-amber-100 shadow-sm ring-1 ring-amber-400/35"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      }`}
                    >
                      Past due
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                          assignmentDueBucket === "pastDue"
                            ? "bg-amber-500/25 text-amber-200"
                            : "bg-white/10 text-slate-400"
                        }`}
                      >
                        {assignmentDueCounts.pastDue}
                      </span>
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAssignmentOpen(true)}
                  disabled={cohortTab.kind === "unassigned"}
                  className="shrink-0 rounded-full bg-violet-500 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50 sm:text-xs"
                >
                  + New Assignment
                </button>
              </div>
              <p className="mb-3 text-[11px] leading-relaxed text-slate-500 sm:text-xs">
                {assignmentDueBucket === "active"
                  ? "Within due window or no deadline set — students should still complete these."
                  : "Deadline has passed — review completion and follow up as needed."}
              </p>
              <div className="grid grid-cols-1 gap-2.5 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
                {cohortAssignments.length === 0 ? (
                  <div className="col-span-full rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-slate-400">
                    {cohortTab.kind === "unassigned"
                      ? "Unassigned students do not receive section assignments. Assign students to a section first."
                      : "No assignments yet. Create your first assignment to start tracking completion."}
                  </div>
                ) : displayedCohortAssignments.length === 0 ? (
                  <div className="col-span-full rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-slate-400">
                    {assignmentDueBucket === "pastDue"
                      ? "Nothing past due yet — either deadlines haven’t passed or assignments have no due date."
                      : "No active assignments in this view. Check Past due or create a new assignment."}
                  </div>
                ) : (
                  [...displayedCohortAssignments]
                    .sort((a, b) => {
                      const da = a.dueDateIso ? new Date(a.dueDateIso).getTime() : 0;
                      const db = b.dueDateIso ? new Date(b.dueDateIso).getTime() : 0;
                      return db - da; // most recent first
                    })
                    .map((item) => (
                      <AssignmentCard
                        key={item.id}
                        item={item}
                        sections={activeDetail.sections}
                        onOpen={() => setAssignmentDetail(item)}
                      />
                    ))
                )}
              </div>
            </div>
          ) : null}
          {detailTab === "progress" ? (
            <div className="rounded-xl border border-white/10 bg-[#15162b] p-3.5 sm:p-4">
              {activeClassroom.isDemoShowcase ? (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold">Class performance overview</div>
                    <button type="button" className="text-xs font-semibold text-emerald-300">
                      Export report →
                    </button>
                  </div>
                  <div className="mb-3 text-xs text-slate-400">
                    Average accuracy across topics — last 30 days
                  </div>
                  {[
                    { name: "Electrostatics", value: 82, color: "bg-emerald-400" },
                    { name: "Mechanics", value: 76, color: "bg-sky-400" },
                    { name: "Optics", value: 68, color: "bg-amber-400" },
                    { name: "Modern Physics", value: 54, color: "bg-rose-400" },
                    { name: "Thermodynamics", value: 71, color: "bg-violet-400" },
                  ].map((p) => (
                    <div key={p.name} className="mb-2">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-slate-300">{p.name}</span>
                        <span className="font-semibold text-slate-200">{p.value}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-black/40">
                        <div
                          className={`h-2 rounded-full ${p.color}`}
                          style={{ width: `${p.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    ⚠ Modern Physics at 54% — recommend scheduling a targeted revision session and
                    assigning a Testbee adaptive mock on this topic.
                  </div>
                </>
              ) : (
                <div className="py-6 text-center text-sm text-slate-400">
                  Topic accuracy and trends will appear here once students complete attempts in this
                  class.
                </div>
              )}
            </div>
          ) : null}
          {detailTab === "streaks" ? (
            <div className="rounded-xl border border-white/10 bg-[#15162b] p-3.5 sm:p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">Streaks &amp; RDM distribution</div>
                <button
                  type="button"
                  onClick={() => void rewardTopStudents()}
                  disabled={
                    rewardSubmitting || cohortStudents.filter((s) => s.streakDays > 0).length === 0
                  }
                  className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Flame className="mr-1 inline h-3.5 w-3.5" />
                  Reward Top Tier Students
                </button>
              </div>
              <div className="mb-3 grid grid-cols-4 gap-2">
                {(() => {
                  const roster = cohortStudents;
                  if (activeClassroom.isDemoShowcase) {
                    return (
                      <>
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-center">
                          <div className="font-serif text-2xl sm:text-3xl text-emerald-300">18</div>
                          <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                            Avg streak
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-center">
                          <div className="font-serif text-2xl sm:text-3xl text-amber-300">79%</div>
                          <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                            On streak
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-center">
                          <div className="font-serif text-2xl sm:text-3xl text-rose-300">4</div>
                          <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                            Off-streak
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-center">
                          <div className="font-serif text-2xl sm:text-3xl text-violet-300">
                            {summary.rdmDistributedMonth.toLocaleString("en-IN")}
                          </div>
                          <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                            RDM given
                          </div>
                        </div>
                      </>
                    );
                  }
                  const avgStreak = roster.length
                    ? Math.round(roster.reduce((sum, s) => sum + s.streakDays, 0) / roster.length)
                    : 0;
                  const onStreak = roster.filter((s) => s.streakDays > 0).length;
                  const onStreakPct = roster.length
                    ? Math.round((100 * onStreak) / roster.length)
                    : 0;
                  const offStreak = roster.filter((s) => s.status === "off_streak").length;
                  const classRdmTotal = roster.reduce((sum, s) => sum + s.rdm, 0);
                  return (
                    <>
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-center">
                        <div className="font-serif text-2xl sm:text-3xl text-emerald-300">
                          {avgStreak}
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                          Avg streak
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-center">
                        <div className="font-serif text-2xl sm:text-3xl text-amber-300">
                          {onStreakPct}%
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                          On streak
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-center">
                        <div className="font-serif text-2xl sm:text-3xl text-rose-300">
                          {offStreak}
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                          Off-streak
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-center">
                        <div className="font-serif text-2xl sm:text-3xl text-violet-300">
                          {classRdmTotal.toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                          Class RDM
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className="space-y-2">
                <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-xs text-violet-200">
                  Highest streak students:{" "}
                  {[...cohortStudents]
                    .filter((s) => s.streakDays > 0)
                    .sort((a, b) => b.streakDays - a.streakDays)
                    .slice(0, 5)
                    .map((s) => s.name)
                    .filter(Boolean)
                    .join(", ") || "No streak leaders yet"}
                </div>
                {cohortMotivationLog.length === 0 ? (
                  <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-400">
                    No motivation actions yet.
                  </div>
                ) : (
                  cohortMotivationLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                    >
                      <span className="font-semibold">
                        {entry.actionKind.replaceAll("_", " ")} ·{" "}
                      </span>
                      {entry.message}
                      <div className="text-xs text-slate-500">
                        {display.formatRelativeTime(entry.createdAt)} · +{entry.rdmDelta} RDM
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
          {detailTab === "settings" && activeClassroom ? (
            <div className="w-full max-w-6xl space-y-4">
              {cohortTab.kind === "section" ? (
                <div className="space-y-4">
                  {(() => {
                    const sec = activeDetail.sections.find((s) => s.id === cohortTab.id) ?? null;
                    if (!sec) {
                      return (
                        <div className="rounded-xl border border-white/10 bg-[#15162b] p-3.5 sm:p-4">
                          <div className="mb-4 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm font-semibold text-white">
                              <Settings className="h-4 w-4 text-violet-300" />
                              Section settings
                            </div>
                            <button
                              type="button"
                              onClick={() => setCohortTab({ kind: "class" })}
                              className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
                            >
                              ← Class settings
                            </button>
                          </div>
                          <div className="text-sm text-slate-400">
                            This section no longer exists. Switch back to Class settings.
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="grid gap-3 sm:gap-4 lg:grid-cols-12 lg:items-stretch">
                        <div className="rounded-xl border border-white/10 bg-[#15162b] p-3.5 sm:p-4 lg:col-span-5">
                          <div className="mb-4 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm font-semibold text-white">
                              <Settings className="h-4 w-4 text-violet-300" />
                              Section settings
                            </div>
                            <button
                              type="button"
                              onClick={() => setCohortTab({ kind: "class" })}
                              className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
                            >
                              ← Class settings
                            </button>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-12 sm:items-end">
                            <label className="block text-xs font-medium text-slate-400 sm:col-span-12">
                              Section name
                              <input
                                value={sectionNameDrafts[sec.id] ?? sec.name}
                                onChange={(e) =>
                                  setSectionNameDrafts((prev) => ({
                                    ...prev,
                                    [sec.id]: e.target.value,
                                  }))
                                }
                                className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0c1020] px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500/50"
                              />
                            </label>
                            <div className="flex flex-wrap gap-2 sm:col-span-12 sm:justify-end">
                              <button
                                type="button"
                                onClick={() => void saveSectionName(sec.id)}
                                disabled={
                                  sectionNameSavingId === sec.id || sectionDeletingId === sec.id
                                }
                                className="rounded-full bg-violet-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                              >
                                {sectionNameSavingId === sec.id ? "Saving…" : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteSection(sec.id)}
                                disabled={
                                  sectionNameSavingId === sec.id || sectionDeletingId === sec.id
                                }
                                className="rounded-full border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
                              >
                                {sectionDeletingId === sec.id ? "Deleting…" : "Delete section"}
                              </button>
                            </div>
                          </div>

                          {(() => {
                            const rdmLine = formatSectionScheduleDeliveryRdmLabel({
                              hasSchedule: Boolean(sec.scheduleLabel?.trim() || sec.googleSeriesLinked),
                              expectedDeliveryRdm: sec.expectedDeliveryRdm,
                              deliveryRdmGrantedTotal: sec.deliveryRdmGrantedTotal,
                            });
                            if (!rdmLine) return null;
                            return (
                              <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-xs">
                                <div className="font-semibold text-amber-200">Schedule class RDM</div>
                                <div className="mt-1 text-amber-100/90">{rdmLine}</div>
                                <div className="mt-1 text-[10px] text-slate-500">
                                  Credited after each Google Calendar / section occurrence ends (roster
                                  in this section; student join not required).
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        <div className="flex h-full flex-col rounded-xl border border-sky-500/25 bg-sky-500/5 p-3.5 sm:p-4 lg:col-span-7">
                          <div className="mb-2 text-sm font-semibold text-sky-200">
                            Google Meet &amp; Calendar
                          </div>
                          {activeClassroomId ? (
                            <BookLiveClassSlotPanel
                              variant="settings"
                              classroomId={activeClassroomId}
                              sectionId={sec.id}
                              sectionName={sec.name}
                              googleCalendarConnected={summary.googleCalendarConnected}
                              googleCalendarEmail={googleCalendarEmail}
                              onConnectGoogle={() => void connectGoogleCalendarFromToolbar()}
                              onBooked={() => void onRefreshTeacherPortal({ silent: true })}
                            />
                          ) : null}

                          {sec.googleSeriesLinked ? (
                            <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
                              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                Legacy recurring series
                              </div>
                              <div className="mb-1 text-xs font-semibold text-slate-200">
                                {sec.name}
                              </div>
                              {sec.googleMeetLink ? (
                                <a
                                  href={sec.googleMeetLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-500/25"
                                >
                                  Open Meet link <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              ) : null}

                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={googleSeriesStopping}
                                  onClick={() => void stopGoogleSeries("until_today", sec.id)}
                                  className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-500/20 disabled:opacity-50"
                                >
                                  {googleSeriesStopping ? "Working…" : "Stop future dates"}
                                </button>
                                <button
                                  type="button"
                                  disabled={googleSeriesStopping}
                                  onClick={() => void stopGoogleSeries("delete_series", sec.id)}
                                  className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
                                >
                                  Delete Google series
                                </button>
                              </div>

                              <button
                                type="button"
                                disabled={
                                  googleInviteSyncing || activeDetail.students.length === 0
                                }
                                onClick={() => void syncStudentCalendarInvites()}
                                className="mb-1 mt-3 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
                              >
                                {googleInviteSyncing
                                  ? "Syncing invites…"
                                  : "Email calendar invites to students"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:gap-4 lg:grid-cols-12">
                    <div className="rounded-xl border border-white/10 bg-[#15162b] p-3.5 sm:p-4 lg:col-span-7">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                        <Settings className="h-4 w-4 text-violet-300" />
                        Class details
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-xs font-medium text-slate-400">
                          Class name
                          <input
                            value={settingsName}
                            onChange={(e) => setSettingsName(e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0c1020] px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500/50"
                          />
                        </label>
                        <label className="block text-xs font-medium text-slate-400">
                          Subject (optional)
                          <input
                            value={settingsSubject}
                            onChange={(e) => setSettingsSubject(e.target.value)}
                            placeholder="e.g. Physics"
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0c1020] px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-violet-500/50"
                          />
                        </label>
                        <label className="block text-xs font-medium text-slate-400 sm:col-span-2">
                          Subtitle on class cards (optional)
                          <input
                            value={settingsSection}
                            onChange={(e) => setSettingsSection(e.target.value)}
                            placeholder="e.g. PUC 1, Weekend batch"
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0c1020] px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-violet-500/50"
                          />
                          <span className="mt-1.5 block text-[11px] leading-relaxed text-slate-500">
                            One short line under the class title on your dashboard. This is{" "}
                            <span className="font-medium text-slate-400">not</span> the same as the{" "}
                            <span className="font-medium text-slate-400">sections</span> you add
                            below—those are for schedules, Meet links, and splitting students.
                          </span>
                        </label>
                        <label className="block text-xs font-medium text-slate-400 sm:col-span-2">
                          Intro video link (optional)
                          <input
                            value={settingsIntroVideoUrl}
                            onChange={(e) => setSettingsIntroVideoUrl(e.target.value)}
                            placeholder="YouTube or Vimeo URL"
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0c1020] px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-violet-500/50"
                          />
                          <span className="mt-1 block text-[11px] text-slate-500">
                            This appears in the classroom “About this class” section.
                          </span>
                        </label>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void saveClassroomSettings()}
                          disabled={settingsSaving}
                          className="rounded-full bg-violet-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {settingsSaving ? "Saving…" : "Save changes"}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 lg:col-span-5">
                      <div className="flex flex-col rounded-xl border border-white/10 bg-[#15162b] p-3.5 sm:p-4">
                        <div className="mb-2 text-sm font-semibold text-white">
                          Join &amp; student view
                        </div>
                        <p className="mb-3 text-xs text-slate-400">
                          Share the join code with students, or open the classroom page to preview
                          what they see (assignments, live tab, etc.).
                        </p>
                        <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 rounded-lg border border-white/10 bg-black/25 px-3 py-2 font-mono text-sm tracking-widest text-violet-200">
                            {activeClassroom.joinCode?.trim() || "—"}
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void copyJoinCode()}
                              disabled={!activeClassroom.joinCode?.trim()}
                              className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-50"
                            >
                              Copy code
                            </button>
                            <a
                              href={`/classroom/${activeClassroom.id}?view=student`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200"
                            >
                              Open class page <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col rounded-xl border border-rose-500/25 bg-rose-500/5 p-3.5 sm:p-4">
                        <div className="mb-2 text-sm font-semibold text-rose-200">Danger zone</div>
                        <p className="mb-3 text-xs text-slate-400">
                          Deleting removes this classroom from your portal and revokes student
                          access. Past assignment posts may remain in the system depending on your
                          data policy.
                        </p>
                        <div className="mt-auto">
                          <button
                            type="button"
                            onClick={() => void removeClassroom()}
                            disabled={settingsDeleting}
                            className="rounded-full border border-rose-500/50 bg-rose-500/15 px-4 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/25 disabled:opacity-60"
                          >
                            {settingsDeleting ? "Deleting…" : "Delete classroom"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0e0f1c] shadow-sm">
                    <div className="border-b border-white/10 bg-gradient-to-r from-violet-950/40 to-slate-950/40 px-4 py-3 sm:px-5">
                      <h2 className="text-sm font-semibold tracking-tight text-white">
                        Sections &amp; Google Calendar
                      </h2>
                      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
                        <span className="font-medium text-slate-300">Sections</span> split your
                        roster so each section can have its own timetable and Meet link.{" "}
                        <span className="font-medium text-slate-300">Google</span> on the right
                        covers class-wide or per-section calendars—separate from the short subtitle
                        in Class details above.
                      </p>
                    </div>
                    <div className="grid gap-0 lg:grid-cols-2 lg:divide-x lg:divide-white/10">
                      <div className="p-4 sm:p-5">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300/90">
                              Step 1 — roster
                            </div>
                            <div className="text-sm font-semibold text-white">Sections</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSectionDialogOpen(true)}
                            className="inline-flex shrink-0 items-baseline gap-1 rounded-full border border-violet-500/35 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-100 hover:bg-violet-500/25"
                          >
                            + Add section
                            {createSectionRdmCompact ? (
                              <span className="text-[10px] font-normal text-violet-200/70">
                                {createSectionRdmCompact}
                              </span>
                            ) : null}
                          </button>
                        </div>
                        {activeDetail.sections.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-white/15 bg-black/25 p-4">
                            <p className="mb-3 text-sm text-slate-300">
                              Everyone is in one pool until you add sections.
                            </p>
                            <ol className="list-decimal space-y-2.5 pl-4 text-xs leading-relaxed text-slate-400 marker:text-violet-400">
                              <li>
                                Use{" "}
                                <span className="font-medium text-slate-300">+ Add section</span>{" "}
                                when batches need different schedules or Meet links.
                              </li>
                              <li>
                                On the <span className="font-medium text-slate-300">Students</span>{" "}
                                tab, assign each student to a section (or leave them unassigned).
                              </li>
                              <li>
                                Select a section tab, then use{" "}
                                <span className="font-medium text-slate-300">
                                  Book live class (Google Calendar + Meet)
                                </span>{" "}
                                on Students or Settings to schedule a class.
                              </li>
                            </ol>
                          </div>
                        ) : (
                          <ul className="space-y-2">
                            {activeDetail.sections.map((sec) => {
                              const expired = sec.isActive === false;
                              return (
                                <li
                                  key={sec.id}
                                  className={`rounded-xl border border-white/10 bg-[#15162b] p-3 sm:p-3.5 ${
                                    expired ? "opacity-60 grayscale-[0.2]" : ""
                                  }`}
                                >
                                  <div className="flex flex-wrap items-end justify-between gap-3">
                                    <label className="min-w-[200px] flex-1 text-xs font-medium text-slate-400">
                                      Section name
                                      <input
                                        value={sectionNameDrafts[sec.id] ?? sec.name}
                                        onChange={(e) =>
                                          setSectionNameDrafts((prev) => ({
                                            ...prev,
                                            [sec.id]: e.target.value,
                                          }))
                                        }
                                        disabled={expired}
                                        className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0c1020] px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500/50"
                                      />
                                    </label>
                                    <div className="flex shrink-0 flex-wrap gap-2">
                                      {expired ? (
                                        <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200">
                                          Expired
                                        </span>
                                      ) : null}
                                      <button
                                        type="button"
                                        onClick={() => void saveSectionName(sec.id)}
                                        disabled={
                                          sectionNameSavingId === sec.id ||
                                          sectionDeletingId === sec.id ||
                                          expired
                                        }
                                        className="rounded-full bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                                      >
                                        {sectionNameSavingId === sec.id ? "Saving…" : "Save"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void deleteSection(sec.id)}
                                        disabled={
                                          sectionNameSavingId === sec.id ||
                                          sectionDeletingId === sec.id
                                        }
                                        className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
                                      >
                                        {sectionDeletingId === sec.id
                                          ? "Deleting…"
                                          : "Delete section"}
                                      </button>
                                    </div>
                                  </div>
                                  {expired ? (
                                    <div className="mt-2 text-[11px] leading-snug text-slate-400">
                                      This section is inactive (end date passed). Move students to
                                      an active section to resume section-based assignments,
                                      messages, and scheduling.
                                    </div>
                                  ) : null}
                                  {!expired && activeClassroomId ? (
                                    <BookLiveClassSlotPanel
                                      variant="settings"
                                      classroomId={activeClassroomId}
                                      sectionId={sec.id}
                                      sectionName={sec.name}
                                      googleCalendarConnected={summary.googleCalendarConnected}
                                      googleCalendarEmail={googleCalendarEmail}
                                      onConnectGoogle={() => void connectGoogleCalendarFromToolbar()}
                                      onBooked={() => void onRefreshTeacherPortal({ silent: true })}
                                    />
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                      <div className="flex flex-col p-4 sm:p-5">
                        <div className="mb-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300/90">
                            Step 2 — optional
                          </div>
                          <div className="text-sm font-semibold text-white">
                            Meet &amp; Google Calendar
                          </div>
                        </div>
                        {activeClassroom.googleMeetLink ||
                        activeClassroom.googleSeriesLinked ||
                        activeDetail.sections.some(
                          (s) => s.googleMeetLink || s.googleSeriesLinked
                        ) ? (
                          <div className="flex min-h-0 flex-1 flex-col gap-3 text-xs text-slate-400">
                            <p className="leading-relaxed text-slate-400">
                              Stopping or deleting a series updates Google Calendar. This EduBlast
                              class and your students stay here until you delete the classroom in
                              Danger zone.
                            </p>
                            {(activeClassroom.googleMeetLink ||
                              activeClassroom.googleSeriesLinked) && (
                              <div className="rounded-lg border border-white/10 bg-black/25 p-3">
                                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                  Whole class
                                </div>
                                <p className="mb-2 text-[11px] text-slate-500">
                                  One Meet / calendar for everyone—not tied to a section above.
                                </p>
                                {activeClassroom.googleMeetLink ? (
                                  <a
                                    href={activeClassroom.googleMeetLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-500/25"
                                  >
                                    Open Meet link <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                ) : (
                                  <p className="mb-2 text-xs text-slate-500">
                                    Meet link appears after the next calendar sync.
                                  </p>
                                )}
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={
                                      googleSeriesStopping || !activeClassroom.googleSeriesLinked
                                    }
                                    onClick={() => void stopGoogleSeries("until_today", null)}
                                    className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-500/20 disabled:opacity-50"
                                  >
                                    {googleSeriesStopping ? "Working…" : "Stop future dates"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={
                                      googleSeriesStopping || !activeClassroom.googleSeriesLinked
                                    }
                                    onClick={() => void stopGoogleSeries("delete_series", null)}
                                    className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
                                  >
                                    Delete Google series
                                  </button>
                                </div>
                              </div>
                            )}
                            {activeDetail.sections.filter(
                              (s) => s.googleMeetLink || s.googleSeriesLinked
                            ).length > 0 ? (
                              <div className="space-y-2">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                  By section
                                </div>
                                {activeDetail.sections
                                  .filter((s) => s.googleMeetLink || s.googleSeriesLinked)
                                  .map((sec) => (
                                    <div
                                      key={sec.id}
                                      className="rounded-lg border border-white/10 bg-black/25 p-3"
                                    >
                                      <div className="mb-1 text-xs font-semibold text-slate-200">
                                        {sec.name}
                                      </div>
                                      {sec.googleMeetLink ? (
                                        <a
                                          href={sec.googleMeetLink}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-500/25"
                                        >
                                          Open Meet link <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                      ) : (
                                        <p className="mb-2 text-xs text-slate-500">
                                          Meet link appears after the next calendar sync.
                                        </p>
                                      )}
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          disabled={googleSeriesStopping || !sec.googleSeriesLinked}
                                          onClick={() =>
                                            void stopGoogleSeries("until_today", sec.id)
                                          }
                                          className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-500/20 disabled:opacity-50"
                                        >
                                          {googleSeriesStopping ? "Working…" : "Stop future dates"}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={googleSeriesStopping || !sec.googleSeriesLinked}
                                          onClick={() =>
                                            void stopGoogleSeries("delete_series", sec.id)
                                          }
                                          className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
                                        >
                                          Delete Google series
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            ) : null}
                            <button
                              type="button"
                              disabled={
                                googleInviteSyncing ||
                                (!activeClassroom.googleSeriesLinked &&
                                  !activeDetail.sections.some((s) => s.googleSeriesLinked)) ||
                                activeDetail.students.length === 0
                              }
                              onClick={() => void syncStudentCalendarInvites()}
                              className="mt-1 w-full rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50 sm:w-auto"
                            >
                              {googleInviteSyncing
                                ? "Syncing invites…"
                                : "Email calendar invites to students"}
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-1 flex-col rounded-xl border border-dashed border-white/12 bg-black/20 p-4">
                            <p className="text-sm text-slate-400">
                              No Meet link or Calendar series is stored for this class yet.
                            </p>
                            <p className="mt-2 text-xs leading-relaxed text-slate-500">
                              Connect Google from{" "}
                              <span className="text-slate-400">My Classrooms</span>, then add a
                              schedule for the whole class or open a{" "}
                              <span className="text-slate-400">section</span> from the class filter
                              to sync that section only.
                            </p>
                          </div>
                        )}
                        <details className="group mt-auto border-t border-white/10 pt-4">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-slate-500 [&::-webkit-details-marker]:hidden">
                            <span>Advanced — reset Google for this class</span>
                            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180" />
                          </summary>
                          <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-black/25 p-3 text-[11px] leading-relaxed text-slate-500">
                            <p>
                              Use only if the dashboard still shows Meet or &quot;series
                              active&quot; after you removed sections or calendars. Deletes linked
                              Google events when Calendar is connected, then clears stored Meet
                              links for this class and all sections.
                            </p>
                            <button
                              type="button"
                              disabled={googleSeriesStopping}
                              onClick={() => void resetAllGoogleForClassroom()}
                              className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/20 disabled:opacity-50"
                            >
                              {googleSeriesStopping
                                ? "Working…"
                                : "Clear all Google Calendar & Meet (this class)"}
                            </button>
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {classrooms.map((room) => (
            <div
              key={room.id}
              role="button"
              tabIndex={0}
              onClick={() => setActiveClassroomId(room.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActiveClassroomId(room.id);
                }
              }}
              className="cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-[#161629] text-left transition hover:-translate-y-0.5 hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
            >
              <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
                <div className="font-serif text-xl text-slate-500 sm:text-2xl">
                  {room.subject?.slice(0, 8) ?? "CLASS"}
                </div>
                <span className="rounded bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-300">
                  Active
                </span>
              </div>
              <div className="space-y-2 px-4 py-3">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <div className="min-w-0 truncate text-sm font-semibold">{room.name}</div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSessionsDialogClassroom(room);
                    }}
                    className="shrink-0 rounded-full border border-violet-500/35 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-violet-200 hover:bg-violet-500/20"
                  >
                    Sessions
                  </button>
                </div>
                <div className="text-xs text-slate-400">
                  {(() => {
                    const subj = (room.subject ?? "General").trim();
                    return (
                      (subj.toLowerCase() === "mathematics" ? "Maths" : subj) +
                      (room.section ? ` · ${room.section}` : "")
                    );
                  })()}
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <div className="text-base font-bold text-emerald-300">{room.studentCount}</div>
                    <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                      Students
                    </div>
                  </div>
                  <div>
                    <div
                      className={`text-base font-bold ${room.avgScorePercent == null ? "text-slate-500" : "text-amber-300"}`}
                    >
                      {display.formatOptionalPercent(room.avgScorePercent)}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                      Avg score
                    </div>
                  </div>
                  <div>
                    <div className="text-base font-bold text-violet-300">
                      {room.assignmentCount}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                      Assignments
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-white/10 pt-2">
                  <div className="min-w-0 text-xs text-slate-400">
                    <MeetSessionsStack
                      sessions={room.meetSessions ?? null}
                      fallbackLabel={room.nextSessionLabel}
                      hostJoin
                      googleCalendarEmail={googleCalendarEmail}
                    />
                  </div>
                  <BookOpen className="h-4 w-4 text-slate-500" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ClassroomSessionsDialog
        open={sessionsDialogClassroom != null}
        onOpenChange={(next) => {
          if (!next) setSessionsDialogClassroom(null);
        }}
        classroomName={sessionsDialogClassroom?.name ?? "Classroom"}
        sessions={sessionsDialogClassroom?.meetSessions}
        googleCalendarEmail={googleCalendarEmail}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[96vw] max-w-190 max-h-[92vh] overflow-y-auto rounded-3xl border border-white/20 bg-[#111428] p-0 text-slate-100">
          <DialogHeader className="border-b border-white/10 p-4 pb-3 sm:p-6 sm:pb-4">
            <DialogTitle className="font-serif text-2xl sm:text-3xl lg:text-4xl">
              Create a new classroom
            </DialogTitle>
            <p className="mt-1 text-sm text-slate-400">
              A classroom is a dedicated space for one batch of students.
              {createClassroomRdmCompact ? (
                <span className="ml-1 text-xs text-slate-500">{createClassroomRdmCompact} from your wallet</span>
              ) : null}
            </p>
          </DialogHeader>
          <div className="space-y-4 p-4 sm:p-6">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-300">
                Classroom name *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. JEE Advanced Batch A 2026"
                className="h-11 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-300">Subject *</label>
                <div className="relative">
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value as (typeof SUBJECT_OPTIONS)[number])}
                    className={selectClassName}
                  >
                    {SUBJECT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-300">
                  PUC Level *
                </label>
                <div className="relative">
                  <select
                    value={pucLevel}
                    onChange={(e) => setPucLevel(e.target.value as (typeof PUC_OPTIONS)[number])}
                    className={selectClassName}
                  >
                    {PUC_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-300">Exam target</label>
              <div className="relative">
                <select
                  value={examTarget}
                  onChange={(e) => setExamTarget(e.target.value as (typeof EXAM_OPTIONS)[number])}
                  className={selectClassName}
                >
                  {EXAM_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
            {SHOW_CLASSROOM_SCHEDULE_FORM ? (
              <div className="rounded-2xl border border-white/10 bg-[#0d1121] p-4">
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Class schedule (easy calendar)
                </label>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="relative">
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="h-11 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div className="relative">
                    <WallTimeSelects value={scheduleTime} onChange={setScheduleTime} />
                  </div>
                  <div className="relative">
                    <select
                      value={String(durationMinutes)}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className={selectClassName}
                    >
                      <option value="45">45 mins</option>
                      <option value="60">60 mins</option>
                      <option value="90">90 mins</option>
                      <option value="120">120 mins</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Repeat days
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleRepeat(day)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          repeatDays.includes(day)
                            ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                            : "border-white/15 text-slate-400 hover:border-white/25 hover:text-slate-200"
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-white/10 bg-[#070b17] px-3 py-2 text-sm text-slate-300">
                  {schedulePreview}
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    End date (optional)
                  </label>
                  <input
                    type="date"
                    value={scheduleEndDate}
                    onChange={(e) => setScheduleEndDate(e.target.value)}
                    className="h-11 w-full max-w-xs rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none focus:border-emerald-400"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Leave empty to run until you stop the series from class settings.
                  </p>
                </div>
              </div>
            ) : null}
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-300">
                Allow ad-hoc 10-min trial?
              </label>
              <div className="relative">
                <select
                  value={allowAdhocTrial ? "yes" : "no"}
                  onChange={(e) => setAllowAdhocTrial(e.target.value === "yes")}
                  className={selectClassName}
                >
                  <option value="yes">
                    Yes — allow EduBlast members to trial (50 RDM to continue)
                  </option>
                  <option value="no">No — enrolled students only</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
          </div>
          <div className="flex flex-col-reverse items-stretch justify-end gap-3 border-t border-white/10 p-4 sm:flex-row sm:items-center sm:p-5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5 sm:min-w-27.5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!name.trim() || submitting}
              className="inline-flex items-baseline justify-center gap-1 rounded-full bg-emerald-500 px-6 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-40"
            >
              {submitting ? "Creating..." : "Create classroom"}
              {!submitting && createClassroomRdmLabel ? (
                <span className="text-xs font-normal opacity-85">{createClassroomRdmLabel}</span>
              ) : null}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={wizardOpen}
        onOpenChange={(v) => {
          if (v) {
            setWizardOpen(true);
            return;
          }
          dismissWizardForOneHour();
        }}
      >
        <DialogContent
          hideClose
          onInteractOutside={(e) => {
            // Investor request: wizard should only close via explicit Close (X).
            e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            // Avoid accidental close on small screens.
            e.preventDefault();
          }}
          className="left-0 top-0 grid h-[100vh] max-h-[100vh] w-screen sm:w-[96vw] max-w-[980px] translate-x-0 translate-y-0 overflow-hidden rounded-none border-r border-white/20 bg-[#07070f] p-0 text-slate-100 shadow-2xl data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:rounded-r-3xl md:max-w-[1240px] lg:max-w-[1320px]"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Teacher Wizard</DialogTitle>
          </DialogHeader>
          <TeacherWizardPopup
            onClose={dismissWizardForOneHour}
            onHideForever={() => {
              // Hide: close for this view only (reappears on refresh / tab return).
              setWizardOpen(false);
              wizardDismissedRef.current = true;
            }}
            teacherId={teacherId}
            classrooms={classrooms}
            classroomDetails={classroomDetails}
            mockPostIdsAssignedThisWeek={mockPostIdsAssignedThisWeek}
            mockNudgeLowScorersByPostId={mockNudgeLowScorersByPostId}
            mockNudgeSubmittedAttemptsByPostId={mockNudgeSubmittedAttemptsByPostId}
            onCreateAssignment={onCreateAssignment}
            onCreateClassroom={onCreateClassroom}
            onRefreshTeacherPortal={onRefreshTeacherPortal}
            onMotivateStudents={onMotivateStudents}
            onScheduleLiveSession={onScheduleLiveSession}
            onRequireVerifiedAction={onRequireVerifiedAction}
            toast={toast}
            allowNudgeStructuredAssignmentCreate={allowNudgeStructuredAssignmentCreate}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent className="w-[96vw] max-w-190 max-h-[92vh] overflow-y-auto rounded-3xl border border-white/20 bg-[#111428] p-0 text-slate-100">
          <DialogHeader className="border-b border-white/10 p-4 pb-3 sm:p-6 sm:pb-4">
            <DialogTitle className="font-serif text-2xl sm:text-3xl lg:text-4xl">
              Add section
            </DialogTitle>
            <p className="mt-1 text-sm text-slate-400">
              Name your batch, then book live classes (Google Calendar + Meet) from the section tab.
              {createSectionRdmCompact ? (
                <span className="ml-1 text-xs text-slate-500">{createSectionRdmCompact} per section</span>
              ) : null}
            </p>
          </DialogHeader>
          <div className="space-y-4 p-4 sm:p-6">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-300">
                Section name *
              </label>
              <input
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="e.g. Morning batch, Section A"
                className="h-11 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400"
              />
            </div>
          </div>
          <div className="flex flex-col-reverse items-stretch justify-end gap-3 border-t border-white/10 p-4 sm:flex-row sm:items-center sm:p-5">
            <button
              type="button"
              onClick={() => setSectionDialogOpen(false)}
              className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5 sm:min-w-27.5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void createSection()}
              disabled={sectionCreating}
              className="inline-flex items-baseline justify-center gap-1 rounded-full bg-violet-500 px-6 py-2 text-sm font-semibold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-40"
            >
              {sectionCreating ? "Creating..." : "Create section"}
              {!sectionCreating && createSectionRdmLabel ? (
                <span className="text-xs font-normal opacity-90">{createSectionRdmLabel}</span>
              ) : null}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen}>
        <DialogContent
          className={`flex flex-col overflow-hidden border-white/20 bg-[#0f1329] p-0 text-slate-100 sm:rounded-3xl ${
            isMockAssignmentTemplate ||
            isPastPaperAssignmentTemplate ||
            isQuizAssignmentTemplate ||
            isConceptFocusTemplate ||
            isDailyDoseAssignmentTemplate ||
            isGyanEngagementTemplate
              ? "max-h-[min(88vh,720px)] max-w-[920px]"
              : "max-h-[86vh] max-w-[680px]"
          }`}
        >
          <DialogHeader className="shrink-0 border-b border-white/10 p-3 pb-2 sm:p-4 sm:pb-3">
            <DialogTitle className="font-serif text-lg sm:text-2xl">Set assignment</DialogTitle>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400 sm:text-sm">
              Pick a template and details. A default activity checklist is created from the type so
              students can track progress; class completion updates in Assignments.
            </p>
          </DialogHeader>

          {isMockAssignmentTemplate ||
          isPastPaperAssignmentTemplate ||
          isQuizAssignmentTemplate ||
          isConceptFocusTemplate ||
          isDailyDoseAssignmentTemplate ||
          isGyanEngagementTemplate ? (
            <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-white/10 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
              {/* Left “page”: assignment details */}
              <div className="flex min-h-0 flex-col lg:max-h-[min(72vh,700px)]">
                <div className="border-b border-white/5 px-3 py-2 sm:px-4">
                  <div className="inline-flex items-center gap-2">
                    <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-200">
                      Step-1
                    </span>
                    <span className="text-[11px] font-semibold text-slate-300">
                      Assignment details
                    </span>
                  </div>
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 sm:space-y-3 sm:p-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-300 sm:text-sm">
                      Assignment type *
                    </label>
                    <div className="relative">
                      <select
                        value={assignmentType}
                        onChange={(e) => setAssignmentType(e.target.value)}
                        className={selectClassName}
                      >
                        <option>Mock Paper (full length)</option>
                        <option>Past Paper</option>
                        <option>Chapter Quiz (MCQs)</option>
                        <option>Concept Focus</option>
                        <option>Gyan++ engagement</option>
                        <option>Custom Assignment</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-300 sm:text-sm">
                      Title *
                    </label>
                    <input
                      value={assignmentTitle}
                      onChange={(e) => setAssignmentTitle(e.target.value)}
                      placeholder="e.g. Electrostatics — Gauss's Law Quiz"
                      className="h-10 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-[13px] outline-none placeholder:text-slate-500 focus:border-emerald-400 sm:h-11 sm:text-sm"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-300 sm:text-sm">
                        Due date *
                      </label>
                      <input
                        type="date"
                        value={assignmentDueDate}
                        onChange={(e) => setAssignmentDueDate(e.target.value)}
                        className="h-10 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-[13px] outline-none focus:border-emerald-400 sm:h-11 sm:text-sm"
                      />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <label className="block text-xs font-semibold text-slate-300 sm:text-sm">
                          Audience
                        </label>
                        <ClassroomHelpChip title="Audience">
                          <div className="space-y-2">
                            <p>
                              <span className="font-semibold">All students</span> sends the
                              assignment to everyone in the chosen scope.
                            </p>
                            <p>
                              <span className="font-semibold">Custom</span> lets you pick preferred
                              students within that scope.
                            </p>
                          </div>
                        </ClassroomHelpChip>
                      </div>
                      <div className="relative">
                        <select
                          value={assignToLabel}
                          onChange={(e) => setAssignToLabel(e.target.value)}
                          className={selectClassName}
                        >
                          <option>All students</option>
                          <option>Custom (preferred students)</option>
                          <option disabled>Top performers (Soon)</option>
                          <option disabled>Off-streak students (Soon)</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      </div>
                    </div>
                  </div>
                  {assignToLabel.trim().toLowerCase().startsWith("custom") ? (
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-slate-200">
                            Select students ({assignmentCustomStudentIds.length})
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Only selected students (in the chosen scope) will receive this
                            assignment.
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setAssignmentCustomStudentIds(
                                assignmentAudienceFiltered.map((s) => s.userId)
                              )
                            }
                            className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-white/10"
                          >
                            Select all
                          </button>
                          <button
                            type="button"
                            onClick={() => setAssignmentCustomStudentIds([])}
                            className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-white/10"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <input
                        value={assignmentCustomSearch}
                        onChange={(e) => setAssignmentCustomSearch(e.target.value)}
                        placeholder="Search students…"
                        className="mt-3 h-10 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400"
                      />
                      <div className="mt-3 max-h-44 overflow-y-auto space-y-1 pr-1">
                        {assignmentAudienceFiltered.length === 0 ? (
                          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
                            No students match your search.
                          </div>
                        ) : (
                          assignmentAudienceFiltered.map((s) => {
                            const checked = assignmentCustomStudentIds.includes(s.userId);
                            return (
                              <button
                                key={s.userId}
                                type="button"
                                onClick={() => toggleCustomStudent(s.userId)}
                                className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-xs ${
                                  checked
                                    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                                    : "border-white/10 bg-black/10 text-slate-200 hover:border-white/20"
                                }`}
                              >
                                <span className="truncate font-semibold">{s.name}</span>
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    checked
                                      ? "bg-emerald-400/20 text-emerald-200"
                                      : "bg-white/5 text-slate-400"
                                  }`}
                                >
                                  {checked ? "Selected" : "Tap"}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : null}
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <label className="block text-xs font-semibold text-slate-300 sm:text-sm">
                        Assign to (class / section)
                      </label>
                      <ClassroomHelpChip title="Class vs section">
                        <div className="space-y-2">
                          <p>
                            <span className="font-semibold">Class</span> = post is visible to every
                            enrolled student (recommended with{" "}
                            <span className="font-semibold">Audience</span> = “All students”).
                          </p>
                          <p>
                            <span className="font-semibold">Section</span> = only students whose{" "}
                            <span className="italic">teaching section</span> matches this section
                            see it in <span className="font-semibold">Classroom → Posts</span>.
                          </p>
                        </div>
                      </ClassroomHelpChip>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <button
                        type="button"
                        onClick={() => {
                          assignmentScopeTouchedRef.current = true;
                          setAssignmentTargetSectionId(null);
                        }}
                        className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-left text-[11px] font-semibold sm:px-3 sm:py-2 sm:text-xs ${
                          assignmentTargetSectionId == null
                            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                            : "border-white/10 bg-black/20 text-slate-300 hover:border-white/20"
                        }`}
                      >
                        <div className="text-slate-100">Class</div>
                        <div className="mt-0.5 text-[10px] font-semibold text-slate-500">
                          {activeDetail.students.filter((s) => s.role !== "teacher").length}{" "}
                          students
                        </div>
                      </button>
                      {activeDetail.sections.map((sec) => (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => {
                            assignmentScopeTouchedRef.current = true;
                            setAssignmentTargetSectionId(sec.id);
                          }}
                          className={`shrink-0 min-w-[155px] rounded-xl border px-2.5 py-1.5 text-left text-[11px] font-semibold sm:min-w-[180px] sm:px-3 sm:py-2 sm:text-xs ${
                            assignmentTargetSectionId === sec.id
                              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                              : "border-white/10 bg-black/20 text-slate-300 hover:border-white/20"
                          }`}
                        >
                          <div className="truncate text-slate-100">{sec.name}</div>
                          <div className="mt-0.5 text-[10px] font-semibold text-slate-500">
                            {(studentCountBySectionId.get(sec.id) ?? 0).toString()} students ·{" "}
                            {sec.scheduleLabel?.trim() || "No schedule"}
                          </div>
                        </button>
                      ))}
                    </div>
                    {assignToLabel.trim().toLowerCase() === "all students" &&
                    assignmentTargetSectionId != null ? (
                      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1.5">
                        <div className="text-[11px] font-semibold text-amber-100">
                          Section selected while Audience is “All students”
                        </div>
                        <ClassroomHelpChip title="Visibility note" tone="amber">
                          Audience says “All students”, but you have a{" "}
                          <span className="italic">section</span> selected — only students in that
                          teaching section will see this in Posts. Choose{" "}
                          <span className="font-bold">Class</span> for a true whole-class
                          assignment.
                        </ClassroomHelpChip>
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <label className="text-sm font-semibold text-slate-300">
                        {TEACHER_ASSIGNMENT_INCENTIVE_LABEL}
                      </label>
                      <AssignmentInfoHelp title={TEACHER_ASSIGNMENT_INCENTIVE_LABEL} tone="slate">
                        {TEACHER_ASSIGNMENT_INCENTIVE_HELP}
                      </AssignmentInfoHelp>
                    </div>
                    <div className="relative">
                      <select
                        value={String(rewardRdm)}
                        onChange={(e) => setRewardRdm(Number(e.target.value))}
                        className={selectClassName}
                      >
                        <option value="0">{TEACHER_ASSIGNMENT_NO_RDM_LABEL}</option>
                        <option value="15">+15 RDM per student</option>
                        <option value="25">+25 RDM per student</option>
                        <option value="40">+40 RDM per student</option>
                        <option value="50">+50 RDM per student</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    </div>
                    {rewardRdm > 0 && assignmentAudienceStudentCount > 0 ? (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                        Reserve{" "}
                        {
                          formatCompletionEscrowSummary(rewardRdm, assignmentAudienceStudentCount)
                            .total
                        }{" "}
                        RDM at publish.
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-300 sm:text-sm">
                      Instructions to students
                    </label>
                    <textarea
                      value={assignmentInstructions}
                      onChange={(e) => setAssignmentInstructions(e.target.value)}
                      rows={3}
                      placeholder="Add any specific instructions, hints, or context for students..."
                      className="w-full rounded-xl border border-white/15 bg-[#070b17] px-3 py-2 text-[13px] outline-none placeholder:text-slate-500 focus:border-emerald-400 sm:py-2.5 sm:text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Right “page”: mock paper or chapter quiz path */}
              <div className="flex min-h-0 flex-col lg:max-h-[min(72vh,700px)]">
                <div className="border-b border-white/5 px-3 py-2 sm:px-4">
                  <div className="inline-flex items-center gap-2">
                    <span className="rounded-full border border-violet-400/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-violet-200">
                      Step-2
                    </span>
                    <span className="text-[11px] font-semibold text-slate-300">
                      Activity details
                    </span>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
                  {isMockAssignmentTemplate ? (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-300 sm:text-sm">
                        Mock paper *
                      </label>
                      {mockPapersLoading ? (
                        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#070b17] px-3 py-3 text-sm text-slate-400">
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-400" />
                          Loading published mock papers…
                        </div>
                      ) : mockPapersLoadError ? (
                        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                          {mockPapersLoadError}
                        </p>
                      ) : mockPapers.length === 0 ? (
                        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
                          No published mock papers in the bank yet. You can still create the
                          assignment; students will use the general mock area until papers are
                          published.
                        </p>
                      ) : (
                        <div className="relative">
                          <select
                            value={selectedMockPaperId ?? ""}
                            onChange={(e) => setSelectedMockPaperId(e.target.value || null)}
                            className={selectClassName}
                          >
                            {mockPapers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.title} · {p.durationMinutes} min · Class {p.classLevel}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        </div>
                      )}
                      <p className="mt-2 text-[11px] text-slate-500">
                        Same catalog as the Mock tests page. One paper still appears here so
                        teachers confirm the exact test.
                      </p>
                      <AssignmentCompletionRewardPanel
                        rewardRdm={rewardRdm}
                        studentCount={assignmentAudienceStudentCount}
                        publishFeeRdm={teacherRdmCosts.create_assignment}
                      />
                    </div>
                  ) : isPastPaperAssignmentTemplate ? (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-300 sm:text-sm">
                        Past paper *
                      </label>
                      {pastPapersLoading ? (
                        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#070b17] px-3 py-3 text-sm text-slate-400">
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-400" />
                          Loading published past papers…
                        </div>
                      ) : pastPapersLoadError ? (
                        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                          {pastPapersLoadError}
                        </p>
                      ) : pastPapers.length === 0 ? (
                        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
                          No published past papers in the bank yet.
                        </p>
                      ) : (
                        <div className="relative">
                          <select
                            value={selectedPastPaperId ?? ""}
                            onChange={(e) => setSelectedPastPaperId(e.target.value || null)}
                            className={selectClassName}
                          >
                            {pastPapers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.title} · {p.durationMinutes} min · Class {p.classLevel}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        </div>
                      )}
                      <p className="mt-2 text-[11px] text-slate-500">
                        Same catalog as the Past papers section in Mock test library.
                      </p>
                      <AssignmentCompletionRewardPanel
                        rewardRdm={rewardRdm}
                        studentCount={assignmentAudienceStudentCount}
                        publishFeeRdm={teacherRdmCosts.create_assignment}
                      />
                    </div>
                  ) : isQuizAssignmentTemplate ? (
                    <div className="space-y-3 sm:space-y-4">
                      <ChapterQuizAssignmentFields
                        taxonomy={curriculumTaxonomy}
                        taxonomyLoading={curriculumLoading}
                        taxonomyError={curriculumError}
                        value={chapterQuizSel}
                        onChange={setChapterQuizSel}
                        selectClassName={selectClassName}
                      />

                      <div className="rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4">
                        <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                          Quiz preview
                        </div>
                        {chapterQuizPreviewLoading ? (
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading preview…
                          </div>
                        ) : chapterQuizPreviewError ? (
                          chapterQuizPreviewError.toLowerCase().includes("unauthorized") ||
                          chapterQuizPreviewError.toLowerCase().includes("forbidden") ? (
                            <div className="text-sm text-slate-400">
                              Pick a class, subject, chapter, lesson, and set to see a preview.
                            </div>
                          ) : (
                            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                              {chapterQuizPreviewError}
                            </div>
                          )
                        ) : chapterQuizPreviewQuestions.length === 0 ? (
                          <div className="text-sm text-slate-400">
                            Pick a class, subject, chapter, lesson, and set to see a preview.
                          </div>
                        ) : (
                          <GeneratedMcqReview
                            questions={chapterQuizPreviewQuestions}
                            answers={new Array(chapterQuizPreviewQuestions.length).fill(-1)}
                            total={chapterQuizPreviewQuestions.length}
                            submitted={false}
                            showCorrectAnswers={false}
                          />
                        )}
                      </div>
                      <AssignmentCompletionRewardPanel
                        rewardRdm={rewardRdm}
                        studentCount={assignmentAudienceStudentCount}
                        publishFeeRdm={teacherRdmCosts.create_assignment}
                      />
                    </div>
                  ) : isConceptFocusTemplate ? (
                    <div className="space-y-4">
                      <ConceptFocusAssignmentFields
                        taxonomy={curriculumTaxonomy}
                        taxonomyLoading={curriculumLoading}
                        taxonomyError={curriculumError}
                        value={conceptFocusSel}
                        onChange={setConceptFocusSel}
                        selectClassName={selectClassName}
                      />
                      <SubtopicUnlockCostPanel
                        perStudentUnlock={teacherRdmCosts.create_assignment}
                        studentCount={assignmentAudienceStudentCount}
                        rewardRdm={rewardRdm}
                      />
                    </div>
                  ) : isGyanEngagementTemplate ? (
                    <div className="space-y-4">
                      <GyanEngagementAssignmentFields
                        topicFocus={gyanTopicFocus}
                        subtopicHint={gyanSubtopicHint}
                        onTopicFocusChange={setGyanTopicFocus}
                        onSubtopicHintChange={setGyanSubtopicHint}
                      />
                      <AssignmentCompletionRewardPanel
                        rewardRdm={rewardRdm}
                        studentCount={assignmentAudienceStudentCount}
                        publishFeeRdm={teacherRdmCosts.create_assignment}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <DailyDoseStreakAssignmentFields
                        selectedTrackId={dailyDoseTrackId}
                        onSelectTrack={setDailyDoseTrackId}
                      />
                      <AssignmentCompletionRewardPanel
                        rewardRdm={rewardRdm}
                        studentCount={assignmentAudienceStudentCount}
                        publishFeeRdm={teacherRdmCosts.create_assignment}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-h-[min(76vh,600px)] space-y-2 overflow-y-auto overscroll-contain p-3 sm:space-y-3 sm:p-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300 sm:text-sm">
                  Assignment type *
                </label>
                <div className="relative">
                  <select
                    value={assignmentType}
                    onChange={(e) => setAssignmentType(e.target.value)}
                    className={selectClassName}
                  >
                    <option>Mock Paper (full length)</option>
                    <option>Past Paper</option>
                    <option>Chapter Quiz (MCQs)</option>
                    <option>Concept Focus</option>
                    <option>Gyan++ engagement</option>
                    <option>Custom Assignment</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300 sm:text-sm">
                  Title *
                </label>
                <input
                  value={assignmentTitle}
                  onChange={(e) => setAssignmentTitle(e.target.value)}
                  placeholder="e.g. Electrostatics — Gauss's Law Quiz"
                  className="h-10 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400 sm:h-11"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300 sm:text-sm">
                    Due date *
                  </label>
                  <input
                    type="date"
                    value={assignmentDueDate}
                    onChange={(e) => setAssignmentDueDate(e.target.value)}
                    className="h-10 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none focus:border-emerald-400 sm:h-11"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300 sm:text-sm">
                    Assign to
                  </label>
                  <div className="relative">
                    <select
                      value={assignToLabel}
                      onChange={(e) => setAssignToLabel(e.target.value)}
                      className={selectClassName}
                    >
                      <option>All students</option>
                      <option>Custom (preferred students)</option>
                      <option disabled>Top performers (Soon)</option>
                      <option disabled>Off-streak students (Soon)</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  </div>
                </div>
              </div>
              {assignToLabel.trim().toLowerCase().startsWith("custom") ? (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        Select students ({assignmentCustomStudentIds.length})
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Only selected students (in the chosen scope) will receive this assignment.
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setAssignmentCustomStudentIds(
                            assignmentAudienceFiltered.map((s) => s.userId)
                          )
                        }
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-white/10"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssignmentCustomStudentIds([])}
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-white/10"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <input
                    value={assignmentCustomSearch}
                    onChange={(e) => setAssignmentCustomSearch(e.target.value)}
                    placeholder="Search students…"
                    className="mt-3 h-10 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400"
                  />
                  <div className="mt-3 max-h-44 overflow-y-auto space-y-1 pr-1">
                    {assignmentAudienceFiltered.length === 0 ? (
                      <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
                        No students match your search.
                      </div>
                    ) : (
                      assignmentAudienceFiltered.map((s) => {
                        const checked = assignmentCustomStudentIds.includes(s.userId);
                        return (
                          <button
                            key={s.userId}
                            type="button"
                            onClick={() => toggleCustomStudent(s.userId)}
                            className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-xs ${
                              checked
                                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                                : "border-white/10 bg-black/10 text-slate-200 hover:border-white/20"
                            }`}
                          >
                            <span className="truncate font-semibold">{s.name}</span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                checked
                                  ? "bg-emerald-400/20 text-emerald-200"
                                  : "bg-white/5 text-slate-400"
                              }`}
                            >
                              {checked ? "Selected" : "Tap"}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-300 sm:text-sm">
                    {TEACHER_ASSIGNMENT_INCENTIVE_LABEL}
                  </label>
                  <AssignmentInfoHelp title={TEACHER_ASSIGNMENT_INCENTIVE_LABEL} tone="slate">
                    {TEACHER_ASSIGNMENT_INCENTIVE_HELP}
                  </AssignmentInfoHelp>
                </div>
                <div className="relative">
                  <select
                    value={String(rewardRdm)}
                    onChange={(e) => setRewardRdm(Number(e.target.value))}
                    className={selectClassName}
                  >
                    <option value="0">{TEACHER_ASSIGNMENT_NO_RDM_LABEL}</option>
                    <option value="15">+15 RDM per student</option>
                    <option value="25">+25 RDM per student</option>
                    <option value="40">+40 RDM per student</option>
                    <option value="50">+50 RDM per student</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
                {rewardRdm > 0 && assignmentAudienceStudentCount > 0 ? (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                    Reserve{" "}
                    {formatCompletionEscrowSummary(rewardRdm, assignmentAudienceStudentCount).total}{" "}
                    RDM at publish.
                  </p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300 sm:text-sm">
                  Instructions to students
                </label>
                <textarea
                  value={assignmentInstructions}
                  onChange={(e) => setAssignmentInstructions(e.target.value)}
                  rows={3}
                  placeholder="Add any specific instructions, hints, or context for students..."
                  className="w-full rounded-xl border border-white/15 bg-[#070b17] px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400"
                />
              </div>
            </div>
          )}

          <div className="flex shrink-0 flex-col-reverse items-stretch justify-end gap-2 border-t border-white/10 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
            <button
              type="button"
              onClick={() => setAssignmentOpen(false)}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 sm:min-w-27.5 sm:px-5 sm:text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submitAssignment()}
              disabled={
                !assignmentTitle.trim() ||
                assignmentSubmitting ||
                (isMockAssignmentTemplate && mockPapersLoading) ||
                (isMockAssignmentTemplate &&
                  !mockPapersLoading &&
                  mockPapers.length > 0 &&
                  !selectedMockPaperId) ||
                (isQuizAssignmentTemplate &&
                  (curriculumLoading ||
                    !chapterQuizSelectionComplete(chapterQuizSel, curriculumTaxonomy))) ||
                (isConceptFocusTemplate &&
                  (curriculumLoading ||
                    !conceptFocusSelectionComplete(conceptFocusSel, curriculumTaxonomy)))
              }
              className="rounded-full bg-violet-500 px-5 py-2 text-xs font-semibold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-40 sm:px-6 sm:text-sm"
            >
              {assignmentSubmitting
                ? "Creating..."
                : isConceptFocusTemplate && assignmentAudienceStudentCount > 0
                  ? `Create assignment (${conceptFocusPublishTotalRdm} RDM)`
                  : (isMockAssignmentTemplate ||
                      isPastPaperAssignmentTemplate ||
                      isQuizAssignmentTemplate ||
                      isGyanEngagementTemplate ||
                      isDailyDoseAssignmentTemplate) &&
                      assignmentAudienceStudentCount > 0 &&
                      standardAssignmentPublishTotalRdm > 0
                    ? `Create assignment (${standardAssignmentPublishTotalRdm} RDM)`
                    : "Create assignment"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="w-[96vw] max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-white/20 bg-[#0f1329] p-0 text-slate-100">
          <DialogHeader className="border-b border-white/10 p-4 pb-3 sm:p-6 sm:pb-4">
            <DialogTitle className="font-serif text-2xl sm:text-3xl">Invite students</DialogTitle>
            <p className="mt-1 text-sm text-slate-400">
              Share a join link/code, or bulk-import student emails for classroom rewards.
            </p>
          </DialogHeader>
          <div className="p-4 sm:p-6">
            {activeClassroom?.id && activeClassroom.joinCode?.trim() ? (
              <InviteStudents
                classroomId={activeClassroom.id}
                joinCode={activeClassroom.joinCode}
              />
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-slate-300">
                Join code not available yet. Please refresh the page or open this classroom from the
                main classrooms list again.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={motivationOpen} onOpenChange={setMotivationOpen}>
        <DialogContent className="w-[94vw] max-w-160 rounded-[22px] border border-white/20 bg-[#12162a] p-0 text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
          <DialogHeader className="border-b border-white/10 px-5 py-3.5">
            <DialogTitle className="font-serif text-2xl leading-[1.05] tracking-tight text-white sm:text-3xl">
              <span className="mr-2 text-amber-300">☆</span>
              Send personalised motivation
            </DialogTitle>
            <p className="mt-1 text-[14px] leading-snug text-slate-400">
              Message-only nudge. To attach an RDM bonus, use assignment reminders or the nudge wizard
              with goal &quot;Complete pending assignment&quot;.
            </p>
          </DialogHeader>
          <div className="space-y-3 px-5 py-3.5">
            <div>
              <label className="mb-1 block text-[15px] font-semibold text-slate-300">
                Student *
              </label>
              <div className="relative">
                <select
                  value={motivationTarget}
                  onChange={(e) => {
                    const value = e.target.value;
                    setMotivationTarget(value);
                    const label =
                      value === "all_students"
                        ? "everyone"
                        : value === "off_streak"
                          ? "off-streak students"
                          : (activeDetail.students.find((student) => student.userId === value)
                              ?.name ?? "student");
                    if (motivationMessageType !== "custom") {
                      setMotivationMessage(
                        display.messageTemplate(motivationAction, motivationMessageType, label)
                      );
                    }
                  }}
                  className={`${selectClassName} h-11 rounded-xl border-white/15 bg-[#0b1020] text-[15px]`}
                >
                  <option value={selectedStudent?.userId ?? ""}>
                    {selectedStudent?.name ?? "Selected student"}
                  </option>
                  <option value="all_students">All students (broadcast)</option>
                  <option value="off_streak">Off-streak students only</option>
                  {activeDetail.students
                    .filter((student) => student.role !== "teacher")
                    .map((student) => (
                      <option key={`motivation-${student.userId}`} value={student.userId}>
                        {student.name} -{" "}
                        {student.status === "active"
                          ? "top performer"
                          : student.status === "off_streak"
                            ? "off-streak"
                            : "at risk"}
                      </option>
                    ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[15px] font-semibold text-slate-300">
                Message type
              </label>
              <div className="relative">
                <select
                  value={motivationMessageType}
                  onChange={(e) => {
                    const type = e.target.value as MotivationMessageType;
                    setMotivationMessageType(type);
                    const label =
                      motivationTarget === "all_students"
                        ? "everyone"
                        : motivationTarget === "off_streak"
                          ? "off-streak students"
                          : (activeDetail.students.find(
                              (student) => student.userId === motivationTarget
                            )?.name ??
                            selectedStudent?.name ??
                            "student");
                    setMotivationMessage(display.messageTemplate(motivationAction, type, label));
                  }}
                  className={`${selectClassName} h-11 rounded-xl border-white/15 bg-[#0b1020] text-[15px]`}
                >
                  <option value="streak_reengagement">🔥 Streak re-engagement nudge</option>
                  <option value="top_performer">🏆 Top performer celebration</option>
                  <option value="custom">📝 Custom message</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[15px] font-semibold text-slate-300">
                Your message *
              </label>
            </div>
            <textarea
              value={motivationMessage}
              onChange={(e) => setMotivationMessage(e.target.value)}
              rows={4}
              placeholder="Write your personalised message..."
              className="w-full rounded-xl border border-white/15 bg-[#0b1020] px-3 py-2.5 text-[15px] leading-relaxed outline-none placeholder:text-slate-500 focus:border-emerald-400"
            />
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-[14px] leading-snug font-semibold text-amber-200">
              ⚡ RDM bonuses are only available on assignment-linked reminders (you pay when you send;
              students earn after they finish the linked assignment).
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-white/10 bg-[#11162a] px-5 py-3">
            <button
              type="button"
              onClick={() => setMotivationOpen(false)}
              className="inline-flex h-10 min-w-27.5 items-center justify-center rounded-full border border-white/15 px-6 text-[15px] font-semibold text-slate-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submitMotivation()}
              disabled={motivationSubmitting || !motivationMessage.trim()}
              className="inline-flex h-10 min-w-55 items-center justify-center rounded-full bg-emerald-500 px-6 text-[15px] font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {motivationSubmitting ? "Sending..." : "Send message"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(assignmentDetail)}
        onOpenChange={(openState) => {
          if (!openState) {
            setAssignmentDetail(null);
            setAssignmentScores([]);
            setAssignmentScoresError(null);
            setConceptFocusCompletion([]);
            setConceptFocusCompletionError(null);
            setConceptFocusCompletionLoading(false);
          }
        }}
      >
        <DialogContent
          hideClose
          className="max-h-[86vh] w-[94vw] max-w-[900px] overflow-hidden rounded-2xl border border-white/20 bg-[#0f1329] p-0 text-slate-100 shadow-2xl sm:max-h-[90vh] sm:rounded-3xl"
        >
          <DialogHeader className="relative border-b border-white/10 bg-linear-to-r from-[#111428] to-[#1a1f3d] p-3 pr-12 sm:p-4 sm:pr-14">
            <DialogClose asChild>
              <button
                type="button"
                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 sm:right-4 sm:top-4"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
            <div className="flex items-start justify-between gap-3">
              <DialogTitle className="font-serif text-lg leading-tight sm:text-xl lg:text-2xl">
                {assignmentDetail?.title ?? "Assignment details"}
              </DialogTitle>
              {assignmentDetail ? (
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {(() => {
                    const tags = assignmentHelpers.getAssignmentTags(assignmentDetail);
                    return tags.map((t) => (
                      <span
                        key={t.label}
                        className={`rounded-md border px-2 py-1 text-[10px] font-bold ${t.color}`}
                      >
                        {t.label}
                      </span>
                    ));
                  })()}
                </div>
              ) : null}
            </div>
          </DialogHeader>
          {assignmentDetail ? (
            <div className="max-h-[calc(90vh-88px)] overflow-y-auto overflow-x-hidden">
              <div className="grid min-w-0 gap-3 p-3 text-sm sm:gap-4 sm:p-4">
                {/* Compact stat chips */}
                <div className="flex flex-wrap gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#151b35] px-3 py-1.5 text-xs text-slate-200">
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
                      Type
                    </span>
                    <span className="font-semibold text-sky-300">{assignmentDetail.type}</span>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#151b35] px-3 py-1.5 text-xs text-slate-200">
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
                      Due
                    </span>
                    <span className="font-semibold">{assignmentDetail.dueDateLabel}</span>
                  </div>
                  {(() => {
                    const audienceTotal = Math.max(
                      1,
                      assignmentDetail.totalCount ?? cohortStudents.length
                    );
                    const completedCount =
                      assignmentDetail.type === "Concept Focus"
                        ? (conceptFocusCompletion.length > 0
                            ? conceptFocusCompletion.filter((s) => s.completed).length
                            : (assignmentDetail.completedCount ?? 0))
                        : assignmentScores.length > 0
                          ? assignmentScores.length
                          : (assignmentDetail.completedCount ?? 0);
                    const completionPct = Math.min(
                      100,
                      Math.round((100 * completedCount) / audienceTotal)
                    );
                    const allDone = completedCount >= audienceTotal;
                    const someDone = completedCount > 0 && !allDone;
                    return (
                      <>
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#151b35] px-3 py-1.5 text-xs text-slate-200">
                          <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
                            Submitted
                          </span>
                          <span className="font-semibold text-emerald-300">
                            {completedCount}/{audienceTotal}
                          </span>
                        </div>
                        {assignmentDetail.type !== "Concept Focus" ? (
                          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#151b35] px-3 py-1.5 text-xs text-slate-200">
                            <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
                              Avg score
                            </span>
                            <span className="font-semibold text-violet-300">
                              {assignmentScores.length > 0
                                ? `${
                                    Math.round(
                                      (assignmentScores.reduce(
                                        (acc, s) =>
                                          acc + (s.total > 0 ? (s.score / s.total) * 100 : 0),
                                        0
                                      ) /
                                        assignmentScores.length) *
                                        10
                                    ) / 10
                                  }%`
                                : assignmentScoresLoading
                                  ? "…"
                                  : "—"}
                            </span>
                          </div>
                        ) : null}
                        {allDone ? (
                          <div className="flex w-full items-center gap-2 rounded-xl border border-emerald-400/35 bg-emerald-500/12 px-3 py-2 text-xs font-bold text-emerald-200">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
                            {audienceTotal === 1
                              ? "Student completed"
                              : `All ${audienceTotal} students completed`}
                          </div>
                        ) : someDone ? (
                          <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/8 px-3 py-2 text-xs">
                            <span className="font-bold text-emerald-300">
                              {completedCount} of {audienceTotal} done
                            </span>
                            <span className="text-slate-400">{completionPct}%</span>
                          </div>
                        ) : (
                          <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#151b35] px-3 py-2 text-xs">
                            <span className="font-bold text-slate-400">Not started</span>
                            <span className="text-slate-500">
                              0/{audienceTotal} done
                            </span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Visibility + assignment meta */}
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-2 text-xs text-sky-100">
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-sky-200/80">
                      Student visibility
                    </div>
                    <div className="mt-1 leading-snug">
                      {assignmentDetail.sectionId == null
                        ? "Whole class — every enrolled student can see this post."
                        : `${activeDetail.sections.find((s) => s.id === assignmentDetail.sectionId)?.name?.trim() || "This teaching section"} — only students placed in that section see it.`}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#121833] px-4 py-2 text-xs text-slate-300">
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
                      Assignment details
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-slate-400">Assigned:</span>
                      <span className="font-semibold text-slate-200">
                        {assignmentDetail.assignedToLabel}
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="text-slate-400">{TEACHER_ASSIGNMENT_INCENTIVE_DETAIL_PREFIX}:</span>
                      <span className="font-semibold text-amber-300">
                        {teacherAssignmentPublishIncentiveLine(assignmentDetail.rewardRdm)}
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="text-slate-400">Completion:</span>
                      <span className="font-semibold text-sky-200">
                        {(() => {
                          const audienceTotal = Math.max(
                            1,
                            assignmentDetail.totalCount ?? cohortStudents.length
                          );
                          const completedCount =
                            assignmentDetail.type === "Concept Focus"
                              ? (conceptFocusCompletion.length > 0
                                  ? conceptFocusCompletion.filter((s) => s.completed).length
                                  : (assignmentDetail.completedCount ?? 0))
                              : assignmentScores.length > 0
                                ? assignmentScores.length
                                : (assignmentDetail.completedCount ?? 0);
                          return audienceTotal > 0
                            ? `${Math.round((completedCount / audienceTotal) * 100)}%`
                            : "0%";
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dynamic content cards */}
                {assignmentDetail.mockPaper ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-linear-to-br from-emerald-500/10 to-transparent p-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-emerald-400">
                      <BookOpen className="h-4 w-4" /> Mock Paper
                    </div>
                    <div className="mt-2 font-semibold text-slate-100">
                      {assignmentDetail.mockPaper.title}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      Catalog ID · {assignmentDetail.mockPaper.slug}
                    </div>
                  </div>
                ) : null}

                {assignmentDetail.chapterQuiz ? (
                  <div className="rounded-xl border border-pink-500/20 bg-linear-to-br from-pink-500/10 to-transparent p-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-pink-400">
                      <BookOpen className="h-4 w-4" />{" "}
                      {assignmentDetail.type === "Concept Focus" ? "Subtopic" : "Chapter Quiz"}
                    </div>
                    <div className="mt-2 font-semibold text-slate-100">
                      {assignmentDetail.type === "Concept Focus"
                        ? assignmentDetail.chapterQuiz.subtopicName
                        : `Class ${assignmentDetail.chapterQuiz.classLevel} · ${assignmentDetail.chapterQuiz.subject} · ${assignmentDetail.chapterQuiz.subtopicName}`}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] leading-relaxed text-slate-400">
                        {assignmentDetail.type === "Concept Focus" ? (
                          <>
                            Focus path · {assignmentDetail.chapterQuiz.subject} · Class{" "}
                            {assignmentDetail.chapterQuiz.classLevel} · Lesson:{" "}
                            {assignmentDetail.chapterQuiz.topic}
                          </>
                        ) : (
                          <>
                            Chapter: {assignmentDetail.chapterQuiz.chapterTitle || "(not set)"} ·
                            Lesson: {assignmentDetail.chapterQuiz.topic}
                            {assignmentDetail.chapterQuiz.advancedSet
                              ? ` · Set ${assignmentDetail.chapterQuiz.advancedSet}`
                              : ""}
                          </>
                        )}
                      </div>
                      {(() => {
                        const primaryHrefTask =
                          assignmentDetail.type === "Concept Focus"
                            ? // For Concept Focus, the teacher expects the subtopic preview / concepts first,
                              // not the MCQ quiz panel.
                              (assignmentDetail.tasks?.find(
                                (t) => t.kind === "topic_path" && Boolean(t.href)
                              ) ??
                              assignmentDetail.tasks?.find(
                                (t) => t.kind === "instacue" && Boolean(t.href)
                              ) ??
                              assignmentDetail.tasks?.find(
                                (t) => t.kind === "bits" && Boolean(t.href)
                              ) ??
                              assignmentDetail.tasks?.find((t) => Boolean(t.href)))
                            : (assignmentDetail.tasks?.find(
                                (t) => t.kind === "chapter_quiz" && Boolean(t.href)
                              ) ?? assignmentDetail.tasks?.find((t) => Boolean(t.href)));
                        if (!primaryHrefTask?.href) return null;
                        const audienceTotal = Math.max(
                          1,
                          assignmentDetail.totalCount ?? cohortStudents.length
                        );
                        const cfCompleted =
                          assignmentDetail.type === "Concept Focus"
                            ? (conceptFocusCompletion.length > 0
                                ? conceptFocusCompletion.filter((s) => s.completed).length
                                : (assignmentDetail.completedCount ?? 0))
                            : 0;
                        const conceptFocusClassDone =
                          assignmentDetail.type === "Concept Focus" &&
                          audienceTotal > 0 &&
                          cfCompleted >= audienceTotal;
                        const openPreview = () => {
                          const rawHref = primaryHrefTask.href ?? "";
                          const postId = assignmentDetail?.id ?? "";
                          const classroomId = activeClassroomId ?? "";
                          const resolved = resolveAssignmentTrackingInHref(
                            rawHref,
                            postId,
                            classroomId
                          );
                          const safeResolved = (() => {
                            // If a Concept Focus link accidentally points at `panel=quiz`, force the concepts panel.
                            if (assignmentDetail.type !== "Concept Focus") return resolved;
                            try {
                              const url = resolved.startsWith("http")
                                ? new URL(resolved)
                                : new URL(resolved, "https://edublast.local");
                              if (url.searchParams.get("panel") === "quiz")
                                url.searchParams.set("panel", "concepts");
                              return resolved.startsWith("http")
                                ? url.toString()
                                : `${url.pathname}${url.search}${url.hash}`;
                            } catch {
                              return resolved;
                            }
                          })();
                          const ref = assignmentDetail?.chapterQuiz ?? null;
                          setTaskPreview({
                            open: true,
                            href: safeResolved,
                            mode:
                              assignmentDetail.type === "Concept Focus"
                                ? "concept-focus-preview"
                                : "chapter-quiz-preview",
                            title:
                              primaryHrefTask.label ||
                              (assignmentDetail.type === "Concept Focus"
                                ? "Concept focus"
                                : "Chapter quiz"),
                            ...(ref
                              ? {
                                  chapterQuizRef: {
                                    board: ref.board,
                                    subject: ref.subject,
                                    classLevel: ref.classLevel,
                                    topic: ref.topic,
                                    subtopicName: ref.subtopicName,
                                    level: ref.level,
                                    advancedSet: ref.advancedSet,
                                  },
                                }
                              : {}),
                          });
                        };
                        if (assignmentDetail.type === "Concept Focus" && conceptFocusClassDone) {
                          return (
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 text-[11px] font-semibold text-emerald-100">
                                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                                Done
                              </span>
                            </div>
                          );
                        }
                        return (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={openPreview}
                              className="inline-flex h-8 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/15"
                            >
                              {assignmentDetail.type === "Concept Focus"
                                ? "Open lesson →"
                                : "Open link →"}
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : null}

                {assignmentDetail.dailyDoseStreak ? (
                  <div className="rounded-xl border border-amber-500/20 bg-linear-to-br from-amber-500/10 to-transparent p-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-amber-400">
                      <Flame className="h-4 w-4" /> DailyDose Streak
                    </div>
                    <div className="mt-2 font-semibold text-slate-100">
                      {assignmentDetail.dailyDoseStreak.trackLabel}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      Funbrain Streak Survival · mixed pool lane
                    </div>
                  </div>
                ) : null}

                {assignmentDetail.gyanEngagement ||
                assignmentDetail.tasks?.some((t) => t.kind === "gyan_engagement") ? (
                  <div className="rounded-xl border border-violet-500/20 bg-linear-to-br from-violet-500/10 to-transparent p-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-violet-400">
                      <BookOpen className="h-4 w-4" /> Gyan++ Engagement
                    </div>
                    {assignmentDetail.gyanEngagement ? (
                      <div className="mt-2 space-y-1 text-[12px] leading-relaxed text-slate-300">
                        {assignmentDetail.gyanEngagement.topicFocus ? (
                          <div>
                            <span className="text-slate-500">Topic:</span>{" "}
                            {assignmentDetail.gyanEngagement.topicFocus}
                          </div>
                        ) : null}
                        {assignmentDetail.gyanEngagement.subtopicHint ? (
                          <div>
                            <span className="text-slate-500">Subtopic:</span>{" "}
                            {assignmentDetail.gyanEngagement.subtopicHint}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] text-slate-400">
                        Students post a doubt on Gyan++ to complete this assignment.
                      </div>
                    )}

                    <div className="mt-4 border-t border-violet-500/15 pt-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                          Student doubts posted
                        </div>
                        {gyanCompletionsLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        ) : (
                          <span className="text-[11px] text-slate-500">
                            {gyanCompletions.length} submitted
                          </span>
                        )}
                      </div>
                      {gyanCompletionsError ? (
                        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                          {gyanCompletionsError}
                        </div>
                      ) : gyanCompletions.length === 0 && !gyanCompletionsLoading ? (
                        <div className="rounded-lg border border-dashed border-white/10 bg-black/10 px-4 py-5 text-center text-xs text-slate-400">
                          No doubts yet. Students must open this assignment and post on Gyan++.
                        </div>
                      ) : (
                        <div className="max-h-72 space-y-2 overflow-y-auto">
                          {gyanCompletions.map((row) => (
                            <div
                              key={`${row.userId}-${row.doubtId}`}
                              className="rounded-lg border border-white/10 bg-[#151b35] px-3 py-2.5"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-semibold text-slate-100">
                                    {row.studentName}
                                  </div>
                                  <div className="mt-0.5 text-xs font-medium text-violet-200">
                                    {row.doubtTitle}
                                  </div>
                                  {row.doubtBody ? (
                                    <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">
                                      {row.doubtBody}
                                    </p>
                                  ) : null}
                                  <div className="mt-1 text-[10px] text-slate-500">
                                    {display.formatRelativeTime(row.completedAt)}
                                    {row.hasTeacherAnswer ? " · You replied on wall" : ""}
                                  </div>
                                </div>
                                <a
                                  href={`/teacher-portal?section=gyanWall&focusDoubt=${encodeURIComponent(row.doubtId)}`}
                                  className="inline-flex shrink-0 items-center rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/15"
                                >
                                  Review on Gyan++ Wall →
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* Resources (task links) hidden in teacher popup (per investor feedback) */}

                {/* Student responses (custom text/links) */}
                {assignmentDetail.tasks?.some((t) => !t.href && t.kind === "free_text") ? (
                  <div className="rounded-xl border border-white/10 bg-[#151b35] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                        <ClipboardList className="h-4 w-4" /> Student responses
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">
                          {assignmentResponses.length} submitted
                        </span>
                        {assignmentResponsesLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        ) : null}
                      </div>
                    </div>
                    {assignmentResponsesError ? (
                      <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                        {assignmentResponsesError}
                      </div>
                    ) : assignmentResponses.length === 0 && !assignmentResponsesLoading ? (
                      <div className="rounded-lg border border-dashed border-white/10 bg-black/10 px-4 py-6 text-center text-xs text-slate-400">
                        No responses yet. Students can optionally submit text/links for “Custom
                        instruction” tasks.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {assignmentResponses.map((r, idx) => {
                          const studentLabel =
                            r.student?.name?.trim() ||
                            r.student?.email?.trim() ||
                            `Student ${idx + 1}`;
                          const taskLabel =
                            assignmentDetail.tasks?.find((t) => t.id === r.taskId)?.label ??
                            r.taskId;
                          return (
                            <div
                              key={`${r.userId}:${r.taskId}:${idx}`}
                              className="rounded-lg border border-white/5 bg-black/20 p-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-slate-100">
                                    {studentLabel}
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-slate-500">
                                    Task: {taskLabel}
                                    <span className="mx-2 text-slate-600">•</span>
                                    Updated: {display.formatRelativeTime(r.updatedAt)}
                                  </div>
                                </div>
                              </div>
                              {r.responseText ? (
                                <div className="mt-2 whitespace-pre-wrap rounded-md border border-white/10 bg-[#0b1020] px-3 py-2 text-[12px] leading-relaxed text-slate-200">
                                  {r.responseText}
                                </div>
                              ) : null}
                              {r.links?.length ? (
                                <div className="mt-2 space-y-1 text-[11px] text-slate-300">
                                  <div className="text-slate-500">Links</div>
                                  <div className="flex flex-col gap-1">
                                    {r.links.map((l) => (
                                      <a
                                        key={l}
                                        href={l}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="truncate rounded-md border border-sky-400/20 bg-sky-500/10 px-2 py-1 text-sky-200 hover:bg-sky-500/15"
                                        title={l}
                                      >
                                        {l}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Student Scores (quizzes / mocks only — not Concept Focus lesson completion) */}
                {assignmentDetail.type !== "Concept Focus" &&
                assignmentDetail.tasks?.some(
                  (t) =>
                    t.kind === "chapter_quiz" ||
                    t.kind === "mock_paper" ||
                    t.kind === "past_paper" ||
                    t.href?.includes("/assignment-test/") ||
                    t.href?.includes("panel=quiz") ||
                    t.href?.includes("/mock") ||
                    t.href?.includes("/mock-test")
                ) ? (
                  <div className="rounded-xl border border-white/10 bg-[#151b35] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                        <Star className="h-4 w-4" /> Student Scores
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500">
                            {assignmentScoresLoading && assignmentScores.length === 0
                              ? "Checking…"
                              : `${assignmentScores.length} submitted`}
                          </span>
                          {assignmentScoresLastUpdatedAt ? (
                            <span className="text-[10px] text-slate-600">
                              Updated {display.formatRelativeTime(assignmentScoresLastUpdatedAt)}
                            </span>
                          ) : null}
                          {assignmentScoresLoading ? (
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/25 bg-sky-500/10 px-2 py-1 text-[10px] font-semibold text-sky-200"
                              role="status"
                              aria-live="polite"
                            >
                              <span className="relative inline-flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400/50" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-300" />
                              </span>
                              Checking for new submissions
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    {assignmentScoresError ? (
                      <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                        {assignmentScoresError}
                      </div>
                    ) : assignmentScores.length === 0 && !assignmentScoresLoading ? (
                      <div className="rounded-lg border border-dashed border-white/10 bg-black/10 px-4 py-6 text-center text-xs text-slate-400">
                        No submissions yet. Scores appear once students submit their answers.
                      </div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto overflow-x-hidden rounded-lg border border-white/5">
                        <div className="sticky top-0 z-10 grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-white/10 bg-[#1a1f3d] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:grid-cols-[1fr_auto_auto_auto_auto]">
                          <div>Student</div>
                          <div className="text-right">Score</div>
                          <div className="text-right">%</div>
                          <div className="hidden text-right sm:block">When</div>
                          <div className="text-right">Answers</div>
                        </div>
                        <div className="divide-y divide-white/5">
                          {assignmentScores.map((s) => {
                            const rosterStudent = activeDetail.students.find(
                              (st) => st.userId === s.userId
                            );
                            const studentName = rosterStudent?.name ?? "Student";
                            const hasScore = s.total > 0;
                            const pct = hasScore
                              ? Math.round((s.score / s.total) * 100)
                              : null;
                            return (
                              <div
                                key={s.userId}
                                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-2.5 transition hover:bg-white/2 sm:grid-cols-[1fr_auto_auto_auto_auto]"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${pct === null ? "bg-sky-500/15 text-sky-300" : pct >= 80 ? "bg-emerald-500/15 text-emerald-300" : pct >= 60 ? "bg-amber-500/15 text-amber-300" : "bg-rose-500/15 text-rose-300"}`}
                                  >
                                    {display.initials(studentName)}
                                  </div>
                                  <span className="truncate text-sm font-medium text-slate-200">
                                    {studentName}
                                  </span>
                                </div>
                                <div className="text-right text-sm font-bold text-emerald-300">
                                  {hasScore ? `${s.score}/${s.total}` : "Submitted"}
                                </div>
                                <div
                                  className={`text-right text-[11px] font-bold ${pct === null ? "text-sky-300" : pct >= 80 ? "text-emerald-400" : pct >= 60 ? "text-amber-400" : "text-rose-400"}`}
                                >
                                  {pct === null ? "—" : `${pct}%`}
                                </div>
                                <div className="hidden items-center justify-end gap-2 sm:flex">
                                  {s.submittedAt ? (
                                    <span className="text-[10px] text-slate-500">
                                      {display.formatRelativeTime(s.submittedAt)}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex justify-end">
                                  {hasScore ? (
                                    <button
                                      type="button"
                                      className="inline-flex h-7 items-center rounded-md border border-violet-400/30 bg-violet-500/10 px-2 text-[11px] font-semibold text-violet-200 hover:bg-violet-500/20"
                                      onClick={() => {
                                        void openStudentAnswerReview({
                                          userId: s.userId,
                                          name: studentName,
                                          score: s.score,
                                          total: s.total,
                                        });
                                      }}
                                    >
                                      View
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-slate-500">No answers</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {!assignmentScoresLoading &&
                    assignmentDetail.type !== "Concept Focus" &&
                    cohortStudents.length > assignmentScores.length ? (
                      <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/10 p-3">
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-300">
                          Pending submissions
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {cohortStudents
                            .filter(
                              (s) => !assignmentScores.some((score) => score.userId === s.userId)
                            )
                            .map((s) => (
                              <span
                                key={s.userId}
                                className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200"
                              >
                                {s.name}
                              </span>
                            ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {assignmentDetail.type === "Concept Focus" ? (
                  <div className="space-y-4 rounded-xl border border-white/10 bg-[#151b35] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                        <Users className="h-4 w-4 shrink-0" /> Student progress
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {conceptFocusCompletionLoading && conceptFocusRosterRows.length === 0
                          ? "Loading…"
                          : conceptFocusRosterRows.length === 0
                            ? "—"
                            : `${conceptFocusRosterRows.filter((r) => r.completed).length}/${conceptFocusRosterRows.length} done`}
                      </div>
                    </div>
                    {conceptFocusCompletionError ? (
                      <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                        {conceptFocusCompletionError}
                      </div>
                    ) : null}
                    {!conceptFocusCompletionLoading &&
                    conceptFocusRosterRows.length === 0 &&
                    !conceptFocusCompletionError ? (
                      <div className="rounded-lg border border-dashed border-white/10 bg-black/10 px-4 py-6 text-center text-xs text-slate-400">
                        No students match this assignment&apos;s audience (section or targeted
                        list).
                      </div>
                    ) : conceptFocusRosterRows.length > 0 ? (
                      <div className="max-h-80 overflow-y-auto overflow-x-hidden rounded-lg border border-white/5">
                        <div className="sticky top-0 z-10 grid grid-cols-[1fr_auto_auto] gap-2 border-b border-white/10 bg-[#1a1f3d] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          <div>Student</div>
                          <div className="text-right">Status</div>
                          <div className="hidden text-right sm:block">When</div>
                        </div>
                        <div className="divide-y divide-white/5">
                          {conceptFocusRosterRows.map((r) => (
                            <div
                              key={r.userId}
                              className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2.5 transition hover:bg-white/[0.02]"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <div
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                    r.completed
                                      ? "bg-emerald-500/15 text-emerald-300"
                                      : "bg-slate-600/25 text-slate-400"
                                  }`}
                                >
                                  {display.initials(r.name)}
                                </div>
                                <span className="truncate text-sm font-medium text-slate-200">
                                  {r.name}
                                </span>
                              </div>
                              <div className="text-right">
                                {r.completed ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                                    <Check className="h-3 w-3 shrink-0" /> Done
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] font-semibold text-slate-400">
                                    Pending
                                  </span>
                                )}
                              </div>
                              <div className="hidden items-center justify-end sm:flex">
                                {r.completedAt ? (
                                  <span className="text-[10px] text-slate-500">
                                    {display.formatRelativeTime(r.completedAt)}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-600">—</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : conceptFocusCompletionLoading ? (
                      <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/10 px-4 py-6 text-xs text-slate-400">
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> Loading student
                        progress…
                      </div>
                    ) : null}
                    <div className="border-t border-white/5 pt-3 text-[11px] leading-relaxed text-slate-300">
                      <span className="font-semibold text-slate-100">Concept Focus</span> is tracked
                      by <span className="font-semibold">Mark as complete</span> on the subtopic
                      lesson (not quiz scores). Rows reflect lesson checklist and assignment sync
                      when both exist.
                    </div>
                  </div>
                ) : null}

                <Dialog
                  open={answerReviewOpen}
                  onOpenChange={(o) => {
                    if (!o) {
                      setAnswerReviewOpen(false);
                      setAnswerReviewError(null);
                      setAnswerReviewPayload(null);
                      setAnswerReviewStudent(null);
                      setAnswerReviewLoading(false);
                    }
                  }}
                >
                  <DialogContent
                    hideClose
                    className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0b1020] p-0 text-slate-100"
                  >
                    <DialogHeader className="sr-only">
                      <DialogTitle>Student answers</DialogTitle>
                    </DialogHeader>
                    <div className="border-b border-white/10 px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
                            Student answers
                          </div>
                          <div className="mt-1 truncate font-serif text-xl text-slate-50">
                            {answerReviewStudent?.name ?? "Student"}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            Score:{" "}
                            <span className="font-semibold text-emerald-200">
                              {answerReviewStudent?.scoreLabel ?? "—"}
                            </span>
                            {answerReviewPayload?.testTitle ? (
                              <>
                                <span className="mx-2 text-slate-600">•</span>
                                <span className="text-slate-300">
                                  {answerReviewPayload.testTitle}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
                          onClick={() => setAnswerReviewOpen(false)}
                          aria-label="Close"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="px-5 py-4">
                      {answerReviewLoading ? (
                        <div className="flex min-h-[30vh] items-center justify-center gap-2 text-sm text-slate-400">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading answers…
                        </div>
                      ) : answerReviewError ? (
                        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                          {answerReviewError}
                          <div className="mt-1 text-xs text-amber-200/70">
                            If this is a Chapter Quiz attempt from before this update, the app only
                            recorded score — not per-question answers.
                          </div>
                        </div>
                      ) : answerReviewPayload?.attempt ? (
                        <GeneratedMcqReview
                          questions={answerReviewPayload.questions}
                          answers={answerReviewPayload.attempt.answers}
                          total={answerReviewPayload.questions.length}
                          submitted
                          showCorrectAnswers
                        />
                      ) : (
                        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-400">
                          No attempt found for this student.
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(taskPreview?.open)}
        onOpenChange={(v) => {
          if (!v) setTaskPreview(null);
        }}
      >
        <DialogContent className="max-h-[86vh] w-[94vw] max-w-[720px] overflow-hidden rounded-2xl border border-white/15 bg-[#0b1020] p-0 text-slate-100 shadow-2xl sm:max-h-[90vh] sm:rounded-3xl sm:max-w-3xl md:max-w-4xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Task preview</DialogTitle>
          </DialogHeader>
          {taskPreview ? (
            <TaskPreviewBody
              href={taskPreview.href}
              mode={taskPreview.mode}
              title={taskPreview.title}
              chapterQuizRef={taskPreview.chapterQuizRef}
            />
          ) : (
            <div className="p-6 text-sm text-slate-400">No task selected.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
