"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Newspaper,
  TrendingUp,
  Bookmark,
  Users,
  GraduationCap,
  CalendarDays,
  ClipboardList,
  RotateCcw,
  HelpCircle,
  Crosshair,
  Heart,
  User,
} from "lucide-react";

interface SidebarSection {
  title: string;
  items: { label: string; icon: LucideIcon; href: string }[];
}

const sections: SidebarSection[] = [
  {
    title: "SOCIAL",
    items: [
      { label: "Feed", icon: Newspaper, href: "#community-feed" },
      { label: "Trending", icon: TrendingUp, href: "#trending-topics" },
      { label: "Saved", icon: Bookmark, href: "/revision" },
      { label: "My Network", icon: Users, href: "/profile" },
    ],
  },
  {
    title: "PREP + MOCK",
    items: [
      { label: "Classes", icon: GraduationCap, href: "/classrooms" },
      { label: "Calendar", icon: CalendarDays, href: "/mock#calendar" },
      { label: "Mock Tests", icon: ClipboardList, href: "/mock-test" },
      { label: "Revision", icon: RotateCcw, href: "/revision" },
    ],
  },
  {
    title: "TOOLS",
    items: [
      { label: "Gyan++", icon: HelpCircle, href: "/doubts" },
      { label: "Play", icon: Crosshair, href: "/play" },
      { label: "EduFund", icon: Heart, href: "/edufund" },
      { label: "Profile", icon: User, href: "/profile" },
    ],
  },
];

export default function ExploreHubSidebar() {
  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden lg:flex flex-col gap-6 w-56 shrink-0">
        <div className="sticky top-24 space-y-6">
          {sections.map((section) => (
            <div key={section.title}>
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-2">
                {section.title}
              </h4>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isAnchor = item.href.startsWith("#");
                  const cls =
                    "flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors";
                  return (
                    <li key={item.label}>
                      {isAnchor ? (
                        <a href={item.href} className={cls}>
                          <Icon className="w-4 h-4 shrink-0" />
                          {item.label}
                        </a>
                      ) : (
                        <Link href={item.href} className={cls}>
                          <Icon className="w-4 h-4 shrink-0" />
                          {item.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* Mobile sidebar hidden — links accessible via hamburger menu or other navigation */}
    </>
  );
}
