import type { SupabaseClient } from "@supabase/supabase-js";

export type WhitelistGateResult = {
  allowed: boolean;
  reason:
    | "onboarding_complete"
    | "admin"
    | "approved"
    | "not_approved"
    | "no_email";
  approvedRole?: "student" | "teacher";
};

export type WhitelistGateInput = {
  userId: string;
  email: string | null | undefined;
  onboardingComplete: boolean;
};

async function isAdminUser(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (roleRow) return true;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return profile?.role === "admin";
}

/** Same rules as website `lib/waitlist/whitelistGate.ts`. */
export async function evaluateWhitelistGate(
  supabase: SupabaseClient,
  input: WhitelistGateInput
): Promise<WhitelistGateResult> {
  if (input.onboardingComplete) {
    return { allowed: true, reason: "onboarding_complete" };
  }

  if (await isAdminUser(supabase, input.userId)) {
    return { allowed: true, reason: "admin" };
  }

  const email = input.email?.toLowerCase().trim();
  if (!email) {
    return { allowed: false, reason: "no_email" };
  }

  const { data } = await supabase
    .from("approved_emails")
    .select("role")
    .eq("email", email)
    .maybeSingle();

  if (data?.role === "student" || data?.role === "teacher") {
    return { allowed: true, reason: "approved", approvedRole: data.role };
  }

  return { allowed: false, reason: "not_approved" };
}
