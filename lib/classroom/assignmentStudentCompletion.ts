import type { Json } from "@/integrations/supabase/types";
import {
  parseAssignmentTasks,
  studentVisibleTasks,
  type AssignmentTaskStored,
} from "@/lib/classroom/assignmentTasks";
import {
  isConceptFocusLessonChecklistComplete,
  type StudentLessonMarkCompletionRow,
} from "@/lib/classroom/conceptFocusLessonCompletion";

export type AssignmentAudienceMember = {
  userId: string;
  sectionId?: string | null;
};

/** Students who should count toward assignment completion (section, custom audience, or whole class). */
export function resolveAssignmentAudienceStudentIds(
  contentJson: unknown,
  classroomStudentIds: string[],
  opts?: {
    postSectionId?: string | null;
    members?: AssignmentAudienceMember[];
  }
): string[] {
  if (!contentJson || typeof contentJson !== "object" || Array.isArray(contentJson)) {
    return classroomStudentIds;
  }
  const payload = contentJson as Record<string, unknown>;
  const rawTargets = payload.targetStudentIds;
  const targets = Array.isArray(rawTargets)
    ? rawTargets
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
    : [];
  const kind = typeof payload.assignToKind === "string" ? payload.assignToKind.trim() : "";
  const label = typeof payload.assignToLabel === "string" ? payload.assignToLabel.trim() : "";
  const isCustom =
    kind === "custom" || label.toLowerCase().startsWith("custom");
  if (isCustom && targets.length > 0) {
    const roster = new Set(classroomStudentIds);
    const filtered = targets.filter((id) => roster.has(id));
    if (filtered.length > 0) return filtered;
  }

  const postSectionId =
    typeof opts?.postSectionId === "string" && opts.postSectionId.trim()
      ? opts.postSectionId.trim()
      : null;
  if (postSectionId && opts?.members?.length) {
    const sectionStudentIds = opts.members
      .filter((m) => classroomStudentIds.includes(m.userId))
      .filter((m) => String(m.sectionId ?? "") === postSectionId)
      .map((m) => m.userId);
    if (sectionStudentIds.length > 0) return sectionStudentIds;
  }

  return classroomStudentIds;
}

/** Mirrors `studentVisibleAssignmentIsDone` in ClassFeed for a single student. */
export function isStudentAssignmentComplete(input: {
  postType: string;
  contentJson: unknown;
  completedTaskIds: Set<string>;
  hasSubmittedAttempt: boolean;
  subtopicEngagement: unknown;
  lessonMarks?: StudentLessonMarkCompletionRow[] | null;
  visibleTasks?: AssignmentTaskStored[];
}): boolean {
  const {
    postType,
    contentJson,
    completedTaskIds,
    hasSubmittedAttempt,
    subtopicEngagement,
    lessonMarks,
  } = input;

  if (postType === "Concept Focus") {
    return (
      completedTaskIds.has("concept-focus-subtopic") ||
      isConceptFocusLessonChecklistComplete(subtopicEngagement, contentJson, lessonMarks)
    );
  }

  const tasks =
    input.visibleTasks ??
    studentVisibleTasks(
      parseAssignmentTasks((contentJson as Json) ?? null, postType)
    );
  if (tasks.length === 0) return false;

  for (const t of tasks) {
    if (t.kind === "chapter_quiz" || t.kind === "mock_paper" || t.kind === "past_paper") {
      if (completedTaskIds.has(t.id) || hasSubmittedAttempt) continue;
      return false;
    }
    if (t.kind === "gyan_engagement") {
      if (!completedTaskIds.has(t.id)) return false;
      continue;
    }
    if (t.kind === "free_text" && !t.href && t.visible_to_student) {
      if (!completedTaskIds.has(t.id)) return false;
      continue;
    }
    if (
      t.kind === "bits" ||
      t.kind === "instacue" ||
      t.kind === "daily_dose" ||
      t.kind === "topic_path" ||
      t.kind === "external_link" ||
      (t.kind === "free_text" && t.href)
    ) {
      if (!completedTaskIds.has(t.id)) return false;
      continue;
    }
  }
  return true;
}

export function countStudentsAssignmentComplete(input: {
  postType: string;
  contentJson: unknown;
  studentIds: string[];
  progressForPost: Array<{ task_id: string; user_id: string }>;
  submittedUserIds: Set<string>;
  engagementByUser: Map<string, unknown>;
  lessonMarksByUser?: Map<string, StudentLessonMarkCompletionRow[]>;
  visibleTasks?: AssignmentTaskStored[];
}): number {
  const { studentIds, progressForPost, submittedUserIds, engagementByUser, lessonMarksByUser } =
    input;
  if (studentIds.length === 0) return 0;

  const tasksByUser = new Map<string, Set<string>>();
  for (const row of progressForPost) {
    const set = tasksByUser.get(row.user_id) ?? new Set<string>();
    set.add(row.task_id);
    tasksByUser.set(row.user_id, set);
  }

  let done = 0;
  for (const uid of studentIds) {
    if (
      isStudentAssignmentComplete({
        postType: input.postType,
        contentJson: input.contentJson,
        completedTaskIds: tasksByUser.get(uid) ?? new Set(),
        hasSubmittedAttempt: submittedUserIds.has(uid),
        subtopicEngagement: engagementByUser.get(uid),
        lessonMarks: lessonMarksByUser?.get(uid),
        visibleTasks: input.visibleTasks,
      })
    ) {
      done++;
    }
  }
  return done;
}
