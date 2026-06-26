import {
  BookOpen,
  Coins,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Newspaper,
  Sparkles,
  User,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SLIDE_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  magic_wall: Wand2,
  lessons: BookOpen,
  prep_mock: GraduationCap,
  prep_classes: GraduationCap,
  prep_mcq: GraduationCap,
  gyan_plus: MessageSquare,
  earn_buddy: Users,
  earn_challenge: Sparkles,
  news_blog: Newspaper,
  edufund: Coins,
  profile: User,
  rdm_wallet: Coins,
};

type SiteTourSlideIconProps = {
  slideId: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASS = {
  sm: "h-3 w-3",
  md: "h-[18px] w-[18px]",
  lg: "h-[22px] w-[22px]",
} as const;

export function SiteTourSlideIcon({
  slideId,
  color,
  size = "md",
  className,
}: SiteTourSlideIconProps) {
  const Icon = SLIDE_ICONS[slideId] ?? Sparkles;
  return (
    <Icon
      className={cn(SIZE_CLASS[size], className)}
      style={color ? { color } : undefined}
      aria-hidden
      strokeWidth={2.25}
    />
  );
}
