"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
  ExternalLink,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  fetchMockLibraryHistory,
  filterHistoryByLibraryTab,
  type MockLibraryHistoryEntry,
  type MockLibraryHistoryKind,
} from "@/lib/mock/fetchMockLibraryHistory";
import { groupMockHistoryByPaper } from "@/lib/mock/enrichMockLibraryHistory";
import type { MockSubjectScore } from "@/lib/mock/mockTestAttemptTypes";
import { subjectEmojis, SUBJECT_LABELS } from "@/components/prep-mock/constants";
import type { LibraryCollectionTab } from "@/components/prep-mock/types";
import type { Subject } from "@/types";

const KIND_LABELS: Record<MockLibraryHistoryKind, string> = {
  past_paper: "Past paper",
  mock_paper: "Mock paper",
  quick_mock: "Quick mock",
  mcq_chapter: "CBSE chapter",
};

function formatRelative(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "—";
  const diff = Date.now() - ts;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function marksText(correct: number | null, total: number | null): string {
  if (correct != null && total != null && total > 0) {
    return `${correct}/${total}`;
  }
  return "—";
}

function scoreText(entry: MockLibraryHistoryEntry): string {
  return marksText(entry.correct, entry.total);
}

function bestAttemptInGroup(attempts: MockLibraryHistoryEntry[]): MockLibraryHistoryEntry | null {
  let best: MockLibraryHistoryEntry | null = null;
  let bestRatio = -1;
  for (const a of attempts) {
    if (a.correct == null || a.total == null || a.total <= 0) continue;
    const ratio = a.correct / a.total;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = a;
    }
  }
  return best;
}

const SUBJECT_ORDER: Subject[] = ["physics", "chemistry", "math"];
const ATTEMPTS_PER_PAGE = 5;

function DeltaChip({ entry }: { entry: MockLibraryHistoryEntry }) {
  const delta = entry.deltaCorrectVsPrevious;
  const index = entry.attemptIndexOnPaper;
  const count = entry.attemptCountOnPaper;

  if (count != null && count > 1 && delta == null && index === 1) {
    return <span className="shrink-0 text-[10px] text-muted-foreground">First</span>;
  }
  if (delta == null || delta === 0) {
    if (delta === 0 && count != null && count > 1) {
      return (
        <span className="shrink-0 text-[10px] font-medium text-muted-foreground">Same marks</span>
      );
    }
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-bold tabular-nums",
        delta > 0
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
      )}
    >
      {delta > 0 ? (
        <TrendingUp className="h-2.5 w-2.5" />
      ) : (
        <TrendingDown className="h-2.5 w-2.5" />
      )}
      {delta > 0 ? "+" : ""}
      {delta} marks
    </span>
  );
}

function SubjectMini({ scores }: { scores: MockSubjectScore[] }) {
  if (scores.length === 0) return null;
  const bySubject = new Map(scores.map((s) => [s.subject, s]));
  const ordered = SUBJECT_ORDER.map((subj) => bySubject.get(subj)).filter(
    (s): s is MockSubjectScore => s != null
  );
  const rest = scores.filter((s) => !SUBJECT_ORDER.includes(s.subject as Subject));

  return (
    <span className="flex min-w-0 flex-wrap gap-1.5">
      {[...ordered, ...rest].map((s) => (
        <span
          key={s.subject}
          className="inline-flex items-center gap-0.5 text-[10px] tabular-nums"
          title={SUBJECT_LABELS[s.subject as Subject] ?? s.subject}
        >
          <span className="opacity-80">{subjectEmojis[s.subject as Subject]}</span>
          <span className="font-semibold text-foreground">
            {s.correct}/{s.total}
          </span>
        </span>
      ))}
    </span>
  );
}

