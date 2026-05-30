import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { verifyBuddyOnboardingForInviter } from "@/lib/buddy/buddyOnboardingVerification";

/** GET — whether the inviter has a buddy who accepted their invite and is actively paired. */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = ctx;

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const status = await verifyBuddyOnboardingForInviter(supabase, admin, user.id);

    return NextResponse.json(status);
  } catch (e) {
    console.error("onboarding earn-buddy-status GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
