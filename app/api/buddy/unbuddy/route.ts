import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  enforceSameOriginForCookieAuth,
  requireAuthenticatedUser,
} from "@/lib/auth/securityGuards";

/** POST /api/buddy/unbuddy — end the active pair for the signed-in user. */
export async function POST(request: Request) {
  const csrfFail = enforceSameOriginForCookieAuth(request);
  if (csrfFail) return csrfFail;

  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not set" },
      { status: 500 }
    );
  }

  let buddyUserId: string | null = null;
  try {
    const body = (await request.json()) as { buddyUserId?: string };
    if (typeof body.buddyUserId === "string" && body.buddyUserId.trim()) {
      buddyUserId = body.buddyUserId.trim();
    }
  } catch {
    /* optional body */
  }

  const { data, error } = await admin.rpc("end_buddy_pair", {
    p_user_id: auth.user.id,
    p_buddy_user_id: buddyUserId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: true });
}
