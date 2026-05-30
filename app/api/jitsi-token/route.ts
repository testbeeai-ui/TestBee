/**
 * 8x8 JaaS JWT for moderator permission (so the meeting starts without "Log-in" prompt).
 * Requires in .env:
 *   JITSI_JAAS_KID       - Key ID from 8x8 JaaS dashboard (API Key → Key ID)
 *   JITSI_JAAS_PRIVATE_KEY - PEM private key (contents of your .pk file; use \n for newlines)
 * NEXT_PUBLIC_JITSI_APP_ID is already set for the app.
 */
import { NextResponse } from "next/server";
import * as jose from "jose";
import { createClient } from "@/integrations/supabase/server";
import {
  enforceSameOriginForCookieAuth,
  requireAuthenticatedUser,
} from "@/lib/auth/securityGuards";

const APP_ID = process.env.NEXT_PUBLIC_JITSI_APP_ID || process.env.JITSI_JAAS_APP_ID || "";
const KID = process.env.JITSI_JAAS_KID || "";
const PRIVATE_KEY_PEM = process.env.JITSI_JAAS_PRIVATE_KEY || "";

export async function POST(request: Request) {
  const csrf = enforceSameOriginForCookieAuth(request);
  if (csrf) return csrf;

  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => ({}));

  if (!APP_ID || !KID || !PRIVATE_KEY_PEM) {
    const missing = [
      !APP_ID && "NEXT_PUBLIC_JITSI_APP_ID",
      !KID && "JITSI_JAAS_KID",
      !PRIVATE_KEY_PEM && "JITSI_JAAS_PRIVATE_KEY",
    ].filter(Boolean) as string[];
    const hint = !KID
      ? " Get JITSI_JAAS_KID: 8x8 Developer Console → your app → API Keys → copy the Key ID (e.g. vpaas-magic-cookie-xxx/4f4910)."
      : "";
    return NextResponse.json(
      { error: `Jitsi JaaS not configured. Add to .env: ${missing.join(", ")}.${hint}` },
      { status: 503 }
    );
  }

  try {
    const roomName = typeof body.roomName === "string" ? body.roomName.trim() : "";
    if (
      !roomName ||
      roomName === "*" ||
      roomName.length > 160 ||
      !/^[a-zA-Z0-9/_-]+$/.test(roomName)
    ) {
      return NextResponse.json({ error: "Invalid roomName." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, role")
      .eq("id", auth.user.id)
      .maybeSingle();
    const profileName = typeof profile?.name === "string" ? profile.name.trim() : "";
    const displayName =
      typeof body.displayName === "string" && body.displayName.trim()
        ? body.displayName.trim().slice(0, 80)
        : profileName || auth.user.user_metadata?.full_name || "Participant";
    const role = profile?.role;
    const canModerate = role === "teacher" || role === "admin";

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 10 * 60; // 10 minutes
    const nbf = now - 60; // 1 min skew

    const payload = {
      aud: "jitsi",
      iss: "chat",
      sub: APP_ID,
      room: roomName,
      exp,
      nbf,
      context: {
        user: {
          id: auth.user.id,
          name: displayName,
          avatar: "",
          email: auth.user.email ?? "",
          moderator: canModerate ? "true" : "false",
        },
        features: {
          livestreaming: "false",
          "outbound-call": "false",
          transcription: "false",
          recording: "false",
          "file-upload": "false",
          "inbound-call": "false",
        },
      },
    };

    const raw = PRIVATE_KEY_PEM.replace(/\\n/g, "\n").trim();
    const pem = raw.includes("BEGIN PRIVATE KEY")
      ? raw
      : `-----BEGIN PRIVATE KEY-----\n${raw.replace(/\s/g, "")}\n-----END PRIVATE KEY-----`;
    const key = await jose.importPKCS8(pem, "RS256");
    const jwt = await new jose.SignJWT(payload as Record<string, unknown>)
      .setProtectedHeader({ alg: "RS256", kid: KID, typ: "JWT" })
      .sign(key);

    return NextResponse.json({ jwt });
  } catch (e) {
    console.error("Jitsi JWT error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create token" },
      { status: 500 }
    );
  }
}
