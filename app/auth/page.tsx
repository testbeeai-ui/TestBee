"use client";

import { useState, useEffect, Suspense } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  ArrowLeft,
  LogIn,
  UserPlus,
  GraduationCap,
  BookOpen,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
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
  const { user, profile, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut } =
    useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const modeParam = searchParams.get("mode");
  const [profileWaitDone, setProfileWaitDone] = useState(false);

  const modeFromUrl =
    modeParam === "signup"
      ? ("signup" as const)
      : modeParam === "signin"
        ? ("login" as const)
        : null;
  const [emailModePick, setEmailModePick] = useState<"login" | "signup" | null>(null);
  const effectiveEmailMode: "login" | "signup" = emailModePick ?? modeFromUrl ?? "login";

  const roleFromUrl = roleParam === "teacher" || roleParam === "student" ? roleParam : null;
  const [signupRolePick, setSignupRolePick] = useState<"student" | "teacher" | null>(null);
  const effectiveSignupRole: "student" | "teacher" = signupRolePick ?? roleFromUrl ?? "student";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      router.replace(isTeacher ? "/teacher-portal" : "/home");
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

  const startGoogleSignIn = async () => {
    try {
      sessionStorage.setItem("auth_mode", "signin");
      sessionStorage.removeItem("auth_intended_role");
    } catch {
      /* ignore */
    }
    await signInWithGoogle("/onboarding");
  };

  const startGoogleSignUp = async () => {
    try {
      sessionStorage.setItem("auth_mode", "signup");
      sessionStorage.setItem("auth_intended_role", effectiveSignupRole);
    } catch {
      /* ignore */
    }
    const path =
      effectiveSignupRole === "teacher" ? "/onboarding?role=teacher" : "/onboarding?role=student";
    await signInWithGoogle(path);
  };

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      if (effectiveEmailMode === "login") {
        sessionStorage.setItem("auth_mode", "signin");
        sessionStorage.removeItem("auth_intended_role");
      } else {
        sessionStorage.setItem("auth_mode", "signup");
        sessionStorage.setItem("auth_intended_role", effectiveSignupRole);
      }
    } catch {
      /* ignore */
    }
    if (effectiveEmailMode === "login") {
      const { error: err } = await signInWithEmail(email, password);
      if (err) setError(err.message);
    } else {
      if (!name.trim()) {
        setError("Name is required");
        setSubmitting(false);
        return;
      }
      const { error: err } = await signUpWithEmail(email, password, name);
      if (err) setError(err.message);
    }
    setSubmitting(false);
  };

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
                  await signOut();
                  router.replace("/auth?mode=signin");
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

  return (
    <div className="auth-glass-page flex min-h-screen flex-col">
      <div className="relative flex min-h-0 flex-1 items-start justify-center px-4 py-8 sm:items-center sm:px-6 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="auth-glass-card w-full max-w-4xl rounded-3xl border border-white/10 p-6 sm:p-8"
        >
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              Back to home
            </Link>
          </div>

          <div className="mb-8 text-center sm:mb-10">
            <div className="mb-3 text-4xl">🎯</div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              EduBlast
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Sign in with Google if you already have an account — we keep your role and data from
              your profile. New here? Pick Student or Teacher, then create your account with Google.
            </p>
          </div>

          {/* Booklet: two panes, no inner scroll on typical viewports */}
          <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
            <section className="flex flex-col rounded-2xl border border-blue-500/15 bg-blue-500/[0.04] p-5 sm:p-6">
              <div className="mb-3 flex items-center gap-2 text-blue-400">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-400/25 bg-blue-500/10">
                  <LogIn className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Welcome back</h2>
              </div>
              <p className="mb-5 flex-1 text-sm leading-relaxed text-muted-foreground">
                Use the Google account you registered with. We load your existing EduBlast profile
                from the database — no need to pick Student or Teacher again.
              </p>
              <Button
                type="button"
                onClick={() => void startGoogleSignIn()}
                variant="outline"
                className="auth-glass-outline-btn h-12 w-full gap-3 rounded-xl text-base font-semibold"
              >
                <GoogleGlyph className="h-5 w-5 shrink-0" />
                Continue with Google
              </Button>
            </section>

            <section className="flex flex-col rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 sm:p-6">
              <div className="mb-3 flex items-center gap-2 text-emerald-400">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-500/10">
                  <UserPlus className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Create an account</h2>
              </div>
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                Choose how you will use EduBlast, then sign up with Google (same OAuth as sign-in;
                Supabase creates your profile).
              </p>
              <div className="mb-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSignupRolePick("student")}
                  className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-3 text-center transition-all ${
                    effectiveSignupRole === "student"
                      ? "border-emerald-400/50 bg-emerald-500/15 text-foreground shadow-[0_0_0_1px_rgba(52,211,153,0.35)]"
                      : "border-white/10 bg-background/40 text-muted-foreground hover:border-white/20"
                  }`}
                >
                  <GraduationCap className="h-6 w-6 text-emerald-400" />
                  <span className="text-sm font-semibold">Student</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSignupRolePick("teacher")}
                  className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-3 text-center transition-all ${
                    effectiveSignupRole === "teacher"
                      ? "border-indigo-400/50 bg-indigo-500/15 text-foreground shadow-[0_0_0_1px_rgba(129,140,248,0.35)]"
                      : "border-white/10 bg-background/40 text-muted-foreground hover:border-white/20"
                  }`}
                >
                  <BookOpen className="h-6 w-6 text-indigo-400" />
                  <span className="text-sm font-semibold">Teacher</span>
                </button>
              </div>
              <Button
                type="button"
                onClick={() => void startGoogleSignUp()}
                className="edu-btn-primary mt-auto h-12 w-full gap-3 rounded-xl text-base font-semibold"
              >
                <GoogleGlyph className="h-5 w-5 shrink-0" />
                Sign up with Google as {effectiveSignupRole === "teacher" ? "Teacher" : "Student"}
              </Button>
            </section>
          </div>

          <details className="group mt-8 rounded-2xl border border-white/10 bg-background/30 px-4 py-3 sm:px-5">
            <summary className="cursor-pointer list-none text-center text-sm font-semibold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">More options — email & password</span>
              <span className="hidden group-open:inline">Hide email & password</span>
            </summary>
            <div className="auth-glass-divider my-5" />
            <div className="mb-4 flex justify-center gap-2">
              <Button
                type="button"
                variant={effectiveEmailMode === "login" ? "default" : "outline"}
                size="sm"
                className="rounded-lg"
                onClick={() => {
                  setEmailModePick("login");
                  setError("");
                }}
              >
                Sign in
              </Button>
              <Button
                type="button"
                variant={effectiveEmailMode === "signup" ? "default" : "outline"}
                size="sm"
                className="rounded-lg"
                onClick={() => {
                  setEmailModePick("signup");
                  setError("");
                }}
              >
                Sign up
              </Button>
            </div>
            <p className="mb-4 text-center text-xs text-muted-foreground">
              {effectiveEmailMode === "login"
                ? "Uses the same profile as Google after you sign in."
                : `New account role for email sign-up: ${effectiveSignupRole === "teacher" ? "Teacher" : "Student"} (matches the tiles above).`}
            </p>
            <div className="space-y-4">
              {effectiveEmailMode === "signup" && (
                <div className="relative">
                  <User className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="auth-glass-input h-12 rounded-xl pl-10"
                  />
                </div>
              )}
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-glass-input h-12 rounded-xl pl-10"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-glass-input h-12 rounded-xl pl-10"
                  onKeyDown={(e) => e.key === "Enter" && void handleSubmit()}
                />
              </div>
              {error && <p className="text-sm font-medium text-destructive">{error}</p>}
              <Button
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="edu-btn-primary h-12 w-full rounded-xl text-base font-semibold"
              >
                {submitting
                  ? "…"
                  : effectiveEmailMode === "login"
                    ? "Sign in with email"
                    : "Create account with email"}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </details>

          {(roleParam || modeParam) && (
            <p className="mt-6 text-center text-xs text-muted-foreground">
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
                  setEmailModePick(null);
                  setSignupRolePick(null);
                  router.replace("/auth");
                }}
                className="font-semibold text-primary hover:underline"
              >
                Clear and start fresh
              </button>
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
