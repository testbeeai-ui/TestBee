import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import type { SavedRevisionCard } from "@/types";
import { normalizeRevisionCardForSave } from "@/lib/saved/revisionCardIdentity";
import { toSavedItemRow, upsertSavedItemRows } from "@/lib/saved/userSavedItemsSync";

/** PATCH one revision card — upsert single row in user_saved_items (no profiles JSONB). */
export async function PATCH(request: Request) {
  try {
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;

    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = ctx;

    const body = (await request.json().catch(() => null)) as { card?: SavedRevisionCard } | null;
    if (!body?.card || typeof body.card !== "object") {
      return NextResponse.json({ error: "card required" }, { status: 400 });
    }

    const card = normalizeRevisionCardForSave(body.card);
    const row = toSavedItemRow(user.id, "saved_revision_card", card);
    const result = await upsertSavedItemRows(supabase, [row]);

    if (result.error) {
      console.error("revision-cards PATCH upsert error", result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, card });
  } catch (e) {
    console.error("revision-cards PATCH error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
