import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isOAuthAuthorizationCode,
  shouldRedirectOAuthCodeToCallback,
} from "@/lib/auth/oauthCallbackRedirect";
import { PREVIEW_AUTH_LEGACY_PATHS, PREVIEW_AUTH_PATH } from "@/lib/auth/previewAuthPath";
import { isPublicPath } from "@/lib/auth/publicPaths";
import { createSupabaseMiddleware } from "@/lib/supabase/middleware";
import { TEACHER_PORTAL_CLASSROOMS_URL } from "@/lib/teacherPortal/routes";
import {
  evaluateWhitelistGate,
  waitlistBlockedAuthUrl,
} from "@/lib/waitlist/whitelistGate";

const STUDENT_ONLY_PREFIXES = [
  "/home",
  "/play",
  "/mock",
  "/mock-test",
  "/revision",
  "/explore-1",
  "/explore",
  "/magic-wall",
  "/doubts",
  "/exam-prep",
] as const;

function isStudentOnlyPath(pathname: string): boolean {
  return STUDENT_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isStudentProfilePath(pathname: string): boolean {
  return pathname === "/profile" || pathname.startsWith("/profile/");
}

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

  /** Google OAuth sometimes lands on Site URL (`/?code=…`) instead of `/auth/callback`. */
  const oauthCode = request.nextUrl.searchParams.get("code");
  if (shouldRedirectOAuthCodeToCallback(pathname, oauthCode)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url, 307);
  }

  /** Legacy preview login paths → canonical preview path (preserves query string). */
  for (const legacy of PREVIEW_AUTH_LEGACY_PATHS) {
    if (pathname === legacy || pathname.startsWith(`${legacy}/`)) {
      const url = request.nextUrl.clone();
      url.pathname =
        pathname === legacy
          ? PREVIEW_AUTH_PATH
          : `${PREVIEW_AUTH_PATH}${pathname.slice(legacy.length)}`;
      return NextResponse.redirect(url, 308);
    }
  }

  /** Legacy `/mock-test-library` links → `/mock-test`. Preserves `?paper=` etc. */
  if (pathname === "/mock-test-library" || pathname.startsWith("/mock-test-library/")) {
    const url = request.nextUrl.clone();
    url.pathname =
      pathname === "/mock-test-library"
        ? "/mock-test"
        : `/mock-test${pathname.slice("/mock-test-library".length)}`;
    return NextResponse.redirect(url, 308);
  }

  // API routes enforce their own auth; avoid session refresh work on every API call.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  /** Let the route handler exchange PKCE without middleware touching the session first. */
  if (pathname === "/auth/callback" && isOAuthAuthorizationCode(oauthCode)) {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarding_complete")
    .eq("id", user.id)
    .maybeSingle();

  const gate = await evaluateWhitelistGate(supabase, {
    userId: user.id,
    email: user.email,
    onboardingComplete: profile?.onboarding_complete === true,
  });

  if (!gate.allowed) {
    const blockedPath = waitlistBlockedAuthUrl(request.nextUrl.origin, user.email);
    const url = request.nextUrl.clone();
    const blocked = new URL(blockedPath, request.url);
    url.pathname = blocked.pathname;
    url.search = blocked.search;
    return NextResponse.redirect(url);
  }

  const needsStudentRole = isStudentOnlyPath(pathname);
  const needsTeacherPortalProfile = isStudentProfilePath(pathname);

  if (needsStudentRole || needsTeacherPortalProfile) {
    if (needsStudentRole && profile?.role === "teacher") {
      const url = request.nextUrl.clone();
      const target = new URL(TEACHER_PORTAL_CLASSROOMS_URL, request.url);
      url.pathname = target.pathname;
      url.search = target.search;
      return NextResponse.redirect(url);
    }

    /** Teachers use the portal profile tab — never mount `/profile` (avoids client redirect loops). */
    if (needsTeacherPortalProfile && profile?.role === "teacher") {
      const url = request.nextUrl.clone();
      url.pathname = "/teacher-portal";
      url.search = "";
      url.searchParams.set("section", "profile");
      return NextResponse.redirect(url);
    }
  }

  return getResponse();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
