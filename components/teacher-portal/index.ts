/**
 * Teacher portal components — organized by domain.
 * Import from subfolders (e.g. `@/components/teacher-portal/shell/TeacherPortalShell`)
 * or use named exports from this barrel (`@/components/teacher-portal`).
 */
export { default as MyClassroomView } from "./classroom/my-classroom/MyClassroomView";
export type { MyClassroomViewProps } from "./classroom/my-classroom/types";
export type { TeacherNudgeWithRdmWizardHandle } from "./classroom/my-classroom/wizards/TeacherNudgeWithRdmWizard";

export { default as TeacherPortalShell } from "./shell/TeacherPortalShell";
export { default as TeacherVerificationGate } from "./shell/TeacherVerificationGate";

export { default as GyanWallView } from "./views/gyan/GyanWallView";
export { default as MyClassesView } from "./views/classes/MyClassesView";
export { default as ReferEarnView } from "./views/refer/ReferEarnView";
export { default as TeacherProfileView } from "./views/profile/TeacherProfileView";
export { AvatarCropDialog } from "./views/profile/AvatarCropDialog";
export { default as TeacherWalletView } from "./views/wallet/TeacherWalletView";
export { default as CreateTestsView } from "./views/tests/CreateTestsView";
export { default as GeneratedTestPreview } from "./views/tests/GeneratedTestPreview";

export { default as CreateAssignmentWizard } from "./assignment/CreateAssignmentWizard";
export { default as ChapterQuizAssignmentFields } from "./assignment/fields/ChapterQuizAssignmentFields";
export * from "./assignment/fields/ConceptFocusAssignmentFields";
export { default as ConceptFocusSubtopicPreview } from "./assignment/fields/ConceptFocusSubtopicPreview";
export { default as DailyDoseStreakAssignmentFields } from "./assignment/fields/DailyDoseStreakAssignmentFields";
export { default as GyanEngagementAssignmentFields } from "./assignment/fields/GyanEngagementAssignmentFields";

export { default as ScheduleLiveSessionPanel } from "./live/ScheduleLiveSessionPanel";
export type { ScheduleLiveSessionPayload } from "./live/ScheduleLiveSessionPanel";
export { default as MeetSessionsStack } from "./live/MeetSessionsStack";
export { default as WallTimeSelects } from "./live/WallTimeSelects";
