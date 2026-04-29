import { NextRequest, NextResponse } from "next/server";
import { createClient, createClientWithToken } from "@/integrations/supabase/server";

export async function GET(request: NextRequest) {
  const headerAuth = request.headers.get("authorization") || "";
  const bearer = headerAuth.toLowerCase().startsWith("bearer ") ? headerAuth.slice(7).trim() : "";
  const supabase = bearer ? createClientWithToken(bearer) : await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ userId: user.id, email: user.email ?? null });
}

