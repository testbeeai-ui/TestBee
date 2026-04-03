"use client";

import { useState, useMemo, useEffect, useRef, useCallback, Suspense, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/useUserStore';
import { questions } from '@/data/questions';
import { Question, Subject, ExamType, ClassLevel, SubjectCombo, Board } from '@/types';
import { TopicNode } from '@/data/topicTaxonomy';
import { useTopicTaxonomy } from '@/hooks/useTopicTaxonomy';
import ExploreHubDashboard from '@/components/explore/ExploreHubDashboard';
import QuestionCard from '@/components/QuestionCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, ArrowLeft, Sparkles, BookOpen, ChevronRight, Zap, Play, Box, CheckCircle2, XCircle, Bot, ListOrdered, Shuffle, Filter } from 'lucide-react';
import { getTheoryOrPlaceholder, type InteractiveBlock } from '@/data/topicTheory';
import InteractiveTheoryRenderer from '@/components/InteractiveTheoryRenderer';
import TheoryContentWithDeepDive, { parseTheorySections } from '@/components/TheoryContentWithDeepDive';
import DeepDiveLinearSelector from '@/components/DeepDiveLinearSelector';
import MathText from '@/components/MathText';
import { subtopicMathTextLabel, subtopicNavPreviewPlain } from '@/lib/subtopicTitles';
import SubjectChatbot from '@/components/SubjectChatbot';
import AnimatedPhysicsIcon from '@/components/AnimatedPhysicsIcon';
import AnimatedChemistryIcon from '@/components/AnimatedChemistryIcon';
import AnimatedMathIcon from '@/components/AnimatedMathIcon';
import AnimatedBiologyIcon from '@/components/AnimatedBiologyIcon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import TopicRoulette from '@/components/TopicRoulette';
import { buildTopicPath, buildTopicOverviewPath, buildDeepDivePath } from '@/lib/topicRoutes';
import { slugify } from '@/lib/slugs';
import TheoryContent from '@/components/TheoryContent';
import TopicAgentTracePanel from '@/components/TopicAgentTracePanel';
import {
  fetchTopicContent,
  generateTopicContent,
  upsertTopicContent,
  type TopicAgentTrace,
  type TopicSubtopicPreview,
  type TopicHubScope,
} from '@/lib/topicContentService';
import { useToast } from '@/hooks/use-toast';
import { fuzzySubtopicKey } from '@/lib/utils';
import { useOrchestratorStore } from '@/store/useOrchestratorStore';
import {
  CLASS12_PHYSICS_CHAPTER_BLURB,
  CLASS12_PHYSICS_CHAPTER_ICON,
  CLASS12_PHYSICS_SECTIONS,
  CLASS12_PHYSICS_UNIT_COUNT_LABEL,
  isClass12Physics,
} from '@/lib/class12PhysicsExplore';

const DistanceDisplacementScene = dynamic(
  () => import('@/components/DistanceDisplacementScene'),
  { ssr: false }
);

const subjects: { value: Subject; label: string; emoji: string; gradient: string }[] = [
  { value: 'physics', label: 'Physics', emoji: '⚡', gradient: 'from-blue-500 to-cyan-400' },
  { value: 'chemistry', label: 'Chemistry', emoji: '🧪', gradient: 'from-purple-500 to-violet-400' },
  { value: 'math', label: 'Math', emoji: '📐', gradient: 'from-orange-500 to-amber-400' },
  { value: 'biology', label: 'Biology', emoji: '🧬', gradient: 'from-green-500 to-emerald-400' },
];

const exams: { value: ExamType; label: string; emoji: string }[] = [
  { value: 'JEE_Mains', label: 'JEE Mains', emoji: '🎯' },
  { value: 'JEE_Advance', label: 'JEE Advance', emoji: '🏆' },
  { value: 'KCET', label: 'KCET', emoji: '📋' },
  { value: 'other', label: 'Other', emoji: '📝' },
];

const EXAM_TYPES_11_12: ExamType[] = ['JEE_Mains', 'JEE_Advance', 'KCET', 'other'];

/** JEE_Mains and JEE_Advance both use content tagged as JEE until we have separate tagging. */
function examMatchesFilter(profileExam: ExamType | null, dataExams: ExamType[]): boolean {
  if (!profileExam) return true;
  // CBSE ('other') is the base curriculum — matches everything
  if (profileExam === 'other') return true;
  // Untagged topics (empty examRelevance) are universal — match any exam
  if (dataExams.length === 0) return true;
  if (profileExam === 'JEE_Mains' || profileExam === 'JEE_Advance') return dataExams.includes('JEE');
  return dataExams.includes(profileExam);
}

/** Chapter bucket key — must match `unitChapterGroups` (`chapterTitle` or falls back to syllabus topic title). Never use a shared "Untitled" bucket. */
function chapterGroupKey(node: TopicNode): string {
  return node.chapterTitle?.trim() || node.topic;
}

/** "Unit 10" must sort after "Unit 2" — plain localeCompare treats digit strings lexicographically. */
function compareUnitLabels(a: string, b: string): number {
  const ra = /^Unit\s+(\d+)\s*$/i.exec(String(a ?? "").trim());
  const rb = /^Unit\s+(\d+)\s*$/i.exec(String(b ?? "").trim());
  if (ra && rb) {
    const na = parseInt(ra[1]!, 10);
    const nb = parseInt(rb[1]!, 10);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  }
  return String(a ?? "").localeCompare(String(b ?? ""));
}

/** Open the topic row that matches the card label when possible; otherwise first row (deterministic). */
function pickPrimaryTopicForChapter(chapterKey: string, nodes: TopicNode[]): TopicNode {
  const sorted = [...nodes].sort((a, b) => a.topic.localeCompare(b.topic));
  return sorted.find((t) => t.topic === chapterKey) ?? sorted[0]!;
}

/** Stored copy sometimes has literal `\n` / `\t` instead of real newlines — fix markdown/list rendering. */
function decodeAiEscapes(text: string): string {
  if (!text) return text;
  return text
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\t/g, '\t');
}

function getExamLabel(value: ExamType): string {
  return exams.find((e) => e.value === value)?.label ?? value;
}

function toDateTimeLocalValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/** Classes shown in the Topics accordion. */
const VISIBLE_CLASSES: ClassLevel[] = [11, 12];

function getVisibleExamTypes(): ExamType[] {
  return EXAM_TYPES_11_12;
}

function getVisibleSubjects(_classLevel: ClassLevel | null, subjectCombo: SubjectCombo | null): Subject[] {
  return subjectCombo === 'PCMB' ? ['physics', 'chemistry', 'math', 'biology'] : ['physics', 'chemistry', 'math'];
}

/** Get MCQs related to a subtopic: filter by subject, topic, classLevel; prioritize by relatedTopics overlap. */
function getQuestionsForSubtopic(
  subject: Subject,
  topic: string,
  classLevel: ClassLevel,
  subtopicName: string,
  limit = 5
): Question[] {
  const words = subtopicName.toLowerCase().replace(/[&\-,]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
  const topicQs = questions.filter(
    (q) => q.subject === subject && q.topic === topic && q.classLevel <= classLevel
  );
  const withMatch = topicQs.filter((q) =>
    q.reference?.relatedTopics?.some((rt) =>
      words.some((w) => rt.toLowerCase().includes(w))
    )
  );
  const rest = topicQs.filter((q) => !withMatch.includes(q));
  return [...withMatch, ...rest].slice(0, limit);
}

type ViewState = 'hub' | 'subjects' | 'topics' | 'topic-detail' | 'questions';

function BitsMCQs({ questions: qs }: { questions: Question[] }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const q = qs[index]!;
  const answered = selected !== null;
  const isCorrect = selected === q.correctAnswer;

  const handleSelect = (i: number) => {
    if (answered) return;
    setSelected(i);
  };

  const handleNext = () => {
    if (index < qs.length - 1) {
      setIndex((i) => i + 1);
      setSelected(null);
    }
  };

  return (
    <div className="border-t border-border pt-4">
      <h4 className="font-semibold text-foreground text-sm mb-3">Related MCQs ({index + 1}/{qs.length})</h4>
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">{q.question}</p>
        <div className="space-y-2">
          {q.options.map((opt, i) => {
            let style = "bg-muted hover:bg-muted/80 text-foreground";
            if (answered) {
              if (i === q.correctAnswer) style = "bg-edu-green/15 border-2 border-edu-green text-foreground";
              else if (i === selected && !isCorrect) style = "bg-destructive/15 border-2 border-destructive text-foreground";
              else style = "bg-muted/50 text-muted-foreground";
            } else if (i === selected) style = "bg-primary/20 border-2 border-primary text-foreground";
            return (
              <button
                key={i}
                type="button"
                disabled={answered}
                onClick={() => handleSelect(i)}
                className={`w-full text-left p-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${style}`}
              >
                <span className="w-6 h-6 rounded-full bg-background/60 flex items-center justify-center text-xs shrink-0">
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
                {answered && i === q.correctAnswer && <CheckCircle2 className="w-4 h-4 shrink-0 text-edu-green ml-auto" />}
                {answered && i === selected && !isCorrect && <XCircle className="w-4 h-4 shrink-0 text-destructive ml-auto" />}
              </button>
            );
          })}
        </div>
        {answered && q.solution && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-xl mt-2">{q.solution}</div>
        )}
        {answered && index < qs.length - 1 && (
          <Button size="sm" variant="outline" onClick={handleNext} className="mt-2 rounded-xl">
            Next MCQ
          </Button>
        )}
      </div>
    </div>
  );
}

import { ProtectedRoute } from "@/components/ProtectedRoute";

// ─── Unit Roadmap ────────────────────────────────────────────────────────────

const UNIT_COLORS = [
  { outline: 'border-green-500',   accent: 'bg-green-500/12',   text: 'text-green-700',   btn: 'bg-green-500 hover:bg-green-600 text-white',   stroke: '#22c55e' },
  { outline: 'border-yellow-400',   accent: 'bg-yellow-400/12',  text: 'text-yellow-700',   btn: 'bg-yellow-500 hover:bg-yellow-600 text-white',  stroke: '#eab308' },
  { outline: 'border-teal-500',    accent: 'bg-teal-500/12',    text: 'text-teal-700',    btn: 'bg-teal-500 hover:bg-teal-600 text-white',    stroke: '#14b8a6' },
  { outline: 'border-cyan-500',    accent: 'bg-cyan-500/12',    text: 'text-cyan-700',     btn: 'bg-cyan-500 hover:bg-cyan-600 text-white',     stroke: '#06b6d4' },
  { outline: 'border-blue-500',    accent: 'bg-blue-500/12',    text: 'text-blue-700',    btn: 'bg-blue-500 hover:bg-blue-600 text-white',    stroke: '#3b82f6' },
  { outline: 'border-sky-500',     accent: 'bg-sky-500/12',     text: 'text-sky-700',     btn: 'bg-sky-500 hover:bg-sky-600 text-white',      stroke: '#0ea5e9' },
  { outline: 'border-rose-500',    accent: 'bg-rose-500/12',    text: 'text-rose-700',    btn: 'bg-rose-500 hover:bg-rose-600 text-white',    stroke: '#f43f5e' },
  { outline: 'border-orange-500',  accent: 'bg-orange-500/12',  text: 'text-orange-700',  btn: 'bg-orange-500 hover:bg-orange-600 text-white', stroke: '#f97316' },
  { outline: 'border-amber-500',  accent: 'bg-amber-500/12',   text: 'text-amber-700',   btn: 'bg-amber-500 hover:bg-amber-600 text-white',  stroke: '#f59e0b' },
  { outline: 'border-yellow-500', accent: 'bg-yellow-500/12',  text: 'text-yellow-800',  btn: 'bg-yellow-500 hover:bg-yellow-600 text-white', stroke: '#eab308' },
];

const UNIT_ICONS: Record<string, string> = {
  'Physical World and Measurement':              '📏',
  'Kinematics':                                  '🏃',
  'Laws of Motion':                              '⚙️',
  'Work, Energy and Power':                      '⚡',
  'Motion of System of Particles and Rigid Body':'🌐',
  'Gravitation':                                 '🪐',
  'Properties of Bulk Matter':                   '📦',
  'Thermodynamics':                              '🌡️',
  'Behaviour of Perfect Gas and Kinetic Theory': '💨',
  'Oscillations and Waves':                      '〰️',
};

