import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import { requireAuthenticatedUser } from "@/lib/securityGuards";

function safeName(name: string | null): string {
  if (!name) return "Student";
  const cleaned = name.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Student";
  return cleaned.slice(0, 40);
}

/**
 * Returns community members (id, name) for use in EduFund and similar features.
 * Uses admin client to bypass RLS. Falls back to auth.users if profiles is empty.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if ("response" in auth) {
      return NextResponse.json(
        { members: [] },
        {
          status: 401,
          headers: { "Cache-Control": "private, no-store, max-age=0" },
        }
      );
    }

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
      .limit(8);

    if (profiles && profiles.length > 0) {
      return NextResponse.json(
        {
          members: profiles.map((p: { id: string; name: string | null }) => ({
            id: p.id,
            name: safeName(p.name),
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

    const uniqueIds = [
      ...new Set((doubtAuthors ?? []).map((r: { user_id: string }) => r.user_id)),
    ].slice(0, 8);

    if (uniqueIds.length === 0) {
      return NextResponse.json(
        { members: [] },
        { headers: { "Cache-Control": "private, no-store, max-age=60" } }
      );
    }

    const { data: profileRows } = await db.from("profiles").select("id, name").in("id", uniqueIds);

    const byId = new Map(
      (profileRows ?? []).map((p: { id: string; name: string | null }) => [
        p.id,
        safeName(p.name),
      ])
    );
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
