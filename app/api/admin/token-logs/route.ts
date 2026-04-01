import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isAdminUser } from "@/lib/admin";
import { estimateGeminiCostUsd, getGeminiPricingUsdPer1M } from "@/lib/aiLogger";

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;

    if (!(await isAdminUser(supabase, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get("limit") ?? 1000);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(5000, Math.floor(rawLimit))) : 1000;

    const { data, error } = await supabase
      .from("ai_token_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []).map((row) => {
      const prompt = Number(row.prompt_tokens ?? 0);
      const output = Number(row.candidates_tokens ?? 0);
      const pricing = getGeminiPricingUsdPer1M(String(row.model_id ?? ""));
      return {
        ...row,
        realtime_cost_usd: estimateGeminiCostUsd(String(row.model_id ?? ""), prompt, output),
        pricing_input_per_1m: pricing.inputPer1M,
        pricing_output_per_1m: pricing.outputPer1M,
      };
    });

    return NextResponse.json({
      rows,
      calculatedAt: new Date().toISOString(),
      source: "env-pricing-realtime",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
