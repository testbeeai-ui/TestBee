"use client";

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/useUserStore';
import { questions } from '@/data/questions';
import { Question, Subject, ExamType, ClassLevel, SubjectCombo } from '@/types';
import type { TopicNode } from '@/data/topicTaxonomy';
import { useTopicTaxonomy } from '@/hooks/useTopicTaxonomy';
import ExploreHubDashboard from '@/components/explore/ExploreHubDashboard';
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
import { Search, Filter, ArrowLeft, Sparkles, BookOpen, ChevronRight, Zap, Play, Box, CheckCircle2, XCircle, Compass, Crosshair } from 'lucide-react';
import { getTheoryOrPlaceholder, type InteractiveBlock } from '@/data/topicTheory';
import InteractiveTheoryRenderer from '@/components/InteractiveTheoryRenderer';
import TheoryContent from '@/components/TheoryContent';
import { getInstaCueCards } from '@/data/instaCueCards';
import type { InstaCueCard } from '@/data/instaCueCards';
import InstaCue from '@/components/InstaCue';
import { prettifySubtopicTitle } from '@/lib/subtopicTitles';
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
  { value: 'JEE', label: 'JEE', emoji: '🎯' },
  { value: 'NEET', label: 'NEET', emoji: '🩺' },
  { value: 'KCET', label: 'KCET', emoji: '📋' },
  { value: 'other', label: 'Other', emoji: '📝' },
];

const EXAM_TYPES_11_12: ExamType[] = ['JEE', 'NEET', 'KCET', 'other'];

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

