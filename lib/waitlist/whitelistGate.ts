import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isAdminUser } from "@/lib/admin/admin";
import { fromPublicTable } from "@/lib/edudeca-mock/tables";

export type WhitelistGateResult = {
  allowed: boolean;
  reason:
    | "onboarding_complete"
    | "admin"
    | "approved"
    | "edudeca_student"
    | "open_signup"
    | "not_approved"
    | "no_email";
  approvedRole?: "student" | "teacher";
};

/** Signed-in accounts enter onboarding. Waitlist and ambassador lists are not the door. */
export type WhitelistGateInput = {
  userId: string;
  email: string | null | undefined;
  onboardingComplete: boolean;
};

/** Waitlist is only for known incomplete accounts — never after a failed profile read. */
export function shouldEvaluateWaitlistGate(input: {
  onboardingComplete: boolean;
  profileQueryFailed: boolean;
}): boolean {
  if (input.onboardingComplete) return false;
  if (input.profileQueryFailed) return false;
  return true;
}

/** True when this path is the EduDeca → EduBlast mock handoff (not the rest of Web). */
export function isEduDecaMockDestination(raw: string | null | undefined): boolean {
  if (raw == null || typeof raw !== "string") return false;
  const path = raw.trim().split("?")[0]?.split("#")[0] ?? "";
  return path === "/edudeca-mock" || path.startsWith("/edudeca-mock/");
}

/** True when any candidate is the mock handoff (pending next, OAuth store, or current URL). */
export function isEduDecaMockWaitlistExempt(
  ...candidates: Array<string | null | undefined>
): boolean {
  return candidates.some((candidate) => isEduDecaMockDestination(candidate));
}

function hasEduDecaLineup(raw: unknown): boolean {
  return (
    Array.isArray(raw) &&
    raw.length === 10 &&
    raw.every((id) => typeof id === "string" && id.trim() !== "")
  );
}

/** A signed-in Google account may enter onboarding. Waitlist and ambassador lists are not checked. */
export async function evaluateWhitelistGate(
  supabase: SupabaseClient<Database>,
  input: WhitelistGateInput
): Promise<WhitelistGateResult> {
  if (input.onboardingComplete) {
    return { allowed: true, reason: "onboarding_complete" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete")
    .eq("id", input.userId)
    .maybeSingle();
  if (profile?.onboarding_complete === true) {
    return { allowed: true, reason: "onboarding_complete" };
  }

  if (await isAdminUser(supabase, input.userId)) {
    return { allowed: true, reason: "admin" };
  }

  const edudecaProgress = await fromPublicTable(supabase, "edudeca_user_progress")
    .select("user_id, disciplines")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (hasEduDecaLineup((edudecaProgress.data as { disciplines?: unknown } | null)?.disciplines)) {
    return { allowed: true, reason: "edudeca_student" };
  }

  return { allowed: true, reason: "open_signup" };
}

export function waitlistBlockedAuthUrl(
  origin: string,
  attemptedEmail?: string | null,
  basePath = "/auth"
): string {
  const url = new URL(basePath.startsWith("/") ? basePath : `/${basePath}`, origin);
  url.searchParams.set("error", "waitlist_not_approved");
  url.searchParams.set("mode", "signin");
  if (attemptedEmail?.trim()) {
    url.searchParams.set("attempted", attemptedEmail.trim().toLowerCase());
  }
  return `${url.pathname}${url.search}`;
}
