import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";

/** GET — whether the user posted a refer-earn challenge result to the community feed.
 *  Optional `?since=<ISO>` param: only count posts created at or after that timestamp,
 *  so old historical posts from before this onboarding session are ignored. */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = ctx;

    // Parse optional `since` timestamp (ISO string from the client's sessionStorage).
    const sinceRaw = request.nextUrl.searchParams.get("since");
    const sinceDate = sinceRaw ? new Date(sinceRaw) : null;
    const sinceIso = sinceDate && !isNaN(sinceDate.getTime()) ? sinceDate.toISOString() : null;

    let query = supabase
      .from("lessons_raw_posts")
      .select("id")
      .eq("user_id", user.id)
      .eq("source_type", "refer_challenge")
      .limit(1);

    // Only count posts made AFTER the task was launched — not old ones.
    if (sinceIso) {
      query = query.gte("created_at", sinceIso);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      hasCommunityPost: (data?.length ?? 0) > 0,
    });
  } catch (e) {
    console.error("onboarding earn-challenge-status GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
