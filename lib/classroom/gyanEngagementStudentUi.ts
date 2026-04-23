import type { Json } from "@/integrations/supabase/types";
import { parseAssignmentTasks, studentVisibleTasks } from "@/lib/classroom/assignmentTasks";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export type GyanEngagementStudentViewModel = {
  taskLabel: string;
  href: string;
  instructions: string;
  topicFocus: string;
  subtopicHint: string;
};

/** When the assignment includes a student-visible Gyan++ task, drive the enlarged student UI. */
export function getGyanEngagementStudentViewModel(
  contentJson: Json | null | undefined,
  postType: string
): GyanEngagementStudentViewModel | null {
  const tasks = studentVisibleTasks(parseAssignmentTasks(contentJson, postType));
  const gyan = tasks.find((t) => t.kind === "gyan_engagement");
  if (!gyan) return null;

  let instructions = "";
  let topicFocus = "";
  let subtopicHint = "";
  if (isRecord(contentJson)) {
    const ins = contentJson.instructions;
    if (typeof ins === "string") instructions = ins.trim();
    const ge = contentJson.gyanEngagement;
    if (isRecord(ge)) {
      if (typeof ge.topicFocus === "string") topicFocus = ge.topicFocus.trim();
      if (typeof ge.subtopicHint === "string") subtopicHint = ge.subtopicHint.trim();
    }
  }

  const rawHref = gyan.href?.trim();
  const href =
    rawHref && (rawHref.startsWith("/") || /^https?:\/\//i.test(rawHref)) ? rawHref : "/doubts";

  return {
    taskLabel: gyan.label.trim() || "Post a doubt on Gyan++",
    href,
    instructions,
    topicFocus,
    subtopicHint,
  };
}

export function assignmentInstructionsFromContentJson(
  contentJson: Json | null | undefined
): string {
  if (!isRecord(contentJson)) return "";
  const ins = contentJson.instructions;
  return typeof ins === "string" ? ins.trim() : "";
}
