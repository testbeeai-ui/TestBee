import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  enforceSameOriginForCookieAuth,
  isDangerousRouteEnabled,
  requireAdminUser,
  requireAuthenticatedUser,
} from "@/lib/auth/securityGuards";

export async function POST(request: Request) {
  try {
    if (!isDangerousRouteEnabled("ENABLE_RDM_TOP_UP")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;
    // In dev/staging we allow the signed-in user to top up themselves so UI can be tested end-to-end.
    // In production, keep admin-only behavior for safety.
    const isProd = process.env.NODE_ENV === "production";
    const auth = isProd ? await requireAdminUser(request) : await requireAuthenticatedUser(request);
    if ("response" in auth) return auth.response;

    const body = await request.json();
    const amount = typeof body?.amount === "number" ? body.amount : parseInt(body?.amount, 10);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) {
      return NextResponse.json({ error: "Valid amount required" }, { status: 400 });
    }
    const targetUserId =
      isProd && typeof body?.userId === "string" && body.userId.trim()
        ? body.userId.trim()
        : auth.user.id;

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const { data: newRdm, error: rpcErr } = await admin.rpc("add_rdm", {
      uid: targetUserId,
      amt: amount,
    });

    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    }

    return NextResponse.json({ userId: targetUserId, rdm: newRdm, amountAdded: amount });
  } catch (e) {
    console.error("rdm top-up error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
