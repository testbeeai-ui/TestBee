import { after, NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/server";
import {
  EDUDECA_EMAIL_RE,
  buildEduDecaProfileUpsert,
  buildWaitlistUpsert,
  findExistingProfileUserId,
} from "@/lib/edudeca/register-interest";
import { sendEduDecaStudentWelcomeEmail } from "@/lib/email/sendEduDecaWelcomeEmail";

function trim(v: unknown, max = 300): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

type AuthAdmin = {
  getUserByEmail?: (email: string) => Promise<{
    data: { user: { id: string } | null };
    error: { message: string; status?: number } | null;
  }>;
};

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

type EduDecaAdmin = {
  rpc: (
    fn: "edudeca_auth_user_id_by_email",
    args: { p_email: string },
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (table: "edudeca_profiles") => {
    upsert: (
      row: ReturnType<typeof buildEduDecaProfileUpsert>,
      opts: { onConflict: "id" },
    ) => {
      select: (
        columns: "id, email",
      ) => {
        maybeSingle: () => Promise<{
          data: { id: string; email: string | null } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

function asEduDecaAdmin(admin: AdminClient): EduDecaAdmin {
  return admin as unknown as EduDecaAdmin;
}

async function findIdByEmail(
  admin: AdminClient,
  adminAuth: AuthAdmin,
  email: string,
): Promise<string | null> {
  const { data: rpcId, error: rpcError } = await asEduDecaAdmin(admin).rpc(
    "edudeca_auth_user_id_by_email",
    { p_email: email },
  );
  if (!rpcError && typeof rpcId === "string" && rpcId.length > 0) return rpcId;

  if (typeof adminAuth.getUserByEmail === "function") {
    const { data, error } = await adminAuth.getUserByEmail(email);
    if (!error && data.user?.id) return data.user.id;
  }

  return null;
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

  if (!EDUDECA_EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 422 });
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
      "[edudeca/register-interest] No admin client — SUPABASE_SERVICE_ROLE_KEY missing.",
    );
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  const payload = {
    email,
    classLevel: classLevel as 11 | 12,
    institution,
    state,
    city,
  };

  // Interest row is plain text — never create Auth users from this form.
  const { data: existingInterest, error: existingInterestError } = await admin
    .from("edudeca_interest_registrations")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  // Only treat as first registration when the lookup succeeded and found no row.
  const isFirstRegistration = !existingInterestError && !existingInterest?.email;

  const { error: waitlistError } = await admin.from("edudeca_interest_registrations").upsert(
    buildWaitlistUpsert(payload),
    { onConflict: "email" },
  );
  if (waitlistError) {
    console.error("[edudeca/register-interest] waitlist upsert error:", waitlistError);
    return NextResponse.json({ error: "Could not save registration. Please try again." }, { status: 500 });
  }

  const adminAuth = admin.auth.admin as unknown as AuthAdmin;
  const userId = await findExistingProfileUserId(email, {
    findIdByEmail: (value) => findIdByEmail(admin, adminAuth, value),
  });

  // Only update edudeca_profiles when this email already belongs to a Google Auth user.
  if (userId) {
    const row = buildEduDecaProfileUpsert(userId, payload);
    const { error: profileError } = await asEduDecaAdmin(admin)
      .from("edudeca_profiles")
      .upsert(row, { onConflict: "id" })
      .select("id, email")
      .maybeSingle();

    if (profileError) {
      console.error("[edudeca/register-interest] edudeca_profiles upsert error:", profileError);
      return NextResponse.json({ error: "Could not save registration. Please try again." }, { status: 500 });
    }
  }

  if (isFirstRegistration) {
    after(() => {
      void sendEduDecaStudentWelcomeEmail({ email, userId }).catch((err) => {
        console.error("[edudeca/register-interest] welcome email error:", err);
      });
    });
  }

  return NextResponse.json({ ok: true });
}
