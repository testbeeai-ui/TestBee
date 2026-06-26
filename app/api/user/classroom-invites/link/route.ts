import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";

export const runtime = "nodejs";

type LinkResult = {
  ok?: boolean;
  error?: string;
  linked?: number;
};

export async function POST(request: Request) {
  const originBlock = enforceSameOriginForCookieAuth(request);
  if (originBlock) return originBlock;

  const ctx = await getSupabaseAndUser(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.supabase.rpc("link_my_classroom_invites");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as LinkResult | null;
  if (!result || typeof result !== "object") {
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  }

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "unknown" },
      { status: result.error === "unauthorized" ? 401 : 400 },
    );
  }

  return NextResponse.json({ ok: true, linked: result.linked ?? 0 });
}
