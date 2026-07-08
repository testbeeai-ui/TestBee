"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins, Trophy, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchPrepCalendarMonth } from "@/lib/dashboard/prepCalendarClient";
import { DEFAULT_RDM_CONFIG, fetchRdmConfig } from "@/lib/rdm/rdmConfig";
import { cn } from "@/lib/utils";
import {
  COMMUNITY_WALL_RAIL_CONTAINER,
  COMMUNITY_WALL_RAIL_MAX_H,
  COMMUNITY_WALL_STICKY_TOP,
  WALL_RAIL_PAD,
  WALL_RAIL_ROW_GAP,
  WALL_RAIL_TEXT_BODY,
  WALL_RAIL_TEXT_CAPTION,
  WALL_RAIL_TEXT_TITLE,
  WALL_TEXT_BODY,
  WALL_TEXT_CAPTION,
  WALL_TEXT_WIDGET_TITLE,
} from "./communityWallLayout";

const WALL_LEADERBOARD = [
  { rank: 1, name: "Karthik Reddy", city: "Bengaluru", posts: 12, pts: 985, color: "bg-emerald-600" },
  { rank: 2, name: "Ananya Iyer", city: "Mysuru", posts: 9, pts: 942, color: "bg-blue-600" },
  { rank: 3, name: "Siddharth Rao", city: "Mangaluru", posts: 8, pts: 876, color: "bg-violet-600" },
  { rank: 4, name: "Meghana Gowda", city: "Hubli", posts: 7, pts: 812, color: "bg-amber-600" },
] as const;

const TRENDING_TOPICS_STATIC = [
  { rank: 1, name: "Superposition Principle", count: 43, subject: "Phys" as const },
  { rank: 2, name: "Factorial & Permutations", count: 31, subject: "Math" as const },
  { rank: 3, name: "Gibbs Free Energy", count: 28, subject: "Chem" as const },
  { rank: 4, name: "Nernst Equation", count: 24, subject: "Chem" as const },
] as const;

const SUBJECT_BADGE: Record<string, string> = {
  Phys: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  Math: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  Chem: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
};

function rankClass(rank: number): string {
  if (rank === 1) return "text-amber-400";
  if (rank === 2) return "text-slate-300";
  if (rank === 3) return "text-orange-400";
  return "text-muted-foreground";
}

