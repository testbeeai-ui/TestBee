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

export interface CommunityWallNavItem {
  label: string;
  icon: LucideIcon;
  href: string;
}

export interface CommunityWallNavSection {
  title: string;
  items: CommunityWallNavItem[];
}

export const COMMUNITY_WALL_NAV_SECTIONS: CommunityWallNavSection[] = [
  {
    title: "SOCIAL",
    items: [
      { label: "Feed", icon: Newspaper, href: "/explore/community" },
      { label: "Trending", icon: TrendingUp, href: "/explore/community?sort=trending" },
      { label: "Saved", icon: Bookmark, href: "/revision" },
      { label: "My Network", icon: Users, href: "/refer-earn?tab=learning_buddy" },
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
      { label: "Edufundz", icon: Heart, href: "/edufund" },
      { label: "Profile", icon: User, href: "/profile" },
    ],
  },
];
