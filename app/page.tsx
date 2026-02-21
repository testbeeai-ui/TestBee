"use client";

import { useEffect, useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Zap, BookOpen, Trophy, Sparkles, ArrowRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function Welcome() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><span className="text-4xl animate-pulse">🎯</span></div>}>
      <WelcomeContent />
    </Suspense>
  );
}

function WelcomeContent() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"welcome" | "role">("welcome");

  useEffect(() => {
    if (searchParams.get("step") === "role") setStep("role");
  }, [searchParams]);

  useEffect(() => {
    if (loading) return;
    if (user && profile?.onboarding_complete) router.replace("/home");
  }, [user, profile?.onboarding_complete, loading, router]);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="absolute inset-0 gradient-hero opacity-95" />
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-foreground/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-foreground/3 rounded-full blur-3xl" />
      </div>

      <div className="relative flex-1 flex items-center justify-center p-6">
        <AnimatePresence mode="wait">
          {step === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="text-center max-w-2xl mx-auto"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="text-8xl md:text-9xl mb-8"
              >
                🎯
              </motion.div>
              <h1 className="text-5xl md:text-7xl font-display text-primary-foreground mb-4 tracking-tight">
                EduBlast
              </h1>
              <p className="text-xl md:text-2xl text-primary-foreground/90 mb-3 font-extrabold">
                Learn. Play. Conquer.
              </p>
              <p className="text-primary-foreground/60 mb-10 text-base md:text-lg max-w-lg mx-auto">
                Fire questions, earn RDM, and blast through your syllabus with
                byte-sized learning!
              </p>

              <div className="flex gap-4 justify-center mb-10">
                {[
                  { icon: Zap, label: "Quick Fire", desc: "5 random Q's" },
                  { icon: BookOpen, label: "Smart Learn", desc: "Adaptive practice" },
                  { icon: Trophy, label: "Earn RDM", desc: "Level up daily" },
                ].map(({ icon: Icon, label, desc }) => (
                  <motion.div
                    key={label}
                    whileHover={{ scale: 1.05 }}
                    className="bg-primary-foreground/10 backdrop-blur-sm rounded-2xl p-4 text-center min-w-[120px] border border-primary-foreground/10"
                  >
                    <Icon className="w-7 h-7 text-primary-foreground mx-auto mb-2" />
                    <span className="text-sm text-primary-foreground font-extrabold block">
                      {label}
                    </span>
                    <span className="text-xs text-primary-foreground/60">{desc}</span>
                  </motion.div>
                ))}
              </div>

              <Button
                onClick={() => setStep("role")}
                size="lg"
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 rounded-full px-12 py-7 text-lg font-extrabold shadow-2xl hover:scale-105 transition-transform"
              >
                Get Started <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <p className="mt-6 text-primary-foreground/70 text-sm">
                Teacher or already have an account?{" "}
                <Link href="/auth" className="font-bold underline hover:text-primary-foreground">
                  Sign in
                </Link>
              </p>
            </motion.div>
          )}

          {step === "role" && (
            <motion.div
              key="role"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="bg-card rounded-3xl p-8 shadow-2xl w-full max-w-md border border-border/50 text-center"
            >
              <div className="mb-6">
                <span className="text-5xl mb-3 block">👋</span>
                <h2 className="text-2xl font-display text-foreground">Are you a Student or Teacher?</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  We&apos;ll take you to the right sign-in and setup flow.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => router.push("/auth?role=student")}
                  className="bg-muted/20 rounded-2xl p-5 text-center border-2 border-border/50 hover:border-primary/40 hover:shadow-md transition-all"
                >
                  <span className="text-4xl block mb-2">🎓</span>
                  <h3 className="font-display text-sm text-foreground">Student</h3>
                  <p className="text-xs text-muted-foreground mt-1">Continue with Google</p>
                </button>
                <button
                  onClick={() => router.push("/auth?role=teacher")}
                  className="bg-muted/20 rounded-2xl p-5 text-center border-2 border-border/50 hover:border-primary/40 hover:shadow-md transition-all"
                >
                  <span className="text-4xl block mb-2">📖</span>
                  <h3 className="font-display text-sm text-foreground">Teacher</h3>
                  <p className="text-xs text-muted-foreground mt-1">Sign in / create account</p>
                </button>
              </div>

              <div className="mt-6">
                <Button variant="outline" className="rounded-xl" onClick={() => setStep("welcome")}>
                  Back
                </Button>
                <p className="mt-4 text-muted-foreground text-xs">
                  Already have an account?{" "}
                  <Link href="/auth" className="font-bold text-primary hover:underline">
                    Sign in
                  </Link>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative text-center pb-6">
        <p className="text-primary-foreground/40 text-xs font-bold">
          Classes 9-12 · PCM & PCMB · JEE · NEET · KCET
        </p>
      </div>
    </div>
  );
}
