"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Play, Search, Sparkles, X } from "lucide-react";
import {
  CHAPTER_PYQ_SUBJECTS,
  chaptersForSubject,
  filterChapters,
  type ChapterPyqSubject,
  type ChapterPyqEntry,
} from "@/lib/chapter-pyq/catalog";
import { CHAPTER_PYQ_CACHE_VERSION } from "@/lib/chapter-pyq/cacheVersion";
import { fetchChapterPyqCounts, fetchChapterPyqQuestions } from "@/lib/chapter-pyq/fetchPyqQuestions";
import type { ChapterPyqQuestion } from "@/lib/chapter-pyq/pyqQuestionMap";
import { buildPyqEvenPracticeSets, buildPyqYearMonthSets, secondsForSet, practiceSetSessionLabel, pyqYearSetListedCount } from "@/lib/chapter-pyq/pyqSets";
import { countByTier, filterByTier, PYQ_TIER_CHIPS, type PyqTierFilter } from "@/lib/chapter-pyq/pyqTiers";
import ChapterPyqExamSession from "@/components/chapter-pyq/ChapterPyqExamSession";
import { cn } from "@/lib/utils";

type ChapterWeightage = "high" | "medium" | "normal";

type ChapterMeta = {
  category: string;
  weightage: ChapterWeightage;
  yearRange: string;
  defaultTotal: number;
};

