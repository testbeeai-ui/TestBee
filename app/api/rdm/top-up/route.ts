import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  enforceSameOriginForCookieAuth,
  isDangerousRouteEnabled,
  requireAdminUser,
} from "@/lib/securityGuards";

export async function POST(request: Request) {
  try {
    if (!isDangerousRouteEnabled("ENABLE_RDM_TOP_UP")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;
    const auth = await requireAdminUser(request);
    if ("response" in auth) return auth.response;

    const body = await request.json();
    const amount = typeof body?.amount === "number" ? body.amount : parseInt(body?.amount, 10);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) {
      return NextResponse.json({ error: "Valid amount required" }, { status: 400 });
    }
    const targetUserId =
      typeof body?.userId === "string" && body.userId.trim() ? body.userId.trim() : auth.user.id;

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const { data: row } = await admin.from("profiles").select("rdm").eq("id", targetUserId).single();
    const currentRdm = (row?.rdm ?? 0) as number;
    const newRdm = currentRdm + amount;

    const { error: updateErr } = await admin
      .from("profiles")
      .update({ rdm: newRdm })
      .eq("id", targetUserId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ userId: targetUserId, rdm: newRdm, amountAdded: amount });
  } catch (e) {
    console.error("rdm top-up error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
