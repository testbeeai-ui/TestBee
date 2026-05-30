"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

interface SidebarItem {
  label: string;
  icon: LucideIcon;
  href: string;
}

interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

const sections: SidebarSection[] = [
  {
    title: "SOCIAL",
    items: [
      { label: "Feed", icon: Newspaper, href: "/news-blog" },
      { label: "Trending", icon: TrendingUp, href: "/explore-1#community-feed" },
      { label: "Saved", icon: Bookmark, href: "/doubts?tab=saved" },
      { label: "My Network", icon: Users, href: "/refer-earn?tab=learning_buddy" },
    ],
  },
  {
    title: "PREP + MOCK",
    items: [
      { label: "Classes", icon: GraduationCap, href: "/classrooms" },
      { label: "Calendar", icon: CalendarDays, href: "#calendar" },
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

export default function PrepMockSidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden lg:flex flex-col gap-6 w-52 shrink-0">
        <div className="sticky top-24 space-y-5">
          {sections.map((section) => (
            <div key={section.title}>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 px-2">
                {section.title}
              </h4>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isAnchor = item.href.startsWith("#");
                  const isActive = !isAnchor && pathname === item.href;
                  const cls = `flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "text-primary bg-primary/10 font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60 font-medium"
                  }`;
                  return (
                    <li key={item.label}>
                      {isAnchor ? (
                        <a href={item.href} className={cls}>
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          {item.label}
                        </a>
                      ) : (
                        <Link href={item.href} className={cls}>
                          <Icon className="w-3.5 h-3.5 shrink-0" />
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
