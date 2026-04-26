import { NextRequest, NextResponse } from "next/server";
import { createClient, createClientWithToken } from "@/integrations/supabase/server";
import { getGoogleOAuthEnv, GOOGLE_CALENDAR_SCOPE } from "@/lib/integrations/googleEnv";
import { signGoogleOAuthState } from "@/lib/integrations/googleOAuthState";

async function resolveUserId(request: NextRequest): Promise<string | null> {
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (bearer) {
    const supabase = createClientWithToken(bearer);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function buildGoogleAuthUrl(input: { userId: string }) {
  const { clientId, redirectUri } = getGoogleOAuthEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  return { params, redirectUri };
}

export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const state = await signGoogleOAuthState(userId);
    const { params } = buildGoogleAuthUrl({ userId });
    params.set("state", state);

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return NextResponse.redirect(url);
  } catch (e) {
    const message = e instanceof Error ? e.message : "OAuth start failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    const state = await signGoogleOAuthState(userId);
    const { params } = buildGoogleAuthUrl({ userId });
    params.set("state", state);
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return NextResponse.json({ url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "OAuth start failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
