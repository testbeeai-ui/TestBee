import { appendQueryParams } from "@/lib/curriculum/topicRoutes";
import type { AssignmentTaskStored } from "@/lib/classroom/assignmentTasks";
import { resolveAssignmentTrackingInHref } from "@/lib/teacherPortal/assignmentPostIdTemplate";

/** Append classroom assignment tracking query params for student task links. */
export function withAssignmentTrackingParams(
  href: string,
  task: Pick<AssignmentTaskStored, "kind" | "id">,
  classroomId: string,
  postId: string
): string {
  if (!href) return href;
  const resolvedHref = resolveAssignmentTrackingInHref(href, postId, classroomId);

  if (task.kind === "gyan_engagement") {
    try {
      const isAbsolute = /^https?:\/\//i.test(resolvedHref);
      const url = isAbsolute
        ? new URL(resolvedHref)
        : new URL(resolvedHref, "https://edublast.local");
      if (!url.searchParams.get("ask")) url.searchParams.set("ask", "1");
      if (!url.searchParams.get("classroomId")) url.searchParams.set("classroomId", classroomId);
      if (!url.searchParams.get("postId")) url.searchParams.set("postId", postId);
      if (!url.searchParams.get("taskId")) url.searchParams.set("taskId", task.id);
      return isAbsolute
        ? url.toString()
        : `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return appendQueryParams("/doubts", {
        ask: "1",
        classroomId,
        postId,
        taskId: task.id,
      });
    }
  }

  const shouldTrack =
    task.kind === "chapter_quiz" ||
    task.kind === "mock_paper" ||
    task.kind === "past_paper" ||
    href.startsWith("/mock") ||
    href.startsWith("/mock-test");
  if (!shouldTrack) return resolvedHref;

  try {
    const isAbsolute = /^https?:\/\//i.test(resolvedHref);
    const url = isAbsolute
      ? new URL(resolvedHref)
      : new URL(resolvedHref, "https://edublast.local");
    if (!url.searchParams.get("classroomId")) url.searchParams.set("classroomId", classroomId);
    if (!url.searchParams.get("postId")) url.searchParams.set("postId", postId);
    return isAbsolute
      ? url.toString()
      : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return resolvedHref;
  }
}

/** ClassFeed variant: kind passed separately when task object is unavailable. */
export function withAssignmentTrackingParamsForKind(
  href: string,
  postId: string,
  classroomId: string,
  kind?: string,
  taskId?: string
): string {
  if (!href) return href;
  const resolved = resolveAssignmentTrackingInHref(href, postId, classroomId);

  if (kind === "gyan_engagement" && taskId) {
    return withAssignmentTrackingParams(resolved, { kind: "gyan_engagement", id: taskId }, classroomId, postId);
  }

  const needsTracking =
    kind === "chapter_quiz" ||
    kind === "mock_paper" ||
    kind === "past_paper" ||
    resolved.includes("panel=quiz") ||
    resolved.includes("/mock-test") ||
    resolved.includes("/assignment-test/");
  if (!needsTracking) return resolved;

  try {
    const isAbsolute = /^https?:\/\//i.test(resolved);
    const url = isAbsolute ? new URL(resolved) : new URL(resolved, "https://edublast.local");
    if (!url.searchParams.get("postId")) url.searchParams.set("postId", postId);
    if (!url.searchParams.get("classroomId")) url.searchParams.set("classroomId", classroomId);
    return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return resolved;
  }
}