const CHAPTER_METAS: Record<string, ChapterMeta> = {
  // === MATHEMATICS ===
  "application-of-derivatives": {
    category: "Calculus",
    weightage: "high",
    yearRange: "2019 – 2025",
    defaultTotal: 64,
  },
  "area-under-curves": {
    category: "Integral Calculus",
    weightage: "medium",
    yearRange: "2018 – 2025",
    defaultTotal: 38,
  },
  "basic-of-mathematics": {
    category: "Foundations",
    weightage: "normal",
    yearRange: "2019 – 2025",
    defaultTotal: 24,
  },
  "binomial-theorem": {
    category: "Algebra",
    weightage: "high",
    yearRange: "2016 – 2025",
    defaultTotal: 56,
  },
  "circle": {
    category: "Coordinate Geometry",
    weightage: "high",
    yearRange: "2017 – 2025",
    defaultTotal: 52,
  },
  "complex-number": {
    category: "Algebra",
    weightage: "high",
    yearRange: "2018 – 2025",
    defaultTotal: 48,
  },
  "continuity-and-differentiability": {
    category: "Calculus",
    weightage: "high",
    yearRange: "2019 – 2025",
    defaultTotal: 45,
  },
  "definite-integration": {
    category: "Integral Calculus",
    weightage: "high",
    yearRange: "2021 – 2026",
    defaultTotal: 72,
  },
  "determinants": {
    category: "Algebra",
    weightage: "medium",
    yearRange: "2018 – 2025",
    defaultTotal: 42,
  },
  "differential-equations": {
    category: "Calculus",
    weightage: "medium",
    yearRange: "2017 – 2025",
    defaultTotal: 44,
  },
  "differentiation": {
    category: "Calculus",
    weightage: "normal",
    yearRange: "2018 – 2025",
    defaultTotal: 30,
  },
  "ellipse": {
    category: "Coordinate Geometry",
    weightage: "medium",
    yearRange: "2018 – 2025",
    defaultTotal: 36,
  },
  "functions": {
    category: "Calculus",
    weightage: "high",
    yearRange: "2017 – 2025",
    defaultTotal: 58,
  },
  "hyperbola": {
    category: "Coordinate Geometry",
    weightage: "medium",
    yearRange: "2019 – 2025",
    defaultTotal: 32,
  },
  "indefinite-integration": {
    category: "Integral Calculus",
    weightage: "medium",
    yearRange: "2018 – 2025",
    defaultTotal: 40,
  },
  "inverse-trigonometric-functions": {
    category: "Trigonometry",
    weightage: "medium",
    yearRange: "2019 – 2025",
    defaultTotal: 34,
  },
  "limits": {
    category: "Calculus",
    weightage: "medium",
    yearRange: "2018 – 2025",
    defaultTotal: 38,
  },
  "limits-continuity-and-differentiability": {
    category: "Calculus",
    weightage: "high",
    yearRange: "2017 – 2025",
    defaultTotal: 62,
  },
  "matrices": {
    category: "Algebra",
    weightage: "high",
    yearRange: "2015 – 2025",
    defaultTotal: 51,
  },
  "parabola": {
    category: "Coordinate Geometry",
    weightage: "medium",
    yearRange: "2018 – 2025",
    defaultTotal: 42,
  },
  "permutation-combination": {
    category: "Algebra",
    weightage: "high",
    yearRange: "2018 – 2025",
    defaultTotal: 54,
  },
  "probability": {
    category: "Probability & Stats",
    weightage: "high",
    yearRange: "2017 – 2025",
    defaultTotal: 58,
  },
  "quadratic-equation": {
    category: "Algebra",
    weightage: "high",
    yearRange: "2018 – 2025",
    defaultTotal: 46,
  },
  "sequences-and-series": {
    category: "Algebra",
    weightage: "high",
    yearRange: "2017 – 2025",
    defaultTotal: 60,
  },
  "sets-and-relations": {
    category: "Algebra",
    weightage: "normal",
    yearRange: "2019 – 2025",
    defaultTotal: 28,
  },
  "statistics": {
    category: "Probability & Stats",
    weightage: "medium",
    yearRange: "2019 – 2025",
    defaultTotal: 32,
  },
  "straight-lines": {
    category: "Coordinate Geometry",
    weightage: "high",
    yearRange: "2017 – 2025",
    defaultTotal: 50,
  },
  "three-dimensional-geometry": {
    category: "Vectors & 3D",
    weightage: "high",
    yearRange: "2016 – 2025",
    defaultTotal: 68,
  },
  "trigonometric-equations": {
    category: "Trigonometry",
    weightage: "normal",
    yearRange: "2018 – 2025",
    defaultTotal: 26,
  },
  "trigonometric-ratios-and-identities": {
    category: "Trigonometry",
    weightage: "normal",
    yearRange: "2019 – 2025",
    defaultTotal: 30,
  },
  "vector-algebra": {
    category: "Vectors & 3D",
    weightage: "high",
    yearRange: "2016 – 2025",
    defaultTotal: 62,
  },

  // === PHYSICS ===
  "units-and-measurements": {
    category: "General Physics",
    weightage: "normal",
    yearRange: "2019 – 2025",
    defaultTotal: 42,
  },
  "motion-in-a-straight-line": {
    category: "Kinematics",
    weightage: "medium",
    yearRange: "2019 – 2025",
    defaultTotal: 48,
  },
  "motion-in-a-plane": {
    category: "Kinematics",
    weightage: "medium",
    yearRange: "2018 – 2025",
    defaultTotal: 52,
  },
  "laws-of-motion": {
    category: "Mechanics",
    weightage: "high",
    yearRange: "2019 – 2025",
    defaultTotal: 132,
  },
  "work-energy-and-power": {
    category: "Mechanics",
    weightage: "high",
    yearRange: "2018 – 2025",
    defaultTotal: 68,
  },
  "system-of-particles-and-rotational-motion": {
    category: "Mechanics",
    weightage: "high",
    yearRange: "2017 – 2025",
    defaultTotal: 78,
  },
  "gravitation": {
    category: "Gravitation",
    weightage: "medium",
    yearRange: "2018 – 2025",
    defaultTotal: 46,
  },
  "mechanical-properties-of-solids": {
    category: "Properties of Matter",
    weightage: "normal",
    yearRange: "2019 – 2025",
    defaultTotal: 32,
  },
  "mechanical-properties-of-fluids": {
    category: "Fluid Mechanics",
    weightage: "medium",
    yearRange: "2018 – 2025",
    defaultTotal: 44,
  },
  "thermal-properties-of-matter": {
    category: "Thermal Physics",
    weightage: "normal",
    yearRange: "2019 – 2025",
    defaultTotal: 35,
  },
  "thermodynamics": {
    category: "Thermodynamics",
    weightage: "high",
    yearRange: "2017 – 2025",
    defaultTotal: 74,
  },
  "kinetic-theory-of-gases": {
    category: "Thermal Physics",
    weightage: "medium",
    yearRange: "2019 – 2025",
    defaultTotal: 38,
  },
  "oscillations": {
    category: "Oscillations & Waves",
    weightage: "medium",
    yearRange: "2018 – 2025",
    defaultTotal: 48,
  },
  "waves": {
    category: "Oscillations & Waves",
    weightage: "medium",
    yearRange: "2018 – 2025",
    defaultTotal: 50,
  },
  "electric-charges-and-fields": {
    category: "Electrostatics",
    weightage: "high",
    yearRange: "2018 – 2025",
    defaultTotal: 56,
  },
  "electrostatic-potential-and-capacitance": {
    category: "Electrostatics",
    weightage: "high",
    yearRange: "2017 – 2025",
    defaultTotal: 62,
  },
  "current-electricity": {
    category: "Electrodynamics",
    weightage: "high",
    yearRange: "2016 – 2025",
    defaultTotal: 84,
  },
  "moving-charges-and-magnetism": {
    category: "Magnetism",
    weightage: "high",
    yearRange: "2017 – 2025",
    defaultTotal: 72,
  },
  "magnetism-and-matter": {
    category: "Magnetism",
    weightage: "normal",
    yearRange: "2019 – 2025",
    defaultTotal: 28,
  },
  "electromagnetic-induction": {
    category: "Electromagnetism",
    weightage: "medium",
    yearRange: "2018 – 2025",
    defaultTotal: 46,
  },
  "alternating-current": {
    category: "AC Circuits",
    weightage: "medium",
    yearRange: "2018 – 2025",
    defaultTotal: 44,
  },
  "electromagnetic-waves": {
    category: "Modern Physics",
    weightage: "normal",
    yearRange: "2019 – 2025",
    defaultTotal: 30,
  },
  "ray-optics": {
    category: "Optics",
    weightage: "high",
    yearRange: "2017 – 2025",
    defaultTotal: 66,
  },
  "wave-optics": {
    category: "Optics",
    weightage: "medium",
    yearRange: "2018 – 2025",
    defaultTotal: 42,
  },
  "dual-nature-of-radiation-and-matter": {
    category: "Modern Physics",
    weightage: "high",
    yearRange: "2018 – 2025",
    defaultTotal: 54,
  },
  "atoms": {
    category: "Modern Physics",
    weightage: "medium",
    yearRange: "2019 – 2025",
    defaultTotal: 40,
  },
  "nuclei": {
    category: "Modern Physics",
    weightage: "medium",
    yearRange: "2019 – 2025",
    defaultTotal: 38,
  },
  "semiconductor-electronics": {
    category: "Electronics",
    weightage: "high",
    yearRange: "2018 – 2025",
    defaultTotal: 58,
  },
  "communication-system": {
    category: "Modern Physics",
    weightage: "normal",
    yearRange: "2019 – 2025",
    defaultTotal: 24,
  },

  // === CHEMISTRY ===
  "some-basic-concepts-of-chemistry": {
    category: "Physical Chemistry",
    weightage: "high",
    yearRange: "2018 – 2025",
    defaultTotal: 48,
  },
  "structure-of-atom": {
    category: "Physical Chemistry",
    weightage: "high",
    yearRange: "2018 – 2025",
    defaultTotal: 54,
  },
  "classification-of-elements-and-periodicity": {
    category: "Inorganic Chemistry",
    weightage: "high",
    yearRange: "2019 – 2025",
    defaultTotal: 42,
  },
  "chemical-bonding-and-molecular-structure": {
    category: "Inorganic Chemistry",
    weightage: "high",
    yearRange: "2017 – 2025",
    defaultTotal: 68,
  },
  "chemical-thermodynamics": {
    category: "Physical Chemistry",
    weightage: "high",
    yearRange: "2017 – 2025",
    defaultTotal: 62,
  },
  "equilibrium": {
    category: "Physical Chemistry",
    weightage: "high",
    yearRange: "2017 – 2025",
    defaultTotal: 70,
  },
  "redox-reactions": {
    category: "Physical Chemistry",
    weightage: "normal",
    yearRange: "2019 – 2025",
    defaultTotal: 32,
  },
  "the-p-block-elements": {
    category: "Inorganic Chemistry",
    weightage: "high",
    yearRange: "2016 – 2025",
    defaultTotal: 80,
  },
  "the-d-and-f-block-elements": {
    category: "Inorganic Chemistry",
    weightage: "high",
    yearRange: "2017 – 2025",
    defaultTotal: 52,
  },
  "coordination-compounds": {
    category: "Inorganic Chemistry",
    weightage: "high",
    yearRange: "2016 – 2025",
    defaultTotal: 64,
  },
  "organic-chemistry-basic-principles": {
    category: "Organic Chemistry",
    weightage: "high",
    yearRange: "2017 – 2025",
    defaultTotal: 60,
  },
  "hydrocarbons": {
    category: "Organic Chemistry",
    weightage: "high",
    yearRange: "2017 – 2025",
    defaultTotal: 66,
  },
  "haloalkanes-and-haloarenes": {
    category: "Organic Chemistry",
    weightage: "medium",
    yearRange: "2018 – 2025",
    defaultTotal: 46,
  },
  "alcohols-phenols-and-ethers": {
    category: "Organic Chemistry",
    weightage: "high",
    yearRange: "2017 – 2025",
    defaultTotal: 58,
  },
  "aldehydes-ketones-and-carboxylic-acids": {
    category: "Organic Chemistry",
    weightage: "high",
    yearRange: "2016 – 2025",
    defaultTotal: 72,
  },
  "amines": {
    category: "Organic Chemistry",
    weightage: "medium",
    yearRange: "2018 – 2025",
    defaultTotal: 48,
  },
  "biomolecules": {
    category: "Organic Chemistry",
    weightage: "medium",
    yearRange: "2019 – 2025",
    defaultTotal: 40,
  },
  "solutions": {
    category: "Physical Chemistry",
    weightage: "high",
    yearRange: "2018 – 2025",
    defaultTotal: 56,
  },
  "electrochemistry": {
    category: "Physical Chemistry",
    weightage: "high",
    yearRange: "2017 – 2025",
    defaultTotal: 62,
  },
  "chemical-kinetics": {
    category: "Physical Chemistry",
    weightage: "high",
    yearRange: "2017 – 2025",
    defaultTotal: 58,
  },
};

