import type { TeacherPortalAssignmentItem } from "@/lib/teacherPortal/types";

export function getAssignmentTags(item: TeacherPortalAssignmentItem) {
  const tags: Array<{ label: string; color: string }> = [];
  const hasTest = item.tasks.some((t) => t.href?.includes("/assignment-test/"));
  const hasMock =
    item.mockPaper ||
    item.tasks.some((t) => t.href?.includes("/mock") || t.href?.includes("/mock-test"));
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

export function formatAssignmentCardDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Due datetime is strictly before now — surfaces under Past due. Open-ended (no due date) stays Active. */
export function isTeacherAssignmentPastDue(
  item: TeacherPortalAssignmentItem,
  nowMs: number
): boolean {
  const raw = item.dueDateIso;
  if (typeof raw !== "string" || !raw.trim()) return false;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return false;
  return t < nowMs;
}

export function primaryAssignmentBadge(item: TeacherPortalAssignmentItem): {
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

export function visibleTaskCountForCard(item: TeacherPortalAssignmentItem): number {
  const tasks = item.tasks ?? [];
  const visible = tasks.filter((t) => t.visible_to_student).length;
  return visible > 0 ? visible : tasks.length;
}
