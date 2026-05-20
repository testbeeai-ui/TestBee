"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Eye,
  Loader2,
  Search,
} from "lucide-react";
import type { Subject } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  MCQ_CHAPTERS,
  SUBJECT_LABELS,
  subjectEmojis,
  type McqChapter,
} from "@/components/prep-mock/constants";
import { fetchCbseChapterMcqs } from "@/lib/mock/fetchCbseChapterMcqs";
import type { Question } from "@/types";
import McqChapterPreview from "@/components/prep-mock/library/McqChapterPreview";

const MCQ_CLASSES = [11, 12] as const;
const MCQ_SUBJECTS: Subject[] = ["physics", "chemistry", "math"];

const SUBJECT_RING: Record<Subject, string> = {
  physics: "ring-primary/40 border-primary/30",
  chemistry: "ring-emerald-500/30 border-emerald-500/25",
  math: "ring-orange-500/30 border-orange-500/25",
};

type McqView = "chapters" | "preview";

export default function McqChapterBrowser() {
  const [selectedClass, setSelectedClass] = useState<11 | 12>(11);
  const [selectedSubject, setSelectedSubject] = useState<Subject>("physics");
  const [chapterSearch, setChapterSearch] = useState("");
  const [view, setView] = useState<McqView>("chapters");

  const [pendingChapter, setPendingChapter] = useState<McqChapter | null>(null);
  const [previewChapter, setPreviewChapter] = useState<McqChapter | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const chapters = MCQ_CHAPTERS[selectedClass][selectedSubject];
  const filteredChapters = chapters.filter((ch) =>
    ch.name.toLowerCase().includes(chapterSearch.trim().toLowerCase())
  );

  const resetPreview = useCallback(() => {
    setView("chapters");
    setPreviewChapter(null);
    setQuestions([]);
    setLoadError(null);
  }, []);

  useEffect(() => {
    resetPreview();
    setChapterSearch("");
  }, [selectedClass, selectedSubject, resetPreview]);

  const openPreviewDialog = (ch: McqChapter) => {
    setPendingChapter(ch);
  };

  const confirmPreview = async () => {
    const ch = pendingChapter;
    if (!ch) return;
    setPendingChapter(null);
    setPreviewChapter(ch);
    setView("preview");
    setLoading(true);
    setLoadError(null);
    setQuestions([]);

    try {
      const bundle = await fetchCbseChapterMcqs(ch.id, selectedClass);
      if (!bundle || bundle.questions.length === 0) {
        setLoadError(
          "No questions found for this chapter yet. Run the CBSE import or try another chapter."
        );
        setLoading(false);
        return;
      }
      setQuestions(bundle.questions);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load chapter MCQs");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 space-y-5">
      {/* Class */}
      <div className="flex flex-wrap items-center gap-2">
        {MCQ_CLASSES.map((cls) => (
          <button
            key={cls}
            type="button"
            onClick={() => {
              setSelectedClass(cls);
              resetPreview();
            }}
            className={cn(
              "rounded-full border px-5 py-2 text-sm font-bold transition-all",
              selectedClass === cls
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            Class {cls}th
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {view === "chapters" ? (
          <motion.div
            key="chapters"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-5"
          >
            {/* Subject — one active; only that subject's chapters show */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {MCQ_SUBJECTS.map((subj) => {
                const active = selectedSubject === subj;
                const count = MCQ_CHAPTERS[selectedClass][subj].length;
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => setSelectedSubject(subj)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-2xl border px-2 py-4 text-center transition-all sm:py-5",
                      active
                        ? cn("bg-primary/10 shadow-sm ring-2", SUBJECT_RING[subj])
                        : "border-border bg-muted/20 text-muted-foreground hover:border-primary/30 hover:bg-muted/40 hover:text-foreground"
                    )}
                  >
                    <span className="text-2xl">{subjectEmojis[subj]}</span>
                    <span className="text-xs font-bold sm:text-sm">{SUBJECT_LABELS[subj]}</span>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {count} chapters
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active subject panel */}
            <div
              className={cn(
                "edu-card overflow-hidden rounded-2xl border",
                SUBJECT_RING[selectedSubject]
              )}
            >
              <div className="flex flex-col gap-3 border-b border-border bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{subjectEmojis[selectedSubject]}</span>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      {SUBJECT_LABELS[selectedSubject]}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Class {selectedClass} · {chapters.length} NCERT chapters · tap a chapter to
                      preview all MCQs
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
                    {filteredChapters.map((ch, idx) => (
                      <li key={ch.id}>
                        <button
                          type="button"
                          onClick={() => openPreviewDialog(ch)}
                          className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-primary/10"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary">
                            {idx + 1}
                          </span>
                          <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                            {ch.name}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl gap-2"
                onClick={resetPreview}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to chapters
              </Button>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="text-xl">{subjectEmojis[selectedSubject]}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">
                    {previewChapter?.name ?? "Chapter"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {SUBJECT_LABELS[selectedSubject]} · Class {selectedClass}
                    {questions.length > 0 ? ` · ${questions.length} questions` : ""}
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
                  <Button type="button" variant="outline" size="sm" onClick={resetPreview}>
                    Back to chapters
                  </Button>
                </div>
              </div>
            ) : (
              <div className="edu-card rounded-2xl border border-border p-3 sm:p-4">
                <div className="mb-3 flex items-center gap-2 border-b border-border pb-3 text-xs text-muted-foreground">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span>
                    Scroll to read every question — study mode (not timed next/prev exam).
                  </span>
                </div>
                <div className="max-h-[min(68vh,720px)] overflow-y-auto pr-1">
                  <McqChapterPreview questions={questions} />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog
        open={pendingChapter !== null}
        onOpenChange={(open) => {
          if (!open) setPendingChapter(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Preview chapter MCQs?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Preview all MCQs for{" "}
              <span className="font-semibold text-foreground">{pendingChapter?.name}</span> in a
              scrollable read-only list (no exam timer or next/previous navigation).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction className="edu-btn-primary rounded-xl font-bold" onClick={confirmPreview}>
              Preview all MCQs
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
