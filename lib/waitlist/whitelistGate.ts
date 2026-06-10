import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isAdminUser } from "@/lib/admin/admin";

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

/** Returns true when the user may access the app (complete onboarding, admin, or approved email). */
export async function evaluateWhitelistGate(
  supabase: SupabaseClient<Database>,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = (await (supabase.from as (name: string) => ReturnType<typeof supabase.from>)(
    "approved_emails"
  )
    .select("role")
    .eq("email", email)
    .maybeSingle()) as { data: { role: string } | null };

  if (data?.role === "student" || data?.role === "teacher") {
    return { allowed: true, reason: "approved", approvedRole: data.role };
  }

  return { allowed: false, reason: "not_approved" };
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