function TopicIntroQuiz({
  questions: qs,
  topicNode,
  classLevel,
  onComplete,
}: {
  questions: Question[];
  topicNode: TopicNode;
  classLevel: ClassLevel;
  onComplete: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);

  if (qs.length === 0) return null;

  const q = qs[index]!;
  const answered = selected !== null;
  const isCorrect = selected === q.correctAnswer;

  const handleSelect = (i: number) => {
    if (answered) return;
    setSelected(i);
    if (i === q.correctAnswer) setScore((s) => s + 1);
  };

  const handleNext = () => {
    if (index < qs.length - 1) {
      setIndex((i) => i + 1);
      setSelected(null);
    } else {
      setQuizDone(true);
    }
  };

  // Professor's feedback screen after quiz
  if (quizDone) {
    const total = qs.length;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const isHighScore = pct >= 70;
    return (
      <div className="space-y-4">
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-2">
            You got {score} out of {total} correct.
          </p>
          {isHighScore ? (
            <>
              <p className="text-foreground font-semibold mb-2">
                Excellent! You already have a strong grasp of these concepts. Let&apos;s do a quick revision of the topics to solidify your knowledge!
              </p>
              <p className="text-xs text-muted-foreground italic mb-4">
                — Professor&apos;s Note
              </p>
              <Button onClick={onComplete} className="rounded-xl gap-2 edu-btn-primary">
                <BookOpen className="w-4 h-4" /> Revise Topics
              </Button>
            </>
          ) : (
            <>
              <p className="text-foreground font-semibold mb-2">
                It seems some of these concepts might be new to you. No worries, that&apos;s what we&apos;re here for! Let&apos;s dive in and build your foundation.
              </p>
              <p className="text-xs text-muted-foreground italic mb-4">
                — Professor&apos;s Note
              </p>
              <Button onClick={onComplete} className="rounded-xl gap-2 edu-btn-primary">
                <BookOpen className="w-4 h-4" /> Learn Topics
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Quick Bits — see how much you already know before diving into the theory. Useful for revision!
      </p>
      <h4 className="font-semibold text-foreground text-sm">
        Question {index + 1} of {qs.length}
      </h4>
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
        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-xl">{q.solution}</div>
      )}
      {answered && (
        <Button size="sm" variant="outline" onClick={handleNext} className="rounded-xl">
          {index < qs.length - 1 ? "Next question" : "See results"}
        </Button>
      )}
    </div>
  );
}

import { ProtectedRoute } from "@/components/ProtectedRoute";

const Explore = () => {
  const { profile } = useAuth();
  const user = useUserStore((s) => s.user);
  const classLevel: ClassLevel | null =
    profile?.role === 'student'
      ? profile.class_level === 12
        ? 12
        : profile.class_level === 11
          ? 11
          : 11
      : user?.classLevel ?? null;
  const subjectCombo: SubjectCombo | null =
    profile?.role === 'student' && profile?.subject_combo
      ? (profile.subject_combo as SubjectCombo)
      : user?.subjectCombo ?? null;

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedExam, setSelectedExam] = useState<ExamType | null>(null);
  const [selectedTopicNode, setSelectedTopicNode] = useState<TopicNode | null>(null);
  const [selectedTopicClassLevel, setSelectedTopicClassLevel] = useState<ClassLevel | null>(null);
  const [bitsPopup, setBitsPopup] = useState<{ subtopicName: string; topicNode: TopicNode; classLevel: ClassLevel } | null>(null);
  const [bitsAllPopup, setBitsAllPopup] = useState(false);
  const [topicIntroState, setTopicIntroState] = useState<{ topicNode: TopicNode; classLevel: ClassLevel } | null>(null);
  const [userInstaCueCards, setUserInstaCueCards] = useState<InstaCueCard[]>([]);
  const [visualPlayableOpen, setVisualPlayableOpen] = useState(false);
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [view, setView] = useState<ViewState>('hub');
  const [hoveredSubject, setHoveredSubject] = useState<string | null>(null);
  const [expandedTheoryKeys, setExpandedTheoryKeys] = useState<Set<string>>(new Set());
  const [practicePopupBlock, setPracticePopupBlock] = useState<InteractiveBlock | null>(null);

  const { taxonomy: topicTaxonomy, loading: taxonomyLoading, error: taxonomyError } = useTopicTaxonomy();

  const THEORY_TRUNCATE_CHARS = 450; // ~4–5 lines; show "Read more" beyond this

  const visibleExamTypes = getVisibleExamTypes(classLevel);
  const visibleSubjectValues = getVisibleSubjects(classLevel, subjectCombo);
  const visibleExams = useMemo(() => exams.filter((e) => visibleExamTypes.includes(e.value)), [visibleExamTypes]);
  const visibleSubjectsList = useMemo(
    () => subjects.filter((s) => visibleSubjectValues.includes(s.value)),
    [visibleSubjectValues]
  );

  useEffect(() => {
    if (!selectedExam || visibleExamTypes.includes(selectedExam)) return;
    queueMicrotask(() => setSelectedExam(null));
  }, [visibleExamTypes, selectedExam]);

  // Get question count for a specific subject
  const getSubjectCount = (subject: Subject) => {
    let filtered = questions.filter((q) => q.subject === subject);
    if (selectedExam) filtered = filtered.filter((q) => q.examType.includes(selectedExam));
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
        (!selectedExam || selectedExam === 'other' || t.examRelevance.length === 0 || t.examRelevance.includes(selectedExam))
    );
    const grouped: Record<number, TopicNode[]> = {};
    for (const t of relevant) {
      if (!grouped[t.classLevel]) grouped[t.classLevel] = [];
      grouped[t.classLevel].push(t);
    }
    return grouped;
  }, [selectedSubject, selectedExam, classLevel, topicTaxonomy]);

  const handleSubjectSelect = (subject: Subject) => {
    setSelectedSubject(subject);
    setView('topics');
  };

  const handleTopicClick = (topicNode: TopicNode, classLvl: ClassLevel) => {
    if (topicNode.topic === 'Physical World and Measurement') {
      setTopicIntroState({ topicNode, classLevel: classLvl });
      return;
    }
    setSelectedTopicNode(topicNode);
    setSelectedTopicClassLevel(classLvl);
    setView('topic-detail');
  };

  const handleTopicIntroComplete = (topicNode: TopicNode, classLvl: ClassLevel) => {
    setTopicIntroState(null);
    setSelectedTopicNode(topicNode);
    setSelectedTopicClassLevel(classLvl);
    setView('topic-detail');
  };

  const handleStartPractice = () => {
    if (!selectedSubject || !selectedTopicNode) return;
    let filtered = questions.filter(
      (q) => q.subject === selectedSubject && q.topic === selectedTopicNode.topic
    );
    if (selectedExam) filtered = filtered.filter((q) => q.examType.includes(selectedExam));
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
    if (selectedExam) filtered = filtered.filter((q) => q.examType.includes(selectedExam));
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

  const handleBackToTopics = () => {
    setView('topics');
  };

  const handleBackFromTopicDetail = () => {
    setSelectedTopicNode(null);
    setSelectedTopicClassLevel(null);
    setView('topics');
  };

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
            >
              <ExploreHubDashboard
                onNavigateToSubjects={() => setView('subjects')}
                onNavigateToSubject={handleSubjectSelect}
                onNavigateToTopic={(node) => {
                  setSelectedSubject(node.subject);
                  handleTopicClick(node, node.classLevel);
                }}
                onNavigateToSubjectWithExam={(subject, exam) => {
                  setSelectedExam(exam);
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

              {/* Exam Filter */}
              <div className="mb-8">
                <h3 className="text-sm font-extrabold text-foreground mb-3 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-primary" /> Exam Type
                </h3>
                <div className="flex gap-2 flex-wrap">
                  {visibleExams.map((e) => (
                    <button
                      key={e.value}
                      onClick={() => setSelectedExam(selectedExam === e.value ? null : e.value)}
                      className={`px-5 py-2.5 rounded-full text-sm font-extrabold transition-all ${selectedExam === e.value
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                    >
                      {e.emoji} {e.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject Cards */}
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
              className="max-w-3xl mx-auto"
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToSubjects}
                  className="rounded-full font-extrabold"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <div className={`px-4 py-2 rounded-xl bg-gradient-to-br ${subjectMeta?.gradient} text-primary-foreground flex items-center gap-2`}>
                  <span className="text-lg">{subjectMeta?.emoji}</span>
                  <span className="font-extrabold text-sm">{subjectMeta?.label}</span>
                </div>
                {selectedExam && (
                  <Badge variant="secondary" className="font-bold">
                    {selectedExam}
                  </Badge>
                )}
              </div>

              {taxonomyLoading && (
                <div className="mb-4 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm font-semibold text-muted-foreground">
                  Loading syllabus…
                </div>
              )}
              {taxonomyError && !taxonomyLoading && (
                <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground">
                  {taxonomyError}
                </div>
              )}

              <h2 className="edu-page-title text-2xl mb-1 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-primary" />
                Units & Topics
              </h2>
              <p className="edu-page-desc mb-6 text-sm">Click a unit to read theory by topic, use Bits to revise, then practice questions</p>

              {/* Topics by Class */}
              <Accordion type="multiple" defaultValue={Object.keys(topicsByClass)} className="space-y-3">
                {([11, 12] as ClassLevel[])
                  .filter((cl) => topicsByClass[cl] && topicsByClass[cl].length > 0)
                  .map((classLevel) => (
                    <AccordionItem
                      key={classLevel}
                      value={String(classLevel)}
                      className="edu-card border rounded-2xl overflow-hidden px-1"
                    >
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-extrabold text-primary">{classLevel}</span>
                          </div>
                          <span className="font-extrabold text-base text-foreground">
                            Class {classLevel}
                          </span>
                          <Badge variant="outline" className="text-xs font-bold">
                            {topicsByClass[classLevel].length} topics
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-2 pb-3">
                        <div className="space-y-2">
                          {topicsByClass[classLevel].map((topicNode) => {
                            const qCount = getTopicCount(selectedSubject, topicNode.topic);
                            const hasQuestions = qCount > 0;
                            return (
                              <motion.button
                                key={topicNode.topic}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                onClick={() => handleTopicClick(topicNode, classLevel)}
                                className="w-full text-left p-4 rounded-xl border transition-all bg-card hover:bg-muted/50 border-border cursor-pointer hover:shadow-sm"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-bold text-sm text-foreground">
                                    {topicNode.unitLabel && topicNode.totalPeriods != null
                                      ? `${topicNode.unitLabel}: ${topicNode.topic} (Total Periods: ${topicNode.totalPeriods})`
                                      : topicNode.totalPeriods != null
                                        ? `${topicNode.topic} (Total Periods: ${topicNode.totalPeriods})`
                                        : topicNode.topic}
                                  </span>
                                  {hasQuestions ? (
                                    <Badge className="text-xs font-bold bg-primary/10 text-primary border-0">
                                      {qCount} Q{qCount !== 1 ? 's' : ''}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs font-bold text-muted-foreground">
                                      Read theory
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {topicNode.subtopics.map((st) => (
                                    <span
                                      key={st.name}
                                      className="edu-chip bg-muted/60 text-muted-foreground text-[10px]"
                                    >
                                      {prettifySubtopicTitle(st.name)}
                                    </span>
                                  ))}
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
              </Accordion>

              {/* Topic Intro Bits Dialog - Physical World and Measurement */}
              <Dialog open={!!topicIntroState} onOpenChange={(open) => !open && setTopicIntroState(null)}>
                <DialogContent className="rounded-2xl max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-primary" /> Bits
                      {topicIntroState && (
                        <span className="font-normal text-muted-foreground">
                          — {topicIntroState.topicNode.unitLabel} {topicIntroState.topicNode.topic}
                        </span>
                      )}
                    </DialogTitle>
                  </DialogHeader>
                  {topicIntroState && selectedSubject && (
                    (() => {
                      let topicQs = questions.filter(
                        (q) =>
                          q.subject === selectedSubject &&
                          q.topic === topicIntroState.topicNode.topic &&
                          (classLevel == null || q.classLevel <= topicIntroState.classLevel)
                      );
                      if (selectedExam) topicQs = topicQs.filter((q) => q.examType.includes(selectedExam));
                      topicQs = topicQs.sort(() => Math.random() - 0.5).slice(0, 5);
                      if (topicQs.length === 0) {
                        return (
                          <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">No questions for this topic yet. Proceed to read the theory.</p>
                            <Button
                              onClick={() => handleTopicIntroComplete(topicIntroState.topicNode, topicIntroState.classLevel)}
                              className="rounded-xl gap-2 edu-btn-primary"
                            >
                              <BookOpen className="w-4 h-4" /> Go to Topics
                            </Button>
                          </div>
                        );
                      }
                      return (
                        <TopicIntroQuiz
                          questions={topicQs}
                          topicNode={topicIntroState.topicNode}
                          classLevel={topicIntroState.classLevel}
                          onComplete={() => handleTopicIntroComplete(topicIntroState.topicNode, topicIntroState.classLevel)}
                        />
                      );
                    })()
                  )}
                </DialogContent>
              </Dialog>
            </motion.div>
          )}

          {view === 'topic-detail' && selectedSubject && selectedTopicNode && selectedTopicClassLevel !== null && (
            <motion.div
              key="topic-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full max-w-6xl mx-auto"
            >
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackFromTopicDetail}
                  className="rounded-full font-extrabold"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <div className={`px-4 py-2 rounded-xl bg-gradient-to-br ${subjectMeta?.gradient} text-primary-foreground flex items-center gap-2`}>
                  <span className="text-lg">{subjectMeta?.emoji}</span>
                  <span className="font-extrabold text-sm">{subjectMeta?.label}</span>
                </div>
                <span className="edu-chip bg-muted text-foreground font-bold">Class {selectedTopicClassLevel}</span>
                {/* 
                <Button size="sm" variant="outline" onClick={() => setBitsAllPopup(true)} className="rounded-xl gap-1.5 font-bold">
                  <Zap className="w-3.5 h-3.5 text-primary" /> Bits
                </Button>
                */}
                {getTopicCount(selectedSubject, selectedTopicNode.topic) > 0 && (
                  <Button size="sm" onClick={handleStartPractice} className="rounded-xl gap-1.5 edu-btn-primary">
                    <Play className="w-3.5 h-3.5" /> Practice questions
                  </Button>
                )}
              </div>

              <h2 className="edu-page-title text-2xl mb-1 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-primary" />
                {selectedTopicNode.unitLabel && selectedTopicNode.totalPeriods != null
                  ? `${selectedTopicNode.unitLabel}: ${selectedTopicNode.topic} (Total Periods: ${selectedTopicNode.totalPeriods})`
                  : selectedTopicNode.totalPeriods != null
                    ? `${selectedTopicNode.topic} (Total Periods: ${selectedTopicNode.totalPeriods})`
                    : selectedTopicNode.topic}
              </h2>
              {/* <p className="edu-page-desc mb-6 text-sm">Read the theory for each subtopic. Use InstaCue cards on the right for quick revision.</p> */}

              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1 min-w-0 space-y-6">
                  {selectedTopicNode.subtopics.map((st, idx) => {
                    const theoryData = getTheoryOrPlaceholder(selectedSubject, selectedTopicClassLevel, selectedTopicNode.topic, st.name);
                    const theoryKey = `${selectedTopicNode.topic}-${st.name}`;
                    const isLong = theoryData.theory.length > THEORY_TRUNCATE_CHARS;
                    const isExpanded = expandedTheoryKeys.has(theoryKey);
                    const truncateAt = theoryData.theory.lastIndexOf(' ', THEORY_TRUNCATE_CHARS);
                    const displayTheory = isLong && !isExpanded
                      ? theoryData.theory.slice(0, truncateAt > 200 ? truncateAt : THEORY_TRUNCATE_CHARS).trim() + '...'
                      : theoryData.theory;
                    return (
                      <div key={st.name} className="edu-card p-5 rounded-2xl border border-border">
                        <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-sm text-primary">{idx + 1}</span>
                          {prettifySubtopicTitle(st.name)}
                        </h3>
                        {theoryData.theorySectionsWithPractice && theoryData.theorySectionsWithPractice.length > 0 && theoryData.interactiveBlocks ? (
                          <div className="space-y-6 mb-4">
                            {theoryData.theorySectionsWithPractice.map((section, si) => {
                              const block = theoryData.interactiveBlocks![section.blockIndex];
                              return (
                                <div key={si} className="rounded-xl border border-border bg-muted/20 p-4">
                                  <h4 className="font-bold text-foreground text-sm mb-2">{section.title}</h4>
                                  <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap [&>*]:mb-2 mb-3">
                                    {section.content.split(/\n\n+/).map((para, i) => (
                                      <p key={i} className="mb-2 last:mb-0">
                                        {para.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
                                          part.startsWith('**') && part.endsWith('**') ? (
                                            <strong key={j} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
                                          ) : (
                                            part
                                          )
                                        )}
                                      </p>
                                    ))}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setPracticePopupBlock(block)}
                                    className="rounded-xl gap-2 font-bold"
                                  >
                                    <Zap className="w-3.5 h-3.5 text-primary" /> Practice
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <>
                            <div className="text-sm mb-4">
                              <TheoryContent theory={displayTheory} />
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
                              <div className="mt-6 pt-4 border-t border-border">
                                <h4 className="font-bold text-foreground mb-3 text-sm">Practice — Test your understanding</h4>
                                <InteractiveTheoryRenderer blocks={theoryData.interactiveBlocks} />
                              </div>
                            )}
                          </>
                        )}
                        {st.name === 'Scope and excitement of Physics' && (
                          <div className="mb-4 rounded-xl overflow-hidden border border-border bg-muted/30 p-2 lg:p-4">
                            <Image
                              src="/images/scope-and-excitement-of-physics.png"
                              alt="THE SCOPE AND EXCITEMENT OF PHYSICS - An Explorer's Guide to the Universe (Class 11)"
                              width={1200}
                              height={800}
                              className="w-full h-auto object-contain rounded-lg"
                              unoptimized
                            />
                          </div>
                        )}
                        {st.name === 'Importance and scope of chemistry' && (
                          <div className="mb-4 rounded-xl overflow-hidden border border-border bg-muted/30 p-2 lg:p-4">
                            <Image
                              src="/images/importance-and-scope-of-chemistry.png"
                              alt="THE IMPORTANCE & SCOPE OF CHEMISTRY - Unlocking the Universe's Building Blocks (Class 11)"
                              width={1200}
                              height={800}
                              className="w-full h-auto object-contain rounded-lg"
                              unoptimized
                            />
                          </div>
                        )}
                        {st.name === 'SI Units' && (
                          <div className="mb-4 rounded-xl overflow-hidden border border-border bg-muted/30 p-1 lg:p-2">
                            <Image
                              src="/images/si-units.jpg"
                              alt="SI UNITS: The Universal Language of Science & Measurement"
                              width={800}
                              height={450}
                              className="w-full h-auto object-contain rounded-lg"
                              unoptimized
                            />
                          </div>
                        )}
                        {st.name === 'Distance & Displacement' && (
                          <div className="mb-4 rounded-xl overflow-hidden border border-border bg-muted/30">
                            <Image
                              src="/images/distance-vs-displacement.png"
                              alt="Distance vs Displacement – total path vs shortest path with direction"
                              width={800}
                              height={500}
                              className="w-full h-auto object-contain"
                              unoptimized
                            />
                          </div>
                        )}
                        {st.name === 'Sets and their representations' && (
                          <div className="mb-4 rounded-xl overflow-hidden border border-border bg-muted/30 p-2 lg:p-4">
                            <Image
                              src="/images/sets-and-their-representations.png"
                              alt="MATH UNLOCKED: Sets & their Representations (Gen Z Edition)"
                              width={1200}
                              height={800}
                              className="w-full h-auto object-contain rounded-lg"
                              unoptimized
                            />
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {/* 
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setBitsPopup({ subtopicName: st.name, topicNode: selectedTopicNode, classLevel: selectedTopicClassLevel })}
                            className="rounded-xl gap-1.5 font-bold"
                          >
                            <Zap className="w-3.5 h-3.5 text-primary" /> Bits
                          </Button>
                          */}
                          {st.name === 'Distance & Displacement' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setVisualPlayableOpen(true)}
                              className="rounded-xl gap-1.5 font-bold"
                            >
                              <Box className="w-3.5 h-3.5 text-primary" /> Visual playable
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <aside className="w-full lg:w-80 xl:w-96 shrink-0">
                  <div className="lg:sticky lg:top-24">
                    <InstaCue
                      cards={[
                        ...getInstaCueCards(
                          selectedSubject,
                          selectedTopicClassLevel,
                          selectedTopicNode.topic,
                          selectedTopicNode.subtopics.map((s) => s.name)
                        ),
                        ...userInstaCueCards.filter(
                          (c) =>
                            c.topic === selectedTopicNode.topic &&
                            c.subject === selectedSubject &&
                            c.classLevel === selectedTopicClassLevel
                        ),
                      ]}
                      topicName={selectedTopicNode.topic}
                      subject={selectedSubject}
                      classLevel={selectedTopicClassLevel}
                      subtopicOptions={selectedTopicNode.subtopics.map((s) => s.name)}
                      onAddCard={(card) => {
                        setUserInstaCueCards((prev) => [
                          ...prev,
                          { ...card, id: `user-${Date.now()}` },
                        ]);
                      }}
                    />
                  </div>
                </aside>
              </div>

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
          )}

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
}

export default Explore;
