"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { RotateCcw, ArrowRight } from "lucide-react";
import type { SavedRevisionCard } from "@/types";
import { incrementPrepCalendarDay, localDayISO } from "@/lib/dashboard/prepCalendarClient";
import { useUserStore } from "@/store/useUserStore";
import { cn } from "@/lib/utils";
import {
  REVISION_DASHBOARD_ROW_STYLES,
  REVISION_NAV_LINKS,
} from "@/lib/dashboard/revisionNavAccents";
import { fetchSavedQuestionRows } from "@/lib/saved/savedQuestionsService";

interface RevisionInstaCueSectionProps {
  cards: SavedRevisionCard[];
  accessToken?: string | null;
  userId?: string | null;
  onCalendarActivity?: () => void;
}

export default function RevisionInstaCueSection({
  cards,
  accessToken,
  userId,
  onCalendarActivity,
}: RevisionInstaCueSectionProps) {
  const user = useUserStore((s) => s.user);
  const linkedAuthUserId = useUserStore((s) => s.linkedAuthUserId);
  const storeMatchesSession = Boolean(userId && linkedAuthUserId === userId);
  const revisionLoggedRef = useRef(false);
  /** Same source as /revision Saved Questions tab (DB + local store merge). */
  const [savedQuestionIdsFromDb, setSavedQuestionIdsFromDb] = useState<string[]>([]);

  const savedQuestionsStoreKey = useMemo(
    () => (user?.savedQuestions ?? []).slice().sort().join("\0"),
    [user?.savedQuestions]
  );

  useEffect(() => {
    if (!userId) {
      startTransition(() => {
        setSavedQuestionIdsFromDb([]);
      });
      return;
    }
    let cancelled = false;
    void fetchSavedQuestionRows(userId)
      .then((rows) => {
        if (!cancelled) setSavedQuestionIdsFromDb(rows.map((r) => r.question_id));
      })
      .catch(() => {
        if (!cancelled) setSavedQuestionIdsFromDb([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, savedQuestionsStoreKey]);

  const navItems = useMemo(() => {
    const savedIds = storeMatchesSession ? (user?.savedQuestions ?? []) : [];
    const savedQ = new Set([...savedQuestionIdsFromDb, ...savedIds]).size;
    const bits = storeMatchesSession ? (user?.savedBits?.length ?? 0) : 0;
    const formulas = storeMatchesSession ? (user?.savedFormulas?.length ?? 0) : 0;
    const instacue = storeMatchesSession ? (user?.savedRevisionCards?.length ?? cards.length) : 0;
    const units = storeMatchesSession ? (user?.savedRevisionUnits?.length ?? 0) : 0;
    const community = storeMatchesSession ? (user?.savedCommunityPosts?.length ?? 0) : 0;
    const countById: Record<string, number> = {
      instacue,
      units,
      saved: bits + formulas,
      community,
      questions: savedQ,
    };
    return REVISION_NAV_LINKS.map((item) => ({
      ...item,
      count: countById[item.id] ?? 0,
    }));
  }, [user, cards.length, savedQuestionIdsFromDb, storeMatchesSession]);

  useEffect(() => {
    if (cards.length === 0) {
      revisionLoggedRef.current = false;
      return;
    }
    if (!userId || revisionLoggedRef.current) return;
    const day = localDayISO();
    const k = `prep_cal_revision_${userId}_${day}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(k)) return;
    revisionLoggedRef.current = true;
    void incrementPrepCalendarDay(accessToken ?? undefined, "revision", day).then((ok) => {
      if (ok && typeof window !== "undefined") sessionStorage.setItem(k, "1");
      if (ok) onCalendarActivity?.();
    });
  }, [userId, cards.length, accessToken, onCalendarActivity]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display font-bold text-foreground text-sm tracking-tight flex items-center gap-2 min-w-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/25">
            <RotateCcw className="w-4 h-4 text-primary shrink-0" />
          </span>
          Revision
        </h3>
        <Link
          href="/revision"
          className="group text-xs font-bold text-primary flex items-center gap-1 shrink-0 rounded-full px-2 py-1 transition-colors hover:bg-primary/10"
        >
          View all{" "}
          <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card/60 to-card/30 p-3 shadow-inner shadow-black/20">
        <nav className="flex flex-col gap-2.5" aria-label="Revision sections">
          {navItems.map((item, idx) => {
            const href = `/revision?tab=${item.id}`;
            const row = REVISION_DASHBOARD_ROW_STYLES[idx % REVISION_DASHBOARD_ROW_STYLES.length];
            return (
              <Link
                key={item.id}
                href={href}
                className={cn(
                  "group flex w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left text-sm font-semibold text-foreground shadow-sm transition-all duration-200",
                  row.border,
                  row.surface,
                  row.hover,
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
              >
                <span className="min-w-0 truncate tracking-tight">{item.label}</span>
                <span
                  className={cn(
                    "flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-full px-2.5 text-xs font-extrabold tabular-nums",
                    row.badge
                  )}
                >
                  {item.count}
                </span>
              </Link>
            );
          })}
        </nav>

        <Link
          href="/revision"
          className="mt-3 block text-center text-[11px] font-medium text-muted-foreground transition-colors hover:text-violet-300"
        >
          Go to &quot;Revision Section&quot;
        </Link>
      </div>
    </section>
  );
}
