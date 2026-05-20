"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  Award,
  BookOpen,
  Clock,
  ClipboardList,
  FileQuestion,
  GraduationCap,
  Lightbulb,
  ListChecks,
  ListOrdered,
  Search,
  ShieldCheck,
  Target,
} from "lucide-react";
import type { MockPaper, PastPaper, Subject } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { mockPaperTypeLabel, type LibraryCategoryFilter } from "@/lib/mock/mockPapersCatalog";
import {
  QUICK_DURATIONS,
  subjectEmojis,
  SUBJECT_LABELS,
} from "@/components/prep-mock/constants";
import McqChapterBrowser from "@/components/prep-mock/library/McqChapterBrowser";
import type { LibraryCollectionTab, PaperSource } from "@/components/prep-mock/types";

export type MockTestLibraryViewProps = {
  onBack: () => void;
  /** CBSE chapter MCQ browser — admins only. */
  isAdminUser: boolean;
  libraryCollectionTab: LibraryCollectionTab;
  setLibraryCollectionTab: (tab: LibraryCollectionTab) => void;
  mockLibraryCategory: LibraryCategoryFilter;
  setMockLibraryCategory: (cat: LibraryCategoryFilter) => void;
  duration: number;
  setDuration: (d: number) => void;
  subjects: Subject[];
  selectedSubject: Subject | null;
  effectiveSubject: Subject;
  setSelectedSubject: (s: Subject) => void;
  startQuickTest: () => void;
  librarySearch: string;
  setLibrarySearch: (v: string) => void;
  librarySubjectFilter: "all" | Subject;
  setLibrarySubjectFilter: (v: "all" | Subject) => void;
  filteredPastCatalogPapers: PastPaper[];
  filteredMockCatalogPapers: MockPaper[];
  pastPapersByClassLevel: PastPaper[];
  mockPapersByClassLevel: MockPaper[];
  catalogLoading: boolean;
  catalogError: string | null;
  openNtaInstructionsForPaper: (
    paper: MockPaper | PastPaper,
    source: PaperSource,
    backView?: "landing" | "setup"
  ) => void;
};

const LIBRARY_TABS: { id: LibraryCollectionTab; label: string; adminOnly?: boolean }[] = [
  { id: "past", label: "Past papers" },
  { id: "mock", label: "Mock papers" },
  { id: "quick", label: "Quick mock" },
  { id: "mcq", label: "MCQ's", adminOnly: true },
];

