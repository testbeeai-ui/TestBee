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

import { WIZARD_TASKS } from "./constants";

/** Persist Teacher Wizard navigation + Task 1 classroom draft across Prev/Next and dialog close (sessionStorage). */
const TP_WIZARD_SUBJECTS = [
  "Physics",
  "Chemistry",
  "Mathematics",
  "Physics + Maths",
  "Full PCM",
] as const;
const TP_WIZARD_PUC = ["PUC 1", "PUC 2", "Both"] as const;
const TP_WIZARD_EXAMS = [
  "JEE Advanced",
  "JEE Main",
  "KCET",
  "CBSE Board",
  "State Board",
  "NEET",
] as const;

export type TPWizardSubject = (typeof TP_WIZARD_SUBJECTS)[number];
export type TPWizardPuc = (typeof TP_WIZARD_PUC)[number];
export type TPWizardExam = (typeof TP_WIZARD_EXAMS)[number];

export type WizardSectionDraftPersist = {
  name: string;
  scheduleDate: string;
  scheduleTime: string;
  durationMinutes: number;
  repeatDays: string[];
  scheduleEndDate: string | null;
};

export type WizardShellPersistedV2 = {
  v: 2;
  collapsed: boolean;
  activeTask: number | null;
  currentSteps: number[];
  createdSummary: { classroomId: string; joinCode: string; classroomName: string } | null;
  cwName: string;
  cwSubject: TPWizardSubject;
  cwPucLevel: TPWizardPuc;
  cwExamTarget: TPWizardExam;
  cwAllowAdhocTrial: boolean;
  cwSections: WizardSectionDraftPersist[];
  cwSectionName: string;
  cwSectionScheduleDate: string;
  cwSectionScheduleTime: string;
  cwSectionDurationMinutes: number;
  cwSectionRepeatDays: string[];
  cwSectionScheduleEndDate: string;
};

export function coerceTPSubject(v: unknown): TPWizardSubject {
  return typeof v === "string" && (TP_WIZARD_SUBJECTS as readonly string[]).includes(v)
    ? (v as TPWizardSubject)
    : "Physics";
}
export function coerceTPPuc(v: unknown): TPWizardPuc {
  return typeof v === "string" && (TP_WIZARD_PUC as readonly string[]).includes(v)
    ? (v as TPWizardPuc)
    : "PUC 2";
}
export function coerceTPExam(v: unknown): TPWizardExam {
  return typeof v === "string" && (TP_WIZARD_EXAMS as readonly string[]).includes(v)
    ? (v as TPWizardExam)
    : "CBSE Board";
}

export function normalizeWizardShellSteps(raw: unknown): number[] {
  return WIZARD_TASKS.map((task, i) => {
    const arr = Array.isArray(raw) ? raw : [];
    const s = typeof arr[i] === "number" ? arr[i] : 0;
    const max = Math.max(0, task.steps.length - 1);
    return Math.max(0, Math.min(s, max));
  });
}

