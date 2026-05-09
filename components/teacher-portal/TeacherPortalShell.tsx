"use client";

import type { ReactNode } from "react";
import {
  Bell,
  BookOpen,
  ClipboardList,
  Gift,
  GraduationCap,
  LayoutGrid,
  Plus,
  Star,
  User,
} from "lucide-react";
import type { TeacherPortalSection } from "@/lib/teacherPortal/types";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TEACHER_PORTAL_CLASSROOMS_URL } from "@/lib/teacherPortal/routes";

type TeacherVerificationUiStatus = "unverified" | "pending" | "approved" | "rejected";

interface TeacherPortalShellProps {
  activeSection: TeacherPortalSection;
  onSectionChange: (section: TeacherPortalSection) => void;
  rdmBalance: number;
  teacherName: string;
  teacherSubtitle: string;
  onOpenCreateTests: () => void;
  /** When not approved, show sidebar reminder that classrooms / assignments need verification */
  verificationStatus?: TeacherVerificationUiStatus | null;
  onOpenVerificationProfile?: () => void;
  children: ReactNode;
}

const sections: Array<{ key: TeacherPortalSection; label: string; icon: typeof LayoutGrid }> = [
  { key: "myClassroom", label: "My Classroom", icon: LayoutGrid },
  { key: "myClasses", label: "My lessons", icon: GraduationCap },
  { key: "gyanWall", label: "Gyan++ Wall", icon: Star },
  { key: "createTests", label: "Create Tests", icon: BookOpen },
  /** Teacher referrals & challenges — not the student /refer-earn hub */
  { key: "referEarn", label: "Refer & earn", icon: Gift },
  { key: "profile", label: "Profile", icon: User },
];

const EDUBLAST_WORDMARK_SRC = "/images/logo-2.png";
/** Teacher portal only: larger visual logo without increasing header height. */
const TEACHER_LOGO_CLASSNAME = "h-8 w-auto origin-left scale-[1.28] sm:h-9 sm:scale-[1.3]";

export default function TeacherPortalShell({
  activeSection,
  onSectionChange,
  rdmBalance,
  teacherName,
  teacherSubtitle,
  onOpenCreateTests,
  verificationStatus,
  onOpenVerificationProfile,
  children,
}: TeacherPortalShellProps) {
  const router = useRouter();
  const initials =
    teacherName
      .split(" ")
      .filter(Boolean)
      .map((item) => item[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "T";

  return (
    <div className="h-screen overflow-hidden bg-[#07070f] text-slate-100">
      <button
        type="button"
        onClick={() => {
          // Reliable open from any tab: navigate with a flag.
          router.push("/teacher-portal?section=myClassroom&wizard=1");
        }}
        className="fixed left-2.5 top-1/2 z-40 -translate-y-1/2 rounded-2xl border border-violet-400/30 bg-violet-500/10 p-2 text-violet-100 shadow-lg backdrop-blur hover:bg-violet-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070f] sm:left-3 sm:p-2.5"
        aria-label="Open Teacher Wizard"
        title="Teacher Wizard"
      >
        <ClipboardList className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
      </button>
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07070f]/95 backdrop-blur">
        <div className="flex h-11 items-center gap-2 px-3 sm:h-14 sm:gap-3 sm:px-5 lg:px-6">
          <Link
            href={TEACHER_PORTAL_CLASSROOMS_URL}
            className="relative z-10 flex shrink-0 items-center hover:opacity-90 transition-opacity"
            aria-label="EduBlast Home"
          >
            <img
              src={EDUBLAST_WORDMARK_SRC}
              alt="EduBlast"
              className={TEACHER_LOGO_CLASSNAME}
              draggable={false}
            />
          </Link>
          <nav className="ml-10 hidden items-center gap-1 md:flex">
            {sections.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => (key === "createTests" ? onOpenCreateTests() : onSectionChange(key))}
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold transition sm:px-3 sm:py-2 sm:text-sm ${
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
            <div className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-200 sm:px-3 sm:py-1 sm:text-xs">
              {rdmBalance.toLocaleString("en-IN")} RDM
            </div>
            <button
              type="button"
              className="rounded-md border border-white/10 bg-[#11152a] p-1.5 text-slate-400 hover:text-white sm:p-2"
            >
              <Bell className="h-4 w-4" />
            </button>
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/10 text-[11px] font-bold text-violet-200 sm:h-8 sm:w-8 sm:text-xs">
              {initials}
            </div>
          </div>
        </div>
      </header>

      <div className="grid h-[calc(100vh-2.75rem)] min-h-0 grid-cols-1 sm:h-[calc(100vh-3.5rem)] md:grid-cols-[200px_1fr] lg:grid-cols-[232px_1fr]">
        <aside className="min-h-0 overflow-y-auto border-r border-white/10 bg-[#0d0d1c] p-2 sm:p-3">
          {verificationStatus && verificationStatus !== "approved" ? (
            <div className="mb-3 rounded-xl border border-amber-400/40 bg-amber-500/12 px-2.5 py-2 sm:px-3">
              <p className="text-[11px] font-semibold leading-snug text-amber-100 sm:text-xs">
                Verified teachers can create classrooms & assignments
              </p>
              <p className="mt-1 text-[10px] leading-snug text-amber-200/90 sm:text-[11px]">
                Complete verification on your profile so these actions unlock.
              </p>
              {onOpenVerificationProfile ? (
                <button
                  type="button"
                  onClick={onOpenVerificationProfile}
                  className="mt-2 w-full rounded-lg border border-amber-400/35 bg-amber-500/15 px-2 py-1.5 text-[11px] font-semibold text-amber-50 hover:bg-amber-500/25"
                >
                  Open profile & verification
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Navigation
          </div>
          <div className="space-y-0.5">
            {sections.map(({ key, label, icon: Icon }) => (
              <button
                key={`sidebar-${key}`}
                type="button"
                onClick={() => (key === "createTests" ? onOpenCreateTests() : onSectionChange(key))}
                className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11.5px] transition sm:px-3 sm:py-2 sm:text-sm ${
                  activeSection === key
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
              onClick={() => router.push("/teacher-portal/create-assignment")}
              className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-1.5 text-left text-[12px] text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white sm:px-3 sm:py-2 sm:text-sm"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Create Assignment
            </button>
            <button
              type="button"
              onClick={() =>
                router.push("/teacher-portal?section=myClassroom&wizard=1")
              }
              className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-1.5 text-left text-[12px] text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white sm:px-3 sm:py-2 sm:text-sm"
            >
              <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Send RDM Boost
            </button>
            <button
              type="button"
              onClick={() =>
                router.push("/teacher-portal?section=myClassroom&portalDetail=progress")
              }
              className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-1.5 text-left text-[12px] text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white sm:py-2 sm:text-sm"
            >
              <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Progress Reports
            </button>
          </div>
          <div className="mt-3 rounded-xl border border-white/10 bg-[#111325] p-2.5 sm:mt-4 sm:p-3">
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/10 text-xs font-bold text-violet-200 sm:h-10 sm:w-10 sm:text-sm">
              {initials}
            </div>
            <div className="text-center text-[12px] font-semibold sm:text-sm">{teacherName}</div>
            <div className="text-center text-[11px] text-slate-400 sm:text-xs">
              {teacherSubtitle}
            </div>
            <div className="mt-2 text-center text-[11px] font-semibold text-amber-300 sm:text-xs">
              {rdmBalance.toLocaleString("en-IN")} RDM earned
            </div>
          </div>
        </aside>
        <main className="min-h-0 min-w-0 w-full overflow-y-auto p-2.5 text-left sm:p-5 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
