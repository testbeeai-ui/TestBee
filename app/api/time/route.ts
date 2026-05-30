import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";

export async function GET(request: Request) {
  let nowMs = Date.now();

  try {
    const auth = await getSupabaseAndUser(request);
    if (auth) {
      const sb = auth.supabase as any;
      const uid = auth.user.id;

      // 1. Check if global time-travel is enabled in rdm_config
      const { data: rdmData } = await sb
        .from("rdm_config")
        .select("value")
        .eq("key", "global_time_travel_enabled")
        .maybeSingle();
      const globalActive = rdmData ? Number(rdmData.value) === 1 : false;

      // 2. Fetch specific student's profile time-travel details
      const { data: profile } = await sb
        .from("profiles")
        .select("time_travel_enabled, time_travel_offset_ms")
        .eq("id", uid)
        .maybeSingle();

      const allowed = globalActive || (profile ? Boolean(profile.time_travel_enabled) : false);

      if (allowed && profile?.time_travel_offset_ms) {
        const offset = Number(profile.time_travel_offset_ms);
        if (offset && Number.isFinite(offset)) {
          nowMs += offset;
        }
      }
    }
  } catch (e) {
    console.error("[api/time] Failed to resolve time-travel offset:", e);
  }

  return NextResponse.json({
    nowMs,
    nowIso: new Date(nowMs).toISOString(),
  });
}
