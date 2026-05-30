/**
 * Admin-only: best-effort replay for a refer_challenge_claims row — play_history in a time window
 * plus community posts emitted from the refer share flow (source_type = refer_challenge).
 */
import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  referChallengeSessionDurationSec,
  referChallengeSpec,
  type ReferClaimKey,
} from "@/lib/rdm/referral/referEarnChallenges";
import { fetchRdmConfig } from "@/lib/rdm/rdmConfig";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_KEYS = new Set<string>(["5", "10", "20", "50"]);

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: userId } = await context.params;
    if (!userId?.trim()) return NextResponse.json({ error: "Invalid user id" }, { status: 400 });

    const url = new URL(request.url);
    const claimDate = url.searchParams.get("claim_date")?.trim() ?? "";
    const challengeKey = url.searchParams.get("challenge_key")?.trim() ?? "";

    if (!DATE_RE.test(claimDate)) {
      return NextResponse.json({ error: "claim_date must be YYYY-MM-DD" }, { status: 400 });
    }
    if (!VALID_KEYS.has(challengeKey)) {
      return NextResponse.json({ error: "Invalid challenge_key" }, { status: 400 });
    }

    const config = await fetchRdmConfig();
    const spec = referChallengeSpec(challengeKey as ReferClaimKey, config);
    if (!spec) {
      return NextResponse.json({ error: "Unknown challenge spec" }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const claimRes = await admin
      .from("refer_challenge_claims")
      .select(
        "user_id, claim_date, challenge_key, win_claimed, share_claimed, win_claimed_at, share_claimed_at, updated_at, created_at"
      )
      .eq("user_id", userId)
      .eq("claim_date", claimDate)
      .eq("challenge_key", challengeKey)
      .maybeSingle();

    if (claimRes.error) {
      return NextResponse.json({ error: claimRes.error.message }, { status: 500 });
    }
    if (!claimRes.data) {
      return NextResponse.json({ error: "Claim row not found" }, { status: 404 });
    }

    const claim = claimRes.data;

    /** Prefer win_claimed_at (after the run); fall back to share time or noon UTC on claim_date. */
    const anchorIso =
      claim.win_claimed_at ?? claim.share_claimed_at ?? `${claim.claim_date}T12:00:00.000Z`;
    const anchorMs = new Date(anchorIso).getTime();
    const sessionTotalMin = Math.ceil(referChallengeSessionDurationSec(spec) / 60);
    const padMinutes = sessionTotalMin + 30;
    const windowStart = new Date(anchorMs - padMinutes * 60 * 1000).toISOString();
    const windowEnd = new Date(anchorMs + 8 * 60 * 1000).toISOString();

    const attemptsRes = await admin
      .from("play_history")
      .select(
        `
        id,
        question_id,
        is_correct,
        time_taken_ms,
        selected_answer_index,
        pool_key,
        created_at,
        play_questions (
          domain,
          category,
          content,
          options,
          correct_answer_index,
          explanation
        )
      `
      )
      .eq("user_id", userId)
      .eq("pool_key", spec.playCategory)
      .gte("created_at", windowStart)
      .lte("created_at", windowEnd)
      .order("created_at", { ascending: true })
      .limit(spec.questionCount + 15);

    if (attemptsRes.error) {
      return NextResponse.json({ error: attemptsRes.error.message }, { status: 500 });
    }

    const postsRes = await admin
      .from("lessons_raw_posts")
      .select("id, title, content, created_at, tags, source_payload, source_type")
      .eq("user_id", userId)
      .eq("source_type", "refer_challenge")
      .order("created_at", { ascending: false })
      .limit(80);

    if (postsRes.error) {
      return NextResponse.json({ error: postsRes.error.message }, { status: 500 });
    }

    const shareAnchorMs = claim.share_claimed_at
      ? new Date(claim.share_claimed_at).getTime()
      : claim.win_claimed_at
        ? new Date(claim.win_claimed_at).getTime()
        : anchorMs;
    const postWindowStart = new Date(shareAnchorMs - 3 * 60 * 60 * 1000).toISOString();
    const postWindowEnd = new Date(shareAnchorMs + 3 * 60 * 60 * 1000).toISOString();

    const communityShares = (postsRes.data ?? []).filter((p) => {
      const payload = p.source_payload as { challengeKey?: string } | null;
      if (payload?.challengeKey !== challengeKey) return false;
      const t = new Date(p.created_at).getTime();
      return t >= new Date(postWindowStart).getTime() && t <= new Date(postWindowEnd).getTime();
    });

    return NextResponse.json({
      claim,
      challengeName: spec.name,
      poolKey: spec.playCategory,
      sessionWindowUtc: { start: windowStart, end: windowEnd },
      postMatchWindowUtc: { start: postWindowStart, end: postWindowEnd },
      heuristicNotes: [
        `Matched play_history rows use pool_key="${spec.playCategory}" between claim timestamps (expanded by session length).`,
        `Keys 20 and 50 both use pool_key academic_all — if the student ran both Academic tiers the same day, rows can mix; treat as advisory.`,
        `Share rewards claimed via WhatsApp / Instagram open-in-browser are not stored server-side — only “Post to community” creates a lessons_raw_posts row.`,
      ],
      attempts: attemptsRes.data ?? [],
      communityShares,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