interface UnitRoadmapProps {
  topics: TopicNode[];
  subject: Subject;
  classLevel: ClassLevel;
  onTopicClick: (
    topic: TopicNode,
    cl: ClassLevel,
    preferredChapterName?: string,
    preferredTopicName?: string
  ) => void;
  getTopicCount: (subject: Subject, topic: string) => number;
  correctByTopic: Record<string, number>;
}

function UnitRoadmap({ topics, subject, classLevel, onTopicClick, getTopicCount, correctByTopic }: UnitRoadmapProps) {
  const sorted = [...topics].sort((a, b) => {
    const aLabel = a.unitLabel ?? '';
    const bLabel = b.unitLabel ?? '';
    if (aLabel !== bLabel) return compareUnitLabels(aLabel, bLabel);
    const aChapter = (a.chapterTitle ?? '').toLowerCase();
    const bChapter = (b.chapterTitle ?? '').toLowerCase();
    if (aChapter !== bChapter) return aChapter.localeCompare(bChapter);
    return a.topic.localeCompare(b.topic);
  });

  const unitMap = new Map<string, TopicNode[]>();
  for (const node of sorted) {
    const key = node.unitLabel?.trim() || `Unit ${node.topic}`;
    const list = unitMap.get(key) ?? [];
    list.push(node);
    unitMap.set(key, list);
  }
  const unitCards = Array.from(unitMap.entries())
    .map(([unitLabel, unitTopics]) => ({
      unitLabel,
      unitTopics,
      representative: unitTopics[0]!,
    }))
    .sort((a, b) => compareUnitLabels(a.unitLabel, b.unitLabel));
  const chapterCards = unitCards.flatMap((unit, unitIndex) => {
    const chapterMap = new Map<string, TopicNode[]>();
    for (const topic of unit.unitTopics) {
      const chapterKey = chapterGroupKey(topic);
      const list = chapterMap.get(chapterKey) ?? [];
      list.push(topic);
      chapterMap.set(chapterKey, list);
    }
    return Array.from(chapterMap.entries()).map(([chapterKey, chapterTopicsRaw], chapterIndex) => {
      const chapterTopics = [...chapterTopicsRaw].sort((a, b) => a.topic.localeCompare(b.topic));
      return {
        unitLabel: unit.unitLabel,
        unitTopics: unit.unitTopics,
        chapterTitle: chapterKey,
        chapterTopics,
        representative: pickPrimaryTopicForChapter(chapterKey, chapterTopics),
        unitRepresentative: unit.representative,
        unitIndex,
        chapterIndex,
      };
    });
  });
  const unitKeys = unitCards.map((u) => u.unitLabel);
  const physics12Layout = isClass12Physics(subject, classLevel);

  const chapterByTitle = new Map<string, (typeof chapterCards)[number]>();
  for (const ch of chapterCards) chapterByTitle.set(ch.chapterTitle, ch);

  const getCrowns = (correct: number, totalQ: number): number => {
    if (totalQ === 0 || correct === 0) return 0;
    const ratio = correct / totalQ;
    if (ratio >= 0.8) return 3;
    if (ratio >= 0.4) return 2;
    return 1;
  };

  const renderPhysics12Card = (chapter: (typeof chapterCards)[number], animDelay: number, colorIdx: number) => {
    const c = UNIT_COLORS[colorIdx % UNIT_COLORS.length];
    const blurb = CLASS12_PHYSICS_CHAPTER_BLURB[chapter.chapterTitle] ?? '';
    const icon =
      CLASS12_PHYSICS_CHAPTER_ICON[chapter.chapterTitle] ??
      UNIT_ICONS[chapter.unitRepresentative.unitTitle ?? chapter.unitRepresentative.topic] ??
      '📚';
    const topicCount = chapter.chapterTopics.length;
    const unitNumberLabel = chapter.unitLabel.replace('Unit', 'U').trim();
    const { chapterTitle, representative } = chapter;
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: animDelay, type: 'spring', stiffness: 260, damping: 24 }}
        whileHover={{ scale: 1.015, transition: { duration: 0.15 } }}
        whileTap={{ scale: 0.99 }}
        onClick={() => onTopicClick(representative, classLevel, chapterTitle, representative.topic)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onTopicClick(representative, classLevel, chapterTitle, representative.topic);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Open ${chapterTitle}`}
        className="w-full text-left rounded-2xl border border-border/80 bg-card shadow-md hover:shadow-lg transition-shadow duration-200 p-4 sm:p-5 min-h-[232px] flex flex-col cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 overflow-hidden"
        style={{ borderTopWidth: 3, borderTopStyle: 'solid', borderTopColor: c.stroke }}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-extrabold tracking-widest text-muted-foreground">{unitNumberLabel}</span>
          <span className="flex gap-1 pt-0.5 shrink-0" aria-hidden>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.stroke, opacity: 1 }} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.stroke, opacity: 0.65 }} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.stroke, opacity: 0.35 }} />
          </span>
        </div>
        <div className="flex justify-center my-3">
          <div
            className={`w-[52px] h-[52px] sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-2xl sm:text-3xl ${c.accent} border border-border/40`}
          >
            {icon}
          </div>
        </div>
        <h4 className="text-[15px] sm:text-base font-extrabold text-foreground leading-snug mb-2">{chapterTitle}</h4>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-4 flex-1">{blurb}</p>
        <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-muted-foreground">
            {topicCount} {topicCount === 1 ? 'topic' : 'topics'}
          </span>
          <span className="rounded-full px-3 py-1.5 text-[11px] font-extrabold border border-border bg-muted/50 text-foreground shrink-0">
            Theory
          </span>
        </div>
      </motion.div>
    );
  };

  const renderCard = (
    unitLabel: string,
    unitTopics: TopicNode[],
    chapterTitle: string,
    chapterTopics: TopicNode[],
    representative: TopicNode,
    unitRepresentative: TopicNode,
    unitIndex: number,
    chapterIndex: number,
    animDelay: number
  ) => {
    const c = UNIT_COLORS[unitIndex % UNIT_COLORS.length];
    const displayName = unitRepresentative.unitTitle ?? unitRepresentative.topic;
    const icon = UNIT_ICONS[displayName] ?? '📚';
    const qCount = chapterTopics.reduce((sum, t) => sum + getTopicCount(subject, t.topic), 0);
    const correct = chapterTopics.reduce((sum, t) => sum + (correctByTopic[t.topic] ?? 0), 0);
    const hasStarted = correct > 0;
    const crowns = getCrowns(correct, qCount);
    const periods = chapterTopics.reduce((sum, t) => sum + (t.totalPeriods ?? 0), 0);
    const topicCount = chapterTopics.length;
    const unitNumberLabel = unitLabel.replace('Unit', 'U').trim();
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: animDelay, type: 'spring', stiffness: 260, damping: 24 }}
        whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onTopicClick(representative, classLevel, chapterTitle, representative.topic)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onTopicClick(representative, classLevel, chapterTitle, representative.topic);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Open ${chapterTitle}`}
        className={`w-full text-left bg-white rounded-2xl border-2 ${c.outline} shadow-md hover:shadow-xl active:shadow-lg transition-shadow duration-200 p-5 sm:p-6 min-h-[184px] sm:min-h-[210px] flex flex-col justify-between group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center text-3xl sm:text-4xl shrink-0 ${c.accent} border border-current/20`}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 mb-0.5" title={crowns > 0 ? `${crowns}/3 mastery` : 'Not started'}>
              {[0, 1, 2].map((i) => (
                <span key={i} className={`text-sm ${i < crowns ? 'opacity-100' : 'opacity-25'}`}>👑</span>
              ))}
            </div>
            <div className="text-sm sm:text-base font-extrabold text-foreground uppercase tracking-wider">
              {unitNumberLabel}
            </div>
            <div className={`text-sm sm:text-base font-extrabold leading-tight ${c.text}`}>{chapterTitle}</div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border/60 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm sm:text-base font-bold text-muted-foreground">
              {periods > 0 ? `${periods} periods` : ""}
            </span>
            {qCount > 0 ? (
              <span className={`px-3 py-1.5 text-xs font-extrabold rounded-lg ${c.btn} text-white shadow-sm group-hover:shadow`}>
                {hasStarted ? 'Revise' : 'Start'}
              </span>
            ) : (
              <span className="px-3 py-1.5 text-xs font-bold rounded-lg bg-muted text-muted-foreground border border-border">Theory</span>
            )}
          </div>
          <span className="text-xs font-medium text-muted-foreground">{topicCount} topics</span>
        </div>
      </motion.div>
    );
  };

  if (physics12Layout) {
    const titleToPaletteIndex = new Map<string, number>();
    const titleToAnimIndex = new Map<string, number>();
    let ordinal = 0;
    for (const sec of CLASS12_PHYSICS_SECTIONS) {
      for (const title of sec.chapters) {
        if (!chapterByTitle.has(title)) continue;
        titleToPaletteIndex.set(title, ordinal);
        titleToAnimIndex.set(title, ordinal);
        ordinal += 1;
      }
    }
    const footerDelay = chapterCards.length * 0.03 + 0.2;
    return (
      <div className="w-full max-w-6xl mx-auto py-6 sm:py-8 select-none px-2">
        {CLASS12_PHYSICS_SECTIONS.map((sec, secIndex) => (
          <section key={sec.heading} className={secIndex > 0 ? 'mt-10' : ''}>
            <h3 className="text-[11px] sm:text-xs font-extrabold tracking-[0.18em] text-muted-foreground uppercase mb-4">
              {sec.heading}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {sec.chapters.map((title) => {
                const chapter = chapterByTitle.get(title);
                if (!chapter) return null;
                const ai = titleToAnimIndex.get(title) ?? 0;
                const pi = titleToPaletteIndex.get(title) ?? 0;
                return (
                  <div
                    key={`${classLevel}-${chapter.unitLabel}-${chapter.chapterTitle}-${chapter.representative.topic}`}
                  >
                    {renderPhysics12Card(chapter, ai * 0.03, pi)}
                  </div>
                );
              })}
              {sec.trailingPlaceholder ? (
                <div
                  className="rounded-2xl border border-dashed border-border/70 bg-muted/25 min-h-[232px] flex flex-col items-center justify-center text-muted-foreground p-6"
                  aria-hidden
                >
                  <span className="text-3xl font-light mb-1">+</span>
                  <span className="text-sm font-semibold text-center">More coming soon.</span>
                </div>
              ) : null}
            </div>
          </section>
        ))}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: footerDelay }}
          className="flex justify-center mt-8"
        >
          <div className="bg-muted/60 rounded-xl px-4 py-2.5 inline-flex items-center gap-2 border border-border/60">
            <p className="text-xs font-bold text-muted-foreground text-center">
              Ready to level up? Pick a unit above to begin. · {CLASS12_PHYSICS_UNIT_COUNT_LABEL} · Class {classLevel}
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-6 sm:py-8 select-none px-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
        {/* Intro card: spans full width, sets the tone inside the deck */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="sm:col-span-2 md:col-span-3 rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4"
        >
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-4xl">🗺️</span>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-primary">Your unit map</div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-foreground">Pick a unit. Unlock it.</h2>
            </div>
          </div>
          <p className="text-sm text-muted-foreground sm:border-l sm:border-border sm:pl-5 sm:ml-2">
            Tap a unit below → read the theory, master each topic, then crush practice. Each card shows how many periods and topics you’ll cover.
          </p>
        </motion.div>

        {chapterCards.map((chapter, index) => (
          <div
            key={`${classLevel}-${chapter.unitLabel}-${chapter.chapterTitle}-${chapter.chapterIndex}-${chapter.representative.topic}-${index}`}
          >
            {renderCard(
              chapter.unitLabel,
              chapter.unitTopics,
              chapter.chapterTitle,
              chapter.chapterTopics,
              chapter.representative,
              chapter.unitRepresentative,
              chapter.unitIndex,
              chapter.chapterIndex,
              index * 0.03
            )}
          </div>
        ))}
      </div>

      {/* Hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: unitCards.length * 0.03 + 0.2 }}
        className="flex justify-center mt-6"
      >
        <div className="bg-muted/60 rounded-xl px-4 py-2.5 inline-flex items-center gap-2 border border-border/60">
          <p className="text-xs font-bold text-muted-foreground">
            Ready to level up? Pick a unit above to begin. · {unitKeys.length} units · Class {classLevel}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const Explore = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const { toast } = useToast();
  const user = useUserStore((s) => s.user);
  const classLevel: ClassLevel | null =
    profile?.role === 'student'
      ? profile.class_level != null
        ? (profile.class_level as ClassLevel)
        : null
      : user?.classLevel ?? null;
  const subjectCombo: SubjectCombo | null =
    profile?.role === 'student' && profile?.subject_combo
      ? (profile.subject_combo as SubjectCombo)
      : user?.subjectCombo ?? null;

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const profileExamType = useUserStore((s) => s.user?.examType ?? null);
  const profileBoard = useUserStore((s) => s.user?.board ?? 'CBSE');
  const setExamType = useUserStore((s) => s.setExamType);
  const [selectedTopicNode, setSelectedTopicNode] = useState<TopicNode | null>(null);
  const [selectedTopicClassLevel, setSelectedTopicClassLevel] = useState<ClassLevel | null>(null);
  const [bitsPopup, setBitsPopup] = useState<{ subtopicName: string; topicNode: TopicNode; classLevel: ClassLevel } | null>(null);
  const [bitsAllPopup, setBitsAllPopup] = useState(false);
  const [visualPlayableOpen, setVisualPlayableOpen] = useState(false);
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [view, setView] = useState<ViewState>('hub');
  const [hoveredSubject, setHoveredSubject] = useState<string | null>(null);
  const [expandedTheoryKeys, setExpandedTheoryKeys] = useState<Set<string>>(new Set());
  const [practicePopupBlock, setPracticePopupBlock] = useState<InteractiveBlock | null>(null);
  const [practiceModePopupOpen, setPracticeModePopupOpen] = useState(false);
  const [focusedSubtopicIndex, setFocusedSubtopicIndex] = useState<number | null>(null);
  const [rouletteOpen, setRouletteOpen] = useState(false);
  const [rouletteMode, setRouletteMode] = useState<'topics' | 'subtopics'>('subtopics');
  const [rouletteChapterTopics, setRouletteChapterTopics] = useState<TopicNode[] | null>(null);
  const [selectedChapterName, setSelectedChapterName] = useState<string | null>(null);
  const [selectedChapterTopicName, setSelectedChapterTopicName] = useState<string | null>(null);
  const [topicWhyStudy, setTopicWhyStudy] = useState('');
  const [topicWhatLearn, setTopicWhatLearn] = useState('');
  const [topicRealWorld, setTopicRealWorld] = useState('');
  const [topicSubtopicPreviews, setTopicSubtopicPreviews] = useState<TopicSubtopicPreview[]>([]);
  const [topicContentExists, setTopicContentExists] = useState(false);
  const [topicContentLoading, setTopicContentLoading] = useState(false);
  const [canEditTopicContent, setCanEditTopicContent] = useState(false);
  const [generatingTopic, setGeneratingTopic] = useState(false);
  const [topicEditorOpen, setTopicEditorOpen] = useState(false);
  const [topicRegenFeedbackOpen, setTopicRegenFeedbackOpen] = useState(false);
  const [chapterScheduleOpen, setChapterScheduleOpen] = useState(false);
  const [chapterScheduleValue, setChapterScheduleValue] = useState(() =>
    toDateTimeLocalValue(new Date(Date.now() + 10 * 60 * 1000))
  );
  const [fbLiked, setFbLiked] = useState('');
  const [fbDisliked, setFbDisliked] = useState('');
  const [fbInstructions, setFbInstructions] = useState('');
  const [topicAgentTrace, setTopicAgentTrace] = useState<TopicAgentTrace | null>(null);
  const [savingTopicContent, setSavingTopicContent] = useState(false);
  const [draftWhyStudy, setDraftWhyStudy] = useState('');
  const [draftWhatLearn, setDraftWhatLearn] = useState('');
  const [draftRealWorld, setDraftRealWorld] = useState('');
  const subtopicRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { taxonomy: topicTaxonomy, loading: taxonomyLoading, error: taxonomyError } = useTopicTaxonomy();
  const orchestratorJobs = useOrchestratorStore((s) => s.jobs);
  const scheduleChapterJob = useOrchestratorStore((s) => s.scheduleChapterJob);

  const THEORY_TRUNCATE_CHARS = 450; // ~4–5 lines; show "Read more" beyond this

  const visibleExamTypes = getVisibleExamTypes();
  const visibleSubjectValues = getVisibleSubjects(classLevel, subjectCombo);
  const visibleSubjectsList = useMemo(
    () => subjects.filter((s) => visibleSubjectValues.includes(s.value)),
    [visibleSubjectValues]
  );
  const visibleExams = useMemo(() => exams.filter((e) => visibleExamTypes.includes(e.value)), [visibleExamTypes]);
  const classesToRender = classLevel != null ? [classLevel] : VISIBLE_CLASSES;

  // Open unit and optionally roulette from URL (?subject=&class=&unit=&spin=1)
  useEffect(() => {
    const sub = searchParams.get('subject') as Subject | null;
    const cls = searchParams.get('class');
    const unitSlug = searchParams.get('unit');
    const spin = searchParams.get('spin') === '1';
    if (!sub || !cls || !unitSlug) return;
    const classNum = parseInt(cls, 10);
    if (classNum < 11 || classNum > 12) return;
    const topicNode = topicTaxonomy.find(
      (n) =>
        n.subject === sub &&
        n.classLevel === classNum &&
        slugify(n.topic) === unitSlug
    );
    if (!topicNode) return;
    setSelectedSubject(sub);
    setSelectedTopicClassLevel(classNum as ClassLevel);
    setSelectedTopicNode(topicNode);
    setSelectedChapterName(chapterGroupKey(topicNode));
    setSelectedChapterTopicName(topicNode.topic);
    setView('topic-detail');
    setFocusedSubtopicIndex(null);
    if (spin) setRouletteOpen(true);
  }, [searchParams, topicTaxonomy]);

  // Get question count for a specific subject
  const getSubjectCount = (subject: Subject) => {
    let filtered = questions.filter((q) => q.subject === subject);
    if (profileExamType) filtered = filtered.filter((q) => examMatchesFilter(profileExamType, q.examType));
    if (classLevel != null) filtered = filtered.filter((q) => q.classLevel <= classLevel);
    return filtered.length;
  };

  // Get question count for a specific topic
  const getTopicCount = (subject: Subject, topic: string) => {
    return questions.filter(
      (q) => q.subject === subject && q.topic === topic && (classLevel == null || q.classLevel <= classLevel)
    ).length;
  };

  // Topics grouped by class for selected subject
  const topicsByClass = useMemo(() => {
    if (!selectedSubject) return {};
    const relevant = topicTaxonomy.filter(
      (t) =>
        t.subject === selectedSubject &&
        (classLevel == null || t.classLevel === classLevel) &&
        (!profileExamType || examMatchesFilter(profileExamType, t.examRelevance))
    );
    const grouped: Record<number, TopicNode[]> = {};
    for (const t of relevant) {
      if (!grouped[t.classLevel]) grouped[t.classLevel] = [];
      grouped[t.classLevel].push(t);
    }
    return grouped;
  }, [selectedSubject, profileExamType, classLevel, topicTaxonomy]);

  // Map of topic → number of answered questions (for crown display)
  const correctByTopic = useMemo(() => {
    const map: Record<string, number> = {};
    if (!user?.answeredQuestions) return map;
    for (const qId of user.answeredQuestions) {
      const q = questions.find((q) => q.id === qId);
      if (!q || (selectedSubject && q.subject !== selectedSubject)) continue;
      map[q.topic] = (map[q.topic] ?? 0) + 1;
    }
    return map;
  }, [user?.answeredQuestions, selectedSubject]);

  const handleSubjectSelect = (subject: Subject) => {
    setSelectedSubject(subject);
    setView('topics');
  };

  const handleTopicClick = (
    topicNode: TopicNode,
    classLvl: ClassLevel,
    preferredChapterName?: string,
    preferredTopicName?: string
  ) => {
    setSelectedTopicNode(topicNode);
    setSelectedTopicClassLevel(classLvl);
    setSelectedChapterName(preferredChapterName ?? topicNode.chapterTitle ?? null);
    setSelectedChapterTopicName(preferredTopicName ?? topicNode.topic ?? null);
    setFocusedSubtopicIndex(null);
    setView('topic-detail');
  };

  const handleStartPractice = (topicOverride?: string) => {
    const topic = topicOverride ?? selectedTopicNode?.topic;
    if (!selectedSubject || !topic) return;
    let filtered = questions.filter(
      (q) => q.subject === selectedSubject && q.topic === topic
    );
    if (profileExamType) filtered = filtered.filter((q) => examMatchesFilter(profileExamType, q.examType));
    if (classLevel != null) filtered = filtered.filter((q) => q.classLevel <= classLevel);
    if (filtered.length > 0) {
      setFilteredQuestions(filtered.sort(() => Math.random() - 0.5));
      setCurrentIndex(0);
      setView('questions');
    }
  };

  const toggleTheoryExpanded = (key: string) => {
    setExpandedTheoryKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /** Back from unit map (topics view) goes to Explore hub. */
  const handleBackFromTopicsToExploreLearning = () => {
    setSelectedSubject(null);
    setView('hub');
  };

  const handleBackToTopics = () => {
    setView('topics');
  };

  const handleBackFromTopicDetail = () => {
    setSelectedTopicNode(null);
    setSelectedTopicClassLevel(null);
    setFocusedSubtopicIndex(null);
    setView('topics');
  };

  // Scroll to focused subtopic when it changes
  useEffect(() => {
    if (focusedSubtopicIndex === null || focusedSubtopicIndex < 0) return;
    const el = subtopicRefs.current[focusedSubtopicIndex];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusedSubtopicIndex]);

  const subjectMeta = subjects.find((s) => s.value === selectedSubject);
  const unitSiblings = useMemo(() => {
    if (!selectedSubject || selectedTopicClassLevel === null || !selectedTopicNode?.unitLabel) return [];
    return topicTaxonomy
      .filter(
        (t) =>
          t.subject === selectedSubject &&
          t.classLevel === selectedTopicClassLevel &&
          t.unitLabel === selectedTopicNode.unitLabel
      )
      .sort((a, b) => {
        const aChapter = (a.chapterTitle ?? '').toLowerCase();
        const bChapter = (b.chapterTitle ?? '').toLowerCase();
        if (aChapter !== bChapter) return aChapter.localeCompare(bChapter);
        return a.topic.localeCompare(b.topic);
      });
  }, [selectedSubject, selectedTopicClassLevel, selectedTopicNode, topicTaxonomy]);

  const unitChapterGroups = useMemo(() => {
    const byChapter = new Map<string, TopicNode[]>();
    for (const node of unitSiblings) {
      const chapterName = node.chapterTitle?.trim() || node.topic;
      const list = byChapter.get(chapterName) ?? [];
      list.push(node);
      byChapter.set(chapterName, list);
    }
    return Array.from(byChapter.entries()).map(([chapter, topics]) => ({ chapter, topics }));
  }, [unitSiblings]);
  const isDetailedUnitView = unitChapterGroups.length > 1 || Boolean(selectedTopicNode?.chapterTitle);
  const selectedChapterGroup = useMemo(() => {
    if (!unitChapterGroups.length) return null;
    return unitChapterGroups.find((g) => g.chapter === selectedChapterName) ?? unitChapterGroups[0];
  }, [selectedChapterName, unitChapterGroups]);
  const selectedChapterTopic = useMemo(() => {
    if (!selectedChapterGroup) return null;
    return (
      selectedChapterGroup.topics.find((t) => t.topic === selectedChapterTopicName) ??
      selectedChapterGroup.topics[0] ??
      null
    );
  }, [selectedChapterGroup, selectedChapterTopicName]);
  const activeTopicForAgent = useMemo(
    () => (isDetailedUnitView ? selectedChapterTopic : selectedTopicNode),
    [isDetailedUnitView, selectedChapterTopic, selectedTopicNode]
  );
  const agentHeading = useMemo(
    () => (isDetailedUnitView ? selectedChapterGroup?.chapter ?? selectedTopicNode?.topic ?? '' : selectedTopicNode?.topic ?? ''),
    [isDetailedUnitView, selectedChapterGroup, selectedTopicNode]
  );

  /** DB key + agent scope: chapter landing vs single-topic hub (must not share the same row). */
  const topicForHub = useMemo(() => {
    if (isDetailedUnitView && selectedChapterGroup) return selectedChapterGroup.chapter;
    return selectedTopicNode?.topic ?? '';
  }, [isDetailedUnitView, selectedChapterGroup, selectedTopicNode]);

  const hubScopeForHub = useMemo((): TopicHubScope => {
    return isDetailedUnitView && selectedChapterGroup ? 'chapter' : 'topic';
  }, [isDetailedUnitView, selectedChapterGroup]);

  /** Labels so “Regenerate” is visibly scoped (chapter row vs topic row in Supabase). */
  const hubAgentUi = useMemo(() => {
    const chapter = hubScopeForHub === 'chapter';
    return {
      regenerateTooltip: chapter
        ? 'Regenerate this whole chapter’s overview (shared intro for the chapter). Does not change individual topic hubs.'
        : 'Regenerate this topic’s hub only. Stored separately from any chapter overview.',
      generateTooltip: chapter ? 'Generate chapter overview with AI' : 'Generate topic info with AI',
      buttonRegenerate: chapter ? 'Regenerate chapter' : 'Regenerate topic',
      buttonGenerate: chapter ? 'Generate chapter overview' : 'Generate Topic Info',
      dialogTitle: chapter ? 'Regenerate chapter overview' : 'Regenerate topic information',
      dialogDescription: chapter
        ? 'Updates the chapter-level intro for this chapter (why study, what you learn, real-world). Each syllabus topic still has its own hub on its topic page until you regenerate there separately.'
        : 'Share what to keep and what to improve. The agent will use your feedback plus fresh textbook context.',
      toastGenerated: chapter ? 'Chapter overview generated' : 'Topic information generated',
      toastRegenerated: chapter ? 'Chapter overview regenerated' : 'Topic information regenerated',
      toastSaved: chapter ? 'Chapter overview saved' : 'Topic information updated',
    };
  }, [hubScopeForHub]);

  const existingScheduledChapterJob = useMemo(() => {
    if (
      hubScopeForHub !== 'chapter' ||
      !selectedSubject ||
      selectedTopicClassLevel === null ||
      !selectedChapterGroup?.chapter
    ) {
      return null;
    }
    return orchestratorJobs.find(
      (job) =>
        job.board === ((String(profileBoard).toUpperCase() === 'ICSE' ? 'ICSE' : 'CBSE') as Board) &&
        job.subject === selectedSubject &&
        job.classLevel === (selectedTopicClassLevel as 11 | 12) &&
        job.chapterTitle === selectedChapterGroup.chapter &&
        (job.status === 'pending' || job.status === 'running')
    ) ?? null;
  }, [
    hubScopeForHub,
    orchestratorJobs,
    profileBoard,
    selectedChapterGroup,
    selectedSubject,
    selectedTopicClassLevel,
  ]);

  const chapterSubtopicNames = useMemo(() => {
    if (!isDetailedUnitView || !selectedChapterGroup) return [];
    return selectedChapterGroup.topics.flatMap((t) => t.subtopics.map((s) => s.name)).filter(Boolean);
  }, [isDetailedUnitView, selectedChapterGroup]);

  const memberTopicTitles = useMemo(() => {
    if (!isDetailedUnitView || !selectedChapterGroup) return [] as string[];
    return selectedChapterGroup.topics.map((t) => t.topic).filter(Boolean);
  }, [isDetailedUnitView, selectedChapterGroup]);

  const topicPreviewByName = useMemo(() => {
    const exact = new Map<string, string>();
    const fuzzy = new Map<string, string>();
    for (const row of topicSubtopicPreviews) {
      const p = row.preview.trim();
      if (!p) continue;
      const ek = row.subtopicName.trim().toLowerCase();
      if (ek && !exact.has(ek)) exact.set(ek, p);
      const fk = fuzzySubtopicKey(row.subtopicName);
      if (fk && !fuzzy.has(fk)) fuzzy.set(fk, p);
    }
    return { get: (name: string) => exact.get(name.trim().toLowerCase()) ?? fuzzy.get(fuzzySubtopicKey(name)) ?? '' };
  }, [topicSubtopicPreviews]);

  /**
   * Keep chapter / syllabus row aligned with the active TopicNode.
   * IMPORTANT: Do not clear chapter when `unitChapterGroups` is briefly empty (same tick as URL
   * deep-link before `selectedTopicNode` commits) — that used to reset to `topics[0]` and show the
   * wrong chapter (e.g. Inverse Trig instead of Relations and Functions).
   */
  useEffect(() => {
    if (!isDetailedUnitView) {
      setSelectedChapterName(null);
      setSelectedChapterTopicName(null);
      return;
    }
    if (unitChapterGroups.length === 0) {
      return;
    }
    setSelectedChapterName((prev) => {
      if (prev && unitChapterGroups.some((g) => g.chapter === prev)) return prev;
      if (selectedTopicNode) {
        const k = chapterGroupKey(selectedTopicNode);
        if (unitChapterGroups.some((g) => g.chapter === k)) return k;
      }
      return unitChapterGroups[0].chapter;
    });
  }, [isDetailedUnitView, unitChapterGroups, selectedTopicNode]);

  useEffect(() => {
    if (!selectedChapterGroup || selectedChapterGroup.topics.length === 0) {
      setSelectedChapterTopicName(null);
      return;
    }
    setSelectedChapterTopicName((prev) => {
      if (prev && selectedChapterGroup.topics.some((t) => t.topic === prev)) return prev;
      if (
        selectedTopicNode?.topic &&
        selectedChapterGroup.topics.some((t) => t.topic === selectedTopicNode.topic)
      ) {
        return selectedTopicNode.topic;
      }
      return selectedChapterGroup.topics[0].topic;
    });
  }, [selectedChapterGroup, selectedTopicNode]);

  useEffect(() => {
    if (
      view !== 'topic-detail' ||
      focusedSubtopicIndex !== null ||
      !selectedSubject ||
      selectedTopicClassLevel === null ||
      !topicForHub.trim()
    ) {
      setTopicWhyStudy('');
      setTopicWhatLearn('');
      setTopicRealWorld('');
      setTopicSubtopicPreviews([]);
      setTopicContentExists(false);
      setCanEditTopicContent(false);
      setTopicContentLoading(false);
      setTopicAgentTrace(null);
      return;
    }
    let cancelled = false;
    const boardName = (String(profileBoard).toUpperCase() === 'ICSE' ? 'ICSE' : 'CBSE') as Board;
    setTopicContentLoading(true);
    fetchTopicContent(
      {
        board: boardName,
        subject: selectedSubject,
        classLevel: selectedTopicClassLevel as 11 | 12,
        topic: topicForHub,
        level: 'basics',
        hubScope: hubScopeForHub,
      }
    )
      .then((res) => {
        if (cancelled) return;
        setTopicWhyStudy(res.whyStudy);
        setTopicWhatLearn(res.whatLearn);
        setTopicRealWorld(res.realWorld);
        setTopicSubtopicPreviews(res.subtopicPreviews ?? []);
        setDraftWhyStudy(res.whyStudy);
        setDraftWhatLearn(res.whatLearn);
        setDraftRealWorld(res.realWorld);
        setTopicContentExists(res.exists);
        setCanEditTopicContent(res.canEdit);
      })
      .catch(() => {
        if (cancelled) return;
        setTopicWhyStudy('');
        setTopicWhatLearn('');
        setTopicRealWorld('');
        setTopicSubtopicPreviews([]);
        setDraftWhyStudy('');
        setDraftWhatLearn('');
        setDraftRealWorld('');
        setTopicContentExists(false);
        setCanEditTopicContent(false);
        setTopicAgentTrace(null);
      })
      .finally(() => {
        if (!cancelled) setTopicContentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, focusedSubtopicIndex, selectedSubject, selectedTopicClassLevel, topicForHub, hubScopeForHub, profileBoard]);

  const boardSlug = (profileBoard || 'cbse').toLowerCase();

  const runImmediateTopicHubGeneration = useCallback(async () => {
    if (
      !topicForHub.trim() ||
      !selectedSubject ||
      selectedTopicClassLevel === null ||
      !activeTopicForAgent
    ) {
      return;
    }

    const boardName = (String(profileBoard).toUpperCase() === 'ICSE' ? 'ICSE' : 'CBSE') as Board;
    const meta = activeTopicForAgent;
    setGeneratingTopic(true);
    try {
      const out = await generateTopicContent({
        board: boardName,
        subject: selectedSubject,
        classLevel: selectedTopicClassLevel as 11 | 12,
        topic: topicForHub,
        level: 'basics',
        hubScope: hubScopeForHub,
        unitLabel: meta.unitLabel,
        unitTitle: meta.unitTitle,
        chapterTitle:
          hubScopeForHub === 'chapter' && selectedChapterGroup
            ? selectedChapterGroup.chapter
            : meta.chapterTitle ?? undefined,
        subtopicNames:
          hubScopeForHub === 'chapter'
            ? chapterSubtopicNames
            : meta.subtopics.map((s) => s.name),
        memberTopicTitles:
          hubScopeForHub === 'chapter' ? memberTopicTitles : undefined,
        mode: 'generate',
        includeTrace: true,
      });
      setTopicWhyStudy(out.whyStudy);
      setTopicWhatLearn(out.whatLearn);
      setTopicRealWorld(out.realWorld);
      setTopicSubtopicPreviews(out.subtopicPreviews ?? []);
      setDraftWhyStudy(out.whyStudy);
      setDraftWhatLearn(out.whatLearn);
      setDraftRealWorld(out.realWorld);
      setTopicContentExists(true);
      setTopicAgentTrace(out.trace ?? null);
      toast({
        title: hubAgentUi.toastGenerated,
        description:
          out.ragChunks != null
            ? `Saved to Supabase · RAG passages used: ${out.ragChunks}`
            : 'Saved to Supabase',
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Generation failed';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setGeneratingTopic(false);
    }
  }, [
    activeTopicForAgent,
    chapterSubtopicNames,
    hubAgentUi.toastGenerated,
    hubScopeForHub,
    memberTopicTitles,
    profileBoard,
    selectedChapterGroup,
    selectedSubject,
    selectedTopicClassLevel,
    toast,
    topicForHub,
  ]);

  const handleScheduleChapterAgent = useCallback(() => {
    if (
      !selectedSubject ||
      selectedTopicClassLevel === null ||
      !selectedChapterGroup?.chapter
    ) {
      return;
    }

    if (existingScheduledChapterJob) {
      toast({
        title: 'Slot already allocated',
        description: `This chapter is already scheduled for ${new Date(
          existingScheduledChapterJob.originalScheduledAt
        ).toLocaleString()}.`,
      });
      return;
    }

    const parsed = new Date(chapterScheduleValue);
    if (Number.isNaN(parsed.getTime())) {
      toast({ title: 'Pick a valid time slot', variant: 'destructive' });
      return;
    }

    const boardName = (String(profileBoard).toUpperCase() === 'ICSE' ? 'ICSE' : 'CBSE') as Board;
    const scheduled = scheduleChapterJob({
      board: boardName,
      subject: selectedSubject,
      classLevel: selectedTopicClassLevel as 11 | 12,
      mode: topicContentExists ? 'regenerate' : 'generate',
      unitLabel: activeTopicForAgent?.unitLabel ?? null,
      unitTitle: activeTopicForAgent?.unitTitle ?? null,
      chapterTitle: selectedChapterGroup.chapter,
      scheduledAt: parsed.toISOString(),
      topics: selectedChapterGroup.topics.map((topic) => ({
        title: topic.topic,
        subtopics: topic.subtopics.map((subtopic) => subtopic.name),
      })),
    });

    if (!scheduled.ok) {
      toast({
        title: 'Slot already allocated',
        description: `This chapter is already scheduled for ${new Date(
          scheduled.existing.originalScheduledAt
        ).toLocaleString()}.`,
      });
      return;
    }

    setChapterScheduleOpen(false);
    toast({
      title: topicContentExists ? 'Chapter regenerate scheduled' : 'Chapter overview scheduled',
      description: `Agent scheduled for ${parsed.toLocaleString()}. It will stay visible even after refresh.`,
    });
  }, [
    activeTopicForAgent,
    chapterScheduleValue,
    existingScheduledChapterJob,
    profileBoard,
    scheduleChapterJob,
    selectedChapterGroup,
    selectedSubject,
    selectedTopicClassLevel,
    toast,
    topicContentExists,
  ]);

  const handleLinearMode = useCallback(() => {
    setPracticeModePopupOpen(false);
    if (!selectedSubject || !selectedTopicClassLevel) return;
    const effectiveTopic = isDetailedUnitView
      ? selectedChapterTopic ?? selectedChapterGroup?.topics?.[0] ?? null
      : selectedTopicNode;
    if (!effectiveTopic) return;
    router.push(
      buildTopicOverviewPath(
        boardSlug,
        selectedSubject,
        selectedTopicClassLevel,
        effectiveTopic.topic,
        'basics'
      )
    );
  }, [
    router,
    selectedSubject,
    selectedTopicClassLevel,
    selectedTopicNode,
    isDetailedUnitView,
    selectedChapterGroup,
    selectedChapterTopic,
    boardSlug,
  ]);

  const handleRandomMode = useCallback(() => {
    setPracticeModePopupOpen(false);
    if (!selectedSubject || !selectedTopicClassLevel) return;
    if (isDetailedUnitView && selectedChapterGroup?.topics?.length) {
      const topics = selectedChapterGroup.topics;
      if (topics.length <= 1) {
        const t = topics[0];
        if (t?.subtopics[0])
          router.push(
            buildTopicPath(
              'cbse',
              selectedSubject,
              selectedTopicClassLevel,
              t.topic,
              t.subtopics[0].name,
              'basics',
              'random'
            )
          );
        return;
      }
      setRouletteMode('topics');
      setRouletteChapterTopics(topics);
      setRouletteOpen(true);
      return;
    }
    if (!selectedTopicNode) return;
    if (selectedTopicNode.subtopics.length <= 1) {
      const st = selectedTopicNode.subtopics[0];
      if (st)
        router.push(
          buildTopicPath(
            'cbse',
            selectedSubject,
            selectedTopicClassLevel,
            selectedTopicNode.topic,
            st.name,
            'basics',
            'random'
          )
        );
      return;
    }
    setRouletteMode('subtopics');
    setRouletteChapterTopics(null);
    setRouletteOpen(true);
  }, [router, selectedSubject, selectedTopicClassLevel, selectedTopicNode, isDetailedUnitView, selectedChapterGroup]);

  const handleRouletteSelect = useCallback(
    (index: number, level: 'basics' | 'intermediate' | 'advanced') => {
      setRouletteOpen(false);
      if (!selectedSubject || !selectedTopicClassLevel) return;
      if (rouletteMode === 'topics' && rouletteChapterTopics?.length) {
        const topicNode = rouletteChapterTopics[index];
        if (!topicNode) return;
        router.push(
          buildTopicOverviewPath(
            'cbse',
            selectedSubject,
            selectedTopicClassLevel,
            topicNode.topic,
            level,
            'random'
          )
        );
        setRouletteChapterTopics(null);
        return;
      }
      if (!selectedTopicNode) return;
      const st = selectedTopicNode.subtopics[index];
      if (!st) return;
      router.push(
        buildTopicPath(
          'cbse',
          selectedSubject,
          selectedTopicClassLevel,
          selectedTopicNode.topic,
          st.name,
          level,
          'random'
        )
      );
    },
    [router, selectedSubject, selectedTopicClassLevel, selectedTopicNode, rouletteMode, rouletteChapterTopics]
  );

  /** `/explore-1?subject=&class=&unit=` — resume chapter/topic after returning from a topic URL. */
  const exploreResumeLink = useMemo(() => {
    const sub = searchParams.get("subject") as Subject | null;
    const cls = searchParams.get("class");
    const unit = searchParams.get("unit");
    if (!sub || !cls || !unit) return null;
    const classNum = parseInt(cls, 10);
    if (classNum < 11 || classNum > 12) return null;
    return { sub, classNum: classNum as ClassLevel, unit };
  }, [searchParams]);

  const exploreResumeMatch = useMemo(() => {
    if (!exploreResumeLink) return null;
    if (taxonomyLoading || topicTaxonomy.length === 0) return "loading" as const;
    const n = topicTaxonomy.find(
      (node) =>
        node.subject === exploreResumeLink.sub &&
        node.classLevel === exploreResumeLink.classNum &&
        slugify(node.topic) === exploreResumeLink.unit
    );
    return n ?? false;
  }, [exploreResumeLink, topicTaxonomy, taxonomyLoading]);

  const showExploreResumeSkeleton =
    Boolean(exploreResumeLink) &&
    view === "hub" &&
    (exploreResumeMatch === "loading" ||
      (typeof exploreResumeMatch === "object" && exploreResumeMatch !== null && !selectedTopicNode));

  const showExploreResumeNotFound =
    Boolean(exploreResumeLink) &&
    view === "hub" &&
    !taxonomyLoading &&
    exploreResumeMatch === false &&
    topicTaxonomy.length > 0;

  return (
    <ProtectedRoute>
      <AppLayout>
        <AnimatePresence initial={false}>
          {showExploreResumeSkeleton && (
            <motion.div
              key="explore-resume-skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-6xl mx-auto px-4 py-8"
            >
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <div className="h-9 w-24 rounded-full bg-muted animate-pulse" />
                <div className="h-9 w-28 rounded-xl bg-muted animate-pulse" />
                <div className="h-9 w-24 rounded-full bg-muted animate-pulse" />
                <div className="h-9 w-20 rounded-full bg-muted animate-pulse" />
              </div>
              <div className="h-8 w-48 rounded-lg bg-muted animate-pulse mb-4" />
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1 min-w-0 space-y-3 rounded-2xl border border-border p-6 bg-card">
                  <div className="h-6 w-3/4 max-w-md rounded bg-muted animate-pulse" />
                  <div className="h-4 w-full rounded bg-muted/70 animate-pulse" />
                  <div className="h-4 w-full rounded bg-muted/70 animate-pulse" />
                  <div className="h-4 w-5/6 rounded bg-muted/70 animate-pulse" />
                  <div className="h-32 w-full rounded-xl bg-muted/50 animate-pulse mt-4" />
                  <div className="h-12 w-40 rounded-xl bg-muted animate-pulse mt-6" />
                </div>
                <aside className="w-full lg:w-80 shrink-0 space-y-4">
                  <div className="rounded-2xl border border-border p-5 space-y-3">
                    <div className="h-4 w-36 rounded bg-muted animate-pulse" />
                    <div className="h-10 w-full rounded-lg bg-muted/70 animate-pulse" />
                    <div className="h-10 w-full rounded-lg bg-muted/70 animate-pulse" />
                    <div className="h-10 w-full rounded-lg bg-muted/70 animate-pulse" />
                  </div>
                  <div className="rounded-2xl border border-border p-5 h-24 bg-muted/30 animate-pulse" />
                </aside>
              </div>
              <p className="text-center text-sm text-muted-foreground mt-6">
                Loading your chapter from the syllabus…
              </p>
            </motion.div>
          )}

          {showExploreResumeNotFound && (
            <motion.div
              key="explore-resume-notfound"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-lg mx-auto py-16 px-4 text-center"
            >
              <p className="text-foreground font-bold mb-2">Topic not found in syllabus</p>
              <p className="text-sm text-muted-foreground mb-6">
                The link may be outdated or this unit is not in your curriculum.
              </p>
              <Button type="button" className="rounded-xl font-bold" onClick={() => router.replace("/explore-1")}>
                Go to Explore
              </Button>
            </motion.div>
          )}

          {view === 'hub' && !showExploreResumeSkeleton && !showExploreResumeNotFound && (
            <motion.div
              key="hub"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ExploreHubDashboard
                onNavigateToSubjects={() => setView('subjects')}
                onNavigateToSubject={handleSubjectSelect}
                onNavigateToTopic={(node) => {
                  setSelectedSubject(node.subject);
                  handleTopicClick(node, node.classLevel, node.chapterTitle ?? undefined, node.topic);
                }}
                onNavigateToSubjectWithExam={(subject, exam) => {
                  setExamType(exam ?? null);
                  setSelectedSubject(subject);
                  setView('topics');
                }}
              />
            </motion.div>
          )}

          {view === 'subjects' && (
            <motion.div
              key="subjects"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-3xl mx-auto"
            >
              <div className="edu-page-header">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView('hub')}
                  className="rounded-full font-extrabold mb-3 -ml-1"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back to Explore & Play
                </Button>
                <h2 className="edu-page-title flex items-center gap-3">
                  <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
                    <Search className="w-5 h-5 text-primary-foreground" />
                  </div>
                  Explore Learning
                </h2>
                <p className="edu-page-desc">Pick a subject to browse topics and questions</p>
              </div>

              <div className="mb-8">
                <h3 className="text-sm font-extrabold text-foreground mb-3 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-primary" /> Exam
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setExamType(null)}
                    className={`px-5 py-2.5 rounded-full text-sm font-extrabold transition-all ${
                      profileExamType === null
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    📘 CBSE
                  </button>
                  {visibleExams.map((e) => (
                    <button
                      key={e.value}
                      type="button"
                      onClick={() => setExamType(profileExamType === e.value ? null : e.value)}
                      className={`px-5 py-2.5 rounded-full text-sm font-extrabold transition-all ${
                        profileExamType === e.value
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {e.emoji} {e.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-sm font-extrabold text-foreground mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Subject
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {visibleSubjectsList.map((s, i) => {
                    const count = getSubjectCount(s.value);
                    const isHovered = hoveredSubject === s.value;
                    return (
                      <motion.button
                        key={s.value}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => handleSubjectSelect(s.value)}
                        onMouseEnter={() => setHoveredSubject(s.value)}
                        onMouseLeave={() => setHoveredSubject(null)}
                        className={`p-5 rounded-2xl text-left transition-all edu-card hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:scale-[1.03] group`}
                      >
                        <div className="mb-2 h-10 w-10 flex items-center justify-start -ml-1">
                          {s.value === 'physics' ? (
                            <AnimatedPhysicsIcon size="44px" isOpen={isHovered} />
                          ) : s.value === 'chemistry' ? (
                            <AnimatedChemistryIcon size="44px" isOpen={isHovered} />
                          ) : s.value === 'math' ? (
                            <AnimatedMathIcon size="44px" isOpen={isHovered} />
                          ) : s.value === 'biology' ? (
                            <AnimatedBiologyIcon size="44px" isOpen={isHovered} />
                          ) : (
                            <span className="text-3xl block">{s.emoji}</span>
                          )}
                        </div>
                        <span className="font-extrabold text-sm block text-foreground">{s.label}</span>
                        <span className="text-xs text-muted-foreground font-bold mt-1 block">
                          {count} questions
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'topics' && selectedSubject && (
            <motion.div
              key="topics"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full max-w-6xl mx-auto px-4"
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackFromTopicsToExploreLearning}
                  className="rounded-full font-extrabold"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <div className={`px-4 py-2 rounded-xl bg-gradient-to-br ${subjectMeta?.gradient} text-primary-foreground flex items-center gap-2`}>
                  <span className="text-lg">{subjectMeta?.emoji}</span>
                  <span className="font-extrabold text-sm">{subjectMeta?.label}</span>
                </div>
                {profileExamType && (
                  <Badge variant="secondary" className="font-bold">
                    {getExamLabel(profileExamType)}
                  </Badge>
                )}
              </div>

              {taxonomyLoading && (
                <div className="mb-6 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm font-semibold text-muted-foreground">
                  Loading syllabus from your account…
                </div>
              )}
              {taxonomyError && !taxonomyLoading && (
                <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground">
                  {taxonomyError}
                </div>
              )}

              {/* Gamified Unit Roadmap (intro text lives inside the grid) */}
              {classesToRender
                .filter((cl) => topicsByClass[cl] && topicsByClass[cl].length > 0)
                .map((cl) => (
                  <UnitRoadmap
                    key={cl}
                    topics={topicsByClass[cl]}
                    subject={selectedSubject}
                    classLevel={cl as ClassLevel}
                    onTopicClick={handleTopicClick}
                    getTopicCount={getTopicCount}
                    correctByTopic={correctByTopic}
                  />
                ))}
            </motion.div>
          )}

          {view === 'topic-detail' && selectedSubject && selectedTopicNode && selectedTopicClassLevel !== null && (
            profileExamType ? (
              /* ——— SEPARATE PAGE: Exam only (JEE Mains etc.). No CBSE. ——— */
              <motion.div
                key="topic-detail-exam"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full max-w-6xl mx-auto"
              >
                <div className="flex items-center gap-3 mb-6 flex-wrap">
                  <Button variant="ghost" size="sm" onClick={handleBackFromTopicDetail} className="rounded-full font-extrabold">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <div className={`px-4 py-2 rounded-xl bg-gradient-to-br ${subjectMeta?.gradient} text-primary-foreground flex items-center gap-2`}>
                    <span className="text-lg">{subjectMeta?.emoji}</span>
                    <span className="font-extrabold text-sm">{subjectMeta?.label}</span>
                  </div>
                  <span className="edu-chip bg-muted text-foreground font-bold">Class {selectedTopicClassLevel}</span>
                  <Badge variant="secondary" className="font-bold">{getExamLabel(profileExamType)}</Badge>
                </div>
                <h2 className="edu-page-title text-2xl mb-1 flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-primary" />
                  {selectedTopicNode.unitLabel ?? "Unit"}
                </h2>
                {!isDetailedUnitView && selectedTopicNode.chapterTitle ? (
                  <p className="text-sm font-semibold text-muted-foreground mb-4">
                    Chapter: <span className="text-foreground">{selectedTopicNode.chapterTitle}</span>
                  </p>
                ) : null}
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="edu-card p-6 rounded-2xl border border-dashed border-muted-foreground/30 bg-muted/20">
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Content for <strong className="text-foreground">{getExamLabel(profileExamType)}</strong> is not yet available. This page is separate from CBSE. When you add {getExamLabel(profileExamType)}-specific information, it will appear here.
                      </p>
                    </div>
                  </div>
                  <aside className="w-full lg:w-80 xl:w-96 shrink-0">
                    <div className="edu-card p-5 rounded-2xl border border-border">
                      <h4 className="font-bold text-foreground text-sm mb-2 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-primary" />
                        Topics in this unit
                      </h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {selectedTopicNode.subtopics.map((st, idx) => (
                          <li key={`exam-st-${idx}-${st.name || 'sub'}`} className="flex gap-2">
                            <span className="text-primary font-medium shrink-0">{idx + 1}.</span>
                            <MathText as="span" className="[&_.katex]:!text-[0.95em]">
                              {subtopicMathTextLabel(st.name)}
                            </MathText>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </aside>
                </div>
              </motion.div>
            ) : (
              /* ——— SEPARATE PAGE: CBSE only. Full CBSE content. ——— */
              <motion.div
                key="topic-detail-cbse"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full max-w-6xl mx-auto"
              >
                <div className="flex items-center gap-3 mb-6 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (focusedSubtopicIndex !== null) {
                        setFocusedSubtopicIndex(null);
                      } else {
                        handleBackFromTopicDetail();
                      }
                    }}
                    className="rounded-full font-extrabold"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <div className={`px-4 py-2 rounded-xl bg-gradient-to-br ${subjectMeta?.gradient} text-primary-foreground flex items-center gap-2`}>
                    <span className="text-lg">{subjectMeta?.emoji}</span>
                    <span className="font-extrabold text-sm">{subjectMeta?.label}</span>
                  </div>
                  <span className="edu-chip bg-muted text-foreground font-bold">Class {selectedTopicClassLevel}</span>
                  <span className="edu-chip bg-primary/10 text-primary font-bold">{profileBoard}</span>
                </div>

                {taxonomyLoading && (
                  <div className="mb-4 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm font-semibold text-muted-foreground">
                    Refreshing syllabus…
                  </div>
                )}
                {taxonomyError && !taxonomyLoading && (
                  <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground">
                    {taxonomyError}
                  </div>
                )}

                <h2 className="edu-page-title text-2xl mb-1 flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-primary" />
                  {selectedTopicNode.unitLabel ?? "Unit"}
                </h2>
                {!isDetailedUnitView && selectedTopicNode.chapterTitle ? (
                  <p className="text-sm font-semibold text-muted-foreground mb-4">
                    Chapter: <span className="text-foreground">{selectedTopicNode.chapterTitle}</span>
                  </p>
                ) : null}

                <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1 min-w-0">
                  {focusedSubtopicIndex === null ? (
                    /* Intro / overview — only when no subtopic selected */
                    <div className="edu-card p-6 rounded-2xl border border-border">
                      {isDetailedUnitView ? (
                        <>
                          {selectedChapterGroup && (
                            <div className="space-y-4">
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                <h3 className="font-extrabold text-lg text-foreground flex items-center gap-2">
                                  <Sparkles className="w-5 h-5 text-primary" />
                                  Let&apos;s take a look at {agentHeading}
                                </h3>
                                {canEditTopicContent ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-muted text-muted-foreground">
                                      Admin
                                    </span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="rounded-xl gap-2 font-bold shrink-0"
                                      disabled={generatingTopic || savingTopicContent}
                                      onClick={() => {
                                        setDraftWhyStudy(topicWhyStudy);
                                        setDraftWhatLearn(topicWhatLearn);
                                        setDraftRealWorld(topicRealWorld);
                                        setTopicEditorOpen((prev) => !prev);
                                      }}
                                      title="Edit and save topic info"
                                    >
                                      {topicEditorOpen ? 'Close Edit' : 'Edit'}
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      className="rounded-xl gap-2 font-bold shrink-0"
                                      disabled={
                                        generatingTopic ||
                                        topicContentLoading ||
                                        !topicForHub.trim() ||
                                        !selectedSubject ||
                                        selectedTopicClassLevel === null
                                      }
                                      title={
                                        topicContentExists
                                          ? hubAgentUi.regenerateTooltip
                                          : hubAgentUi.generateTooltip
                                      }
                                      onClick={async () => {
                                        if (
                                          !topicForHub.trim() ||
                                          !selectedSubject ||
                                          selectedTopicClassLevel === null ||
                                          !activeTopicForAgent
                                        )
                                          return;
                                      if (hubScopeForHub === 'chapter') {
                                        setChapterScheduleOpen(true);
                                        return;
                                      }
                                      if (topicContentExists) {
                                        setFbLiked('');
                                        setFbDisliked('');
                                        setFbInstructions('');
                                        setTopicRegenFeedbackOpen(true);
                                        return;
                                      }
                                      await runImmediateTopicHubGeneration();
                                    }}
                                  >
                                    <Bot className="w-4 h-4" />
                                    {generatingTopic
                                      ? topicContentExists
                                        ? 'Regenerating…'
                                        : 'Generating…'
                                      : topicContentExists
                                        ? hubAgentUi.buttonRegenerate
                                        : hubAgentUi.buttonGenerate}
                                  </Button>
                                  {hubScopeForHub === 'chapter' && existingScheduledChapterJob ? (
                                    <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                                      Slot already allocated for{' '}
                                      {new Date(existingScheduledChapterJob.originalScheduledAt).toLocaleString()}.
                                    </p>
                                  ) : null}
                                  </div>
                                ) : null}
                              </div>
                              {canEditTopicContent ? (
                                <TopicAgentTracePanel trace={topicAgentTrace} onClear={() => setTopicAgentTrace(null)} />
                              ) : null}
                              <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                                <div>
                                  <h4 className="font-bold text-foreground text-sm mb-1">Why study this topic?</h4>
                                  {topicContentLoading ? (
                                    <p>Loading…</p>
                                  ) : topicContentExists && topicWhyStudy.trim() ? (
                                    <div className="theory-content">
                                      <TheoryContent theory={decodeAiEscapes(topicWhyStudy)} />
                                    </div>
                                  ) : (
                                    <p>—</p>
                                  )}
                                </div>
                                <div>
                                  <h4 className="font-bold text-foreground text-sm mb-1">What you will learn</h4>
                                  {topicContentLoading ? (
                                    <p>Loading…</p>
                                  ) : topicContentExists && topicWhatLearn.trim() ? (
                                    <div className="theory-content">
                                      <TheoryContent theory={decodeAiEscapes(topicWhatLearn)} />
                                    </div>
                                  ) : (
                                    <p>—</p>
                                  )}
                                </div>
                                <div>
                                  <h4 className="font-bold text-foreground text-sm mb-1">Real-world importance</h4>
                                  {topicContentLoading ? (
                                    <p>Loading…</p>
                                  ) : topicContentExists && topicRealWorld.trim() ? (
                                    <div className="theory-content">
                                      <TheoryContent theory={decodeAiEscapes(topicRealWorld)} />
                                    </div>
                                  ) : (
                                    <p>—</p>
                                  )}
                                </div>
                              </div>
                              {topicEditorOpen && canEditTopicContent && (
                                <div className="mt-2 space-y-3 rounded-xl border border-border bg-background/80 p-3">
                                  <p className="text-xs font-semibold text-muted-foreground">Why study this topic? (markdown)</p>
                                  <textarea
                                    value={draftWhyStudy}
                                    onChange={(e) => setDraftWhyStudy(e.target.value)}
                                    className="w-full min-h-[110px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                    placeholder="Write why-study section..."
                                  />
                                  <p className="text-xs font-semibold text-muted-foreground">What you will learn (markdown)</p>
                                  <textarea
                                    value={draftWhatLearn}
                                    onChange={(e) => setDraftWhatLearn(e.target.value)}
                                    className="w-full min-h-[110px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                    placeholder="Write learning outcomes..."
                                  />
                                  <p className="text-xs font-semibold text-muted-foreground">Real-world importance (markdown)</p>
                                  <textarea
                                    value={draftRealWorld}
                                    onChange={(e) => setDraftRealWorld(e.target.value)}
                                    className="w-full min-h-[110px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                    placeholder="Write real-world impact..."
                                  />
                                  <div className="flex items-center gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="rounded-lg"
                                      disabled={
                                        savingTopicContent ||
                                        !topicForHub.trim() ||
                                        !selectedSubject ||
                                        selectedTopicClassLevel === null
                                      }
                                      onClick={async () => {
                                        if (!topicForHub.trim() || !selectedSubject || selectedTopicClassLevel === null) return;
                                        const boardName = (String(profileBoard).toUpperCase() === 'ICSE' ? 'ICSE' : 'CBSE') as Board;
                                        setSavingTopicContent(true);
                                        try {
                                          await upsertTopicContent({
                                            board: boardName,
                                            subject: selectedSubject,
                                            classLevel: selectedTopicClassLevel as 11 | 12,
                                            topic: topicForHub,
                                            level: 'basics',
                                            hubScope: hubScopeForHub,
                                            whyStudy: draftWhyStudy,
                                            whatLearn: draftWhatLearn,
                                            realWorld: draftRealWorld,
                                            subtopicPreviews: topicSubtopicPreviews,
                                          });
                                          setTopicWhyStudy(draftWhyStudy);
                                          setTopicWhatLearn(draftWhatLearn);
                                          setTopicRealWorld(draftRealWorld);
                                          setTopicContentExists(true);
                                          setTopicEditorOpen(false);
                                          toast({ title: hubAgentUi.toastSaved });
                                        } catch (e) {
                                          const message = e instanceof Error ? e.message : 'Save failed';
                                          toast({ title: message, variant: 'destructive' });
                                        } finally {
                                          setSavingTopicContent(false);
                                        }
                                      }}
                                    >
                                      {savingTopicContent ? 'Saving…' : 'Save'}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="rounded-lg"
                                      disabled={savingTopicContent}
                                      onClick={() => {
                                        setDraftWhyStudy(topicWhyStudy);
                                        setDraftWhatLearn(topicWhatLearn);
                                        setDraftRealWorld(topicRealWorld);
                                        setTopicEditorOpen(false);
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      ) : selectedTopicNode.topic === 'Thermodynamics' ? (
                        <>
                          <h3 className="font-extrabold text-lg text-foreground mb-3 flex items-center gap-2">
                            <span className="text-xl">⚙️</span>
                            Thermodynamics: The Physics of Absolute Limits
                          </h3>
                          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                            <div>
                              <h4 className="font-bold text-foreground text-sm mb-1">Why study this topic? (The Strategic View)</h4>
                              <p>
                                Let&apos;s be brutally honest: you study Thermodynamics because it is one of the highest-ROI (Return on Investment) chapters in competitive exams. Unlike Rotational Mechanics, the math here isn&apos;t going to crush you. The failure point in Thermodynamics is purely logical. If you mess up the sign conventions—confusing work done by the system with work done on the system—your entire calculation collapses. Mastering this chapter means securing guaranteed marks by adopting a flawless, uncompromising approach to energy accounting.
                              </p>
                            </div>
                            <div>
                              <h4 className="font-bold text-foreground text-sm mb-1">What you will actually learn (The System Architecture)</h4>
                              <p className="space-y-2">
                                This unit isn&apos;t about memorizing definitions; it&apos;s about analyzing closed systems. Over these {selectedTopicNode.subtopics.length} topics, you will map exactly how energy enters, transforms, and exits a system.
                              </p>
                              <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                                <li><strong className="text-foreground">The First Law:</strong> The universal ledger (<code className="px-1 py-0.5 bg-muted rounded text-xs">Q = ΔU + W</code>). You will learn to track every joule of heat, internal energy, and mechanical work.</li>
                                <li><strong className="text-foreground">Indicator Diagrams:</strong> Translating physical processes into <code className="px-1 py-0.5 bg-muted rounded text-xs">P-V</code> graphs to instantly calculate output.</li>
                                <li><strong className="text-foreground">The Second Law:</strong> The harsh truth of reality. You will calculate entropy and understand why a 100% efficient engine is a physical impossibility.</li>
                              </ul>
                            </div>
                            <div>
                              <h4 className="font-bold text-foreground text-sm mb-1">Real-World Importance (Beyond the Textbook)</h4>
                              <p>
                                Thermodynamics is the absolute boundary condition for reality. It is the exact reason why a high-performance processor will thermally throttle and drop frame rates when pushed to its limits during intense rendering or heavy workloads. It dictates the maximum efficiency of car engines, the design of advanced cooling systems, and the structural limits of hardware. You cannot engineer a physical product, build a heavy-duty tech system, or launch a hardware startup without answering to the laws of thermodynamics.
                              </p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <h3 className="font-extrabold text-lg text-foreground mb-3 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-primary" />
                            Let&apos;s take a look at {selectedTopicNode.topic}
                          </h3>
                          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                            <div>
                              <h4 className="font-bold text-foreground text-sm mb-1">Why study this topic?</h4>
                              <p>
                                {selectedTopicNode.topic} is a foundational unit that connects to many advanced concepts. Mastering it will help you build strong problem-solving skills and understand real-world applications.
                              </p>
                            </div>
                            <div>
                              <h4 className="font-bold text-foreground text-sm mb-1">What you will learn</h4>
                              <p>
                                You will explore core principles, key formulas, and their applications. This unit covers {selectedTopicNode.subtopics.length} topics that together form a complete picture of {selectedTopicNode.topic}.
                              </p>
                            </div>
                            <div>
                              <h4 className="font-bold text-foreground text-sm mb-1">Real-world importance</h4>
                              <p>
                                Concepts from {selectedTopicNode.topic} appear in engineering, medicine, research, and everyday technology. A solid grasp here will serve you well in competitive exams and beyond.
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                      <div className="mt-6 pt-4 border-t border-border flex flex-wrap items-center gap-3">
                        <Button
                          size="lg"
                          onClick={() => setPracticeModePopupOpen(true)}
                          className="rounded-xl gap-2 edu-btn-primary w-full sm:w-auto"
                        >
                          <Play className="w-4 h-4" /> {isDetailedUnitView ? 'Start Chapter' : 'Start'}
                        </Button>
                        {(isDetailedUnitView
                          ? Boolean(selectedChapterTopic && getTopicCount(selectedSubject, selectedChapterTopic.topic) > 0)
                          : getTopicCount(selectedSubject, selectedTopicNode.topic) > 0) && (
                          <Button
                            size="lg"
                            variant="outline"
                            onClick={() => handleStartPractice(isDetailedUnitView ? selectedChapterTopic?.topic : undefined)}
                            className="rounded-xl gap-2"
                          >
                            Practice MCQs
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Single subtopic page — only one visible at a time */
                    (() => {
                      const idx = focusedSubtopicIndex;
                      const st = selectedTopicNode.subtopics[idx];
                      if (!st) return null;
                      const theoryData = getTheoryOrPlaceholder(selectedSubject, selectedTopicClassLevel, selectedTopicNode.topic, st.name);
                      const theoryKey = `${selectedTopicNode.topic}-${st.name}`;
                      const generatedPreview = topicPreviewByName.get(st.name.toLowerCase()) ?? '';
                      const theoryOrPreview = generatedPreview || theoryData.theory;
                      const isPlaceholder =
                        !generatedPreview &&
                        (theoryData.theory.includes('Study your textbook and notes') ||
                          theoryData.theory.includes('Key ideas will appear'));
                      const isLong = theoryOrPreview.length > THEORY_TRUNCATE_CHARS;
                      const isExpanded = expandedTheoryKeys.has(theoryKey);
                      const truncateAt = theoryOrPreview.lastIndexOf(' ', THEORY_TRUNCATE_CHARS);
                      const displayTheory = isLong && !isExpanded
                        ? theoryOrPreview.slice(0, truncateAt > 200 ? truncateAt : THEORY_TRUNCATE_CHARS).trim() + '...'
                        : theoryOrPreview;
                      const isFirst = idx === 0;
                      const isLast = idx === selectedTopicNode.subtopics.length - 1;
                      const outlineColors = ['border-primary/50', 'border-emerald-500/50', 'border-amber-500/50', 'border-violet-500/50'];
                      const outlineColor = outlineColors[idx % outlineColors.length];
                      return (
                        <motion.div
                          key={`subtopic-card-${idx}-${st.name || 'st'}`}
                          ref={(el) => { subtopicRefs.current[idx] = el; }}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className={`edu-card p-6 rounded-2xl border-2 shadow-lg ${isPlaceholder ? `border-dashed ${outlineColor} bg-muted/10` : 'border-primary/30 ring-2 ring-primary/20'}`}
                        >
                          <div className="flex items-center justify-end mb-4">
                            <span className="text-sm font-bold text-muted-foreground">
                              {idx + 1} / {selectedTopicNode.subtopics.length}
                            </span>
                          </div>
                          <h3 className="font-extrabold text-lg text-foreground mb-3 flex items-center gap-2 min-w-0">
                            <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm text-primary shrink-0">{idx + 1}</span>
                            <MathText weight="extrabold" className="min-w-0 break-words leading-snug [&_.katex]:!text-[0.95em]">
                              {subtopicMathTextLabel(st.name)}
                            </MathText>
                          </h3>
                          <div className="text-sm mb-4">
                            {isPlaceholder ? (
                              <div className={`min-h-[120px] rounded-xl border-2 border-dashed ${outlineColor} flex items-center justify-center p-6 text-center`}>
                                <p className="text-muted-foreground text-sm">Content coming soon. Refer to your textbook for {subtopicNavPreviewPlain(st.name)}.</p>
                              </div>
                            ) : generatedPreview ? (
                              <div className="theory-content text-[15px] leading-relaxed text-muted-foreground">
                                <TheoryContent theory={displayTheory} />
                              </div>
                            ) : (
                            <TheoryContentWithDeepDive
                              theory={displayTheory}
                              bits={theoryData.bits ?? []}
                              deepDiveHref={(sectionIndex) =>
                                buildDeepDivePath(
                                  (profileBoard || 'cbse').toLowerCase(),
                                  selectedSubject!,
                                  selectedTopicClassLevel!,
                                  selectedTopicNode.topic,
                                  st.name,
                                  'basics',
                                  sectionIndex
                                )
                              }
                              showPerSectionButtons={false}
                            />
                            )}
                          </div>
                          {!isPlaceholder && isLong && (
                            <button
                              type="button"
                              onClick={() => toggleTheoryExpanded(theoryKey)}
                              className="text-sm font-semibold text-primary hover:underline mb-4"
                            >
                              {isExpanded ? 'Read less' : 'Read more'}
                            </button>
                          )}
                          {theoryData.interactiveBlocks && theoryData.interactiveBlocks.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-border">
                              <h4 className="font-bold text-foreground mb-3 text-sm">Practice — Test your understanding</h4>
                              <InteractiveTheoryRenderer blocks={theoryData.interactiveBlocks} />
                            </div>
                          )}
                          {(!isDetailedUnitView || (selectedChapterGroup?.topics.length ?? 0) > 1) && (
                            <div className="mt-6 pt-4 border-t border-border flex items-center gap-3">
                              {!isFirst && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setFocusedSubtopicIndex(idx - 1)}
                                  className="rounded-xl gap-2 font-bold"
                                >
                                  <ArrowLeft className="w-4 h-4" /> Previous subtopic
                                </Button>
                              )}
                              {!isLast && (
                                <Button
                                  size="sm"
                                  onClick={() => setFocusedSubtopicIndex(idx + 1)}
                                  className="rounded-xl gap-2 font-bold edu-btn-primary"
                                >
                                  Next subtopic <ChevronRight className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </motion.div>
                      );
                    })()
                  )}
                </div>

                <aside className="w-full lg:w-80 xl:w-96 shrink-0">
                  <div className="lg:sticky lg:top-24 space-y-4">
                    {focusedSubtopicIndex != null && selectedTopicNode && (() => {
                      const st = selectedTopicNode.subtopics[focusedSubtopicIndex];
                      if (!st) return null;
                      const td = getTheoryOrPlaceholder(selectedSubject!, selectedTopicClassLevel!, selectedTopicNode.topic, st.name);
                      return (
                        <DeepDiveLinearSelector
                          sections={parseTheorySections(td.theory).sections}
                          buildDeepDiveHref={(sectionIndex) =>
                            buildDeepDivePath(
                              (profileBoard || 'cbse').toLowerCase(),
                              selectedSubject!,
                              selectedTopicClassLevel!,
                              selectedTopicNode.topic,
                              st.name,
                              'basics',
                              sectionIndex
                            )
                          }
                        />
                      );
                    })()}
                    <div className="edu-card p-5 rounded-2xl border border-border">
                      <h4 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-primary" />
                        {isDetailedUnitView ? 'Chapter syllabus' : 'Current topic subtopics'}
                      </h4>
                      {isDetailedUnitView ? (
                        <div className="space-y-2">
                          <div className="rounded-xl border border-border/60 bg-background/70 overflow-hidden">
                            {(selectedChapterGroup?.topics ?? [])
                            .slice()
                            .sort((a, b) => a.topic.localeCompare(b.topic))
                            .map((topic, idx) => {
                              const isActive = selectedChapterTopic?.topic === topic.topic;
                              return (
                                <button
                                  type="button"
                                  key={`ct-${idx}-${topic.topic || 'topic'}`}
                                  onClick={() => {
                                    setSelectedChapterTopicName(topic.topic);
                                    if (!selectedSubject || selectedTopicClassLevel === null) return;
                                    router.push(
                                      buildTopicOverviewPath(
                                        boardSlug,
                                        selectedSubject,
                                        selectedTopicClassLevel,
                                        topic.topic,
                                        'basics'
                                      )
                                    );
                                  }}
                                  className={`w-full text-left px-3 py-3 transition-colors border-l-2 ${
                                    isActive
                                      ? 'border-l-primary bg-primary/10'
                                      : 'border-l-transparent hover:bg-muted/40'
                                  } ${idx !== 0 ? 'border-t border-border/60' : ''}`}
                                >
                                  <div className="flex items-start gap-3">
                                    <span
                                      className={`mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-xs font-extrabold ${
                                        isActive
                                          ? 'bg-primary text-primary-foreground'
                                          : 'bg-muted text-muted-foreground'
                                      }`}
                                    >
                                      {idx + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className={`truncate text-sm ${isActive ? 'font-extrabold text-foreground' : 'font-semibold text-foreground'}`}>
                                        {topic.topic}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        {topic.subtopics.length} subtopics
                                      </p>
                                    </div>
                                    {isActive && (
                                      <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                        Current
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          {(selectedChapterGroup?.topics?.length ?? 0) === 1 && selectedChapterTopic && (
                            <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                              <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground mb-2">
                                Subtopics in {selectedChapterTopic.topic}
                              </p>
                              <ul className="space-y-1.5 text-xs text-muted-foreground">
                                {selectedChapterTopic.subtopics.map((st, i) => (
                                  <li key={`one-topic-subtopic-${i}-${st.name}`} className="flex gap-2">
                                    <span className="text-primary font-medium shrink-0">{i + 1}.</span>
                                    <MathText as="span" className="[&_.katex]:!text-[0.9em]">
                                      {subtopicMathTextLabel(st.name)}
                                    </MathText>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          {selectedTopicNode.subtopics.map((st, idx) => (
                            <li key={`cbse-sidebar-st-${idx}-${st.name || 'st'}`} className="flex gap-2 min-w-0">
                              <span className="text-primary font-medium shrink-0">{idx + 1}.</span>
                              <MathText as="span" className="min-w-0 [&_.katex]:!text-[0.9em]">
                                {subtopicMathTextLabel(st.name)}
                              </MathText>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="edu-card p-5 rounded-2xl border border-border">
                      <h4 className="font-bold text-foreground text-sm mb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        Exam weightage
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedTopicNode.totalPeriods != null
                          ? `~${Math.round((selectedTopicNode.totalPeriods / 200) * 100)}% of syllabus`
                          : '~5–8% of exam'}
                        {selectedTopicNode.totalPeriods != null && (
                          <span className="block mt-1 text-xs">
                            {selectedTopicNode.totalPeriods} periods
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </aside>
              </div>

              <Dialog open={practiceModePopupOpen} onOpenChange={setPracticeModePopupOpen}>
                <DialogContent className="rounded-2xl max-w-2xl p-0 overflow-hidden border-2 border-primary/20 shadow-2xl">
                  <div className="bg-gradient-to-br from-primary/5 via-background to-teal-500/5 p-6">
                    <DialogHeader className="text-center mb-6">
                      <p className="text-xs font-bold uppercase tracking-widest text-primary/80 mb-1">Select your path</p>
                      <DialogTitle className="text-xl font-black text-foreground">Choose practice mode</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <motion.button
                        type="button"
                        onClick={handleLinearMode}
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        className="group relative overflow-hidden rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 p-6 text-left shadow-lg hover:border-emerald-500/60 hover:shadow-emerald-500/20 hover:shadow-xl transition-all duration-200"
                      >
                        <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/30 transition-colors">
                          <ListOrdered className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-3xl">📖</span>
                          <h3 className="text-lg font-black text-foreground">Linear</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                          Continuous, line-by-line topics — like reading a book. Topics flow in a fixed, logical order.
                        </p>
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Steady progress · Build foundations
                        </span>
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={handleRandomMode}
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        className="group relative overflow-hidden rounded-2xl border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-6 text-left shadow-lg hover:border-amber-500/60 hover:shadow-amber-500/20 hover:shadow-xl transition-all duration-200"
                      >
                        <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
                          <Shuffle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-3xl">🎲</span>
                          <h3 className="text-lg font-black text-foreground">Random</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                          Random topics — shuffled for variety. Makes practice more interesting and helps build retention.
                        </p>
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          High engagement · Test your recall
                        </span>
                      </motion.button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {rouletteOpen && selectedSubject && (rouletteMode === 'topics' && rouletteChapterTopics?.length ? (
                <TopicRoulette
                  subtopics={rouletteChapterTopics.map((t) => ({ name: t.topic }))}
                  onSelect={handleRouletteSelect}
                  onClose={() => {
                    setRouletteOpen(false);
                    setRouletteChapterTopics(null);
                  }}
                />
              ) : selectedTopicNode ? (
                <TopicRoulette
                  subtopics={selectedTopicNode.subtopics}
                  onSelect={handleRouletteSelect}
                  onClose={() => setRouletteOpen(false)}
                />
              ) : null)}

              <Dialog open={bitsAllPopup} onOpenChange={setBitsAllPopup}>
                <DialogContent className="rounded-2xl max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-primary" /> Bits — {selectedTopicNode?.topic}
                    </DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    Click the Practice questions button for related MCQs.
                  </p>
                </DialogContent>
              </Dialog>

              <Dialog open={!!bitsPopup} onOpenChange={(open) => !open && setBitsPopup(null)}>
                <DialogContent className="rounded-2xl max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-primary" /> Bits
                      {bitsPopup && <span className="font-normal text-muted-foreground">— {bitsPopup.subtopicName}</span>}
                    </DialogTitle>
                  </DialogHeader>
                  {bitsPopup && selectedSubject && (
                    <>
                      {(() => {
                        const mcqs = getQuestionsForSubtopic(
                          selectedSubject,
                          bitsPopup.topicNode.topic,
                          bitsPopup.classLevel,
                          bitsPopup.subtopicName,
                          5
                        );
                        if (mcqs.length === 0) {
                          return (
                            <p className="text-sm text-muted-foreground">No MCQs for this topic yet. Use InstaCue cards on the right for quick revision.</p>
                          );
                        }
                        return <BitsMCQs questions={mcqs} />;
                      })()}
                    </>
                  )}
                </DialogContent>
              </Dialog>

              <Dialog open={visualPlayableOpen} onOpenChange={setVisualPlayableOpen}>
                <DialogContent className="rounded-2xl max-w-2xl p-0 overflow-hidden">
                  <DialogHeader className="px-5 pt-5 pb-2">
                    <DialogTitle className="flex items-center gap-2">
                      <Box className="w-5 h-5 text-primary" /> Visual playable — Distance & Displacement
                    </DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground px-5 pb-2">Drag to rotate, scroll to zoom. Orange path = distance; blue line = displacement; green track = one lap (distance 2πr, displacement 0).</p>
                  <div className="px-5 pb-5">
                    <DistanceDisplacementScene />
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={!!practicePopupBlock} onOpenChange={(open) => !open && setPracticePopupBlock(null)}>
                <DialogContent className="rounded-2xl max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-primary" /> Practice
                    </DialogTitle>
                  </DialogHeader>
                  {practicePopupBlock && (
                    <InteractiveTheoryRenderer blocks={[practicePopupBlock]} />
                  )}
                </DialogContent>
              </Dialog>
              </motion.div>
            ))}

          <Fragment key="explore-topic-regenerate-dialog">
          <Dialog open={chapterScheduleOpen} onOpenChange={setChapterScheduleOpen}>
            <DialogContent className="rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {topicContentExists ? 'Schedule chapter regeneration' : 'Schedule chapter overview'}
                </DialogTitle>
                <DialogDescription>
                  Pick the time when the orchestrator should start this chapter. It will generate
                  the chapter overview first, then topic hubs for basics, intermediate, and
                  advanced, then every subtopic AI pack with formula retries and fallback checks.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {existingScheduledChapterJob ? (
                  <div className="rounded-xl border border-amber-300/60 bg-amber-50/70 dark:bg-amber-950/20 p-3">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                      You have already allocated the slot.
                    </p>
                    <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-300">
                      Current slot: {new Date(existingScheduledChapterJob.originalScheduledAt).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-300">
                      Status: {existingScheduledChapterJob.status}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label
                        htmlFor="chapter-orchestrator-time"
                        className="text-sm font-semibold text-foreground"
                      >
                        Activation time
                      </label>
                      <input
                        id="chapter-orchestrator-time"
                        type="datetime-local"
                        value={chapterScheduleValue}
                        onChange={(e) => setChapterScheduleValue(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                      After this chapter finishes, the next scheduled chapter will start immediately
                      so overlapping does not happen. If a previous chapter overruns the next slot,
                      the runner will show the delay automatically.
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-lg"
                  onClick={() => setChapterScheduleOpen(false)}
                >
                  Close
                </Button>
                {!existingScheduledChapterJob ? (
                  <Button type="button" className="rounded-lg" onClick={handleScheduleChapterAgent}>
                    Allocate slot
                  </Button>
                ) : null}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={topicRegenFeedbackOpen} onOpenChange={setTopicRegenFeedbackOpen}>
            <DialogContent className="rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{hubAgentUi.dialogTitle}</DialogTitle>
                <DialogDescription>{hubAgentUi.dialogDescription}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-bold text-muted-foreground mb-1">What did you like? (keep)</p>
                  <textarea
                    value={fbLiked}
                    onChange={(e) => setFbLiked(e.target.value)}
                    className="w-full min-h-[80px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    placeholder="Sections or tone to preserve…"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground mb-1">What should improve?</p>
                  <textarea
                    value={fbDisliked}
                    onChange={(e) => setFbDisliked(e.target.value)}
                    className="w-full min-h-[80px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    placeholder="What felt weak, too long, or off-syllabus…"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground mb-1">Any extra instruction?</p>
                  <textarea
                    value={fbInstructions}
                    onChange={(e) => setFbInstructions(e.target.value)}
                    className="w-full min-h-[72px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    placeholder="Tone, depth, language, exam focus…"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" className="rounded-lg" onClick={() => setTopicRegenFeedbackOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="rounded-lg"
                  disabled={
                    generatingTopic ||
                    !topicForHub.trim() ||
                    !activeTopicForAgent ||
                    !canEditTopicContent ||
                    !selectedSubject ||
                    selectedTopicClassLevel === null
                  }
                  onClick={async () => {
                    if (
                      !topicForHub.trim() ||
                      !activeTopicForAgent ||
                      !canEditTopicContent ||
                      !selectedSubject ||
                      selectedTopicClassLevel === null
                    )
                      return;
                    const boardName = (String(profileBoard).toUpperCase() === 'ICSE' ? 'ICSE' : 'CBSE') as Board;
                    const meta = activeTopicForAgent;
                    setTopicRegenFeedbackOpen(false);
                    setGeneratingTopic(true);
                    try {
                      const out = await generateTopicContent({
                        board: boardName,
                        subject: selectedSubject,
                        classLevel: selectedTopicClassLevel as 11 | 12,
                        topic: topicForHub,
                        level: 'basics',
                        hubScope: hubScopeForHub,
                        unitLabel: meta.unitLabel,
                        unitTitle: meta.unitTitle,
                        chapterTitle:
                          hubScopeForHub === 'chapter' && selectedChapterGroup
                            ? selectedChapterGroup.chapter
                            : meta.chapterTitle ?? undefined,
                        subtopicNames:
                          hubScopeForHub === 'chapter'
                            ? chapterSubtopicNames
                            : meta.subtopics.map((s) => s.name),
                        memberTopicTitles:
                          hubScopeForHub === 'chapter' ? memberTopicTitles : undefined,
                        mode: 'regenerate',
                        feedback: {
                          liked: fbLiked,
                          disliked: fbDisliked,
                          instructions: fbInstructions,
                        },
                        includeTrace: true,
                      });
                      setTopicWhyStudy(out.whyStudy);
                      setTopicWhatLearn(out.whatLearn);
                      setTopicRealWorld(out.realWorld);
                      setTopicSubtopicPreviews(out.subtopicPreviews ?? []);
                      setDraftWhyStudy(out.whyStudy);
                      setDraftWhatLearn(out.whatLearn);
                      setDraftRealWorld(out.realWorld);
                      setTopicContentExists(true);
                      setTopicAgentTrace(out.trace ?? null);
                      toast({
                        title: hubAgentUi.toastRegenerated,
                        description:
                          out.ragChunks != null
                            ? `Saved to Supabase · RAG passages used: ${out.ragChunks}`
                            : 'Saved to Supabase',
                      });
                    } catch (e) {
                      const message = e instanceof Error ? e.message : 'Regeneration failed';
                      toast({ title: message, variant: 'destructive' });
                    } finally {
                      setGeneratingTopic(false);
                    }
                  }}
                >
                  {generatingTopic ? 'Regenerating…' : 'Submit & regenerate'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </Fragment>

          {/* Subject AI Chatbot – appears on topic-detail view */}
          <Fragment key="explore-subject-chatbot">
          {view === 'topic-detail' && selectedSubject && selectedTopicNode && (
            <SubjectChatbot
              subject={selectedSubject}
              topic={selectedTopicNode.topic}
              subtopic={selectedTopicNode.subtopics[0]?.name}
              gradeLevel={selectedTopicClassLevel ?? undefined}
            />
          )}
          </Fragment>

          {view === 'questions' && (
            <motion.div
              key="questions"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl mx-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBackToTopics}
                  className="rounded-full font-extrabold border-primary/30 text-primary hover:bg-primary/10"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back to topics
                </Button>
                <span className="text-sm text-muted-foreground font-bold edu-chip bg-muted">
                  {currentIndex + 1} / {filteredQuestions.length}
                </span>
              </div>
              {filteredQuestions.length > 0 ? (
                <QuestionCard
                  question={filteredQuestions[currentIndex]}
                  onNext={() => {
                    if (currentIndex < filteredQuestions.length - 1) {
                      setCurrentIndex((i) => i + 1);
                    } else {
                      setView('topics');
                    }
                  }}
                />
              ) : (
                <div className="text-center py-16 edu-card p-10">
                  <span className="text-5xl block mb-4">🔍</span>
                  <p className="text-muted-foreground font-bold">No questions match your filters.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </AppLayout>
    </ProtectedRoute>
  );
};

function ExploreFallback() {
  return (
    <AppLayout>
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground font-medium">Loading...</p>
      </div>
    </AppLayout>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<ExploreFallback />}>
      <Explore />
    </Suspense>
  );
}
