import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isRegionalSubjectChatCode } from "@/lib/subscription/subjectChatRegionalLanguage";
import { resolveSubjectChatAccessForUser } from "@/lib/subscription/subjectChatLimits";

function mapRpcError(message: string): { status: number; code: string; error: string } {
  const upper = message.toUpperCase();
  if (upper.includes("ALREADY_LOCKED")) {
    return {
      status: 409,
      code: "ALREADY_LOCKED",
      error: "Your lesson-chat language is already locked and cannot be changed.",
    };
  }
  if (upper.includes("NOT_PRO")) {
    return {
      status: 403,
      code: "NOT_PRO",
      error: "Multilingual lesson chat is available on the Pro plan only.",
    };
  }
  if (upper.includes("INVALID_LANGUAGE")) {
    return {
      status: 400,
      code: "INVALID_LANGUAGE",
      error: "Choose Hindi, Kannada, Tamil, or Telugu.",
    };
  }
  if (upper.includes("UNAUTHORIZED")) {
    return { status: 401, code: "UNAUTHORIZED", error: "Sign in to continue." };
  }
  return {
    status: 500,
    code: "SAVE_FAILED",
    error: "Could not save your language. Please try again.",
  };
}

/** POST — one-time lock of Pro lesson-chat regional language. */
export async function POST(req: NextRequest) {
  const auth = await getSupabaseAndUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: { language?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body.", code: "INVALID_BODY" },
      { status: 400 }
    );
  }

  const rawLang = typeof body.language === "string" ? body.language.trim().toLowerCase() : "";
  if (!isRegionalSubjectChatCode(rawLang)) {
    return NextResponse.json(
      { error: "Choose Hindi, Kannada, Tamil, or Telugu.", code: "INVALID_LANGUAGE" },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await auth.supabase
    .from("profiles")
    .select(
      "plan_tier, free_trial_activated, payment_card_details, subscription_started_at, time_travel_offset_ms, subject_chat_regional_language"
    )
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const access = await resolveSubjectChatAccessForUser(
    auth.supabase,
    auth.user.id,
    profile
  );

  if (!access.multilingual) {
    return NextResponse.json(
      {
        error: "Multilingual lesson chat is available on the Pro plan only.",
        code: "NOT_PRO",
      },
      { status: 403 }
    );
  }

  if (access.regionalLanguage) {
    return NextResponse.json(
      {
        error: "Your lesson-chat language is already locked and cannot be changed.",
        code: "ALREADY_LOCKED",
        regionalLanguage: access.regionalLanguage,
      },
      { status: 409 }
    );
  }

  const { data, error } = await auth.supabase.rpc("set_subject_chat_regional_language", {
    p_language: rawLang,
  });

  if (error) {
    const mapped = mapRpcError(error.message);
    return NextResponse.json(
      { error: mapped.error, code: mapped.code },
      { status: mapped.status }
    );
  }

  const payload = data as { regionalLanguage?: string; locked?: boolean } | null;
  const regionalLanguage =
    payload?.regionalLanguage && isRegionalSubjectChatCode(payload.regionalLanguage)
      ? payload.regionalLanguage
      : rawLang;

  return NextResponse.json({
    ok: true,
    regionalLanguage,
    locked: true,
  });
}
