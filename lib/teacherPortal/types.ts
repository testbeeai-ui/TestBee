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

export interface TeacherPortalClassroomStudent {
  userId: string;
  name: string;
  avatarUrl: string | null;
  joinedAt: string;
  lastActiveAt: string | null;
  role: string;
  rdm: number;
  /** Per-student average score (%); null until backed by real attempt data */
  avgScorePercent: number | null;
  streakDays: number;
  status: "active" | "off_streak" | "at_risk";
}

export interface TeacherPortalMotivationLogItem {
  id: string;
  classroomId: string;
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
  students: TeacherPortalClassroomStudent[];
  assignments: TeacherPortalAssignmentItem[];
  motivationLog: TeacherPortalMotivationLogItem[];
  topStreakStudentIds: string[];
}

export interface TeacherPortalSessionItem {
  id: string;
  classroomId: string;
  classroomName: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  meetLink: string | null;
  studentCount: number;
  status: string;
  isTrial: boolean;
  rewardRdm: number;
  preWork: string[];
  postWork: string[];
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
