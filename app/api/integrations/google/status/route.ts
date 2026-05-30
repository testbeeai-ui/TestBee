import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
  createClientWithToken,
  getSupabaseAdminEnvDiagnostics,
  normalizeServiceRoleKey,
} from "@/integrations/supabase/server";

export const dynamic = "force-dynamic";

/** Calendar OAuth (scopes), stored refresh tokens — separate from Supabase "Sign in with Google". */
export async function GET(request: Request) {
  const headerAuth = request.headers.get("authorization") || "";
  const bearer = headerAuth.toLowerCase().startsWith("bearer ") ? headerAuth.slice(7).trim() : "";
  const supabase = bearer ? createClientWithToken(bearer) : await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("signup_google")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const adminDiag = getSupabaseAdminEnvDiagnostics();
  /** Safe booleans only — no secrets. Confirms production env name `SUPABASE_SERVICE_ROLE_KEY` + URL/JWT project match. */
  const deployment = {
    serviceRoleKeyPresent: Boolean(normalizeServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY)),
    serviceRoleJwtWellFormed: adminDiag.jwtWellFormed,
    /** `true` when URL host is `*.supabase.co` and JWT `ref` matches; `null` if either cannot be parsed. */
    urlAndServiceRoleSameProject: adminDiag.refsMatch,
    note: adminDiag.note ?? null,
  };

  let calendarConnected = false;
  let tokenLookupFailed = false;
  const admin = createAdminClient();
  if (admin) {
    const { data: tok, error: tokErr } = await admin
      .from("teacher_google_calendar_tokens")
      .select("refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();
    if (tokErr) {
      tokenLookupFailed = true;
      console.error("[google/status] teacher_google_calendar_tokens:", tokErr.message);
    } else {
      calendarConnected = Boolean(
        tok?.refresh_token && String(tok.refresh_token).trim().length > 0
      );
    }
  } else {
    // Never infer Calendar access from profiles.google_connected — it was historically conflated with
    // "sign in with Google" and misleads UI after abandoned OAuth tabs. Require service role to verify tokens.
    console.warn(
      "[google/status] SUPABASE_SERVICE_ROLE_KEY missing or empty after normalize — cannot read teacher_google_calendar_tokens. Env must define exactly SUPABASE_SERVICE_ROLE_KEY on the server (e.g. Vercel → Production)."
    );
    calendarConnected = false;
  }

  return NextResponse.json(
    {
      connected: calendarConnected,
      /** Supabase auth originally used Google as identity provider — not Calendar access. */
      signupGoogle: Boolean((profile as { signup_google?: boolean | null } | null)?.signup_google),
      /** True when admin client could not read the tokens row (schema/RLS/key invalid/etc.). */
      tokenLookupFailed,
      deployment,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
