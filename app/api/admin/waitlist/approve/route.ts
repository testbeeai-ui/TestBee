import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { waitlistSubmissionsTable } from "@/lib/waitlist/waitlistDb";
import { sendEmail } from "@/lib/email/emailService";
import { getPortalBaseUrl } from "@/lib/email/portalBaseUrl";

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

    // 4. Send approval email
    const siteUrl = getPortalBaseUrl();
    const signupUrl = `${siteUrl}/auth?mode=signup&role=${role}`;
    
    const defaultHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff; overflow: hidden; line-height: 1.6;">
        <div style="background-color: #161b27; padding: 24px; text-align: center;">
          <img src="${siteUrl}/images/logo-2.png" alt="EduBlast" height="36" style="height: 36px; width: auto; max-width: 100%; border: 0; display: block; margin: 0 auto;" />
        </div>
        <div style="padding: 28px;">
          <h2 style="color: #1D9E75; margin-top: 0; font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 20px;">Welcome to EduBlast early access!</h2>
          <p>Hello ${firstName},</p>
          <p>We are thrilled to let you know that your waitlist application has been approved!</p>
          <p>Your email address <a href="mailto:${email}" style="color: #1D9E75; text-decoration: none; font-weight: 600;">${email}</a> is now approved for early access. You can proceed to create your account and complete your profile onboarding as a <strong>${role === "student" ? "Student" : "Teacher"}</strong>.</p>
          
          ${customMessage ? `<div style="background-color: #f3f4f6; border-left: 4px solid #1D9E75; padding: 12px 16px; margin: 20px 0; border-radius: 8px; font-style: italic;">"${customMessage}"</div>` : ""}
          
          <div style="margin: 28px 0; text-align: center;">
            <a href="${signupUrl}" style="background-color: #1D9E75; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px -1px rgba(29, 158, 117, 0.2);">
              Sign Up and Get Access
            </a>
          </div>
          
          <p>Once you sign up with Google or your email credentials, our system will automatically match your email and walk you through your setup steps.</p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="font-size: 12px; color: #6b7280; text-align: center;">If you have any questions or did not apply for waitlist, please reply to this email.</p>
        </div>
      </div>
    `;

    const emailRes = await sendEmail({
      to: email,
      subject: "Your waitlist application is approved! Setup your EduBlast account",
      html: defaultHtml,
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
