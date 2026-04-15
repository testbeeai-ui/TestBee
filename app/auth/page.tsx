"use client";

import { useState, useEffect, Suspense } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Lock, User, ArrowRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export default function Auth() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><span className="text-4xl animate-pulse">🎯</span></div>}>
      <AuthContent />
    </Suspense>
  );
}

function AuthContent() {
  const { user, profile, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const [profileWaitDone, setProfileWaitDone] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    if (user && profile?.onboarding_complete) router.replace("/home");
    else if (user && profile !== null && !profile?.onboarding_complete) router.replace("/onboarding");
  }, [user, profile, profile?.onboarding_complete, loading, router]);

  const loadingOrRedirecting = loading || (user != null && profile === null && !profileWaitDone);
  if (loadingOrRedirecting)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="text-4xl animate-pulse">🎯</span>
      </div>
    );
  if (user && !profileWaitDone) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <span className="text-4xl animate-pulse">🎯</span>
    </div>
  );

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    if (mode === "login") {
      const { error } = await signInWithEmail(email, password);
      if (error) setError(error.message);
    } else {
      if (!name.trim()) {
        setError("Name is required");
        setSubmitting(false);
        return;
      }
      const { error } = await signUpWithEmail(email, password, name);
      if (error) setError(error.message);
    }
    setSubmitting(false);
  };

  return (
    <div className="auth-glass-page flex min-h-screen flex-col">
      <div className="relative flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="auth-glass-card w-full max-w-md rounded-3xl p-8"
        >
          <div className="text-center mb-6">
            <span className="text-5xl mb-3 block">🎯</span>
            <h1 className="text-3xl font-display text-foreground">EduBlast</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {mode === "login" ? "Welcome back!" : "Create your account"}
            </p>
          </div>

          <Button
            onClick={() => signInWithGoogle(roleParam === "student" ? "/onboarding?role=student" : roleParam === "teacher" ? "/onboarding?role=teacher" : "/onboarding")}
            variant="outline"
            className="auth-glass-outline-btn w-full rounded-xl h-12 text-base font-bold mb-4 gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 my-4">
            <div className="auth-glass-divider flex-1" />
            <span className="text-xs text-muted-foreground font-bold">OR</span>
            <div className="auth-glass-divider flex-1" />
          </div>

          <div className="space-y-4">
            {mode === "signup" && (
              <div className="relative">
                <User className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="auth-glass-input pl-10 rounded-xl h-12"
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-glass-input pl-10 rounded-xl h-12"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-glass-input pl-10 rounded-xl h-12"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>

            {error && <p className="text-sm text-destructive font-bold">{error}</p>}

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full rounded-xl h-12 text-base font-extrabold edu-btn-primary"
            >
              {submitting ? "..." : mode === "login" ? "Sign In" : "Sign Up"}{" "}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-5">
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
              }}
              className="text-primary font-extrabold hover:underline"
            >
              {mode === "login" ? "Sign Up" : "Sign In"}
            </button>
          </p>
          {roleParam && (
            <p className="text-center text-xs text-muted-foreground mt-2">
              Chose the wrong role?{" "}
              <button type="button" onClick={() => router.replace("/?step=role")} className="text-primary font-bold hover:underline">
                Go back
              </button>{" "}
              to pick Student or Teacher.
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
