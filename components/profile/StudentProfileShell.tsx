"use client";

import Link from "next/link";
import { User, GraduationCap, Trophy, Activity, Heart, Settings, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type StudentProfileSectionId = "personal" | "academic" | "achievements" | "activity" | "edufund";

const NAV: { id: StudentProfileSectionId; label: string; icon: typeof User }[] = [
  { id: "personal", label: "Personal info", icon: User },
  { id: "academic", label: "Academic record", icon: GraduationCap },
  { id: "achievements", label: "Achievements", icon: Trophy },
  { id: "activity", label: "Activity track record", icon: Activity },
  { id: "edufund", label: "EduFund & funders", icon: Heart },
];

interface StudentProfileShellProps {
  displayName: string;
  roleLabel?: string;
  initials: string;
  activeSection: StudentProfileSectionId;
  onSectionChange: (id: StudentProfileSectionId) => void;
  rdmDisplay?: number;
  children: React.ReactNode;
}

export default function StudentProfileShell({
  displayName,
  roleLabel = "Student",
  initials,
  activeSection,
  onSectionChange,
  rdmDisplay,
  children,
}: StudentProfileShellProps) {
  return (
    <div className="flex min-h-0 flex-col gap-3 sm:min-h-[min(82vh,900px)] sm:gap-4 lg:flex-row lg:items-stretch lg:gap-4 xl:gap-5 2xl:gap-6">
      <aside className="flex w-full shrink-0 flex-col rounded-xl border border-border bg-card sm:rounded-2xl dark:border-white/10 dark:bg-[#0c1017] lg:w-[13.5rem] xl:w-60 2xl:w-64">
        <div className="border-b border-border/80 p-3 dark:border-white/10 sm:p-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600/20 text-xs font-black text-emerald-400 ring-2 ring-emerald-500/40 sm:h-11 sm:w-11 sm:text-sm">
              {initials.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground sm:text-base dark:text-white">{displayName}</p>
              <p className="text-[11px] font-semibold text-muted-foreground sm:text-xs dark:text-slate-400">
                {roleLabel}
              </p>
            </div>
          </div>
          {rdmDisplay != null ? (
            <p className="mt-2 text-[11px] text-muted-foreground sm:mt-3 sm:text-xs dark:text-slate-500">
              <span className="font-bold text-emerald-400">{rdmDisplay.toLocaleString()}</span> RDM
            </p>
          ) : null}
        </div>
        <nav className="flex flex-col gap-0.5 p-1.5 sm:p-2">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSectionChange(id)}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-[11px] font-bold transition-colors sm:gap-2 sm:px-3 sm:py-2.5 sm:text-xs lg:text-sm",
                  active
                    ? "border-l-4 border-emerald-500 bg-emerald-500/15 text-emerald-100"
                    : "border-l-4 border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground dark:hover:bg-white/5"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-90 sm:h-4 sm:w-4" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {active ? <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70 sm:h-4 sm:w-4" /> : null}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-border/80 p-1.5 dark:border-white/10 sm:p-2">
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground sm:px-3 sm:py-2.5 sm:text-xs lg:text-sm dark:hover:bg-white/5"
          >
            <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Settings
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:min-w-0">{children}</div>
    </div>
  );
}
