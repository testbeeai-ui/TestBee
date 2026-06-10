"use client";

import { useState, useEffect, Suspense } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getSafeInternalNextPath,
  persistPendingDeepLink,
  readPendingDeepLink,
  clearPendingDeepLink,
} from "@/lib/auth/safeNextPath";
import { TEACHER_PORTAL_CLASSROOMS_URL } from "@/lib/teacherPortal/routes";
import { OnboardingTermsAcceptance } from "@/components/legal/OnboardingTermsAcceptance";
import SignInNoticeModal from "@/components/landing/SignInNoticeModal";

const googlePathD = {
  blue: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z",
  green:
    "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z",
  yellow:
    "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z",
  red: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z",
} as const;

function GoogleGlyph({ className, cta }: { className?: string; cta?: boolean }) {
  const fill = cta ? "rgba(255,255,255,0.92)" : undefined;
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill={fill ?? "#4285F4"} d={googlePathD.blue} />
      <path fill={fill ?? "#34A853"} d={googlePathD.green} />
      <path fill={fill ?? "#FBBC05"} d={googlePathD.yellow} />
      <path fill={fill ?? "#EA4335"} d={googlePathD.red} />
    </svg>
  );
}

export default function Auth() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <span className="text-4xl animate-pulse">🎯</span>
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}

