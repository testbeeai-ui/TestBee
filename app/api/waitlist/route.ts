import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/integrations/supabase/server";
import {
  sendAmbassadorApplicationEmail,
  sendWaitlistConfirmationEmail,
} from "@/lib/email/sendWaitlistEmails";
import { waitlistSubmissionsTable, type WaitlistSignupTier } from "@/lib/waitlist/waitlistDb";
import {
  generateNextWaitlistId,
  isWaitlistTestEmail,
  normalizeWaitlistEmail,
} from "@/lib/waitlist/waitlistId";
import { normalizeIndianMobile } from "@/lib/waitlist/phone";

type WaitlistRole = "student" | "teacher" | "parent" | "other";

function isRole(v: unknown): v is WaitlistRole {
  return v === "student" || v === "teacher" || v === "parent" || v === "other";
}

function isSignupTier(v: unknown): v is WaitlistSignupTier {
  return v === "waitlist" || v === "ambassador";
}

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const signupTier: WaitlistSignupTier = isSignupTier(body.signupTier)
      ? body.signupTier
      : "ambassador";

    const email =
      typeof body.email === "string" ? normalizeWaitlistEmail(body.email) : "";
    const phoneRaw = typeof body.phone === "string" ? body.phone : "";
    const phoneResult = normalizeIndianMobile(phoneRaw);

    if (!email) {
      return NextResponse.json({ error: "Missing email address" }, { status: 400 });
    }
    if (!phoneResult.ok) {
      return NextResponse.json({ error: phoneResult.error }, { status: 400 });
    }
    const phone = phoneResult.phone;

    const supabase = await createClient();
    const admin = createAdminClient();
    const writer = admin ?? supabase;
    const table = waitlistSubmissionsTable(writer);

    // ── Step 1: quick waitlist signup ──
    if (signupTier === "waitlist") {
      const c3 = Boolean(body.c3);
      if (!c3) {
        return NextResponse.json(
          { error: "Privacy consent is required" },
          { status: 400 }
        );
      }

      if (!isWaitlistTestEmail(email)) {
        const { data: existing } = await table
          .select("waitlist_id, signup_tier")
          .eq("email", email)
          .maybeSingle();

        if (existing) {
          return NextResponse.json({
            ok: true,
            waitlistId: existing.waitlist_id,
            alreadyRegistered: true,
          });
        }
      }

      const generatedId = await generateNextWaitlistId(writer);
      const { error } = await table.insert({
        waitlist_id: generatedId,
        signup_tier: "waitlist",
        email,
        phone: phone.slice(0, 50),
        consent_terms: true,
        consent_updates: true,
        admin_status: "new",
      });

      if (error) {
        console.error("[POST /api/waitlist] Quick signup insert error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const emailSent = await sendWaitlistConfirmationEmail(generatedId, email);

      return NextResponse.json({ ok: true, waitlistId: generatedId, emailSent });
    }

    // ── Step 2: ambassador full application ──
    const {
      waitlistId: existingWaitlistId,
      role,
      firstName,
      lastName,
      city,
      state,
      studentClass,
      school,
      exam,
      coaching,
      hours,
      marks,
      subject,
      exp,
      stucount,
      linkedin,
      childClass,
      childExam,
      org,
      orgRole,
      website,
      selectedInterests,
      whyJoin,
      referral,
      refcode,
      c1,
      c2,
    } = body;

    if (!isRole(role)) {
      return NextResponse.json({ error: "Invalid or missing role" }, { status: 400 });
    }
    if (typeof firstName !== "string" || !firstName.trim()) {
      return NextResponse.json({ error: "Missing first name" }, { status: 400 });
    }
    if (typeof lastName !== "string" || !lastName.trim()) {
      return NextResponse.json({ error: "Missing last name" }, { status: 400 });
    }
    if (typeof city !== "string" || !city.trim()) {
      return NextResponse.json({ error: "Missing city" }, { status: 400 });
    }
    if (typeof state !== "string" || !state.trim()) {
      return NextResponse.json({ error: "Missing state" }, { status: 400 });
    }
    if (!c1) {
      return NextResponse.json(
        { error: "Terms and privacy policy consent is required" },
        { status: 400 }
      );
    }
    if (!c2) {
      return NextResponse.json(
        { error: "Updates and onboarding consent is required" },
        { status: 400 }
      );
    }

    const ambassadorRow = {
      signup_tier: "ambassador" as const,
      ambassador_applied_at: new Date().toISOString(),
      role,
      first_name: firstName.trim().slice(0, 100),
      last_name: lastName.trim().slice(0, 100),
      email,
      phone: phone.slice(0, 50),
      city: city.trim().slice(0, 100),
      state: state.trim().slice(0, 100),
      student_class:
        typeof studentClass === "string" ? studentClass.slice(0, 100) : null,
      school: typeof school === "string" ? school.slice(0, 255) : null,
      exam: typeof exam === "string" ? exam.slice(0, 100) : null,
      coaching: typeof coaching === "string" ? coaching.slice(0, 100) : null,
      study_hours: typeof hours === "string" ? hours.slice(0, 100) : null,
      grade10_marks: typeof marks === "string" ? marks.slice(0, 100) : null,
      primary_subject:
        typeof subject === "string" ? subject.slice(0, 100) : null,
      experience: typeof exp === "string" ? exp.slice(0, 100) : null,
      students_count:
        typeof stucount === "string" ? stucount.slice(0, 100) : null,
      linkedin: typeof linkedin === "string" ? linkedin.slice(0, 500) : null,
      child_class:
        typeof childClass === "string" ? childClass.slice(0, 100) : null,
      child_exam: typeof childExam === "string" ? childExam.slice(0, 100) : null,
      organisation: typeof org === "string" ? org.slice(0, 255) : null,
      organisation_role:
        typeof orgRole === "string" ? orgRole.slice(0, 100) : null,
      website: typeof website === "string" ? website.slice(0, 500) : null,
      interests: Array.isArray(selectedInterests)
        ? selectedInterests.filter((x) => typeof x === "string").slice(0, 20)
        : [],
      why_join:
        typeof whyJoin === "string" ? whyJoin.trim().slice(0, 2000) : null,
      referral:
        typeof referral === "string" ? referral.trim().slice(0, 200) : null,
      refcode: typeof refcode === "string" ? refcode.trim().slice(0, 100) : null,
      consent_terms: Boolean(c1),
      consent_updates: Boolean(c2),
      admin_status: "new" as const,
    };

    const waitlistIdStr =
      typeof existingWaitlistId === "string" ? existingWaitlistId.trim() : "";

    if (waitlistIdStr) {
      const { data: byId, error: fetchErr } = await table
        .select("id, email")
        .eq("waitlist_id", waitlistIdStr)
        .maybeSingle();

      if (fetchErr || !byId) {
        return NextResponse.json(
          { error: "Waitlist record not found. Complete Step 1 first." },
          { status: 404 }
        );
      }

      const { error } = await table
        .update(ambassadorRow)
        .eq("waitlist_id", waitlistIdStr);

      if (error) {
        console.error("[POST /api/waitlist] Ambassador update error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const emailSent = await sendAmbassadorApplicationEmail({
        waitlistId: waitlistIdStr,
        firstName: ambassadorRow.first_name,
        lastName: ambassadorRow.last_name,
        email,
        role,
      });

      return NextResponse.json({ ok: true, waitlistId: waitlistIdStr, emailSent });
    }

    const { data: byEmail } = await table
      .select("waitlist_id")
      .eq("email", email)
      .maybeSingle();

    if (byEmail) {
      const { error } = await table
        .update(ambassadorRow)
        .eq("email", email);

      if (error) {
        console.error("[POST /api/waitlist] Ambassador email update error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const emailSent = await sendAmbassadorApplicationEmail({
        waitlistId: byEmail.waitlist_id,
        firstName: ambassadorRow.first_name,
        lastName: ambassadorRow.last_name,
        email,
        role,
      });

      return NextResponse.json({ ok: true, waitlistId: byEmail.waitlist_id, emailSent });
    }

    const generatedId = await generateNextWaitlistId(writer);
    const { error } = await table.insert({
      waitlist_id: generatedId,
      ...ambassadorRow,
    });

    if (error) {
      console.error("[POST /api/waitlist] Ambassador insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const emailSent = await sendAmbassadorApplicationEmail({
      waitlistId: generatedId,
      firstName: ambassadorRow.first_name,
      lastName: ambassadorRow.last_name,
      email,
      role,
    });

    return NextResponse.json({ ok: true, waitlistId: generatedId, emailSent });
  } catch (err) {
    console.error("[POST /api/waitlist] Server error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
