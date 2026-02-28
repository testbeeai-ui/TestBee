import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";

/**
 * Returns community members (id, name) for use in EduFund and similar features.
 * Uses admin client to bypass RLS. Falls back to auth.users if profiles is empty.
 */
export async function GET() {
  try {
    const admin = createAdminClient();
    const db = admin ?? null;

    if (!db) {
      return NextResponse.json(
        { members: [] },
        { headers: { "Cache-Control": "private, no-store, max-age=60" } }
      );
    }

    const { data: profiles } = await db
      .from("profiles")
      .select("id, name")
      .order("created_at", { ascending: false })
      .limit(10);

    if (profiles && profiles.length > 0) {
      return NextResponse.json(
        {
          members: profiles.map((p: { id: string; name: string | null }) => ({
            id: p.id,
            name: p.name ?? "Student",
          })),
        },
        { headers: { "Cache-Control": "private, no-store, max-age=60" } }
      );
    }

    const { data: doubtAuthors } = await db
      .from("doubts")
      .select("user_id")
      .order("created_at", { ascending: false })
      .limit(20);

    const uniqueIds = [...new Set((doubtAuthors ?? []).map((r: { user_id: string }) => r.user_id))].slice(
      0,
      10
    );

    if (uniqueIds.length === 0) {
      return NextResponse.json(
        { members: [] },
        { headers: { "Cache-Control": "private, no-store, max-age=60" } }
      );
    }

    const { data: profileRows } = await db
      .from("profiles")
      .select("id, name")
      .in("id", uniqueIds);

    const byId = new Map((profileRows ?? []).map((p: { id: string; name: string | null }) => [p.id, p.name ?? "Student"]));
    const members = uniqueIds.map((id) => ({
      id,
      name: byId.get(id) ?? "Student",
    }));

    return NextResponse.json(
      { members },
      { headers: { "Cache-Control": "private, no-store, max-age=60" } }
    );
  } catch (e) {
    console.error("[community-members] error", e);
    return NextResponse.json({ members: [] }, { status: 500 });
  }
}
