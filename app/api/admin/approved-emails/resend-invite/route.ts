import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { sendApprovalInviteEmail } from "@/lib/email/sendApprovalInviteEmail";

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

    let body: { id?: string; email?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const id = body.id?.trim();
    const emailQuery = body.email?.toLowerCase().trim();
    if (!id && !emailQuery) {
      return NextResponse.json({ error: "id or email is required" }, { status: 400 });
    }

    let query = admin.from("approved_emails" as any).select("*");
    if (id) query = query.eq("id", id);
    else query = query.eq("email", emailQuery);

    const { data: row, error: fetchErr } = await query.maybeSingle();
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!row) {
      return NextResponse.json({ error: "Approved email not found" }, { status: 404 });
    }

    const approved = row as unknown as {
      email: string;
      role: "student" | "teacher";
      first_name: string | null;
    };

    if (approved.role !== "student" && approved.role !== "teacher") {
      return NextResponse.json({ error: "Invalid role on approved email" }, { status: 400 });
    }

    const emailRes = await sendApprovalInviteEmail({
      firstName: approved.first_name?.trim() || "there",
      email: approved.email,
      role: approved.role,
      adminUserId: ctx.user.id,
    });

    if (!emailRes.success) {
      return NextResponse.json(
        {
          success: false,
          emailSent: false,
          emailError: emailRes.error,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      emailSent: true,
      signupUrl: emailRes.signupUrl ?? null,
    });
  } catch (err) {
    console.error("[POST /api/admin/approved-emails/resend-invite] Server error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
