"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import type { useStreakTimer } from "@/hooks/useStreakTimer";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { EXPLORE_APP_PATH } from "@/components/AppLayout";
import { cn } from "@/lib/utils";

type DashboardLayoutProps = {
  children: ReactNode;
  streakTimer?: ReturnType<typeof useStreakTimer>;
};

const MOBILE_LINKS = [
  { href: "/home", label: "Home" },
  { href: "/performance", label: "Performance" },
  { href: "/magic-wall", label: "Feed" },
  { href: "/mock", label: "Mocks" },
  { href: EXPLORE_APP_PATH, label: "Maps" },
];

export default function DashboardLayout({ children, streakTimer }: DashboardLayoutProps) {
  const pathname = usePathname();
  return (
    <AppLayout streakTimer={streakTimer} wideMain>
      <div className="flex min-h-0 w-full flex-1 flex-col gap-0 lg:flex-row lg:gap-6">
        <div className="border-b border-border/60 bg-card/50 px-2 py-2 lg:hidden">
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
            {MOBILE_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold",
                  pathname === l.href || (l.href === EXPLORE_APP_PATH && pathname.startsWith("/explore-1"))
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/70 text-muted-foreground"
                )}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <DashboardSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </AppLayout>
  );
}
