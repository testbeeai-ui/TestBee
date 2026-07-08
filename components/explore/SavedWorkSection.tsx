"use client";

import { useMemo, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { useAuth } from "@/hooks/useAuth";
import { useRecallNowMs } from "@/hooks/useRecallNowMs";
import { dedupeRevisionCards } from "@/lib/saved/revisionCardIdentity";
import { promoteDueTomorrowCards, isInRevisionStudyDeck } from "@/lib/saved/revisionCardRecall";
import { DEMO_REVISION_CARDS } from "@/lib/saved/demoRevisionCards";
import { fetchSavedQuestionRows } from "@/lib/saved/savedQuestionsService";
import { fetchSavedContent } from "@/lib/saved/savedContentService";
import { mergeAllSavedContent } from "@/lib/saved/mergeSavedContent";

export default function SavedWorkSection() {
  const { user: authUser } = useAuth();
  const user = useUserStore((s) => s.user);
  const recallNowMs = useRecallNowMs();

  const [savedQuestionRows, setSavedQuestionRows] = useState<{ question_id: string }[]>([]);

  // Fetch saved questions from Supabase if logged in
  useEffect(() => {
    if (!authUser?.id) {
      setSavedQuestionRows([]);
      return;
    }
    let cancelled = false;
    fetchSavedQuestionRows(authUser.id)
      .then((rows) => {
        if (!cancelled) setSavedQuestionRows(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

  // Fetch other saved items (bits, formulas) if logged in to sync the count
  useEffect(() => {
    if (!authUser?.id) return;
    fetchSavedContent({ types: ["savedBits", "savedFormulas", "savedRevisionCards", "savedRevisionUnits"] })
      .then(
        ({
          savedBits: bits,
          savedFormulas: formulas,
          savedRevisionCards: revisionCards,
          savedRevisionUnits: revisionUnits,
          savedCommunityPosts: communityPosts,
        }) => {
          const u = useUserStore.getState().user;
          if (!u) return;
          const merged = mergeAllSavedContent(
            u.savedBits ?? [],
            u.savedFormulas ?? [],
            u.savedRevisionCards ?? [],
            u.savedRevisionUnits ?? [],
            u.savedCommunityPosts ?? [],
            bits,
            formulas,
            revisionCards,
            revisionUnits,
            communityPosts ?? []
          );
          useUserStore
            .getState()
            .setSavedFromServer(
              merged.savedBits,
              merged.savedFormulas,
              merged.savedRevisionCards,
              merged.savedRevisionUnits,
              merged.savedCommunityPosts
            );
        }
      )
      .catch(() => {});
  }, [authUser?.id]);

  const savedQuestionsCount = useMemo(() => {
    const dbIds = savedQuestionRows.map((r) => r.question_id);
    return new Set([...dbIds, ...(user?.savedQuestions ?? [])]).size;
  }, [savedQuestionRows, user?.savedQuestions]);

  const savedCards = dedupeRevisionCards(user?.savedRevisionCards ?? []);
  const signedIn = Boolean(authUser);
  const displayCards = signedIn ? savedCards : savedCards.length > 0 ? savedCards : DEMO_REVISION_CARDS;
  const instacueStudyCardsCount = useMemo(() => {
    const promoted = promoteDueTomorrowCards(displayCards, recallNowMs);
    return promoted.filter((c) => isInRevisionStudyDeck(c)).length;
  }, [displayCards, recallNowMs]);

  const savedRevisionUnitsCount = user?.savedRevisionUnits?.length ?? 0;
  const savedBitsStoreCount = user?.savedBits?.length ?? 0;
  const savedFormulasStoreCount = user?.savedFormulas?.length ?? 0;
  const savedTabBadgeCount = savedBitsStoreCount + savedFormulasStoreCount;

  const savedCommunityPostsCount = user?.savedCommunityPosts?.length ?? 0;

  const items = [
    {
      id: "instacue",
      label: "InstaCue Cards",
      count: instacueStudyCardsCount,
      color: "border-purple-500/30 hover:border-purple-500/50 bg-purple-500/8 text-purple-200",
      badgeColor: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
    },
    {
      id: "units",
      label: "Unit Revision",
      count: savedRevisionUnitsCount,
      color: "border-emerald-500/30 hover:border-emerald-500/50 bg-emerald-500/8 text-emerald-200",
      badgeColor: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    },
    {
      id: "saved",
      label: "Saved Quiz & Formulas",
      count: savedTabBadgeCount,
      color: "border-cyan-500/30 hover:border-cyan-500/50 bg-cyan-500/8 text-cyan-200",
      badgeColor: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30",
    },
    {
      id: "community",
      label: "Community Posts",
      count: savedCommunityPostsCount,
      color: "border-amber-500/30 hover:border-amber-500/50 bg-amber-500/8 text-amber-200",
      badgeColor: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    },
    {
      id: "questions",
      label: "Saved Questions",
      count: savedQuestionsCount,
      color: "border-rose-500/30 hover:border-rose-500/50 bg-rose-500/8 text-rose-200",
      badgeColor: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
    },
  ];

  return (
    <div className="flex h-full flex-col space-y-3 rounded-xl border border-border/50 bg-card/30 p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
          REVISION
        </span>
        <Link
          href="/revision"
          className="inline-flex items-center gap-1 text-xs font-bold text-blue-400 hover:underline"
        >
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <h3 className="text-base font-bold tracking-tight text-foreground">Your saved work</h3>

      <div className="space-y-1.5">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/revision?tab=${item.id}`}
            className={`flex items-center justify-between rounded-xl border px-3 py-2 text-[13px] font-semibold leading-snug transition-all hover:scale-[1.01] active:scale-[0.99] ${item.color}`}
          >
            <span>{item.label}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${item.badgeColor}`}>
              {item.count}
            </span>
          </Link>
        ))}
      </div>

      <div className="text-center pt-2.5 mt-3 border-t border-white/5">
        <Link
          href="/revision"
          className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors hover:underline"
        >
          Go to &quot;Revision Section&quot;
        </Link>
      </div>
    </div>
  );
}
