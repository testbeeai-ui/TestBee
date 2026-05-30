import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();

function stateSecret(): Uint8Array {
  const raw = process.env.GOOGLE_OAUTH_STATE_SECRET?.trim();
  if (!raw) throw new Error("GOOGLE_OAUTH_STATE_SECRET is not set.");
  return encoder.encode(raw);
}

export async function signGoogleOAuthState(
  userId: string,
  options?: { popup?: boolean }
): Promise<string> {
  const body: Record<string, unknown> = { purpose: "google_calendar_oauth" };
  if (options?.popup === true) body.popup = true;
  return new SignJWT(body)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(stateSecret());
}

export async function verifyGoogleOAuthState(
  token: string
): Promise<{ userId: string; popup: boolean }> {
  const { payload } = await jwtVerify(token, stateSecret(), {
    algorithms: ["HS256"],
  });
  if (payload.purpose !== "google_calendar_oauth" || typeof payload.sub !== "string") {
    throw new Error("Invalid OAuth state payload.");
  }
  return { userId: payload.sub, popup: payload.popup === true };
}
