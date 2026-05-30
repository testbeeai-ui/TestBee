import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isStudentProfileBasicInfoComplete } from "@/lib/profile/studentProfileBasicInfo";
import type { Profile } from "@/hooks/useAuth";

/** GET — profile checklist verification from profiles row. */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = ctx;

    const { data: row, error } = await supabase
      .from("profiles")
      .select("first_name, last_name, name, state, city, phone, gender, category, avatar_url, role")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const profile = row as Profile;
    const basicInfoComplete =
      profile.role === "student" && isStudentProfileBasicInfoComplete(profile, user.email);

    return NextResponse.json({
      basicInfoComplete,
      hasAvatarUrl:
        Boolean(profile.avatar_url?.trim()) && profile.avatar_url?.includes("profile-avatars"),
    });
  } catch (e) {
    console.error("onboarding profile-status GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
