import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import { refundExpiredCompletionGrants } from "@/lib/teacherPortal/assignmentCompletionRdm";

/**
 * Refund teacher escrow for assignment completion rewards past due date.
 * Schedule daily: GET/POST /api/cron/refund-assignment-completion-rdm
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

  try {
    const result = await refundExpiredCompletionGrants(admin);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Refund job failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
