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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import InviteStudents from "@/components/InviteStudents";
import { useToast } from "@/hooks/use-toast";
import { useTopicTaxonomy } from "@/hooks/useTopicTaxonomy";
import { supabase } from "@/integrations/supabase/client";
import { safeGetSession } from "@/lib/safeSession";
import { fetchWithClientAuth } from "@/lib/clientApiAuth";
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
    scheduleEndDate?: string | null;
    allowAdhocTrial: boolean;
  }) => Promise<void>;
  onCreateAssignment: (input: {
    classroomId: string;
    sectionId?: string | null;
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
    sectionId?: string | null;
  }) => Promise<void>;
  onRewardTopStudents: (input: {
    classroomId: string;
    targetStudentIds: string[];
    message: string;
    rdmDelta: number;
    sectionId?: string | null;
  }) => Promise<void>;
  teacherId: string;
  onUpdateClassroom: (input: {
    classroomId: string;
    name: string;
    subject: string | null;
    section: string | null;
    introVideoUrl?: string | null;
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

type ClassroomCohortTab =
  | { kind: "class" }
  | { kind: "unassigned" }
  | { kind: "section"; id: string };

function StatCard(props: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#15162b] p-2.5 sm:p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{props.label}</div>
      <div className={`mt-1 font-serif text-2xl sm:text-3xl ${props.accent}`}>{props.value}</div>
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
const SHOW_CLASSROOM_SCHEDULE_FORM = false;

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

function formatAssignmentCardDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function primaryAssignmentBadge(item: TeacherPortalAssignmentItem): {
  label: string;
  color: string;
} {
  const tags = getAssignmentTags(item);
  return (
    tags[0] ?? {
      label: item.type,
      color: "bg-slate-500/20 text-slate-300 border-slate-400/30",
    }
  );
}

function visibleTaskCountForCard(item: TeacherPortalAssignmentItem): number {
  const tasks = item.tasks ?? [];
  const visible = tasks.filter((t) => t.visible_to_student).length;
  return visible > 0 ? visible : tasks.length;
}

function AssignmentCard({
  item,
  onOpen,
  progress,
}: {
  item: TeacherPortalAssignmentItem;
  onOpen: () => void;
  progress?: { completionPercent: number; completedCount: number; totalCount: number };
}) {
  const completionPercent = progress?.completionPercent ?? item.completionPercent;
  const completedCount = progress?.completedCount ?? item.completedCount;
  const totalCount = progress?.totalCount ?? item.totalCount;
  const badge = primaryAssignmentBadge(item);
  const dateLine =
    (formatAssignmentCardDate(item.dueDateIso) ?? item.dueDateLabel?.trim()) || "No due date";
  const title =
    item.type === "Concept Focus"
      ? `${item.chapterQuiz?.subtopicName ?? item.title} Complete`
      : item.title;
  const taskCount = visibleTaskCountForCard(item);
  const metaLine = `${taskCount} checklist task${taskCount === 1 ? "" : "s"} · ${item.assignedToLabel}`;
  const pct = Math.min(100, Math.max(0, Math.round(completionPercent)));

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full min-h-[160px] w-full flex-col rounded-2xl border border-white/10 bg-black/25 p-3.5 text-left shadow-[0_12px_32px_-18px_rgba(0,0,0,0.65)] transition hover:border-violet-400/30 hover:bg-black/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#15162b] sm:min-h-[188px] sm:p-4"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-xs font-medium tracking-tight text-violet-200/90">{dateLine}</span>
        <span
          className={`max-w-[52%] shrink-0 truncate rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.color}`}
        >
          {badge.label}
        </span>
      </div>
      <div className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-white">
        {title}
      </div>
      <p className="mt-2 line-clamp-1 text-[11px] leading-relaxed text-slate-400">{metaLine}</p>
      {item.rewardRdm > 0 ? (
        <p className="mt-0.5 text-[11px] text-amber-200/80">{item.rewardRdm} RDM reward</p>
      ) : null}
      <div className="min-h-2 flex-1" aria-hidden />
      <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-bold text-emerald-300">{completionPercent}%</span>
          <span className="shrink-0 text-[11px] text-slate-500">
            {completedCount}/{totalCount} done
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400/90 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="block text-[11px] font-semibold text-violet-300/90 group-hover:text-violet-200">
          View details →
        </span>
      </div>
    </button>
  );
}

const emptyClassroomDetail: TeacherPortalClassroomDetail = {
  classroomId: "",
  sections: [],
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
  const [rewardRdm, setRewardRdm] = useState(15);
  const [assignmentInstructions, setAssignmentInstructions] = useState("");
  const [sectionPickerStudentId, setSectionPickerStudentId] = useState<string | null>(null);
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
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
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

  useEffect(() => {
    if (!qpClassroom || classrooms.length === 0) return;
    if (!classrooms.some((c) => c.id === qpClassroom)) return;
    setActiveClassroomId(qpClassroom);
    if (qpDetail) setDetailTab(qpDetail);
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
        description: "Creating a class with a schedule will add Meet links to your calendar automatically.",
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

  useEffect(() => {
    setCohortTab({ kind: "class" });
  }, [activeClassroomId]);

  const cohortStudents = useMemo(() => {
    const roster = activeDetail.students.filter((s) => s.role !== "teacher");
    if (cohortTab.kind === "class") return roster;
    if (cohortTab.kind === "unassigned") return roster.filter((s) => s.sectionId == null);
    return roster.filter((s) => s.sectionId === cohortTab.id);
  }, [activeDetail.students, cohortTab]);

  const cohortAssignments = useMemo(() => {
    if (cohortTab.kind === "class") return activeDetail.assignments.filter((a) => a.sectionId == null);
    if (cohortTab.kind === "unassigned") return [];
    return activeDetail.assignments.filter((a) => a.sectionId === cohortTab.id);
  }, [activeDetail.assignments, cohortTab]);

  const cohortMotivationLog = useMemo(() => {
    if (cohortTab.kind === "class") return activeDetail.motivationLog.filter((m) => m.sectionId == null);
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
    setChapterQuizSel(initialChapterQuizSelection());
    setConceptFocusSel(initialConceptFocusSelection());
    setDailyDoseTrackId(DAILYDOSE_STREAK_TRACK_IDS[0]);
    setGyanTopicFocus("");
    setGyanSubtopicHint("");
    setAssignmentTargetSectionId(cohortTab.kind === "section" ? cohortTab.id : null);
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

          const totalStudents = cohortStudents.length;
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
  }, [assignmentDetail, activeClassroomId, cohortStudents.length, ASSIGNMENT_PROGRESS_CACHE_KEY]);

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
    if (!sectionScheduleDate.trim() || !sectionScheduleTime.trim()) {
      toast({
        title: "Schedule required",
        description: "Pick a start date and time for this section schedule.",
        variant: "destructive",
      });
      return;
    }
    setSectionCreating(true);
    try {
      const { data: created, error } = await supabase
        .from("classroom_sections" as any)
        .insert({
          classroom_id: activeClassroomId,
          name: sectionName,
          sort_order: activeDetail.sections.length,
        })
        .select("id")
        .single();
      const createdRow = created as { id?: string } | null;
      if (error || !createdRow?.id) throw error ?? new Error("Could not create section.");

      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const res = await fetchWithClientAuth(
        `/api/integrations/google/classrooms/${activeClassroomId}/recurring`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionId: createdRow.id,
            timeZone,
            scheduleDate: sectionScheduleDate,
            scheduleTime: sectionScheduleTime,
            durationMinutes: sectionDurationMinutes,
            repeatDays: sectionRepeatDays,
            scheduleEndDate: sectionScheduleEndDate.trim() || null,
          }),
        }
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Calendar sync failed (${res.status})`);
      }

      toast({ title: "Section created", description: "Schedule synced to Google Calendar." });
      setSectionDialogOpen(false);
      setNewSectionName("");
      setSectionScheduleDate("");
      setSectionScheduleTime("");
      setSectionScheduleEndDate("");
      setSectionDurationMinutes(90);
      setSectionRepeatDays(["Mon", "Wed", "Fri"]);
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
        `Delete section \"${sec?.name ?? "this section"}\"? Students in this section will become Unassigned. This cannot be undone.`
      );
    if (!ok) return;
    setSectionDeletingId(sectionId);
    try {
      const { error } = await supabase
        .from("classroom_sections" as any)
        .delete()
        .eq("id", sectionId)
        .eq("classroom_id", activeClassroomId);
      if (error) throw error;
      toast({ title: "Section deleted", description: "Students are now Unassigned." });
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
        sectionId: assignmentTargetSectionId,
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
        rdmDelta: motivationRdm,
        sectionId: cohortTab.kind === "section" ? cohortTab.id : null,
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
        rdmDelta: 35,
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
        description: "You can reconnect anytime; Meet links in EduBlast stay until you remove them.",
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
      const res = await fetchWithClientAuth(`/api/integrations/google/classrooms/${activeClassroom.id}/stop`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, sectionId: sectionId ?? null }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || `Request failed (${res.status})`);
      toast({
        title: mode === "delete_series" ? "Calendar series removed" : "Future classes stopped",
        description: "Google Calendar was updated. Refresh if Meet links still show cached values.",
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
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetchWithClientAuth("/api/integrations/google/start", {
                          method: "POST",
                          credentials: "include",
                        });
                        const payload = (await res.json().catch(() => ({}))) as {
                          url?: string;
                          error?: string;
                        };
                        if (!res.ok || !payload.url) {
                          throw new Error(payload.error || `Request failed (${res.status})`);
                        }
                        window.location.href = payload.url;
                      } catch (err) {
                        toast({
                          title: "Could not start Google connect",
                          description: err instanceof Error ? err.message : "Please try again.",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15 sm:px-4 sm:py-2.5 sm:text-sm"
                  >
                    Reconnect Google
                  </button>
                  <button
                    type="button"
                    disabled={googleDisconnecting}
                    onClick={() => void disconnectGoogleCalendar()}
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50 sm:px-4 sm:py-2.5 sm:text-sm"
                  >
                    {googleDisconnecting ? "Disconnecting…" : "Disconnect Google"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await fetchWithClientAuth("/api/integrations/google/start", {
                        method: "POST",
                        credentials: "include",
                      });
                      const payload = (await res.json().catch(() => ({}))) as {
                        url?: string;
                        error?: string;
                      };
                      if (!res.ok || !payload.url) {
                        throw new Error(payload.error || `Request failed (${res.status})`);
                      }
                      window.location.href = payload.url;
                    } catch (err) {
                      toast({
                        title: "Could not start Google connect",
                        description: err instanceof Error ? err.message : "Please try again.",
                        variant: "destructive",
                      });
                    }
                  }}
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
                New Classroom
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
        <div className="space-y-2.5 sm:space-y-3">
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
          <div className="flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-linear-to-b from-[#12172b] to-[#101426] p-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:p-5">
            <div className="min-w-0 flex-1">
              <div
                title={activeClassroom.name}
                className="font-serif text-xl leading-tight sm:text-[30px] lg:text-[36px] truncate"
              >
                {activeClassroom.name}
              </div>
              <div className="text-xs text-slate-400 sm:text-sm lg:text-base break-words">
                {(activeClassroom.subject ?? "General").trim()} ·{" "}
                {activeClassroom.section ?? "Section"} · {activeClassroom.studentCount} students ·{" "}
                {activeClassroom.scheduleLabel} · {activeClassroom.nextSessionLabel}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => setInviteDialogOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 px-3 text-xs font-semibold"
              >
                <UserPlus className="h-3.5 w-3.5" /> Invite Student
              </button>
              <button
                type="button"
                onClick={() => setAssignmentOpen(true)}
                disabled={cohortTab.kind === "unassigned"}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 px-3 text-xs font-semibold disabled:opacity-50"
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
                  {sec.scheduleLabel?.trim() || "No schedule set"}
                </span>
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
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10"
            >
              + Add section
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
              ) : null}
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
                                      const schedule =
                                        meta?.scheduleLabel?.trim() || "No schedule";
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
                                            <div className="truncate text-slate-100">
                                              {sec.name}
                                            </div>
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
                                onClick={() => openMotivation(s, recommendedAction(s))}
                                className={`h-6 rounded-full border px-2.5 text-[10px] font-semibold ${actionClass(recommendedAction(s))}`}
                              >
                                {actionLabel(recommendedAction(s))}
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
            <div className="rounded-xl border border-white/10 bg-[#15162b] p-3.5 sm:p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">Active Assignments</div>
                <button
                  type="button"
                  onClick={() => setAssignmentOpen(true)}
                  disabled={cohortTab.kind === "unassigned"}
                  className="rounded-full bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  + New Assignment
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
                {cohortAssignments.length === 0 ? (
                  <div className="col-span-full rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-slate-400">
                    {cohortTab.kind === "unassigned"
                      ? "Unassigned students do not receive section assignments. Assign students to a section first."
                      : "No assignments yet. Create your first assignment to start tracking completion."}
                  </div>
                ) : (
                  [...cohortAssignments]
                    .sort((a, b) => {
                      const da = a.dueDateIso ? new Date(a.dueDateIso).getTime() : 0;
                      const db = b.dueDateIso ? new Date(b.dueDateIso).getTime() : 0;
                      return db - da; // most recent first
                    })
                    .map((item) => (
                      <AssignmentCard
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
                        <div className="font-serif text-2xl sm:text-3xl text-emerald-300">{avgStreak}</div>
                        <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                          Avg streak
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-center">
                        <div className="font-serif text-2xl sm:text-3xl text-amber-300">{onStreakPct}%</div>
                        <div className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                          On streak
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-center">
                        <div className="font-serif text-2xl sm:text-3xl text-rose-300">{offStreak}</div>
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
              {cohortTab.kind === "section" ? (
                <div className="space-y-4">
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
                    {(() => {
                      const sec = activeDetail.sections.find((s) => s.id === cohortTab.id) ?? null;
                      if (!sec) {
                        return (
                          <div className="text-sm text-slate-400">
                            This section no longer exists. Switch back to Class settings.
                          </div>
                        );
                      }
                      return (
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <label className="block min-w-[240px] flex-1 text-xs font-medium text-slate-400">
                            Section name
                            <input
                              value={sectionNameDrafts[sec.id] ?? sec.name}
                              onChange={(e) =>
                                setSectionNameDrafts((prev) => ({ ...prev, [sec.id]: e.target.value }))
                              }
                              className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0c1020] px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500/50"
                            />
                          </label>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void saveSectionName(sec.id)}
                              disabled={sectionNameSavingId === sec.id || sectionDeletingId === sec.id}
                              className="rounded-full bg-violet-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                            >
                              {sectionNameSavingId === sec.id ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteSection(sec.id)}
                              disabled={sectionNameSavingId === sec.id || sectionDeletingId === sec.id}
                              className="rounded-full border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
                            >
                              {sectionDeletingId === sec.id ? "Deleting…" : "Delete section"}
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-white/10 bg-[#15162b] p-3.5 sm:p-4">
                    <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                      <Settings className="h-4 w-4 text-violet-300" />
                      Class settings
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
                  <div className="rounded-xl border border-white/10 bg-[#15162b] p-4 sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-white">Sections</div>
                      <button
                        type="button"
                        onClick={() => setSectionDialogOpen(true)}
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
                      >
                        + Add section
                      </button>
                    </div>
                    {activeDetail.sections.length === 0 ? (
                      <div className="text-sm text-slate-400">
                        No sections yet. Add a section to set a schedule and assign students.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeDetail.sections.map((sec) => (
                          <div
                            key={sec.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3"
                          >
                            <div className="min-w-[220px] flex-1">
                              <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                                Section name
                              </div>
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
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void saveSectionName(sec.id)}
                                disabled={sectionNameSavingId === sec.id || sectionDeletingId === sec.id}
                                className="rounded-full bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                              >
                                {sectionNameSavingId === sec.id ? "Saving…" : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteSection(sec.id)}
                                disabled={sectionNameSavingId === sec.id || sectionDeletingId === sec.id}
                                className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
                              >
                                {sectionDeletingId === sec.id ? "Deleting…" : "Delete section"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
              <div className="grid gap-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3 lg:items-stretch">
                <div className="flex h-full flex-col rounded-xl border border-white/10 bg-[#15162b] p-3.5 sm:p-4">
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
                {activeClassroom.googleMeetLink ||
                activeClassroom.googleSeriesLinked ||
                activeDetail.sections.some((s) => s.googleMeetLink || s.googleSeriesLinked) ? (
                  <div className="flex h-full flex-col rounded-xl border border-sky-500/25 bg-sky-500/5 p-3.5 sm:p-4 xl:col-span-2">
                    <div className="mb-2 text-sm font-semibold text-sky-200">Google Meet &amp; Calendar</div>
                    <p className="mb-3 text-xs text-slate-400">
                      Stopping updates Google Calendar; your EduBlast class stays until you delete it below.
                    </p>
                    <p className="mb-3 text-xs text-slate-400">
                      Invite enrolled students by email (from their login account). Run again after new students
                      join or move sections so Google can send calendar updates.
                    </p>
                    {(activeClassroom.googleMeetLink || activeClassroom.googleSeriesLinked) && (
                      <div className="mb-4 rounded-lg border border-white/10 bg-black/20 p-3">
                        <div className="mb-1 text-xs font-semibold text-slate-200">Classroom (legacy)</div>
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
                          <p className="mb-2 text-xs text-slate-400">Meet link will appear after the next calendar sync.</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={googleSeriesStopping || !activeClassroom.googleSeriesLinked}
                            onClick={() => void stopGoogleSeries("until_today", null)}
                            className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-500/20 disabled:opacity-50"
                          >
                            {googleSeriesStopping ? "Working…" : "Stop future dates"}
                          </button>
                          <button
                            type="button"
                            disabled={googleSeriesStopping || !activeClassroom.googleSeriesLinked}
                            onClick={() => void stopGoogleSeries("delete_series", null)}
                            className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
                          >
                            Delete Google series
                          </button>
                        </div>
                      </div>
                    )}
                    {activeDetail.sections
                      .filter((s) => s.googleMeetLink || s.googleSeriesLinked)
                      .map((sec) => (
                        <div
                          key={sec.id}
                          className="mb-4 rounded-lg border border-white/10 bg-black/20 p-3 last:mb-0"
                        >
                          <div className="mb-1 text-xs font-semibold text-slate-200">{sec.name}</div>
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
                            <p className="mb-2 text-xs text-slate-400">Meet link will appear after the next calendar sync.</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={googleSeriesStopping || !sec.googleSeriesLinked}
                              onClick={() => void stopGoogleSeries("until_today", sec.id)}
                              className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-500/20 disabled:opacity-50"
                            >
                              {googleSeriesStopping ? "Working…" : "Stop future dates"}
                            </button>
                            <button
                              type="button"
                              disabled={googleSeriesStopping || !sec.googleSeriesLinked}
                              onClick={() => void stopGoogleSeries("delete_series", sec.id)}
                              className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
                            >
                              Delete Google series
                            </button>
                          </div>
                        </div>
                      ))}
                    <button
                      type="button"
                      disabled={
                        googleInviteSyncing ||
                        (!activeClassroom.googleSeriesLinked &&
                          !activeDetail.sections.some((s) => s.googleSeriesLinked)) ||
                        activeDetail.students.length === 0
                      }
                      onClick={() => void syncStudentCalendarInvites()}
                      className="mb-1 mt-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      {googleInviteSyncing ? "Syncing invites…" : "Email calendar invites to students"}
                    </button>
                  </div>
                ) : null}
                <div className="flex h-full flex-col rounded-xl border border-rose-500/25 bg-rose-500/5 p-3.5 sm:p-4">
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
        <div className="grid gap-3 sm:gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {classrooms.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => setActiveClassroomId(room.id)}
              className="overflow-hidden rounded-2xl border border-white/10 bg-[#161629] text-left transition hover:-translate-y-0.5 hover:border-white/20"
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
                <div className="text-sm font-semibold">{room.name}</div>
                <div className="text-xs text-slate-400">
                  {(() => {
                    const subj = (room.subject ?? "General").trim();
                    return (subj.toLowerCase() === "mathematics" ? "Maths" : subj) + (room.section ? ` · ${room.section}` : "");
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
                  <div className="min-w-0 text-xs text-slate-400">
                    <span className="truncate">{room.nextSessionLabel}</span>
                    {room.nextMeetScopeLabel ? (
                      <span className="ml-2 inline-flex rounded bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                        {room.nextMeetScopeLabel}
                      </span>
                    ) : null}
                  </div>
                  <BookOpen className="h-4 w-4 text-slate-500" />
                </div>
                {room.nextMeetLink ? (
                  <a
                    href={room.nextMeetLink}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/20"
                  >
                    Join Meet <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[96vw] max-w-190 max-h-[92vh] overflow-y-auto rounded-3xl border border-white/20 bg-[#111428] p-0 text-slate-100">
          <DialogHeader className="border-b border-white/10 p-4 pb-3 sm:p-6 sm:pb-4">
            <DialogTitle className="font-serif text-2xl sm:text-3xl lg:text-4xl">
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
              className="rounded-full bg-emerald-500 px-6 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-40"
            >
              {submitting ? "Creating..." : "Create classroom"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent className="w-[96vw] max-w-190 max-h-[92vh] overflow-y-auto rounded-3xl border border-white/20 bg-[#111428] p-0 text-slate-100">
          <DialogHeader className="border-b border-white/10 p-4 pb-3 sm:p-6 sm:pb-4">
            <DialogTitle className="font-serif text-2xl sm:text-3xl lg:text-4xl">
              Add section
            </DialogTitle>
            <p className="mt-1 text-sm text-slate-400">
              Create a section (up to 6) and set its recurring schedule. This is what syncs to Google
              Calendar.
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
                placeholder="e.g. Section A"
                className="h-11 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400"
              />
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0d1121] p-4">
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Section schedule (easy calendar)
              </label>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="relative">
                  <input
                    type="date"
                    value={sectionScheduleDate}
                    onChange={(e) => setSectionScheduleDate(e.target.value)}
                    className="h-11 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none focus:border-emerald-400"
                  />
                </div>
                <div className="relative">
                  <input
                    type="time"
                    value={sectionScheduleTime}
                    onChange={(e) => setSectionScheduleTime(e.target.value)}
                    className="h-11 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none focus:border-emerald-400"
                  />
                </div>
                <div className="relative">
                  <select
                    value={String(sectionDurationMinutes)}
                    onChange={(e) => setSectionDurationMinutes(Number(e.target.value))}
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
                      onClick={() => toggleSectionRepeat(day)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        sectionRepeatDays.includes(day)
                          ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                          : "border-white/15 text-slate-400 hover:border-white/25 hover:text-slate-200"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  End date (optional)
                </label>
                <input
                  type="date"
                  value={sectionScheduleEndDate}
                  onChange={(e) => setSectionScheduleEndDate(e.target.value)}
                  className="h-11 w-full max-w-xs rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none focus:border-emerald-400"
                />
              </div>
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
              className="rounded-full bg-violet-500 px-6 py-2 text-sm font-semibold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-40"
            >
              {sectionCreating ? "Creating..." : "Create section"}
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
                        Audience
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
                      Assign to (class / section)
                    </label>
                    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <button
                        type="button"
                        onClick={() => setAssignmentTargetSectionId(null)}
                        className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs font-semibold ${
                          assignmentTargetSectionId == null
                            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                            : "border-white/10 bg-black/20 text-slate-300 hover:border-white/20"
                        }`}
                      >
                        <div className="text-slate-100">Class</div>
                        <div className="mt-0.5 text-[10px] font-semibold text-slate-500">
                          {activeDetail.students.filter((s) => s.role !== "teacher").length} students
                        </div>
                      </button>
                      {activeDetail.sections.map((sec) => (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => setAssignmentTargetSectionId(sec.id)}
                          className={`shrink-0 min-w-[180px] rounded-xl border px-3 py-2 text-left text-xs font-semibold ${
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
                    <p className="mt-1 text-[11px] text-slate-500">
                      Section assignments are only visible to students assigned to that section.
                    </p>
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

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="w-[96vw] max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-white/20 bg-[#0f1329] p-0 text-slate-100">
          <DialogHeader className="border-b border-white/10 p-4 pb-3 sm:p-6 sm:pb-4">
            <DialogTitle className="font-serif text-2xl sm:text-3xl">Invite students</DialogTitle>
            <p className="mt-1 text-sm text-slate-400">
              Share a join link/code, or directly add existing users.
            </p>
          </DialogHeader>
          <div className="p-4 sm:p-6">
            {activeClassroom?.id && activeClassroom.joinCode?.trim() ? (
              <InviteStudents classroomId={activeClassroom.id} joinCode={activeClassroom.joinCode} />
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-slate-300">
                Join code not available yet. Please refresh the page or open this classroom from the main classrooms list again.
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
          <DialogHeader className="border-b border-white/10 bg-linear-to-r from-[#111428] to-[#1a1f3d] p-4 pr-14 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <DialogTitle className="font-serif text-xl leading-tight sm:text-2xl lg:text-3xl">
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
                      /{cohortStudents.length}
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
                  {cohortStudents.length > 0
                    ? `${Math.round(
                        ((assignmentScores.length > 0
                          ? assignmentScores.length
                          : (assignmentProgressCacheRef.current[assignmentDetail.id]
                              ?.completedCount ?? assignmentDetail.completedCount)) /
                          Math.max(1, cohortStudents.length)) *
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
                                  {cohortStudents.length}{" "}
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
                    cohortStudents.length > assignmentScores.length ? (
                      <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/10 p-3">
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-300">
                          Pending submissions
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {cohortStudents
                            .filter((s) => !assignmentScores.some((score) => score.userId === s.userId))
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
