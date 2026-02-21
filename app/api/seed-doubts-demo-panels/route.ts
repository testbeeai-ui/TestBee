import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/server";

/**
 * Seeds demo data for Bounty Board, Trending Now, and Top Contributors so users
 * can see how the panels work. Uses service role to update doubts and insert payouts.
 */
export async function POST(request: Request) {
  try {
    const cookieSupabase = await createClient();
    let user = (await cookieSupabase.auth.getUser()).data?.user ?? null;
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!user && token) {
      const { data: { user: u } } = await cookieSupabase.auth.getUser(token);
      user = u ?? null;
    }
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Service role not configured" }, { status: 500 });
    }

    const results = { bounty: 0, trending: 0, contributors: 0 };
    const bounties = [50, 30, 20, 15, 10];

    // 1) Bounty Board: need unresolved doubts with bounty. If none unresolved, mark 2 latest as unresolved for demo.
    let { data: unresolved } = await admin
      .from("doubts")
      .select("id")
      .eq("is_resolved", false)
      .limit(5);
    if (!unresolved?.length) {
      const { data: latest } = await admin.from("doubts").select("id").order("created_at", { ascending: false }).limit(2);
      if (latest?.length) {
        for (const row of latest) {
          await admin.from("doubts").update({ is_resolved: false }).eq("id", row.id);
        }
        unresolved = latest;
      }
    }
    if (unresolved?.length) {
      for (let i = 0; i < Math.min(unresolved.length, 5); i++) {
        await admin
          .from("doubts")
          .update({
            bounty_rdm: bounties[i],
            bounty_escrowed_at: new Date().toISOString(),
          })
          .eq("id", unresolved[i].id);
        results.bounty++;
      }
    }

    // 2) Trending: bump views on latest doubts so "Trending Now" shows rows (frontend uses 7-day window)
    const { data: latestDoubts } = await admin.from("doubts").select("id").order("created_at", { ascending: false }).limit(5);
    const viewCounts = [120, 85, 64, 41, 28];
    if (latestDoubts?.length) {
      for (let i = 0; i < latestDoubts.length; i++) {
        await admin.from("doubts").update({ views: viewCounts[i] }).eq("id", latestDoubts[i].id);
        results.trending++;
      }
    }

    // 3) Top Contributors: insert accepted_answer_payouts for existing answers (so leaderboard shows)
    const { data: answers } = await admin
      .from("doubt_answers")
      .select("id, user_id")
      .limit(20);
    const existingPayouts = await admin.from("accepted_answer_payouts").select("answer_id");
    const paidIds = new Set((existingPayouts.data ?? []).map((r: { answer_id: string }) => r.answer_id));
    const toPay = (answers ?? []).filter((a: { id: string }) => !paidIds.has(a.id)).slice(0, 5);
    const rdmAmounts = [45, 32, 28, 18, 12];
    for (let i = 0; i < toPay.length; i++) {
      const a = toPay[i] as { id: string; user_id: string };
      await admin.from("accepted_answer_payouts").insert({
        user_id: a.user_id,
        answer_id: a.id,
        rdm_paid: rdmAmounts[i],
        paid_at: new Date().toISOString(),
      });
      results.contributors++;
    }

    return NextResponse.json({
      ok: true,
      message: "Demo panel data seeded.",
      results: { bountyBoard: results.bounty, trending: results.trending, topContributors: results.contributors },
    });
  } catch (e) {
    console.error("seed-doubts-demo-panels error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
