import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import {
  fetchSubscriptionConfig,
  getPlanLimits,
  isUnlimited,
  normalizePlanTier,
} from "@/lib/subscription/subscriptionConfig";

const ALLOWED_SOURCES = new Set(["mock", "past_paper", "static"]);

function sanitizeId(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 120);
}

export async function POST(request: Request) {
  try {
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;

    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = ctx;

    const body = await request.json().catch(() => ({}));
    const questionId = sanitizeId(body?.questionId);
    const sourceTypeRaw = typeof body?.sourceType === "string" ? body.sourceType.trim() : "";
    if (!questionId || !ALLOWED_SOURCES.has(sourceTypeRaw)) {
      return NextResponse.json({ error: "questionId and sourceType required" }, { status: 400 });
    }
    const sourceType = sourceTypeRaw as "mock" | "past_paper" | "static";

    const { data: existingAny } = await supabase
      .from("saved_questions")
      .select("question_id")
      .eq("user_id", user.id)
      .eq("question_id", questionId)
      .limit(1);

    if (existingAny?.length) {
      const { error: upsertErr } = await supabase.from("saved_questions").upsert(
        {
          user_id: user.id,
          question_id: questionId,
          source_type: sourceType,
        },
        { onConflict: "user_id,question_id,source_type" }
      );
      if (upsertErr) {
        return NextResponse.json({ error: upsertErr.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "plan_tier, free_trial_activated, payment_card_details, subscription_started_at, time_travel_offset_ms"
      )
      .eq("id", user.id)
      .maybeSingle();

    const tier = normalizePlanTier(
      (profile?.plan_tier as string | null | undefined) ?? "free",
      profile?.free_trial_activated,
      profile
    );
    const cfg = await fetchSubscriptionConfig(supabase as never);
    const cap = getPlanLimits(cfg, tier).savedQuestionLimit;

    if (!isUnlimited(cap)) {
      const { data: allRows, error: countErr } = await supabase
        .from("saved_questions")
        .select("question_id")
        .eq("user_id", user.id);

      if (countErr) {
        return NextResponse.json({ error: countErr.message }, { status: 500 });
      }

      const distinctIds = new Set(
        (allRows ?? [])
          .map((r) => (r as { question_id?: string }).question_id)
          .filter((id): id is string => Boolean(id))
      );

      if (distinctIds.size >= cap) {
        return NextResponse.json(
          {
            error: `Saved questions limit reached (${cap} on your ${tier} plan). You have ${distinctIds.size} saved. Upgrade to save more.`,
            limitReached: true,
          },
          { status: 403 }
        );
      }
    }

    const { error } = await supabase.from("saved_questions").upsert(
      {
        user_id: user.id,
        question_id: questionId,
        source_type: sourceType,
      },
      { onConflict: "user_id,question_id,source_type" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("saved-questions POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
