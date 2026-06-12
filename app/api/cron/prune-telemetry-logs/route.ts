import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";

/**
 * Prune old ai_token_logs (>90d) and student_learning_dwell_events (>180d).
 * Manual or external cron only — not scheduled in vercel.json by default.
 */
export async function GET(request: Request) {
  return runPrune(request);
}

export async function POST(request: Request) {
  return runPrune(request);
}

async function runPrune(request: Request) {
  if (process.env.VERCEL_ENV === "production" && !process.env.CRON_SECRET?.trim()) {
    return NextResponse.json(
      {
        error: "CRON_SECRET must be set in Vercel Production for /api/cron/prune-telemetry-logs",
        code: "MISSING_CRON_SECRET",
      },
      { status: 503 }
    );
  }

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  await (admin as any).rpc("ensure_dwell_events_partition");

  const { data, error } = await (admin as any).rpc("prune_telemetry_logs", {
    p_ai_token_days: 90,
    p_dwell_days: 180,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result: data });
}
