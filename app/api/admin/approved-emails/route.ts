import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { sendApprovalInviteEmail } from "@/lib/email/sendApprovalInviteEmail";

export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();

    let query = admin.from("approved_emails" as any).select("*").order("created_at", { ascending: false });

    if (search) {
      query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    console.error("[GET /api/admin/approved-emails] Server error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

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

    let body: { email?: string; role?: string; firstName?: string; lastName?: string; sendInvite?: boolean };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { email, role, firstName, lastName, sendInvite = true } = body;
    if (!email || !role) {
      return NextResponse.json({ error: "email and role are required" }, { status: 400 });
    }

    if (role !== "student" && role !== "teacher") {
      return NextResponse.json({ error: "Role must be student or teacher" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanFirstName = (firstName ?? "").trim() || "there";
    const cleanLastName = (lastName ?? "").trim();

    const { data: inserted, error: insertErr } = await admin
      .from("approved_emails" as any)
      .upsert(
        {
          email: cleanEmail,
          role,
          first_name: cleanFirstName,
          last_name: cleanLastName,
          approved_by: ctx.user.id,
          approved_via: "manual",
        },
        { onConflict: "email" }
      )
      .select()
      .maybeSingle();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    let emailSent = false;
    let emailError = null;

    let signupUrl: string | null = null;
    if (sendInvite) {
      const emailRes = await sendApprovalInviteEmail({
        firstName: cleanFirstName,
        email: cleanEmail,
        role,
        adminUserId: ctx.user.id,
      });

      emailSent = emailRes.success;
      if (!emailRes.success) emailError = emailRes.error;
      else signupUrl = emailRes.signupUrl ?? null;
    }

    return NextResponse.json({
      success: true,
      row: inserted,
      emailSent,
      emailError,
      signupUrl,
    });
  } catch (err) {
    console.error("[POST /api/admin/approved-emails] Server error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
