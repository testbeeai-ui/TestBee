import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";

export async function GET(request: NextRequest) {
  const auth = await getSupabaseAndUser(request);
  if (!auth) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ userId: auth.user.id, email: auth.user.email ?? null });
}
