import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import {
  DEFAULT_BUDDY_PRIVACY,
  parseBuddyPrivacySettings,
  type BuddyPrivacyKey,
  type BuddyPrivacySettings,
} from "@/lib/buddy/buddyPrivacy";
import {
  enforceSameOriginForCookieAuth,
  requireAuthenticatedUser,
} from "@/lib/auth/securityGuards";

/** GET /api/buddy/privacy — current user's sharing settings. */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const supabase = await createClient();
  const { data, error } = await (supabase.from("profiles" as any) as any)
    .select("buddy_privacy_settings")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    settings: parseBuddyPrivacySettings(data?.buddy_privacy_settings),
  });
}

/** PATCH /api/buddy/privacy — update sharing settings. */
export async function PATCH(request: Request) {
  const csrfFail = enforceSameOriginForCookieAuth(request);
  if (csrfFail) return csrfFail;

  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  let body: { settings?: Partial<BuddyPrivacySettings> };
  try {
    body = (await request.json()) as { settings?: Partial<BuddyPrivacySettings> };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: existing } = await (supabase.from("profiles" as any) as any)
    .select("buddy_privacy_settings")
    .eq("id", auth.user.id)
    .maybeSingle();

  const merged = parseBuddyPrivacySettings(existing?.buddy_privacy_settings);
  const patch = body.settings ?? {};
  for (const key of Object.keys(DEFAULT_BUDDY_PRIVACY) as BuddyPrivacyKey[]) {
    if (typeof patch[key] === "boolean") merged[key] = patch[key];
  }

  const { error } = await (supabase.from("profiles" as any) as any)
    .update({ buddy_privacy_settings: merged })
    .eq("id", auth.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, settings: merged });
}
