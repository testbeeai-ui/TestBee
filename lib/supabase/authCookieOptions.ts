/**
 * Session cookies are readable by the app script so the browser client and
 * middleware stay on the same session. Secure is on for production HTTPS.
 * HttpOnly is not set here: the browser client cannot store an HttpOnly cookie,
 * and forcing it split the session from middleware and looped /home.
 */
export const supabaseAuthCookieOptions = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
