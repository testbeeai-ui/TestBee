"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
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
import GeneratedMcqReview from "@/components/classroom/GeneratedMcqReview";
import { getAdvancedSetBounds } from "@/lib/advancedQuizSets";
import { fetchSubtopicContent } from "@/lib/subtopicContentService";
import MeetSessionsStack from "@/components/teacher-portal/MeetSessionsStack";
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
import CreateAssignmentWizard from "@/components/teacher-portal/CreateAssignmentWizard";
import ScheduleLiveSessionPanel from "@/components/teacher-portal/ScheduleLiveSessionPanel";
import type { ScheduleLiveSessionPayload } from "@/components/teacher-portal/ScheduleLiveSessionPanel";
import CreateTestsView from "@/components/teacher-portal/CreateTestsView";
import {
  fetchMockPapersFromSupabase,
  fetchMockQuestionsForPaper,
} from "@/lib/mockPapersFromSupabase";
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
  TeacherPortalClassroomSection,
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
    targetStudentIds?: string[] | null;
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
    relatedPostId?: string;
    relatedPostTitle?: string;
    recommendActionId?: "attempt_targeted_mock" | "post_doubt" | "watch_recorded" | "none";
    recommendActionLabel?: string;
    recommendActionUrl?: string;
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
  /** Schedule live session (same payload as My Classes → createSession). */
  onScheduleLiveSession: (input: ScheduleLiveSessionPayload) => Promise<void>;
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

type WizardTask = {
  emoji: string;
  emojiBorderBgClass: string;
  title: string;
  steps: { label: string }[];
  main: {
    badge: string;
    title: { before: string; emphasis: string; after?: string };
    subtitle: string;
    stepTabs: string[];
  };
};

const WIZARD_TASKS: WizardTask[] = [
  {
    emoji: "🏫",
    emojiBorderBgClass: "border-emerald-400/25 bg-emerald-500/10",
    title: "Create a classroom, add sections & invite students",
    steps: [
      { label: "Name your classroom & set subject" },
      { label: "Choose PUC level & exam target" },
      { label: "Add sections (real schedule + calendar sync)" },
      { label: "Search & invite specific students" },
      { label: "Review & launch classroom" },
    ],
    main: {
      badge: "🏫 Task 1 of 7 · Create classroom",
      title: { before: "Create your ", emphasis: "classroom" },
      subtitle: "Set up a new classroom batch, add sections, and invite students — all in 5 steps.",
      stepTabs: [
        "Name & Subject",
        "Level & Target",
        "Add Sections",
        "Invite Students",
        "Review & Launch",
      ],
    },
  },
  {
    emoji: "📝",
    emojiBorderBgClass: "border-violet-400/25 bg-violet-500/10",
    title: "Create an assignment & assign to students or sections",
    steps: [
      { label: "Choose assignment type & topic" },
      { label: "Configure questions, marks & time" },
      { label: "Assign to — student / section / full class" },
      { label: "Set due date, RDM reward & publish" },
    ],
    main: {
      badge: "📝 Task 2 of 7 · Create assignment",
      title: { before: "Create an ", emphasis: "assignment" },
      subtitle:
        "Build a quiz, mock, or routine challenge and assign it to exactly who needs it — in 4 steps.",
      stepTabs: ["Type & Topic", "Configure", "Assign To", "Due Date & Publish"],
    },
  },
  {
    emoji: "📅",
    emojiBorderBgClass: "border-sky-400/25 bg-sky-500/10",
    title: "Schedule a lesson / webinar — let students register interest",
    steps: [
      { label: "Title & classroom" },
      { label: "Date, time & Google Meet" },
      { label: "Pre-work resources" },
      { label: "Post-work assignment" },
      { label: "Trial & publish" },
    ],
    main: {
      badge: "📅 Task 3 of 7 · Schedule lesson",
      title: { before: "Schedule a ", emphasis: "lesson / webinar" },
      subtitle:
        "Five steps with a top stepper — same scheduling logic as My Classes (calendar, Meet, pre/post work).",
      stepTabs: [
        "Title & Classroom",
        "Date & Meet",
        "Pre-work",
        "Post-work",
        "Trial & Publish",
      ],
    },
  },
  {
    emoji: "📄",
    emojiBorderBgClass: "border-amber-400/25 bg-amber-500/10",
    title: "Create an offline test paper as PDF — assign or email",
    steps: [
      { label: "Choose exam — CBSE / KCET / JEE" },
      { label: "Select class, scope & subject" },
      { label: "Questions — count & presets" },
      { label: "Source & duration, then generate" },
      { label: "Preview PDF, download, print, or assign" },
    ],
    main: {
      badge: "📄 Task 4 of 7 · PDF test paper",
      title: { before: "Create an offline ", emphasis: "PDF test paper" },
      subtitle:
        "Generate a print-ready test paper and download or email it to students — in 5 steps.",
      stepTabs: ["Exam Type", "Class & Scope", "Questions", "Source & Duration", "Generate"],
    },
  },
  {
    emoji: "🎯",
    emojiBorderBgClass: "border-amber-400/25 bg-amber-500/10",
    title: "Nudge students with RDM rewards to study or attempt tests",
    steps: [
      { label: "Choose who to nudge" },
      { label: "Select nudge goal" },
      { label: "Write personalised message / template" },
      { label: "Set RDM bonus & send" },
    ],
    main: {
      badge: "🎯 Task 5 of 7 · Nudge with RDM",
      title: { before: "Nudge students with ", emphasis: "RDM rewards" },
      subtitle:
        "Re-engage students with personalised messages and instant RDM bonuses — in 4 steps.",
      stepTabs: ["Choose who", "Nudge goal", "Write message", "RDM & Send"],
    },
  },
  {
    emoji: "📊",
    emojiBorderBgClass: "border-emerald-400/25 bg-emerald-500/10",
    title: "Check assignment progress per student & send reminders",
    steps: [
      { label: "Select classroom & assignment" },
      { label: "View per-student submission status" },
      { label: "Send reminder to pending students" },
    ],
    main: {
      badge: "📊 Task 6 of 7 · Check progress",
      title: { before: "Check ", emphasis: "assignment progress" },
      subtitle: "See who submitted, who is pending, and send reminders — in 3 steps.",
      stepTabs: ["Select assignment", "View submissions", "Send reminder"],
    },
  },
  {
    emoji: "💬",
    emojiBorderBgClass: "border-fuchsia-400/25 bg-fuchsia-500/10",
    title: "Review student progress & send advice or counsel them",
    steps: [
      { label: "Select student from your classrooms" },
      { label: "Review their progress — scores, streaks, weak areas" },
      { label: "Write advice note / counselling template" },
      { label: "Send message + optional RDM encouragement" },
    ],
    main: {
      badge: "💬 Task 7 of 7 · Counsel student",
      title: { before: "Review progress & ", emphasis: "counsel", after: " a student" },
      subtitle:
        "See a student's snapshot and send them a personalised counselling note — in 4 steps.",
      stepTabs: ["Select student", "Review progress", "Write advice", "Send message"],
    },
  },
];

