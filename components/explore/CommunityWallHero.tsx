"use client";

import { useEffect, useState } from "react";
import { Coins, Flame, MessageCircle, Users, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_RDM_CONFIG, fetchRdmConfig } from "@/lib/rdm/rdmConfig";
import { cn } from "@/lib/utils";
import {
  WALL_TEXT_BODY,
  WALL_TEXT_CAPTION,
  WALL_TEXT_HERO,
} from "./communityWallLayout";

type HeroStats = {
  activeStudents: number | null;
  postsToday: number | null;
  postRdm: number;
  topStreak: number | null;
};

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function sevenDaysAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

export default function CommunityWallHero() {
  const [stats, setStats] = useState<HeroStats>({
    activeStudents: null,
    postsToday: null,
    postRdm: DEFAULT_RDM_CONFIG.gyan_post_rdm,
    topStreak: null,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const today = startOfTodayIso();
      const weekAgo = sevenDaysAgoIso();

      const [postsTodayRes, weekPostsRes, rdmConfig] = await Promise.all([
        supabase
          .from("lessons_raw_posts")
          .select("*", { count: "exact", head: true })
          .gte("created_at", today),
        supabase.from("lessons_raw_posts").select("user_id").gte("created_at", weekAgo),
        fetchRdmConfig().catch(() => DEFAULT_RDM_CONFIG),
      ]);

      const activeStudents = weekPostsRes.data
        ? new Set(weekPostsRes.data.map((r) => r.user_id)).size
        : null;

      if (cancelled) return;
      setStats({
        activeStudents,
        postsToday: postsTodayRes.count ?? null,
        postRdm: rdmConfig.gyan_post_rdm ?? DEFAULT_RDM_CONFIG.gyan_post_rdm,
        topStreak: 89,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fmt = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-IN"));

  return (
    <section className="relative overflow-hidden rounded-xl border border-border/70 bg-gradient-to-br from-emerald-950/35 via-violet-950/25 to-slate-900/90 px-3 py-2 dark:border-white/10 sm:px-3.5 sm:py-2.5 lg:py-2.5 xl:rounded-2xl xl:px-4 xl:py-3">
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-emerald-500/10 blur-2xl lg:h-24 lg:w-24"
        aria-hidden
      />
      <div className="absolute right-2 top-2 rounded-full bg-gradient-to-r from-violet-600/90 to-emerald-600/90 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white lg:text-[9px]">
        India&apos;s #1 Study Social
      </div>
      <div className="relative space-y-1 pr-[5.75rem] sm:pr-[6.5rem] lg:pr-24 xl:pr-28">
        <div
          className={cn(
            "flex items-center gap-1 font-bold uppercase tracking-[0.08em] text-emerald-400",
            WALL_TEXT_CAPTION
          )}
        >
          <Share2 className="h-3 w-3 xl:h-3.5 xl:w-3.5" aria-hidden />
          Community Wall
        </div>
        <h1 className={cn("font-bold leading-snug text-foreground", WALL_TEXT_HERO)}>
          Learn in public.{" "}
          <span className="text-emerald-400">Score together.</span>
        </h1>
        <p className={cn("max-w-xl leading-relaxed text-muted-foreground", WALL_TEXT_BODY)}>
          Share wins, setbacks, doubts and discoveries. Every post earns RDM and helps fellow
          aspirants.
        </p>
        <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4 sm:gap-2 lg:gap-2.5">
          {[
            {
              icon: Users,
              iconClass: "text-emerald-400",
              value: fmt(stats.activeStudents),
              valueClass: "text-emerald-200",
              label: "students active",
            },
            {
              icon: MessageCircle,
              iconClass: "text-violet-400",
              value: fmt(stats.postsToday),
              valueClass: "text-violet-200",
              label: "posts today",
            },
            {
              icon: Coins,
              iconClass: "text-amber-400",
              value: `+${stats.postRdm} RDM`,
              valueClass: "text-amber-200",
              label: "per post",
            },
            {
              icon: Flame,
              iconClass: "text-red-400",
              value: fmt(stats.topStreak),
              valueClass: "text-red-300",
              label: "day streak top",
            },
          ].map((pill) => {
            const Icon = pill.icon;
            return (
              <div
                key={pill.label}
                className="flex min-h-[2.75rem] w-full min-w-0 items-center gap-1.5 rounded-lg border border-border/50 bg-white/[0.03] px-2 py-1.5 dark:border-white/10 sm:min-h-[3rem] sm:gap-2 sm:px-2.5"
              >
                <Icon
                  className={cn("h-3.5 w-3.5 shrink-0 lg:h-4 lg:w-4", pill.iconClass)}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "truncate text-[10px] font-semibold leading-tight sm:text-[11px]",
                      pill.valueClass
                    )}
                  >
                    {pill.value}
                  </div>
                  <div className={cn("truncate leading-tight text-muted-foreground", WALL_TEXT_CAPTION)}>
                    {pill.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