function AuthContent() {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const modeParam = searchParams.get("mode");
  const nextParam = searchParams.get("next");
  const safeNext = getSafeInternalNextPath(nextParam);
  const [profileWaitDone, setProfileWaitDone] = useState(false);

  const roleFromUrl = roleParam === "teacher" || roleParam === "student" ? roleParam : null;
  const [signupRolePick, setSignupRolePick] = useState<"student" | "teacher" | null>(null);
  const effectiveSignupRole: "student" | "teacher" = signupRolePick ?? roleFromUrl ?? "student";

  const [activePanel, setActivePanel] = useState<"signin" | "signup">(() =>
    modeParam === "signup" ? "signup" : "signin"
  );
  const [signupTermsAccepted, setSignupTermsAccepted] = useState(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);

  useEffect(() => {
    if (roleParam) {
      try {
        sessionStorage.setItem("auth_intended_role", roleParam);
      } catch {
        /* ignore */
      }
    }
    if (modeParam) {
      try {
        sessionStorage.setItem("auth_mode", modeParam === "signin" ? "signin" : "signup");
      } catch {
        /* ignore */
      }
    }
  }, [roleParam, modeParam]);

  useEffect(() => {
    if (modeParam === "signup") setActivePanel("signup");
    else if (modeParam === "signin") setActivePanel("signin");
  }, [modeParam]);

  useEffect(() => {
    if (safeNext) persistPendingDeepLink(safeNext);
  }, [safeNext]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      window.location.replace("/auth/callback" + hash);
      return;
    }
  }, []);

  useEffect(() => {
    if (!user || profile !== null) return;
    const t = setTimeout(() => setProfileWaitDone(true), 2500);
    return () => clearTimeout(t);
  }, [user, profile]);

  useEffect(() => {
    if (loading) return;
    const isTeacher = profile?.role === "teacher";
    if (user && profile?.onboarding_complete) {
      const pending = readPendingDeepLink();
      const dest = pending ?? (isTeacher ? TEACHER_PORTAL_CLASSROOMS_URL : "/home");
      clearPendingDeepLink();
      router.replace(dest);
    }
    // Do not auto-send incomplete users to /auth → onboarding loop; show resume UI instead.
  }, [user, profile, profile?.onboarding_complete, profile?.role, loading, router]);

  const loadingOrRedirecting = loading || (user != null && profile === null && !profileWaitDone);
  if (loadingOrRedirecting)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-4xl animate-pulse">🎯</span>
      </div>
    );

  const openWaitlistGate = () => setShowWaitlistModal(true);

  if (user && profile !== null && !profile.onboarding_complete) {
    const resumeRole = profile.role === "teacher" ? "teacher" : "student";
    const displayName = profile.name?.trim() || user.email || "your account";
    return (
      <div className="auth-glass-page flex min-h-screen flex-col">
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-10 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="auth-glass-card w-full max-w-md rounded-3xl border border-white/10 p-8 text-center"
          >
            <div className="mb-2 text-4xl">🎯</div>
            <h1 className="font-display text-xl font-bold text-foreground sm:text-2xl">
              Finish setting up EduBlast
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              You&apos;re still signed in as{" "}
              <span className="font-semibold text-foreground">{displayName}</span>. Continue your
              profile, or sign out to use a different account — you won&apos;t be bounced in a loop
              from Login anymore.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Button
                className="edu-btn-primary h-12 w-full rounded-xl text-base font-semibold"
                onClick={() => router.replace(`/onboarding?role=${resumeRole}`)}
              >
                Continue profile setup
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="auth-glass-outline-btn h-12 w-full rounded-xl font-semibold"
                onClick={async () => {
                  await signOut("/auth?mode=signin");
                }}
              >
                Sign out
              </Button>
              <Link
                href="/"
                className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Back to home (marketing)
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  const signupRoleLabel = effectiveSignupRole === "teacher" ? "Teacher" : "Student";

  return (
    <div className="flex min-h-screen flex-col bg-[#0f1117] font-['DM_Sans',ui-sans-serif,system-ui,sans-serif] text-white antialiased">
      <div className="flex min-h-[100dvh] flex-1 items-center justify-center px-4 py-10 sm:px-8 sm:py-12">
        <div className="flex w-full max-w-[min(94vw,32rem)] flex-col gap-5 sm:max-w-[min(92vw,36rem)] md:max-w-[min(88vw,40rem)]">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 text-sm text-white/45 transition-colors hover:text-white/85 sm:justify-start"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Back to home
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex w-full min-h-[min(52vh,26rem)] flex-col justify-center rounded-3xl border border-white/10 bg-[#161b27] px-7 py-10 shadow-xl sm:min-h-[min(50vh,28rem)] sm:px-10 sm:py-12 md:min-h-[min(48vh,30rem)] md:px-12 md:py-14"
          >
            <div className="mb-10 flex items-center justify-center sm:mb-12">
              <img
                src="/images/logo-2.png"
                alt="EduBlast"
                className="h-14 w-[220px] object-contain sm:h-16 sm:w-[280px] md:h-20 md:w-[340px]"
                draggable={false}
              />
            </div>

            {searchParams.get("error") === "waitlist_not_approved" && (
              <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-600/[0.1] px-4 py-3.5 text-left flex items-start gap-3">
                <span className="text-xl shrink-0">⚠️</span>
                <div>
                  <h4 className="text-sm font-semibold text-amber-400">Access restricted</h4>
                  {searchParams.get("attempted") ? (
                    <p className="mt-1 text-xs text-white/80 leading-relaxed">
                      You signed in as{" "}
                      <span className="font-semibold text-amber-200">
                        {searchParams.get("attempted")}
                      </span>
                      , which is not on the approved list yet.
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-white/70 leading-relaxed">
                    We onboard new members in batches. Use the same email you were approved with, or{" "}
                    <Link href="/waitlist" className="underline hover:text-white font-medium text-amber-300">
                      join the waitlist
                    </Link>{" "}
                    to request access.
                  </p>
                </div>
              </div>
            )}

            {activePanel === "signin" ? (
              <div className="flex flex-1 flex-col justify-center">
                <div className="mb-8 flex items-center gap-3 rounded-xl border border-violet-500/30 bg-violet-600/[0.12] px-4 py-3.5 sm:mb-10 sm:gap-3.5 sm:px-5 sm:py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-600/20 text-lg text-white/90 sm:h-11 sm:w-11 sm:text-xl">
                    →
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-white sm:text-lg">Welcome back</h3>
                    <p className="mt-1 text-sm leading-relaxed text-white/45 sm:text-[0.9375rem]">
                      Use the Google account you registered with — we load your existing profile
                      automatically.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openWaitlistGate}
                  className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/[0.04] text-base font-medium text-white transition-colors hover:bg-white/[0.08] sm:h-14 sm:text-lg"
                >
                  <GoogleGlyph className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
                  Continue with Google
                </button>

                <button
                  type="button"
                  onClick={openWaitlistGate}
                  className="group mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-transparent text-base font-medium text-white/60 transition-all hover:border-violet-500/50 hover:bg-violet-600/[0.08] hover:text-white sm:mt-10 sm:h-14 sm:text-lg"
                >
                  Sign up now
                  <span className="text-lg transition-transform group-hover:translate-x-0.5 sm:text-xl">
                    →
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex flex-1 flex-col justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setActivePanel("signin");
                    setSignupTermsAccepted(false);
                    const p = new URLSearchParams(searchParams.toString());
                    p.set("mode", "signin");
                    router.replace(`/auth?${p.toString()}`, { scroll: false });
                  }}
                  className="mb-6 flex items-center gap-2 bg-transparent p-0 text-sm text-white/45 transition-colors hover:text-white/85 sm:mb-8 sm:text-base"
                >
                  ← Back to sign in
                </button>
                <p className="text-xl font-semibold text-white sm:text-2xl">Create your account</p>
                <p className="mb-6 mt-2 text-sm leading-relaxed text-white/[0.38] sm:mb-8 sm:text-base">
                  Pick your role — then continue with Google. We&apos;ll set up your profile on the
                  next step.
                </p>

                <div className="mb-8 grid grid-cols-2 gap-3 sm:mb-10 sm:gap-4">
                  <button
                    type="button"
                    onClick={() => setSignupRolePick("student")}
                    className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-5 transition-colors hover:bg-white/[0.03] sm:gap-2.5 sm:px-4 sm:py-6 ${
                      effectiveSignupRole === "student"
                        ? "border-[#7c3aed] bg-violet-600/10"
                        : "border-white/10 bg-transparent"
                    }`}
                  >
                    <span className="text-2xl leading-none sm:text-3xl" aria-hidden>
                      🎓
                    </span>
                    <span className="text-base font-medium text-white sm:text-lg">Student</span>
                    <span className="text-center text-xs leading-snug text-white/35 sm:text-sm">
                      Learn & take quizzes
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignupRolePick("teacher")}
                    className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-5 transition-colors hover:bg-white/[0.03] sm:gap-2.5 sm:px-4 sm:py-6 ${
                      effectiveSignupRole === "teacher"
                        ? "border-[#7c3aed] bg-violet-600/10"
                        : "border-white/10 bg-transparent"
                    }`}
                  >
                    <span className="text-2xl leading-none sm:text-3xl" aria-hidden>
                      📚
                    </span>
                    <span className="text-base font-medium text-white sm:text-lg">Teacher</span>
                    <span className="text-center text-xs leading-snug text-white/35 sm:text-sm">
                      Create & manage classes
                    </span>
                  </button>
                </div>

                <OnboardingTermsAcceptance
                  accepted={signupTermsAccepted}
                  onAcceptedChange={setSignupTermsAccepted}
                  className="border-white/10"
                  action={
                    <button
                      type="button"
                      onClick={openWaitlistGate}
                      className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border-0 bg-gradient-to-br from-[#7c3aed] to-[#e0496a] px-3 text-base font-medium text-white transition-opacity hover:opacity-[0.88] sm:h-14 sm:gap-3 sm:text-lg"
                    >
                      <GoogleGlyph cta className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
                      <span className="text-center leading-tight">
                        Sign up as {signupRoleLabel} with Google
                      </span>
                    </button>
                  }
                />
              </div>
            )}
          </motion.div>

          {(roleParam || modeParam) && (
            <p className="text-center text-xs text-white/35 sm:text-sm">
              Link opened with preset role or mode?{" "}
              <button
                type="button"
                onClick={() => {
                  try {
                    sessionStorage.removeItem("auth_intended_role");
                    sessionStorage.removeItem("auth_mode");
                  } catch {
                    /* ignore */
                  }
                  setSignupRolePick(null);
                  setActivePanel("signin");
                  router.replace("/auth");
                }}
                className="font-semibold text-violet-400 underline-offset-2 hover:underline"
              >
                Clear and start fresh
              </button>
            </p>
          )}
        </div>
      </div>

      <SignInNoticeModal
        open={showWaitlistModal}
        onOpenChange={setShowWaitlistModal}
        onJoinWaitlist={() => router.push("/waitlist")}
      />
    </div>
  );
}
