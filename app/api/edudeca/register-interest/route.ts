import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/server";
import {
  EDUDECA_GMAIL_RE,
  buildEduDecaProfileUpsert,
  buildWaitlistUpsert,
  resolveProfileUserId,
} from "@/lib/edudeca/register-interest";

function trim(v: unknown, max = 300): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

type AuthAdmin = {
  getUserByEmail?: (email: string) => Promise<{
    data: { user: { id: string } | null };
    error: { message: string; status?: number } | null;
  }>;
  createUser: (attrs: {
    email: string;
    email_confirm: boolean;
    user_metadata: Record<string, string>;
  }) => Promise<{
    data: { user: { id: string } | null };
    error: { message: string } | null;
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

async function createIdForEmail(
  admin: AdminClient,
  adminAuth: AuthAdmin,
  email: string,
): Promise<string> {
  const { data, error } = await adminAuth.createUser({
    email,
    email_confirm: true,
    user_metadata: { source: "edudeca_interest" },
  });
  if (data.user?.id) return data.user.id;

  const existing = await findIdByEmail(admin, adminAuth, email);
  if (existing) return existing;

  throw new Error(error?.message ?? "Could not create auth user for this email.");
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

  // Waitlist first so a production submit is never lost if auth user creation fails.
  const { error: waitlistError } = await admin.from("edudeca_interest_registrations").upsert(
    buildWaitlistUpsert(payload),
    { onConflict: "email" },
  );
  if (waitlistError) {
    console.error("[edudeca/register-interest] waitlist upsert error:", waitlistError);
    return NextResponse.json({ error: "Could not save registration. Please try again." }, { status: 500 });
  }

  const adminAuth = admin.auth.admin as unknown as AuthAdmin;

  let userId: string;
  try {
    userId = await resolveProfileUserId(email, {
      findIdByEmail: (value) => findIdByEmail(admin, adminAuth, value),
      createIdForEmail: (value) => createIdForEmail(admin, adminAuth, value),
    });
  } catch (err) {
    console.error("[edudeca/register-interest] auth user resolve failed:", err);
    return NextResponse.json({ error: "Could not save registration. Please try again." }, { status: 500 });
  }

  const row = buildEduDecaProfileUpsert(userId, payload);

  const { data: savedProfile, error: profileError } = await asEduDecaAdmin(admin)
    .from("edudeca_profiles")
    .upsert(row, { onConflict: "id" })
    .select("id, email")
    .maybeSingle();

  if (profileError || !savedProfile?.id) {
    console.error("[edudeca/register-interest] edudeca_profiles upsert error:", profileError);
    return NextResponse.json({ error: "Could not save registration. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
