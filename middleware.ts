import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isPublicPath } from "@/lib/auth/publicPaths";
import { createSupabaseMiddleware } from "@/lib/supabase/middleware";

/**
 * PKCE (Google OAuth) stores a code verifier in the browser per-origin.
 * localhost:3000 and 127.0.0.1:3000 are different origins — mixing them causes
 * "Sign-in could not finish" after Google. In dev, always normalize to localhost.
 */
export async function middleware(request: NextRequest) {
  if (process.env.NODE_ENV === "development") {
    const host = request.headers.get("host") ?? "";
    if (host.startsWith("127.0.0.1")) {
      const url = request.nextUrl.clone();
      url.hostname = "localhost";
      return NextResponse.redirect(url, 307);
    }
  }

  const pathname = request.nextUrl.pathname;

  // API routes enforce their own auth; avoid session refresh work on every API call.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    const { supabase, getResponse } = createSupabaseMiddleware(request);
    await supabase.auth.getUser();
    return getResponse();
  }

  const { supabase, getResponse } = createSupabaseMiddleware(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  return getResponse();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
