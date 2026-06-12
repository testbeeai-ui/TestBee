import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/cronRouteAuth";
import { flushAllSitePresenceToPostgres, isSitePresenceBufferEnabled } from "@/lib/presence/sitePresenceBuffer";
import { createAdminClient } from "@/integrations/supabase/server";

/**
 * Flush buffered site-presence heartbeats from Upstash Redis into Postgres.
 * Manual or external cron only — recommend every 5 minutes when buffer is enabled.
 */
export async function GET(request: Request) {
  return runFlush(request);
}

export async function POST(request: Request) {
  return runFlush(request);
}

async function runFlush(request: Request) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  if (!isSitePresenceBufferEnabled()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "UPSTASH_REDIS_REST_* not set" });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const { flushed } = await flushAllSitePresenceToPostgres(admin);
  return NextResponse.json({ ok: true, flushed });
}