function getChapterMeta(slug: string, subject: ChapterPyqSubject): ChapterMeta {
  const meta = CHAPTER_METAS[slug];
  if (meta) return meta;

  const defaultCategory =
    subject === "physics"
      ? "General Physics"
      : subject === "chemistry"
      ? "Physical Chemistry"
      : "Mathematics";

  return {
    category: defaultCategory,
    weightage: "normal",
    yearRange: "2019 – 2025",
    defaultTotal: 45,
  };
}

type ChapterPracticeModalProps = {
  entry: ChapterPyqEntry | null;
  onClose: () => void;
  onLiveCount: (slug: string, count: number) => void;
};

function ChapterPracticeModal({ entry, onClose, onLiveCount }: ChapterPracticeModalProps) {
  const [entries, setEntries] = useState<ChapterPyqQuestion[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tier, setTier] = useState<PyqTierFilter>("all");
  const [activeSetIndex, setActiveSetIndex] = useState<number | null>(null);
  const [sessionNonce, setSessionNonce] = useState(0);
  const onLiveCountRef = useRef(onLiveCount);
  onLiveCountRef.current = onLiveCount;

  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    setEntries(null);
    setLoadError(null);
    setTier("all");
    setActiveSetIndex(null);

    void fetchChapterPyqQuestions(entry.slug, entry.subject)
      .then((bundle) => {
        if (cancelled) return;
        const questions = bundle?.questions ?? [];
        setEntries(questions);
        const listed =
          entry.subject === "math"
            ? buildPyqYearMonthSets(questions).reduce(
                (n, set) => n + pyqYearSetListedCount(entry.slug, set.label, set.items.length),
                0
              )
            : questions.length;
        onLiveCountRef.current(entry.slug, listed);
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

  // Handle escape key to close modal
  useEffect(() => {
    if (!entry || activeSetIndex !== null) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [entry, activeSetIndex, onClose]);

  // Lock body scroll when modal is active
  useEffect(() => {
    if (!entry) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [entry]);

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

  if (!entry) return null;

  const meta = getChapterMeta(entry.slug, entry.subject);
  const subjectLabel =
    CHAPTER_PYQ_SUBJECTS.find((item) => item.id === entry.subject)?.label ?? entry.subject;

  const activeSet = activeSetIndex !== null ? sets[activeSetIndex] : undefined;

  // If exam session is active, render the fullscreen NTA session
  if (activeSet && activeSetIndex !== null) {
    return (
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
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative my-auto w-full max-w-xl lg:max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-[#1F2436] bg-[#0E111A] p-5 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.85)] animate-in zoom-in-95 duration-200">
        {/* Glow ambient background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-96 rounded-full bg-[#6366F1]/20 blur-[90px]"
        />

        {/* Modal Top Header */}
        <div className="relative mb-5 sm:mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[#6366F1]/30 bg-[#6366F1]/[0.12] px-3 py-1 text-[0.7rem] sm:text-xs font-bold uppercase tracking-[0.08em] text-[#A5B4FC]">
              <span>{subjectLabel}</span> • {meta.category} • JEE Main
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-[#F8FAFC]">
              {entry.name}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-[#94A3B8]">
              Sit a short NTA-style set. After submit you get the paper, your answer, and the key — not a skip list.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="shrink-0 rounded-full border border-[#1F2436] bg-[#161A28] p-2 text-[#94A3B8] transition-colors hover:border-[#2F3752] hover:bg-[#1E2438] hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        {entries === null ? (
          <div className="py-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#6366F1] border-t-transparent mb-3" />
            <p className="text-sm font-medium text-[#94A3B8]">Loading questions…</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#1F2436] bg-[#121624]/60 p-6 sm:p-8 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#6366F1]/30 bg-[#6366F1]/10 text-[#A5B4FC]">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[#F8FAFC]">Questions Coming Soon</h3>
            <p className="mt-1.5 mx-auto max-w-md text-xs sm:text-sm text-[#94A3B8]">
              {loadError ?? `Previous year questions for ${entry.name} (${meta.yearRange}) are currently being verified.`}
            </p>
            <div className="mt-5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[#1F2436] bg-[#161A28] px-5 py-2 text-xs sm:text-sm font-semibold text-[#F8FAFC] transition-colors hover:border-[#2F3752] hover:bg-[#1E2438]"
              >
                Back to Chapters
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Practice Sets */}
            <div>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Select a Practice Set
                </p>
                <p className="text-xs sm:text-sm text-[#94A3B8]">
                  {listedQuestionCount} questions · {sets.length} {sets.length === 1 ? "set" : "sets"} · 2 min / question
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 max-h-[360px] overflow-y-auto pr-1">
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
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-[#1F2436] bg-[#121624] p-3.5 sm:p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2F3752] hover:bg-[#181E30] hover:shadow-lg cursor-pointer"
                  >
                    <div className="min-w-0">
                      <span className="block text-sm sm:text-base font-bold text-[#F8FAFC] group-hover:text-white truncate">
                        {set.label}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-[0.72rem] sm:text-xs text-[#94A3B8]">
                        <Clock className="h-3.5 w-3.5 text-[#64748B] shrink-0" />
                        <span className="truncate">
                          {listedCount} questions · {Math.round(secondsForSet(listedCount) / 60)} min
                        </span>
                      </span>
                    </div>

                    <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[#6366F1]/30 bg-[#6366F1]/15 px-3 py-1.5 text-xs font-bold text-[#A5B4FC] transition-all duration-200 group-hover:border-[#6366F1] group-hover:bg-[#6366F1] group-hover:text-white group-hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]">
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
    </div>
  );
}

export default function ChapterPyqListView() {
  const [subject, setSubject] = useState<ChapterPyqSubject>("physics");
  const [query, setQuery] = useState("");
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [countsFailed, setCountsFailed] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<ChapterPyqEntry | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const countsLoading = counts === null && !countsFailed;

  const chapters = useMemo(
    () => filterChapters(chaptersForSubject(subject), query),
    [subject, query]
  );

  useEffect(() => {
    let cancelled = false;
    void fetchChapterPyqCounts()
      .then((next) => {
        if (cancelled) return;
        setCountsFailed(false);
        setCounts(next);
      })
      .catch(() => {
        if (cancelled) return;
        setCountsFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keyboard shortcut: Cmd+K / Ctrl+K or '/' focuses search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && document.activeElement?.tagName !== "INPUT")) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Compute aggregate stats across real questions in the bank
  const { totalPyqs, solvedPyqs, completionPercent } = useMemo(() => {
    let total = 0;
    let solved = 0;

    for (const c of chaptersForSubject(subject)) {
      const actualCount = counts?.[c.slug];
      if (actualCount && actualCount > 0) {
        total += actualCount;
        if (c.slug === "laws-of-motion") {
          solved += Math.min(18, actualCount);
        }
      }
    }

    const completion = total > 0 ? ((solved / total) * 100).toFixed(1) : "0.0";
    return {
      totalPyqs: countsLoading ? "—" : total.toLocaleString(),
      solvedPyqs: countsLoading ? "—" : solved.toLocaleString(),
      completionPercent: countsLoading ? "—" : `${completion}%`,
    };
  }, [subject, counts, countsLoading]);

  return (
    <div className="relative mx-auto w-full max-w-[1720px] px-3.5 sm:px-6 lg:px-8 xl:px-10 py-2 sm:py-4">
      {/* Background Ambience Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 left-1/4 h-96 w-96 rounded-full bg-[#6366F1]/[0.07] blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 right-1/4 h-96 w-96 rounded-full bg-[#10B981]/[0.05] blur-[120px]"
      />

      {/* Top Navigation Header */}
      <header className="relative mb-6 sm:mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
        <div className="max-w-2xl">
          <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-[#6366F1]/30 bg-[#6366F1]/[0.12] px-3 py-1 text-[0.7rem] sm:text-xs font-bold uppercase tracking-[0.08em] text-[#A5B4FC]">
            <span>Target</span> • JEE Main 2026
          </div>
          <h1 className="mb-1 text-2xl sm:text-3xl lg:text-[2.25rem] font-extrabold tracking-[-0.03em] text-[#F8FAFC] bg-gradient-to-b from-white via-white/90 to-slate-400 bg-clip-text text-transparent leading-tight">
            Chapter-wise PYQs
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
            Curated previous year questions solved topic-wise with real exam timer &amp; solutions
          </p>
        </div>

        {/* Quick Progress Strip */}
        <div className="self-start lg:self-auto flex items-center gap-2.5 sm:gap-4 rounded-2xl border border-[#1F2436] bg-[#11141E]/70 px-3.5 py-2 sm:px-5 sm:py-2.5 backdrop-blur-md shrink-0">
          <div className="flex flex-col border-r border-[#1F2436] pr-3 sm:pr-4">
            <span className="text-sm sm:text-base lg:text-lg font-bold text-[#F8FAFC]">{totalPyqs}</span>
            <span className="text-[0.62rem] sm:text-[0.7rem] font-medium tracking-[0.05em] uppercase text-[#64748B]">
              Total PYQs
            </span>
          </div>
          <div className="flex flex-col border-r border-[#1F2436] pr-3 sm:pr-4">
            <span className="text-sm sm:text-base lg:text-lg font-bold text-[#10B981]">{solvedPyqs}</span>
            <span className="text-[0.62rem] sm:text-[0.7rem] font-medium tracking-[0.05em] uppercase text-[#64748B]">
              Solved
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm sm:text-base lg:text-lg font-bold text-[#F8FAFC]">{completionPercent}</span>
            <span className="text-[0.62rem] sm:text-[0.7rem] font-medium tracking-[0.05em] uppercase text-[#64748B]">
              Completion
            </span>
          </div>
        </div>
      </header>

      {/* Controls Bar: Subject Tabs & Search */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        {/* Subject Tabs */}
        <nav
          className="inline-flex rounded-full border border-[#1F2436] bg-[#11141E] p-1 self-start overflow-x-auto max-w-full"
          role="tablist"
          aria-label="Subjects"
        >
          {CHAPTER_PYQ_SUBJECTS.map((item) => {
            const active = subject === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSubject(item.id)}
                className={cn(
                  "rounded-full px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap",
                  active
                    ? "bg-[#6366F1] text-white shadow-[0_4px_14px_rgba(99,102,241,0.4)]"
                    : "text-[#94A3B8] hover:text-[#F8FAFC]"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Search Input */}
        <div className="relative w-full sm:w-80 lg:w-96 shrink-0">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]"
          />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chapters (e.g. Calculus, Matrix)..."
            className="w-full rounded-full border border-[#1F2436] bg-[#11141E] py-2 sm:py-2.5 pl-10 pr-12 text-xs sm:text-sm text-[#F8FAFC] placeholder:text-[#64748B] outline-none transition-all duration-200 focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
          />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rounded border border-[#2B3349] bg-[#1C2233] px-1.5 py-0.5 text-[0.68rem] sm:text-[0.72rem] font-semibold text-[#64748B]">
            ⌘K
          </span>
        </div>
      </div>

      {/* Chapter Cards Grid - Fluid auto-fill responsive grid */}
      <main
        className="grid gap-3.5 sm:gap-4 lg:gap-5"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 290px), 1fr))",
        }}
      >
        {chapters.map((entry) => {
          const meta = getChapterMeta(entry.slug, entry.subject);
          const liveCount = counts?.[entry.slug];
          const isLive = counts !== null && liveCount !== undefined && liveCount > 0;
          const totalCount = isLive ? liveCount : 0;

          // Compute progress: Laws of Motion has pilot progress; otherwise 0 until attempted
          const isPilotChapter = entry.slug === "laws-of-motion" && isLive;
          const solvedCount = isPilotChapter ? 18 : 0;
          const percent = isLive && totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0;
          const statusLabel = countsLoading
            ? "Loading…"
            : countsFailed
              ? "Couldn’t load"
              : !isLive
                ? "Coming soon"
                : percent === 100
                  ? "Completed ✓"
                  : `${percent}%`;
          const actionLabel = countsLoading
            ? "Loading…"
            : countsFailed
              ? "Retry later"
              : !isLive
                ? "Coming soon"
                : percent === 100
                  ? "Review All"
                  : percent > 0
                    ? "Continue Practice"
                    : "Start Practice";

          return (
            <div
              key={entry.slug}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedChapter(entry)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedChapter(entry);
                }
              }}
              className={cn(
                "group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all duration-200 cursor-pointer text-left select-none min-h-[185px]",
                isLive
                  ? "border-[#1F2436] bg-[#11141E] hover:-translate-y-1 hover:border-[#2F3752] hover:bg-[#161A28] hover:shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
                  : countsLoading
                    ? "border-[#1F2436] bg-[#11141E]"
                    : "border-[#1F2436]/60 bg-[#11141E]/60 opacity-80 hover:opacity-100 hover:border-[#1F2436]"
              )}
            >
              {/* Card Top Glow Accent */}
              {isLive && (
                <div
                  aria-hidden="true"
                  className="absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#6366F1]/40 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                />
              )}

              {/* Card Top Meta */}
              <div>
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <span className="text-[0.68rem] sm:text-xs font-semibold uppercase tracking-[0.05em] text-[#64748B] truncate min-w-0">
                    {meta.category}
                  </span>

                  {meta.weightage === "high" ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#F43F5E]/25 bg-[#F43F5E]/[0.12] px-2 py-0.5 text-[0.68rem] font-semibold text-[#FDA4AF]">
                      🔥 High
                    </span>
                  ) : meta.weightage === "medium" ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#F59E0B]/25 bg-[#F59E0B]/[0.12] px-2 py-0.5 text-[0.68rem] font-semibold text-[#FCD34D]">
                      ⚡ Med
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-500/20 bg-slate-500/10 px-2 py-0.5 text-[0.68rem] font-semibold text-[#CBD5E1]">
                      ⭐ Standard
                    </span>
                  )}
                </div>

                {/* Card Title */}
                <h2 className="mb-3 text-[1.02rem] sm:text-[1.12rem] font-bold leading-snug text-[#F8FAFC] transition-colors group-hover:text-white line-clamp-2">
                  {entry.name}
                </h2>
              </div>

              {/* Card Footer & Progress */}
              <div className="mt-auto pt-1">
                <div className="mb-1.5 flex items-center justify-between text-xs sm:text-[0.82rem] font-medium text-[#94A3B8]">
                  <span>
                    Progress:{" "}
                    <strong className="font-semibold text-[#F8FAFC]">
                      {countsLoading ? "—" : isLive ? `${solvedCount} / ${totalCount}` : "0 / 0"}
                    </strong>
                  </span>
                  <span
                    className={cn(
                      countsLoading
                        ? "text-[#94A3B8]"
                        : !isLive
                        ? "text-[#64748B]"
                        : percent === 100
                        ? "font-semibold text-[#10B981]"
                        : percent > 0
                        ? "text-[#F8FAFC]"
                        : "text-[#64748B]"
                    )}
                  >
                    {statusLabel}
                  </span>
                </div>

                {/* Progress Bar Track */}
                <div className="mb-3 h-[4px] sm:h-[5px] overflow-hidden rounded-full bg-[#1C2333]">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      percent === 100
                        ? "bg-[#10B981]"
                        : "bg-gradient-to-r from-[#6366F1] to-[#8B5CF6]"
                    )}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                {/* Bottom Action Strip */}
                <div className="flex items-center justify-between border-t border-white/[0.05] pt-2.5 text-[0.74rem] sm:text-[0.8rem] text-[#64748B]">
                  <span>{meta.yearRange} PYQs</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 font-semibold transition-all duration-200 shrink-0",
                      isLive
                        ? percent === 100
                          ? "text-[#10B981] group-hover:text-[#34D399] group-hover:gap-1.5"
                          : "text-[#A5B4FC] group-hover:text-[#C7D2FE] group-hover:gap-1.5"
                        : "text-[#64748B] opacity-75"
                    )}
                  >
                    {actionLabel}
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={cn(
                        "transition-transform",
                        isLive && "group-hover:translate-x-0.5"
                      )}
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </main>

      {chapters.length === 0 && (
        <div className="mt-12 rounded-2xl border border-dashed border-[#1F2436] bg-[#11141E]/40 p-12 text-center">
          <p className="text-base font-bold text-[#F8FAFC]">No chapters found</p>
          <p className="mt-1 text-sm text-[#94A3B8]">
            No chapters match &quot;{query}&quot; in {CHAPTER_PYQ_SUBJECTS.find((s) => s.id === subject)?.label}.
          </p>
        </div>
      )}

      {/* Modern Practice Popup Modal */}
      <ChapterPracticeModal
        entry={selectedChapter}
        onClose={() => setSelectedChapter(null)}
        onLiveCount={(slug, count) => {
          setCounts((prev) => ({ ...(prev ?? {}), [slug]: count }));
        }}
      />
    </div>
  );
}

