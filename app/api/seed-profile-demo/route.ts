import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/server";

const DEMO_ACADEMICS = [
  { exam: "Class 10", board: "State Board", score: "94%", verified: "verified" },
  { exam: "Class 12", board: "State Board", score: "88%", verified: "verified" },
];

const DEMO_ACHIEVEMENTS = [
  { name: "Physics Olympiad", level: "State", year: 2024, result: "Bronze Medal" },
  { name: "Science Fair", level: "School", year: 2023, result: "Best Project" },
  { name: "Mock Test Topper", level: "District", year: 2025, result: "Rank 1" },
];

/**
 * Seeds profile_academics and profile_achievements for all users who have doubts or answers.
 * Uses service role to insert for any user. Skips users who already have records.
 */
export async function POST(request: Request) {
  try {
    const cookieSupabase = await createClient();
    let user = (await cookieSupabase.auth.getUser()).data?.user ?? null;
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!user && token) {
      const { data: { user: u } } = await cookieSupabase.auth.getUser(token);
      user = u ?? null;
    }
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Service role not configured. Add SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
    }

    const { data: doubtUserIds } = await admin.from("doubts").select("user_id");
    const { data: answerUserIds } = await admin.from("doubt_answers").select("user_id");
    const allIds = new Set<string>();
    (doubtUserIds ?? []).forEach((r: { user_id: string }) => allIds.add(r.user_id));
    (answerUserIds ?? []).forEach((r: { user_id: string }) => allIds.add(r.user_id));

    const { data: existingProfiles } = await admin.from("profiles").select("id").in("id", Array.from(allIds));
    let profileIds = new Set((existingProfiles ?? []).map((p: { id: string }) => p.id));

    // Create profiles for users who have doubts/answers but no profile (e.g. before handle_new_user trigger)
    const missingIds = [...allIds].filter((id) => !profileIds.has(id));
    let profilesCreated = 0;
    if (missingIds.length > 0) {
      for (const uid of missingIds) {
        const { data: { user: authUser } } = await admin.auth.admin.getUserById(uid);
        if (authUser) {
          const name = authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? authUser.email?.split("@")[0] ?? "User";
          const avatarUrl = authUser.user_metadata?.avatar_url ?? authUser.user_metadata?.picture ?? null;
          const googleConnected = authUser.app_metadata?.provider === "google";
          const { error } = await admin.from("profiles").insert({
            id: uid,
            name,
            avatar_url: avatarUrl,
            role: "student",
            onboarding_complete: true,
            google_connected: googleConnected,
          });
          if (!error) {
            profileIds.add(uid);
            profilesCreated++;
          }
        }
      }
      if (profilesCreated > 0) {
        profileIds = new Set([...profileIds]);
      }
    }

    const { data: existingAcademics } = await admin.from("profile_academics").select("user_id");
    const usersWithAcademics = new Set((existingAcademics ?? []).map((r: { user_id: string }) => r.user_id));

    const { data: existingAchievements } = await admin.from("profile_achievements").select("user_id");
    const usersWithAchievements = new Set((existingAchievements ?? []).map((r: { user_id: string }) => r.user_id));

    let academicsCount = 0;
    let achievementsCount = 0;

    for (const id of Array.from(profileIds)) {
      if (!usersWithAcademics.has(id)) {
        for (const a of DEMO_ACADEMICS) {
          const { error } = await admin.from("profile_academics").insert({
            user_id: id,
            exam: a.exam,
            board: a.board,
            score: a.score,
            verified: a.verified,
          });
          if (!error) academicsCount++;
        }
      }
      if (!usersWithAchievements.has(id)) {
        for (const a of DEMO_ACHIEVEMENTS) {
          const { error } = await admin.from("profile_achievements").insert({
            user_id: id,
            name: a.name,
            level: a.level,
            year: a.year,
            result: a.result,
          });
          if (!error) achievementsCount++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Profile demo data seeded.",
      results: {
        usersSeeded: profileIds.size,
        profilesCreated,
        academicsAdded: academicsCount,
        achievementsAdded: achievementsCount,
      },
    });
  } catch (e) {
    console.error("seed-profile-demo error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