export function readWizardShellPersisted(teacherId: string): WizardShellPersistedV2 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`teacherPortal.wizardShell.v2:${teacherId}`);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<WizardShellPersistedV2>;
    if (p?.v !== 2) return null;
    const taskCount = WIZARD_TASKS.length;
    const at =
      typeof p.activeTask === "number" && p.activeTask >= 0 && p.activeTask < taskCount
        ? p.activeTask
        : null;
    const sections = Array.isArray(p.cwSections)
      ? p.cwSections
          .slice(0, 6)
          .filter((s): s is WizardSectionDraftPersist => Boolean(s && typeof s === "object"))
          .map((s) => ({
            name: typeof s.name === "string" ? s.name : "",
            scheduleDate: typeof s.scheduleDate === "string" ? s.scheduleDate : "",
            scheduleTime: typeof s.scheduleTime === "string" ? s.scheduleTime : "",
            durationMinutes:
              typeof s.durationMinutes === "number" && Number.isFinite(s.durationMinutes)
                ? s.durationMinutes
                : 90,
            repeatDays: Array.isArray(s.repeatDays)
              ? s.repeatDays.filter((d): d is string => typeof d === "string")
              : [],
            scheduleEndDate:
              typeof s.scheduleEndDate === "string" || s.scheduleEndDate === null
                ? s.scheduleEndDate
                : null,
          }))
      : [];
    const summary =
      p.createdSummary &&
      typeof (p.createdSummary as { classroomId?: string }).classroomId === "string" &&
      typeof (p.createdSummary as { classroomName?: string }).classroomName === "string"
        ? {
            classroomId: (p.createdSummary as { classroomId: string }).classroomId,
            joinCode: String((p.createdSummary as { joinCode?: string }).joinCode ?? ""),
            classroomName: (p.createdSummary as { classroomName: string }).classroomName,
          }
        : null;
    return {
      v: 2,
      collapsed: Boolean(p.collapsed),
      activeTask: at,
      currentSteps: normalizeWizardShellSteps(p.currentSteps),
      createdSummary: summary,
      cwName: typeof p.cwName === "string" ? p.cwName : "",
      cwSubject: coerceTPSubject(p.cwSubject),
      cwPucLevel: coerceTPPuc(p.cwPucLevel),
      cwExamTarget: coerceTPExam(p.cwExamTarget),
      cwAllowAdhocTrial: p.cwAllowAdhocTrial !== false,
      cwSections: sections,
      cwSectionName: typeof p.cwSectionName === "string" ? p.cwSectionName : "",
      cwSectionScheduleDate:
        typeof p.cwSectionScheduleDate === "string" ? p.cwSectionScheduleDate : "",
      cwSectionScheduleTime:
        typeof p.cwSectionScheduleTime === "string" ? p.cwSectionScheduleTime : "",
      cwSectionDurationMinutes:
        typeof p.cwSectionDurationMinutes === "number" &&
        Number.isFinite(p.cwSectionDurationMinutes)
          ? p.cwSectionDurationMinutes
          : 90,
      cwSectionRepeatDays: Array.isArray(p.cwSectionRepeatDays)
        ? p.cwSectionRepeatDays.filter((d): d is string => typeof d === "string")
        : ["Mon", "Wed", "Fri"],
      cwSectionScheduleEndDate:
        typeof p.cwSectionScheduleEndDate === "string" ? p.cwSectionScheduleEndDate : "",
    };
  } catch {
    return null;
  }
}

export function writeWizardShellPersisted(teacherId: string, data: WizardShellPersistedV2): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`teacherPortal.wizardShell.v2:${teacherId}`, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function defaultWizardShellPersisted(): WizardShellPersistedV2 {
  return {
    v: 2,
    collapsed: false,
    activeTask: null,
    currentSteps: WIZARD_TASKS.map(() => 0),
    createdSummary: null,
    cwName: "",
    cwSubject: "Physics",
    cwPucLevel: "PUC 2",
    cwExamTarget: "CBSE Board",
    cwAllowAdhocTrial: true,
    cwSections: [],
    cwSectionName: "",
    cwSectionScheduleDate: "",
    cwSectionScheduleTime: "",
    cwSectionDurationMinutes: 90,
    cwSectionRepeatDays: ["Mon", "Wed", "Fri"],
    cwSectionScheduleEndDate: "",
  };
}

export function buildWizardShellInitialState(teacherId: string): WizardShellPersistedV2 {
  return readWizardShellPersisted(teacherId) ?? defaultWizardShellPersisted();
}

export function ClassroomHelpChip({
  title,
  children,
  tone = "slate",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "slate" | "amber";
}) {
  const [open, setOpen] = useState(false);
  const chip =
    tone === "amber"
      ? "border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15"
      : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10";

  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className="inline-flex"
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Help: ${title}`}
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-extrabold leading-none ${chip}`}
          >
            ?
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[280px] border-white/10 bg-[#15162b] p-3 text-sm text-slate-200 shadow-xl"
        >
          <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
            {title}
          </div>
          <div className="mt-2 text-[13px] leading-snug text-slate-200">{children}</div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
