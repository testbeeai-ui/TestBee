"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, BookOpen, ClipboardList, Eye, Loader2, Search } from "lucide-react";
import type { Subject } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  MCQ_CHAPTERS,
  SUBJECT_LABELS,
  subjectEmojis,
  type McqChapter,
} from "@/components/prep-mock/constants";
import { fetchCbseChapterMcqs } from "@/lib/mock/fetchCbseChapterMcqs";
import type { Question } from "@/types";
import McqChapterPreview from "@/components/prep-mock/library/McqChapterPreview";
import CbseChapterQuizSession, {
  type CbseChapterQuizResult,
} from "@/components/prep-mock/library/CbseChapterQuizSession";
import { clearCbseMcqOnboardingFlow } from "@/lib/onboarding/cbseMcqOnboardingFlow";
import { maybeMarkPrepMcqOnboardingFromQuizStart } from "@/lib/subscription/freeTrialClient";

const MCQ_CLASSES = [11, 12] as const;
const MCQ_SUBJECTS: Subject[] = ["physics", "chemistry", "math"];

const SUBJECT_RING: Record<Subject, string> = {
  physics: "ring-primary/40 border-primary/30",
  chemistry: "ring-emerald-500/30 border-emerald-500/25",
  math: "ring-orange-500/30 border-orange-500/25",
};

type McqView = "chapters" | "preview" | "quiz";

type ActiveChapter = {
  chapter: McqChapter;
  paperId: string;
  questions: Question[];
};

