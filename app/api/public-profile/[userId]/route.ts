import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/integrations/supabase/server";
import { getPublicProfile, getPublicProfileWithProfileRow } from "@/lib/publicProfileService";

/**
 * Ensures a profiles row exists for a given userId by backfilling from auth.users.
 * Returns auth data to build a profile immediately (avoids read-after-write lag).
 */
async function ensureProfileFromAuth(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string
): Promise<{ name: string; avatarUrl: string | null; createdAt: string } | null> {
  try {
    const { data: { user: authUser }, error } = await admin.auth.admin.getUserById(userId);
    if (error) {
      console.error("[public-profile] getUserById error:", error.message);
      return null;
    }
    if (!authUser) {
      console.warn("[public-profile] getUserById: no user found for", userId.slice(0, 8) + "...");
      return null;
    }
    const name =
      authUser.user_metadata?.full_name ??
      authUser.user_metadata?.name ??
      authUser.email?.split("@")[0] ??
      "User";
    const avatarUrl =
      authUser.user_metadata?.avatar_url ??
      authUser.user_metadata?.picture ??
      null;
    const googleConnected = authUser.app_metadata?.provider === "google";
    const { error: upsertErr } = await admin
      .from("profiles")
      .upsert(
        {
          id: userId,
          name,
          avatar_url: avatarUrl,
          role: "student",
          onboarding_complete: true,
          google_connected: googleConnected,
        },
        { onConflict: "id" }
      );
    if (upsertErr) {
      console.error("[public-profile] profiles upsert error:", upsertErr.message);
      return null;
    }
    console.log("[public-profile] Backfilled profile for", authUser.email ?? userId.slice(0, 8) + "...");
    return {
      name,
      avatarUrl,
      createdAt: authUser.created_at ?? new Date().toISOString(),
    };
  } catch (err) {
    console.error("[public-profile] ensureProfileFromAuth error:", err);
    return null;
  }
}

/**
 * Fetches a user's public profile.
 *
 * - Uses admin client (SUPABASE_SERVICE_ROLE_KEY) when available to bypass RLS
 * - When profile row is missing but user exists in auth.users, backfills from auth
 *   (handles legacy accounts where handle_new_user trigger did not run)
 * - Production: ensure SUPABASE_SERVICE_ROLE_KEY is set for reliable profile resolution
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const headers = new Headers();
  headers.set("Cache-Control", "private, no-store, max-age=0");

  try {
    const { userId } = await params;
    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return NextResponse.json({ error: "Invalid userId format" }, { status: 400 });
    }

    const admin = createAdminClient();
    const db = admin ?? (await createClient());

    let profile = await getPublicProfile(userId, db);

    if (!profile) {
      if (!admin) {
        console.warn("[public-profile] No admin client (SUPABASE_SERVICE_ROLE_KEY missing); cannot backfill");
      } else {
        console.log("[public-profile] Profile null for", userId.slice(0, 8) + "...", "attempting backfill");
        const authData = await ensureProfileFromAuth(admin, userId);
        if (authData) {
          profile = await getPublicProfileWithProfileRow(
            userId,
            {
              id: userId,
              name: authData.name,
              avatar_url: authData.avatarUrl,
              bio: null,
              rdm: 0,
              created_at: authData.createdAt,
              lifetime_answer_rdm: 0,
            },
            admin
          );
          console.log("[public-profile] Backfill succeeded, returning full profile with real data");
        } else {
          console.warn("[public-profile] Backfill failed for", userId.slice(0, 8) + "...");
        }
      }
    }

    return NextResponse.json(profile ?? null, { headers });
  } catch (e) {
    console.error("public-profile API error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
