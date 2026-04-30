/** Profile older than this with Google + teacher + name-only is treated as a returning row with a stuck flag (sessionStorage may be empty after hard refresh). */
const STALE_PROFILE_MS = 24 * 60 * 60 * 1000;

function profileOlderThanMs(created_at: string | null | undefined, ms: number): boolean {
  if (!created_at) return false;
  const t = Date.parse(created_at);
  if (Number.isNaN(t)) return false;
  return Date.now() - t > ms;
}

/**
 * Detect profiles that clearly finished onboarding but `onboarding_complete` stayed false
 * (failed saves, older rows, or RLS edge cases). Used to route returning users to the app.
 *
 * `isSignIn`: user chose "Welcome back" / sign-in flow — Google teachers with only a name still
 * count as returning. Without it, a long-lived Google teacher row (name only, empty arrays) still
 * repairs after hard refresh using `created_at`.
 */
export function profileShouldForceOnboardingComplete(
  p: {
    role: string;
    onboarding_complete?: boolean | null;
    name?: string | null;
    subjects?: string[] | null;
    teaching_levels?: number[] | null;
    exam_tags?: string[] | null;
    class_level?: number | null;
    target_exam?: string | null;
    /** Original Supabase auth provider Google — not Calendar OAuth. */
    signup_google?: boolean | null;
    created_at?: string | null;
  },
  opts?: { isSignIn?: boolean }
): boolean {
  if (p.onboarding_complete) return false;
  const nameOk = (p.name?.trim()?.length ?? 0) >= 2;
  if (!nameOk) return false;
  if (p.role === "teacher") {
    const hasTeaching =
      (Array.isArray(p.subjects) && p.subjects.length > 0) ||
      (Array.isArray(p.teaching_levels) && p.teaching_levels.length > 0) ||
      (Array.isArray(p.exam_tags) && p.exam_tags.length > 0);
    if (hasTeaching) return true;
    // "Welcome back" / ?mode=signin — do not keep them on this screen with an empty teaching JSON row.
    if (opts?.isSignIn === true) return true;
    // Hard refresh: no sessionStorage, but Google sign-up row is old and flag never flipped.
    if (p.signup_google === true && profileOlderThanMs(p.created_at ?? null, STALE_PROFILE_MS))
      return true;
    return false;
  }
  if (p.role === "student") {
    return (
      typeof p.class_level === "number" &&
      (p.class_level === 11 || p.class_level === 12) &&
      typeof p.target_exam === "string" &&
      p.target_exam.length > 0
    );
  }
  return false;
}
