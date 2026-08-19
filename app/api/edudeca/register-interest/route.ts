import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";

const GMAIL_RE = /^[^\s@]+@gmail\.com$/i;

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

  if (!GMAIL_RE.test(email)) {
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
    console.error("[edudeca/register-interest] No admin client — SUPABASE_SERVICE_ROLE_KEY missing.");
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  // UPSERT: same Gmail can re-submit to update their details. No duplicates.
  const { error: dbError } = await admin
    .from("edudeca_interest_registrations")
    .upsert(
      { email, class_level: classLevel, institution, state, city },
      { onConflict: "email", ignoreDuplicates: false },
    );

  if (dbError) {
    console.error("[edudeca/register-interest] DB error:", dbError);
    return NextResponse.json({ error: "Could not save registration. Please try again." }, { status: 500 });
  }

  // If the caller is authenticated, also upsert into `edudeca_profiles`.
  // Reason: `public.edudeca_profiles` uses RLS with `auth.uid() = id`, so anonymous users cannot see
  // their submissions there.
  const authed = await getSupabaseAndUser(request);
  if (authed) {
    const { user } = authed;
    const {
      id,
      email: authedEmail,
    } = user;

    // `edudeca_profiles` may not be present in generated Web Supabase types yet.
    // Cast to `any` to avoid blocking the build; runtime will still hit the correct table.
    const adminAny = admin as any;
    const { error: profileError } = await adminAny.from("edudeca_profiles").upsert(
      {
        id,
        class_level: classLevel,
        institution_name: institution,
        state,
        city,
        email: authedEmail ?? email,
      },
      { onConflict: "id", ignoreDuplicates: false }
    );

    if (profileError) {
      // Don't fail the whole request if profiles upsert fails — interest table is the source of truth
      // for unauth submissions.
      console.error("[edudeca/register-interest] profiles upsert error:", profileError);
    }
  }

  return NextResponse.json({ ok: true });
}
