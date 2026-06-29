"use client";

import { type ReactNode, useState } from "react";
import {
  Bell,
  BookOpen,
  Calendar,
  ClipboardList,
  Coins,
  CreditCard,
  Gift,
  GraduationCap,
  LayoutGrid,
  Plus,
  Star,
  User,
  X,
  Zap,
  Users,
} from "lucide-react";
import type { TeacherPortalSection } from "@/lib/teacherPortal/types";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TEACHER_PORTAL_CLASSROOMS_URL } from "@/lib/teacherPortal/routes";
import { DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG } from "@/lib/teacherPortal/liveClassDeliveryRdm";
import { DEFAULT_RDM_CONFIG } from "@/lib/rdm/rdmConfig";

interface TeacherPortalShellProps {
  activeSection: TeacherPortalSection;
  onSectionChange: (section: TeacherPortalSection) => void;
  rdmBalance: number;
  teacherName: string;
  teacherSubtitle: string;
  onOpenCreateTests: () => void;
  onSyncWallet?: () => void | Promise<void>;
  children: ReactNode;
}

const sections: Array<{ key: TeacherPortalSection; label: string; icon: typeof LayoutGrid }> = [
  { key: "myClassroom", label: "My Classroom", icon: LayoutGrid },
  { key: "myClasses", label: "My lessons", icon: GraduationCap },
  { key: "gyanWall", label: "Gyan++ Wall", icon: Star },
  { key: "createTests", label: "Create Tests", icon: BookOpen },
  /** Teacher referrals & challenges — not the student /refer-earn hub */
  { key: "referEarn", label: "Refer & earn", icon: Gift },
  { key: "subscriptions", label: "Subscriptions", icon: CreditCard },
  { key: "profile", label: "Profile", icon: User },
];

const WALLET_EARNING_RATES = [
  {
    label: "Gyan++ answer",
    amount: DEFAULT_RDM_CONFIG.gyan_teacher_answer_rdm,
    icon: Star,
    color: "text-amber-300",
  },
  {
    label: "Section schedule class",
    amount: DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG.baseRdm,
    icon: Zap,
    color: "text-emerald-300",
  },
  { label: "Refer a teacher", amount: 100, icon: Users, color: "text-violet-300" },
] as const;

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
  onSyncWallet,
  children,
}: TeacherPortalShellProps) {
  const [walletOpen, setWalletOpen] = useState(false);
  const router = useRouter();

  const openWallet = () => {
    void onSyncWallet?.();
    setWalletOpen(true);
  };
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
            <button
              type="button"
              onClick={openWallet}
              className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-200 transition-colors hover:bg-amber-400/20 sm:px-3 sm:py-1 sm:text-xs"
              aria-label={`RDM Wallet: ${rdmBalance.toLocaleString("en-IN")} RDM`}
            >
              <Coins className="h-3.5 w-3.5" />
              <span>{rdmBalance.toLocaleString("en-IN")} RDM</span>
            </button>
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
              onClick={() => router.push("/teacher-portal?section=myClassroom&scheduleLive=1")}
              className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-1.5 text-left text-[12px] text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white sm:px-3 sm:py-2 sm:text-sm"
            >
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Schedule lesson
            </button>
            <button
              type="button"
              onClick={() => router.push("/teacher-portal?section=myClassroom&wizard=1")}
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
            <button
              type="button"
              onClick={openWallet}
              className="mt-2 w-full text-center text-[11px] font-semibold text-amber-300 transition-colors hover:text-amber-200 sm:text-xs"
            >
              {rdmBalance.toLocaleString("en-IN")} RDM earned
            </button>
          </div>
        </aside>
        <main className="min-h-0 min-w-0 w-full overflow-y-auto p-2.5 text-left sm:p-5 lg:p-6">
          {children}
        </main>
      </div>

      {/* Wallet popup */}
      {walletOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setWalletOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-amber-400/20 bg-[#0d0d22] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-amber-300" />
                <h2 className="text-lg font-semibold text-slate-100">RDM Wallet</h2>
              </div>
              <button
                type="button"
                onClick={() => setWalletOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-center">
              <div className="font-serif text-3xl text-amber-300">
                {rdmBalance.toLocaleString("en-IN")}
              </div>
              <div className="text-sm text-slate-400">RDM balance</div>
            </div>

            <div className="mb-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Ways to earn
              </div>
              <div className="space-y-1.5">
                {WALLET_EARNING_RATES.map(({ label, amount, icon: Icon, color }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                  >
                    <Icon className={"h-3.5 w-3.5 shrink-0 " + color} />
                    <span className="flex-1 text-sm text-slate-300">{label}</span>
                    <span className="font-serif text-sm font-semibold text-amber-300">
                      +{amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-center text-[11px] text-slate-500">
              Top up in Subscriptions — Razorpay checkout for 500 / 1,000 / 2,200 RDM packs.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
