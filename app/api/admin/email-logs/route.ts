import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { buildAdminEmailOverview } from "@/lib/email/adminEmailStats";
import { isEmailConfigured } from "@/lib/email/emailService";

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;

    if (!(await isAdminUser(supabase, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY required for email logs" },
        { status: 503 }
      );
    }

    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get("limit") ?? 80);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(200, Math.floor(rawLimit)))
      : 80;

    const overview = await buildAdminEmailOverview(admin);

    const { data: recent, error: recentError } = await admin
      .from("transactional_email_logs")
      .select(
        "id, created_at, ist_date, kind, recipient, user_id, subject, status, message_id, error_message"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (recentError) {
      return NextResponse.json({ error: recentError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        overview,
        recent: recent ?? [],
        smtpConfigured: isEmailConfigured(),
        calculatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
        },
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
