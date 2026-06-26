"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { TopicNode } from "@/data/topicTaxonomy";
import type { ExamType, Subject } from "@/types";
import type { DifficultyLevel } from "@/lib/slugs";
import { buildSubtopicPanelPath, buildTopicOverviewPath, type SubtopicPanelTab } from "@/lib/curriculum/topicRoutes";
import { buildChapterHubActivityStats } from "@/lib/curriculum/chapterHubProgressStats";
import { isSubtopicLessonCompleteAtAdvanced } from "@/lib/curriculum/lessonCompletionRollup";
import { subtopicNavPreviewPlain, truncateSubtopicPreviewLabel } from "@/lib/curriculum/subtopicTitles";
import TopicHubOverviewSections from "@/components/explore/TopicHubOverviewSections";
import TopicAgentTracePanel from "@/components/TopicAgentTracePanel";
import type { TopicAgentTrace } from "@/lib/curriculum/topicContentService";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Atom,
  Award,
  BookOpen,
  Bot,
  Calculator,
  ChevronDown,
  Info,
  ListTree,
  Pencil,
  PieChart,
  Play,
  Sparkles,
  Tag,
} from "lucide-react";

const EXAM_LABELS: Record<ExamType, string> = {
  JEE: "JEE",
  JEE_Mains: "JEE Main",
  JEE_Advance: "JEE Advanced",
  NEET: "NEET",
  KCET: "KCET",
  other: "Other",
};

type Props = {
  unitLabel: string;
  chapterTitle: string;
  topics: TopicNode[];
  currentTopicName: string | null;
  boardSlug: string;
  subject: Subject;
  classLevel: number;
  boardNormalized: string;
  lessonCompletionKeys: Set<string>;
  bitsAttemptsJson?: unknown;
  subtopicEngagementJson?: unknown;
  totalPeriods?: number | null;
  examRelevance: ExamType[];
  onStartChapter: () => void;
  onNavigate: (path: string) => void;
  onCurrentTopicChange: (topicName: string) => void;
  topicContentLoading: boolean;
  whyStudy: string;
  whatLearn: string;
  realWorld: string;
  topicContentExists: boolean;
  hasOverviewProse: boolean;
  hasSubtopicPreviews: boolean;
  missingGateLevels?: DifficultyLevel[];
  canEditTopicContent?: boolean;
  topicEditorOpen: boolean;
  onToggleTopicEditor: () => void;
  draftWhyStudy: string;
  draftWhatLearn: string;
  draftRealWorld: string;
  onDraftWhyStudyChange: (v: string) => void;
  onDraftWhatLearnChange: (v: string) => void;
  onDraftRealWorldChange: (v: string) => void;
  onSaveTopicContent: () => void;
  savingTopicContent: boolean;
  generatingTopic: boolean;
  onRegenerateClick: () => void;
  regenerateDisabled: boolean;
  regenerateTooltip: string;
  generateTooltip: string;
  buttonRegenerate: string;
  buttonGenerate: string;
  topicContentExistsForButton: boolean;
  topicAgentTrace: TopicAgentTrace | null;
  onClearAgentTrace: () => void;
  existingScheduledChapterJob?: { originalScheduledAt: string } | null;
};

function SubtopicActionIcon({
  title,
  href,
  className,
  iconClassName,
  onNavigate,
  children,
}: {
  title: string;
  href: string;
  className: string;
  iconClassName: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(href);
      }}
      className={cn(
        "chapter-hub-v2-sti flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border border-transparent transition-colors hover:border-border hover:bg-muted/60",
        className
      )}
    >
      <span className={iconClassName}>{children}</span>
    </Link>
  );
}

