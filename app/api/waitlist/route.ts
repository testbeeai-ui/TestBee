import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/integrations/supabase/server";
import { waitlistSubmissionsTable } from "@/lib/waitlist/waitlistDb";

type WaitlistRole = "student" | "teacher" | "parent" | "other";

function isRole(v: unknown): v is WaitlistRole {
  return v === "student" || v === "teacher" || v === "parent" || v === "other";
}

export async function POST(request: Request) {
  try {
    let body: Record<string, any>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const {
      role,
      firstName,
      lastName,
      email,
      phone,
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

    // Validate required fields
    if (!isRole(role)) {
      return NextResponse.json({ error: "Invalid or missing role" }, { status: 400 });
    }
    if (!firstName || typeof firstName !== "string" || !firstName.trim()) {
      return NextResponse.json({ error: "Missing first name" }, { status: 400 });
    }
    if (!lastName || typeof lastName !== "string" || !lastName.trim()) {
      return NextResponse.json({ error: "Missing last name" }, { status: 400 });
    }
    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "Missing email address" }, { status: 400 });
    }
    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return NextResponse.json({ error: "Missing phone number" }, { status: 400 });
    }
    if (!city || typeof city !== "string" || !city.trim()) {
      return NextResponse.json({ error: "Missing city" }, { status: 400 });
    }
    if (!state || typeof state !== "string" || !state.trim()) {
      return NextResponse.json({ error: "Missing state" }, { status: 400 });
    }
    if (!c1) {
      return NextResponse.json({ error: "Terms and privacy policy consent is required" }, { status: 400 });
    }
    if (!c2) {
      return NextResponse.json({ error: "Updates and onboarding consent is required" }, { status: 400 });
    }

    // Generate a unique waitlist_id: EB-2026-[random 4 digits]
    const generatedId = `EB-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const supabase = await createClient();
    const admin = createAdminClient();
    const writer = admin ?? supabase;

    const row = {
      waitlist_id: generatedId,
      role,
      first_name: firstName.trim().slice(0, 100),
      last_name: lastName.trim().slice(0, 100),
      email: email.trim().toLowerCase().slice(0, 255),
      phone: phone.trim().slice(0, 50),
      city: city.trim().slice(0, 100),
      state: state.trim().slice(0, 100),
      
      // Role specific fields
      student_class: typeof studentClass === "string" ? studentClass.slice(0, 100) : null,
      school: typeof school === "string" ? school.slice(0, 255) : null,
      exam: typeof exam === "string" ? exam.slice(0, 100) : null,
      coaching: typeof coaching === "string" ? coaching.slice(0, 100) : null,
      study_hours: typeof hours === "string" ? hours.slice(0, 100) : null,
      grade10_marks: typeof marks === "string" ? marks.slice(0, 100) : null,
      
      primary_subject: typeof subject === "string" ? subject.slice(0, 100) : null,
      experience: typeof exp === "string" ? exp.slice(0, 100) : null,
      students_count: typeof stucount === "string" ? stucount.slice(0, 100) : null,
      linkedin: typeof linkedin === "string" ? linkedin.slice(0, 500) : null,
      
      child_class: typeof childClass === "string" ? childClass.slice(0, 100) : null,
      child_exam: typeof childExam === "string" ? childExam.slice(0, 100) : null,
      
      organisation: typeof org === "string" ? org.slice(0, 255) : null,
      organisation_role: typeof orgRole === "string" ? orgRole.slice(0, 100) : null,
      website: typeof website === "string" ? website.slice(0, 500) : null,
      
      interests: Array.isArray(selectedInterests) 
        ? selectedInterests.filter((x) => typeof x === "string").slice(0, 20) 
        : [],
      why_join: typeof whyJoin === "string" ? whyJoin.trim().slice(0, 2000) : null,
      referral: typeof referral === "string" ? referral.trim().slice(0, 200) : null,
      refcode: typeof refcode === "string" ? refcode.trim().slice(0, 100) : null,
      
      consent_terms: Boolean(c1),
      consent_updates: Boolean(c2),
      admin_status: "new",
    };

    const { error } = await waitlistSubmissionsTable(writer).insert(row);
    if (error) {
      console.error("[POST /api/waitlist] Database insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, waitlistId: generatedId });
  } catch (err) {
    console.error("[POST /api/waitlist] Server error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
