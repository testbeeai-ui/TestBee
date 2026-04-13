import { GraduationCap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type ProfPiAvatarSize = "sm" | "md";

const SIZES: Record<ProfPiAvatarSize, { box: string; cap: string; badge: string; spark: string }> = {
  sm: {
    box: "h-7 w-7 min-h-7 min-w-7",
    cap: "h-[15px] w-[15px]",
    badge: "h-3.5 w-3.5 min-h-3.5 min-w-3.5",
    spark: "h-2 w-2",
  },
  md: {
    box: "h-9 w-9 min-h-9 min-w-9",
    cap: "h-[18px] w-[18px]",
    badge: "h-4 w-4 min-h-4 min-w-4",
    spark: "h-2.5 w-2.5",
  },
};

/**
 * Prof-Pi “AI professor” mark: graduation cap + sparkle badge (used instead of plain “AI” initials).
 */
export function ProfPiAvatar({
  className,
  size = "sm",
}: {
  className?: string;
  size?: ProfPiAvatarSize;
}) {
  const s = SIZES[size];
  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-md ring-2 ring-purple-300/45 dark:ring-purple-500/40",
        s.box,
        className
      )}
      title="Prof-Pi — AI tutor"
      aria-label="Prof-Pi AI tutor"
    >
      <GraduationCap className={cn(s.cap, "shrink-0 opacity-[0.98]")} strokeWidth={2.35} aria-hidden />
      <span
        className={cn(
          "pointer-events-none absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-amber-300 text-purple-950 shadow-sm ring-1 ring-amber-200/80",
          s.badge
        )}
        aria-hidden
      >
        <Sparkles className={cn(s.spark, "shrink-0")} strokeWidth={2.6} />
      </span>
    </div>
  );
}