export default function MockTestLibraryView({
  onBack,
  isAdminUser,
  libraryCollectionTab,
  setLibraryCollectionTab,
  mockLibraryCategory,
  setMockLibraryCategory,
  duration,
  setDuration,
  subjects,
  selectedSubject,
  effectiveSubject,
  setSelectedSubject,
  startQuickTest,
  librarySearch,
  setLibrarySearch,
  librarySubjectFilter,
  setLibrarySubjectFilter,
  filteredPastCatalogPapers,
  filteredMockCatalogPapers,
  pastPapersByClassLevel,
  mockPapersByClassLevel,
  catalogLoading,
  catalogError,
  openNtaInstructionsForPaper,
}: MockTestLibraryViewProps) {
  const visibleTabs = LIBRARY_TABS.filter((tab) => !tab.adminOnly || isAdminUser);

  return (
    <motion.div
      key="setup"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="mx-auto max-w-6xl space-y-6"
    >
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-2 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Prep + Mock
              </button>

              <div className="rounded-2xl border border-border bg-card/80 px-4 py-6 shadow-sm sm:px-8">
                <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
                  <div className="flex gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
                      <GraduationCap className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Institute-style mock portal
                      </p>
                      <h1 className="edu-page-title mt-1 text-2xl md:text-3xl">
                        Mock test library
                      </h1>
                      <p className="edu-page-desc mt-1 max-w-2xl text-sm md:text-base">
                        Browse published papers from the institute bank (Supabase) or start a timed
                        quick mock from the adaptive pool.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                    <span>Timer · flagged review · submit when ready</span>
                  </div>
                </div>

                <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
                  {visibleTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setLibraryCollectionTab(tab.id);
                        if (tab.id !== "mock") setMockLibraryCategory("all");
                      }}
                      className={cn(
                        "shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-all sm:text-sm",
                        libraryCollectionTab === tab.id
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {libraryCollectionTab === "quick" ? (
                  <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
                    <div className="edu-card space-y-6 rounded-2xl p-6">
                      <h2 className="font-display flex items-center gap-2 text-lg font-bold text-foreground">
                        <Clock className="h-5 w-5 text-primary" />
                        Quick mock (adaptive pool)
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Same engine as before: mixed questions from your syllabus level, timed like
                        exam day.
                      </p>
                      <div>
                        <h3 className="mb-3 text-sm font-bold text-foreground">Duration</h3>
                        <div className="flex flex-wrap gap-3">
                          {QUICK_DURATIONS.map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setDuration(d)}
                              className={cn(
                                "min-w-25 flex-1 rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all",
                                duration === d
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                              )}
                            >
                              {d} min
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          ~{Math.ceil(duration / 2.5)} questions · ~2–3 min per question
                        </p>
                      </div>
                      <div>
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                          <BookOpen className="h-4 w-4 text-primary" />
                          Subject focus
                        </h3>
                        <div className="flex flex-wrap gap-3">
                          {subjects.map((subj) => (
                            <button
                              key={subj}
                              type="button"
                              onClick={() => setSelectedSubject(subj)}
                              className={cn(
                                "flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-bold transition-all",
                                effectiveSubject === subj
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                              )}
                            >
                              <span>{subjectEmojis[subj]}</span>
                              <span>{SUBJECT_LABELS[subj]}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="text-center sm:text-left">
                        <Button
                          size="lg"
                          className="edu-btn-primary w-full rounded-xl px-6 py-4 text-base font-bold sm:w-auto sm:px-10 sm:py-6 sm:text-lg"
                          onClick={startQuickTest}
                        >
                          <ClipboardList className="mr-2 h-5 w-5" />
                          Start mock test
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="edu-card rounded-2xl border border-primary/20 bg-primary/5 p-5">
                        <Target className="mb-2 h-8 w-8 text-primary" />
                        <h4 className="mb-1 font-bold text-foreground">Stamina</h4>
                        <p className="text-sm text-muted-foreground">
                          Long sits train focus for boards and entrances.
                        </p>
                      </div>
                      <div className="edu-card rounded-2xl border border-border p-5">
                        <Lightbulb className="mb-2 h-8 w-8 text-primary" />
                        <h4 className="mb-1 font-bold text-foreground">Strategy</h4>
                        <p className="text-sm text-muted-foreground">
                          Flag hard items; review after submit.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : libraryCollectionTab === "mcq" && isAdminUser ? (
                  <McqChapterBrowser />
                ) : (
                  <div className="mt-8 space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="relative max-w-md flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={librarySearch}
                          onChange={(e) => setLibrarySearch(e.target.value)}
                          placeholder="Search by paper name or tag…"
                          className="h-11 rounded-xl border-border pl-10"
                          aria-label="Search mock papers"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Subject
                        </span>
                        {(["all", ...subjects] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setLibrarySubjectFilter(s)}
                            className={cn(
                              "rounded-lg border px-3 py-1.5 text-xs font-bold transition-all",
                              librarySubjectFilter === s
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"
                            )}
                          >
                            {s === "all" ? "All" : subjectEmojis[s]}
                            {s !== "all" ? <span className="ml-1 capitalize">{s}</span> : null}
                          </button>
                        ))}
                      </div>
                    </div>

                    {libraryCollectionTab === "mock" ? (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {(
                          [
                            { id: "all" as const, label: "All mock papers" },
                            { id: "ncert" as const, label: "NCERT Exemplar" },
                            { id: "chapter" as const, label: "Chapter-wise" },
                            { id: "full" as const, label: "Full syllabus" },
                            { id: "mock" as const, label: "Mock paper" },
                          ] satisfies { id: LibraryCategoryFilter; label: string }[]
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setMockLibraryCategory(tab.id)}
                            className={cn(
                              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-all",
                              mockLibraryCategory === tab.id
                                ? "border-primary bg-primary/15 text-primary"
                                : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                            )}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <p className="text-xs text-muted-foreground">
                      Showing{" "}
                      <span className="font-semibold text-foreground">
                        {libraryCollectionTab === "past"
                          ? filteredPastCatalogPapers.length
                          : filteredMockCatalogPapers.length}
                      </span>{" "}
                      paper
                      {(libraryCollectionTab === "past"
                        ? filteredPastCatalogPapers.length
                        : filteredMockCatalogPapers.length) === 1
                        ? ""
                        : "s"}{" "}
                      in this view
                      {catalogLoading ? " · loading…" : ""}.
                    </p>

                    {catalogError ? (
                      <div className="edu-card rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center text-sm text-destructive">
                        {catalogError}
                      </div>
                    ) : catalogLoading ? (
                      <div className="edu-card rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                        Loading mock papers…
                      </div>
                    ) : (libraryCollectionTab === "past"
                        ? filteredPastCatalogPapers.length
                        : filteredMockCatalogPapers.length) === 0 ? (
                      <div className="edu-card rounded-2xl border border-dashed border-border p-12 text-center">
                        <ListOrdered className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                        <p className="font-semibold text-foreground">
                          {(libraryCollectionTab === "past"
                            ? pastPapersByClassLevel.length
                            : mockPapersByClassLevel.length) === 0
                            ? "No papers published for your class yet"
                            : "No papers match your filters"}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {(libraryCollectionTab === "past"
                            ? pastPapersByClassLevel.length
                            : mockPapersByClassLevel.length) === 0
                            ? "Ask your admin to publish mock papers or run the seed import."
                            : "Try another subject or clear the search."}
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {(libraryCollectionTab === "past"
                          ? filteredPastCatalogPapers
                          : filteredMockCatalogPapers
                        ).map((paper) => (
                          <div
                            key={paper.id}
                            className="edu-card flex flex-col rounded-2xl border border-border p-5 transition-shadow hover:shadow-md"
                          >
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-semibold uppercase tracking-wide"
                              >
                                {libraryCollectionTab === "past"
                                  ? "Past Paper"
                                  : mockPaperTypeLabel((paper as MockPaper).type)}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {paper.difficulty}
                              </Badge>
                              <span className="text-[10px] font-medium text-muted-foreground">
                                Class {paper.classLevel}
                              </span>
                            </div>
                            <h3 className="line-clamp-2 min-h-11 text-base font-bold leading-snug text-foreground">
                              {paper.title}
                            </h3>
                            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
                              <div className="rounded-lg bg-muted/50 px-2 py-2">
                                <FileQuestion className="mx-auto mb-1 h-4 w-4 text-primary" />
                                <span className="font-bold tabular-nums text-foreground">
                                  {paper.questionsCount}
                                </span>
                                <span className="block text-muted-foreground">Qs</span>
                              </div>
                              <div className="rounded-lg bg-muted/50 px-2 py-2">
                                <Clock className="mx-auto mb-1 h-4 w-4 text-primary" />
                                <span className="font-bold tabular-nums text-foreground">
                                  {paper.durationMinutes}
                                </span>
                                <span className="block text-muted-foreground">Min</span>
                              </div>
                              <div className="rounded-lg bg-muted/50 px-2 py-2">
                                <Award className="mx-auto mb-1 h-4 w-4 text-primary" />
                                <span className="font-bold tabular-nums text-foreground">
                                  {paper.totalMarks}
                                </span>
                                <span className="block text-muted-foreground">Marks</span>
                              </div>
                            </div>
                            <p className="mt-3 line-clamp-1 text-xs text-muted-foreground">
                              {paper.tags.length > 0 ? `${paper.tags.join(" · ")} · ` : null}
                              <span className="capitalize text-foreground/80">
                                {(paper.subjectsCovered ?? [paper.subject]).join(", ")}
                              </span>
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="flex-1 rounded-xl"
                                onClick={() =>
                                  openNtaInstructionsForPaper(
                                    paper,
                                    libraryCollectionTab === "past" ? "past" : "mock"
                                  )
                                }
                              >
                                Instructions
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="edu-btn-primary flex-1 rounded-xl font-bold"
                                onClick={() =>
                                  openNtaInstructionsForPaper(
                                    paper,
                                    libraryCollectionTab === "past" ? "past" : "mock"
                                  )
                                }
                              >
                                Start exam
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
    </motion.div>
  );
}

