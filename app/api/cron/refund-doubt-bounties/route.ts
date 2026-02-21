import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";

/**
 * Refund expired doubt bounties (7-day rule). Call daily from:
 * - Vercel Cron: add to vercel.json "crons": [{ "path": "/api/cron/refund-doubt-bounties", "schedule": "0 0 * * *" }]
 * - Or any external cron: GET/POST with optional header Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  return runRefund(request);
}

export async function POST(request: Request) {
  return runRefund(request);
}

async function runRefund(request: Request) {
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

  const { data, error } = await admin.rpc("refund_expired_doubt_bounties");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, refunded: data });
}
