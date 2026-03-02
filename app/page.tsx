"use client";

import { useEffect, useState, Suspense } from "react";
import Image from "next/image";
import heroStudyDesk from "@/public/images/hero-study-desk.png";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Zap, BookOpen, Trophy, ArrowRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function Welcome() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50"><span className="text-4xl animate-pulse">🎯</span></div>}>
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
    <div className="min-h-screen flex flex-col bg-white overflow-hidden relative">
      {/* Hero image: full brightness, no blur - exactly as your sir likes it */}
      <Image
        src={heroStudyDesk}
        alt="Study and learning"
        fill
        priority
        className="object-cover object-center pointer-events-none select-none"
        quality={100}
        sizes="100vw"
      />

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
              <h1 className="text-5xl md:text-7xl font-display text-slate-900 mb-4 tracking-tight">
                EduBlast
              </h1>
              <p className="text-xl md:text-2xl text-slate-900 mb-3 font-extrabold">
                Learn. Play. Conquer.
              </p>
              <p className="text-slate-600 mb-10 text-base md:text-lg max-w-lg mx-auto font-medium">
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
                    className="bg-white rounded-2xl p-4 text-center min-w-[120px] border border-slate-100 shadow-xl shadow-slate-200/50"
                  >
                    <Icon className="w-7 h-7 text-indigo-600 mx-auto mb-2" />
                    <span className="text-sm text-slate-900 font-extrabold block">
                      {label}
                    </span>
                    <span className="text-xs text-slate-600">{desc}</span>
                  </motion.div>
                ))}
              </div>

              <Button
                onClick={() => setStep("role")}
                size="lg"
                className="bg-indigo-600 text-white hover:bg-indigo-700 rounded-full px-12 py-7 text-lg font-extrabold shadow-xl shadow-indigo-200/50 hover:scale-105 transition-transform"
              >
                Get Started <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <p className="mt-6 text-slate-600 text-sm font-medium">
                Teacher or already have an account?{" "}
                <Link href="/auth" className="font-bold text-indigo-600 underline hover:text-indigo-700">
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
              className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 w-full max-w-md border border-slate-100 text-center"
            >
              <div className="mb-6">
                <span className="text-5xl mb-3 block">👋</span>
                <h2 className="text-2xl font-display text-slate-900">Are you a Student or Teacher?</h2>
                <p className="text-slate-600 text-sm mt-1">
                  We&apos;ll take you to the right sign-in and setup flow.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => router.push("/auth?role=student")}
                  className="bg-white rounded-2xl p-5 text-center border-2 border-slate-100 hover:border-indigo-600 hover:shadow-md transition-all"
                >
                  <span className="text-4xl block mb-2">🎓</span>
                  <h3 className="font-display text-sm text-slate-900">Student</h3>
                  <p className="text-xs text-slate-600 mt-1">Continue with Google</p>
                </button>
                <button
                  onClick={() => router.push("/auth?role=teacher")}
                  className="bg-white rounded-2xl p-5 text-center border-2 border-slate-100 hover:border-indigo-600 hover:shadow-md transition-all"
                >
                  <span className="text-4xl block mb-2">📖</span>
                  <h3 className="font-display text-sm text-slate-900">Teacher</h3>
                  <p className="text-xs text-slate-600 mt-1">Sign in / create account</p>
                </button>
              </div>

              <div className="mt-6">
                <Button variant="outline" className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-indigo-300" onClick={() => setStep("welcome")}>
                  Back
                </Button>
                <p className="mt-4 text-slate-600 text-xs">
                  Already have an account?{" "}
                  <Link href="/auth" className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline">
                    Sign in
                  </Link>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative text-center pb-6">
        <p className="text-slate-600 text-xs font-bold">
          Classes 9-12 · PCM & PCMB · JEE · NEET · KCET
        </p>
      </div>
    </div>
  );
}
