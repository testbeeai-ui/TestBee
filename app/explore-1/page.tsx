"use client";

import { useState, useMemo, useEffect, useRef, useCallback, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/useUserStore';
import { questions } from '@/data/questions';
import { Question, Subject, ExamType, ClassLevel, SubjectCombo } from '@/types';
import { topicTaxonomy, TopicNode } from '@/data/topicTaxonomy';
import QuestionCard from '@/components/QuestionCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, ArrowLeft, Sparkles, BookOpen, ChevronRight, Zap, Play, Box, CheckCircle2, XCircle, Compass, Crosshair, Bot, ListOrdered, Shuffle, Filter } from 'lucide-react';
import { getTheoryOrPlaceholder, type InteractiveBlock } from '@/data/topicTheory';
import InteractiveTheoryRenderer from '@/components/InteractiveTheoryRenderer';
import TheoryContentWithDeepDive, { parseTheorySections } from '@/components/TheoryContentWithDeepDive';
import DeepDiveLinearSelector from '@/components/DeepDiveLinearSelector';
import { getInstaCueCards } from '@/data/instaCueCards';
import type { InstaCueCard } from '@/data/instaCueCards';
import InstaCue from '@/components/InstaCue';
import SubjectChatbot from '@/components/SubjectChatbot';
import AnimatedPhysicsIcon from '@/components/AnimatedPhysicsIcon';
import AnimatedChemistryIcon from '@/components/AnimatedChemistryIcon';
import AnimatedMathIcon from '@/components/AnimatedMathIcon';
import AnimatedBiologyIcon from '@/components/AnimatedBiologyIcon';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import TopicRoulette from '@/components/TopicRoulette';
import type { SubTopic } from '@/data/topicTaxonomy';
import { buildTopicPath, buildDeepDivePath } from '@/lib/topicRoutes';
import { slugify } from '@/lib/slugs';

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
  if (profileExam === 'JEE_Mains' || profileExam === 'JEE_Advance') return dataExams.includes('JEE');
  return dataExams.includes(profileExam);
}

function getExamLabel(value: ExamType): string {
  return exams.find((e) => e.value === value)?.label ?? value;
}

/** Classes shown in the Topics accordion. Set to [11] to hide Class 12; add 12 back to show it. */
const VISIBLE_CLASSES: ClassLevel[] = [11];

function getVisibleExamTypes(_classLevel: ClassLevel | null): ExamType[] {
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

const UNIT_SHORT_NAMES: Record<string, string> = {
  'Physical World and Measurement':              'MEASUREMENT',
  'Kinematics':                                  'KINEMATICS',
  'Laws of Motion':                              'LAWS OF MOTION',
  'Work, Energy and Power':                      'WORK & ENERGY',
  'Motion of System of Particles and Rigid Body':'PARTICLES & RIGID BODY',
  'Gravitation':                                 'GRAVITATION',
  'Properties of Bulk Matter':                   'BULK MATTER',
  'Thermodynamics':                              'THERMODYNAMICS',
  'Behaviour of Perfect Gas and Kinetic Theory': 'KINETIC THEORY',
  'Oscillations and Waves':                      'OSCILLATIONS & WAVES',
};

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
  onTopicClick: (topic: TopicNode, cl: ClassLevel) => void;
  getTopicCount: (subject: Subject, topic: string) => number;
  correctByTopic: Record<string, number>;
}

