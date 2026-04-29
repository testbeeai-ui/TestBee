import type { AssignmentTaskStored } from "@/lib/classroom/assignmentTasks";
import type { DifficultyLevel } from "@/lib/slugs";
import type { ClassLevel, Subject } from "@/types";

export type TeacherPortalSection =
  | "myClassroom"
  | "myClasses"
  | "gyanWall"
  | "createTests"
  | "referEarn"
  | "profile";

export interface TeacherPortalClassroomCard {
  id: string;
  name: string;
  subject: string | null;
  section: string | null;
  description: string | null;
  /** Optional YouTube/Vimeo intro video for the class home page. */
  introVideoUrl: string | null;
  /** Google Meet link from Calendar API when class is synced */
  googleMeetLink: string | null;
  /** Nearest upcoming/live session meet link (prefers section-scoped when applicable). */
  nextMeetLink?: string | null;
  /** "Whole class" or "Only <Section Name>" for the nearest meet link/session. */
  nextMeetScopeLabel?: string | null;
  /** ISO timestamp of nearest upcoming/live session (for countdown). */
  nextSessionAt?: string | null;
  /** Section id for nearest upcoming/live session (null = whole class). */
  nextSessionSectionId?: string | null;
  /** Duration minutes of nearest upcoming/live session (optional; improves live countdown). */
  nextSessionDurationMinutes?: number | null;
  /** Upcoming/live Meet sessions for dashboard stacking (supports overlaps). */
  meetSessions?: TeacherPortalMeetSession[];
  /** True when a recurring Google Calendar series is linked */
  googleSeriesLinked: boolean;
  /** Short join code students use to find this class */
  joinCode: string;
  /** When true, teacher portal may show seeded demo students/banners for investor UX */
  isDemoShowcase: boolean;
  studentCount: number;
  assignmentCount: number;
  /** Class average score (%); null until backed by real attempt/analytics data */
  avgScorePercent: number | null;
  nextSessionLabel: string;
  scheduleLabel: string;
}

export interface TeacherPortalMeetSession {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  meetLink: string | null;
  sectionId: string | null;
  sectionName: string | null;
  scopeLabel: string | null;
}

export interface TeacherPortalClassroomStudent {
  userId: string;
  name: string;
  avatarUrl: string | null;
  joinedAt: string;
  lastActiveAt: string | null;
  role: string;
  /** Section membership inside the classroom (null = Unassigned) */
  sectionId: string | null;
  rdm: number;
  /** Per-student average score (%); null until backed by real attempt data */
  avgScorePercent: number | null;
  streakDays: number;
  status: "active" | "off_streak" | "at_risk";
}

export interface TeacherPortalClassroomSection {
  id: string;
  name: string;
  sortOrder: number;
  scheduleLabel: string | null;
  googleMeetLink: string | null;
  googleSeriesLinked: boolean;
}

export interface TeacherPortalMotivationLogItem {
  id: string;
  classroomId: string;
  sectionId: string | null;
  actionKind: "boost" | "nudge" | "urgent_nudge" | "reward_top_students";
  message: string;
  targetStudentIds: string[];
  rdmDelta: number;
  createdAt: string;
  createdBy: string;
}

/** When a mock assignment targets a catalog paper from `mock_papers`. */
export interface TeacherPortalMockPaperRef {
  id: string;
  slug: string;
  title: string;
}

/** DailyDose / Streak assignment — one of five Funbrain Elo lanes (Verbal … GK). */
export interface TeacherPortalDailyDoseStreakRef {
  trackId: string;
  trackLabel: string;
}

/** Gyan++ engagement — optional class focus text for doubts (see assignment instructions too). */
export interface TeacherPortalGyanEngagementRef {
  topicFocus: string;
  subtopicHint: string;
}

/** Chapter quiz (Bits) anchor — matches syllabus + subtopic-engagement / bits-attempts scope. */
export interface TeacherPortalChapterQuizRef {
  board: string;
  subject: Subject;
  classLevel: ClassLevel;
  chapterTitle: string;
  /** Syllabus lesson title (`TopicNode.topic`). */
  topic: string;
  subtopicName: string;
  level: DifficultyLevel;
  /** Present when `level` is `advanced` (Set 1–3). */
  advancedSet?: 1 | 2 | 3;
}

