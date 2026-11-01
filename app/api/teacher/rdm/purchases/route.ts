import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  enforceSameOriginForCookieAuth,
  requireAuthenticatedUser,
} from "@/lib/auth/securityGuards";
import { packRefundBlockReason } from "@/lib/teacherPortal/rdmPackRefund";

export async function GET(request: Request) {
  const csrf = enforceSameOriginForCookieAuth(request);
  if (csrf) return csrf;

  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profile?.role !== "teacher") {
    return NextResponse.json({ error: "Teacher account required" }, { status: 403 });
  }

  const db = admin as typeof admin & { from: (table: string) => any };
  const { data, error } = await db
    .from("rdm_pack_purchases")
    .select(
      "id, pack_id, rdm_granted, rdm_unspent, amount_paise, status, created_at, refunded_at"
    )
    .eq("teacher_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const purchases = (data ?? []).map((row: {
    id: string;
    pack_id: string;
    rdm_granted: number;
    rdm_unspent: number;
    amount_paise: number;
    status: string;
    created_at: string;
    refunded_at: string | null;
  }) => ({
    id: row.id,
    packId: row.pack_id,
    rdmGranted: row.rdm_granted,
    rdmUnspent: row.rdm_unspent,
    amountPaise: row.amount_paise,
    status: row.status,
    createdAt: row.created_at,
    refundedAt: row.refunded_at,
    canRefund: packRefundBlockReason({
      status: row.status,
      rdmGranted: row.rdm_granted,
      rdmUnspent: row.rdm_unspent,
    }) === null,
  }));

  return NextResponse.json({ purchases });
}
