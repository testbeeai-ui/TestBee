export type StudentFirstNameForMotivationInput = {
  profileFirstName?: string | null;
  profileFullName?: string | null;
  userMetaFullName?: string | null;
  userMetaName?: string | null;
};

function trimStr(v: string | null | undefined): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Best-effort first name for teacher motivation / counsel copy that uses the `[name]` token.
 */
export function studentFirstNameForMotivationGreeting(input: StudentFirstNameForMotivationInput): string {
  const fromProfile = trimStr(input.profileFirstName);
  if (fromProfile) return fromProfile;

  for (const full of [input.profileFullName, input.userMetaFullName, input.userMetaName]) {
    const t = trimStr(full);
    if (!t) continue;
    const first = t.split(/\s+/)[0];
    if (first) return first;
  }

  return "";
}

const NAME_TOKEN = /\[name\]/g;

/**
 * Replaces `[name]` in stored motivation bodies with the viewer's first name (or a neutral fallback).
 */
export function personalizeTeacherMotivationMessage(
  body: string | null | undefined,
  studentFirstName: string
): string {
  if (body == null) return "";
  const name = trimStr(studentFirstName) || "there";
  return body.replace(NAME_TOKEN, name);
}
