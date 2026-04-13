import { NextResponse } from "next/server";
import { DOUBT_FLAIRS } from "@/components/doubts/doubtTypes";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isAdminUser } from "@/lib/admin";
import { canonicalDoubtSubject } from "@/lib/doubtSubject";
import { createAdminClient } from "@/integrations/supabase/server";

type Body = { doubtId?: string; subject?: string };

export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const json = (await request.json()) as Body;
    const doubtId = typeof json.doubtId === "string" ? json.doubtId.trim() : "";
    const raw = typeof json.subject === "string" ? json.subject.trim() : "";
    const subject = canonicalDoubtSubject(raw);

    if (!doubtId || !subject || !DOUBT_FLAIRS.includes(subject)) {
      return NextResponse.json({ error: "Invalid doubtId or subject" }, { status: 400 });
    }

    const { error } = await admin.from("doubts").update({ subject }).eq("id", doubtId);
    if (error) {
      console.error("[admin/doubt-subject]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, subject });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bad request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