export default function ChapterHubInvestorView(props: Props) {
  const {
    unitLabel,
    chapterTitle,
    topics,
    currentTopicName,
    boardSlug,
    subject,
    classLevel,
    boardNormalized,
    lessonCompletionKeys,
    bitsAttemptsJson,
    subtopicEngagementJson,
    totalPeriods,
    examRelevance,
    onStartChapter,
    onNavigate,
    onCurrentTopicChange,
  } = props;

  const [whyOpen, setWhyOpen] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(() => new Set());

  const totalSubtopics = useMemo(
    () => topics.reduce((n, t) => n + t.subtopics.length, 0),
    [topics]
  );

  const progress = useMemo(() => {
    let done = 0;
    for (const topic of topics) {
      for (const st of topic.subtopics) {
        if (
          isSubtopicLessonCompleteAtAdvanced(lessonCompletionKeys, {
            board: boardNormalized,
            subject,
            classLevel: classLevel as 11 | 12,
            topic: topic.topic,
            subtopicName: st.name,
          })
        ) {
          done += 1;
        }
      }
    }
    const remaining = Math.max(0, totalSubtopics - done);
    const pct = totalSubtopics > 0 ? Math.round((done / totalSubtopics) * 100) : 0;
    return { done, remaining, pct };
  }, [topics, lessonCompletionKeys, boardNormalized, subject, classLevel, totalSubtopics]);

  const activity = useMemo(
    () =>
      buildChapterHubActivityStats({
        topics,
        boardNormalized,
        subject,
        classLevel: classLevel as 11 | 12,
        bitsAttemptsJson: bitsAttemptsJson ?? null,
        subtopicEngagementJson: subtopicEngagementJson ?? null,
      }),
    [topics, boardNormalized, subject, classLevel, bitsAttemptsJson, subtopicEngagementJson]
  );

  const weightageLabel = useMemo(() => {
    if (totalPeriods != null && totalPeriods > 0) {
      return `~${Math.round((totalPeriods / 200) * 100)}%`;
    }
    return "5 – 8%";
  }, [totalPeriods]);

  const weightageSub = useMemo(() => {
    if (totalPeriods != null && totalPeriods > 0) {
      return `of syllabus · ${totalPeriods} periods`;
    }
    return "of exam · typically 8–12 marks in CBSE Board";
  }, [totalPeriods]);

  const appearsInTags = useMemo(() => {
    const tags = new Set<string>(["CBSE Board"]);
    for (const e of examRelevance) {
      const label = EXAM_LABELS[e] ?? e;
      if (label && label !== "Other") tags.add(label);
    }
    return Array.from(tags);
  }, [examRelevance]);

  useEffect(() => {
    if (!currentTopicName) return;
    setExpandedTopics((prev) => {
      if (prev.has(currentTopicName)) return prev;
      const next = new Set(prev);
      next.add(currentTopicName);
      return next;
    });
  }, [currentTopicName]);

  const expandTopic = useCallback(
    (topicName: string) => {
      setExpandedTopics((prev) => {
        if (prev.size === 1 && prev.has(topicName)) return prev;
        return new Set([topicName]);
      });
      onCurrentTopicChange(topicName);
    },
    [onCurrentTopicChange]
  );

  const collapseTopic = useCallback((topicName: string) => {
    setExpandedTopics((prev) => {
      if (!prev.has(topicName)) return prev;
      const next = new Set(prev);
      next.delete(topicName);
      return next;
    });
  }, []);

  const handleTopicToggleClick = useCallback(
    (topicName: string, isExpanded: boolean) => {
      if (isExpanded) collapseTopic(topicName);
      else expandTopic(topicName);
    },
    [collapseTopic, expandTopic]
  );

  const subtopicHref = useCallback(
    (topic: TopicNode, subtopicName: string, panel?: SubtopicPanelTab) =>
      buildSubtopicPanelPath(
        boardSlug,
        subject,
        classLevel,
        topic.topic,
        subtopicName,
        "advanced",
        panel,
        topic.chapterTitle ?? chapterTitle
      ),
    [boardSlug, subject, classLevel, chapterTitle]
  );

  const topicOverviewHref = useCallback(
    (topic: TopicNode) =>
      buildTopicOverviewPath(
        boardSlug,
        subject,
        classLevel,
        topic.topic,
        "advanced",
        undefined,
        topic.chapterTitle ?? chapterTitle
      ),
    [boardSlug, subject, classLevel, chapterTitle]
  );

  const handleTopicNameNav = useCallback(
    (topic: TopicNode) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onCurrentTopicChange(topic.topic);
      onNavigate(topicOverviewHref(topic));
    },
    [onCurrentTopicChange, onNavigate, topicOverviewHref]
  );

  const handleSubtopicNav = useCallback(
    (path: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      onNavigate(path);
    },
    [onNavigate]
  );

  return (
    <div className="chapter-hub-v2 space-y-3.5 sm:space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            {unitLabel}
          </div>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-medium text-foreground sm:text-2xl">
            <Atom className="h-5 w-5 shrink-0 text-[hsl(245_55%_67%)]" aria-hidden />
            <span className="break-words">{chapterTitle}</span>
          </h2>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={onStartChapter}
          className="chapter-hub-v2-start shrink-0 gap-2 rounded-lg border-0 px-4 py-2 text-[13px] font-medium text-white"
        >
          <Play className="h-4 w-4" aria-hidden />
          Start chapter
        </Button>
      </div>

      <div className="chapter-hub-v2-panel overflow-hidden rounded-xl border border-border bg-card">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/50"
          onClick={() => setWhyOpen((o) => !o)}
          aria-expanded={whyOpen}
        >
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Info className="h-4 w-4 text-[hsl(245_55%_67%)]" aria-hidden />
            Why study this chapter? — tap to {whyOpen ? "collapse" : "expand"}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              whyOpen && "rotate-180"
            )}
            aria-hidden
          />
        </button>
        {whyOpen ? (
          <div className="border-t border-border px-4 pb-4 pt-1">
            {props.canEditTopicContent ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 pt-2">
                <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-bold text-muted-foreground">
                  Admin
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-2 rounded-xl font-bold"
                  disabled={props.generatingTopic || props.savingTopicContent}
                  onClick={props.onToggleTopicEditor}
                >
                  {props.topicEditorOpen ? "Close Edit" : "Edit"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="gap-2 rounded-xl font-bold"
                  disabled={props.regenerateDisabled}
                  title={
                    props.topicContentExistsForButton
                      ? props.regenerateTooltip
                      : props.generateTooltip
                  }
                  onClick={props.onRegenerateClick}
                >
                  <Bot className="h-4 w-4" />
                  {props.generatingTopic
                    ? props.topicContentExistsForButton
                      ? "Regenerating…"
                      : "Generating…"
                    : props.topicContentExistsForButton
                      ? props.buttonRegenerate
                      : props.buttonGenerate}
                </Button>
                {props.existingScheduledChapterJob ? (
                  <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    Slot already allocated for{" "}
                    {new Date(props.existingScheduledChapterJob.originalScheduledAt).toLocaleString()}
                    .
                  </p>
                ) : null}
              </div>
            ) : null}
            {props.canEditTopicContent ? (
              <TopicAgentTracePanel
                trace={props.topicAgentTrace}
                onClear={props.onClearAgentTrace}
              />
            ) : null}
            <TopicHubOverviewSections
              loading={props.topicContentLoading}
              whyStudy={props.whyStudy}
              whatLearn={props.whatLearn}
              realWorld={props.realWorld}
              topicContentExists={props.topicContentExists}
              hasOverviewProse={props.hasOverviewProse}
              hasSubtopicPreviews={props.hasSubtopicPreviews}
              missingGateLevels={props.missingGateLevels}
              canEditTopicContent={props.canEditTopicContent}
            />
            {props.topicEditorOpen && props.canEditTopicContent ? (
              <div className="mt-3 space-y-3 rounded-xl border border-border bg-background/80 p-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  Why study this chapter? (markdown)
                </p>
                <textarea
                  value={props.draftWhyStudy}
                  onChange={(e) => props.onDraftWhyStudyChange(e.target.value)}
                  className="min-h-[110px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <p className="text-xs font-semibold text-muted-foreground">
                  What you will learn (markdown)
                </p>
                <textarea
                  value={props.draftWhatLearn}
                  onChange={(e) => props.onDraftWhatLearnChange(e.target.value)}
                  className="min-h-[110px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <p className="text-xs font-semibold text-muted-foreground">
                  Real-world importance (markdown)
                </p>
                <textarea
                  value={props.draftRealWorld}
                  onChange={(e) => props.onDraftRealWorldChange(e.target.value)}
                  className="min-h-[110px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={props.savingTopicContent}
                    onClick={props.onSaveTopicContent}
                  >
                    {props.savingTopicContent ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={props.savingTopicContent}
                    onClick={props.onToggleTopicEditor}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_252px]">
        <div className="chapter-hub-v2-panel overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="flex items-center gap-2 text-[13px] font-medium text-foreground">
              <ListTree className="h-4 w-4 text-[hsl(245_55%_67%)]" aria-hidden />
              Chapter syllabus — topics and sub-topics
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {topics.length} topics · {totalSubtopics} sub-topics
            </span>
          </div>
          <div>
            {topics.map((topic, ti) => {
              const isCurrent = currentTopicName === topic.topic;
              const isExpanded = expandedTopics.has(topic.topic);
              return (
                <div
                  key={`ch-topic-${ti}-${topic.topic}`}
                  className="border-b border-border last:border-b-0"
                  onMouseEnter={() => expandTopic(topic.topic)}
                >
                  <div
                    className={cn(
                      "flex w-full items-center gap-0 px-4 py-2.5 transition-colors duration-300 hover:bg-muted/40",
                      isExpanded && "bg-muted/25"
                    )}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a, button")) return;
                      if (isExpanded) collapseTopic(topic.topic);
                    }}
                  >
                    <button
                      type="button"
                      className="chapter-hub-v2-topic-num mr-2.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-medium"
                      onClick={() => handleTopicToggleClick(topic.topic, isExpanded)}
                      aria-label={`${isExpanded ? "Collapse" : "Expand"} sub-topics for ${topic.topic}`}
                    >
                      {ti + 1}
                    </button>
                    <Link
                      href={topicOverviewHref(topic)}
                      onClick={handleTopicNameNav(topic)}
                      className="min-w-0 flex-1 text-[13px] font-medium text-foreground hover:text-[hsl(245_55%_67%)] hover:underline"
                    >
                      {topic.topic}
                    </Link>
                    {isCurrent ? (
                      <span className="chapter-hub-v2-current mr-2 shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium">
                        Current
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="mr-2 shrink-0 whitespace-nowrap text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() => handleTopicToggleClick(topic.topic, isExpanded)}
                      aria-expanded={isExpanded}
                    >
                      {topic.subtopics.length} sub-topics
                    </button>
                    <button
                      type="button"
                      className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground"
                      onClick={() => handleTopicToggleClick(topic.topic, isExpanded)}
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? "Collapse" : "Expand"} sub-topics for ${topic.topic}`}
                    >
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform duration-500 ease-in-out",
                          isExpanded && "rotate-180"
                        )}
                        aria-hidden
                      />
                    </button>
                  </div>
                  <AnimatePresence initial={false}>
                    {isExpanded ? (
                      <motion.div
                        key={`subtopics-${topic.topic}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.48, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-2.5 pl-[52px]">
                          {topic.subtopics.map((st, si) => (
                            <motion.div
                              key={`ch-st-${si}-${st.name}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -6 }}
                              transition={{
                                duration: 0.38,
                                delay: si * 0.065,
                                ease: "easeOut",
                              }}
                              className="flex items-center gap-2 border-b border-border py-2 last:border-b-0"
                            >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
                          <Link
                            href={subtopicHref(topic, st.name)}
                            onClick={handleSubtopicNav(subtopicHref(topic, st.name))}
                            className="min-w-0 flex-1 overflow-hidden text-xs leading-snug text-muted-foreground hover:text-foreground hover:underline"
                            title={subtopicNavPreviewPlain(st.name)}
                          >
                            <span className="block truncate">
                              {truncateSubtopicPreviewLabel(st.name, 44)}
                            </span>
                          </Link>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <SubtopicActionIcon
                              title="Quiz"
                              href={subtopicHref(topic, st.name, "quiz")}
                              className="chapter-hub-v2-sti-quiz"
                              iconClassName="text-[hsl(160_68%_36%)]"
                              onNavigate={onNavigate}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </SubtopicActionIcon>
                            <SubtopicActionIcon
                              title="Numericals"
                              href={subtopicHref(topic, st.name, "numerals")}
                              className="chapter-hub-v2-sti-numbers"
                              iconClassName="text-[hsl(210_70%_54%)]"
                              onNavigate={onNavigate}
                            >
                              <Calculator className="h-3.5 w-3.5" />
                            </SubtopicActionIcon>
                            <SubtopicActionIcon
                              title="Instacue"
                              href={subtopicHref(topic, st.name, "instacue")}
                              className="chapter-hub-v2-sti-instacue"
                              iconClassName="text-[hsl(340_60%_58%)]"
                              onNavigate={onNavigate}
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                            </SubtopicActionIcon>
                            <SubtopicActionIcon
                              title="Concepts"
                              href={subtopicHref(topic, st.name, "concepts")}
                              className="chapter-hub-v2-sti-concepts"
                              iconClassName="text-[hsl(38_85%_54%)]"
                              onNavigate={onNavigate}
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                            </SubtopicActionIcon>
                          </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="chapter-hub-v2-panel rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-foreground">
              <PieChart className="h-4 w-4 text-[hsl(245_55%_67%)]" aria-hidden />
              Chapter progress
            </h3>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Subtopics completed</span>
              <span className="font-medium text-[hsl(245_55%_67%)]">{progress.pct}%</span>
            </div>
            <div className="chapter-hub-v2-prog-track mb-2.5 h-[5px] overflow-hidden rounded-full">
              <div
                className="chapter-hub-v2-prog-fill h-full rounded-full transition-all"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { val: progress.done, lbl: "Done" },
                { val: progress.remaining, lbl: "Remaining" },
                {
                  val:
                    activity.quizSetsTotal > 0
                      ? `${activity.quizSetsTaken}/${activity.quizSetsTotal}`
                      : activity.quizSetsTaken,
                  lbl: "Sets taken",
                },
                { val: activity.instaCueCardsCreated, lbl: "Cards created" },
              ].map(({ val, lbl }) => (
                <div
                  key={lbl}
                  className="rounded-md border border-border bg-muted/40 p-2 text-center"
                >
                  <div className="text-lg font-medium text-foreground">{val}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{lbl}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="chapter-hub-v2-panel rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-foreground">
              <Award className="h-4 w-4 text-[hsl(38_85%_54%)]" aria-hidden />
              Exam weightage
            </h3>
            <div className="chapter-hub-v2-wt-band rounded-md border px-3 py-2">
              <div className="text-lg font-medium text-[hsl(38_85%_54%)]">{weightageLabel}</div>
              <div className="mt-0.5 text-[10px] opacity-80 text-[hsl(38_75%_72%)]">
                {weightageSub}
              </div>
            </div>
            <div className="my-2.5 h-px bg-border" />
            <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Tag className="h-3.5 w-3.5" aria-hidden />
              Appears in
            </div>
            <div className="flex flex-wrap gap-1">
              {appearsInTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="chapter-hub-v2-panel rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-foreground">
              <Info className="h-4 w-4 text-muted-foreground" aria-hidden />
              Action icons
            </h3>
            <div className="flex flex-col gap-2">
              {[
                {
                  ico: "chapter-hub-v2-leg-quiz",
                  color: "text-[hsl(160_68%_36%)]",
                  Icon: Pencil,
                  title: "Quiz",
                  desc: "attempt MCQs on this sub-topic",
                },
                {
                  ico: "chapter-hub-v2-leg-numbers",
                  color: "text-[hsl(210_70%_54%)]",
                  Icon: Calculator,
                  title: "Numbers",
                  desc: "numerical problems",
                },
                {
                  ico: "chapter-hub-v2-leg-instacue",
                  color: "text-[hsl(340_60%_58%)]",
                  Icon: Sparkles,
                  title: "Instacue",
                  desc: "revision flashcards",
                },
                {
                  ico: "chapter-hub-v2-leg-concepts",
                  color: "text-[hsl(38_85%_54%)]",
                  Icon: BookOpen,
                  title: "Concepts",
                  desc: "summary and theory",
                },
              ].map(({ ico, color, Icon, title, desc }) => (
                <div key={title} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span
                    className={cn(
                      "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md",
                      ico
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", color)} aria-hidden />
                  </span>
                  <span>
                    <strong className="text-foreground">{title}</strong> — {desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
