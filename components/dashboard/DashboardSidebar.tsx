"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  GraduationCap,
  Library,
  RotateCcw,
  Gamepad2,
  Map,
  Heart,
  BarChart3,
  PanelLeftClose,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EXPLORE_APP_PATH } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useUserStore } from "@/store/useUserStore";
import { useStudyStreakFromApi } from "@/hooks/useStudyStreakFromApi";
import {
  formatEdufundRdmBadge,
  formatEdufundRdmBadgeDetail,
} from "@/lib/dashboard/dashboardSidebarMetrics";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string | null;
  /** Tooltip text shown on the badge hover (full detail, e.g. "1,977 RDM → Sprout"). */
  badgeTitle?: string | null;
};

const PIN_KEY = "eb_sidebar_pinned";

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/revision") return pathname === "/revision";
  if (href === "/play") return pathname === "/play";
  if (href === "/mock") {
    if (pathname === "/mock" || pathname === "/exam-prep") return true;
  }
  if (href === EXPLORE_APP_PATH)
    return pathname === EXPLORE_APP_PATH || pathname.startsWith("/explore-1");
  if (href === "/edufund") return pathname === "/edufund" || pathname.startsWith("/edufund/");
  return pathname === href;
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        prefetch={!active}
        className={cn(
          // Match v3 reference: 8px 15px padding, no chip-tile background,
          // icon and label sit on a single line, active row gets a teal tint
          // (not a bordered box). Icon column is a fixed 17px square so the
          // labels line up between rows.
          "flex h-8 items-center gap-2.5 px-3.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors",
          active
            ? "bg-primary/12 text-primary"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        )}
      >
        <Icon
          className={cn(
            "h-[17px] w-[17px] shrink-0",
            active ? "text-primary" : "text-muted-foreground/80"
          )}
          strokeWidth={2}
        />
        <span className="eb-sidebar-lbl flex-1 truncate">{item.label}</span>
        {item.badge ? (
          <span
            className={cn(
              // Cap badge width + truncate so a long badge can never
              // squeeze the row label out (defends against future badge
              // strings that grow). The full string is still in `title`.
              "eb-sidebar-bdg max-w-[5.5rem] shrink-0 truncate rounded-full px-1.5 text-[9.5px] font-bold uppercase leading-[1.6] tabular-nums",
              item.badge === "Live"
                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/20 text-amber-700 dark:text-amber-400"
            )}
            title={item.badgeTitle ?? item.badge}
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
    <div className="space-y-0.5">
      <p className="eb-sidebar-lbl px-3.5 pt-2.5 pb-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
        {title}
      </p>
      <ul className="space-y-0">{children}</ul>
    </div>
  );
}

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const user = useUserStore((s) => s.user);
  const rdm = profile?.rdm ?? user?.rdm ?? 0;
  const { streakDays, ready: streakReady } = useStudyStreakFromApi();

  // Pin state — persisted in localStorage so the user's choice survives reloads.
  const [pinned, setPinned] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setPinned(window.localStorage.getItem(PIN_KEY) === "1");
    } catch {
      /* private mode / storage blocked */
    }
    setHydrated(true);
  }, []);

  // Render in the unpinned (collapsed) state until hydration completes, so we
  // don't flash the expanded sidebar on first paint when the saved pin is on.
  void hydrated;

  const edufundBadge = profile?.id ? formatEdufundRdmBadge(rdm) : null;
  // Full-detail string (RDM remaining → tier) for the badge tooltip; the
  // badge itself only shows the tier name to keep the sidebar row readable.
  const edufundBadgeTitle = profile?.id ? formatEdufundRdmBadgeDetail(rdm) : null;

  const learning: NavItem[] = [
    { href: "/home", label: "Dashboard", icon: LayoutDashboard },
    { href: "/magic-wall", label: "Community feed", icon: Sparkles, badge: "Live" },
    { href: "/mock", label: "Magic Wall", icon: GraduationCap },
    { href: "/mock-test", label: "Mock test library", icon: Library },
    {
      href: "/revision",
      label: "Instacue revision",
      icon: RotateCcw,
    },
    { href: "/play", label: "Play arena", icon: Gamepad2 },
  ];

  const progress: NavItem[] = [
    { href: "/performance", label: "Performance", icon: BarChart3 },
    { href: EXPLORE_APP_PATH, label: "Unit maps", icon: Map },
    {
      href: "/edufund",
      label: "EduFund",
      icon: Heart,
      badge: edufundBadge,
      badgeTitle: edufundBadgeTitle,
    },
  ];

  const streakLabel = !profile?.id
    ? "—"
    : streakReady
      ? `${streakDays} day${streakDays === 1 ? "" : "s"}`
      : "…";

  return (
    <aside
      data-pinned={pinned ? "true" : "false"}
      data-sidebar="dashboard"
      className={cn(
        // v3 reference: collapsed = 52px (--sw), hover/expanded = 192px.
        // - Default: 52px icon rail (width from .eb-sidebar in globals.css)
        // - Hover: expands to 192px via .eb-sidebar:hover (plain CSS, no
        //   Tailwind hover/JS state — this is exactly the v3 pattern and
        //   bypasses any group-hover/group-focus issues).
        // - When pinned: stays at 192px via .eb-sidebar[data-pinned="true"].
        // Pin state is still settable via `localStorage` / `data-pinned` so
        // the rail can be pinned open across reloads, but there is no
        // visible toggle in the sidebar itself — pure hover-expand.
        "eb-sidebar sticky top-2 hidden h-[calc(100vh-1rem)] shrink-0 flex-col overflow-hidden border-r border-border/50 bg-card/30 lg:flex"
      )}
      aria-label="Dashboard navigation"
      aria-expanded={pinned}
    >
      <nav
        className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pt-1"
        aria-label="Dashboard navigation"
      >
        <Section title="Learning">{learning.map((item) => (
            <NavRow key={item.href} item={item} active={isActivePath(pathname, item.href)} />
          ))}</Section>

        <div
          className={cn("h-px bg-border/60", pinned ? "mx-3.5" : "mx-auto w-6")}
          aria-hidden
        />

        <Section title="Progress">{progress.map((item) => (
            <NavRow key={item.href} item={item} active={isActivePath(pathname, item.href)} />
          ))}</Section>

        <div className="mt-auto px-3.5 pb-3">
          <div className="eb-sidebar-foot rounded-lg border border-border/60 bg-muted/20 p-2.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Study streak
            </p>
            <p className="mt-1 flex items-baseline gap-1 text-[13px] font-extrabold tabular-nums text-foreground">
              <span aria-hidden>🔥</span>
              {streakLabel}
            </p>
            <p className="mt-1.5 border-t border-border/50 pt-1.5 text-[10.5px] text-muted-foreground">
              RDM{" "}
              <span className="font-bold tabular-nums text-foreground">
                {rdm.toLocaleString("en-IN")}
              </span>
            </p>
          </div>
        </div>
      </nav>
    </aside>
  );
}
