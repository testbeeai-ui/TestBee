import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { waitlistSubmissionsTable } from "@/lib/waitlist/waitlistDb";
import { sendEmail } from "@/lib/email/emailService";
import { buildApprovalInviteEmail } from "@/lib/email/approvalInviteEmail";

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

    let body: { id?: string; role?: string; customMessage?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { id, role, customMessage } = body;
    if (!id || !role) {
      return NextResponse.json({ error: "id and role are required" }, { status: 400 });
    }

    if (role !== "student" && role !== "teacher") {
      return NextResponse.json({ error: "Role must be student or teacher" }, { status: 400 });
    }

    // 1. Fetch waitlist submission details
    const submissionsTable = waitlistSubmissionsTable(admin);
    const { data: submission, error: fetchErr } = await submissionsTable
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!submission) return NextResponse.json({ error: "Waitlist submission not found" }, { status: 404 });

    const email = submission.email.toLowerCase().trim();
    const firstName = submission.first_name || "there";
    const lastName = submission.last_name || "";

    // 2. Insert into approved_emails
    const { error: insertErr } = await admin
      .from("approved_emails" as any)
      .upsert(
        {
          email,
          role,
          first_name: firstName,
          last_name: lastName,
          waitlist_submission_id: id,
          approved_by: ctx.user.id,
          approved_via: "waitlist_approve",
        },
        { onConflict: "email" }
      );

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // 3. Update waitlist submission status to resolved
    const { error: updateErr } = await submissionsTable
      .update({
        admin_status: "resolved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: ctx.user.id,
      })
      .eq("id", id);

    if (updateErr) {
      console.error("[approve waitlist] Failed to update status:", updateErr.message);
    }

    const invite = buildApprovalInviteEmail({
      firstName,
      email,
      role,
      customMessage,
    });

    const emailRes = await sendEmail({
      to: email,
      subject: invite.subject,
      html: invite.html,
      log: {
        kind: "other",
        userId: ctx.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      emailSent: emailRes.success,
      emailError: !emailRes.success ? (emailRes as any).error : null,
    });
  } catch (err) {
    console.error("[POST /api/admin/waitlist/approve] Server error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
