"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GraduationCap, BookOpen, Clock, ArrowLeft } from "lucide-react";

export default function SelectRolePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] text-white">
          <span className="text-4xl animate-pulse">🎯</span>
        </div>
      }
    >
      <SelectRoleContent />
    </Suspense>
  );
}

function SelectRoleContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") === "signin" ? "signin" : "signup";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0f] px-4 py-12 text-white">
      {/* Back to auth choice */}
      <div className="mb-8">
        <Link
          href="/auth-choice"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      {/* Header */}
      <div className="mb-10 text-center">
        <div className="mb-3 text-4xl">👋</div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Who are you?</h1>
        <p className="mt-2 text-sm text-slate-400">
          Choose your role to personalize your experience
        </p>
      </div>

      {/* Role cards */}
      <div className="grid w-full max-w-[520px] gap-4 sm:grid-cols-2">
        {/* Student */}
        <Link
          href={`/auth?role=student&mode=${mode}`}
          onClick={() => {
            try {
              sessionStorage.setItem("auth_intended_role", "student");
              sessionStorage.setItem("auth_mode", mode);
            } catch (_) {}
          }}
          className="group flex flex-col items-center rounded-2xl border border-white/10 bg-[#11121a] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/30 hover:bg-[#151725] hover:shadow-[0_12px_28px_-10px_rgba(52,245,164,0.25)] sm:col-span-1"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300 transition-all duration-300 group-hover:scale-105 group-hover:border-emerald-400/40">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">Student</h2>
          <p className="mt-1 text-center text-sm leading-relaxed text-slate-400">
            Learn, practice &amp; conquer exams
          </p>
        </Link>

        {/* Teacher */}
        <Link
          href={`/auth?role=teacher&mode=${mode}`}
          onClick={() => {
            try {
              sessionStorage.setItem("auth_intended_role", "teacher");
              sessionStorage.setItem("auth_mode", mode);
            } catch (_) {}
          }}
          className="group flex flex-col items-center rounded-2xl border border-white/10 bg-[#11121a] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-400/30 hover:bg-[#151725] hover:shadow-[0_12px_28px_-10px_rgba(111,113,255,0.25)] sm:col-span-1"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300 transition-all duration-300 group-hover:scale-105 group-hover:border-indigo-400/40">
            <BookOpen className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">Teacher</h2>
          <p className="mt-1 text-center text-sm leading-relaxed text-slate-400">
            Create classrooms &amp; teach
          </p>
        </Link>

        {/* Mentor — Coming soon */}
        <div className="flex flex-col items-center rounded-2xl border border-white/5 bg-[#0d0e14] p-6 opacity-60 sm:col-span-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-amber-400/10 bg-amber-500/5 text-amber-300/50">
            <Clock className="h-7 w-7" />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-400">Mentor</h2>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300/70">
              Coming soon
            </span>
          </div>
          <p className="mt-1 text-center text-sm leading-relaxed text-slate-500">
            Guide &amp; mentor students (launching soon)
          </p>
        </div>
      </div>
    </div>
  );
}
