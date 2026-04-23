"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  Check,
  ChevronDown,
  ClipboardList,
  ExternalLink,
  Flame,
  Loader2,
  Plus,
  Settings,
  Star,
  UserPlus,
  WandSparkles,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useTopicTaxonomy } from "@/hooks/useTopicTaxonomy";
import { supabase } from "@/integrations/supabase/client";
import { safeGetSession } from "@/lib/safeSession";
import {
  buildDefaultTasksForAssignmentType,
  normalizeTaskPositions,
  type AssignmentTaskStored,
} from "@/lib/classroom/assignmentTasks";
import ChapterQuizAssignmentFields from "@/components/teacher-portal/ChapterQuizAssignmentFields";
import ConceptFocusAssignmentFields, {
  type ConceptFocusSelectionState,
  initialConceptFocusSelection,
  conceptFocusSelectionComplete,
} from "@/components/teacher-portal/ConceptFocusAssignmentFields";
import DailyDoseStreakAssignmentFields from "@/components/teacher-portal/DailyDoseStreakAssignmentFields";
import GyanEngagementAssignmentFields from "@/components/teacher-portal/GyanEngagementAssignmentFields";
import { fetchMockPapersFromSupabase } from "@/lib/mockPapersFromSupabase";
import {
  chapterQuizSelectionComplete,
  chapterQuizToRef,
  initialChapterQuizSelection,
  type ChapterQuizSelectionState,
} from "@/lib/teacherPortal/chapterQuizUtils";
import {
  DAILYDOSE_STREAK_TRACK_IDS,
  trackLabelById,
  type DailyDoseStreakTrackId,
} from "@/lib/teacherPortal/dailyDoseStreakTracks";
import type {
  TeacherPortalAssignmentItem,
  TeacherPortalClassroomCard,
  TeacherPortalClassroomDetail,
  TeacherPortalClassroomStudent,
  TeacherPortalChapterQuizRef,
  TeacherPortalDailyDoseStreakRef,
  TeacherPortalGyanEngagementRef,
  TeacherPortalMockPaperRef,
  TeacherPortalSummary,
} from "@/lib/teacherPortal/types";
import type { MockPaper } from "@/types";

interface MyClassroomViewProps {
  summary: TeacherPortalSummary;
  classrooms: TeacherPortalClassroomCard[];
  classroomDetails: Record<string, TeacherPortalClassroomDetail>;
  onCreateClassroom: (input: {
    name: string;
    subject: string;
    pucLevel: "PUC 1" | "PUC 2" | "Both";
    examTarget: string;
    scheduleDate: string | null;
    scheduleTime: string | null;
    durationMinutes: number;
    repeatDays: string[];
    allowAdhocTrial: boolean;
  }) => Promise<void>;
  onCreateAssignment: (input: {
    classroomId: string;
    assignmentType: string;
    title: string;
    dueDate: string | null;
    assignToLabel: string;
    rewardRdm: number;
    instructions: string;
    tasks?: AssignmentTaskStored[];
    mockPaper?: TeacherPortalMockPaperRef | null;
    chapterQuiz?: TeacherPortalChapterQuizRef | null;
    dailyDoseStreak?: TeacherPortalDailyDoseStreakRef | null;
    gyanEngagement?: TeacherPortalGyanEngagementRef | null;
  }) => Promise<void>;
  onMotivateStudents: (input: {
    classroomId: string;
    actionKind: "boost" | "nudge" | "urgent_nudge";
    targetStudentIds: string[];
    message: string;
    rdmDelta: number;
  }) => Promise<void>;
  onRewardTopStudents: (input: {
    classroomId: string;
    targetStudentIds: string[];
    message: string;
    rdmDelta: number;
  }) => Promise<void>;
  teacherId: string;
  onUpdateClassroom: (input: {
    classroomId: string;
    name: string;
    subject: string | null;
    section: string | null;
  }) => Promise<void>;
  onDeleteClassroom: (input: { classroomId: string }) => Promise<void>;
  /** Reload portal bundle; use `{ silent: true }` from polling so the page does not flash the loading state. */
  onRefreshTeacherPortal: (opts?: { silent?: boolean }) => Promise<void>;
}

type JoinRequestRow = {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  profiles: { name: string } | null;
};

function StatCard(props: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#15162b] p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{props.label}</div>
      <div className={`mt-1 font-serif text-3xl ${props.accent}`}>{props.value}</div>
      <div className="text-xs text-slate-400">{props.sub}</div>
    </div>
  );
}

const SUBJECT_OPTIONS = [
  "Physics",
  "Chemistry",
  "Mathematics",
  "Physics + Maths",
  "Full PCM",
] as const;
const PUC_OPTIONS = ["PUC 1", "PUC 2", "Both"] as const;
const EXAM_OPTIONS = [
  "JEE Advanced",
  "JEE Main",
  "KCET",
  "CBSE Board",
  "State Board",
  "NEET",
] as const;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type DetailTab = "students" | "assignments" | "progress" | "streaks" | "settings";
type MotivationMessageType = "streak_reengagement" | "top_performer" | "custom";
type MotivationTarget = string;

function initials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "ST"
  );
}

function formatOptionalPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value)}%`;
}

function statusPill(status: "active" | "off_streak" | "at_risk"): string {
  if (status === "active") return "text-emerald-300";
  if (status === "off_streak") return "text-rose-300";
  return "text-amber-300";
}

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.max(1, Math.round(ms / (1000 * 60 * 60)));
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function recommendedAction(
  student: TeacherPortalClassroomStudent
): "boost" | "nudge" | "urgent_nudge" {
  if (student.status === "at_risk") return "urgent_nudge";
  if (student.status === "off_streak" || student.streakDays <= 2) return "nudge";
  return "boost";
}

function actionLabel(action: "boost" | "nudge" | "urgent_nudge"): string {
  if (action === "urgent_nudge") return "Urgent nudge";
  if (action === "nudge") return "Nudge";
  return "Boost";
}

function actionClass(action: "boost" | "nudge" | "urgent_nudge"): string {
  if (action === "urgent_nudge") return "border-rose-400/30 bg-rose-500/10 text-rose-200";
  if (action === "nudge") return "border-amber-400/30 bg-amber-500/10 text-amber-200";
  return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
}

function messageTemplate(
  action: "boost" | "nudge" | "urgent_nudge",
  type: MotivationMessageType,
  targetLabel: string
): string {
  if (type === "top_performer") {
    return `Brilliant work this week ${targetLabel}! You are consistently among the top performers. Keep this momentum and earn +25 RDM.`;
  }
  if (type === "custom") {
    return `${targetLabel}, keep your learning momentum going.`;
  }
  if (action === "urgent_nudge") {
    return `Hey ${targetLabel}, your streak is at risk. Come back today, complete one focused task, and earn +10 RDM.`;
  }
  return `Hey ${targetLabel}! You have not been active recently. Your last score was strong - do not let the streak break. Come back and earn +10 RDM.`;
}

function getAssignmentTags(item: TeacherPortalAssignmentItem) {
  const tags: Array<{ label: string; color: string }> = [];
  const hasTest = item.tasks.some((t) => t.href?.includes("/assignment-test/"));
  const hasMock = item.mockPaper || item.tasks.some((t) => t.href?.includes("/mock"));
  const hasGyan = item.gyanEngagement || item.tasks.some((t) => t.kind === "gyan_engagement");
  const hasDailyDose = item.dailyDoseStreak || item.tasks.some((t) => t.kind === "daily_dose");
  const hasChapterQuiz = item.chapterQuiz || item.tasks.some((t) => t.kind === "chapter_quiz");

  if (hasTest) tags.push({ label: "MCQ", color: "bg-sky-500/20 text-sky-300 border-sky-400/30" });
  if (hasMock)
    tags.push({ label: "Test", color: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30" });
  if (hasGyan)
    tags.push({ label: "Gyan++", color: "bg-violet-500/20 text-violet-300 border-violet-400/30" });
  if (hasDailyDose)
    tags.push({ label: "DailyDose", color: "bg-amber-500/20 text-amber-300 border-amber-400/30" });
  if (hasChapterQuiz)
    tags.push({
      label: item.type === "Concept Focus" ? "Subtopic" : "Chapter Quiz",
      color: "bg-pink-500/20 text-pink-300 border-pink-400/30",
    });
  if (tags.length === 0)
    tags.push({ label: item.type, color: "bg-slate-500/20 text-slate-300 border-slate-400/30" });

  return tags;
}

function AssignmentRow({
  item,
  onOpen,
  progress,
}: {
  item: TeacherPortalAssignmentItem;
  onOpen: () => void;
  progress?: { completionPercent: number; completedCount: number; totalCount: number };
}) {
  const tags = getAssignmentTags(item);
  const completionPercent = progress?.completionPercent ?? item.completionPercent;
  const completedCount = progress?.completedCount ?? item.completedCount;
  const totalCount = progress?.totalCount ?? item.totalCount;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-left transition hover:border-white/20 hover:bg-black/30"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-200">
        📘
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-semibold">
            {item.type === "Concept Focus"
              ? `${item.chapterQuiz?.subtopicName ?? item.title} Complete`
              : item.title}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {tags.map((t) => (
              <span
                key={t.label}
                className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold ${t.color}`}
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>
        <div className="text-xs text-slate-400">
          {item.dueDateLabel} · {item.assignedToLabel}
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold text-emerald-300">{completionPercent}%</div>
        <div className="text-[11px] text-slate-500">
          {completedCount}/{totalCount}
        </div>
      </div>
    </button>
  );
}

const emptyClassroomDetail: TeacherPortalClassroomDetail = {
  classroomId: "",
  students: [],
  assignments: [],
  motivationLog: [],
  topStreakStudentIds: [],
};

