"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Play } from "lucide-react";
import { CHAPTER_PYQ_SUBJECTS, findChapter } from "@/lib/chapter-pyq/catalog";
import { CHAPTER_PYQ_CACHE_VERSION } from "@/lib/chapter-pyq/cacheVersion";
import { fetchChapterPyqQuestions } from "@/lib/chapter-pyq/fetchPyqQuestions";
import type { ChapterPyqQuestion } from "@/lib/chapter-pyq/pyqQuestionMap";
import { buildPyqEvenPracticeSets, buildPyqYearMonthSets, secondsForSet, practiceSetSessionLabel, pyqYearSetListedCount } from "@/lib/chapter-pyq/pyqSets";
import { countByTier, filterByTier, type PyqTierFilter } from "@/lib/chapter-pyq/pyqTiers";
import ChapterPyqExamSession from "@/components/chapter-pyq/ChapterPyqExamSession";

type ChapterPyqPracticeViewProps = {
  subject: string;
  chapter: string;
};

export default function ChapterPyqPracticeView({
  subject,
  chapter,
}: ChapterPyqPracticeViewProps) {
  const entry = findChapter(subject, chapter);
  const [entries, setEntries] = useState<ChapterPyqQuestion[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tier, setTier] = useState<PyqTierFilter>("all");
  const [activeSetIndex, setActiveSetIndex] = useState<number | null>(null);
  const [sessionNonce, setSessionNonce] = useState(0);

  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    setEntries(null);
    setLoadError(null);
    void fetchChapterPyqQuestions(entry.slug, entry.subject)
      .then((bundle) => {
        if (!cancelled) setEntries(bundle?.questions ?? []);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setEntries([]);
        setLoadError(e instanceof Error ? e.message : "Could not load questions.");
      });
    return () => {
      cancelled = true;
    };
  }, [entry, CHAPTER_PYQ_CACHE_VERSION]);

  const filtered = useMemo(() => filterByTier(entries ?? [], tier), [entries, tier]);
  const sets = useMemo(
    () =>
      entry?.subject === "math"
        ? buildPyqYearMonthSets(filtered)
        : buildPyqEvenPracticeSets(filtered),
    [entry?.subject, filtered]
  );
  const counts = useMemo(() => countByTier(entries ?? []), [entries]);
  const listedQuestionCount = useMemo(
    () =>
      entry && entry.subject === "math"
        ? sets.reduce(
            (n, set) => n + pyqYearSetListedCount(entry.slug, set.label, set.items.length),
            0
          )
        : filtered.length,
    [entry?.slug, entry?.subject, filtered.length, sets]
  );

  if (!entry) {
    return (
      <section className="mx-auto w-full max-w-4xl space-y-5">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Chapter not found</h1>
        <Link href="/chapter-pyq" className="font-bold text-primary hover:underline">
          All chapters
        </Link>
      </section>
    );
  }

  const subjectLabel =
    CHAPTER_PYQ_SUBJECTS.find((item) => item.id === entry.subject)?.label ?? entry.subject;

  const activeSet = activeSetIndex !== null ? sets[activeSetIndex] : undefined;

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        href="/chapter-pyq"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#A5B4FC] hover:text-[#C7D2FE] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All chapters
      </Link>

      <div className="rounded-3xl border border-[#1F2436] bg-[#0E111A] p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-96 rounded-full bg-[#6366F1]/15 blur-[90px]"
        />

        <header className="relative space-y-2">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-[#6366F1]/30 bg-[#6366F1]/[0.12] px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[#A5B4FC]">
            {subjectLabel} · JEE Main
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#F8FAFC] sm:text-4xl">{entry.name}</h1>
          <p className="max-w-2xl text-sm text-[#94A3B8]">
            Sit a short NTA-style set. After submit you get the paper, your answer, and the key —
            not a skip list.
          </p>
        </header>

        {activeSet && activeSetIndex !== null ? (
          <div className="mt-8">
            <ChapterPyqExamSession
              key={`${activeSetIndex}-${sessionNonce}`}
              chapterName={entry.name}
              subjectLabel={subjectLabel}
              questions={activeSet.items}
              setLabel={practiceSetSessionLabel(activeSet.label, sets.length)}
              onExit={() => setActiveSetIndex(null)}
              onRetry={() => setSessionNonce((n) => n + 1)}
              onNextSet={
                activeSetIndex < sets.length - 1
                  ? () => {
                      setActiveSetIndex((i) => (i ?? 0) + 1);
                      setSessionNonce((n) => n + 1);
                    }
                  : undefined
              }
            />
          </div>
        ) : entries === null ? (
          <div className="mt-12 py-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#6366F1] border-t-transparent mb-3" />
            <p className="text-sm font-medium text-[#94A3B8]">Loading questions…</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="mt-8 space-y-2 rounded-2xl border border-dashed border-[#1F2436] bg-[#121624]/60 p-8 text-center">
            <p className="font-bold text-[#F8FAFC]">No questions yet</p>
            <p className="text-sm text-[#94A3B8]">
              {loadError ?? "Previous year questions for this chapter are still being prepared."}
            </p>
          </div>
        ) : (
          <div className="relative mt-8 space-y-4">
            <div>
              <div className="mb-3.5 flex items-baseline justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Select a Practice Set
                </p>
                <p className="text-xs sm:text-sm text-[#94A3B8]">
                  {listedQuestionCount} questions · {sets.length} {sets.length === 1 ? "set" : "sets"} ·
                  2 min / question
                </p>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                {sets.map((set, i) => {
                  const listedCount = pyqYearSetListedCount(entry.slug, set.label, set.items.length);
                  return (
                  <button
                    key={set.label}
                    type="button"
                    onClick={() => {
                      setSessionNonce((n) => n + 1);
                      setActiveSetIndex(i);
                    }}
                    className="group flex items-center justify-between rounded-2xl border border-[#1F2436] bg-[#121624] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2F3752] hover:bg-[#181E30] hover:shadow-lg cursor-pointer"
                  >
                    <div>
                      <span className="block text-base font-bold text-[#F8FAFC] group-hover:text-white">
                        {set.label}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-xs text-[#94A3B8]">
                        <Clock className="h-3.5 w-3.5 text-[#64748B]" />
                        {listedCount} questions · {Math.round(secondsForSet(listedCount) / 60)} min
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#6366F1]/30 bg-[#6366F1]/15 px-3 py-1.5 text-xs font-bold text-[#A5B4FC] transition-all duration-200 group-hover:border-[#6366F1] group-hover:bg-[#6366F1] group-hover:text-white group-hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                      <Play className="h-3 w-3 fill-current" />
                      Start
                    </span>
                  </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
