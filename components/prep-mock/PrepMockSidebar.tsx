'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
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
} from 'lucide-react';

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
    title: 'SOCIAL',
    items: [
      { label: 'Feed', icon: Newspaper, href: '#community-feed' },
      { label: 'Trending', icon: TrendingUp, href: '#trending-topics' },
      { label: 'Saved', icon: Bookmark, href: '/doubts?tab=saved' },
      { label: 'My Network', icon: Users, href: '/profile' },
    ],
  },
  {
    title: 'PREP + MOCK',
    items: [
      { label: 'Classes', icon: GraduationCap, href: '/classrooms' },
      { label: 'AI Calendar', icon: CalendarDays, href: '#calendar' },
      { label: 'Mock Tests', icon: ClipboardList, href: '#mock-tests' },
      { label: 'Revision', icon: RotateCcw, href: '/revision' },
    ],
  },
  {
    title: 'TOOLS',
    items: [
      { label: 'Gyan++', icon: HelpCircle, href: '/doubts' },
      { label: 'Play', icon: Crosshair, href: '/play' },
      { label: 'EduFund', icon: Heart, href: '/edufund' },
      { label: 'Profile', icon: User, href: '/profile' },
    ],
  },
];

const addOns = [
  { label: 'Testbee', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { label: 'DailyDose', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { label: 'MentaMill', color: 'bg-purple-50 text-purple-700 border-purple-200' },
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
                  const isAnchor = item.href.startsWith('#');
                  const isActive = !isAnchor && pathname === item.href;
                  const cls = `flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'text-primary bg-primary/10 font-bold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 font-medium'
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

          {/* Add-ons */}
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-2">
              Add-ons
            </h4>
            <div className="flex flex-wrap gap-1.5 px-1">
              {addOns.map((a) => (
                <span
                  key={a.label}
                  className={`text-xs font-bold px-2 py-0.5 rounded-full border ${a.color}`}
                >
                  {a.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile horizontal strip */}
      <div className="lg:hidden overflow-x-auto flex gap-2 pb-2 -mx-1 px-1 scrollbar-hide">
        {sections.flatMap((s) => s.items).map((item) => {
          const Icon = item.icon;
          const isAnchor = item.href.startsWith('#');
          const isActive = !isAnchor && pathname === item.href;
          const cls = `flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            isActive
              ? 'border-primary bg-primary/10 text-primary font-bold'
              : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/60'
          }`;
          return isAnchor ? (
            <a key={item.label} href={item.href} className={cls}>
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </a>
          ) : (
            <Link key={item.label} href={item.href} className={cls}>
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </>
  );
}