export default function MyClassroomView({
  summary,
  classrooms,
  classroomDetails,
  onCreateClassroom,
  onCreateAssignment,
  onMotivateStudents,
  onRewardTopStudents,
  teacherId,
  onUpdateClassroom,
  onDeleteClassroom,
  onRefreshTeacherPortal,
}: MyClassroomViewProps) {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const qpClassroom = searchParams.get("classroom");
  const qpDetailRaw = searchParams.get("portalDetail");
  const qpDetail: DetailTab | null =
    qpDetailRaw === "students" ||
    qpDetailRaw === "assignments" ||
    qpDetailRaw === "progress" ||
    qpDetailRaw === "streaks" ||
    qpDetailRaw === "settings"
      ? qpDetailRaw
      : null;
  const [activeClassroomId, setActiveClassroomId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("students");
  const [open, setOpen] = useState(false);
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
  const [motivationRdm, setMotivationRdm] = useState(10);
  const [assignmentDetail, setAssignmentDetail] = useState<TeacherPortalAssignmentItem | null>(
    null
  );
  const [assignmentScores, setAssignmentScores] = useState<
    Array<{
      userId: string;
      score: number;
      total: number;
      submittedAt: string | null;
    }>
  >([]);
  const [assignmentScoresLoading, setAssignmentScoresLoading] = useState(false);
  const [assignmentScoresError, setAssignmentScoresError] = useState<string | null>(null);

  const [rewardSubmitting, setRewardSubmitting] = useState(false);
  const assignmentProgressCacheRef = useRef<
    Record<string, { completionPercent: number; completedCount: number; totalCount: number }>
  >({});
  const ASSIGNMENT_PROGRESS_CACHE_KEY = "teacherPortal.assignmentProgressCache.v1";
  const [assignmentProgressCacheVersion, setAssignmentProgressCacheVersion] = useState(0);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState<(typeof SUBJECT_OPTIONS)[number]>("Physics");
  const [pucLevel, setPucLevel] = useState<(typeof PUC_OPTIONS)[number]>("PUC 1");
  const [examTarget, setExamTarget] = useState<(typeof EXAM_OPTIONS)[number]>("JEE Advanced");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [repeatDays, setRepeatDays] = useState<string[]>(["Mon", "Wed", "Fri"]);
  const [allowAdhocTrial, setAllowAdhocTrial] = useState(true);
  const [assignmentType, setAssignmentType] = useState("Mock Paper (full length)");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentDueDate, setAssignmentDueDate] = useState("");
  const [assignToLabel, setAssignToLabel] = useState("All students");
  const [rewardRdm, setRewardRdm] = useState(15);
  const [assignmentInstructions, setAssignmentInstructions] = useState("");
  const [settingsName, setSettingsName] = useState("");
  const [settingsSubject, setSettingsSubject] = useState("");
  const [settingsSection, setSettingsSection] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsDeleting, setSettingsDeleting] = useState(false);
  const [joinRequests, setJoinRequests] = useState<JoinRequestRow[]>([]);
  const [actingJoinRequestId, setActingJoinRequestId] = useState<string | null>(null);
  const [mockPapers, setMockPapers] = useState<MockPaper[]>([]);
  const [mockPapersLoading, setMockPapersLoading] = useState(false);
  const [mockPapersLoadError, setMockPapersLoadError] = useState<string | null>(null);
  const [selectedMockPaperId, setSelectedMockPaperId] = useState<string | null>(null);
  const [chapterQuizSel, setChapterQuizSel] = useState<ChapterQuizSelectionState>(() =>
    initialChapterQuizSelection()
  );
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

  const isMockAssignmentTemplate = assignmentType.toLowerCase().includes("mock");
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

  const resetForm = () => {
    setName("");
    setSubject("Physics");
    setPucLevel("PUC 1");
    setExamTarget("JEE Advanced");
    setScheduleDate("");
    setScheduleTime("");
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
        scheduleDate: scheduleDate || null,
        scheduleTime: scheduleTime || null,
        durationMinutes,
        repeatDays,
        allowAdhocTrial,
      });
      toast({
        title: "Classroom created",
        description: "Students can now see it in Explore (unless your profile is Invite-only).",
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

  useEffect(() => {
    if (!qpClassroom || classrooms.length === 0) return;
    if (!classrooms.some((c) => c.id === qpClassroom)) return;
    setActiveClassroomId(qpClassroom);
    if (qpDetail) setDetailTab(qpDetail);
  }, [qpClassroom, qpDetail, classrooms]);
  const activeDetail = activeClassroomId
    ? (classroomDetails[activeClassroomId] ?? emptyClassroomDetail)
    : emptyClassroomDetail;

  useEffect(() => {
    if (!activeClassroom) return;
    setSettingsName(activeClassroom.name);
    setSettingsSubject(activeClassroom.subject ?? "");
    setSettingsSection(activeClassroom.section ?? "");
  }, [activeClassroom]);

  useEffect(() => {
    if (!assignmentOpen) return;
    setChapterQuizSel(initialChapterQuizSelection());
    setConceptFocusSel(initialConceptFocusSelection());
    setDailyDoseTrackId(DAILYDOSE_STREAK_TRACK_IDS[0]);
    setGyanTopicFocus("");
    setGyanSubtopicHint("");
  }, [assignmentOpen]);

  useEffect(() => {
    if (!isQuizAssignmentTemplate) {
      setChapterQuizSel(initialChapterQuizSelection());
    }
    if (!isConceptFocusTemplate) {
      setConceptFocusSel(initialConceptFocusSelection());
    }
  }, [isQuizAssignmentTemplate, isConceptFocusTemplate]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ASSIGNMENT_PROGRESS_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return;
      assignmentProgressCacheRef.current = parsed as Record<
        string,
        { completionPercent: number; completedCount: number; totalCount: number }
      >;
      setAssignmentProgressCacheVersion((v) => v + 1);
    } catch {
      assignmentProgressCacheRef.current = {};
      setAssignmentProgressCacheVersion((v) => v + 1);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        ASSIGNMENT_PROGRESS_CACHE_KEY,
        JSON.stringify(assignmentProgressCacheRef.current)
      );
    } catch {
      // Ignore storage write failures (private mode/quota)
    }
  }, [assignmentDetail, activeClassroomId, assignmentScores]);

  useEffect(() => {
    if (!assignmentDetail || !activeClassroomId) return;
    const hasGeneratedTest = assignmentDetail.tasks?.some(
      (t) =>
        t.kind === "chapter_quiz" ||
        t.href?.includes("/assignment-test/") ||
        t.href?.includes("panel=quiz")
    );
    if (!hasGeneratedTest) {
      setAssignmentScores([]);
      setAssignmentScoresError(null);
      return;
    }
    let cancelled = false;
    setAssignmentScoresLoading(true);
    setAssignmentScoresError(null);
    const load = async () => {
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
          const scores = data.scores ?? [];
          setAssignmentScores(scores);

          const totalStudents = activeDetail.students.filter((s) => s.role !== "teacher").length;
          const completedCount = scores.length;
          const completionPercent =
            totalStudents > 0 ? Math.round((completedCount / Math.max(1, totalStudents)) * 100) : 0;

          assignmentProgressCacheRef.current[assignmentDetail.id] = {
            completionPercent,
            completedCount,
            totalCount: totalStudents,
          };
          setAssignmentProgressCacheVersion((v) => v + 1);

          try {
            window.localStorage.setItem(
              ASSIGNMENT_PROGRESS_CACHE_KEY,
              JSON.stringify(assignmentProgressCacheRef.current)
            );
          } catch {
            // Ignore storage write failures
          }
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
  }, [assignmentDetail, activeClassroomId, activeDetail.students, ASSIGNMENT_PROGRESS_CACHE_KEY]);

  useEffect(() => {
    if (!assignmentOpen) return;
    let cancelled = false;
    setMockPapersLoading(true);
    setMockPapersLoadError(null);
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
    const id = window.setInterval(() => void tick(), 8000);
    return () => window.clearInterval(id);
  }, [activeClassroomId, detailTab, onRefreshTeacherPortal, refetchJoinRequests]);

  const approveJoinRequest = async (req: JoinRequestRow) => {
    if (!activeClassroomId || !teacherId) return;
    setActingJoinRequestId(req.id);
    const { error: insertErr } = await supabase
      .from("classroom_members")
      .insert({ classroom_id: activeClassroomId, user_id: req.user_id, role: "student" });
    if (insertErr) {
      toast({ title: "Could not approve", description: insertErr.message, variant: "destructive" });
      setActingJoinRequestId(null);
      return;
    }
    await supabase
      .from("classroom_join_requests")
      .update({
        status: "approved",
        responded_at: new Date().toISOString(),
        responded_by: teacherId,
      })
      .eq("id", req.id);
    setJoinRequests((prev) => prev.filter((r) => r.id !== req.id));
    await onRefreshTeacherPortal({ silent: true });
    toast({
      title: "Student added",
      description: `${req.profiles?.name ?? "Student"} can access this class now.`,
    });
    setActingJoinRequestId(null);
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
            "Select class, subject, chapter, topic, subtopic, and difficulty (including Set 1–3 for Advanced).",
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
        assignmentType: derivedType,
        title: assignmentTitle,
        dueDate: assignmentDueDate || null,
        assignToLabel,
        rewardRdm,
        instructions: assignmentInstructions,
        tasks: defaultTasks.length ? defaultTasks : undefined,
        mockPaper: derivedType === "mock" ? (mockPaper ?? null) : undefined,
        chapterQuiz:
          derivedType === "quiz" || derivedType === "Concept Focus" ? chapterQuizRef : undefined,
        dailyDoseStreak: dailyDoseStreak ?? undefined,
        gyanEngagement: gyanEngagement ?? undefined,
      });
      await onRefreshTeacherPortal({ silent: true });
      window.setTimeout(() => {
        void onRefreshTeacherPortal({ silent: true });
      }, 1200);
      setAssignmentOpen(false);
      setAssignmentTitle("");
      setAssignmentDueDate("");
      setAssignmentInstructions("");
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
    setMotivationMessage(messageTemplate(action, defaultType, student.name));
    setMotivationRdm(action === "boost" ? 25 : action === "urgent_nudge" ? 10 : 10);
    setMotivationOpen(true);
  };

  const submitMotivation = async () => {
    if (!activeClassroomId) return;
    const classroomStudents = activeDetail.students.filter((student) => student.role !== "teacher");
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
        rdmDelta: motivationRdm,
      });
      setMotivationOpen(false);
      setSelectedStudent(null);
    } finally {
      setMotivationSubmitting(false);
    }
  };

  const rewardTopStudents = async () => {
    if (!activeClassroomId || !activeDetail.topStreakStudentIds.length) return;
    setRewardSubmitting(true);
    try {
      await onRewardTopStudents({
        classroomId: activeClassroomId,
        targetStudentIds: activeDetail.topStreakStudentIds,
        message: "Rewarded top tier students for highest streak consistency.",
        rdmDelta: 35,
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

  const removeClassroom = async () => {
    if (!activeClassroom || !teacherId) return;
    const ok =
      typeof window !== "undefined" &&
      window.confirm(
        `Delete "${activeClassroom.name}"? Students lose access and enrollments are removed. This cannot be undone.`
      );
    if (!ok) return;
    setSettingsDeleting(true);
    try {
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

  const selectClassName =
    "h-10 w-full appearance-none rounded-xl border border-white/15 bg-[#070b17] px-3 pr-10 text-sm outline-none focus:border-emerald-400";

  return (
    <div className="space-y-4 sm:space-y-6">
      {!activeClassroom ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-serif text-3xl leading-tight sm:text-5xl">
                My <span className="text-emerald-400 italic">Classrooms</span>
              </h1>
              <p className="text-sm text-slate-400 sm:text-base">
                Create and manage your student batches — assign tasks, track progress and motivate
                students.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs text-slate-200 hover:bg-white/5 sm:px-4 sm:py-2.5 sm:text-sm"
              >
                <Star className="h-4 w-4" />
                Send Group RDM
              </button>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-3 py-2 text-xs font-semibold text-black hover:bg-emerald-400 sm:px-4 sm:py-2.5 sm:text-sm"
              >
                <Plus className="h-4 w-4" />
                New Classroom
              </button>
            </div>
          </div>

          <div className="grid gap-3.5 md:grid-cols-4">
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
              value={formatOptionalPercent(summary.avgCompletionPercent)}
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
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              setActiveClassroomId(null);
              setDetailTab("students");
            }}
            className="text-xs text-slate-400 hover:text-white"
          >
            &larr; Back to classrooms
          </button>
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-white/10 bg-linear-to-b from-[#12172b] to-[#101426] p-4 sm:p-5">
            <div>
              <div className="font-serif text-[30px] leading-tight sm:text-[42px]">
                {activeClassroom.name}
              </div>
              <div className="text-sm text-slate-400 sm:text-base">
                {(activeClassroom.subject ?? "General").trim()} ·{" "}
                {activeClassroom.section ?? "Section"} · {activeClassroom.studentCount} students ·{" "}
                {activeClassroom.scheduleLabel} · {activeClassroom.nextSessionLabel}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 px-3 text-xs font-semibold"
              >
                <UserPlus className="h-3.5 w-3.5" /> Invite Student
              </button>
              <button
                type="button"
                onClick={() => setAssignmentOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 px-3 text-xs font-semibold"
              >
                <BookOpen className="h-3.5 w-3.5" /> Set Assignment
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-emerald-500 px-3 text-xs font-semibold text-black"
              >
                <WandSparkles className="h-3.5 w-3.5" /> Send RDM Boost
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
                label: `Students (${activeDetail.students.filter((s) => s.role !== "teacher").length})`,
              },
              {
                key: "assignments" as const,
                label: `Assignments (${activeDetail.assignments.length})`,
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
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 sm:p-5">
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
                  Students who tap &quot;Request to join&quot; from Explore show up here before they
                  appear in Enrolled Students.
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
              <div className="rounded-xl border border-white/10 bg-[#15162b] p-4 sm:p-5">
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
                  {activeDetail.students.filter((s) => s.role !== "teacher").length === 0 ? (
                    <div className="text-sm text-slate-400">
                      No students enrolled yet.
                      <span className="mt-1 block text-xs text-slate-500">
                        Approve a join request above (or invite with your join code from Settings) —
                        the roster also refreshes automatically.
                      </span>
                    </div>
                  ) : (
                    activeDetail.students
                      .filter((s) => s.role !== "teacher")
                      .map((s) => (
                        <div
                          key={s.userId}
                          className="grid grid-cols-[1.2fr_0.7fr_0.6fr_0.5fr_0.5fr_0.5fr_1.4fr] items-center gap-2 rounded-lg border border-white/10 bg-[#111529] px-3 py-2.5 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/15 text-[11px] font-bold text-violet-200">
                              {initials(s.name)}
                            </div>
                            <div>
                              <div className="font-semibold">{s.name}</div>
                              <div className="text-[11px] text-slate-500">
                                {activeClassroom.section ?? "PUC"}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-slate-400">
                            {s.lastActiveAt ? formatRelativeTime(s.lastActiveAt) : "—"}
                          </div>
                          <div
                            className={`font-semibold ${s.avgScorePercent == null ? "text-slate-500" : "text-amber-300"}`}
                          >
                            {formatOptionalPercent(s.avgScorePercent)}
                          </div>
                          <div className="text-slate-300">{s.streakDays} days</div>
                          <div className="font-semibold text-violet-300">{s.rdm}</div>
                          <div className={statusPill(s.status)}>
                            {s.status === "off_streak"
                              ? "Off-streak"
                              : s.status === "at_risk"
                                ? "At risk"
                                : "Active"}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => openMotivation(s, recommendedAction(s))}
                              className={`h-6 rounded-full border px-2.5 text-[10px] font-semibold ${actionClass(recommendedAction(s))}`}
                            >
                              {actionLabel(recommendedAction(s))}
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
          {detailTab === "assignments" ? (
            <div className="rounded-xl border border-white/10 bg-[#15162b] p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">Active Assignments</div>
                <button
                  type="button"
                  onClick={() => setAssignmentOpen(true)}
                  className="rounded-full bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  + New Assignment
                </button>
              </div>
              <div className="space-y-2">
                {activeDetail.assignments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-slate-400">
                    No assignments yet. Create your first assignment to start tracking completion.
                  </div>
                ) : (
                  [...activeDetail.assignments]
                    .sort((a, b) => {
                      const da = a.dueDateIso ? new Date(a.dueDateIso).getTime() : 0;
                      const db = b.dueDateIso ? new Date(b.dueDateIso).getTime() : 0;
                      return db - da; // most recent first
                    })
                    .map((item) => (
                      <AssignmentRow
                        key={item.id}
                        item={item}
                        progress={
                          assignmentProgressCacheVersion >= 0 &&
                          assignmentProgressCacheRef.current[item.id]
                            ? { ...assignmentProgressCacheRef.current[item.id] }
                            : undefined
                        }
                        onOpen={() => setAssignmentDetail(item)}
                      />
                    ))
                )}
              </div>
            </div>
          ) : null}
          {detailTab === "progress" ? (
            <div className="rounded-xl border border-white/10 bg-[#15162b] p-5">
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
            <div className="rounded-xl border border-white/10 bg-[#15162b] p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">Streaks &amp; RDM distribution</div>
                <button
                  type="button"
                  onClick={() => void rewardTopStudents()}
                  disabled={rewardSubmitting || activeDetail.topStreakStudentIds.length === 0}
                  className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Flame className="mr-1 inline h-3.5 w-3.5" />
                  Reward Top Tier Students
                </button>
              </div>
              <div className="mb-3 grid grid-cols-4 gap-2">
                {(() => {
                  const roster = activeDetail.students.filter((s) => s.role !== "teacher");
                  if (activeClassroom.isDemoShowcase) {
                    return (
                      <>
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-center">
                          <div className="font-serif text-3xl text-emerald-300">18</div>
                          <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                            Avg streak
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-center">
                          <div className="font-serif text-3xl text-amber-300">79%</div>
                          <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                            On streak
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-center">
                          <div className="font-serif text-3xl text-rose-300">4</div>
                          <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                            Off-streak
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-center">
                          <div className="font-serif text-3xl text-violet-300">
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
                        <div className="font-serif text-3xl text-emerald-300">{avgStreak}</div>
                        <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                          Avg streak
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-center">
                        <div className="font-serif text-3xl text-amber-300">{onStreakPct}%</div>
                        <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                          On streak
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-center">
                        <div className="font-serif text-3xl text-rose-300">{offStreak}</div>
                        <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                          Off-streak
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-center">
                        <div className="font-serif text-3xl text-violet-300">
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
                  {activeDetail.topStreakStudentIds
                    .map((id) => activeDetail.students.find((s) => s.userId === id)?.name)
                    .filter(Boolean)
                    .join(", ") || "No streak leaders yet"}
                </div>
                {activeDetail.motivationLog.length === 0 ? (
                  <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-400">
                    No motivation actions yet.
                  </div>
                ) : (
                  activeDetail.motivationLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                    >
                      <span className="font-semibold">
                        {entry.actionKind.replaceAll("_", " ")} ·{" "}
                      </span>
                      {entry.message}
                      <div className="text-xs text-slate-500">
                        {formatRelativeTime(entry.createdAt)} · +{entry.rdmDelta} RDM
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
          {detailTab === "settings" && activeClassroom ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-[#15162b] p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                  <Settings className="h-4 w-4 text-violet-300" />
                  Classroom details
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
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
                    Section / batch label (optional)
                    <input
                      value={settingsSection}
                      onChange={(e) => setSettingsSection(e.target.value)}
                      placeholder="e.g. Section A, PUC 2"
                      className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0c1020] px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-violet-500/50"
                    />
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
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
              <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
                <div className="flex h-full flex-col rounded-xl border border-white/10 bg-[#15162b] p-4 sm:p-5">
                  <div className="mb-3 text-sm font-semibold text-white">
                    Join &amp; student view
                  </div>
                  <p className="mb-3 text-xs text-slate-400">
                    Share the join code with students, or open the classroom page to preview what
                    they see (assignments, live tab, etc.).
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
                <div className="flex h-full flex-col rounded-xl border border-rose-500/25 bg-rose-500/5 p-4 sm:p-5">
                  <div className="mb-2 text-sm font-semibold text-rose-200">Danger zone</div>
                  <p className="mb-3 text-xs text-slate-400">
                    Deleting removes this classroom from your portal and revokes student access.
                    Past assignment posts may remain in the system depending on your data policy.
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
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {classrooms.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => setActiveClassroomId(room.id)}
              className="overflow-hidden rounded-2xl border border-white/10 bg-[#161629] text-left transition hover:-translate-y-0.5 hover:border-white/20"
            >
              <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
                <div className="font-serif text-2xl text-slate-500">
                  {room.subject?.slice(0, 8) ?? "CLASS"}
                </div>
                <span className="rounded bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-300">
                  Active
                </span>
              </div>
              <div className="space-y-2 px-4 py-3">
                <div className="text-sm font-semibold">{room.name}</div>
                <div className="text-xs text-slate-400">
                  {(room.subject ?? "General").trim()} {room.section ? `· ${room.section}` : ""}
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
                      {formatOptionalPercent(room.avgScorePercent)}
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
                  <div className="text-xs text-slate-400">{room.nextSessionLabel}</div>
                  <BookOpen className="h-4 w-4 text-slate-500" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[96vw] max-w-190 max-h-[92vh] overflow-y-auto rounded-3xl border border-white/20 bg-[#111428] p-0 text-slate-100">
          <DialogHeader className="border-b border-white/10 p-4 pb-3 sm:p-6 sm:pb-4">
            <DialogTitle className="font-serif text-3xl sm:text-4xl">
              Create a new classroom
            </DialogTitle>
            <p className="mt-1 text-sm text-slate-400">
              A classroom is a dedicated space for one batch of students.
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
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="h-11 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none focus:border-emerald-400"
                  />
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
            </div>
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
              className="rounded-full bg-emerald-500 px-6 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-40"
            >
              {submitting ? "Creating..." : "Create classroom"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen}>
        <DialogContent
          className={`flex flex-col overflow-hidden border-white/20 bg-[#0f1329] p-0 text-slate-100 sm:rounded-3xl ${
            isMockAssignmentTemplate ||
            isQuizAssignmentTemplate ||
            isConceptFocusTemplate ||
            isDailyDoseAssignmentTemplate ||
            isGyanEngagementTemplate
              ? "max-h-[min(92vh,820px)] max-w-270"
              : "max-h-[90vh] max-w-180"
          }`}
        >
          <DialogHeader className="shrink-0 border-b border-white/10 p-4 pb-3 sm:p-5 sm:pb-4">
            <DialogTitle className="font-serif text-2xl sm:text-3xl">Set assignment</DialogTitle>
            <p className="mt-1 text-sm text-slate-400">
              Pick a template and details. A default activity checklist is created from the type so
              students can track progress; class completion updates in Assignments.
            </p>
          </DialogHeader>

          {isMockAssignmentTemplate ||
          isQuizAssignmentTemplate ||
          isConceptFocusTemplate ||
          isDailyDoseAssignmentTemplate ||
          isGyanEngagementTemplate ? (
            <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-white/10 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
              {/* Left “page”: assignment details */}
              <div className="flex min-h-0 flex-col lg:max-h-[min(72vh,700px)]">
                <div className="border-b border-white/5 px-4 py-2 sm:px-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Assignment
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Title, due date, class scope, and notes
                  </p>
                </div>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 sm:p-5">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-300">
                      Assignment type *
                    </label>
                    <div className="relative">
                      <select
                        value={assignmentType}
                        onChange={(e) => setAssignmentType(e.target.value)}
                        className={selectClassName}
                      >
                        <option>Mock Paper (full length)</option>
                        <option>Chapter Quiz (MCQs)</option>
                        <option>Concept Focus</option>
                        <option>DailyDose Streak Challenge</option>
                        <option>Gyan++ engagement</option>
                        <option>Custom Assignment</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-300">
                      Title *
                    </label>
                    <input
                      value={assignmentTitle}
                      onChange={(e) => setAssignmentTitle(e.target.value)}
                      placeholder="e.g. Electrostatics — Gauss's Law Quiz"
                      className="h-11 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-300">
                        Due date *
                      </label>
                      <input
                        type="date"
                        value={assignmentDueDate}
                        onChange={(e) => setAssignmentDueDate(e.target.value)}
                        className="h-11 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-300">
                        Assign to
                      </label>
                      <div className="relative">
                        <select
                          value={assignToLabel}
                          onChange={(e) => setAssignToLabel(e.target.value)}
                          className={selectClassName}
                        >
                          <option>All students</option>
                          <option>Top performers</option>
                          <option>Off-streak students</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-300">
                      RDM reward for completion
                    </label>
                    <div className="relative">
                      <select
                        value={String(rewardRdm)}
                        onChange={(e) => setRewardRdm(Number(e.target.value))}
                        className={selectClassName}
                      >
                        <option value="15">+15 RDM (standard)</option>
                        <option value="25">+25 RDM (medium)</option>
                        <option value="40">+40 RDM (high value)</option>
                        <option value="50">+50 RDM (special)</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-300">
                      Instructions to students
                    </label>
                    <textarea
                      value={assignmentInstructions}
                      onChange={(e) => setAssignmentInstructions(e.target.value)}
                      rows={4}
                      placeholder="Add any specific instructions, hints, or context for students..."
                      className="w-full rounded-xl border border-white/15 bg-[#070b17] px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400"
                    />
                  </div>
                </div>
              </div>

              {/* Right “page”: mock paper or chapter quiz path */}
              <div className="flex min-h-0 flex-col lg:max-h-[min(72vh,700px)]">
                <div className="border-b border-white/5 px-4 py-2 sm:px-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {isMockAssignmentTemplate
                      ? "Mock test"
                      : isQuizAssignmentTemplate
                        ? "Chapter quiz"
                        : isGyanEngagementTemplate
                          ? "Gyan++"
                          : "DailyDose streak"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {isMockAssignmentTemplate
                      ? "Pick the published paper students should attempt."
                      : isQuizAssignmentTemplate
                        ? "Walk class → subject → chapter → lesson → subtopic, then practice set."
                        : isGyanEngagementTemplate
                          ? "Optional lesson focus; students post doubts from the checklist link."
                          : "Choose which of the five Funbrain streak lanes this class should focus on; the task links to Play."}
                  </p>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
                  {isMockAssignmentTemplate ? (
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-300">
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
                    </div>
                  ) : isQuizAssignmentTemplate ? (
                    <ChapterQuizAssignmentFields
                      taxonomy={curriculumTaxonomy}
                      taxonomyLoading={curriculumLoading}
                      taxonomyError={curriculumError}
                      value={chapterQuizSel}
                      onChange={setChapterQuizSel}
                      selectClassName={selectClassName}
                    />
                  ) : isConceptFocusTemplate ? (
                    <ConceptFocusAssignmentFields
                      taxonomy={curriculumTaxonomy}
                      taxonomyLoading={curriculumLoading}
                      taxonomyError={curriculumError}
                      value={conceptFocusSel}
                      onChange={setConceptFocusSel}
                      selectClassName={selectClassName}
                    />
                  ) : isGyanEngagementTemplate ? (
                    <GyanEngagementAssignmentFields
                      topicFocus={gyanTopicFocus}
                      subtopicHint={gyanSubtopicHint}
                      onTopicFocusChange={setGyanTopicFocus}
                      onSubtopicHintChange={setGyanSubtopicHint}
                    />
                  ) : (
                    <DailyDoseStreakAssignmentFields
                      selectedTrackId={dailyDoseTrackId}
                      onSelectTrack={setDailyDoseTrackId}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-h-[min(78vh,640px)] space-y-3 overflow-y-auto overscroll-contain p-4 sm:p-5">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-300">
                  Assignment type *
                </label>
                <div className="relative">
                  <select
                    value={assignmentType}
                    onChange={(e) => setAssignmentType(e.target.value)}
                    className={selectClassName}
                  >
                    <option>Mock Paper (full length)</option>
                    <option>Chapter Quiz (MCQs)</option>
                    <option>Concept Focus</option>
                    <option>DailyDose Streak Challenge</option>
                    <option>Gyan++ engagement</option>
                    <option>Custom Assignment</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-300">Title *</label>
                <input
                  value={assignmentTitle}
                  onChange={(e) => setAssignmentTitle(e.target.value)}
                  placeholder="e.g. Electrostatics — Gauss's Law Quiz"
                  className="h-11 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-300">
                    Due date *
                  </label>
                  <input
                    type="date"
                    value={assignmentDueDate}
                    onChange={(e) => setAssignmentDueDate(e.target.value)}
                    className="h-11 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-300">
                    Assign to
                  </label>
                  <div className="relative">
                    <select
                      value={assignToLabel}
                      onChange={(e) => setAssignToLabel(e.target.value)}
                      className={selectClassName}
                    >
                      <option>All students</option>
                      <option>Top performers</option>
                      <option>Off-streak students</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-300">
                  RDM reward for completion
                </label>
                <div className="relative">
                  <select
                    value={String(rewardRdm)}
                    onChange={(e) => setRewardRdm(Number(e.target.value))}
                    className={selectClassName}
                  >
                    <option value="15">+15 RDM (standard)</option>
                    <option value="25">+25 RDM (medium)</option>
                    <option value="40">+40 RDM (high value)</option>
                    <option value="50">+50 RDM (special)</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-300">
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

          <div className="flex shrink-0 flex-col-reverse items-stretch justify-end gap-3 border-t border-white/10 p-4 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setAssignmentOpen(false)}
              className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5 sm:min-w-27.5"
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
                    !chapterQuizSelectionComplete(chapterQuizSel, curriculumTaxonomy)))
              }
              className="rounded-full bg-violet-500 px-6 py-2 text-sm font-semibold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-40"
            >
              {assignmentSubmitting ? "Creating..." : "Create assignment"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={motivationOpen} onOpenChange={setMotivationOpen}>
        <DialogContent className="w-[94vw] max-w-160 rounded-[22px] border border-white/20 bg-[#12162a] p-0 text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
          <DialogHeader className="border-b border-white/10 px-5 py-3.5">
            <DialogTitle className="font-serif text-[30px] leading-[1.05] tracking-tight text-white">
              <span className="mr-2 text-amber-300">☆</span>
              Send personalised motivation + RDM
            </DialogTitle>
            <p className="mt-1 text-[14px] leading-snug text-slate-400">
              Send a custom motivational message and bonus RDM to re-engage or celebrate a student.
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
                        messageTemplate(motivationAction, motivationMessageType, label)
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
                    setMotivationMessage(messageTemplate(motivationAction, type, label));
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
            <div>
              <label className="mb-1 block text-[15px] font-semibold text-slate-300">
                RDM bonus to award
              </label>
              <div className="relative">
                <select
                  value={String(motivationRdm)}
                  onChange={(e) => setMotivationRdm(Number(e.target.value))}
                  className={`${selectClassName} h-11 rounded-xl border-white/15 bg-[#0b1020] text-[15px]`}
                >
                  <option value="10">+10 RDM (streak re-engagement)</option>
                  <option value="25">+25 RDM (performance milestone)</option>
                  <option value="50">+50 RDM (special recognition)</option>
                  <option value="5">+5 RDM (daily encouragement)</option>
                  <option value="0">No RDM - message only</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-[14px] leading-snug font-semibold text-amber-200">
              ⚡ RDM bonuses from teachers are credited instantly to the student&apos;s balance and
              appear in their EduFund progress.
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
              {motivationSubmitting ? "Sending..." : "Send message + RDM"}
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
          }
        }}
      >
        <DialogContent className="max-h-[90vh] w-[94vw] max-w-190 overflow-hidden rounded-3xl border border-white/20 bg-[#0f1329] p-0 text-slate-100 shadow-2xl">
          <DialogHeader className="border-b border-white/10 bg-linear-to-r from-[#111428] to-[#1a1f3d] p-5 pr-14">
            <div className="flex items-start justify-between gap-3">
              <DialogTitle className="font-serif text-2xl leading-tight sm:text-3xl">
                {assignmentDetail?.title ?? "Assignment details"}
              </DialogTitle>
              {assignmentDetail ? (
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {(() => {
                    const tags = getAssignmentTags(assignmentDetail);
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
            <div className="max-h-[calc(90vh-100px)] overflow-y-auto overflow-x-hidden">
              <div className="grid min-w-0 gap-4 p-5 text-sm">
                {/* Quick Info Grid */}
                <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border border-white/10 bg-[#151b35] p-3 text-center">
                    <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                      Type
                    </div>
                    <div className="mt-1 font-semibold capitalize text-sky-300">
                      {assignmentDetail.type}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#151b35] p-3 text-center">
                    <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                      Due
                    </div>
                    <div className="mt-1 font-semibold text-slate-200">
                      {assignmentDetail.dueDateLabel}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#151b35] p-3 text-center">
                    <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                      Submitted
                    </div>
                    <div className="mt-1 font-semibold text-emerald-300">
                      {assignmentScores.length > 0
                        ? assignmentScores.length
                        : (assignmentProgressCacheRef.current[assignmentDetail.id]
                            ?.completedCount ?? assignmentDetail.completedCount)}
                      /{activeDetail.students.filter((s) => s.role !== "teacher").length}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#151b35] p-3 text-center">
                    <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                      Avg Score
                    </div>
                    <div className="mt-1 font-semibold text-violet-300">
                      {assignmentScores.length > 0
                        ? `${
                            Math.round(
                              (assignmentScores.reduce(
                                (acc, s) => acc + (s.total > 0 ? (s.score / s.total) * 100 : 0),
                                0
                              ) /
                                assignmentScores.length) *
                                10
                            ) / 10
                          }%`
                        : `${
                            assignmentProgressCacheRef.current[assignmentDetail.id]
                              ?.completionPercent ?? assignmentDetail.completionPercent
                          }%`}
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#121833] px-4 py-3 text-xs text-slate-300">
                  <span className="font-semibold text-slate-200">Assigned to:</span>{" "}
                  {assignmentDetail.assignedToLabel}
                  <span className="mx-2 text-slate-500">•</span>
                  <span className="font-semibold text-amber-300">Reward:</span> +
                  {assignmentDetail.rewardRdm} RDM
                  <span className="mx-2 text-slate-500">•</span>
                  <span className="font-semibold text-sky-300">Completion:</span>{" "}
                  {activeDetail.students.filter((s) => s.role !== "teacher").length > 0
                    ? `${Math.round(
                        ((assignmentScores.length > 0
                          ? assignmentScores.length
                          : (assignmentProgressCacheRef.current[assignmentDetail.id]
                              ?.completedCount ?? assignmentDetail.completedCount)) /
                          Math.max(
                            1,
                            activeDetail.students.filter((s) => s.role !== "teacher").length
                          )) *
                          100
                      )}%`
                    : "0%"}
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
                      <BookOpen className="h-4 w-4" /> Chapter Quiz
                    </div>
                    <div className="mt-2 font-semibold text-slate-100">
                      Class {assignmentDetail.chapterQuiz.classLevel} ·{" "}
                      {assignmentDetail.chapterQuiz.subject} ·{" "}
                      {assignmentDetail.chapterQuiz.subtopicName}
                    </div>
                    <div className="mt-1 text-[11px] leading-relaxed text-slate-400">
                      Chapter: {assignmentDetail.chapterQuiz.chapterTitle || "(not set)"} · Lesson:{" "}
                      {assignmentDetail.chapterQuiz.topic}
                      {assignmentDetail.chapterQuiz.advancedSet
                        ? ` · Set ${assignmentDetail.chapterQuiz.advancedSet}`
                        : ""}
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
                        Students complete this via the Gyan++ checklist link.
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Instructions */}
                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-[#151b35] to-[#11152a] p-5">
                  <div className="absolute left-0 top-0 h-full w-1 bg-amber-500/40" />
                  <div className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-amber-400/80">
                    <ClipboardList className="h-4 w-4 text-amber-400/70" />
                    Teacher&apos;s Instructions
                  </div>
                  <div className="text-sm leading-relaxed text-slate-200">
                    {assignmentDetail.instructions}
                  </div>
                </div>

                {/* Tasks */}
                {assignmentDetail.tasks?.length ? (
                  <div className="rounded-xl border border-white/10 bg-[#151b35] p-4">
                    <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                      <Check className="h-4 w-4" /> Tasks ({assignmentDetail.tasks.length})
                    </div>
                    <div className="grid gap-2">
                      {assignmentDetail.tasks.map((t, i) => (
                        <div
                          key={t.id}
                          className="flex items-start gap-3 rounded-lg border border-white/5 bg-black/20 p-3 transition hover:border-white/10"
                        >
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[11px] font-bold text-violet-300">
                            {i + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-slate-200">
                                {assignmentDetail.type === "Concept Focus"
                                  ? t.kind === "topic_path"
                                    ? "Spend atleast 10 minutes on this sub topic"
                                    : t.kind === "chapter_quiz"
                                      ? "Answer all questions in the Quiz even if it's wrong"
                                      : t.kind === "instacue"
                                        ? "Scroll and see all Insta Que cards"
                                        : t.kind === "bits"
                                          ? "Click all formulae and practice the numerals"
                                          : t.label
                                  : t.label}
                              </span>
                              {!t.visible_to_student ? (
                                <span className="rounded border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                                  Hidden
                                </span>
                              ) : null}
                              {t.reward_rdm != null && t.reward_rdm > 0 ? (
                                <span className="rounded border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                                  +{t.reward_rdm} RDM
                                </span>
                              ) : null}
                              {t.kind === "chapter_quiz" ? (
                                <span className="rounded border border-sky-400/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
                                  {assignmentScores.length}/
                                  {activeDetail.students.filter((s) => s.role !== "teacher").length}{" "}
                                  submitted
                                </span>
                              ) : null}
                            </div>
                            {t.href && assignmentDetail.type !== "Concept Focus" ? (
                              <div className="mt-1 flex items-center gap-2">
                                <a
                                  href={t.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[11px] font-semibold text-violet-300 hover:bg-violet-500/20"
                                >
                                  <ExternalLink className="h-3 w-3" /> Open task link
                                </a>
                                <span
                                  className="max-w-90 truncate text-[11px] text-slate-500"
                                  title={t.href}
                                >
                                  {t.href}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Student Scores */}
                {assignmentDetail.tasks?.some(
                  (t) =>
                    t.kind === "chapter_quiz" ||
                    t.href?.includes("/assignment-test/") ||
                    t.href?.includes("panel=quiz")
                ) ? (
                  <div className="rounded-xl border border-white/10 bg-[#151b35] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                        <Star className="h-4 w-4" /> Student Scores
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">
                          {assignmentScores.length} submitted
                        </span>
                        {assignmentScoresLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        ) : null}
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
                        <div className="sticky top-0 z-10 grid grid-cols-[1fr_auto_auto] gap-2 border-b border-white/10 bg-[#1a1f3d] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:grid-cols-[1fr_auto_auto_auto]">
                          <div>Student</div>
                          <div className="text-right">Score</div>
                          <div className="text-right">%</div>
                          <div className="hidden text-right sm:block">When</div>
                        </div>
                        <div className="divide-y divide-white/5">
                          {assignmentScores.map((s) => {
                            const rosterStudent = activeDetail.students.find(
                              (st) => st.userId === s.userId
                            );
                            const studentName = rosterStudent?.name ?? "Student";
                            const pct = Math.round((s.score / Math.max(1, s.total)) * 100);
                            return (
                              <div
                                key={s.userId}
                                className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2.5 transition hover:bg-white/2 sm:grid-cols-[1fr_auto_auto_auto]"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${pct >= 80 ? "bg-emerald-500/15 text-emerald-300" : pct >= 60 ? "bg-amber-500/15 text-amber-300" : "bg-rose-500/15 text-rose-300"}`}
                                  >
                                    {initials(studentName)}
                                  </div>
                                  <span className="truncate text-sm font-medium text-slate-200">
                                    {studentName}
                                  </span>
                                </div>
                                <div className="text-right text-sm font-bold text-emerald-300">
                                  {s.score}/{s.total}
                                </div>
                                <div
                                  className={`text-right text-[11px] font-bold ${pct >= 80 ? "text-emerald-400" : pct >= 60 ? "text-amber-400" : "text-rose-400"}`}
                                >
                                  {pct}%
                                </div>
                                <div className="hidden items-center justify-end gap-2 sm:flex">
                                  {s.submittedAt ? (
                                    <span className="text-[10px] text-slate-500">
                                      {formatRelativeTime(s.submittedAt)}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {!assignmentScoresLoading &&
                    activeDetail.students.filter((s) => s.role !== "teacher").length >
                      assignmentScores.length ? (
                      <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/10 p-3">
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-300">
                          Pending submissions
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {activeDetail.students
                            .filter(
                              (s) =>
                                s.role !== "teacher" &&
                                !assignmentScores.some((score) => score.userId === s.userId)
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
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
