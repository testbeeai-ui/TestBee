/**
 * Normalize a meeting URL for href / storage (Google Meet, Zoom, etc.).
 * Accepts pasted values without a scheme (e.g. meet.google.com/xxx).
 */
export function normalizeMeetLink(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

/**
 * Teacher/host Meet link — pins the connected Google account so Meet recognizes the organizer
 * instead of showing "Waiting for host" when another account is active in the browser.
 */
export function buildTeacherMeetJoinUrl(
  meetLink: string | null | undefined,
  googleCalendarEmail: string | null | undefined
): string {
  const base = normalizeMeetLink(meetLink);
  if (!base) return "";
  const email = googleCalendarEmail?.trim();
  if (!email) return base;
  try {
    const url = new URL(base);
    url.searchParams.set("authuser", email);
    return url.toString();
  } catch {
    return base;
  }
}

export function teacherMeetJoinTitle(googleCalendarEmail: string | null | undefined): string {
  const email = googleCalendarEmail?.trim();
  if (!email) {
    return "Start class in Google Meet. Sign in with the same Google account you connected to Calendar.";
  }
  return `Start class as ${email} — the Google account connected to your Calendar.`;
}
