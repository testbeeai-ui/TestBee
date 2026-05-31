import { NextResponse } from "next/server";
import { createClient, createClientWithToken } from "@/integrations/supabase/server";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";

async function getSupabaseAndUser(request: Request) {
  const cookieClient = await createClient();
  let user = (await cookieClient.auth.getUser()).data?.user ?? null;
  if (!user) {
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (token) {
      const {
        data: { user: u },
      } = await cookieClient.auth.getUser(token);
      user = u ?? null;
      if (user) {
        return { supabase: createClientWithToken(token), user };
      }
    }
  }
  return user ? { supabase: cookieClient, user } : null;
}

export async function POST(request: Request) {
  try {
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;

    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = ctx;

    const { error } = await supabase
      .from("profiles")
      .update({
        plan_tier: "free",
        free_trial_activated: false,
        free_trial_activated_at: null,
        onboarding_reward_progress: {},
      })
      .eq("id", user.id);

    if (error) {
      console.error("revoke-trial POST error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("revoke-trial POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
