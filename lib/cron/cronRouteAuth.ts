import { NextResponse } from "next/server";

/** Shared auth for manual/external cron routes (matches prune-telemetry-logs). */
export function authorizeCronRequest(request: Request): NextResponse | null {
  if (process.env.VERCEL_ENV === "production" && !process.env.CRON_SECRET?.trim()) {
    return NextResponse.json(
      {
        error: "CRON_SECRET must be set in Vercel Production for cron routes",
        code: "MISSING_CRON_SECRET",
      },
      { status: 503 }
    );
  }

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return null;
}
