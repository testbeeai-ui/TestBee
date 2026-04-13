import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import { runGyanBotPostCycle } from "@/lib/gyanBotPostCycle";

export async function GET(request: Request) {
  return runCycle(request);
}

export async function POST(request: Request) {
  return runCycle(request);
}

async function runCycle(request: Request) {
  // Vercel production: never run this job without a shared secret (prevents open POST to your project).
  if (process.env.VERCEL_ENV === "production" && !process.env.CRON_SECRET?.trim()) {
    return NextResponse.json(
      {
        error: "CRON_SECRET must be set in Vercel Production for /api/cron/gyan-bot-post",
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

  const result = await runGyanBotPostCycle(admin, { bypassInterval: false });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  if (result.skipped) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: result.reason,
      nextEligibleAt: result.nextEligibleAt,
    });
  }
  return NextResponse.json({
    ok: true,
    doubtId: result.doubtId,
    studentIndex: result.studentIndex,
    nextIndex: result.nextIndex,
    answer: result.answer,
  });
}
