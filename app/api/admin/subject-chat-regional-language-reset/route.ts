import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { resolveSubjectChatAccessForUser } from "@/lib/subscription/subjectChatLimits";

/** POST — admin-only: clear own lesson-chat regional language lock for QA. */
export async function POST(req: NextRequest) {
  const auth = await getSupabaseAndUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!(await isAdminUser(auth.supabase, auth.user.id))) {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  const { error } = await auth.supabase
    .from("profiles")
    .update({
      subject_chat_regional_language: null,
      subject_chat_regional_language_locked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", auth.user.id);

  if (error) {
    return NextResponse.json(
      { error: error.message, code: "RESET_FAILED" },
      { status: 500 }
    );
  }

  const { data: profile } = await auth.supabase
    .from("profiles")
    .select(
      "plan_tier, free_trial_activated, payment_card_details, subscription_started_at, time_travel_offset_ms, subject_chat_regional_language"
    )
    .eq("id", auth.user.id)
    .maybeSingle();

  const access = await resolveSubjectChatAccessForUser(
    auth.supabase,
    auth.user.id,
    profile
  );

  return NextResponse.json({
    ok: true,
    regionalLanguage: access.regionalLanguage,
    needsRegionalLanguageSelection: access.needsRegionalLanguageSelection,
    multilingual: access.multilingual,
  });
}
