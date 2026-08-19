import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/server";
import { EDUDECA_GMAIL_RE } from "@/lib/edudeca/register-interest";

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

  const { error: waitlistError } = await admin
    .from("edudeca_interest_registrations")
    .upsert(
      { email, class_level: classLevel, institution, state, city },
      { onConflict: "email", ignoreDuplicates: false }
    );
  if (waitlistError) {
    console.error("[edudeca/register-interest] waitlist upsert error:", waitlistError);
    return NextResponse.json(
      { error: "Could not save registration. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
