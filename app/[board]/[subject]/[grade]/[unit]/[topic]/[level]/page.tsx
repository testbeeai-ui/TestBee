"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { getTheoryOrPlaceholder } from "@/data/topicTheory";
import InteractiveTheoryRenderer from "@/components/InteractiveTheoryRenderer";
import TheoryContentWithDeepDive, { parseTheorySections } from "@/components/TheoryContentWithDeepDive";
import DeepDiveRandomWheel from "@/components/DeepDiveRandomWheel";
import DeepDiveLinearSelector from "@/components/DeepDiveLinearSelector";
import { resolveTopicFromParams, buildTopicPath, buildDeepDivePath } from "@/lib/topicRoutes";
import type { DifficultyLevel } from "@/lib/slugs";
import { ArrowLeft, BookOpen, Zap, RotateCw, ChevronRight } from "lucide-react";

const THEORY_TRUNCATE_CHARS = 450;

const LEVELS: { value: DifficultyLevel; label: string }[] = [
  { value: "basics", label: "Basic" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

export default function TopicPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") === "random" ? "random" : "linear";

  const board = params.board as string;
  const subject = params.subject as string;
  const grade = params.grade as string;
  const unitSlug = params.unit as string;
  const topicSlug = params.topic as string;
  const level = params.level as string;

  const resolved = useMemo(
    () =>
      resolveTopicFromParams(board, subject, grade, unitSlug, topicSlug, level),
    [board, subject, grade, unitSlug, topicSlug, level]
  );

  const [expandedTheory, setExpandedTheory] = useState(false);

  const toggleTheory = useCallback(() => {
    setExpandedTheory((v) => !v);
  }, []);

  if (!resolved) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-16 px-4 text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">Topic not found</h1>
          <p className="text-muted-foreground mb-6">
            This topic or unit may not exist. Check the URL or go back to Explore.
          </p>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/explore-1">Back to Explore</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const { topicNode, subtopicIndex, subtopicName, level: difficultyLevel } = resolved;
  const theoryData = getTheoryOrPlaceholder(
    topicNode.subject,
    topicNode.classLevel,
    topicNode.topic,
    subtopicName,
    difficultyLevel as 'basics' | 'intermediate' | 'advanced'
  );
  const isLong = theoryData.theory.length > THEORY_TRUNCATE_CHARS;
  const truncateAt = theoryData.theory.lastIndexOf(" ", THEORY_TRUNCATE_CHARS);
  const displayTheory =
    isLong && !expandedTheory
      ? theoryData.theory.slice(0, truncateAt > 200 ? truncateAt : THEORY_TRUNCATE_CHARS).trim() + "..."
      : theoryData.theory;

  const isFirst = subtopicIndex === 0;
  const isLast = subtopicIndex === topicNode.subtopics.length - 1;
  const prevSubtopic = isFirst ? null : topicNode.subtopics[subtopicIndex - 1]!;
  const nextSubtopic = isLast ? null : topicNode.subtopics[subtopicIndex + 1]!;

  const backHref = `/explore-1?subject=${topicNode.subject}&class=${topicNode.classLevel}&unit=${unitSlug}`;
  const prevHref = prevSubtopic
    ? buildTopicPath(
        board,
        topicNode.subject,
        topicNode.classLevel,
        topicNode.topic,
        prevSubtopic.name,
        difficultyLevel
      )
    : null;
  const deepDiveHref = useCallback(
    (sectionIndex: number) => {
      const base = buildDeepDivePath(
        board,
        topicNode.subject,
        topicNode.classLevel,
        topicNode.topic,
        subtopicName,
        difficultyLevel as DifficultyLevel,
        sectionIndex
      );
      return mode === "random" ? `${base}?mode=random` : base;
    },
    [board, topicNode, subtopicName, difficultyLevel, mode]
  );

  const nextHref = nextSubtopic
    ? buildTopicPath(
        board,
        topicNode.subject,
        topicNode.classLevel,
        topicNode.topic,
        nextSubtopic.name,
        difficultyLevel
      )
    : null;
  const spinAgainHref = `/explore-1?subject=${topicNode.subject}&class=${topicNode.classLevel}&unit=${unitSlug}&spin=1`;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto py-6 px-4">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="rounded-full font-bold -ml-1">
            <Link href={backHref}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Link>
          </Button>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-sm font-bold text-primary">
            <Zap className="w-4 h-4" />
            {topicNode.subject.charAt(0).toUpperCase() + topicNode.subject.slice(1)}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-muted text-sm font-bold text-muted-foreground">
            Class {topicNode.classLevel}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-primary/10 text-sm font-bold text-primary">
            {(params.board as string).toUpperCase()}
          </span>
        </div>

        <div className="mb-4">
          <p className="text-sm text-muted-foreground font-medium flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            {topicNode.unitLabel ?? "Unit"}: {topicNode.topic} (Total Periods: {topicNode.totalPeriods ?? "—"})
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <main className="flex-1 min-w-0">
            <div className="edu-card p-6 rounded-2xl border-2 border-primary/30 ring-2 ring-primary/20 shadow-lg">
              <div className="flex justify-end mb-4">
                <span className="text-sm font-bold text-muted-foreground">
                  {subtopicIndex + 1} / {topicNode.subtopics.length}
                </span>
              </div>
              <h2 className="font-extrabold text-lg text-foreground mb-3 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm text-primary">
                  {subtopicIndex + 1}
                </span>
                {subtopicName}
              </h2>
              {mode === "linear" && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {LEVELS.map(({ value, label }) => {
                    const href = buildTopicPath(
                      board,
                      topicNode.subject,
                      topicNode.classLevel,
                      topicNode.topic,
                      subtopicName,
                      value
                    );
                    const isActive = difficultyLevel === value;
                    return (
                      <Link
                        key={value}
                        href={href}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {label}
                      </Link>
                    );
                  })}
                </div>
              )}
              <div className="theory-content mb-6">
                <TheoryContentWithDeepDive
                  theory={displayTheory}
                  bits={theoryData.bits ?? []}
                  deepDiveHref={deepDiveHref}
                  showPerSectionButtons={false}
                />
              </div>
              {isLong && (
                <button
                  type="button"
                  onClick={toggleTheory}
                  className="text-sm font-semibold text-primary hover:underline mb-4"
                >
                  {expandedTheory ? "Read less" : "Read more"}
                </button>
              )}
              {theoryData.interactiveBlocks && theoryData.interactiveBlocks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <h4 className="font-bold text-foreground mb-3 text-sm">
                    Practice — Test your understanding
                  </h4>
                  <InteractiveTheoryRenderer blocks={theoryData.interactiveBlocks} />
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-border flex flex-col sm:flex-row gap-4 sm:gap-6 sm:items-center min-w-0">
                {mode === "random" ? (
                  <Button asChild size="sm" className="rounded-xl gap-2 font-bold edu-btn-primary w-fit">
                    <Link href={spinAgainHref}>
                      <RotateCw className="w-4 h-4" /> Spin again
                    </Link>
                  </Button>
                ) : (
                  <>
                    {!isFirst && prevHref && prevSubtopic && (
                      <Button asChild size="default" variant="outline" className="rounded-xl gap-2 font-bold w-full sm:flex-1 sm:min-w-0 min-w-0 max-w-full">
                        <Link href={prevHref} className="inline-flex items-center min-w-0 truncate" title={prevSubtopic.name}>
                          <ArrowLeft className="w-4 h-4 shrink-0" /> Previous: <span className="truncate">{prevSubtopic.name}</span>
                        </Link>
                      </Button>
                    )}
                    {!isLast && nextHref && nextSubtopic && (
                      <Button asChild size="default" className="rounded-xl gap-2 font-bold edu-btn-primary w-full sm:flex-1 sm:min-w-0 sm:ml-auto min-w-0 max-w-full">
                        <Link href={nextHref} className="inline-flex items-center min-w-0 truncate" title={nextSubtopic.name}>
                          Next: <span className="truncate">{nextSubtopic.name}</span> <ChevronRight className="w-4 h-4 shrink-0" />
                        </Link>
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </main>

          <aside className="w-full lg:w-80 xl:w-96 shrink-0">
            <div className="lg:sticky lg:top-24 space-y-4">
              <div className="edu-card p-5 rounded-2xl border border-border">
                <h4 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Topics in this unit
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {topicNode.subtopics.map((st, idx) => (
                    <li key={st.name} className="flex gap-2">
                      <span className="text-primary font-medium shrink-0">{idx + 1}.</span>
                      <span className={idx === subtopicIndex ? "font-semibold text-foreground" : ""}>
                        {st.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="edu-card p-5 rounded-2xl border border-border">
                <h4 className="font-bold text-foreground text-sm mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Exam weightage
                </h4>
                <p className="text-sm text-muted-foreground">
                  {topicNode.totalPeriods != null
                    ? `~${Math.round((topicNode.totalPeriods / 200) * 100)}% of syllabus`
                    : "~5–8% of exam"}
                  {topicNode.totalPeriods != null && (
                    <span className="block mt-1 text-xs">{topicNode.totalPeriods} periods</span>
                  )}
                </p>
              </div>

              {mode === "linear" && (
                <DeepDiveLinearSelector
                  sections={parseTheorySections(theoryData.theory).sections}
                  buildDeepDiveHref={deepDiveHref}
                />
              )}
              {mode === "random" && (
                <DeepDiveRandomWheel
                  sections={parseTheorySections(theoryData.theory).sections}
                  buildDeepDiveHref={deepDiveHref}
                  levelLabel={LEVELS.find((l) => l.value === difficultyLevel)?.label ?? difficultyLevel}
                />
              )}
            </div>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
