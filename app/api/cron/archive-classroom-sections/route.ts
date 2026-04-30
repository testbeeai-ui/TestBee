import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";

/**
 * Archive expired classroom sections (schedule_end_date < today).
 * Call daily from:
 * - Vercel Cron (recommended): add to vercel.json "crons"
 * - Or any external cron: GET/POST with optional header Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  return runArchive(request);
}

export async function POST(request: Request) {
  return runArchive(request);
}

async function runArchive(request: Request) {
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

  // Supabase generated types may lag behind migrations; cast RPC name safely.
  const { data, error } = await (admin as any).rpc("archive_expired_classroom_sections");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, archived: data });
}

