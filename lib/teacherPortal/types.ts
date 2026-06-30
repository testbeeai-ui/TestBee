import type { SubscriptionPlanKey } from "@/lib/subscription/subscriptionConfig";
import type { TeacherPlanKey } from "@/lib/teacherPortal/teacherPlan";
import type { AssignmentTaskStored } from "@/lib/classroom/assignmentTasks";
import type { AdvancedQuizSetIndex } from "@/lib/play/quiz/advancedQuizSets";
import type { DifficultyLevel } from "@/lib/slugs";
import type { ClassLevel, Subject } from "@/types";

export type TeacherPortalSection =
  | "myClassroom"
  | "myClasses"
  | "gyanWall"
  | "createTests"
  | "referEarn"
  | "subscriptions"
  | "profile";

export interface TeacherPortalClassroomCard {
  id: string;
  name: string;
  subject: string | null;
  section: string | null;
  description: string | null;
  /** False => classroom hidden from Explore (/classrooms) listings. */
  allowAdhocTrial?: boolean;
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
  /** Resolved student subscription tier (for MCQ sponsorship billing previews). */
  subscriptionPlan?: SubscriptionPlanKey;
}

export interface TeacherPortalClassroomSection {
  id: string;
  name: string;
  sortOrder: number;
  scheduleLabel: string | null;
  /** ISO date (YYYY-MM-DD) when the schedule stops; null means ongoing. */
  scheduleEndDate?: string | null;
  /** False when the section is expired/archived (no new assignments/messages/sessions). */
  isActive?: boolean;
  googleMeetLink: string | null;
  googleSeriesLinked: boolean;
  /** Expected delivery reward per ended schedule occurrence (base + capped roster bonus). */
  expectedDeliveryRdm?: number;
  /** Sum of delivery RDM already granted for this section schedule. */
  deliveryRdmGrantedTotal?: number;
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

/** When a past-paper assignment targets a catalog paper from `past_papers`. */
export interface TeacherPortalPastPaperRef {
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

/** Chapter quiz anchor — matches syllabus + subtopic-engagement / bits-attempts scope. */
export interface TeacherPortalChapterQuizRef {
  board: string;
  subject: Subject;
  classLevel: ClassLevel;
  chapterTitle: string;
  /** Syllabus lesson title (`TopicNode.topic`). */
  topic: string;
  subtopicName: string;
  level: DifficultyLevel;
  /** Present when `level` is `advanced` (Set 1–6). */
  advancedSet?: AdvancedQuizSetIndex;
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
  /** Set for `past_paper` posts when teacher picked a published past paper */
  pastPaper?: TeacherPortalPastPaperRef | null;
  /** Set for `quiz` posts when teacher picked syllabus + subtopic + tier/set */
  chapterQuiz?: TeacherPortalChapterQuizRef | null;
  /** Set for DailyDose streak assignments when teacher picked a Funbrain lane */
  dailyDoseStreak?: TeacherPortalDailyDoseStreakRef | null;
  /** Set for Gyan++ engagement assignments (student → /doubts, teacher → Gyan++ Wall) */
  gyanEngagement?: TeacherPortalGyanEngagementRef | null;
  /** True when this post is a teacher-generated classroom MCQ (`content_json.generatedTestPaper`). */
  isGeneratedClassroomMcq?: boolean;
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
  /** Extra Schedule Live Session rows do not earn delivery RDM (Path B). Kept for compat; always 0. */
  rewardRdm: number;
  deliveryRdmAwarded: number | null;
  deliveryRdmGrantedAt: string | null;
  deliveryRdmStudentCount: number | null;
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
  /** Teacher subscription tier (free | starter | pro). */
  teacherPlanTier: TeacherPlanKey;
  teacherPlanExpiresAt: string | null;
  details: {
    location: string | null;
    qualification: string | null;
    experience: string | null;
    email: string | null;
    /** Last OTP-verified contact email (lowercase); compare with `email` for badge. */
    verifiedContactEmail: string | null;
    /** When contact email was verified via OTP. */
    contactEmailVerifiedAt: string | null;
    verificationStatus: TeacherVerificationStatus;
    adminNotes: string | null;
    submittedAt: string | null;
    reviewedAt: string | null;
    approvedAt: string | null;
    rejectedAt: string | null;
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

export type TeacherVerificationStatus = "unverified" | "pending" | "approved" | "rejected";

export interface TeacherPortalSummary {
  /** Teacher has completed Google Calendar OAuth (refresh token stored server-side). */
  googleCalendarConnected: boolean;
  /** Google account email connected for Calendar/Meet (Meet host). */
  googleCalendarEmail?: string | null;
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
  /** 7-hex referral code (first 7 hex chars of the teacher profile id, uppercased). */
  referralCode: string;
  /** Relative share path `/join?ref=<code>`; callers prepend the origin when copying. */
  referralLink: string;
  teachersReferred: number;
  studentsReferred: number;
  /** Total RDM credited from teacher→teacher signup + paid bonuses. */
  teacherReferralRdmEarned: number;
  /** Total RDM credited from teacher→student signup + paid bonuses. */
  studentReferralRdmEarned: number;
  teacherRewardRdm: number;
  studentRewardRdm: number;
  teacherMilestoneBonusRdm: number;
  /** RDM when a referred teacher completes signup/onboarding. */
  teacherSignupRewardRdm: number;
  /** RDM when a referred student completes signup via the teacher link. */
  teacherStudentSignupRewardRdm: number;
  /** RDM when a referred teacher or student goes paid within the window. */
  teacherPaidBonusRdm: number;
  teacherPaidWindowDays: number;
}

/** Submitted mock attempt under 60% for nudge wizard ( keyed by assignment post id ). */
export type TeacherPortalMockNudgeLowScorer = {
  userId: string;
  pct: number;
  submittedAt: string;
};

/** Latest submitted attempt per student on this post (any score) — wizard context when no one is under 60%. */
export type TeacherPortalMockNudgeSubmittedAttempt = {
  userId: string;
  pct: number;
  submittedAt: string;
};

export interface TeacherPortalDataBundle {
  summary: TeacherPortalSummary;
  classrooms: TeacherPortalClassroomCard[];
  sessions: TeacherPortalSessionItem[];
  classroomDetails: Record<string, TeacherPortalClassroomDetail>;
  wallItems: TeacherPortalWallItem[];
  profile: TeacherPortalProfileView;
  referStats: TeacherPortalReferStats;
  /**
   * Post ids for nudge “low scorers this week”: catalog `mock`, syllabus `quiz` (chapter MCQ), or `assignment`
   * with generated classroom MCQ — timestamp is max(created_at, updated_at) within the current IST calendar week.
   */
  mockPostIdsAssignedThisWeek: string[];
  /** Per mock post: students with a submitted attempt and score/total &lt; 60%. */
  mockNudgeLowScorersByPostId: Record<string, TeacherPortalMockNudgeLowScorer[]>;
  /** Per post this week: latest submitted attempt per student (any score), from classroom attempts. */
  mockNudgeSubmittedAttemptsByPostId: Record<string, TeacherPortalMockNudgeSubmittedAttempt[]>;
}
