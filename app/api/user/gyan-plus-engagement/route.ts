import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";

/** Longer replies count as answers; shorter thread posts count as comments (same table as replies). */
const ANSWER_MIN_STRIPPED_LEN = 360;

function strippedBodyLen(raw: string): number {
  const t = raw
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.length;
}

/** GET — Gyan++ social stats for profile “Gyan++ engagement” grid (real DB aggregates). */
export async function GET(request: Request) {
  const auth = await getSupabaseAndUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, user } = auth;
  const uid = user.id;

  const [
    doubtsAskedRes,
    answersAcceptedRes,
    myAnswersRes,
    upvotesGivenRes,
    doubtsUpvotesRes,
    answersUpvotesRes,
    savesRes,
  ] = await Promise.all([
    supabase.from("doubts").select("id", { count: "exact", head: true }).eq("user_id", uid),
    supabase
      .from("doubt_answers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("hidden", false)
      .eq("is_accepted", true),
    supabase
      .from("doubt_answers")
      .select("body, is_accepted")
      .eq("user_id", uid)
      .eq("hidden", false),
    supabase.from("doubt_votes").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("vote_type", 1),
    supabase.from("doubts").select("upvotes").eq("user_id", uid),
    supabase.from("doubt_answers").select("upvotes").eq("user_id", uid).eq("hidden", false),
    supabase.from("doubt_saves").select("doubt_id", { count: "exact", head: true }).eq("user_id", uid),
  ]);

  if (
    doubtsAskedRes.error ||
    answersAcceptedRes.error ||
    myAnswersRes.error ||
    upvotesGivenRes.error ||
    doubtsUpvotesRes.error ||
    answersUpvotesRes.error ||
    savesRes.error
  ) {
    const msg =
      doubtsAskedRes.error?.message ||
      answersAcceptedRes.error?.message ||
      myAnswersRes.error?.message ||
      upvotesGivenRes.error?.message ||
      doubtsUpvotesRes.error?.message ||
      answersUpvotesRes.error?.message ||
      savesRes.error?.message ||
      "Query failed";
    console.error("[gyan-plus-engagement]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const doubtsAsked = doubtsAskedRes.count ?? 0;
  const answersAcceptedByAsker = answersAcceptedRes.count ?? 0;

  let answersGivenLongform = 0;
  let commentsPosted = 0;
  const rows = (myAnswersRes.data ?? []) as { body: string; is_accepted: boolean }[];
  for (const r of rows) {
    const substantive = Boolean(r.is_accepted) || strippedBodyLen(String(r.body ?? "")) >= ANSWER_MIN_STRIPPED_LEN;
    if (substantive) answersGivenLongform += 1;
    else commentsPosted += 1;
  }

  const upvotesGiven = upvotesGivenRes.count ?? 0;

  let upvotesReceived = 0;
  for (const r of doubtsUpvotesRes.data ?? []) {
    const n = typeof (r as { upvotes?: number }).upvotes === "number" ? (r as { upvotes: number }).upvotes : 0;
    upvotesReceived += Math.max(0, n);
  }
  for (const r of answersUpvotesRes.data ?? []) {
    const n = typeof (r as { upvotes?: number }).upvotes === "number" ? (r as { upvotes: number }).upvotes : 0;
    upvotesReceived += Math.max(0, n);
  }

  const savedForRevision = savesRes.count ?? 0;

  return NextResponse.json({
    doubtsAsked,
    answersGiven: answersGivenLongform,
    answersAcceptedByAsker,
    commentsPosted,
    upvotesGiven,
    upvotesReceived,
    savedForRevision,
  });
}
