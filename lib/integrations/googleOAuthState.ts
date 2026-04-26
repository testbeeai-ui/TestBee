import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();

function stateSecret(): Uint8Array {
  const raw = process.env.GOOGLE_OAUTH_STATE_SECRET?.trim();
  if (!raw) throw new Error("GOOGLE_OAUTH_STATE_SECRET is not set.");
  return encoder.encode(raw);
}

export async function signGoogleOAuthState(userId: string): Promise<string> {
  return new SignJWT({ purpose: "google_calendar_oauth" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(stateSecret());
}

export async function verifyGoogleOAuthState(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, stateSecret(), {
    algorithms: ["HS256"],
  });
  if (payload.purpose !== "google_calendar_oauth" || typeof payload.sub !== "string") {
    throw new Error("Invalid OAuth state payload.");
  }
  return payload.sub;
}
