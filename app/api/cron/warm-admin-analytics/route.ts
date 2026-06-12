import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/cronRouteAuth";
import { warmAdminAnalyticsCache } from "@/lib/admin/warmAdminAnalyticsCache";
import { createAdminClient } from "@/integrations/supabase/server";

/**
 * Pre-warm admin analytics cache entries (15 min TTL).
 * Manual or external cron only — e.g. every 10–15 minutes while admins use dashboards.
 */
export async function GET(request: Request) {
  return runWarm(request);
}

export async function POST(request: Request) {
  return runWarm(request);
}

async function runWarm(request: Request) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const { keys } = await warmAdminAnalyticsCache(admin);
  return NextResponse.json({ ok: true, keys });
}
