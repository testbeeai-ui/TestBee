import "server-only";

/**
 * Ask EduDeca to send the student welcome email (owned by the EduDeca app).
 * Web only triggers this after first interest registration — it does not own the template.
 */
export async function requestEduDecaWelcomeEmail(params: {
  email: string;
  displayName?: string;
  userId?: string | null;
}): Promise<boolean> {
  const base = (
    process.env.EDUDECA_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_EDUDECA_APP_URL?.trim() ||
    "https://edu-deca.vercel.app"
  ).replace(/\/$/, "");
  const secret = process.env.EDUDECA_INTERNAL_API_SECRET?.trim();

  if (!secret) {
    console.warn(
      "[edudeca welcome] EDUDECA_INTERNAL_API_SECRET missing — skipping send",
    );
    return false;
  }

  try {
    const res = await fetch(`${base}/api/email/student-welcome`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: params.email,
        displayName: params.displayName,
        userId: params.userId ?? null,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[edudeca welcome] EduDeca API failed:", res.status, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[edudeca welcome] EduDeca API request error:", err);
    return false;
  }
}