function TeacherWizardPopup(props: {
  onClose: () => void;
  onHideForever: () => void;
  teacherId: string;
  classrooms: TeacherPortalClassroomCard[];
  classroomDetails: Record<string, TeacherPortalClassroomDetail>;
  onCreateAssignment: MyClassroomViewProps["onCreateAssignment"];
  onCreateClassroom: MyClassroomViewProps["onCreateClassroom"];
  onRefreshTeacherPortal: MyClassroomViewProps["onRefreshTeacherPortal"];
  onMotivateStudents: MyClassroomViewProps["onMotivateStudents"];
  onScheduleLiveSession: MyClassroomViewProps["onScheduleLiveSession"];
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const GOOGLE_CONNECT_PROMPTED_SESSION_KEY = `teacherPortal.googleConnectPrompted.session.v1:${props.teacherId}`;

  type WizardSectionDraft = {
    name: string;
    scheduleDate: string; // yyyy-mm-dd
    scheduleTime: string; // hh:mm
    durationMinutes: number;
    repeatDays: string[];
    scheduleEndDate: string | null; // yyyy-mm-dd
  };

  const [collapsed, setCollapsed] = useState(false);
  const [activeTask, setActiveTask] = useState<number | null>(null);
  const [currentSteps, setCurrentSteps] = useState<number[]>(() => WIZARD_TASKS.map(() => 0));
  const [creating, setCreating] = useState(false);
  const [createdSummary, setCreatedSummary] = useState<{
    classroomId: string;
    joinCode: string;
    classroomName: string;
  } | null>(null);

  const [cwName, setCwName] = useState("");
  const [cwSubject, setCwSubject] = useState<(typeof SUBJECT_OPTIONS)[number]>("Physics");
  const [cwPucLevel, setCwPucLevel] = useState<(typeof PUC_OPTIONS)[number]>("PUC 2");
  const [cwExamTarget, setCwExamTarget] = useState<(typeof EXAM_OPTIONS)[number]>("JEE Advanced");
  const [cwAllowAdhocTrial, setCwAllowAdhocTrial] = useState(true);
  const [cwSections, setCwSections] = useState<WizardSectionDraft[]>([]);
  const [cwSectionName, setCwSectionName] = useState("");
  const [cwSectionScheduleDate, setCwSectionScheduleDate] = useState("");
  const [cwSectionScheduleTime, setCwSectionScheduleTime] = useState("");
  const [cwSectionDurationMinutes, setCwSectionDurationMinutes] = useState(90);
  const [cwSectionRepeatDays, setCwSectionRepeatDays] = useState<string[]>(["Mon", "Wed", "Fri"]);
  const [cwSectionScheduleEndDate, setCwSectionScheduleEndDate] = useState("");

  const ensureGoogleConnectPrompted = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return true;
    try {
      if (window.sessionStorage.getItem(GOOGLE_CONNECT_PROMPTED_SESSION_KEY) === "1") return true;
    } catch {
      // ignore
    }

    // If already connected, don't prompt (but mark as prompted for this session).
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token ?? "";
      const res = await fetch("/api/integrations/google/status", {
        method: "GET",
        credentials: "include",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const payload = (await res.json().catch(() => ({}))) as { connected?: boolean };
      if (res.ok && payload.connected) {
        try {
          window.sessionStorage.setItem(GOOGLE_CONNECT_PROMPTED_SESSION_KEY, "1");
        } catch {
          // ignore
        }
        return true;
      }
    } catch {
      // best-effort; fall through to prompt
    }

    const ok = window.confirm(
      "Connect Google Calendar now?\n\nSections can sync recurring schedules + Meet links to Google Calendar. If you skip, section sync may fail until you connect from My Classrooms."
    );
    try {
      window.sessionStorage.setItem(GOOGLE_CONNECT_PROMPTED_SESSION_KEY, "1");
    } catch {
      // ignore
    }
    if (!ok) return true;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token ?? "";
      const res = await fetch("/api/integrations/google/start", {
        method: "POST",
        credentials: "include",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !payload.url) {
        throw new Error(payload.error || `Request failed (${res.status})`);
      }
      window.location.href = payload.url;
      return false; // navigation in-progress
    } catch (err) {
      props.toast({
        title: "Could not start Google connect",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
      return true;
    }
  }, [GOOGLE_CONNECT_PROMPTED_SESSION_KEY, props]);

  const pctFor = useCallback(
    (taskIdx: number) => {
      const total = Math.max(1, WIZARD_TASKS[taskIdx]?.steps.length ?? 1);
      const current = Math.max(0, Math.min(currentSteps[taskIdx] ?? 0, total - 1));
      return Math.round(((current + 1) / total) * 100);
    },
    [currentSteps]
  );

  const jumpStep = (taskIdx: number, stepIdx: number) => {
    setCurrentSteps((prev) => {
      const next = [...prev];
      const max = Math.max(0, (WIZARD_TASKS[taskIdx]?.steps.length ?? 1) - 1);
      next[taskIdx] = Math.max(0, Math.min(stepIdx, max));
      return next;
    });
  };

  const selectTask = (idx: number) => {
    setActiveTask((prev) => (prev === idx ? null : idx));
  };

  const next = () => {
    if (activeTask == null) return;
    jumpStep(activeTask, (currentSteps[activeTask] ?? 0) + 1);
  };

  const prev = () => {
    if (activeTask == null) return;
    jumpStep(activeTask, (currentSteps[activeTask] ?? 0) - 1);
  };

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
        allowAdhocTrial: cwAllowAdhocTrial,
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

      const sectionDrafts = cwSections.slice(0, 6);
      if (sectionDrafts.length > 0) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token ?? "";

        for (let i = 0; i < sectionDrafts.length; i += 1) {
          const draft = sectionDrafts[i];
          const secName = draft.name.trim();
          if (!secName) continue;

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

            // Sync schedule to Google (same endpoint as the real section flow).
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
            const res = await fetch(
              `/api/integrations/google/classrooms/${classroomId}/recurring`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
                credentials: "include",
                body: JSON.stringify({
                  sectionId: createdRow.id,
                  timeZone,
                  scheduleDate: draft.scheduleDate,
                  scheduleTime: draft.scheduleTime,
                  durationMinutes: draft.durationMinutes,
                  repeatDays: draft.repeatDays,
                  scheduleEndDate: draft.scheduleEndDate,
                }),
              }
            );
            if (!res.ok) {
              const payload = (await res.json().catch(() => null)) as { error?: string } | null;
              throw new Error(payload?.error ?? `Calendar sync failed (${res.status})`);
            }
          } catch (secErr) {
            props.toast({
              title: "Section could not be synced",
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

  return (
    <div className="flex h-full min-h-0 w-full text-[12.5px] sm:text-sm">
      <aside
        className={`relative flex min-h-0 shrink-0 flex-col border-r border-white/10 bg-[#0d0d1c] transition-[width] duration-300 ${
          collapsed ? "w-12 sm:w-14" : "w-[260px] md:w-[300px] lg:w-[320px]"
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
              <div className="text-[10.5px] text-slate-400 sm:text-[11px]">Click a task to get started</div>
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
          className={`flex-1 px-3 py-2.5 sm:px-5 sm:py-4 ${
            activeTask === 1 || activeTask === 2 || activeTask === 3 || activeTask === 5
              ? "overflow-hidden"
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
                      onCancel={() => {
                        setActiveTask(null);
                      }}
                      onPublish={async (input) => {
                        await props.onCreateAssignment(
                          input as Parameters<MyClassroomViewProps["onCreateAssignment"]>[0]
                        );
                        props.toast({ title: "Assignment created" });
                        await props.onRefreshTeacherPortal({ silent: true });
                        setActiveTask(null);
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
                      classrooms={props.classrooms}
                      toast={props.toast}
                      headingTitle="Schedule a lesson / webinar"
                      headingSubtitle="Set up a live class on EduBlast, add your Google Meet link, attach pre-work and post-work resources, and open optional adhoc trial slots for any EduBlast member to join."
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
                      teacherId={props.teacherId}
                      classrooms={props.classrooms}
                      onCreateAssignment={async (input) => {
                        await props.onCreateAssignment(
                          input as Parameters<MyClassroomViewProps["onCreateAssignment"]>[0]
                        );
                        props.toast({ title: "Test assigned to classroom" });
                        await props.onRefreshTeacherPortal({ silent: true });
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
                <div className="rounded-3xl border border-white/10 bg-[#15162b]">
                  <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-5 sm:px-7 sm:py-6">
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-[#0d0d1c] px-3 py-1 text-xs text-slate-300">
                        {t.main.badge}
                      </div>
                      <div className="mt-3 font-serif text-2xl sm:text-3xl">
                        {t.main.title.before}
                        <span className="italic text-emerald-300">{t.main.title.emphasis}</span>
                        {t.main.title.after ?? ""}
                      </div>
                      <div className="mt-2 max-w-2xl text-sm text-slate-300">{t.main.subtitle}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTask(null)}
                        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={prev}
                        disabled={stepIdx === 0}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
                      >
                        ← Prev
                      </button>
                      <button
                        type="button"
                        onClick={next}
                        disabled={stepIdx >= stepCount - 1}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
                      >
                        Next →
                      </button>
                    </div>
                  </div>

                  <div className="px-5 pb-5 sm:px-7 sm:pb-7">
                    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#0d0d1c] px-4 py-3">
                      <div className="text-xs text-slate-300">Progress</div>
                      <div className="h-1.5 min-w-[160px] flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-emerald-400 transition-[width]"
                          style={{ width: `${pctFor(activeTask)}%` }}
                        />
                      </div>
                      <div className="text-xs font-semibold text-emerald-200">
                        Step {stepIdx + 1} of {stepCount}
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d1c]">
                      <div className="flex w-full overflow-x-auto border-b border-white/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {t.main.stepTabs.map((tab, i) => (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => jumpStep(activeTask, i)}
                            className={`inline-flex shrink-0 items-center gap-2 border-r border-white/10 px-4 py-3 text-xs font-semibold transition ${
                              i === stepIdx
                                ? "bg-emerald-500/10 text-emerald-200"
                                : i < stepIdx
                                  ? "text-slate-200/80 hover:bg-white/[0.03]"
                                  : "text-slate-400 hover:bg-white/[0.03]"
                            }`}
                          >
                            <span
                              className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${
                                i < stepIdx
                                  ? "border-emerald-400 bg-emerald-400 text-black"
                                  : i === stepIdx
                                    ? "border-emerald-400 text-emerald-200"
                                    : "border-white/20 text-slate-400"
                              }`}
                            >
                              {i + 1}
                            </span>
                            {tab}
                          </button>
                        ))}
                      </div>

                      <div className="px-4 py-5 sm:px-6 sm:py-6">
                        <div className="text-base font-semibold text-slate-100">
                          Step {stepIdx + 1} — {t.steps[stepIdx]?.label}
                        </div>
                        {activeTask === 0 ? (
                          <>
                            {stepIdx === 0 ? (
                              <div className="mt-4 grid gap-3 md:grid-cols-2">
                                <div className="md:col-span-2">
                                  <label className="mb-1 block text-sm font-semibold text-slate-300">
                                    Classroom name <span className="text-rose-300">*</span>
                                  </label>
                                  <input
                                    value={cwName}
                                    onChange={(e) => setCwName(e.target.value)}
                                    placeholder="e.g. JEE Advanced Batch A — 2026"
                                    className="h-10 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400"
                                  />
                                </div>
                                <div>
                                  <label className="mb-1 block text-sm font-semibold text-slate-300">
                                    Subject <span className="text-rose-300">*</span>
                                  </label>
                                  <select
                                    value={cwSubject}
                                    onChange={(e) =>
                                      setCwSubject(
                                        e.target.value as (typeof SUBJECT_OPTIONS)[number]
                                      )
                                    }
                                    className="h-10 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none focus:border-emerald-400"
                                  >
                                    {SUBJECT_OPTIONS.map((s) => (
                                      <option key={s} value={s}>
                                        {s}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="md:col-span-2 rounded-xl border border-emerald-400/15 bg-emerald-500/5 px-4 py-3 text-sm text-slate-300">
                                  Tip: A good classroom name includes the batch identifier (A/B),
                                  exam target, and year so students can find it instantly.
                                </div>
                              </div>
                            ) : null}

                            {stepIdx === 1 ? (
                              <div className="mt-4 grid gap-3 md:grid-cols-2">
                                <div>
                                  <label className="mb-1 block text-sm font-semibold text-slate-300">
                                    PUC level <span className="text-rose-300">*</span>
                                  </label>
                                  <select
                                    value={cwPucLevel}
                                    onChange={(e) =>
                                      setCwPucLevel(e.target.value as (typeof PUC_OPTIONS)[number])
                                    }
                                    className="h-10 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none focus:border-emerald-400"
                                  >
                                    {PUC_OPTIONS.map((p) => (
                                      <option key={p} value={p}>
                                        {p}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="mb-1 block text-sm font-semibold text-slate-300">
                                    Primary exam target <span className="text-rose-300">*</span>
                                  </label>
                                  <select
                                    value={cwExamTarget}
                                    onChange={(e) =>
                                      setCwExamTarget(
                                        e.target.value as (typeof EXAM_OPTIONS)[number]
                                      )
                                    }
                                    className="h-10 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none focus:border-emerald-400"
                                  >
                                    {EXAM_OPTIONS.map((x) => (
                                      <option key={x} value={x}>
                                        {x}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="md:col-span-2">
                                  <label className="mb-1 block text-sm font-semibold text-slate-300">
                                    Allow ad-hoc 10-min trial for EduBlast members?
                                  </label>
                                  <select
                                    value={cwAllowAdhocTrial ? "yes" : "no"}
                                    onChange={(e) => setCwAllowAdhocTrial(e.target.value === "yes")}
                                    className="h-10 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none focus:border-emerald-400"
                                  >
                                    <option value="yes">
                                      Yes — open to all students (50 RDM to continue)
                                    </option>
                                    <option value="no">No — enrolled students only</option>
                                  </select>
                                </div>
                              </div>
                            ) : null}

                            {stepIdx === 2 ? (
                              <div className="mt-4 space-y-3">
                                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-300">
                                  <span className="font-semibold text-slate-100">
                                    Sections are optional.
                                  </span>{" "}
                                  You can skip this step and create sections later from{" "}
                                  <span className="font-semibold text-slate-100">
                                    Sections &amp; Google Calendar
                                  </span>
                                  .
                                </div>

                                <div className="grid gap-3">
                                  <div className="rounded-2xl border border-white/10 bg-[#0d0d1c] p-4">
                                    <div className="grid gap-3">
                                      <div>
                                        <label className="mb-1 block text-sm font-semibold text-slate-300">
                                          Section name <span className="text-rose-300">*</span>
                                        </label>
                                        <input
                                          value={cwSectionName}
                                          onChange={(e) => setCwSectionName(e.target.value)}
                                          placeholder="e.g. Morning batch, Section A"
                                          className="h-10 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400"
                                        />
                                      </div>

                                      <div className="grid gap-3 lg:grid-cols-3">
                                        <div className="grid gap-3">
                                          <div>
                                            <label className="mb-1 block text-sm font-semibold text-slate-300">
                                              Start date <span className="text-rose-300">*</span>
                                            </label>
                                            <input
                                              type="date"
                                              value={cwSectionScheduleDate}
                                              onChange={(e) => setCwSectionScheduleDate(e.target.value)}
                                              className="h-10 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none focus:border-emerald-400"
                                            />
                                          </div>
                                          <div>
                                            <label className="mb-1 block text-sm font-semibold text-slate-300">
                                              End date (optional)
                                            </label>
                                            <input
                                              type="date"
                                              value={cwSectionScheduleEndDate}
                                              onChange={(e) => setCwSectionScheduleEndDate(e.target.value)}
                                              className="h-10 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none focus:border-emerald-400"
                                            />
                                          </div>
                                        </div>

                                        <div className="grid gap-3">
                                          <div>
                                            <label className="mb-1 block text-sm font-semibold text-slate-300">
                                              Start time <span className="text-rose-300">*</span>
                                            </label>
                                            <input
                                              type="time"
                                              value={cwSectionScheduleTime}
                                              onChange={(e) => setCwSectionScheduleTime(e.target.value)}
                                              className="h-10 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none focus:border-emerald-400"
                                            />
                                          </div>
                                          <div>
                                            <label className="mb-1 block text-sm font-semibold text-slate-300">
                                              Duration
                                            </label>
                                            <select
                                              value={String(cwSectionDurationMinutes)}
                                              onChange={(e) =>
                                                setCwSectionDurationMinutes(Number(e.target.value))
                                              }
                                              className="h-10 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-sm outline-none focus:border-emerald-400"
                                            >
                                              {[60, 75, 90, 105, 120].map((m) => (
                                                <option key={m} value={String(m)}>
                                                  {m} mins
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                        </div>

                                        <div>
                                          <div className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">
                                            Repeat days
                                          </div>
                                          <div className="flex flex-wrap gap-2">
                                            {WEEKDAYS.map((day) => {
                                              const on = cwSectionRepeatDays.includes(day);
                                              return (
                                                <button
                                                  key={day}
                                                  type="button"
                                                  onClick={() =>
                                                    setCwSectionRepeatDays((prev) =>
                                                      prev.includes(day)
                                                        ? prev.filter((d) => d !== day)
                                                        : [...prev, day]
                                                    )
                                                  }
                                                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                                    on
                                                      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                                                      : "border-white/15 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
                                                  }`}
                                                >
                                                  {day}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                        <div className="text-xs text-slate-400">
                                          {cwSections.length}/6 sections added
                                        </div>
                                        <div className="flex gap-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setCwSectionName("");
                                              setCwSectionScheduleDate("");
                                              setCwSectionScheduleTime("");
                                              setCwSectionDurationMinutes(90);
                                              setCwSectionRepeatDays(["Mon", "Wed", "Fri"]);
                                              setCwSectionScheduleEndDate("");
                                            }}
                                            className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                                          >
                                            Clear
                                          </button>
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              const proceed = await ensureGoogleConnectPrompted();
                                              if (!proceed) return;

                                              const name = cwSectionName.trim();
                                              if (!name) {
                                                props.toast({
                                                  title: "Section name required",
                                                  variant: "destructive",
                                                });
                                                return;
                                              }
                                              if (
                                                !cwSectionScheduleDate.trim() ||
                                                !cwSectionScheduleTime.trim()
                                              ) {
                                                props.toast({
                                                  title: "Schedule required",
                                                  description:
                                                    "Pick a start date and time for this section schedule.",
                                                  variant: "destructive",
                                                });
                                                return;
                                              }
                                              if (cwSectionRepeatDays.length === 0) {
                                                props.toast({
                                                  title: "Repeat days required",
                                                  description: "Select at least one repeat day.",
                                                  variant: "destructive",
                                                });
                                                return;
                                              }
                                              setCwSections((prev) => {
                                                if (prev.length >= 6) return prev;
                                                return [
                                                  ...prev,
                                                  {
                                                    name,
                                                    scheduleDate: cwSectionScheduleDate,
                                                    scheduleTime: cwSectionScheduleTime,
                                                    durationMinutes: cwSectionDurationMinutes,
                                                    repeatDays: cwSectionRepeatDays,
                                                    scheduleEndDate:
                                                      cwSectionScheduleEndDate.trim() || null,
                                                  },
                                                ];
                                              });
                                              setCwSectionName("");
                                              setCwSectionScheduleDate("");
                                              setCwSectionScheduleTime("");
                                              setCwSectionDurationMinutes(90);
                                              setCwSectionRepeatDays(["Mon", "Wed", "Fri"]);
                                              setCwSectionScheduleEndDate("");
                                            }}
                                            disabled={cwSections.length >= 6}
                                            className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
                                          >
                                            + Add section
                                          </button>
                                        </div>
                                      </div>

                                      <div className="text-xs leading-relaxed text-slate-400">
                                        Add up to{" "}
                                        <span className="font-semibold text-slate-200">
                                          6 sections
                                        </span>
                                        . These use the same fields as your real “Add section” flow
                                        and will sync a recurring schedule to Google Calendar on
                                        launch.
                                      </div>
                                    </div>
                                  </div>

                                </div>
                              </div>
                            ) : null}

                            {stepIdx === 3 ? (
                              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4 text-sm text-slate-300">
                                Student invites are already supported in the classroom page. After
                                launch, share the join code (step 5) so students can request access.
                              </div>
                            ) : null}

                            {stepIdx === 4 ? (
                              <div className="mt-4 space-y-3">
                                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4">
                                  <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
                                    Review
                                  </div>
                                  <div className="mt-2 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
                                    <div>
                                      <span className="text-slate-400">Classroom name:</span>{" "}
                                      <span className="font-semibold">{cwName.trim() || "—"}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400">Subject:</span>{" "}
                                      <span className="font-semibold">{cwSubject}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400">PUC level:</span>{" "}
                                      <span className="font-semibold">{cwPucLevel}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400">Exam target:</span>{" "}
                                      <span className="font-semibold">{cwExamTarget}</span>
                                    </div>
                                    <div className="sm:col-span-2">
                                      <span className="text-slate-400">Sections:</span>{" "}
                                      <span className="font-semibold">
                                        {cwSections.length
                                          ? cwSections.map((s) => s.name).join(", ")
                                          : "None"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void createClassroomFromWizard()}
                                  disabled={creating || !cwName.trim()}
                                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
                                >
                                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                  {creating ? "Launching..." : "Launch classroom"}
                                </button>
                              </div>
                            ) : null}
                          </>
                        ) : activeTask === 4 ? (
                          <TeacherNudgeWithRdmWizard
                            stepIdx={stepIdx}
                            classrooms={props.classrooms}
                            classroomDetails={props.classroomDetails}
                            onMotivateStudents={props.onMotivateStudents}
                            toast={props.toast}
                            onDone={() => setActiveTask(null)}
                          />
                        ) : activeTask === 6 ? (
                          <TeacherCounselStudentWizard
                            stepIdx={stepIdx}
                            classrooms={props.classrooms}
                            classroomDetails={props.classroomDetails}
                            onMotivateStudents={props.onMotivateStudents}
                            toast={props.toast}
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
                            This task is not wired yet in the wizard. (Create classroom, assignment, webinar scheduling,
                            PDF tests, and assignment progress are wired.)
                          </div>
                        )}

                        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
                          <div className="text-xs text-slate-400">
                            Step {stepIdx + 1} of {stepCount}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={prev}
                              disabled={stepIdx === 0}
                              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-60"
                            >
                              ← Back
                            </button>
                            {activeTask === 4 || activeTask === 6 ? (
                              stepIdx >= stepCount - 1 ? null : (
                                <button
                                  type="button"
                                  onClick={next}
                                  disabled={stepIdx >= stepCount - 1}
                                  className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
                                >
                                  {`Next: ${t.steps[stepIdx + 1]?.label ?? "Next"} →`}
                                </button>
                              )
                            ) : (
                              <button
                                type="button"
                                onClick={next}
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
      </main>
    </div>
  );
}

function TeacherAssignmentProgressWizard(props: {
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

  type AssignmentScoreRow = {
    userId: string;
    score: number;
    total: number;
    submittedAt: string | null;
  };

  const [classroomId, setClassroomId] = useState<string>("");
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [assignmentId, setAssignmentId] = useState<string>("");

  const [scoresLoading, setScoresLoading] = useState(false);
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

  const scopedAssignments = useMemo(() => {
    if (!detail) return [];
    // Scope filtering:
    // - Whole class: show only classroom-level assignments (sectionId = null)
    // - Section: show only assignments for that section
    if (!sectionId) return detail.assignments.filter((a) => a.sectionId == null);
    return detail.assignments.filter((a) => a.sectionId === sectionId);
  }, [detail, sectionId]);

  const pendingStudents = useMemo(() => {
    if (!detail) return [];
    if (!scores.length) {
      // If we haven't loaded scores yet, still show full roster as "pending" to keep UI usable.
      return roster;
    }
    const submittedIds = new Set(scores.map((s) => s.userId));
    return roster.filter((s) => !submittedIds.has(s.userId));
  }, [detail, roster, scores]);

  const submittedStudents = useMemo(() => {
    if (!detail) return [];
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
  }, [detail, roster, scores]);

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

  // Fetch scores when we enter step 2+.
  useEffect(() => {
    if (props.stepIdx < 1) return;
    if (!classroomId || !assignmentId) return;
    let cancelled = false;

    const run = async () => {
      setScoresLoading(true);
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
        setScores(Array.isArray(data.scores) ? (data.scores as AssignmentScoreRow[]) : []);
        setScoresLastUpdatedAt(new Date().toISOString());
      } catch (e) {
        if (cancelled) return;
        setScoresError(e instanceof Error ? e.message : "Failed to load scores.");
        setScores([]);
      } finally {
        if (!cancelled) setScoresLoading(false);
      }
    };

    void run();
    const intervalId = window.setInterval(() => {
      if (!cancelled) void run();
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [assignmentId, classroomId, props.stepIdx]);

  const completion = useMemo(() => {
    const total = roster.length;
    const completed = scores.length;
    const pct = total > 0 ? Math.round((completed / Math.max(1, total)) * 100) : 0;
    return { total, completed, pct };
  }, [roster.length, scores.length]);

  const visibleRows = useMemo(() => {
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
  }, [roster, scores, submittedStudents]);

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
            const total = Math.max(0, assignmentDraft.totalCount ?? assignmentDraft.completedCount ?? 0);
            const completed = Math.max(0, assignmentDraft.completedCount ?? 0);
            const pending = Math.max(0, total - completed);
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
                  {completed}/{total} submitted
                </span>
                <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-200">
                  {pending} pending
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
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${completion.pct}%` }}
              />
            </div>
            <div className="text-xs font-semibold text-emerald-200">{completion.pct}%</div>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {completion.completed}/{completion.total} submitted
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-[11px] text-slate-500">
            {scoresLoading ? "Checking for new submissions…" : scoresLastUpdatedAt ? `Updated ${formatRelativeTime(scoresLastUpdatedAt)}` : ""}
          </div>
          {scoresError ? <div className="mt-2 text-[11px] text-rose-200">{scoresError}</div> : null}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0b1020] p-3">
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
          Submission status
        </div>

        {visibleRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 bg-black/10 p-4 text-center text-xs text-slate-400">
            {scoresLoading ? "Loading…" : "No students found in this scope."}
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
        {pendingCount} student{pendingCount === 1 ? "" : "s"} haven&apos;t submitted yet. Send them a quick reminder.
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
              <option value="all_pending">All {pendingCount} pending students</option>
              <option value="preferred_pending" disabled={!preferredPendingStudents.length}>
                Preferred {preferredPendingStudents.length} pending students
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
        <button
          type="button"
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
          className={`group inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-2 text-xs font-semibold text-black transition hover:bg-emerald-400 active:scale-[0.99] ${
            sendingReminder ? "cursor-not-allowed opacity-80" : ""
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

function TeacherNudgeWithRdmWizard(props: {
  stepIdx: number; // 0..3
  classrooms: TeacherPortalClassroomCard[];
  classroomDetails: Record<string, TeacherPortalClassroomDetail>;
  onMotivateStudents: MyClassroomViewProps["onMotivateStudents"];
  toast: ReturnType<typeof useToast>["toast"];
  onDone: () => void;
}) {
  const { toast } = props;

  type NudgeTarget = "off_streak" | "low_scorers" | "specific_student" | "full_classroom";
  type NudgeGoal =
    | "restart_streak"
    | "complete_pending_assignment"
    | "attempt_mock"
    | "answer_doubts"
    | "revise_chapter"
    | "watch_recorded_class";

  type NudgeTemplateId = "streak_reengagement";

  const selectCompactClassName =
    "h-10 w-full rounded-xl border border-white/15 bg-[#070b17] px-3 text-[13px] outline-none focus:border-emerald-400 sm:text-sm";

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
    { id: "revise_chapter", label: "Revise a specific chapter" },
    { id: "watch_recorded_class", label: "Watch the recorded class" },
  ];

  const nudgeTemplateOptions: Array<{ id: NudgeTemplateId; label: string }> = [
    { id: "streak_reengagement", label: "🔥 Streak re-engagement" },
  ];

  const defaultClassroomId = props.classrooms[0]?.id ?? "";
  const [classroomId] = useState(defaultClassroomId);

  const detail = props.classroomDetails[classroomId];
  const students: TeacherPortalClassroomStudent[] = (detail?.students ?? []).filter(
    (s) => s.role !== "teacher"
  );

  const twoDaysAgoMs = Date.now() - 48 * 60 * 60 * 1000;
  const offStreakStudents = students.filter((s) => {
    if (!(s.status === "off_streak" || s.status === "at_risk")) return false;
    if (!s.lastActiveAt) return false;
    const ts = new Date(s.lastActiveAt).getTime();
    return Number.isFinite(ts) && ts <= twoDaysAgoMs;
  });

  const lowScorers = students.filter(
    (s) => typeof s.avgScorePercent === "number" && s.avgScorePercent < 60
  );

  const [target, setTarget] = useState<NudgeTarget>("off_streak");
  const [specificStudentId, setSpecificStudentId] = useState<string>(
    lowScorers[0]?.userId ?? students[0]?.userId ?? ""
  );
  const [goal, setGoal] = useState<NudgeGoal>("restart_streak");
  const [templateId, setTemplateId] = useState<NudgeTemplateId>("streak_reengagement");
  const [topicHint, setTopicHint] = useState("");
  const [rdmDelta, setRdmDelta] = useState(10);
  const [messageTouched, setMessageTouched] = useState(false);
  const [message, setMessage] = useState(
    "Hey [name]! I noticed you haven't studied in 2 days. Your last score was great — don't let the streak break now. Come back today and I'm giving you a RDM boost to restart! 🔥"
  );
  const [sending, setSending] = useState(false);

  const selectedTargetStudentIds = useMemo(() => {
    if (target === "off_streak") return offStreakStudents.map((s) => s.userId);
    if (target === "low_scorers") return lowScorers.map((s) => s.userId);
    if (target === "specific_student") {
      return specificStudentId ? [specificStudentId] : [];
    }
    return students.map((s) => s.userId);
  }, [target, offStreakStudents, lowScorers, specificStudentId, students]);

  const actionKind = useMemo<"boost" | "nudge" | "urgent_nudge">(() => {
    const anyAtRisk = selectedTargetStudentIds.some((id) => {
      const s = students.find((x) => x.userId === id);
      return s?.status === "at_risk";
    });
    return anyAtRisk ? "urgent_nudge" : "nudge";
  }, [selectedTargetStudentIds, students]);

  useEffect(() => {
    // Keep specific selection valid.
    if (target !== "specific_student") return;
    if (specificStudentId && students.some((s) => s.userId === specificStudentId)) return;
    setSpecificStudentId(students[0]?.userId ?? "");
  }, [target, specificStudentId, students]);

  useEffect(() => {
    if (messageTouched) return;
    const rdmPart = rdmDelta > 0 ? ` (+${rdmDelta} RDM)` : "";
    // Screenshot reference template: uses [name] token.
    const base = (() => {
      switch (goal) {
        case "restart_streak":
          return `Hey [name]! I noticed you haven't studied in 2 days. Your last score was great — don't let the streak break now. Come back today and I'm giving you a RDM boost to restart${rdmPart}! 🔥`;
        case "complete_pending_assignment":
          return `Hey [name]! Your pending assignment is waiting. Complete it today and I'm giving you a RDM boost${rdmPart}! You'll be back on track fast.`;
        case "attempt_mock":
          return `Hey [name]! I recommend a quick Testbee mock to build momentum. Attempt it today and I'm giving you a RDM boost${rdmPart}!`;
        case "answer_doubts":
          return `Hey [name]! I saw you might have doubts. Answer them on Gyan++ today and I'm giving you a RDM boost${rdmPart}!`;
        case "revise_chapter":
          return `Hey [name]! Let's revise to lock in concepts. Based on your goal, I'm encouraging a quick revision${topicHint.trim() ? `: ${topicHint.trim()}` : ""} today — and I'm giving you a RDM boost${rdmPart}!`;
        case "watch_recorded_class":
          return `Hey [name]! A recorded lesson can help you catch up quickly. Watch it today and I'm giving you a RDM boost${rdmPart}!`;
        default:
          return `Hey [name]! I'm nudging you to keep learning momentum going. Complete the next step and earn${rdmPart} 🎯`;
      }
    })();

    setMessage(base);
  }, [goal, rdmDelta, messageTouched, topicHint]);

  const targetCount = selectedTargetStudentIds.length;

  const offStreakAlertNames = offStreakStudents
    .slice(0, 6)
    .map((s) => s.name.split(" ")[0]?.trim())
    .filter(Boolean);

  const step1 = (
    <div className="mt-3 space-y-2 sm:space-y-3">
      <div className="text-xs leading-relaxed text-slate-300">
        You can target the students who need it most — off-streak, low scorers, or the whole class.
      </div>

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
            {offStreakStudents.length} students haven&apos;t studied in 2+ days
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
            Below 60% average on last mock
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
          <div className="text-[13px] font-semibold text-slate-100 sm:text-sm">Specific student</div>
          <div className="mt-0.5 text-[11px] text-slate-400 sm:mt-1 sm:text-xs">Pick one student by name</div>
        </button>

        <button
          type="button"
          onClick={() => setTarget("full_classroom")}
          className={`rounded-2xl border p-3 text-left transition sm:p-4 ${
            target === "full_classroom"
              ? "border-emerald-400/40 bg-emerald-500/10"
              : "border-white/10 bg-[#0d0d1c] hover:bg-white/[0.03]"
          } sm:col-span-2`}
        >
          <div className="text-[13px] font-semibold text-slate-100 sm:text-sm">Full classroom</div>
          <div className="mt-0.5 text-[11px] text-slate-400 sm:mt-1 sm:text-xs">
            Broadcast to all {students.length} students
          </div>
        </button>
      </div>

      {target === "off_streak" && offStreakStudents.length > 0 ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-rose-200 sm:px-4 sm:py-3 sm:text-xs">
          <span className="font-semibold">⚠ Off-streak alert:</span>{" "}
          {offStreakAlertNames.join(", ")}
          {offStreakStudents.length > offStreakAlertNames.length ? "…" : ""} — haven&apos;t logged in for
          2+ days.
        </div>
      ) : null}

      {target === "specific_student" ? (
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-300">Pick student</label>
          <select
            value={specificStudentId}
            onChange={(e) => setSpecificStudentId(e.target.value)}
            className={selectCompactClassName}
          >
            {students
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((s) => (
                <option key={s.userId} value={s.userId}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>
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

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-300">
          Specific chapter or topic <span className="text-slate-500">(optional)</span>
        </label>
        <input
          value={topicHint}
          onChange={(e) => setTopicHint(e.target.value)}
          placeholder="e.g. Electrostatics — Gauss's Law"
          className={selectCompactClassName}
        />
      </div>
    </div>
  );

  const step3 = (
    <div className="mt-3 space-y-2 sm:space-y-3">
      <div className="text-xs leading-relaxed text-slate-300">
        Your message will appear as a personal notification from you. Students respond much
        better to personal messages than generic alerts.
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-300">Message template</label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value as NudgeTemplateId)}
          className={selectCompactClassName}
        >
          {nudgeTemplateOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
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
                  setMessageTouched(false);
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
                  ? `Low scorers (${targetCount} students)`
                  : target === "specific_student"
                    ? `Selected student`
                    : `Full classroom (${targetCount} students)`}
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
          disabled={!targetCount || !message.trim() || sending}
          onClick={async () => {
            if (!targetCount) return;
            if (!message.trim()) return;
            if (!classroomId) return;
            setSending(true);
            try {
              await props.onMotivateStudents({
                classroomId,
                actionKind,
                targetStudentIds: selectedTargetStudentIds,
                message,
                rdmDelta,
                sectionId: null,
              });
              toast({ title: "Nudges sent" });
              props.onDone();
            } catch (e) {
              toast({
                title: "Could not send nudges",
                description: e instanceof Error ? e.message : "Try again.",
                variant: "destructive",
              });
            } finally {
              setSending(false);
            }
          }}
          className="rounded-full bg-amber-500 px-5 py-2.5 text-xs font-semibold text-black hover:bg-amber-400 disabled:opacity-60 sm:px-6 sm:py-3"
        >
          {sending ? "Sending…" : "Send nudges + RDM →"}
        </button>
      </div>
    </div>
  );

  if (!classroomId) {
    return (
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-300">
        No classroom found for nudges.
      </div>
    );
  }

  if (props.stepIdx === 0) return step1;
  if (props.stepIdx === 1) return step2;
  if (props.stepIdx === 2) return step3;
  return step4;
}

function TeacherCounselStudentWizard(props: {
  stepIdx: number; // 0..3
  classrooms: TeacherPortalClassroomCard[];
  classroomDetails: Record<string, TeacherPortalClassroomDetail>;
  onMotivateStudents: MyClassroomViewProps["onMotivateStudents"];
  toast: ReturnType<typeof useToast>["toast"];
  onDone: () => void;
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

  const [scope, setScope] = useState<{ kind: "class" } | { kind: "unassigned" } | { kind: "section"; id: string }>(
    { kind: "class" }
  );

  const roster = useMemo(() => {
    if (scope.kind === "class") return rosterAll;
    if (scope.kind === "unassigned") return rosterAll.filter((s) => s.sectionId == null);
    return rosterAll.filter((s) => (s.sectionId ?? null) === scope.id);
  }, [rosterAll, scope]);

  const sortedRoster = useMemo(
    () => [...roster].sort((a, b) => a.name.localeCompare(b.name)),
    [roster]
  );

  const [studentId, setStudentId] = useState<string>(() => sortedRoster[0]?.userId ?? "");
  const selectedStudent = useMemo(
    () => rosterAll.find((s) => s.userId === studentId) ?? null,
    [rosterAll, studentId]
  );

  useEffect(() => {
    // When classroom changes, reset scope + student selection.
    setScope({ kind: "class" });
  }, [classroomId]);

  useEffect(() => {
    // Keep selected student valid for current roster/scope.
    if (studentId && rosterAll.some((s) => s.userId === studentId)) return;
    setStudentId(sortedRoster[0]?.userId ?? rosterAll[0]?.userId ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classroomId, scope.kind, "id" in scope ? scope.id : "", sortedRoster.length, rosterAll.length]);

  const scopeLabel =
    scope.kind === "class"
      ? "Whole classroom"
      : scope.kind === "unassigned"
        ? "Unassigned students"
        : sections.find((s) => s.id === scope.id)?.name ?? "Section";

  const avgScore = selectedStudent?.avgScorePercent ?? null;
  const streakDays = selectedStudent?.streakDays ?? 0;
  const rdmBalance = selectedStudent?.rdm ?? 0;

  const [weakAreasLoading, setWeakAreasLoading] = useState(false);
  const [weakAreasError, setWeakAreasError] = useState<string | null>(null);
  const [weakAreas, setWeakAreas] = useState<Array<{ topic: string; pct: number }>>([]);

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
            headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
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

  const rankByAvgScore = useMemo(() => {
    if (!selectedStudent) return null;
    const ranked = [...rosterAll]
      .filter((s) => typeof s.avgScorePercent === "number")
      .sort((a, b) => (b.avgScorePercent ?? 0) - (a.avgScorePercent ?? 0));
    const idx = ranked.findIndex((s) => s.userId === selectedStudent.userId);
    if (idx < 0) return null;
    return idx + 1;
  }, [rosterAll, selectedStudent]);

  type CounsellingApproach = "remotivate" | "weak_areas" | "celebrate" | "custom";
  const [approach, setApproach] = useState<CounsellingApproach>("remotivate");
  const [adviceTouched, setAdviceTouched] = useState(false);
  const [advice, setAdvice] = useState("");

  useEffect(() => {
    if (adviceTouched) return;
    const name = selectedStudent?.name?.trim() || "there";
    const firstName = name.split(" ")[0] || name;
    const avg = avgScore != null ? `${Math.round(avgScore)}%` : "your recent score";
    const streakLabel = streakDays > 0 ? `${streakDays} day streak` : "streak restart";
    const rankLabel = rankByAvgScore != null ? `#${rankByAvgScore}` : "your rank";

    const next = (() => {
      if (approach === "celebrate") {
        return `Fantastic work ${firstName}! Your consistency is showing in your results. Keep going exactly as you are — you’re building a strong ${streakLabel}. — ${firstName}`;
      }
      if (approach === "weak_areas") {
        return `Hi ${firstName}! I noticed some topics are pulling down your overall performance. Your average is around ${avg}. Let’s pick 1 weak area, revise for 30 minutes, and then attempt a targeted mock. I believe you can push your ${rankLabel} even higher. — ${firstName}`;
      }
      if (approach === "custom") {
        return "";
      }
      return `Hi ${firstName}! I’ve been reviewing your progress. Your average is around ${avg} and you can do even better. Let’s restart your momentum today: 30 minutes focused revision + one short practice test. You’ve got this. — ${firstName}`;
    })();

    setAdvice(next);
  }, [approach, adviceTouched, selectedStudent, avgScore, streakDays, rankByAvgScore]);

  const [encourageRdm, setEncourageRdm] = useState<number>(10);
  type RecommendActionId = "attempt_targeted_mock" | "post_doubt" | "watch_recorded" | "none";
  const recommendActions: Array<{ id: RecommendActionId; label: string }> = [
    { id: "attempt_targeted_mock", label: "Attempt a Testbee targeted mock" },
    { id: "post_doubt", label: "Post a doubt on Gyan++" },
    { id: "watch_recorded", label: "Watch recorded class on this topic" },
    { id: "none", label: "No specific action recommended" },
  ];
  const [recommendAction, setRecommendAction] = useState<RecommendActionId>("attempt_targeted_mock");
  const [recommendUrl, setRecommendUrl] = useState("");
  const [sending, setSending] = useState(false);

  const normalizeExternalUrl = useCallback((raw: string): string | null => {
    let s = raw.trim();
    if (!s) return null;

    // If a relative-looking /https/... slipped in, strip leading slashes.
    while (s.startsWith("/")) s = s.slice(1);

    // If someone pasted a full localhost-prefixed path like http://localhost:3000/https/www...
    const httpIdx = s.indexOf("http");
    if (httpIdx > 0) s = s.slice(httpIdx);

    // Common paste mistakes: "https/www..." or "https//www..."
    if (/^https\/\//i.test(s) === false && /^https\//i.test(s)) {
      s = s.replace(/^https\//i, "https://");
    }
    if (/^http\/\//i.test(s) === false && /^http\//i.test(s)) {
      s = s.replace(/^http\//i, "http://");
    }
    if (/^https:\/\//i.test(s) === false && /^https:/i.test(s)) {
      s = s.replace(/^https:/i, "https://");
    }
    if (/^http:\/\//i.test(s) === false && /^http:/i.test(s)) {
      s = s.replace(/^http:/i, "http://");
    }

    // If teacher pasted "www.youtube.com/..." without protocol, make it https.
    if (/^www\./i.test(s)) s = `https://${s}`;

    // Final validation: accept only http(s).
    try {
      const u = new URL(s);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      return u.toString();
    } catch {
      return null;
    }
  }, []);

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
              scope.kind === "class" ? "__class__" : scope.kind === "unassigned" ? "__unassigned__" : scope.id
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
        >
          {sortedRoster.map((s) => (
            <option key={s.userId} value={s.userId}>
              {s.name} — {s.status.replaceAll("_", " ")} {s.streakDays} days
            </option>
          ))}
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
                Scope: {scopeLabel} · Avg score {formatOptionalPercent(selectedStudent.avgScorePercent)} ·{" "}
                <span className={statusPill(selectedStudent.status)}>
                  {selectedStudent.status.replaceAll("_", " ")}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-300">
          No students found in this scope.
        </div>
      )}
    </div>
  );

  const step2 = (
    <div className="mt-3 space-y-2 sm:space-y-3">
      <div className="text-xs leading-relaxed text-slate-300">
        Here’s the student’s snapshot based on their real class data.
      </div>

      {!selectedStudent ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-300">
          Select a student in step 1 first.
        </div>
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
                      <div className="truncate text-sm font-semibold text-slate-200">{wa.topic}</div>
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

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-300">Counselling approach</label>
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
    </div>
  );

  const step4 = (
    <div className="mt-3 space-y-2 sm:space-y-3">
      <div className="text-xs leading-relaxed text-slate-300">
        Send your message with optional RDM encouragement. (Recommended actions list excludes Instacue as requested.)
      </div>

      <div>
        <div className="mb-1 text-xs font-semibold text-slate-300">Add RDM encouragement?</div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "No RDM", value: 0 },
            { label: "+10 RDM", value: 10 },
            { label: "+25 RDM", value: 25 },
            { label: "+50 RDM", value: 50 },
          ].map((o) => {
            const on = encourageRdm === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setEncourageRdm(o.value)}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  on
                    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                    : "border-white/10 bg-[#0d0d1c] text-slate-300 hover:bg-white/[0.03]"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-300">Recommend a specific action</label>
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
            <span className="text-slate-100 font-semibold">
              {encourageRdm > 0 ? `+${encourageRdm} RDM` : "No RDM"}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-slate-400">Delivery</span>
            <span className="text-slate-100 font-semibold">Instant — as teacher notification</span>
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
              const actionText = recommendActions.find((a) => a.id === recommendAction)?.label ?? "";
              const recordedUrl =
                recommendAction === "watch_recorded"
                  ? normalizeExternalUrl(recommendUrl)
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
                rdmDelta: encourageRdm,
                recommendActionId: recommendAction,
                recommendActionLabel: actionText || undefined,
                recommendActionUrl:
                  recommendAction === "watch_recorded"
                    ? recordedUrl ?? undefined
                    : recommendAction === "attempt_targeted_mock"
                      ? "/mock?view=setup"
                      : recommendAction === "post_doubt"
                        ? "/doubts"
                        : undefined,
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
          {sending ? "Sending…" : "Send message + RDM"}
        </button>
      </div>
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
  sections,
}: {
  item: TeacherPortalAssignmentItem;
  onOpen: () => void;
  progress?: { completionPercent: number; completedCount: number; totalCount: number };
  sections: TeacherPortalClassroomSection[];
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
  const feedScopeLabel =
    item.sectionId == null
      ? "Whole class (Posts)"
      : sections.find((s) => s.id === item.sectionId)?.name?.trim() || "Section (Posts)";

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
      <p className="mt-1.5">
        <span className="inline-flex max-w-full truncate rounded-md border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-100">
          {feedScopeLabel}
        </span>
      </p>
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
  onScheduleLiveSession,
}: MyClassroomViewProps) {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const qpClassroom = searchParams.get("classroom");
  const qpDetailRaw = searchParams.get("portalDetail");
  const qpWizard = searchParams.get("wizard");
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
  const [motivationRdm, setMotivationRdm] = useState(10);
  const [assignmentDetail, setAssignmentDetail] = useState<TeacherPortalAssignmentItem | null>(
    null
  );
  const [taskPreview, setTaskPreview] = useState<{
    open: boolean;
    href: string;
    mode: "assignment-test" | "mock-paper" | "chapter-quiz-preview" | "iframe";
    title: string;
    chapterQuizRef?: {
      board: string;
      subject: string;
      classLevel: number;
      topic: string;
      subtopicName: string;
      level: string;
      advancedSet?: 1 | 2 | 3;
    };
  } | null>(null);

  useEffect(() => {
    // Avoid modal overlaps: wizard drawer should be the only "top-level" surface.
    if (!wizardOpen) return;
    setAssignmentOpen(false);
    setOpen(false);
  }, [wizardOpen]);
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
  const ASSIGNMENT_SCORES_CACHE_KEY = "teacherPortal.assignmentScoresCache.v1";

  const wizardAutoOpenOnceRef = useRef(false);
  const wizardDismissedRef = useRef(false);
  const wizardOpenRef = useRef(false);

  useEffect(() => {
    wizardOpenRef.current = wizardOpen;
  }, [wizardOpen]);

  const WIZARD_CLOSED_SESSION_KEY = "teacherPortal.teacherWizardClosed.session.v1";

  const tryAutoOpenWizard = useCallback(() => {
    if (typeof window === "undefined") return;
    if (activeClassroomId) return;
    if (wizardOpenRef.current) return;
    if (wizardDismissedRef.current) return;
    try {
      if (window.sessionStorage.getItem(WIZARD_CLOSED_SESSION_KEY) === "1") return;
    } catch {
      // ignore
    }
    // Prevent reopen loops during the same page view.
    if (wizardAutoOpenOnceRef.current) return;
    wizardAutoOpenOnceRef.current = true;
    window.setTimeout(() => setWizardOpen(true), 250);
  }, [activeClassroomId]);

  useEffect(() => {
    // Auto-open on Teacher Portal landing (per page load).
    wizardAutoOpenOnceRef.current = false;
    wizardDismissedRef.current = false;
    tryAutoOpenWizard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  useEffect(() => {
    // Auto-open after login (even if counts don't change).
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        wizardAutoOpenOnceRef.current = false;
        wizardDismissedRef.current = false;
        try {
          window.sessionStorage.removeItem(WIZARD_CLOSED_SESSION_KEY);
        } catch {
          // ignore
        }
        tryAutoOpenWizard();
      }
      if (event === "SIGNED_OUT") {
        wizardAutoOpenOnceRef.current = false;
        wizardDismissedRef.current = false;
        try {
          window.sessionStorage.removeItem(WIZARD_CLOSED_SESSION_KEY);
        } catch {
          // ignore
        }
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
    try {
      window.sessionStorage.removeItem(WIZARD_CLOSED_SESSION_KEY);
    } catch {
      // ignore
    }
    setWizardOpen(true);
    // Remove the param so it doesn't re-trigger on every re-render.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("wizard");
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore
    }
  }, [qpWizard]);

  const openTaskPreview = useCallback((href: string, label: string) => {
    const raw = href.trim();
    if (!raw) return;
    // Normalize relative hrefs so previews don't resolve under /teacher-portal/...
    // Examples:
    // - "cbse/chemistry/..." -> "/cbse/chemistry/..."
    // - "/cbse/chemistry/..." stays as-is
    // - "https://..." stays as-is
    const normalizedHref =
      raw.startsWith("http://") || raw.startsWith("https://")
        ? raw
        : raw.startsWith("/")
          ? raw
          : `/${raw}`;

    const isAssignmentTest = /\/classroom\/[^/]+\/assignment-test\/[^/?#]+/i.test(normalizedHref);
    const isClassroomLinkedTask = (() => {
      try {
        const url =
          normalizedHref.startsWith("http://") || normalizedHref.startsWith("https://")
            ? new URL(normalizedHref)
            : new URL(normalizedHref, "https://edublast.local");
        return Boolean(
          url.searchParams.get("classroomId")?.trim() && url.searchParams.get("postId")?.trim()
        );
      } catch {
        return false;
      }
    })();
    const isMockPaper = (() => {
      try {
        const url =
          normalizedHref.startsWith("http://") || normalizedHref.startsWith("https://")
            ? new URL(normalizedHref)
            : new URL(normalizedHref, "https://edublast.local");
        return url.pathname === "/mock" && Boolean(url.searchParams.get("paper")?.trim());
      } catch {
        return false;
      }
    })();
    setTaskPreview({
      open: true,
      href: normalizedHref,
      mode:
        isAssignmentTest || isClassroomLinkedTask
          ? "assignment-test"
          : isMockPaper
            ? "mock-paper"
            : "iframe",
      title: label || "Task preview",
    });
  }, []);
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
  const [assignmentCustomStudentIds, setAssignmentCustomStudentIds] = useState<string[]>([]);
  const [assignmentCustomSearch, setAssignmentCustomSearch] = useState("");
  const [rewardRdm, setRewardRdm] = useState(15);
  const [assignmentInstructions, setAssignmentInstructions] = useState("");
  const [sectionPickerStudentId, setSectionPickerStudentId] = useState<string | null>(null);
  const assignmentScopeTouchedRef = useRef(false);
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
    if (cohortTab.kind === "class")
      return activeDetail.assignments.filter((a) => a.sectionId == null);
    if (cohortTab.kind === "unassigned") return [];
    return activeDetail.assignments.filter((a) => a.sectionId === cohortTab.id);
  }, [activeDetail.assignments, cohortTab]);

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
    setAssignToLabel((prev) => {
      const v = prev.trim().toLowerCase();
      if (v === "top performers" || v === "off-streak students") return "All students";
      return prev;
    });
    setChapterQuizSel(initialChapterQuizSelection());
    setConceptFocusSel(initialConceptFocusSelection());
    setDailyDoseTrackId(DAILYDOSE_STREAK_TRACK_IDS[0]);
    setGyanTopicFocus("");
    setGyanSubtopicHint("");
    setAssignmentTargetSectionId(cohortTab.kind === "section" ? cohortTab.id : null);
    assignmentScopeTouchedRef.current = false;
    setAssignmentCustomStudentIds([]);
    setAssignmentCustomSearch("");
    // Only reset when dialog opens; cohortTab is read from the open transition render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentOpen]);

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

  const mergeAssignmentScores = useCallback(
    (prev: AssignmentScoreRow[], incoming: AssignmentScoreRow[]) => {
      const byUserId = new Map<string, AssignmentScoreRow>();
      for (const row of prev) byUserId.set(row.userId, row);

      for (const next of incoming) {
        const existing = byUserId.get(next.userId);
        if (!existing) {
          byUserId.set(next.userId, next);
          continue;
        }
        const existingTs = existing.submittedAt ? new Date(existing.submittedAt).getTime() : -1;
        const nextTs = next.submittedAt ? new Date(next.submittedAt).getTime() : -1;
        byUserId.set(next.userId, nextTs >= existingTs ? next : existing);
      }

      return Array.from(byUserId.values()).sort((a, b) => {
        const aTs = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const bTs = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return bTs - aTs;
      });
    },
    []
  );

  useEffect(() => {
    if (!assignmentDetail || !activeClassroomId) return;
    const hasGeneratedTest = assignmentDetail.tasks?.some(
      (t) =>
        t.kind === "chapter_quiz" ||
        t.kind === "mock_paper" ||
        t.href?.includes("/assignment-test/") ||
        t.href?.includes("panel=quiz") ||
        t.href?.includes("/mock")
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
          setAssignmentScores((prev) => mergeAssignmentScores(prev, scores));
          setAssignmentScoresLastUpdatedAt(new Date().toISOString());

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
    const intervalId = window.setInterval(() => {
      void load();
    }, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    assignmentDetail,
    activeClassroomId,
    cohortStudents.length,
    ASSIGNMENT_PROGRESS_CACHE_KEY,
    mergeAssignmentScores,
  ]);

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        if (!res.ok)
          throw new Error(payload.error || `Failed to remove Google series (${res.status})`);
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
    const isCustomAudience = assignToLabel.trim().toLowerCase().startsWith("custom");
    if (isCustomAudience && assignmentCustomStudentIds.length === 0) {
      toast({
        title: "Pick at least one student",
        description: "Select the students who should receive this assignment.",
        variant: "destructive",
      });
      return;
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
        targetStudentIds: isCustomAudience ? assignmentCustomStudentIds : null,
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
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.05] px-3.5 py-2 text-xs font-semibold tracking-tight text-slate-200 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] transition hover:border-white/20 hover:bg-white/[0.1] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0c14] active:scale-[0.98]"
          >
            <ChevronLeft className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            Back to classrooms
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
                onClick={() => {
                  setAssignmentOpen(true);
                }}
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
                        sections={activeDetail.sections}
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
                        {formatRelativeTime(entry.createdAt)} · +{entry.rdmDelta} RDM
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
                        </div>

                        <div className="flex h-full flex-col rounded-xl border border-sky-500/25 bg-sky-500/5 p-3.5 sm:p-4 lg:col-span-7">
                          <div className="mb-2 text-sm font-semibold text-sky-200">
                            Google Meet &amp; Calendar
                          </div>
                          <p className="mb-3 text-xs text-slate-400">
                            Manage the Meet link and Google Calendar series for this section.
                          </p>

                          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
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
                              <p className="mb-2 text-xs text-slate-400">
                                Meet link will appear after the next calendar sync.
                              </p>
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

                          <button
                            type="button"
                            disabled={
                              googleInviteSyncing ||
                              !sec.googleSeriesLinked ||
                              activeDetail.students.length === 0
                            }
                            onClick={() => void syncStudentCalendarInvites()}
                            className="mb-1 mt-3 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
                          >
                            {googleInviteSyncing
                              ? "Syncing invites…"
                              : "Email calendar invites to students"}
                          </button>
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
                            className="shrink-0 rounded-full border border-violet-500/35 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-100 hover:bg-violet-500/25"
                          >
                            + Add section
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
                                Open a section from the class filter to set its weekly plan and sync
                                Google Calendar for that section only.
                              </li>
                            </ol>
                          </div>
                        ) : (
                          <ul className="space-y-2">
                            {activeDetail.sections.map((sec) => (
                              <li
                                key={sec.id}
                                className="rounded-xl border border-white/10 bg-[#15162b] p-3 sm:p-3.5"
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
                                      className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0c1020] px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500/50"
                                    />
                                  </label>
                                  <div className="flex shrink-0 flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void saveSectionName(sec.id)}
                                      disabled={
                                        sectionNameSavingId === sec.id ||
                                        sectionDeletingId === sec.id
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
                              </li>
                            ))}
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
                    <MeetSessionsStack
                      sessions={room.meetSessions ?? null}
                      fallbackLabel={room.nextSessionLabel}
                    />
                  </div>
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

      <Dialog
        open={wizardOpen}
        onOpenChange={(v) => {
          setWizardOpen(v);
          if (!v) {
            wizardDismissedRef.current = true;
            // Close (X) should not re-open on refresh within same session.
            try {
              window.sessionStorage.setItem(WIZARD_CLOSED_SESSION_KEY, "1");
            } catch {
              // ignore
            }
          }
        }}
      >
        <DialogContent
          hideClose
          className="left-0 top-0 grid h-[100vh] max-h-[100vh] w-screen sm:w-[96vw] max-w-[980px] translate-x-0 translate-y-0 overflow-hidden rounded-none border-r border-white/20 bg-[#07070f] p-0 text-slate-100 shadow-2xl data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:rounded-r-3xl md:max-w-[1240px] lg:max-w-[1320px]"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Teacher Wizard</DialogTitle>
          </DialogHeader>
          <TeacherWizardPopup
            onClose={() => setWizardOpen(false)}
            onHideForever={() => {
              // Hide: close for this view (should reappear after switching tabs/back or refresh).
              setWizardOpen(false);
              wizardDismissedRef.current = true;
            }}
            teacherId={teacherId}
            classrooms={classrooms}
            classroomDetails={classroomDetails}
            onCreateAssignment={onCreateAssignment}
            onCreateClassroom={onCreateClassroom}
            onRefreshTeacherPortal={onRefreshTeacherPortal}
            onMotivateStudents={onMotivateStudents}
            onScheduleLiveSession={onScheduleLiveSession}
            toast={toast}
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
              Create a section (up to 6 per class) and set its recurring schedule. This is what
              syncs to Google Calendar for that section.
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
                    <label className="mb-1 block text-sm font-semibold text-slate-300">
                      Assign to (class / section)
                    </label>
                    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <button
                        type="button"
                        onClick={() => {
                          assignmentScopeTouchedRef.current = true;
                          setAssignmentTargetSectionId(null);
                        }}
                        className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs font-semibold ${
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
                      <span className="font-semibold text-slate-400">Class</span> = post is visible
                      to every enrolled student (recommended when Audience is &quot;All
                      students&quot;).{" "}
                      <span className="font-semibold text-slate-400">A section</span> = only
                      students whose <span className="italic">teaching section</span> in Members
                      matches this section see it in{" "}
                      <span className="font-semibold">Classroom → Posts</span>.
                    </p>
                    {assignToLabel.trim().toLowerCase() === "all students" &&
                    assignmentTargetSectionId != null ? (
                      <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1.5 text-[11px] font-semibold text-amber-100">
                        Audience says &quot;All students&quot;, but you have a{" "}
                        <span className="italic">section</span> selected below — only students in
                        that teaching section will see this in Posts. Choose{" "}
                        <span className="font-bold">Class</span> for a true whole-class assignment.
                      </p>
                    ) : null}
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
                    <div className="space-y-4">
                      <ChapterQuizAssignmentFields
                        taxonomy={curriculumTaxonomy}
                        taxonomyLoading={curriculumLoading}
                        taxonomyError={curriculumError}
                        value={chapterQuizSel}
                        onChange={setChapterQuizSel}
                        selectClassName={selectClassName}
                      />

                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
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
                    </div>
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
                <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-2 text-xs text-sky-100">
                  <span className="font-semibold text-sky-200">Student Posts feed:</span>{" "}
                  {assignmentDetail.sectionId == null
                    ? "Whole class — every enrolled student can see this post."
                    : `${activeDetail.sections.find((s) => s.id === assignmentDetail.sectionId)?.name?.trim() || "This teaching section"} — only students placed in that section see it.`}
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
                                  {assignmentScores.length}/{cohortStudents.length} submitted
                                </span>
                              ) : null}
                            </div>
                            {t.href && assignmentDetail.type !== "Concept Focus" ? (
                              <div className="mt-1 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const rawHref = t.href ?? "";
                                    const postId = assignmentDetail?.id ?? "";
                                    const classroomId = activeClassroomId ?? "";
                                    const resolved = rawHref
                                      .replace(/\{\{POST_ID\}\}/g, postId)
                                      .replace(/\{\{CLASSROOM_ID\}\}/g, classroomId)
                                      // Also replace URL-encoded placeholder tokens if present
                                      .replace(/%7B%7BPOST_ID%7D%7D/gi, encodeURIComponent(postId))
                                      .replace(
                                        /%7B%7BCLASSROOM_ID%7D%7D/gi,
                                        encodeURIComponent(classroomId)
                                      );
                                    if (t.kind === "chapter_quiz") {
                                      const ref = assignmentDetail?.chapterQuiz ?? null;
                                      setTaskPreview({
                                        open: true,
                                        href: resolved,
                                        mode: "chapter-quiz-preview",
                                        title: t.label || "Task preview",
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
                                      return;
                                    }
                                    openTaskPreview(resolved, t.label);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[11px] font-semibold text-violet-300 hover:bg-violet-500/20"
                                >
                                  <ExternalLink className="h-3 w-3" /> Open task link
                                </button>
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
                                    Updated: {formatRelativeTime(r.updatedAt)}
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

                {/* Student Scores */}
                {assignmentDetail.tasks?.some(
                  (t) =>
                    t.kind === "chapter_quiz" ||
                    t.kind === "mock_paper" ||
                    t.href?.includes("/assignment-test/") ||
                    t.href?.includes("panel=quiz") ||
                    t.href?.includes("/mock")
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
                              Updated {formatRelativeTime(assignmentScoresLastUpdatedAt)}
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
                            const pct = Math.round((s.score / Math.max(1, s.total)) * 100);
                            return (
                              <div
                                key={s.userId}
                                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-2.5 transition hover:bg-white/2 sm:grid-cols-[1fr_auto_auto_auto_auto]"
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
                                <div className="flex justify-end">
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
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {!assignmentScoresLoading && cohortStudents.length > assignmentScores.length ? (
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

function restoreLatexEscapes(input: string): string {
  // If LaTeX was stored in JSON with single backslashes, sequences like "\text" become "\t" (TAB) + "ext".
  // This restores the common ones we see in Bits questions.
  return input
    .replace(/\t(?=ext\{)/g, "\\\\t") // \text{...}
    .replace(/\u000c(?=rac\{)/g, "\\\\f") // \frac{...}{...}
    .replace(/\r(?=ightarrow|Rightarrow)/g, "\\\\r") // \rightarrow / \Rightarrow
    .replace(/\u0008(?=eta\b)/g, "\\\\b") // \beta
    .replace(/\u000b(?=ec\b)/g, "\\\\v"); // \vec
}

function TaskPreviewBody(props: {
  href: string;
  mode: "assignment-test" | "mock-paper" | "chapter-quiz-preview" | "iframe";
  title: string;
  chapterQuizRef?: {
    board: string;
    subject: string;
    classLevel: number;
    topic: string;
    subtopicName: string;
    level: string;
    advancedSet?: 1 | 2 | 3;
  };
}) {
  const [loading, setLoading] = useState(props.mode !== "iframe");
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<{
    testTitle: string;
    questions: Array<{
      id: string;
      question: string;
      questionHtml?: string;
      options: string[];
      correctAnswerIndex?: number | null;
    }>;
  } | null>(null);

  useEffect(() => {
    if (props.mode === "iframe") return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      setPayload(null);
      try {
        const href = props.href;
        const url =
          href.startsWith("http://") || href.startsWith("https://")
            ? new URL(href)
            : new URL(href, "https://edublast.local");

        if (props.mode === "assignment-test") {
          const m = url.pathname.match(/\/classroom\/([^/]+)\/assignment-test\/([^/?#]+)/i);
          const classroomId = (m?.[1] ?? url.searchParams.get("classroomId") ?? "").trim();
          const postId = (m?.[2] ?? url.searchParams.get("postId") ?? "").trim();
          if (!classroomId || !postId)
            throw new Error("Unsupported task link (missing classroomId/postId).");
          const { session } = await safeGetSession();
          const headers: HeadersInit = {};
          if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
          const res = await fetch(
            `/api/classroom/${classroomId}/posts/${postId}/generated-test-attempt`,
            {
              headers,
              credentials: "include",
            }
          );
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            testTitle?: string;
            questions?: Array<{
              id: string;
              question: string;
              options: string[];
              correctAnswerIndex?: number | null;
            }>;
          };
          if (!res.ok) throw new Error(data.error || `Failed to load (${res.status})`);
          const questions = Array.isArray(data.questions) ? data.questions : [];
          if (!cancelled) setPayload({ testTitle: data.testTitle ?? props.title, questions });
        } else if (props.mode === "chapter-quiz-preview") {
          // Questions-only preview (no attempts). Use the same subtopic-content fetch + set slicing
          // logic as `ChapterQuizAssignmentFields` (the "Bits preview" modal).
          const ref = props.chapterQuizRef ?? null;
          const subject = (ref?.subject ?? "").trim().toLowerCase();
          const classLevelRaw = Number(ref?.classLevel);
          const topic = (ref?.topic ?? "").trim();
          const subtopicName = (ref?.subtopicName ?? "").trim();
          const quizSet = Number(ref?.advancedSet ?? 1) || 1;
          const boardUpper =
            (ref?.board ?? "cbse").trim().toLowerCase() === "icse"
              ? ("ICSE" as const)
              : ("CBSE" as const);

          if (!subject || Number.isNaN(classLevelRaw) || !topic || !subtopicName) {
            throw new Error("Preview unavailable (missing chapter quiz metadata).");
          }

          const row = await fetchSubtopicContent({
            board: boardUpper,
            subject:
              subject === "physics" || subject === "chemistry" || subject === "math"
                ? (subject as "physics" | "chemistry" | "math")
                : "physics",
            classLevel: classLevelRaw === 11 ? 11 : 12,
            topic,
            subtopicName,
            level: "advanced",
          });

          const all = Array.isArray(row.bitsQuestions) ? row.bitsQuestions : [];
          let slice = all;
          if (all.length > 10) {
            const bounds = getAdvancedSetBounds(
              all.length,
              Math.max(1, Math.min(3, quizSet)) as 1 | 2 | 3
            );
            slice = all.slice(bounds.start, bounds.end);
          }

          const questions = slice.map((q, idx) => ({
            id: `bits-${idx + 1}`,
            question: restoreLatexEscapes(
              typeof q.question === "string" ? q.question : String(q.question ?? "")
            ),
            options: Array.isArray(q.options)
              ? q.options
                  .map((o) => restoreLatexEscapes(typeof o === "string" ? o : String(o ?? "")))
                  .filter((o) => o.trim().length > 0)
              : [],
            correctAnswerIndex: null,
          }));

          if (!cancelled) setPayload({ testTitle: props.title, questions });
        } else if (props.mode === "mock-paper") {
          const slug = url.searchParams.get("paper")?.trim() ?? "";
          if (!slug) throw new Error("Mock paper not specified.");
          // Use untyped client access here because the generated Supabase types in this repo
          // don't include `mock_papers`/`mock_questions` in the strict union.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mockClient = supabase as any;
          const { data: paperRow, error: paperErr } = await mockClient
            .from("mock_papers")
            .select("id, title")
            .eq("slug", slug)
            .maybeSingle();
          if (paperErr) throw paperErr;
          if (!paperRow?.id) throw new Error("Mock paper not found.");
          const questionsFull = await fetchMockQuestionsForPaper(String(paperRow.id));
          const questions = questionsFull.map((q) => ({
            id: q.id,
            question: q.question,
            questionHtml: q.questionHtml ?? undefined,
            options: q.options,
          }));
          if (!cancelled)
            setPayload({ testTitle: String(paperRow.title ?? props.title), questions });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load task.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [props.href, props.mode, props.title, props.chapterQuizRef]);

  return (
    <div className="flex max-h-[86vh] flex-col sm:max-h-[90vh]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
            Task preview
          </div>
          <div className="mt-1 truncate font-serif text-lg text-slate-50 sm:text-xl">
            {payload?.testTitle ?? props.title}
          </div>
        </div>
      </div>

      {props.mode === "iframe" ? (
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/20 px-4 py-2.5 sm:px-5 sm:py-3">
            <div className="min-w-0 truncate text-xs text-slate-400">{props.href}</div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15"
                onClick={() => window.open(props.href, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="h-4 w-4" />
                Open
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(props.href);
                  } catch {
                    // ignore
                  }
                }}
              >
                Copy
              </button>
            </div>
          </div>
          <iframe
            src={props.href}
            className="h-[62vh] w-full bg-[#07070f] sm:h-[72vh]"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        </div>
      ) : (
        <div className="min-h-[40vh] px-4 py-4 sm:px-5 sm:py-5">
          {loading ? (
            <div className="flex min-h-[34vh] items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading questions…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              {error}
            </div>
          ) : payload && payload.questions.length ? (
            <div className="max-h-[60vh] overflow-y-auto pr-1 sm:max-h-[65vh]">
              <GeneratedMcqReview
                questions={payload.questions.map((q) => ({
                  id: q.id,
                  question: restoreLatexEscapes(
                    q.questionHtml?.trim() ? q.questionHtml : q.question
                  ),
                  options: q.options.map((o) => restoreLatexEscapes(o)),
                  correctAnswerIndex: q.correctAnswerIndex ?? null,
                }))}
                answers={new Array(payload.questions.length).fill(-1)}
                total={payload.questions.length}
                submitted={false}
                showCorrectAnswers={false}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-400">
              No questions found for this task.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