function UnitRoadmap({ topics, subject, classLevel, onTopicClick, getTopicCount, correctByTopic }: UnitRoadmapProps) {
  const sorted = [...topics].sort((a, b) => {
    const aNum = parseInt(a.unitLabel?.replace(/[^0-9]/g, '') ?? '0');
    const bNum = parseInt(b.unitLabel?.replace(/[^0-9]/g, '') ?? '0');
    return aNum - bNum;
  });

  const getCrowns = (topic: string, totalQ: number): number => {
    const correct = correctByTopic[topic] ?? 0;
    if (totalQ === 0 || correct === 0) return 0;
    const ratio = correct / totalQ;
    if (ratio >= 0.8) return 3;
    if (ratio >= 0.4) return 2;
    return 1;
  };

  const renderCard = (topic: TopicNode, originalIndex: number, unitNum: number, animDelay: number) => {
    const c = UNIT_COLORS[originalIndex % UNIT_COLORS.length];
    const shortName = UNIT_SHORT_NAMES[topic.topic] ?? topic.topic.toUpperCase();
    const icon = UNIT_ICONS[topic.topic] ?? '📚';
    const qCount = getTopicCount(subject, topic.topic);
    const correct = correctByTopic[topic.topic] ?? 0;
    const hasStarted = correct > 0;
    const crowns = getCrowns(topic.topic, qCount);
    const periods = topic.totalPeriods ?? 0;
    const topicCount = topic.subtopics.length;
    return (
      <motion.button
        type="button"
        key={topic.topic}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: animDelay, type: 'spring', stiffness: 260, damping: 24 }}
        whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onTopicClick(topic, classLevel)}
        className={`w-full text-left bg-white rounded-2xl border-2 ${c.outline} shadow-md hover:shadow-xl active:shadow-lg transition-shadow duration-200 p-5 sm:p-6 min-h-[168px] sm:min-h-[180px] flex flex-col justify-between group`}
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
            <div className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">U{unitNum}</div>
            <div className={`text-sm sm:text-base font-extrabold leading-tight ${c.text}`}>{shortName}</div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border/60 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm sm:text-base font-bold text-muted-foreground">{periods} periods</span>
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
      </motion.button>
    );
  };

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

        {sorted.map((topic, originalIndex) => {
          const unitNum = originalIndex + 1;
          return renderCard(topic, originalIndex, unitNum, originalIndex * 0.03);
        })}
      </div>

      {/* Hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: sorted.length * 0.03 + 0.2 }}
        className="flex justify-center mt-6"
      >
        <div className="bg-muted/60 rounded-xl px-4 py-2.5 inline-flex items-center gap-2 border border-border/60">
          <p className="text-xs font-bold text-muted-foreground">
            Ready to level up? Pick a unit above to begin. · {sorted.length} units · Class {classLevel}
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
  const user = useUserStore((s) => s.user);
  const classLevel: ClassLevel | null =
    profile?.role === 'student' && profile?.class_level != null
      ? (profile.class_level as ClassLevel)
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
  const [userInstaCueCards, setUserInstaCueCards] = useState<InstaCueCard[]>([]);
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
  const subtopicRefs = useRef<(HTMLDivElement | null)[]>([]);

  const THEORY_TRUNCATE_CHARS = 450; // ~4–5 lines; show "Read more" beyond this

  const visibleExamTypes = getVisibleExamTypes(classLevel);
  const visibleSubjectValues = getVisibleSubjects(classLevel, subjectCombo);
  const visibleSubjectsList = useMemo(
    () => subjects.filter((s) => visibleSubjectValues.includes(s.value)),
    [visibleSubjectValues]
  );
  const visibleExams = useMemo(() => exams.filter((e) => visibleExamTypes.includes(e.value)), [visibleExamTypes]);

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
    setView('topic-detail');
    setFocusedSubtopicIndex(null);
    if (spin) setRouletteOpen(true);
  }, [searchParams]);

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
        t.classLevel >= 11 &&
        (classLevel == null || classLevel >= 11) &&
        (!profileExamType || examMatchesFilter(profileExamType, t.examRelevance))
    );
    const grouped: Record<number, TopicNode[]> = {};
    for (const t of relevant) {
      if (!grouped[t.classLevel]) grouped[t.classLevel] = [];
      grouped[t.classLevel].push(t);
    }
    return grouped;
  }, [selectedSubject, profileExamType, classLevel]);

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

  const handleTopicClick = (topicNode: TopicNode, classLvl: ClassLevel) => {
    setSelectedTopicNode(topicNode);
    setSelectedTopicClassLevel(classLvl);
    setFocusedSubtopicIndex(null);
    setView('topic-detail');
  };

  const handleStartPractice = () => {
    if (!selectedSubject || !selectedTopicNode) return;
    let filtered = questions.filter(
      (q) => q.subject === selectedSubject && q.topic === selectedTopicNode.topic
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

  const handleTopicSelect = (topic: string) => {
    if (!selectedSubject) return;
    let filtered = questions.filter(
      (q) => q.subject === selectedSubject && q.topic === topic
    );
    if (profileExamType) filtered = filtered.filter((q) => examMatchesFilter(profileExamType, q.examType));
    if (classLevel != null) filtered = filtered.filter((q) => q.classLevel <= classLevel);
    if (filtered.length === 0) return;
    setFilteredQuestions(filtered.sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
    setView('questions');
  };

  const handleBackToSubjects = () => {
    setSelectedSubject(null);
    setView('hub');
  };

  /** Back from unit map (topics view) goes to Explore Learning (exam + subject selection), not Explore & Play. */
  const handleBackFromTopicsToExploreLearning = () => {
    setSelectedSubject(null);
    setView('subjects');
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

  const handleLinearMode = useCallback(() => {
    setPracticeModePopupOpen(false);
    if (!selectedSubject || !selectedTopicClassLevel || !selectedTopicNode) return;
    const first = selectedTopicNode.subtopics[0];
    if (!first) return;
    router.push(
      buildTopicPath(
        'cbse',
        selectedSubject,
        selectedTopicClassLevel,
        selectedTopicNode.topic,
        first.name,
        'basics'
      )
    );
  }, [router, selectedSubject, selectedTopicClassLevel, selectedTopicNode]);

  const handleRandomMode = useCallback(() => {
    setPracticeModePopupOpen(false);
    if (!selectedSubject || !selectedTopicClassLevel || !selectedTopicNode) return;
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
    setRouletteOpen(true);
  }, [router, selectedSubject, selectedTopicClassLevel, selectedTopicNode]);

  const handleRouletteSelect = useCallback(
    (index: number, level: 'basics' | 'intermediate' | 'advanced') => {
      setRouletteOpen(false);
      if (!selectedSubject || !selectedTopicClassLevel || !selectedTopicNode) return;
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
    [router, selectedSubject, selectedTopicClassLevel, selectedTopicNode]
  );

  // Scroll to focused subtopic when it changes
  useEffect(() => {
    if (focusedSubtopicIndex === null || focusedSubtopicIndex < 0) return;
    const el = subtopicRefs.current[focusedSubtopicIndex];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusedSubtopicIndex]);

  const subjectMeta = subjects.find((s) => s.value === selectedSubject);

  return (
    <ProtectedRoute>
      <AppLayout>
        <AnimatePresence mode="wait">
          {view === 'hub' && (
            <motion.div
              key="hub"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-3xl mx-auto"
            >
              <div className="edu-page-header">
                <h2 className="edu-page-title flex items-center gap-3">
                  <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
                    <Compass className="w-5 h-5 text-primary-foreground" />
                  </div>
                  Explore & Play
                </h2>
                <p className="edu-page-desc">Choose how you want to learn</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 mt-8">
                <motion.button
                  type="button"
                  onClick={() => setView('subjects')}
                  className="edu-card p-6 rounded-2xl text-left hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:scale-[1.02] transition-all border border-border group"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Compass className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-extrabold text-lg text-foreground mb-1">Explore</h3>
                  <p className="text-sm text-muted-foreground">Browse subjects, topics, and practice questions</p>
                  <span className="inline-flex items-center gap-1 mt-3 text-sm font-bold text-primary">
                    Open <ChevronRight className="w-4 h-4" />
                  </span>
                </motion.button>
                <Link
                  href="/play"
                  className="edu-card p-6 rounded-2xl text-left hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:scale-[1.02] transition-all border border-border group block"
                >
                  <div className="w-12 h-12 rounded-xl bg-edu-orange/10 flex items-center justify-center mb-4 group-hover:bg-edu-orange/20 transition-colors">
                    <Crosshair className="w-6 h-6 text-edu-orange" />
                  </div>
                  <h3 className="font-extrabold text-lg text-foreground mb-1">Play</h3>
                  <p className="text-sm text-muted-foreground">Fun, timed practice and challenges</p>
                  <span className="inline-flex items-center gap-1 mt-3 text-sm font-bold text-edu-orange">
                    Go to Play <ChevronRight className="w-4 h-4" />
                  </span>
                </Link>
              </div>
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

              {/* Gamified Unit Roadmap (intro text lives inside the grid) */}
              {VISIBLE_CLASSES
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
                  {selectedTopicNode.unitLabel && selectedTopicNode.totalPeriods != null
                    ? `${selectedTopicNode.unitLabel}: ${selectedTopicNode.topic} (Total Periods: ${selectedTopicNode.totalPeriods})`
                    : selectedTopicNode.totalPeriods != null
                      ? `${selectedTopicNode.topic} (Total Periods: ${selectedTopicNode.totalPeriods})`
                      : selectedTopicNode.topic}
                </h2>
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
                          <li key={st.name} className="flex gap-2">
                            <span className="text-primary font-medium shrink-0">{idx + 1}.</span>
                            <span>{st.name}</span>
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

                <h2 className="edu-page-title text-2xl mb-1 flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-primary" />
                  {selectedTopicNode.unitLabel && selectedTopicNode.totalPeriods != null
                    ? `${selectedTopicNode.unitLabel}: ${selectedTopicNode.topic} (Total Periods: ${selectedTopicNode.totalPeriods})`
                    : selectedTopicNode.totalPeriods != null
                      ? `${selectedTopicNode.topic} (Total Periods: ${selectedTopicNode.totalPeriods})`
                      : selectedTopicNode.topic}
                </h2>

                <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1 min-w-0">
                  {focusedSubtopicIndex === null ? (
                    /* Intro / overview — only when no subtopic selected */
                    <div className="edu-card p-6 rounded-2xl border border-border">
                      {selectedTopicNode.topic === 'Thermodynamics' ? (
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
                      {getTopicCount(selectedSubject, selectedTopicNode.topic) > 0 && (
                        <div className="mt-6 pt-4 border-t border-border">
                          <Button
                            size="lg"
                            onClick={() => setPracticeModePopupOpen(true)}
                            className="rounded-xl gap-2 edu-btn-primary w-full sm:w-auto"
                          >
                            <Play className="w-4 h-4" /> Start
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Single subtopic page — only one visible at a time */
                    (() => {
                      const idx = focusedSubtopicIndex;
                      const st = selectedTopicNode.subtopics[idx];
                      if (!st) return null;
                      const theoryData = getTheoryOrPlaceholder(selectedSubject, selectedTopicClassLevel, selectedTopicNode.topic, st.name);
                      const theoryKey = `${selectedTopicNode.topic}-${st.name}`;
                      const isLong = theoryData.theory.length > THEORY_TRUNCATE_CHARS;
                      const isExpanded = expandedTheoryKeys.has(theoryKey);
                      const truncateAt = theoryData.theory.lastIndexOf(' ', THEORY_TRUNCATE_CHARS);
                      const displayTheory = isLong && !isExpanded
                        ? theoryData.theory.slice(0, truncateAt > 200 ? truncateAt : THEORY_TRUNCATE_CHARS).trim() + '...'
                        : theoryData.theory;
                      const isFirst = idx === 0;
                      const isLast = idx === selectedTopicNode.subtopics.length - 1;
                      return (
                        <motion.div
                          key={st.name}
                          ref={(el) => { subtopicRefs.current[idx] = el; }}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="edu-card p-6 rounded-2xl border-2 border-primary/30 ring-2 ring-primary/20 shadow-lg"
                        >
                          <div className="flex items-center justify-end mb-4">
                            <span className="text-sm font-bold text-muted-foreground">
                              {idx + 1} / {selectedTopicNode.subtopics.length}
                            </span>
                          </div>
                          <h3 className="font-extrabold text-lg text-foreground mb-3 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm text-primary">{idx + 1}</span>
                            {st.name}
                          </h3>
                          <div className="text-sm mb-4">
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
                          </div>
                          {isLong && (
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
                          <div className="mt-6 pt-4 border-t border-border flex items-center gap-3">
                            {!isFirst && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setFocusedSubtopicIndex(idx - 1)}
                                className="rounded-xl gap-2 font-bold"
                              >
                                <ArrowLeft className="w-4 h-4" /> Previous topic
                              </Button>
                            )}
                            {!isLast && (
                              <Button
                                size="sm"
                                onClick={() => setFocusedSubtopicIndex(idx + 1)}
                                className="rounded-xl gap-2 font-bold edu-btn-primary"
                              >
                                Next topic <ChevronRight className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
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
                        Topics in this unit
                      </h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {selectedTopicNode.subtopics.map((st, idx) => (
                          <li key={st.name} className="flex gap-2">
                            <span className="text-primary font-medium shrink-0">{idx + 1}.</span>
                            <span>{st.name}</span>
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

              {rouletteOpen && selectedSubject && selectedTopicNode && (
                <TopicRoulette
                  subtopics={selectedTopicNode.subtopics}
                  onSelect={handleRouletteSelect}
                  onClose={() => setRouletteOpen(false)}
                />
              )}

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

          {/* Subject AI Chatbot – appears on topic-detail view */}
          {view === 'topic-detail' && selectedSubject && selectedTopicNode && (
            <SubjectChatbot
              subject={selectedSubject}
              topic={selectedTopicNode.topic}
              subtopic={selectedTopicNode.subtopics[0]?.name}
            />
          )}

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