export default function McqChapterBrowser() {
  const { session } = useAuth();
  const [selectedClass, setSelectedClass] = useState<11 | 12>(11);
  const [selectedSubject, setSelectedSubject] = useState<Subject>("physics");
  const [chapterSearch, setChapterSearch] = useState("");
  const [view, setView] = useState<McqView>("chapters");

  const [activeChapter, setActiveChapter] = useState<ActiveChapter | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingChapterId, setLoadingChapterId] = useState<string | null>(null);

  const chapters = MCQ_CHAPTERS[selectedClass][selectedSubject];
  const filteredChapters = chapters.filter((ch) =>
    ch.name.toLowerCase().includes(chapterSearch.trim().toLowerCase())
  );

  const resetToChapters = useCallback(() => {
    setView("chapters");
    setActiveChapter(null);
    setLoadError(null);
    setLoadingChapterId(null);
  }, []);

  useEffect(() => {
    resetToChapters();
    setChapterSearch("");
  }, [selectedClass, selectedSubject, resetToChapters]);

  const loadChapterBundle = useCallback(
    async (ch: McqChapter): Promise<ActiveChapter | null> => {
      const bundle = await fetchCbseChapterMcqs(ch.id, selectedClass);
      if (!bundle || bundle.questions.length === 0) return null;
      return {
        chapter: ch,
        paperId: bundle.paperId,
        questions: bundle.questions,
      };
    },
    [selectedClass]
  );

  const openChapterMode = async (ch: McqChapter, mode: "preview" | "quiz") => {
    setLoadingChapterId(ch.id);
    setView(mode);
    setLoading(true);
    setLoadError(null);
    setActiveChapter({ chapter: ch, paperId: "", questions: [] });

    try {
      const loaded = await loadChapterBundle(ch);
      if (!loaded) {
        setLoadError(
          "No questions found for this chapter yet. Run the CBSE import or try another chapter."
        );
        setActiveChapter({ chapter: ch, paperId: "", questions: [] });
        return;
      }
      setActiveChapter(loaded);
      if (mode === "quiz" && loaded.questions.length > 0) {
        maybeMarkPrepMcqOnboardingFromQuizStart();
        clearCbseMcqOnboardingFlow();
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load chapter MCQs");
      setActiveChapter({ chapter: ch, paperId: "", questions: [] });
    } finally {
      setLoading(false);
      setLoadingChapterId(null);
    }
  };

  const handleQuizComplete = (_result: CbseChapterQuizResult) => {
    /* Recording handled inside CbseChapterQuizSession */
  };

  return (
    <div className="mt-8 min-w-0 w-full max-w-full space-y-5">
      {/* Class */}
      <div className="flex flex-wrap items-center gap-2">
        {MCQ_CLASSES.map((cls) => (
          <button
            key={cls}
            type="button"
            onClick={() => {
              setSelectedClass(cls);
              resetToChapters();
            }}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-bold transition-all",
              selectedClass === cls
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"
            )}
          >
            Class {cls}th
          </button>
        ))}
      </div>

      {/* Subject cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {MCQ_SUBJECTS.map((subj) => {
          const count = MCQ_CHAPTERS[selectedClass][subj].length;
          const active = selectedSubject === subj;
          return (
            <button
              key={subj}
              type="button"
              onClick={() => {
                setSelectedSubject(subj);
                resetToChapters();
              }}
              className={cn(
                "edu-card flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all ring-2 ring-offset-2 ring-offset-background",
                SUBJECT_RING[subj],
                active
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card/60 hover:border-primary/30"
              )}
            >
              <span className="text-2xl">{subjectEmojis[subj]}</span>
              <span className="font-bold text-foreground">{SUBJECT_LABELS[subj]}</span>
              <span className="text-xs text-muted-foreground">{count} chapters</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {view === "chapters" ? (
          <motion.div
            key="chapters"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className="edu-card overflow-hidden rounded-2xl border border-border">
              <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-2xl">{subjectEmojis[selectedSubject]}</span>
                  <div className="min-w-0">
                    <h2 className="font-bold text-foreground">{SUBJECT_LABELS[selectedSubject]}</h2>
                    <p className="text-xs text-muted-foreground">
                      Class {selectedClass} · {chapters.length} NCERT chapters ·{" "}
                      <span className="font-semibold text-foreground">Quiz</span> (one-by-one, then
                      Submit) or <span className="font-semibold text-foreground">Preview</span> to
                      read all MCQs
                    </p>
                  </div>
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={chapterSearch}
                    onChange={(e) => setChapterSearch(e.target.value)}
                    placeholder="Search chapter…"
                    className="h-10 rounded-xl border-border pl-9 text-sm"
                    aria-label="Search chapters"
                  />
                </div>
              </div>

              <div className="max-h-[min(52vh,520px)] overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
                {filteredChapters.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No chapter matches your search.
                  </p>
                ) : (
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {filteredChapters.map((ch, idx) => {
                      const rowLoading = loadingChapterId === ch.id;
                      return (
                        <li key={ch.id} className="min-w-0">
                          <div className="flex w-full min-w-0 flex-col gap-2 rounded-xl px-2 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-3">
                            <div className="flex min-w-0 flex-1 items-start gap-2 sm:items-center">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                                {idx + 1}
                              </span>
                              <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground [overflow-wrap:anywhere]">
                                {ch.name}
                              </span>
                            </div>
                            <div className="flex shrink-0 items-center justify-end gap-1.5 pl-10 sm:pl-0">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 shrink-0 rounded-lg"
                                disabled={loading && !rowLoading}
                                aria-label={`Preview MCQs for ${ch.name}`}
                                title="Preview"
                                onClick={() => void openChapterMode(ch, "preview")}
                              >
                                {rowLoading && loading ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="edu-btn-primary h-8 rounded-lg px-2.5 text-xs font-bold"
                                disabled={loading && !rowLoading}
                                onClick={() => void openChapterMode(ch, "quiz")}
                              >
                                {rowLoading && loading ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <ClipboardList className="mr-1 h-3.5 w-3.5" />
                                    Quiz
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {loadError && view === "chapters" && (
              <div className="edu-card rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
                {loadError}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="min-w-0 w-full max-w-full space-y-4"
          >
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-full shrink-0 gap-2 rounded-xl sm:w-auto"
                onClick={resetToChapters}
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span className="truncate">Back to chapters</span>
              </Button>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 text-xl">{subjectEmojis[selectedSubject]}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-snug text-foreground [overflow-wrap:anywhere]">
                    {activeChapter?.chapter.name ?? "Chapter"}
                  </p>
                  <p className="text-xs leading-snug text-muted-foreground">
                    {SUBJECT_LABELS[selectedSubject]} · Class {selectedClass}
                    {activeChapter && activeChapter.questions.length > 0
                      ? ` · ${activeChapter.questions.length} questions · ${view === "quiz" ? "Quiz" : "Preview"}`
                      : loading
                        ? " · Loading…"
                        : view === "quiz"
                          ? " · Quiz"
                          : " · Preview"}
                  </p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="edu-card flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading chapter MCQs…</p>
              </div>
            ) : loadError ? (
              <div className="edu-card rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center text-sm text-destructive">
                {loadError}
                <div className="mt-4">
                  <Button type="button" variant="outline" size="sm" onClick={resetToChapters}>
                    Back to chapters
                  </Button>
                </div>
              </div>
            ) : activeChapter && view === "preview" && activeChapter.questions.length > 0 ? (
              <div className="edu-card min-w-0 w-full max-w-full overflow-hidden rounded-2xl border border-border p-3 sm:p-4">
                <div className="mb-3 flex items-start gap-2 border-b border-border pb-3 text-[11px] leading-snug text-muted-foreground sm:text-xs">
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    Scroll to read every question — study mode (not timed).
                  </span>
                </div>
                <div className="min-h-0 max-h-[min(65dvh,680px)] w-full overflow-x-hidden overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
                  <McqChapterPreview questions={activeChapter.questions} />
                </div>
              </div>
            ) : activeChapter && view === "quiz" ? (
              <CbseChapterQuizSession
                questions={activeChapter.questions}
                chapterTitle={activeChapter.chapter.name}
                subject={selectedSubject}
                classLevel={selectedClass}
                paperId={activeChapter.paperId}
                paperSlug={activeChapter.chapter.id}
                accessToken={session?.access_token}
                onComplete={handleQuizComplete}
                onBack={resetToChapters}
              />
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
