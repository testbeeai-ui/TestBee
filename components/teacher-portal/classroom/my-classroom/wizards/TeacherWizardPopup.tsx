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
import { useSearchParams, useRouter } from "next/navigation";
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  ExternalLink,
  Flame,
  Lock,
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
import { useTeacherRdmCosts } from "@/hooks/TeacherRdmCostsContext";
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
  DAILYDOSE_STREAK_TRACK_IDS,
  trackLabelById,
  type DailyDoseStreakTrackId,
} from "@/lib/teacherPortal/dailyDoseStreakTracks";
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
import {
  canUseGoogleCalendarSeries,
  type TeacherPlanKey,
} from "@/lib/teacherPortal/teacherPlan";

import type { MyClassroomViewProps } from "../types";
import { WIZARD_TASKS } from "../wizard/constants";
import {
  buildWizardShellInitialState,
  writeWizardShellPersisted,
  type WizardShellPersistedV2,
  type WizardSectionDraftPersist,
  type TPWizardSubject,
  type TPWizardPuc,
  type TPWizardExam,
} from "../wizard/shell-persist";
import { SUBJECT_OPTIONS, PUC_OPTIONS, EXAM_OPTIONS, WEEKDAYS } from "../constants";
import {
  TeacherNudgeWithRdmWizard,
  type TeacherNudgeWithRdmWizardHandle,
} from "./TeacherNudgeWithRdmWizard";
import { TeacherAssignmentProgressWizard } from "./TeacherAssignmentProgressWizard";
import { TeacherCounselStudentWizard } from "./TeacherCounselStudentWizard";
import {
  chargeTeacherRdm,
  formatTeacherRdmDeductionCompact,
  refundTeacherRdm,
} from "@/lib/teacherPortal/rdmCharges";

