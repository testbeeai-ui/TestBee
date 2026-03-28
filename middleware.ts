import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * PKCE (Google OAuth) stores a code verifier in the browser per-origin.
 * localhost:3000 and 127.0.0.1:3000 are different origins — mixing them causes
 * "Sign-in could not finish" after Google. In dev, always normalize to localhost.
 */
export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.next();
  }

  const host = request.headers.get("host") ?? "";
  if (host.startsWith("127.0.0.1")) {
    const url = request.nextUrl.clone();
    url.hostname = "localhost";
    return NextResponse.redirect(url, 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
