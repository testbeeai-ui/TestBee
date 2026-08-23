import { after, NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/server";
import { EDUDECA_GMAIL_RE } from "@/lib/edudeca/register-interest";
import { requestEduDecaWelcomeEmail } from "@/lib/edudeca/requestEduDecaWelcomeEmail";

function trim(v: unknown, max = 300): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const {
    email: rawEmail,
    class_level: rawClass,
    institution: rawInstitution,
    state: rawState,
    city: rawCity,
  } = body as Record<string, unknown>;

  const email = trim(rawEmail).toLowerCase();
  const classLevel = typeof rawClass === "number" ? rawClass : Number(rawClass);
  const institution = trim(rawInstitution);
  const state = trim(rawState);
  const city = trim(rawCity);

  if (!EDUDECA_GMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Only @gmail.com addresses are accepted." }, { status: 422 });
  }
  if (classLevel !== 11 && classLevel !== 12) {
    return NextResponse.json({ error: "class_level must be 11 or 12." }, { status: 422 });
  }
  if (institution.length < 2) {
    return NextResponse.json({ error: "Institution name is required." }, { status: 422 });
  }
  if (!state || !city) {
    return NextResponse.json({ error: "State and city are required." }, { status: 422 });
  }

  const admin = createAdminClient();
  if (!admin) {
    console.error(
      "[edudeca/register-interest] No admin client — SUPABASE_SERVICE_ROLE_KEY missing."
    );
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  const interestRow = {
    email,
    class_level: classLevel,
    institution,
    state,
    city,
  };

  const { error: insertError } = await admin
    .from("edudeca_interest_registrations")
    .insert(interestRow);

  let isFirstRegistration = false;
  if (!insertError) {
    isFirstRegistration = true;
  } else if (insertError.code === "23505") {
    const { error: updateError } = await admin
      .from("edudeca_interest_registrations")
      .update({
        class_level: classLevel,
        institution,
        state,
        city,
      })
      .eq("email", email);
    if (updateError) {
      console.error("[edudeca/register-interest] waitlist update error:", updateError);
      return NextResponse.json(
        { error: "Could not save registration. Please try again." },
        { status: 500 }
      );
    }
  } else {
    console.error("[edudeca/register-interest] waitlist insert error:", insertError);
    return NextResponse.json(
      { error: "Could not save registration. Please try again." },
      { status: 500 }
    );
  }

  if (isFirstRegistration) {
    after(async () => {
      try {
        await requestEduDecaWelcomeEmail({ email });
      } catch (err) {
        console.error("[edudeca/register-interest] welcome email error:", err);
      }
    });
  }

  return NextResponse.json({ ok: true });
}
