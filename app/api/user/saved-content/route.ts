import { NextResponse } from "next/server";
import { createClient, createClientWithToken } from "@/integrations/supabase/server";
import type { SavedBit, SavedFormula } from "@/types";

async function getSupabaseAndUser(request: Request) {
  const cookieClient = await createClient();
  let user = (await cookieClient.auth.getUser()).data?.user ?? null;
  if (!user) {
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (token) {
      const { data: { user: u } } = await cookieClient.auth.getUser(token);
      user = u ?? null;
      if (user) {
        return { supabase: createClientWithToken(token), user };
      }
    }
  }
  return user ? { supabase: cookieClient, user } : null;
}

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = ctx;
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("saved_bits, saved_formulas")
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      console.error("saved-content GET error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const savedBits = (profile?.saved_bits ?? []) as unknown as SavedBit[];
    const savedFormulas = (profile?.saved_formulas ?? []) as unknown as SavedFormula[];
    return NextResponse.json({ savedBits, savedFormulas });
  } catch (e) {
    console.error("saved-content GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = ctx;
    const body = await request.json();
    const savedBits = Array.isArray(body?.savedBits) ? body.savedBits : undefined;
    const savedFormulas = Array.isArray(body?.savedFormulas) ? body.savedFormulas : undefined;
    if (savedBits === undefined && savedFormulas === undefined) {
      return NextResponse.json({ error: "savedBits or savedFormulas required" }, { status: 400 });
    }
    const updates: Record<string, unknown> = {};
    if (savedBits !== undefined) updates.saved_bits = savedBits;
    if (savedFormulas !== undefined) updates.saved_formulas = savedFormulas;
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);
    if (error) {
      console.error("saved-content POST error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("saved-content POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
