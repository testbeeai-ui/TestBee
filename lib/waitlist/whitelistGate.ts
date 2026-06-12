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
  /** Trust auth.users.created_at only; profiles.created_at is client-updatable under current RLS. */
  userCreatedAt?: string | null | undefined;
};

export const WAITLIST_GATE_LEGACY_AUTH_CREATED_BEFORE = "2026-06-10T09:30:00.000Z";

function isLegacyCompletedAccount(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const createdMs = Date.parse(createdAt);
  const cutoffMs = Date.parse(WAITLIST_GATE_LEGACY_AUTH_CREATED_BEFORE);
  return Number.isFinite(createdMs) && createdMs < cutoffMs;
}

/** Returns true when the user may access the app (admin, approved email, or pre-gate completed account). */
export async function evaluateWhitelistGate(
  supabase: SupabaseClient<Database>,
  input: WhitelistGateInput
): Promise<WhitelistGateResult> {
  if (await isAdminUser(supabase, input.userId)) {
    return { allowed: true, reason: "admin" };
  }

  const email = input.email?.toLowerCase().trim();
  if (email) {
    const { data } = (await (supabase.from as (name: string) => ReturnType<typeof supabase.from>)(
      "approved_emails"
    )
      .select("role")
      .eq("email", email)
      .maybeSingle()) as { data: { role: string } | null };

    if (data?.role === "student" || data?.role === "teacher") {
      return { allowed: true, reason: "approved", approvedRole: data.role };
    }
  }

  if (input.onboardingComplete && isLegacyCompletedAccount(input.userCreatedAt)) {
    return { allowed: true, reason: "onboarding_complete" };
  }

  if (!email) {
    return { allowed: false, reason: "no_email" };
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
