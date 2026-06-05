import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { sendEmail } from "@/lib/email/emailService";

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
        },
        { onConflict: "email" }
      )
      .select()
      .maybeSingle();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    let emailSent = false;
    let emailError = null;

    if (sendInvite) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const signupUrl = `${siteUrl}/auth?mode=signup&role=${role}`;

      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff; overflow: hidden; line-height: 1.6;">
          <div style="background-color: #161b27; padding: 24px; text-align: center;">
            <img src="${siteUrl}/images/logo-2.png" alt="EduBlast" height="36" style="height: 36px; width: auto; max-width: 100%; border: 0; display: block; margin: 0 auto;" />
          </div>
          <div style="padding: 28px;">
            <h2 style="color: #1D9E75; margin-top: 0; font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 20px;">You have been approved for EduBlast early access!</h2>
            <p>Hello ${cleanFirstName},</p>
            <p>Our team has approved your request for early access to the EduBlast platform!</p>
            <p>Your email address <a href="mailto:${cleanEmail}" style="color: #1D9E75; text-decoration: none; font-weight: 600;">${cleanEmail}</a> is now approved. You can register and setup your profile as a <strong>${role === "student" ? "Student" : "Teacher"}</strong>.</p>
            
            <div style="margin: 28px 0; text-align: center;">
              <a href="${signupUrl}" style="background-color: #1D9E75; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px -1px rgba(29, 158, 117, 0.2);">
                Sign Up and Access Now
              </a>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="font-size: 12px; color: #6b7280; text-align: center;">If you have any questions, please reply to this email.</p>
          </div>
        </div>
      `;

      const emailRes = await sendEmail({
        to: cleanEmail,
        subject: "Invitation to register: Your EduBlast account is approved!",
        html: htmlContent,
        log: {
          kind: "other",
          userId: ctx.user.id,
        },
      });

      emailSent = emailRes.success;
      if (!emailRes.success) emailError = (emailRes as any).error;
    }

    return NextResponse.json({
      success: true,
      row: inserted,
      emailSent,
      emailError,
    });
  } catch (err) {
    console.error("[POST /api/admin/approved-emails] Server error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