export function TeacherWizardPopup(props: {
  onClose: () => void;
  onHideForever: () => void;
  teacherId: string;
  classrooms: TeacherPortalClassroomCard[];
  classroomDetails: Record<string, TeacherPortalClassroomDetail>;
  mockPostIdsAssignedThisWeek: string[];
  mockNudgeLowScorersByPostId: Record<string, TeacherPortalMockNudgeLowScorer[]>;
  mockNudgeSubmittedAttemptsByPostId: Record<string, TeacherPortalMockNudgeSubmittedAttempt[]>;
  onCreateAssignment: MyClassroomViewProps["onCreateAssignment"];
  onCreateClassroom: MyClassroomViewProps["onCreateClassroom"];
  onRefreshTeacherPortal: MyClassroomViewProps["onRefreshTeacherPortal"];
  onMotivateStudents: MyClassroomViewProps["onMotivateStudents"];
  onScheduleLiveSession: MyClassroomViewProps["onScheduleLiveSession"];
  onRequireVerifiedAction?: MyClassroomViewProps["onRequireVerifiedAction"];
  toast: ReturnType<typeof useToast>["toast"];
  /** When false, nudge wizard cannot inline-create mock/quiz assignments (e.g. admin impersonation). */
  allowNudgeStructuredAssignmentCreate?: boolean;
}) {
  const toast = props.toast;
  const router = useRouter();
  const { costs: teacherRdmCosts } = useTeacherRdmCosts();
  const createSectionRdmCompact = formatTeacherRdmDeductionCompact(
    "create_section",
    teacherRdmCosts
  );
  const nudgeWizardRef = useRef<TeacherNudgeWithRdmWizardHandle>(null);
  const GOOGLE_CONNECT_PROMPTED_SESSION_KEY = `teacherPortal.googleConnectPrompted.session.v1:${props.teacherId}`;
  const GOOGLE_CONNECT_GATE_DISMISSED_SESSION_KEY = `teacherPortal.googleConnectGateDismissed.session.v1:${props.teacherId}`;

  type WizardSectionDraft = WizardSectionDraftPersist;

  const embeddedAssignmentDraftKey = `teacherPortal.wizardEmbeddedAssignment.v1:${props.teacherId}`;
  const embeddedScheduleDraftKey = `teacherPortal.wizardEmbeddedSchedule.v1:${props.teacherId}`;

  const wsInitial = buildWizardShellInitialState(props.teacherId);

  const [collapsed, setCollapsed] = useState(wsInitial.collapsed);
  const [activeTask, setActiveTask] = useState<number | null>(wsInitial.activeTask);
  const [currentSteps, setCurrentSteps] = useState<number[]>(wsInitial.currentSteps);
  const [creating, setCreating] = useState(false);
  const [createdSummary, setCreatedSummary] = useState<{
    classroomId: string;
    joinCode: string;
    classroomName: string;
  } | null>(wsInitial.createdSummary);

  const [cwName, setCwName] = useState(wsInitial.cwName);
  const [cwSubject, setCwSubject] = useState<(typeof SUBJECT_OPTIONS)[number]>(
    wsInitial.cwSubject as (typeof SUBJECT_OPTIONS)[number]
  );
  const [cwPucLevel, setCwPucLevel] = useState<(typeof PUC_OPTIONS)[number]>(
    wsInitial.cwPucLevel as (typeof PUC_OPTIONS)[number]
  );
  const [cwExamTarget, setCwExamTarget] = useState<(typeof EXAM_OPTIONS)[number]>(
    wsInitial.cwExamTarget as (typeof EXAM_OPTIONS)[number]
  );
  const [cwAllowAdhocTrial, setCwAllowAdhocTrial] = useState(wsInitial.cwAllowAdhocTrial);
  const [cwSections, setCwSections] = useState<WizardSectionDraft[]>(wsInitial.cwSections);
  const wizardLaunchRdmLabel = useMemo(() => {
    const sectionCount = cwSections[0]?.name?.trim() ? 1 : 0;
    const total =
      Math.max(0, teacherRdmCosts.create_classroom) +
      sectionCount * Math.max(0, teacherRdmCosts.create_section);
    return total > 0 ? `(−${total} RDM)` : null;
  }, [cwSections, teacherRdmCosts.create_classroom, teacherRdmCosts.create_section]);
  const [cwSectionName, setCwSectionName] = useState(wsInitial.cwSectionName);
  const [cwSectionScheduleDate, setCwSectionScheduleDate] = useState(
    wsInitial.cwSectionScheduleDate
  );
  const [cwSectionScheduleTime, setCwSectionScheduleTime] = useState(
    wsInitial.cwSectionScheduleTime
  );
  const [cwSectionDurationMinutes, setCwSectionDurationMinutes] = useState(
    wsInitial.cwSectionDurationMinutes
  );
  const [cwSectionRepeatDays, setCwSectionRepeatDays] = useState<string[]>(
    wsInitial.cwSectionRepeatDays.length ? wsInitial.cwSectionRepeatDays : ["Mon", "Wed", "Fri"]
  );
  const [cwSectionScheduleEndDate, setCwSectionScheduleEndDate] = useState(
    wsInitial.cwSectionScheduleEndDate
  );
  const [cwSectionFormOpen, setCwSectionFormOpen] = useState(() => {
    // If a section is already saved, default to collapsed form (edit via the Saved section card).
    if (wsInitial.cwSections?.[0]) return false;
    // If no section is saved yet, show the form by default (fewer clicks).
    return true;
  });

  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [googleGateOpen, setGoogleGateOpen] = useState(false);
  const [googleGatePending, setGoogleGatePending] = useState<
    null | { kind: "next" } | { kind: "jump"; stepIdx: number } | { kind: "addSection" }
  >(null);

  const [sectionGateOpen, setSectionGateOpen] = useState(false);
  const [sectionGatePending, setSectionGatePending] = useState<null | { kind: "next" | "launch" }>(
    null
  );
  const [highlightSectionClear, setHighlightSectionClear] = useState(false);
  const [singleSectionGateOpen, setSingleSectionGateOpen] = useState(false);
  const [highlightSectionEdit, setHighlightSectionEdit] = useState(false);

  const [teacherPlanTier, setTeacherPlanTier] = useState<TeacherPlanKey>("free");
  const canCalendarSeries = canUseGoogleCalendarSeries(teacherPlanTier);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchWithClientAuth("/api/teacher/plan/limits");
        const body = (await res.json()) as { tier?: TeacherPlanKey };
        if (!cancelled && res.ok && body.tier) setTeacherPlanTier(body.tier);
      } catch {
        /* keep free default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.teacherId]);

  const goToTeacherSubscriptions = useCallback(() => {
    router.push("/teacher-portal?section=subscriptions");
  }, [router]);

  useEffect(() => {
    const s = buildWizardShellInitialState(props.teacherId);
    setCollapsed(s.collapsed);
    setActiveTask(s.activeTask);
    setCurrentSteps(s.currentSteps);
    setCreatedSummary(s.createdSummary);
    setCwName(s.cwName);
    setCwSubject(s.cwSubject as (typeof SUBJECT_OPTIONS)[number]);
    setCwPucLevel(s.cwPucLevel as (typeof PUC_OPTIONS)[number]);
    setCwExamTarget(s.cwExamTarget as (typeof EXAM_OPTIONS)[number]);
    setCwAllowAdhocTrial(s.cwAllowAdhocTrial);
    setCwSections(s.cwSections);
    setCwSectionName(s.cwSectionName);
    setCwSectionScheduleDate(s.cwSectionScheduleDate);
    setCwSectionScheduleTime(s.cwSectionScheduleTime);
    setCwSectionDurationMinutes(s.cwSectionDurationMinutes);
    setCwSectionRepeatDays(
      s.cwSectionRepeatDays.length ? s.cwSectionRepeatDays : ["Mon", "Wed", "Fri"]
    );
    setCwSectionScheduleEndDate(s.cwSectionScheduleEndDate);
    setCwSectionFormOpen(s.cwSections?.[0] ? false : true);
  }, [props.teacherId]);

  useEffect(() => {
    const payload: WizardShellPersistedV2 = {
      v: 2,
      collapsed,
      activeTask,
      currentSteps,
      createdSummary,
      cwName,
      cwSubject: cwSubject as TPWizardSubject,
      cwPucLevel: cwPucLevel as TPWizardPuc,
      cwExamTarget: cwExamTarget as TPWizardExam,
      cwAllowAdhocTrial,
      cwSections,
      cwSectionName,
      cwSectionScheduleDate,
      cwSectionScheduleTime,
      cwSectionDurationMinutes,
      cwSectionRepeatDays,
      cwSectionScheduleEndDate,
    };
    const id = window.setTimeout(() => writeWizardShellPersisted(props.teacherId, payload), 50);
    return () => window.clearTimeout(id);
  }, [
    props.teacherId,
    collapsed,
    activeTask,
    currentSteps,
    createdSummary,
    cwName,
    cwSubject,
    cwPucLevel,
    cwExamTarget,
    cwAllowAdhocTrial,
    cwSections,
    cwSectionName,
    cwSectionScheduleDate,
    cwSectionScheduleTime,
    cwSectionDurationMinutes,
    cwSectionRepeatDays,
    cwSectionScheduleEndDate,
  ]);

  const getSessionFlag = useCallback((key: string) => {
    if (typeof window === "undefined") return null;
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }, []);

  const setSessionFlag = useCallback((key: string, value: string) => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }, []);

  const refreshGoogleConnected = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token ?? "";
      const res = await fetch(`/api/integrations/google/status?t=${Date.now()}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const payload = (await res.json().catch(() => ({}))) as { connected?: boolean };
      if (!res.ok) {
        setGoogleConnected(false);
        return;
      }
      setGoogleConnected(Boolean(payload.connected));
    } catch {
      setGoogleConnected(false);
    }
  }, []);

  useEffect(() => {
    void refreshGoogleConnected();
  }, [refreshGoogleConnected]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshGoogleConnected();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      // bfcache: user returned via Back without full reload (e.g. abandoned OAuth tab).
      if (e.persisted) void refreshGoogleConnected();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [refreshGoogleConnected]);

  const startGoogleConnect = useCallback(async () => {
    try {
      setSessionFlag(GOOGLE_CONNECT_PROMPTED_SESSION_KEY, "1");
      const r = await redirectToGoogleCalendarConsent();
      if (r.mode === "popup") {
        if (r.connected) {
          await refreshGoogleConnected();
          props.toast({ title: "Google Calendar connected" });
        } else if (r.reason && r.reason !== "closed") {
          props.toast({
            title: "Google Calendar not connected",
            description:
              r.reason === "no_refresh_token"
                ? "Try again and accept all requested permissions, or choose the Google account that owns your Calendar."
                : r.reason,
            variant: "destructive",
          });
        }
      }
    } catch (err) {
      props.toast({
        title: "Could not start Google Calendar consent",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  }, [GOOGLE_CONNECT_PROMPTED_SESSION_KEY, props, refreshGoogleConnected, setSessionFlag]);

  const shouldGateGoogle = useCallback(() => {
    if (googleConnected === true) return false;
    // One-time per login/session: if dismissed, do not gate again until relogin.
    if (getSessionFlag(GOOGLE_CONNECT_GATE_DISMISSED_SESSION_KEY) === "1") return false;
    return true;
  }, [GOOGLE_CONNECT_GATE_DISMISSED_SESSION_KEY, getSessionFlag, googleConnected]);

  const pctFor = useCallback(
    (taskIdx: number) => {
      const total = Math.max(1, WIZARD_TASKS[taskIdx]?.steps.length ?? 1);
      const current = Math.max(0, Math.min(currentSteps[taskIdx] ?? 0, total - 1));
      return Math.round(((current + 1) / total) * 100);
    },
    [currentSteps]
  );

  const jumpStep = useCallback((taskIdx: number, stepIdx: number) => {
    setCurrentSteps((prev) => {
      const next = [...prev];
      const max = Math.max(0, (WIZARD_TASKS[taskIdx]?.steps.length ?? 1) - 1);
      next[taskIdx] = Math.max(0, Math.min(stepIdx, max));
      return next;
    });
  }, []);

  const selectTask = (idx: number) => {
    setActiveTask((prev) => (prev === idx ? null : idx));
  };

  const next = useCallback(() => {
    if (activeTask == null) return;
    jumpStep(activeTask, (currentSteps[activeTask] ?? 0) + 1);
  }, [activeTask, currentSteps, jumpStep]);

  const prev = useCallback(() => {
    if (activeTask == null) return;
    jumpStep(activeTask, (currentSteps[activeTask] ?? 0) - 1);
  }, [activeTask, currentSteps, jumpStep]);

  const openGoogleGate = useCallback((pending: NonNullable<typeof googleGatePending>) => {
    setGoogleGatePending(pending);
    setGoogleGateOpen(true);
  }, []);

  const clearSectionFormAndDraft = useCallback(() => {
    setCwSectionName("");
    setCwSectionScheduleDate("");
    setCwSectionScheduleTime("");
    setCwSectionDurationMinutes(90);
    setCwSectionRepeatDays(["Mon", "Wed", "Fri"]);
    setCwSectionScheduleEndDate("");
    setCwSectionFormOpen(false);
  }, []);

  const loadSavedSectionIntoForm = useCallback(() => {
    const d = cwSections[0];
    if (!d) return;
    setCwSectionFormOpen(true);
    setCwSectionName(d.name);
    setCwSectionScheduleDate(d.scheduleDate);
    setCwSectionScheduleTime(d.scheduleTime);
    setCwSectionDurationMinutes(d.durationMinutes);
    setCwSectionRepeatDays(d.repeatDays);
    setCwSectionScheduleEndDate(d.scheduleEndDate ?? "");
    setHighlightSectionEdit(true);
    window.setTimeout(() => setHighlightSectionEdit(false), 4000);
  }, [cwSections]);

  const openSectionGate = useCallback((pending: NonNullable<typeof sectionGatePending>) => {
    setSectionGatePending(pending);
    setSectionGateOpen(true);
    setHighlightSectionClear(true);
    window.setTimeout(() => setHighlightSectionClear(false), 4000);
  }, []);

  const ensureVerifiedForClassroomFlow = useCallback(async () => {
    if (!props.onRequireVerifiedAction) return true;
    return props.onRequireVerifiedAction("Create classroom");
  }, [props]);

  const guardedNext = useCallback(async () => {
    if (activeTask === 0) {
      const isVerified = await ensureVerifiedForClassroomFlow();
      if (!isVerified) return;
    }
    if (activeTask === 4) {
      const stepIdx = currentSteps[4] ?? 0;
      const gate = nudgeWizardRef.current?.canProceedFromStep(stepIdx);
      if (gate && !gate.ok) {
        toast({
          title: gate.message ?? "Complete this step first",
          variant: "destructive",
        });
        return;
      }
    }

    if (activeTask === 0 && shouldGateGoogle()) {
      openGoogleGate({ kind: "next" });
      return;
    }

    if (activeTask === 0) {
      const step = currentSteps[0] ?? 0;
      const hasSavedSection = Boolean(cwSections[0]);
      const sectionFormHasAny = Boolean(cwSectionName.trim());

      if (step === 0 && !cwName.trim()) {
        toast({ title: "Classroom name required", variant: "destructive" });
        return;
      }

      // Step 3: if teacher started entering a section, they must save it.
      if ((step === 2 || step === 3) && sectionFormHasAny && !hasSavedSection) {
        openSectionGate({ kind: "next" });
        return;
      }
    }
    next();
  }, [
    activeTask,
    cwName,
    cwSectionName,
    cwSectionScheduleDate,
    cwSectionScheduleEndDate,
    cwSectionScheduleTime,
    cwSections,
    currentSteps,
    ensureVerifiedForClassroomFlow,
    next,
    openGoogleGate,
    openSectionGate,
    shouldGateGoogle,
    toast,
  ]);

  const guardedJumpStep = useCallback(
    async (taskIdx: number, stepIdx: number) => {
      if (taskIdx === 0) {
        const isVerified = await ensureVerifiedForClassroomFlow();
        if (!isVerified) return;
      }
      if (taskIdx === 0 && stepIdx > 0 && shouldGateGoogle()) {
        openGoogleGate({ kind: "jump", stepIdx });
        return;
      }
      jumpStep(taskIdx, stepIdx);
    },
    [ensureVerifiedForClassroomFlow, jumpStep, openGoogleGate, shouldGateGoogle]
  );

  const resetCreateClassroomWizard = () => {
    setCreatedSummary(null);
    setCwName("");
    setCwSubject("Physics");
    setCwPucLevel("PUC 2");
    setCwExamTarget("JEE Advanced");
    setCwAllowAdhocTrial(true);
    setCwSections([]);
    setCwSectionName("");
    setCwSectionScheduleDate("");
    setCwSectionScheduleTime("");
    setCwSectionDurationMinutes(90);
    setCwSectionRepeatDays(["Mon", "Wed", "Fri"]);
    setCwSectionScheduleEndDate("");
    setCurrentSteps((prev) => {
      const nextArr = [...prev];
      nextArr[0] = 0;
      return nextArr;
    });
  };

  const createClassroomFromWizard = async () => {
    if (creating) return;
    const name = cwName.trim();
    if (!name) {
      props.toast({ title: "Classroom name required", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await props.onCreateClassroom({
        name,
        subject: cwSubject,
        pucLevel: cwPucLevel,
        examTarget: cwExamTarget,
        scheduleDate: null,
        scheduleTime: null,
        durationMinutes: 90,
        repeatDays: [],
        scheduleEndDate: null,
        // Investor requirement: classrooms remain public for join requests regardless of UI choice.
        allowAdhocTrial: true,
      });

      const { data: newest, error: newestErr } = await supabase
        .from("classrooms")
        .select("id, join_code, name")
        .eq("teacher_id", props.teacherId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (newestErr || !newest?.id) {
        throw newestErr ?? new Error("Classroom created, but could not load its details.");
      }

      const classroomId = String(newest.id);
      const joinCode = String(newest.join_code ?? "");
      const classroomName = String(newest.name ?? name);

      const sectionDrafts = cwSections.slice(0, 1);
      if (sectionDrafts.length > 0) {
        for (let i = 0; i < sectionDrafts.length; i += 1) {
          const draft = sectionDrafts[i];
          const secName = draft.name.trim();
          if (!secName) continue;

          try {
            await chargeTeacherRdm("create_section", teacherRdmCosts);
            try {
              const { data: created, error } = await supabase
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .from("classroom_sections" as any)
                .insert({
                  classroom_id: classroomId,
                  name: secName,
                  sort_order: i,
                })
                .select("id")
                .single();
              const createdRow = created as { id?: string } | null;
              if (error || !createdRow?.id) throw error ?? new Error("Could not create section.");
            } catch (secInsertErr) {
              await refundTeacherRdm("create_section", teacherRdmCosts).catch(() => {});
              throw secInsertErr;
            }
          } catch (secErr) {
            props.toast({
              title: "Section could not be created",
              description: secErr instanceof Error ? secErr.message : "Please try again.",
              variant: "destructive",
            });
          }
        }
      }

      await props.onRefreshTeacherPortal({ silent: true });
      setCreatedSummary({ classroomId, joinCode, classroomName });
      props.toast({ title: "Classroom created" });
    } catch (e) {
      props.toast({
        title: "Could not create classroom",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const beginAddSectionDraft = useCallback(() => {
    const name = cwSectionName.trim();
    if (!name) {
      props.toast({ title: "Section name required", variant: "destructive" });
      return;
    }

    setCwSections([
      {
        name,
        scheduleDate: "",
        scheduleTime: "",
        durationMinutes: cwSectionDurationMinutes,
        repeatDays: [],
        scheduleEndDate: null,
      },
    ]);
    setCwSectionName("");
    setCwSectionScheduleDate("");
    setCwSectionScheduleTime("");
    setCwSectionDurationMinutes(90);
    setCwSectionRepeatDays(["Mon", "Wed", "Fri"]);
    setCwSectionScheduleEndDate("");
    setCwSectionFormOpen(false);
  }, [
    cwSectionDurationMinutes,
    cwSectionName,
    cwSectionRepeatDays,
    cwSectionScheduleDate,
    cwSectionScheduleEndDate,
    cwSectionScheduleTime,
    props,
  ]);

  return (
    <div className="flex h-full min-h-0 w-full text-[12.5px] sm:text-sm">
      <aside
        className={`relative flex min-h-0 shrink-0 flex-col border-r border-white/10 bg-[#0d0d1c] transition-[width] duration-300 ${
          collapsed ? "w-11 sm:w-12" : "w-[200px] sm:w-[220px] md:w-[248px] lg:w-[268px]"
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-2.5 py-2 sm:px-3 sm:py-2.5">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10 text-violet-200 hover:bg-violet-500/15 sm:h-9 sm:w-9"
            title="Toggle wizard"
          >
            <WandSparkles className="h-4 w-4" />
          </button>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold sm:text-sm">Task Wizard</div>
              <div className="text-[10.5px] text-slate-400 sm:text-[11px]">
                Click a task to get started
              </div>
            </div>
          ) : null}
          {!collapsed ? (
            <button
              type="button"
              onClick={props.onHideForever}
              className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[11px] font-semibold text-slate-300 hover:border-rose-400/40 hover:text-rose-200"
            >
              Hide
            </button>
          ) : null}
        </div>

        {!collapsed ? (
          <div className="border-b border-white/10 px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="text-[13px] text-slate-200 sm:text-sm">
              Good day, <span className="font-serif italic text-emerald-300">Teacher</span>
            </div>
            <div className="text-[11px] text-slate-400 sm:text-xs">
              What would you like to accomplish today?
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {WIZARD_TASKS.map((task, idx) => {
            const isActive = activeTask === idx;
            return (
              <div
                key={task.title}
                role="button"
                tabIndex={0}
                onClick={() => selectTask(idx)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") selectTask(idx);
                }}
                className={`mb-1.5 overflow-hidden rounded-2xl border bg-[#131327] transition ${
                  isActive ? "border-emerald-400/30 bg-emerald-500/[0.04]" : "border-white/10"
                }`}
              >
                <div
                  className={`flex items-start gap-2.5 px-2.5 py-2 sm:gap-3 sm:px-3 sm:py-2.5 ${
                    collapsed ? "justify-center" : ""
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border sm:h-8 sm:w-8 ${task.emojiBorderBgClass}`}
                    aria-hidden
                  >
                    <span className="text-[13px] sm:text-sm">{task.emoji}</span>
                  </div>
                  {!collapsed ? (
                    <div className="min-w-0 flex-1">
                      <div className="text-[10.5px] font-medium leading-snug text-slate-100 sm:text-xs">
                        {task.title}
                      </div>
                      {isActive ? (
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10 sm:mt-2">
                          <div
                            className="h-full rounded-full bg-emerald-400 transition-[width]"
                            style={{ width: `${pctFor(idx)}%` }}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {!collapsed && isActive ? (
                  <div className="border-t border-emerald-400/10 px-2.5 py-2.5 sm:px-3 sm:py-3">
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300 sm:mb-2">
                      {task.steps.length} steps
                    </div>
                    <div className="space-y-1">
                      {task.steps.map((s, stepIdx) => {
                        const current = currentSteps[idx] ?? 0;
                        const state =
                          stepIdx < current ? "done" : stepIdx === current ? "current" : "todo";
                        return (
                          <button
                            key={s.label}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTask(idx);
                              jumpStep(idx, stepIdx);
                            }}
                            className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-[11px] transition sm:px-3 sm:py-2 sm:text-xs ${
                              state === "current"
                                ? "border-emerald-400/40 bg-emerald-500/10 text-slate-100"
                                : state === "done"
                                  ? "border-emerald-400/25 text-emerald-200 hover:bg-white/[0.03]"
                                  : "border-white/10 text-slate-300 hover:bg-white/[0.03]"
                            }`}
                          >
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${
                                state === "done"
                                  ? "border-emerald-400 bg-emerald-400 text-black"
                                  : state === "current"
                                    ? "border-emerald-400 text-emerald-200"
                                    : "border-white/20 text-slate-300"
                              }`}
                            >
                              {stepIdx + 1}
                            </div>
                            <div className="min-w-0 flex-1 leading-snug">{s.label}</div>
                            {state === "done" ? (
                              <Check className="h-3.5 w-3.5 text-emerald-300" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[#07070f]">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2 sm:px-5 sm:py-2.5">
          <div className="min-w-0">
            <div className="font-serif text-[15px] sm:text-xl">EduBlast Teacher Wizard</div>
            <div className="text-[10.5px] text-slate-400 sm:text-xs">
              Use the wizard to complete teacher tasks step-by-step.
            </div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 sm:h-9 sm:w-9"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className={`flex min-h-0 flex-1 flex-col px-2 py-2 sm:px-3 sm:py-3 ${
            activeTask === 0 ||
            activeTask === 1 ||
            activeTask === 2 ||
            activeTask === 3 ||
            activeTask === 5
              ? "min-h-0 overflow-hidden"
              : "overflow-y-auto"
          }`}
        >
          {activeTask == null ? (
            <div className="rounded-3xl border border-white/10 bg-[#15162b] p-3.5 sm:p-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-violet-200">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-300 opacity-80" />
                Teacher wizard · EduBlast
              </div>
              <div className="mt-2.5 font-serif text-[22px] leading-tight sm:mt-4 sm:text-4xl">
                What do you want to <span className="italic text-emerald-300">accomplish</span>{" "}
                today?
              </div>
              <div className="mt-2 max-w-2xl text-[12px] leading-relaxed text-slate-300 sm:mt-3 sm:text-sm">
                Pick a task on the left — you’ll get a clean step-by-step flow for everything from
                creating classrooms to nudging students.
              </div>
              <div className="mt-4 flex flex-wrap gap-2 sm:mt-5">
                {WIZARD_TASKS.map((t, idx) => (
                  <button
                    key={t.emoji}
                    type="button"
                    onClick={() => setActiveTask(idx)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#0d0d1c] px-3.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-white/25 hover:bg-white/[0.04] sm:px-4 sm:py-2 sm:text-xs"
                  >
                    <span aria-hidden>{t.emoji}</span>
                    {t.main.badge.split("·")[1]?.trim() ?? "Task"}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            (() => {
              const t = WIZARD_TASKS[activeTask];
              const stepIdx = currentSteps[activeTask] ?? 0;
              const stepCount = t.steps.length;

              // For the assignment wizard, render a compact full-pane experience (no nested scroll,
              // no duplicated "task header" chrome) so it fits on 11" screens.
              if (activeTask === 1) {
                return (
                  <div className="rounded-3xl border border-white/10 bg-[#15162b] p-4 sm:p-5">
                    <CreateAssignmentWizard
                      teacherId={props.teacherId}
                      classrooms={props.classrooms}
                      classroomDetails={props.classroomDetails}
                      initialClassroomId={createdSummary?.classroomId ?? null}
                      variant="embedded"
                      sessionDraftKey={embeddedAssignmentDraftKey}
                      externalStep={
                        Math.max(1, Math.min(4, (currentSteps[1] ?? 0) + 1)) as 1 | 2 | 3 | 4
                      }
                      onStepChange={(s) => jumpStep(1, s - 1)}
                      onCancel={() => {
                        setActiveTask(null);
                      }}
                      onPublish={async (input) => {
                        try {
                          await props.onCreateAssignment(
                            input as Parameters<MyClassroomViewProps["onCreateAssignment"]>[0]
                          );
                          props.toast({ title: "Assignment created" });
                          await props.onRefreshTeacherPortal({ silent: true });
                          setActiveTask(null);
                        } catch (e) {
                          const message = e instanceof Error ? e.message : "Could not publish assignment";
                          props.toast({
                            title: "Assignment not published",
                            description: message,
                            variant: "destructive",
                          });
                          throw e;
                        }
                      }}
                    />
                  </div>
                );
              }

              if (activeTask === 2) {
                return (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12162a] sm:rounded-3xl">
                    <ScheduleLiveSessionPanel
                      variant="embedded"
                      sessionDraftKey={embeddedScheduleDraftKey}
                      externalStep={
                        Math.max(1, Math.min(5, (currentSteps[2] ?? 0) + 1)) as 1 | 2 | 3 | 4 | 5
                      }
                      onStepChange={(s) => jumpStep(2, s - 1)}
                      classrooms={props.classrooms}
                      toast={props.toast}
                      headingTitle="Schedule a lesson / webinar"
                      headingSubtitle="Set up a live lesson on EduBlast, add your Google Meet link, attach pre-work and post-work resources, and open optional adhoc trial slots for any EduBlast member to join."
                      submitLabel="Schedule lesson"
                      onSchedule={async (input) => {
                        await props.onScheduleLiveSession(input);
                        await props.onRefreshTeacherPortal({ silent: true });
                        setActiveTask(null);
                      }}
                      onDismiss={() => setActiveTask(null)}
                    />
                  </div>
                );
              }

              if (activeTask === 3) {
                return (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15162b] p-3 sm:p-4">
                    <CreateTestsView
                      embedded
                      externalStep={
                        Math.max(1, Math.min(5, (currentSteps[3] ?? 0) + 1)) as 1 | 2 | 3 | 4 | 5
                      }
                      onStepChange={(s) => jumpStep(3, s - 1)}
                      teacherId={props.teacherId}
                      classrooms={props.classrooms}
                      onCreateAssignment={async (input) => {
                        const created = await props.onCreateAssignment(
                          input as Parameters<MyClassroomViewProps["onCreateAssignment"]>[0]
                        );
                        props.toast({ title: "Test assigned to classroom" });
                        await props.onRefreshTeacherPortal({ silent: true });
                        return created;
                      }}
                    />
                  </div>
                );
              }

              if (activeTask === 0 && createdSummary) {
                return (
                  <div className="rounded-3xl border border-white/10 bg-[#15162b] p-6 sm:p-8">
                    <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10 text-2xl">
                        🎉
                      </div>
                      <div className="mt-4 font-serif text-2xl sm:text-3xl">
                        Classroom launched!
                      </div>
                      <div className="mt-2 text-sm text-slate-300">
                        <span className="font-semibold text-slate-100">
                          {createdSummary.classroomName}
                        </span>{" "}
                        is live. Share the join code with students to let them request access.
                      </div>
                      <div className="mt-5 w-full rounded-2xl border border-white/10 bg-[#0d0d1c] p-4 text-left">
                        <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
                          Join code
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <div className="font-serif text-3xl text-emerald-300 tracking-widest">
                            {createdSummary.joinCode || "—"}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (!createdSummary.joinCode) return;
                              void navigator.clipboard.writeText(createdSummary.joinCode);
                              props.toast({ title: "Code copied" });
                            }}
                            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                          >
                            <ClipboardList className="h-4 w-4" /> Copy
                          </button>
                        </div>
                      </div>
                      <div className="mt-6 flex flex-wrap justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            props.onClose();
                            resetCreateClassroomWizard();
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
                        >
                          Close wizard
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            resetCreateClassroomWizard();
                            setCreatedSummary(null);
                            setActiveTask(0);
                          }}
                          className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-black hover:bg-emerald-400"
                        >
                          Create another classroom
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#15162b] sm:rounded-3xl">
                  {/** Create-classroom step gating: if section form has partial values, require save before Next/Launch. */}
                  <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-white/10 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
                    <div className="min-w-0 max-w-[min(100%,52vw)]">
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-[#0d0d1c] px-2 py-0.5 text-[10px] text-slate-300 sm:text-[11px]">
                        {t.main.badge}
                      </div>
                      <div className="mt-1.5 font-serif text-lg leading-tight text-slate-100 sm:text-xl md:text-2xl">
                        {t.main.title.before}
                        <span className="italic text-emerald-300">{t.main.title.emphasis}</span>
                        {t.main.title.after ?? ""}
                      </div>
                      <div className="mt-1 line-clamp-2 max-w-xl text-[11px] text-slate-400 sm:text-xs">
                        {t.main.subtitle}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                      {activeTask === 0 ? (
                        googleConnected === null ? (
                          <span className="inline-flex h-8 items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 text-[10px] text-slate-400 sm:h-9 sm:text-xs">
                            Calendar…
                          </span>
                        ) : googleConnected ? (
                          <span
                            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0 text-[10px] font-semibold text-emerald-200 sm:h-9 sm:px-2.5 sm:text-xs"
                            title="Google Calendar connected. Manage from My Classrooms."
                          >
                            <Check className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" aria-hidden />
                            Connected
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void startGoogleConnect()}
                            className="inline-flex h-8 items-center justify-center rounded-full border border-sky-400/35 bg-sky-500/10 px-3 text-[10px] font-semibold text-sky-100 hover:bg-sky-500/15 sm:h-9 sm:text-xs"
                          >
                            Connect Calendar
                          </button>
                        )
                      ) : null}
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-2 sm:px-4 sm:pb-3">
                    <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-[#0d0d1c] px-2.5 py-2 sm:rounded-2xl sm:px-3">
                      <div className="text-[10px] text-slate-400 sm:text-xs">Progress</div>
                      <div className="h-1 min-w-[100px] flex-1 overflow-hidden rounded-full bg-white/10 sm:h-1.5">
                        <div
                          className="h-full rounded-full bg-emerald-400 transition-[width]"
                          style={{ width: `${pctFor(activeTask)}%` }}
                        />
                      </div>
                      <div className="text-[10px] font-semibold text-emerald-200 sm:text-xs">
                        {stepIdx + 1}/{stepCount}
                      </div>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0d0d1c] sm:rounded-2xl">
                      <div className="flex w-full shrink-0 overflow-x-auto border-b border-white/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {t.main.stepTabs.map((tab, i) => (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => guardedJumpStep(activeTask, i)}
                            className={`inline-flex shrink-0 items-center gap-1.5 border-r border-white/10 px-2.5 py-2 text-[10px] font-semibold transition sm:gap-2 sm:px-3 sm:text-xs ${
                              i === stepIdx
                                ? "bg-emerald-500/10 text-emerald-200"
                                : i < stepIdx
                                  ? "text-slate-200/80 hover:bg-white/[0.03]"
                                  : "text-slate-400 hover:bg-white/[0.03]"
                            }`}
                          >
                            <span
                              className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-bold sm:h-5 sm:w-5 sm:text-[10px] ${
                                i < stepIdx
                                  ? "border-emerald-400 bg-emerald-400 text-black"
                                  : i === stepIdx
                                    ? "border-emerald-400 text-emerald-200"
                                    : "border-white/20 text-slate-400"
                              }`}
                            >
                              {i + 1}
                            </span>
                            <span className="max-w-[5.5rem] truncate sm:max-w-none">{tab}</span>
                          </button>
                        ))}
                      </div>

                      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-4">
                        <div className="text-sm font-semibold text-slate-100 sm:text-[15px]">
                          Step {stepIdx + 1} — {t.steps[stepIdx]?.label}
                        </div>
                        {activeTask === 0 ? (
                          <>
                            {stepIdx === 0 ? (
                              <div className="mt-2.5 grid gap-2 md:grid-cols-2 sm:mt-3 sm:gap-3">
                                <div className="md:col-span-2">
                                  <label className="mb-0.5 block text-xs font-semibold text-slate-300 sm:text-sm">
                                    Classroom name <span className="text-rose-300">*</span>
                                  </label>
                                  <input
                                    value={cwName}
                                    onChange={(e) => setCwName(e.target.value)}
                                    placeholder="e.g. JEE Advanced Batch A — 2026"
                                    className="h-9 w-full rounded-lg border border-white/15 bg-[#070b17] px-2.5 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400 sm:h-10 sm:rounded-xl sm:px-3"
                                  />
                                </div>
                                <div>
                                  <label className="mb-0.5 block text-xs font-semibold text-slate-300 sm:text-sm">
                                    Subject <span className="text-rose-300">*</span>
                                  </label>
                                  <select
                                    value={cwSubject}
                                    onChange={(e) =>
                                      setCwSubject(
                                        e.target.value as (typeof SUBJECT_OPTIONS)[number]
                                      )
                                    }
                                    className="h-9 w-full rounded-lg border border-white/15 bg-[#070b17] px-2.5 text-sm outline-none focus:border-emerald-400 sm:h-10 sm:rounded-xl sm:px-3"
                                  >
                                    {SUBJECT_OPTIONS.map((s) => (
                                      <option key={s} value={s}>
                                        {s}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="md:col-span-2 rounded-lg border border-emerald-400/15 bg-emerald-500/5 px-3 py-2 text-[11px] leading-snug text-slate-300 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-xs">
                                  Tip: Include batch (A/B), exam target, and year so students
                                  recognize the class.
                                </div>
                              </div>
                            ) : null}

                            {stepIdx === 1 ? (
                              <div className="mt-2.5 grid gap-2 md:grid-cols-2 sm:mt-3 sm:gap-3">
                                <div>
                                  <label className="mb-0.5 block text-xs font-semibold text-slate-300 sm:text-sm">
                                    PUC level <span className="text-rose-300">*</span>
                                  </label>
                                  <select
                                    value={cwPucLevel}
                                    onChange={(e) =>
                                      setCwPucLevel(e.target.value as (typeof PUC_OPTIONS)[number])
                                    }
                                    className="h-9 w-full rounded-lg border border-white/15 bg-[#070b17] px-2.5 text-sm outline-none focus:border-emerald-400 sm:h-10 sm:rounded-xl sm:px-3"
                                  >
                                    {PUC_OPTIONS.map((p) => (
                                      <option key={p} value={p}>
                                        {p}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="mb-0.5 block text-xs font-semibold text-slate-300 sm:text-sm">
                                    Primary exam target <span className="text-rose-300">*</span>
                                  </label>
                                  <select
                                    value={cwExamTarget}
                                    onChange={(e) =>
                                      setCwExamTarget(
                                        e.target.value as (typeof EXAM_OPTIONS)[number]
                                      )
                                    }
                                    className="h-9 w-full rounded-lg border border-white/15 bg-[#070b17] px-2.5 text-sm outline-none focus:border-emerald-400 sm:h-10 sm:rounded-xl sm:px-3"
                                  >
                                    {EXAM_OPTIONS.map((x) => (
                                      <option key={x} value={x}>
                                        {x}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                {/* Public access is enforced by backend; keep UI clean here. */}
                              </div>
                            ) : null}

                            {stepIdx === 2 ? (
                              <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
                                <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs leading-snug text-slate-300 sm:rounded-xl sm:px-4 sm:text-[13px]">
                                  <span className="font-semibold text-slate-100">
                                    Sections are optional.
                                  </span>{" "}
                                  Name a batch here only — no Google Calendar in this step. After
                                  launch, use{" "}
                                  <span className="font-medium text-emerald-200">Book live lesson</span>{" "}
                                  on the Students tab (Starter / Pro).
                                </div>

                                {canCalendarSeries ? (
                                  <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-3 py-2.5 text-xs text-sky-100/90">
                                    Your plan includes live lesson slots. Book each lesson individually
                                    after launch — we no longer create recurring Calendar series here.
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-2 rounded-xl border border-violet-500/25 bg-violet-500/[0.06] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                                    <div className="flex min-w-0 items-start gap-2.5">
                                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-400/25 bg-violet-500/10">
                                        <Lock className="h-4 w-4 text-violet-300" />
                                      </span>
                                      <div className="min-w-0 text-xs leading-relaxed text-slate-300">
                                        <p className="font-semibold text-violet-100">
                                          Live lessons need Starter or Pro
                                        </p>
                                        <p className="mt-0.5 text-slate-400">
                                          Free plan: save a batch name only. Upgrade to book Google
                                          Calendar + Meet slots per class.
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={goToTeacherSubscriptions}
                                      className="shrink-0 rounded-full bg-violet-500 px-4 py-2 text-[11px] font-bold text-white hover:bg-violet-400"
                                    >
                                      View plans
                                    </button>
                                  </div>
                                )}

                                <div className="grid gap-2 sm:gap-3">
                                  {cwSectionFormOpen ? (
                                    <div className="rounded-xl border border-white/10 bg-[#0d0d1c] p-3 sm:rounded-2xl sm:p-4">
                                      <div className="grid gap-2 sm:gap-3">
                                        <div>
                                          <label className="mb-0.5 block text-xs font-semibold text-slate-300 sm:text-sm">
                                            Section name <span className="text-rose-300">*</span>
                                          </label>
                                          <input
                                            value={cwSectionName}
                                            onChange={(e) => setCwSectionName(e.target.value)}
                                            placeholder="e.g. Morning batch, Section A"
                                            className="h-9 w-full rounded-lg border border-white/15 bg-[#070b17] px-3 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400 sm:h-10 sm:rounded-xl"
                                          />
                                        </div>

                                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                          <div className="text-xs text-slate-400">
                                            {cwSections.length}/1 section saved
                                          </div>
                                          <div className="flex gap-2">
                                            <button
                                              type="button"
                                              onClick={clearSectionFormAndDraft}
                                              className={`inline-flex items-center justify-center rounded-full border bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 ${
                                                highlightSectionClear
                                                  ? "border-emerald-400/70 ring-2 ring-emerald-400/35"
                                                  : "border-white/15"
                                              }`}
                                            >
                                              Clear
                                            </button>
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                const isVerified =
                                                  await ensureVerifiedForClassroomFlow();
                                                if (!isVerified) return;
                                                beginAddSectionDraft();
                                                setCwSectionFormOpen(false);
                                              }}
                                              className="inline-flex items-baseline justify-center gap-1 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
                                            >
                                              {cwSections[0] ? "Save changes" : "+ Add section"}
                                              {!cwSections[0] && createSectionRdmCompact ? (
                                                <span className="text-[10px] font-normal opacity-80">
                                                  {createSectionRdmCompact}
                                                </span>
                                              ) : null}
                                            </button>
                                          </div>
                                        </div>

                                        <div className="text-[11px] leading-snug text-slate-500 sm:text-xs">
                                          One batch name per class in this wizard. Calendar sync
                                          happens when you book a live lesson later — not as a repeating
                                          series here.
                                        </div>
                                      </div>
                                    </div>
                                  ) : null}

                                  {cwSections[0] ? (
                                    <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.06] p-3 sm:rounded-2xl sm:p-3.5">
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                                            Saved section
                                          </div>
                                          <div className="mt-1 text-sm font-semibold text-emerald-200">
                                            {cwSections[0].name}
                                          </div>
                                        </div>
                                        <div className="flex gap-2">
                                          <button
                                            type="button"
                                            onClick={loadSavedSectionIntoForm}
                                            className={`inline-flex items-center justify-center rounded-full border bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-white/10 sm:text-xs ${
                                              highlightSectionEdit
                                                ? "border-emerald-400/70 ring-2 ring-emerald-400/35"
                                                : "border-white/15"
                                            }`}
                                          >
                                            Edit
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setCwSections([]);
                                              setCwSectionName("");
                                              setCwSectionScheduleDate("");
                                              setCwSectionScheduleTime("");
                                              setCwSectionDurationMinutes(90);
                                              setCwSectionRepeatDays(["Mon", "Wed", "Fri"]);
                                              setCwSectionScheduleEndDate("");
                                              setCwSectionFormOpen(false);
                                            }}
                                            className="inline-flex items-center justify-center rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-100 hover:bg-rose-500/15 sm:text-xs"
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      </div>

                                      <p className="mt-2 text-[11px] leading-relaxed text-slate-400 sm:text-xs">
                                        {canCalendarSeries
                                          ? "After launch: Students tab → select this section → Book live lesson."
                                          : "Upgrade to Starter or Pro to book Google Calendar + Meet classes for this batch."}
                                      </p>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}

                            {stepIdx === 3 ? (
                              <div className="mt-3 space-y-3">
                                <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.06] p-3 sm:p-3.5">
                                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                                    Review
                                  </div>
                                  <div className="mt-2 grid gap-x-3 gap-y-1.5 text-[12px] text-slate-200 sm:grid-cols-2 sm:text-sm">
                                    <div className="min-w-0">
                                      <span className="text-slate-500">Name:</span>{" "}
                                      <span className="font-semibold">{cwName.trim() || "—"}</span>
                                    </div>
                                    <div className="min-w-0">
                                      <span className="text-slate-500">Subject:</span>{" "}
                                      <span className="font-semibold">{cwSubject}</span>
                                    </div>
                                    <div className="min-w-0">
                                      <span className="text-slate-500">PUC:</span>{" "}
                                      <span className="font-semibold">{cwPucLevel}</span>
                                    </div>
                                    <div className="min-w-0">
                                      <span className="text-slate-500">Exam:</span>{" "}
                                      <span className="font-semibold">{cwExamTarget}</span>
                                    </div>
                                    <div className="min-w-0 sm:col-span-2">
                                      <span className="text-slate-500">Section:</span>{" "}
                                      <span className="font-semibold">
                                        {cwSections[0]?.name ? cwSections[0].name : "None"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const isVerified = await ensureVerifiedForClassroomFlow();
                                    if (!isVerified) return;
                                    const sectionFormHasAny = Boolean(cwSectionName.trim());
                                    if (sectionFormHasAny && !Boolean(cwSections[0])) {
                                      openSectionGate({ kind: "launch" });
                                      return;
                                    }
                                    void createClassroomFromWizard();
                                  }}
                                  disabled={creating || !cwName.trim()}
                                  className="inline-flex w-full items-center justify-center gap-1 rounded-full bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-60 sm:text-sm"
                                >
                                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                  {creating ? "Launching..." : "Launch classroom"}
                                  {!creating && wizardLaunchRdmLabel ? (
                                    <span className="text-xs font-normal opacity-85">
                                      {wizardLaunchRdmLabel}
                                    </span>
                                  ) : null}
                                </button>
                              </div>
                            ) : null}
                          </>
                        ) : activeTask === 4 ? (
                          <TeacherNudgeWithRdmWizard
                            ref={nudgeWizardRef}
                            stepIdx={stepIdx}
                            teacherId={props.teacherId}
                            classrooms={props.classrooms}
                            classroomDetails={props.classroomDetails}
                            mockPostIdsAssignedThisWeek={props.mockPostIdsAssignedThisWeek}
                            mockNudgeLowScorersByPostId={props.mockNudgeLowScorersByPostId}
                            mockNudgeSubmittedAttemptsByPostId={
                              props.mockNudgeSubmittedAttemptsByPostId
                            }
                            onCreateAssignment={props.onCreateAssignment}
                            allowStructuredAssignmentCreate={
                              props.allowNudgeStructuredAssignmentCreate !== false
                            }
                            onRequireVerifiedAction={props.onRequireVerifiedAction}
                            onMotivateStudents={props.onMotivateStudents}
                            toast={props.toast}
                            onDone={() => setActiveTask(null)}
                            onJumpToStep={(i) => void guardedJumpStep(4, i)}
                          />
                        ) : activeTask === 6 ? (
                          <TeacherCounselStudentWizard
                            stepIdx={stepIdx}
                            classrooms={props.classrooms}
                            classroomDetails={props.classroomDetails}
                            onMotivateStudents={props.onMotivateStudents}
                            toast={props.toast}
                            onJumpToStep={(i) => guardedJumpStep(6, i)}
                            onDone={() => setActiveTask(null)}
                          />
                        ) : activeTask === 5 ? (
                          <TeacherAssignmentProgressWizard
                            variant="compact"
                            teacherId={props.teacherId}
                            classrooms={props.classrooms}
                            classroomDetails={props.classroomDetails}
                            onMotivateStudents={props.onMotivateStudents}
                            stepIdx={stepIdx}
                            toast={props.toast}
                            onDone={() => setActiveTask(null)}
                          />
                        ) : (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-300">
                            This task is not wired yet in the wizard. (Create classroom, assignment,
                            webinar scheduling, PDF tests, and assignment progress are wired.)
                          </div>
                        )}

                        <div className="mt-4 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
                          <div className="text-[11px] text-slate-400 sm:text-xs">
                            Step {stepIdx + 1} of {stepCount}
                          </div>
                          <div className="flex gap-2">
                            {activeTask === 0 ? (
                              <>
                                {stepIdx === 0 ? null : (
                                  <button
                                    type="button"
                                    onClick={prev}
                                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                                  >
                                    ← Prev
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void guardedNext()}
                                  disabled={stepIdx >= stepCount - 1}
                                  className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
                                >
                                  {stepIdx === 0 ? "Save classroom →" : "Next →"}
                                </button>
                              </>
                            ) : activeTask === 4 || activeTask === 6 ? (
                              stepIdx >= stepCount - 1 ? null : (
                                <button
                                  type="button"
                                  onClick={() => void guardedNext()}
                                  disabled={stepIdx >= stepCount - 1}
                                  className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
                                >
                                  {`Next: ${t.steps[stepIdx + 1]?.label ?? "Next"} →`}
                                </button>
                              )
                            ) : (
                              <button
                                type="button"
                                onClick={() => void guardedNext()}
                                disabled={stepIdx >= stepCount - 1}
                                className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
                              >
                                Next →
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>

        <Dialog open={googleGateOpen} onOpenChange={() => {}}>
          <DialogContent
            hideClose
            overlayClassName="z-[300]"
            onInteractOutside={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            className="z-[301] w-[94vw] max-w-xl rounded-3xl border border-white/15 bg-[#0f1329] p-0 text-slate-100 shadow-2xl"
          >
            <DialogHeader className="border-b border-white/10 p-4 pb-3 sm:p-5 sm:pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <DialogTitle className="font-serif text-xl sm:text-2xl">
                    Connect Google Calendar
                  </DialogTitle>
                  <p className="mt-1 text-sm text-slate-300">
                    Make sure to connect Google Calendar to work the class properly.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setGoogleGateOpen(false);
                    setGoogleGatePending(null);
                  }}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </DialogHeader>
            <div className="p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSessionFlag(GOOGLE_CONNECT_GATE_DISMISSED_SESSION_KEY, "1");
                    setGoogleGateOpen(false);
                    const pending = googleGatePending;
                    setGoogleGatePending(null);
                    if (!pending) return;
                    if (pending.kind === "next") next();
                    if (pending.kind === "jump") jumpStep(0, pending.stepIdx);
                    if (pending.kind === "addSection") beginAddSectionDraft();
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 text-sm font-semibold text-slate-200 hover:bg-white/10"
                >
                  Continue without connecting
                </button>
                <button
                  type="button"
                  onClick={() => void startGoogleConnect()}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-sky-500 px-5 text-sm font-semibold text-black hover:bg-sky-400"
                >
                  Connect Google Calendar
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={sectionGateOpen} onOpenChange={() => {}}>
          <DialogContent
            hideClose
            overlayClassName="z-[302]"
            onInteractOutside={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            className="z-[303] w-[94vw] max-w-lg rounded-3xl border border-white/15 bg-[#0f1329] p-0 text-slate-100 shadow-2xl"
          >
            <DialogHeader className="border-b border-white/10 p-4 pb-3 sm:p-5 sm:pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <DialogTitle className="font-serif text-xl sm:text-2xl">
                    Incomplete section details
                  </DialogTitle>
                  <p className="mt-1 text-sm text-slate-300">
                    You started typing section info. For a clean setup, either{" "}
                    <span className="font-semibold text-slate-100">Clear</span> it, or complete the
                    fields and click{" "}
                    <span className="font-semibold text-slate-100">“+ Add section”</span> to save.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSectionGateOpen(false);
                    setSectionGatePending(null);
                    setHighlightSectionClear(true);
                    window.setTimeout(() => setHighlightSectionClear(false), 4000);
                  }}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </DialogHeader>
            <div className="p-4 sm:p-5">
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3 text-sm text-slate-200">
                Tip: The <span className="font-semibold text-emerald-200">Clear</span> button is in
                Step 3 (Add sections). It’s highlighted for you.
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSectionGateOpen(false);
                    setSectionGatePending(null);
                    setHighlightSectionClear(true);
                    window.setTimeout(() => setHighlightSectionClear(false), 4000);
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 text-sm font-semibold text-slate-200 hover:bg-white/10"
                >
                  Go back & fix / save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const pending = sectionGatePending;
                    clearSectionFormAndDraft();
                    setSectionGateOpen(false);
                    setSectionGatePending(null);
                    if (!pending) return;
                    if (pending.kind === "next") next();
                    if (pending.kind === "launch") void createClassroomFromWizard();
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-500 px-5 text-sm font-semibold text-black hover:bg-emerald-400"
                >
                  Clear & continue
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={singleSectionGateOpen} onOpenChange={() => {}}>
          <DialogContent
            hideClose
            overlayClassName="z-[304]"
            onInteractOutside={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            className="z-[305] w-[94vw] max-w-lg rounded-3xl border border-white/15 bg-[#0f1329] p-0 text-slate-100 shadow-2xl"
          >
            <DialogHeader className="border-b border-white/10 p-4 pb-3 sm:p-5 sm:pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <DialogTitle className="font-serif text-xl sm:text-2xl">
                    Only one section per class
                  </DialogTitle>
                  <p className="mt-1 text-sm text-slate-300">
                    This class already has a saved section. To change it, click{" "}
                    <span className="font-semibold text-slate-100">Edit</span> and update the
                    details—don’t add a new one.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSingleSectionGateOpen(false);
                    setHighlightSectionEdit(true);
                    window.setTimeout(() => setHighlightSectionEdit(false), 4000);
                  }}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </DialogHeader>
            <div className="p-4 sm:p-5">
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3 text-sm text-slate-200">
                Tip: The <span className="font-semibold text-emerald-200">Edit</span> button is on
                the “Saved section” card below. It’s highlighted for you.
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSingleSectionGateOpen(false);
                    setHighlightSectionEdit(true);
                    window.setTimeout(() => setHighlightSectionEdit(false), 4000);
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 text-sm font-semibold text-slate-200 hover:bg-white/10"
                >
                  Got it
                </button>
                <button
                  type="button"
                  onClick={() => {
                    loadSavedSectionIntoForm();
                    setSingleSectionGateOpen(false);
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-500 px-5 text-sm font-semibold text-black hover:bg-emerald-400"
                >
                  Edit saved section
                </button>
              </div>
              <div className="mt-3 text-[11px] text-slate-500">
                If you truly need a different section, remove the saved one first and then add
                again.
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

/** Same localStorage key as assignment detail modal — shared submission score cache */
const TEACHER_ASSIGNMENT_SCORES_CACHE_LS = "teacherPortal.assignmentScoresCache.v1";

type TeacherWizardScoreRow = {
  userId: string;
  score: number;
  total: number;
  submittedAt: string | null;
};