export default function CommunityWallRightSidebar({
  layout = "rail",
}: {
  /** `stack` — below feed on viewports below lg; `rail` — sticky right column on lg+. */
  layout?: "rail" | "stack";
}) {
  const { user, session } = useAuth();
  const [streak, setStreak] = useState(0);
  const [totalActiveDays, setTotalActiveDays] = useState(0);
  const [rdmRewards, setRdmRewards] = useState({
    post: DEFAULT_RDM_CONFIG.gyan_post_rdm,
    upvote: 2,
    save: 3,
    thread: 10,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const now = new Date();
      const { summary } = await fetchPrepCalendarMonth(
        session?.access_token,
        now.getFullYear(),
        now.getMonth() + 1
      );
      if (cancelled) return;
      if (summary) {
        setStreak(summary.streak);
        setTotalActiveDays(summary.totalActiveDays);
      }
      const cfg = await fetchRdmConfig().catch(() => DEFAULT_RDM_CONFIG);
      if (cancelled) return;
      setRdmRewards({
        post: cfg.gyan_post_rdm ?? DEFAULT_RDM_CONFIG.gyan_post_rdm,
        upvote: 2,
        save: 3,
        thread: 10,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.access_token, user?.id]);

  const isStack = layout === "stack";
  const bodyText = isStack ? WALL_TEXT_BODY : WALL_RAIL_TEXT_BODY;
  const captionText = isStack ? WALL_TEXT_CAPTION : WALL_RAIL_TEXT_CAPTION;
  const titleText = isStack ? WALL_TEXT_WIDGET_TITLE : WALL_RAIL_TEXT_TITLE;
  const pad = isStack ? "px-2.5 py-2 sm:px-3 sm:py-2.5" : WALL_RAIL_PAD;
  const rowGap = isStack ? "gap-1.5 sm:gap-2" : WALL_RAIL_ROW_GAP;
  const cardRound = isStack
    ? "rounded-xl"
    : "rounded-lg @[12rem]/right-rail:rounded-xl @[16rem]/right-rail:rounded-2xl";

  const widgets = (
    <>
      <div
        className={cn(
          "overflow-hidden border border-border/70 bg-card dark:border-white/10",
          cardRound
        )}
      >
        <div
          className={cn(
            "flex items-center bg-gradient-to-br from-amber-950/35 to-card",
            pad,
            rowGap
          )}
        >
          <div
            className={cn(
              "flex shrink-0 flex-col items-center justify-center rounded-full border-2 border-amber-500",
              isStack
                ? "h-9 w-9 sm:h-10 sm:w-10"
                : "h-8 w-8 @[12rem]/right-rail:h-9 @[12rem]/right-rail:w-9 @[14rem]/right-rail:h-10 @[14rem]/right-rail:w-10 @[16rem]/right-rail:h-11 @[16rem]/right-rail:w-11"
            )}
          >
            <span
              className={cn(
                "font-bold leading-none text-amber-400",
                isStack ? "text-xs sm:text-sm" : "text-[10px] @[12rem]/right-rail:text-xs @[16rem]/right-rail:text-sm"
              )}
            >
              {streak || 0}
            </span>
            <span className={cn("font-medium text-amber-200", captionText)}>days</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn("text-amber-200", titleText)}>Keep posting daily!</p>
            <p className={cn("mt-0.5 text-muted-foreground", bodyText)}>
              {totalActiveDays} active days
              {isStack ? " · Post today to protect streak." : " · Post today."}
            </p>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "overflow-hidden border border-border/70 bg-card dark:border-white/10",
          cardRound
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-1 border-b border-border/70 dark:border-white/10",
            pad
          )}
        >
          <h3 className={cn("flex min-w-0 items-center gap-1 text-foreground", titleText)}>
            <Trophy
              className={cn(
                "shrink-0 text-amber-400",
                isStack ? "h-3 w-3 sm:h-3.5 sm:w-3.5" : "h-2.5 w-2.5 @[12rem]/right-rail:h-3 @[14rem]/right-rail:h-3.5 @[16rem]/right-rail:h-4"
              )}
              aria-hidden
            />
            <span className="truncate">Wall Leaderboard</span>
          </h3>
          <Link
            href="/refer-earn?tab=leaderboard"
            className={cn("shrink-0 font-medium text-emerald-400 hover:underline", captionText)}
          >
            View all
          </Link>
        </div>
        <div className={cn(pad, "pt-1.5")}>
          <p className={cn("mb-1 text-muted-foreground", captionText)}>Most helpful this week</p>
          {WALL_LEADERBOARD.map((row) => (
            <div
              key={row.rank}
              className={cn(
                "flex items-center border-b border-border/50 py-1 last:border-none dark:border-white/10 @[11rem]/right-rail:py-1.5",
                rowGap
              )}
            >
              <span
                className={cn(
                  "w-2.5 shrink-0 text-center font-bold @[11rem]/right-rail:w-3",
                  captionText,
                  rankClass(row.rank)
                )}
              >
                {row.rank}
              </span>
              <div
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
                  captionText,
                  isStack ? "h-5 w-5 sm:h-6 sm:w-6" : "h-4 w-4 @[12rem]/right-rail:h-5 @[12rem]/right-rail:w-5 @[14rem]/right-rail:h-6 @[14rem]/right-rail:w-6",
                  row.color
                )}
              >
                {row.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className={cn("truncate font-medium text-foreground", bodyText)}>{row.name}</p>
                <p className={cn("truncate text-muted-foreground", captionText)}>
                  {row.city} · {row.posts} posts
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 pl-0.5 text-right font-semibold tabular-nums text-emerald-400",
                  bodyText
                )}
              >
                {row.pts}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "overflow-hidden border border-border/70 bg-card dark:border-white/10",
          cardRound
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-1 border-b border-border/70 dark:border-white/10",
            pad
          )}
        >
          <h3 className={cn("flex min-w-0 items-center gap-1 text-foreground", titleText)}>
            <TrendingUp
              className={cn(
                "shrink-0 text-emerald-400",
                isStack ? "h-3 w-3 sm:h-3.5 sm:w-3.5" : "h-2.5 w-2.5 @[12rem]/right-rail:h-3 @[14rem]/right-rail:h-3.5 @[16rem]/right-rail:h-4"
              )}
              aria-hidden
            />
            <span className="truncate">Trending topics</span>
          </h3>
          <Link
            href="/explore-1"
            className={cn("shrink-0 font-medium text-emerald-400 hover:underline", captionText)}
          >
            See all
          </Link>
        </div>
        <div className={cn(pad, "pt-1.5")}>
          {TRENDING_TOPICS_STATIC.map((row) => (
            <div
              key={row.rank}
              className={cn(
                "flex items-center border-b border-border/50 py-1 last:border-none dark:border-white/10 @[11rem]/right-rail:py-1.5",
                rowGap
              )}
            >
              <span
                className={cn(
                  "w-2.5 shrink-0 text-center font-bold text-muted-foreground @[11rem]/right-rail:w-3",
                  captionText
                )}
              >
                {row.rank}
              </span>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className={cn("truncate font-medium text-foreground", bodyText)}>{row.name}</p>
                <p className={cn("truncate text-muted-foreground", captionText)}>
                  {row.count} posts today
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-1 py-px font-semibold leading-none",
                  captionText,
                  SUBJECT_BADGE[row.subject]
                )}
              >
                {row.subject}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "overflow-hidden border border-border/70 bg-card pb-1.5 dark:border-white/10 @[11rem]/right-rail:pb-2",
          cardRound
        )}
      >
        <div className={cn("border-b border-border/70 dark:border-white/10", pad)}>
          <h3 className={cn("flex min-w-0 items-center gap-1 text-foreground", titleText)}>
            <Coins
              className={cn(
                "shrink-0 text-amber-400",
                isStack ? "h-3 w-3 sm:h-3.5 sm:w-3.5" : "h-2.5 w-2.5 @[12rem]/right-rail:h-3 @[14rem]/right-rail:h-3.5 @[16rem]/right-rail:h-4"
              )}
              aria-hidden
            />
            <span className="truncate">Earn RDM by posting</span>
          </h3>
        </div>
        <div className={cn("space-y-1", pad, "pt-1.5", bodyText)}>
          {[
            { label: "Post a score or learning", pts: rdmRewards.post },
            { label: "Post gets liked", pts: rdmRewards.upvote },
            { label: "Post gets saved", pts: rdmRewards.save },
            { label: "Thread reply 5+ likes", pts: rdmRewards.thread },
          ].map((row) => (
            <div key={row.label} className={cn("flex items-center justify-between", rowGap)}>
              <span className="min-w-0 flex-1 truncate pr-1 text-muted-foreground">{row.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-amber-300">+{row.pts} RDM</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  if (isStack) {
    return (
      <aside className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:hidden" aria-label="Community widgets">
        {widgets}
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "group/right hidden w-full min-w-0 max-w-full shrink-0 lg:block",
        COMMUNITY_WALL_RAIL_CONTAINER
      )}
    >
      <div
        className={cn(
          "sticky w-full space-y-1.5 overflow-x-hidden overflow-y-hidden @[12rem]/right-rail:space-y-2 @[16rem]/right-rail:space-y-2.5",
          COMMUNITY_WALL_STICKY_TOP,
          COMMUNITY_WALL_RAIL_MAX_H,
          "transition-[overflow] duration-150",
          "group-hover/right:overflow-y-auto",
          "[scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.35)_transparent]",
          "group-hover/right:[scrollbar-color:rgba(148,163,184,0.5)_transparent]"
        )}
      >
        {widgets}
      </div>
    </aside>
  );
}
