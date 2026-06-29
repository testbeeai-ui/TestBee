/** Placeholder embedded in assignment task hrefs at create time, swapped for the real post id after insert. */

export const ASSIGNMENT_POST_ID_TEMPLATE = "{{POST_ID}}";

/** URL-encoded form produced by `URLSearchParams` / `appendQueryParams`. */
export const ASSIGNMENT_POST_ID_TEMPLATE_ENCODED = "%7B%7BPOST_ID%7D%7D";

export function hrefContainsPostIdTemplate(href: string): boolean {
  if (!href) return false;
  return (
    href.includes(ASSIGNMENT_POST_ID_TEMPLATE) ||
    href.toLowerCase().includes(ASSIGNMENT_POST_ID_TEMPLATE_ENCODED.toLowerCase())
  );
}

export function resolvePostIdInHref(href: string, postId: string): string {
  if (!href || !postId.trim()) return href;
  const id = postId.trim();
  let out = href.split(ASSIGNMENT_POST_ID_TEMPLATE).join(id);
  out = out.split(ASSIGNMENT_POST_ID_TEMPLATE_ENCODED).join(encodeURIComponent(id));
  out = out.split(ASSIGNMENT_POST_ID_TEMPLATE_ENCODED.toLowerCase()).join(encodeURIComponent(id));
  return out;
}

const CLASSROOM_ID_TEMPLATE = "{{CLASSROOM_ID}}";
const CLASSROOM_ID_TEMPLATE_ENCODED = "%7B%7BCLASSROOM_ID%7D%7D";

export function resolveClassroomIdInHref(href: string, classroomId: string): string {
  if (!href || !classroomId.trim()) return href;
  const id = classroomId.trim();
  let out = href.split(CLASSROOM_ID_TEMPLATE).join(id);
  out = out.split(CLASSROOM_ID_TEMPLATE_ENCODED).join(encodeURIComponent(id));
  out = out.split(CLASSROOM_ID_TEMPLATE_ENCODED.toLowerCase()).join(encodeURIComponent(id));
  return out;
}

/** Resolve post + classroom placeholders in assignment task hrefs. */
export function resolveAssignmentTrackingInHref(
  href: string,
  postId: string,
  classroomId: string
): string {
  return resolveClassroomIdInHref(resolvePostIdInHref(href, postId), classroomId);
}

export function tasksContainPostIdTemplate(
  tasks: unknown
): tasks is Array<Record<string, unknown>> {
  if (!Array.isArray(tasks)) return false;
  return tasks.some((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const href = (entry as Record<string, unknown>).href;
    return typeof href === "string" && hrefContainsPostIdTemplate(href);
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** False for unset or unreplaced {{POST_ID}} placeholders in query params. */
export function isValidAssignmentPostId(raw: string | null | undefined): boolean {
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id) return false;
  if (id.includes("POST_ID") || hrefContainsPostIdTemplate(id)) return false;
  return UUID_RE.test(id);
}