export interface TeacherPortalAssignmentItem {
  id: string;
  title: string;
  type: string;
  sectionId: string | null;
  dueDateIso: string | null;
  dueDateLabel: string;
  assignedToLabel: string;
  rewardRdm: number;
  instructions: string;
  completionPercent: number;
  completedCount: number;
  totalCount: number;
  /** Structured checklist; may include teacher-only (hidden) steps */
  tasks: AssignmentTaskStored[];
  /** Set for `mock` posts when teacher picked a published paper */
  mockPaper?: TeacherPortalMockPaperRef | null;
  /** Set for `quiz` posts when teacher picked syllabus + subtopic + tier/set */
  chapterQuiz?: TeacherPortalChapterQuizRef | null;
  /** Set for DailyDose streak assignments when teacher picked a Funbrain lane */
  dailyDoseStreak?: TeacherPortalDailyDoseStreakRef | null;
  /** Set for Gyan++ engagement assignments (student → /doubts, teacher → Gyan++ Wall) */
  gyanEngagement?: TeacherPortalGyanEngagementRef | null;
}

export interface TeacherPortalClassroomDetail {
  classroomId: string;
  sections: TeacherPortalClassroomSection[];
  students: TeacherPortalClassroomStudent[];
  assignments: TeacherPortalAssignmentItem[];
  motivationLog: TeacherPortalMotivationLogItem[];
  topStreakStudentIds: string[];
}

export type TeacherPortalSessionWorkKind = "custom" | "concept_focus" | "none";

export interface TeacherPortalSessionItem {
  id: string;
  classroomId: string;
  sectionId: string | null;
  sectionName: string | null;
  classroomName: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  meetLink: string | null;
  studentCount: number;
  status: string;
  isTrial: boolean;
  rewardRdm: number;
  /** Legacy checklist lines; prefer `preWorkDisplay` for UI. */
  preWork: string[];
  /** Legacy checklist lines; prefer `postWorkDisplay` for UI. */
  postWork: string[];
  /** True when a `session_plan` post matched this session (authoritative work copy). */
  sessionPlanAttached: boolean;
  preWorkKind: TeacherPortalSessionWorkKind;
  postWorkKind: TeacherPortalSessionWorkKind;
  /** Custom instructions or full concept-focus path for students. */
  preWorkDisplay: string;
  postWorkDisplay: string;
  /** When a plan exists: when post-work unlocks relative to class end. */
  postWorkReleaseLabel: string | null;
  resources: Array<{ label: string; href: string | null }>;
}

export interface TeacherPortalWallItem {
  doubtId: string;
  title: string;
  body: string;
  subject: string | null;
  createdAt: string;
  askerName: string;
  askerRole: string | null;
  upvotes: number;
  peerCommentsCount: number;
  aiAnswerBody: string | null;
  teacherAnswersCount: number;
  hasTeacherAnswer: boolean;
  /** True when the currently signed-in teacher has already posted a Teacher Section on this doubt. */
  hasCurrentTeacherAnswer: boolean;
  /** Preview snippet of the current teacher's most recent Teacher Section (if any). */
  currentTeacherAnswerPreview: string | null;
}

export interface TeacherPortalProfileView {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  subjects: string[];
  examTags: string[];
  teachingLevels: number[];
  visibility: string;
  rdm: number;
  studentsHelped: number;
  expertAnswers: number;
  avgUpvotes: number;
  details: {
    location: string | null;
    qualification: string | null;
    experience: string | null;
    email: string | null;
    phone: string | null;
    youtubeOrSocial: string | null;
    docs: {
      aadharPhotoUrl: string | null;
      aadharShareLink: string | null;
      instituteCertificatePhotoUrl: string | null;
      instituteCertificateShareLink: string | null;
    };
  };
}

export interface TeacherPortalSummary {
  /** Teacher has completed Google Calendar OAuth (refresh token stored server-side). */
  googleCalendarConnected: boolean;
  activeClassrooms: number;
  totalStudents: number;
  assignmentsActive: number;
  /** Cross-class average completion (%); null until backed by real submission data */
  avgCompletionPercent: number | null;
  rdmDistributedMonth: number;
  questionsToday: number;
  teacherSectionsWritten: number;
  teacherRdmWeek: number;
  avgTeacherUpvotes: number;
}

export interface TeacherPortalReferStats {
  rdmBalance: number;
  referralLink: string;
  teachersReferred: number;
  studentsReferred: number;
  teacherRewardRdm: number;
  studentRewardRdm: number;
  teacherMilestoneBonusRdm: number;
}

export interface TeacherPortalDataBundle {
  summary: TeacherPortalSummary;
  classrooms: TeacherPortalClassroomCard[];
  sessions: TeacherPortalSessionItem[];
  classroomDetails: Record<string, TeacherPortalClassroomDetail>;
  wallItems: TeacherPortalWallItem[];
  profile: TeacherPortalProfileView;
  referStats: TeacherPortalReferStats;
}