function PaperHistoryGroupCard({
  group,
  onOpenChange,
}: {
  group: ReturnType<typeof groupMockHistoryByPaper>[number];
  onOpenChange: (open: boolean) => void;
}) {
  const [page, setPage] = useState(0);
  const total = group.attempts.length;
  const totalPages = Math.max(1, Math.ceil(total / ATTEMPTS_PER_PAGE));
  const showPager = total > ATTEMPTS_PER_PAGE;

  useEffect(() => {
    setPage(0);
  }, [group.groupKey, total]);

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const visible = group.attempts.slice(
    page * ATTEMPTS_PER_PAGE,
    page * ATTEMPTS_PER_PAGE + ATTEMPTS_PER_PAGE
  );
  const rangeStart = page * ATTEMPTS_PER_PAGE + 1;
  const rangeEnd = Math.min((page + 1) * ATTEMPTS_PER_PAGE, total);
  const best = bestAttemptInGroup(group.attempts);
  const latest = group.attempts[0];
  const bestLabel = best && total > 1 ? ` · best ${marksText(best.correct, best.total)}` : "";

  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card/80">
      <div className="flex items-start gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {group.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px] font-bold">
              {KIND_LABELS[group.kind]}
            </Badge>
            <span className="text-[10px] font-medium text-muted-foreground">
              {total} attempt{total === 1 ? "" : "s"}
              {bestLabel}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold tabular-nums text-foreground">
            {latest ? scoreText(latest) : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">Latest</p>
        </div>
      </div>

      <ul className="divide-y divide-border/80 border-t border-border/80 bg-muted/10">
        {visible.map((entry) => (
          <AttemptRow key={entry.id} entry={entry} />
        ))}
      </ul>

      {showPager ? (
        <div className="flex items-center justify-between gap-2 border-t border-border/80 bg-muted/20 px-2 py-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-0.5 px-2 text-[10px] font-bold"
            disabled={page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Newer
          </Button>
          <span className="text-center text-[10px] font-medium tabular-nums text-muted-foreground">
            {rangeStart}–{rangeEnd} of {total}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-0.5 px-2 text-[10px] font-bold"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Older
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}

      {group.paperSlug ? (
        <div className="border-t border-border/80 px-3 py-1.5">
          <Link
            href={`/mock-test?paper=${encodeURIComponent(group.paperSlug)}`}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            onClick={() => onOpenChange(false)}
          >
            Open paper again
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      ) : null}
    </li>
  );
}

function AttemptRow({ entry }: { entry: MockLibraryHistoryEntry }) {
  const attemptNum = entry.attemptIndexOnPaper;
  return (
    <li className="flex items-center gap-2 px-3 py-1.5 text-xs">
      <span className="w-6 shrink-0 font-bold tabular-nums text-muted-foreground">
        {attemptNum != null ? `#${attemptNum}` : "·"}
      </span>
      <span className="w-12 shrink-0 font-bold tabular-nums text-foreground">
        {scoreText(entry)}
      </span>
      <span className="min-w-[3.5rem] shrink-0 text-muted-foreground">
        {formatRelative(entry.takenAt)}
      </span>
      <DeltaChip entry={entry} />
      <SubjectMini scores={entry.subjectScores} />
      {entry.rdmAwarded > 0 ? (
        <span className="ml-auto shrink-0 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
          +{entry.rdmAwarded}
        </span>
      ) : null}
    </li>
  );
}

export function MockLibraryHistorySheet({
  open,
  onOpenChange,
  userId,
  libraryCollectionTab,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  libraryCollectionTab: LibraryCollectionTab;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<MockLibraryHistoryEntry[]>([]);

  const load = useCallback(async () => {
    if (!userId) {
      setEntries([]);
      setError("Sign in to see your mock history.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchMockLibraryHistory(userId);
      setEntries(rows);
    } catch (e) {
      setEntries([]);
      setError(e instanceof Error ? e.message : "Could not load history");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const filtered = useMemo(() => {
    if (libraryCollectionTab === "quick") {
      return filterHistoryByLibraryTab(entries, "quick");
    }
    if (libraryCollectionTab === "mcq") {
      return filterHistoryByLibraryTab(entries, "mcq");
    }
    if (libraryCollectionTab === "past") {
      return filterHistoryByLibraryTab(entries, "past");
    }
    if (libraryCollectionTab === "mock") {
      return filterHistoryByLibraryTab(entries, "mock");
    }
    return entries;
  }, [entries, libraryCollectionTab]);

  const paperGroups = useMemo(() => groupMockHistoryByPaper(filtered), [filtered]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Your mock history
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          {!userId ? (
            <p className="text-sm text-muted-foreground">Sign in to view attempt history.</p>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading history…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : paperGroups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No attempts yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Finish a test to see scores here. Multiple tries on the same paper appear as compact
                rows under one title.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {paperGroups.map((group) => (
                <PaperHistoryGroupCard
                  key={group.groupKey}
                  group={group}
                  onOpenChange={onOpenChange}
                />
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
