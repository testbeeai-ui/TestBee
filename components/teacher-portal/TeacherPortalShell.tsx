"use client";

import type { ReactNode } from "react";
import { Bell, BookOpen, Gift, GraduationCap, LayoutGrid, Plus, Star, User } from "lucide-react";
import type { TeacherPortalSection } from "@/lib/teacherPortal/types";

interface TeacherPortalShellProps {
  activeSection: TeacherPortalSection;
  onSectionChange: (section: TeacherPortalSection) => void;
  rdmBalance: number;
  teacherName: string;
  teacherSubtitle: string;
  onOpenCreateTests: () => void;
  children: ReactNode;
}

const sections: Array<{ key: TeacherPortalSection; label: string; icon: typeof LayoutGrid }> = [
  { key: "myClassroom", label: "My Classroom", icon: LayoutGrid },
  { key: "myClasses", label: "My lessons", icon: GraduationCap },
  { key: "gyanWall", label: "Gyan++ Wall", icon: Star },
  { key: "createTests", label: "Create Tests", icon: BookOpen },
  { key: "referEarn", label: "Refer & Earn", icon: Gift },
  { key: "profile", label: "Profile", icon: User },
];

export default function TeacherPortalShell({
  activeSection,
  onSectionChange,
  rdmBalance,
  teacherName,
  teacherSubtitle,
  onOpenCreateTests,
  children,
}: TeacherPortalShellProps) {
  const initials =
    teacherName
      .split(" ")
      .filter(Boolean)
      .map((item) => item[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "T";

  return (
    <div className="min-h-screen bg-[#07070f] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07070f]/95 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-4 sm:h-16 sm:gap-3 sm:px-5 lg:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-emerald-400/40 bg-[#101425]">
              <span className="font-serif text-emerald-300">E</span>
            </div>
            <div className="font-serif text-lg">
              Edu<span className="text-emerald-400 italic">Blast</span>
            </div>
          </div>
          <div className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-violet-200">
            Teacher Portal
          </div>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {sections.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => (key === "createTests" ? onOpenCreateTests() : onSectionChange(key))}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 sm:py-2 sm:text-sm ${
                  activeSection === key
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {key === "createTests" ? (
                  <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-rose-200">
                    New
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200">
              {rdmBalance.toLocaleString("en-IN")} RDM
            </div>
            <button
              type="button"
              className="rounded-md border border-white/10 bg-[#11152a] p-2 text-slate-400 hover:text-white"
            >
              <Bell className="h-4 w-4" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/10 text-xs font-bold text-violet-200">
              {initials}
            </div>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-1 sm:min-h-[calc(100vh-4rem)] md:grid-cols-[250px_1fr]">
        <aside className="border-r border-white/10 bg-[#0d0d1c] p-3 sm:p-3.5">
          <div className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Navigation
          </div>
          <div className="space-y-1">
            {sections.map(({ key, label, icon: Icon }) => (
              <button
                key={`sidebar-${key}`}
                type="button"
                onClick={() => (key === "createTests" ? onOpenCreateTests() : onSectionChange(key))}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition sm:py-2.5 ${
                  activeSection === key
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
                {key === "createTests" ? (
                  <span className="ml-auto rounded bg-rose-500/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-rose-200">
                    New
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="px-2 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Quick tools
          </div>
          <div className="space-y-1">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-left text-sm text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white sm:py-2.5"
            >
              <Plus className="h-4 w-4" />
              Create Assignment
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-left text-sm text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white sm:py-2.5"
            >
              <Star className="h-4 w-4" />
              Send RDM Boost
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left text-sm text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white"
            >
              <BookOpen className="h-4 w-4" />
              Progress Reports
            </button>
          </div>
          <div className="mt-3 rounded-xl border border-white/10 bg-[#111325] p-2.5 sm:mt-4 sm:p-3">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/10 text-sm font-bold text-violet-200">
              {initials}
            </div>
            <div className="text-center text-sm font-semibold">{teacherName}</div>
            <div className="text-center text-xs text-slate-400">{teacherSubtitle}</div>
            <div className="mt-2 text-center text-xs font-semibold text-amber-300">
              {rdmBalance.toLocaleString("en-IN")} RDM earned
            </div>
          </div>
        </aside>
        <main className="min-w-0 w-full p-4 text-left sm:p-5 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
