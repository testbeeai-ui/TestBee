"use client";

import { useState, useEffect, Suspense, type FormEvent } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { DM_Sans } from "next/font/google";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getSafeInternalNextPath,
  persistPendingDeepLink,
  readPendingDeepLink,
  clearPendingDeepLink,
} from "@/lib/auth/safeNextPath";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const googlePathD = {
  blue: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z",
  green: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z",
  yellow: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z",
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
  const {
    user,
    profile,
    loading,
    signInWithGoogle,
    signOut,
    signUpWithEmail,
    verifySignUpEmailOtp,
    resendSignUpEmailOtp,
    signInWithEmail,
  } = useAuth();
  const { toast } = useToast();
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

  const [emailSignupFlow, setEmailSignupFlow] = useState<"idle" | "form" | "otp">("idle");
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [signupSubmitting, setSignupSubmitting] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [signInEmailOpen, setSignInEmailOpen] = useState(false);
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [signInSubmitting, setSignInSubmitting] = useState(false);

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
    setEmailSignupFlow("idle");
    setOtpValue("");
    setSuPassword("");
    setSuName("");
    setSuEmail("");
    setOtpEmail("");
  }, [activePanel]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = window.setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [resendCooldown]);

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
      const dest = pending ?? (isTeacher ? "/teacher-portal" : "/home");
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

  const submitEmailSignup = async (e: FormEvent) => {
    e.preventDefault();
    if (!suEmail.trim() || !suPassword || !suName.trim()) {
      toast({ title: "Fill all fields", variant: "destructive" });
      return;
    }
    try {
      sessionStorage.setItem("auth_mode", "signup");
      sessionStorage.setItem("auth_intended_role", effectiveSignupRole);
    } catch {
      /* ignore */
    }
    setSignupSubmitting(true);
    const { error, needsEmailConfirmation } = await signUpWithEmail(
      suEmail.trim(),
      suPassword,
      suName.trim()
    );
    setSignupSubmitting(false);
    if (error) {
      toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
      return;
    }
    if (needsEmailConfirmation) {
      setSuPassword("");
      setOtpEmail(suEmail.trim());
      setEmailSignupFlow("otp");
      setOtpValue("");
      toast({ title: "Check your email", description: "Enter the verification code we sent." });
      setResendCooldown(45);
      return;
    }
    toast({ title: "Welcome!", description: "Your account is ready." });
  };

  const submitEmailSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!siEmail.trim() || !siPassword) {
      toast({ title: "Enter email and password", variant: "destructive" });
      return;
    }
    try {
      sessionStorage.setItem("auth_mode", "signin");
    } catch {
      /* ignore */
    }
    setSignInSubmitting(true);
    const { error } = await signInWithEmail(siEmail.trim(), siPassword);
    setSignInSubmitting(false);
    if (error) {
      toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
      return;
    }
  };

  const submitSignupOtp = async (e: FormEvent) => {
    e.preventDefault();
    const digits = otpValue.replace(/\s/g, "");
    if (digits.length !== 6) {
      toast({ title: "Enter the 6-digit code", variant: "destructive" });
      return;
    }
    setOtpBusy(true);
    const { error } = await verifySignUpEmailOtp(otpEmail, digits);
    setOtpBusy(false);
    if (error) {
      toast({ title: "Could not verify", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Email verified" });
    setEmailSignupFlow("idle");
    setOtpValue("");
  };

  const resendSignupOtp = async () => {
    if (resendCooldown > 0) return;
    const { error } = await resendSignUpEmailOtp(otpEmail);
    if (error) {
      toast({ title: "Could not resend", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "New code sent" });
    setResendCooldown(45);
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

  const signupRoleLabel = effectiveSignupRole === "teacher" ? "Teacher" : "Student";

  return (
    <div
      className={`${dmSans.className} flex min-h-screen flex-col bg-[#0f1117] text-white antialiased`}
    >
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
            <div className="mb-8 flex items-center justify-center gap-3 sm:mb-10 sm:gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#e0496a] to-[#7c3aed] text-2xl leading-none sm:h-14 sm:w-14 sm:text-[1.65rem]">
                🎯
              </div>
              <span className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                EduBlast
              </span>
            </div>

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
                  onClick={() => void startGoogleSignIn()}
                  className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/[0.04] text-base font-medium text-white transition-colors hover:bg-white/[0.08] sm:h-14 sm:text-lg"
                >
                  <GoogleGlyph className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
                  Continue with Google
                </button>

                <div className="my-6 flex items-center gap-3 text-sm text-white/25 sm:my-8">
                  <span className="h-px flex-1 bg-white/10" aria-hidden />
                  <span>or email</span>
                  <span className="h-px flex-1 bg-white/10" aria-hidden />
                </div>

                {!signInEmailOpen ? (
                  <button
                    type="button"
                    onClick={() => setSignInEmailOpen(true)}
                    className="flex h-11 w-full items-center justify-center rounded-xl border border-white/12 bg-transparent text-sm font-medium text-white/70 transition-colors hover:border-violet-500/40 hover:bg-white/[0.04] hover:text-white sm:h-12 sm:text-base"
                  >
                    Sign in with email & password
                  </button>
                ) : (
                  <form onSubmit={(e) => void submitEmailSignIn(e)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="si-email" className="text-white/70">
                        Email
                      </Label>
                      <Input
                        id="si-email"
                        type="email"
                        autoComplete="email"
                        value={siEmail}
                        onChange={(e) => setSiEmail(e.target.value)}
                        className="h-11 border-white/15 bg-white/[0.06] text-white placeholder:text-white/35"
                        placeholder="you@school.edu"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="si-password" className="text-white/70">
                        Password
                      </Label>
                      <Input
                        id="si-password"
                        type="password"
                        autoComplete="current-password"
                        value={siPassword}
                        onChange={(e) => setSiPassword(e.target.value)}
                        className="h-11 border-white/15 bg-white/[0.06] text-white placeholder:text-white/35"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={signInSubmitting}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-semibold text-white transition-opacity hover:bg-violet-500 disabled:opacity-60 sm:h-12 sm:text-base"
                    >
                      {signInSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Sign in
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSignInEmailOpen(false);
                        setSiEmail("");
                        setSiPassword("");
                      }}
                      className="w-full text-center text-sm text-white/45 hover:text-white/75"
                    >
                      Cancel
                    </button>
                  </form>
                )}

                <div className="my-8 flex items-center gap-3 text-sm text-white/25 sm:my-10 sm:text-base">
                  <span className="h-px flex-1 bg-white/10" aria-hidden />
                  <span>new here?</span>
                  <span className="h-px flex-1 bg-white/10" aria-hidden />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActivePanel("signup");
                    const p = new URLSearchParams(searchParams.toString());
                    p.set("mode", "signup");
                    router.replace(`/auth?${p.toString()}`, { scroll: false });
                  }}
                  className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-transparent text-base font-medium text-white/60 transition-all hover:border-violet-500/50 hover:bg-violet-600/[0.08] hover:text-white sm:h-14 sm:text-lg"
                >
                  Sign up now
                  <span className="text-lg transition-transform group-hover:translate-x-0.5 sm:text-xl">
                    →
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex flex-1 flex-col justify-center">
                {emailSignupFlow === "otp" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailSignupFlow("form");
                        setOtpValue("");
                      }}
                      className="mb-6 flex items-center gap-2 bg-transparent p-0 text-sm text-white/45 transition-colors hover:text-white/85 sm:mb-8 sm:text-base"
                    >
                      ← Edit email & details
                    </button>
                    <p className="text-xl font-semibold text-white sm:text-2xl">Verify your email</p>
                    <p className="mb-6 mt-2 text-sm leading-relaxed text-white/[0.38] sm:mb-8 sm:text-base">
                      Enter the 6-digit code we sent to{" "}
                      <span className="font-medium text-white/90">{otpEmail}</span>. Check spam if you
                      don&apos;t see it.
                    </p>
                    <form onSubmit={(e) => void submitSignupOtp(e)} className="space-y-6">
                      <div className="flex justify-center">
                        <InputOTP
                          maxLength={6}
                          value={otpValue}
                          onChange={setOtpValue}
                          containerClassName="gap-2 sm:gap-2.5"
                          pattern="^[0-9]*$"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                        >
                          <InputOTPGroup>
                            {([0, 1, 2, 3, 4, 5] as const).map((i) => (
                              <InputOTPSlot
                                key={i}
                                index={i}
                                className="h-11 w-10 border-white/15 bg-white/[0.06] text-lg text-white sm:h-12 sm:w-11"
                              />
                            ))}
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <button
                        type="submit"
                        disabled={otpBusy || otpValue.replace(/\s/g, "").length !== 6}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-base font-semibold text-black transition-opacity hover:bg-emerald-400 disabled:opacity-50 sm:h-14"
                      >
                        {otpBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                        Verify & continue
                      </button>
                      <div className="flex flex-col items-center gap-2 text-center">
                        <button
                          type="button"
                          onClick={() => void resendSignupOtp()}
                          disabled={resendCooldown > 0}
                          className="text-sm font-medium text-violet-400 hover:text-violet-300 disabled:text-white/25"
                        >
                          {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setActivePanel("signin");
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
                      Pick your role — then continue with Google or email (we&apos;ll send a verification
                      code).
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

                    <button
                      type="button"
                      onClick={() => void startGoogleSignUp()}
                      className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border-0 bg-gradient-to-br from-[#7c3aed] to-[#e0496a] px-3 text-base font-medium text-white transition-opacity hover:opacity-[0.88] sm:h-14 sm:gap-3 sm:text-lg"
                    >
                      <GoogleGlyph cta className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
                      <span className="text-center leading-tight">
                        Sign up as {signupRoleLabel} with Google
                      </span>
                    </button>

                    <div className="my-6 flex items-center gap-3 text-sm text-white/25 sm:my-8">
                      <span className="h-px flex-1 bg-white/10" aria-hidden />
                      <span>or email</span>
                      <span className="h-px flex-1 bg-white/10" aria-hidden />
                    </div>

                    {emailSignupFlow === "idle" ? (
                      <button
                        type="button"
                        onClick={() => setEmailSignupFlow("form")}
                        className="flex h-11 w-full items-center justify-center rounded-xl border border-white/12 bg-transparent text-sm font-medium text-white/70 transition-colors hover:border-violet-500/40 hover:bg-white/[0.04] hover:text-white sm:h-12 sm:text-base"
                      >
                        Sign up with email
                      </button>
                    ) : (
                      <form onSubmit={(e) => void submitEmailSignup(e)} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="su-name" className="text-white/70">
                            Full name
                          </Label>
                          <Input
                            id="su-name"
                            autoComplete="name"
                            value={suName}
                            onChange={(e) => setSuName(e.target.value)}
                            className="h-11 border-white/15 bg-white/[0.06] text-white placeholder:text-white/35"
                            placeholder="Your name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="su-email" className="text-white/70">
                            Email
                          </Label>
                          <Input
                            id="su-email"
                            type="email"
                            autoComplete="email"
                            value={suEmail}
                            onChange={(e) => setSuEmail(e.target.value)}
                            className="h-11 border-white/15 bg-white/[0.06] text-white placeholder:text-white/35"
                            placeholder="you@school.edu"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="su-password" className="text-white/70">
                            Password
                          </Label>
                          <Input
                            id="su-password"
                            type="password"
                            autoComplete="new-password"
                            value={suPassword}
                            onChange={(e) => setSuPassword(e.target.value)}
                            className="h-11 border-white/15 bg-white/[0.06] text-white placeholder:text-white/35"
                            placeholder="At least 6 characters"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={signupSubmitting}
                          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60 sm:h-12 sm:text-base"
                        >
                          {signupSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Send verification code
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEmailSignupFlow("idle");
                            setSuName("");
                            setSuEmail("");
                            setSuPassword("");
                          }}
                          className="w-full text-center text-sm text-white/45 hover:text-white/75"
                        >
                          Cancel
                        </button>
                      </form>
                    )}
                  </>
                )}
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
    </div>
  );
}
