"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  GraduationCap,
  RotateCcw,
  Gamepad2,
  Map,
  Heart,
  BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EXPLORE_APP_PATH } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useUserStore } from "@/store/useUserStore";
import { useStudyStreakFromApi } from "@/hooks/useStudyStreakFromApi";
import { countInstacueRevisionDue, formatEdufundRdmBadge } from "@/lib/dashboardSidebarMetrics";

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: string | null };

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/revision") return pathname === "/revision";
  if (href === "/play") return pathname === "/play";
  if (href === "/mock") {
    if (pathname === "/mock" || pathname === "/exam-prep") return true;
  }
  if (href === EXPLORE_APP_PATH) return pathname === EXPLORE_APP_PATH || pathname.startsWith("/explore-1");
  if (href === "/edufund") return pathname === "/edufund" || pathname.startsWith("/edufund/");
  return pathname === href;
}

function NavRow({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          "group flex min-h-[40px] items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors",
          active
            ? "bg-primary/12 text-primary ring-1 ring-primary/20"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
        )}
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent bg-muted/40 text-foreground/80 group-hover:border-border/80",
            active && "border-primary/25 bg-primary/10 text-primary"
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.badge ? (
          <span
            className={cn(
              "max-w-[5.5rem] shrink-0 truncate rounded-md px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums",
              item.badge === "Live"
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-muted/80 text-muted-foreground"
            )}
            title={item.badge}
          >
            {item.badge}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="px-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/90">{title}</p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const user = useUserStore((s) => s.user);
  const rdm = profile?.rdm ?? user?.rdm ?? 0;
  const { streakDays, ready: streakReady } = useStudyStreakFromApi();

  const instacueDue = countInstacueRevisionDue(profile?.saved_revision_cards);
  const instacueBadge = instacueDue > 0 ? `${instacueDue} due` : null;

  const edufundBadge = profile?.id ? formatEdufundRdmBadge(rdm) : null;

  const learning: NavItem[] = [
    { href: "/home", label: "Dashboard", icon: LayoutDashboard },
    { href: "/magic-wall", label: "Community feed", icon: Sparkles, badge: "Live" },
    { href: "/mock", label: "Testbee mocks", icon: GraduationCap },
    {
      href: "/revision",
      label: "Instacue revision",
      icon: RotateCcw,
      badge: instacueBadge,
    },
    { href: "/play", label: "Play arena", icon: Gamepad2 },
  ];

  const progress: NavItem[] = [
    { href: "/performance", label: "Performance", icon: BarChart3 },
    { href: EXPLORE_APP_PATH, label: "Unit maps", icon: Map },
    { href: "/edufund", label: "EduFund", icon: Heart, badge: edufundBadge },
  ];

  const streakLabel = !profile?.id ? "—" : streakReady ? `${streakDays} day${streakDays === 1 ? "" : "s"}` : "…";

  return (
    <aside className="hidden w-[13.5rem] shrink-0 flex-col border-r border-border/50 bg-card/30 lg:flex xl:w-60">
      <nav
        className="sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col gap-6 overflow-y-auto px-2.5 pb-8 pt-1"
        aria-label="Dashboard navigation"
      >
        <Section title="Learning">
          {learning.map((item) => (
            <NavRow key={item.href} item={item} active={isActivePath(pathname, item.href)} />
          ))}
        </Section>

        <div className="h-px w-full bg-border/60" aria-hidden />

        <Section title="Progress">
          {progress.map((item) => (
            <NavRow key={item.href} item={item} active={isActivePath(pathname, item.href)} />
          ))}
        </Section>

        <div className="mt-auto rounded-xl border border-border/70 bg-muted/25 p-3 dark:bg-slate-950/50">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Study streak</p>
          <p className="mt-1.5 flex items-baseline gap-1.5 text-lg font-extrabold tabular-nums text-foreground">
            <span aria-hidden>🔥</span>
            {streakLabel}
          </p>
          <p className="mt-2 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
            RDM balance{" "}
            <span className="font-bold tabular-nums text-foreground">{rdm.toLocaleString("en-IN")}</span>
          </p>
        </div>
      </nav>
    </aside>
  );
}
