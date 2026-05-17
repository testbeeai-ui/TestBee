import type { AssignmentTaskStored } from "@/lib/classroom/assignmentTasks";
import type { ScheduleLiveSessionPayload } from "@/components/teacher-portal/live/ScheduleLiveSessionPanel";
import type {
  TeacherPortalAssignmentItem,
  TeacherPortalClassroomCard,
  TeacherPortalClassroomDetail,
  TeacherPortalChapterQuizRef,
  TeacherPortalDailyDoseStreakRef,
  TeacherPortalGyanEngagementRef,
  TeacherPortalMockNudgeLowScorer,
  TeacherPortalMockNudgeSubmittedAttempt,
  TeacherPortalMockPaperRef,
  TeacherPortalSummary,
} from "@/lib/teacherPortal/types";
import type { MotivationNudgeGoal, MotivationRecommendActionId } from "@/lib/teacherPortal/queries";

export interface MyClassroomViewProps {
  summary: TeacherPortalSummary;
  classrooms: TeacherPortalClassroomCard[];
  classroomDetails: Record<string, TeacherPortalClassroomDetail>;
  /** Mock, chapter quiz, or generated MCQ post ids this IST week; nudge “low scorers” flow. */
  mockPostIdsAssignedThisWeek?: string[];
  mockNudgeLowScorersByPostId?: Record<string, TeacherPortalMockNudgeLowScorer[]>;
  mockNudgeSubmittedAttemptsByPostId?: Record<string, TeacherPortalMockNudgeSubmittedAttempt[]>;
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
  }) => Promise<{ id: string }>;
  onMotivateStudents: (input: {
    classroomId: string;
    actionKind: "boost" | "nudge" | "urgent_nudge";
    targetStudentIds: string[];
    message: string;
    rdmDelta: number;
    sectionId?: string | null;
    relatedPostId?: string;
    relatedPostTitle?: string;
    recommendActionId?: MotivationRecommendActionId;
    recommendActionLabel?: string;
    recommendActionUrl?: string;
    notificationTitle?: string;
    nudgeGoal?: MotivationNudgeGoal;
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
  /**
   * When false (e.g. admin impersonation), the nudge wizard cannot inline-create mock/quiz assignments
   * — teachers must pick an existing mock/quiz post from the class wall.
   */
  allowNudgeStructuredAssignmentCreate?: boolean;
  /** Schedule live session (same payload as My Classes → createSession). */
  onScheduleLiveSession: (input: ScheduleLiveSessionPayload) => Promise<void>;
  onRequireVerifiedAction?: (actionLabel: string) => Promise<boolean>;
}

export type JoinRequestRow = {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  profiles: { name: string } | null;
};

export type ClassroomCohortTab =
  | { kind: "class" }
  | { kind: "unassigned" }
  | { kind: "section"; id: string };

export type { DetailTab, MotivationMessageType, MotivationTarget } from "./constants";
