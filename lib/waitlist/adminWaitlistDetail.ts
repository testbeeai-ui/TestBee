import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { waitlistSubmissionsTable } from "@/lib/waitlist/waitlistDb";
import type { WaitlistAdminStatus } from "@/lib/waitlist/waitlistDb";
import { sendApprovalInviteEmail } from "@/lib/email/sendApprovalInviteEmail";

function isWaitlistAdminStatus(v: unknown): v is WaitlistAdminStatus {
  return v === "new" || v === "reviewed" || v === "resolved";
}

async function requireAdmin(request: Request) {
  const ctx = await getSupabaseAndUser(request);
  if (!ctx) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const admin = createAdminClient();
  if (!admin) {
    return {
      response: NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 }),
    };
  }
  return { ctx, admin };
}

export async function getWaitlistReferrals(request: Request, id: string) {
  try {
    const auth = await requireAdmin(request);
    if ("response" in auth) return auth.response;

    const table = waitlistSubmissionsTable(auth.admin);
    const { data: target, error: targetError } = await table
      .select("waitlist_id")
      .eq("id", id)
      .maybeSingle();

    if (targetError) {
      return NextResponse.json({ error: targetError.message }, { status: 500 });
    }
    if (!target) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: referrals, error: refError } = await table
      .select(
        "id, waitlist_id, email, first_name, last_name, phone, role, signup_tier, created_at, admin_status"
      )
      .ilike("refcode", target.waitlist_id)
      .order("created_at", { ascending: false });

    if (refError) {
      return NextResponse.json({ error: refError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, referrals: referrals ?? [] });
  } catch (err) {
    console.error("[GET waitlist referrals] Server error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function patchWaitlistSubmission(request: Request, id: string) {
  try {
    const auth = await requireAdmin(request);
    if ("response" in auth) return auth.response;

    let body: { admin_status?: unknown; admin_note?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if (body.admin_status !== undefined) {
      if (!isWaitlistAdminStatus(body.admin_status)) {
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      }
      patch.admin_status = body.admin_status;
      patch.reviewed_at = new Date().toISOString();
      patch.reviewed_by = auth.ctx.user.id;
    }
    if (body.admin_note !== undefined) {
      patch.admin_note =
        typeof body.admin_note === "string" ? body.admin_note.trim().slice(0, 4000) : null;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await waitlistSubmissionsTable(auth.admin)
      .update(patch)
      .eq("id", id)
      .select("id, admin_status, admin_note, reviewed_at")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true, row: data });
  } catch (err) {
    console.error("[PATCH waitlist submission] Server error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function approveWaitlistSubmission(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if ("response" in auth) return auth.response;

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

    const submissionsTable = waitlistSubmissionsTable(auth.admin);
    const { data: submission, error: fetchErr } = await submissionsTable
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!submission) return NextResponse.json({ error: "Waitlist submission not found" }, { status: 404 });

    const email = submission.email.toLowerCase().trim();
    const firstName = submission.first_name || "there";
    const lastName = submission.last_name || "";

    const { error: insertErr } = await auth.admin
      .from("approved_emails" as "profiles")
      .upsert(
        {
          email,
          role,
          first_name: firstName,
          last_name: lastName,
          waitlist_submission_id: id,
          approved_by: auth.ctx.user.id,
          approved_via: "waitlist_approve",
        } as never,
        { onConflict: "email" }
      );

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const { error: updateErr } = await submissionsTable
      .update({
        admin_status: "resolved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: auth.ctx.user.id,
      })
      .eq("id", id);

    if (updateErr) {
      console.error("[approve waitlist] Failed to update status:", updateErr.message);
    }

    const emailRes = await sendApprovalInviteEmail({
      firstName,
      email,
      role,
      customMessage,
      adminUserId: auth.ctx.user.id,
    });

    return NextResponse.json({
      success: true,
      emailSent: emailRes.success,
      emailError: !emailRes.success ? emailRes.error : null,
      signupUrl: emailRes.success ? emailRes.signupUrl : null,
    });
  } catch (err) {
    console.error("[POST waitlist approve] Server error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
