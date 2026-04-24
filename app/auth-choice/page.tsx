"use client";

import Link from "next/link";
import { ArrowLeft, LogIn, UserPlus } from "lucide-react";

export default function AuthChoicePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0f] px-4 py-12 text-white">
      {/* Back to home */}
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </div>

      {/* Header */}
      <div className="mb-10 text-center">
        <div className="mb-3 text-4xl">🎯</div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Welcome to EduBlast
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          How would you like to continue?
        </p>
      </div>

      {/* Auth choice cards */}
      <div className="grid w-full max-w-[420px] gap-4">
        {/* Sign In */}
        <Link
          href="/select-role?mode=signin"
          className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-[#11121a] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/30 hover:bg-[#151725] hover:shadow-[0_12px_28px_-10px_rgba(96,165,250,0.25)]"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-300 transition-all duration-300 group-hover:scale-105 group-hover:border-blue-400/40">
            <LogIn className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">Sign In</h2>
            <p className="text-sm text-slate-400">
              Already have an account? Continue your journey
            </p>
          </div>
        </Link>

        {/* Create Account */}
        <Link
          href="/select-role?mode=signup"
          className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-[#11121a] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/30 hover:bg-[#151725] hover:shadow-[0_12px_28px_-10px_rgba(52,245,164,0.25)]"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300 transition-all duration-300 group-hover:scale-105 group-hover:border-emerald-400/40">
            <UserPlus className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">Create Account</h2>
            <p className="text-sm text-slate-400">
              New here? Join EduBlast and start learning
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
