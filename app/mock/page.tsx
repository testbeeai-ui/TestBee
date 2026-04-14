"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { useUserStore } from "@/store/useUserStore";
import { useAuth } from "@/hooks/useAuth";
import { getMockQuestions } from "@/data/questions";
import QuestionCard from "@/components/QuestionCard";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  Clock,
  BookOpen,
  Target,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  Flag,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
} from "lucide-react";
import { Subject } from "@/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

import PrepMockSidebar from "@/components/prep-mock/PrepMockSidebar";
import PrepMockStatCards from "@/components/prep-mock/PrepMockStatCards";
import ClassesSection from "@/components/prep-mock/ClassesSection";
import MockTestsSection from "@/components/prep-mock/MockTestsSection";
import StreakCalendar from "@/components/prep-mock/StreakCalendar";
import RevisionInstaCueSection from "@/components/prep-mock/RevisionInstaCueSection";
import { fetchSavedContent } from "@/lib/savedContentService";
import { mergeAllSavedContent } from "@/lib/mergeSavedContent";

const DURATIONS = [60, 90, 180] as const;
type Duration = (typeof DURATIONS)[number];

type View = "landing" | "setup" | "test" | "results";

const subjectEmojis: Record<Subject, string> = {
  physics: "⚡",
  chemistry: "🧪",
  math: "📐",
  biology: "🧬",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function MockPage() {
  const { user: authUser } = useAuth();
  const user = useUserStore((s) => s.user);
  const allResults = useUserStore((s) => s.allResults);

  const [nextClassInfo, setNextClassInfo] = useState<{ name: string; time: string } | null>(null);

  const subjects: Subject[] = useMemo(() => {
    if (!user) return ["physics", "chemistry", "math"];
    return user.subjectCombo === "PCMB"
      ? ["physics", "chemistry", "math", "biology"]
      : ["physics", "chemistry", "math"];
  }, [user]);

  const [view, setView] = useState<View>("landing");
  const [duration, setDuration] = useState<Duration>(90);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [questions, setQuestions] = useState<ReturnType<typeof getMockQuestions>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);

  const totalSeconds = duration * 60;
  const effectiveSubject = selectedSubject ?? subjects[0] ?? null;

  const handleFinishTest = useCallback(() => {
    setEndTime(Date.now());
    setView("results");
    setSubmitDialogOpen(false);
  }, []);

  useEffect(() => {
    if (view !== "test" || startTime == null) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const left = Math.max(0, totalSeconds - elapsed);
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(interval);
        handleFinishTest();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [view, startTime, totalSeconds, handleFinishTest]);

  const startTest = useCallback(() => {
    if (!user) return;
    const chosenSubjects = effectiveSubject ? [effectiveSubject] : subjects;
    const qs = getMockQuestions(chosenSubjects, user.classLevel ?? 11, duration);
    setQuestions(qs);
    setCurrentIndex(0);
    setAnswers({});
    setFlagged(new Set());
    setStartTime(Date.now());
    setEndTime(null);
    setSecondsLeft(duration * 60);
    setView("test");
  }, [user, effectiveSubject, subjects, duration]);

  const handleQuickStartMock = useCallback((subject: Subject) => {
    setSelectedSubject(subject);
    setDuration(90);
    setView("setup");
  }, []);

  const handleAnswerSelect = useCallback((questionId: string, idx: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: idx }));
  }, []);

  const toggleFlag = (questionId: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const correctCount = useMemo(
    () => questions.filter((q) => answers[q.id] === q.correctAnswer).length,
    [questions, answers]
  );

  const sectionBreakdown = useMemo(() => {
    const bySubject: Record<string, { correct: number; total: number }> = {};
    questions.forEach((q) => {
      if (!bySubject[q.subject]) bySubject[q.subject] = { correct: 0, total: 0 };
      bySubject[q.subject].total++;
      if (answers[q.id] === q.correctAnswer) bySubject[q.subject].correct++;
    });
    return bySubject;
  }, [questions, answers]);

  const timeTakenSeconds =
    startTime != null && endTime != null ? Math.floor((endTime - startTime) / 1000) : 0;

  // Dashboard derived data
  const overallAccuracy = useMemo(() => {
    if (allResults.length === 0) return 0;
    const correct = allResults.filter((r) => r.isCorrect).length;
    return Math.round((correct / allResults.length) * 100);
  }, [allResults]);

  const activityDates = useMemo(
    () => allResults.map((r) => new Date(r.timestamp)),
    [allResults]
  );

  useEffect(() => {
    if (!authUser?.id) return;
    let cancelled = false;
    fetchSavedContent()
      .then((data) => {
        if (cancelled) return;
        const u = useUserStore.getState().user;
        if (!u) return;
        const merged = mergeAllSavedContent(
          u.savedBits ?? [],
          u.savedFormulas ?? [],
          u.savedRevisionCards ?? [],
          u.savedRevisionUnits ?? [],
          data.savedBits,
          data.savedFormulas,
          data.savedRevisionCards,
          data.savedRevisionUnits
        );
        useUserStore.getState().setSavedFromServer(
          merged.savedBits,
          merged.savedFormulas,
          merged.savedRevisionCards,
          merged.savedRevisionUnits
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

  const revisionCards = user?.savedRevisionCards ?? [];

  return (
    <ProtectedRoute>
      <AppLayout>
        <AnimatePresence mode="wait">
          {/* ── DASHBOARD (landing) ── */}
          {view === "landing" && (
            <motion.div
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex gap-6"
            >
              {/* Sidebar — desktop */}
              <PrepMockSidebar />

              {/* Main content */}
              <div className="flex-1 min-w-0 space-y-8">
                {/* Mobile sidebar strip */}
                <div className="lg:hidden">
                  <PrepMockSidebar />
                </div>

                {/* Page header */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shrink-0">
                    <ClipboardList className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-xl font-display font-extrabold text-foreground">Prep + Mock</h1>
                    <p className="text-xs text-muted-foreground">Classes, AI-powered scheduling, mock tests, and smart revision</p>
                  </div>
                </div>

                {/* Stat cards */}
                <PrepMockStatCards
                  nextClassName={nextClassInfo?.name ?? ""}
                  nextClassTime={nextClassInfo?.time ?? ""}
                  mockPending={subjects.length}
                  revisionItems={revisionCards.length}
                  accuracy={overallAccuracy}
                />

                {/* 2-column grid: left = Classes + Calendar, right = Mock Tests + Revision */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left column */}
                  <div className="space-y-6">
                    <ClassesSection
                      userId={authUser?.id ?? ""}
                      onNextClass={setNextClassInfo}
                    />
                    <StreakCalendar activityDates={activityDates} />
                  </div>

                  {/* Right column */}
                  <div className="space-y-6">
                    <MockTestsSection subjects={subjects} onStartMock={handleQuickStartMock} onViewAll={() => setView("setup")} />
                    <RevisionInstaCueSection cards={revisionCards} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── SETUP VIEW (configure mock before starting) ── */}
          {view === "setup" && (
            <motion.div
              key="setup"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-2xl mx-auto space-y-6"
            >
              <button
                onClick={() => setView("landing")}
                className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to dashboard
              </button>

              <div className="edu-page-header text-center">
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4">
                  <ClipboardList className="w-8 h-8 text-primary-foreground" />
                </div>
                <h1 className="edu-page-title text-2xl md:text-3xl">Configure Mock Test</h1>
                <p className="edu-page-desc max-w-xl mx-auto">
                  Exam-style test — 60, 90 or 180 minutes. Build stamina and find weak spots.
                </p>
              </div>

              {/* Duration picker */}
              <div className="edu-card p-6 rounded-2xl">
                <h3 className="font-display font-bold text-foreground mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" /> Choose duration
                </h3>
                <div className="flex flex-wrap gap-3">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`flex-1 min-w-[100px] py-4 px-4 rounded-xl font-bold text-sm transition-all border-2 ${
                        duration === d
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  ~{Math.ceil(duration / 2.5)} questions · ~2–3 min per question
                </p>
              </div>

              {/* Subject picker */}
              <div className="edu-card p-6 rounded-2xl">
                <h3 className="font-display font-bold text-foreground mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" /> Choose subject
                </h3>
                <div className="flex flex-wrap gap-3">
                  {subjects.map((subj) => (
                    <button
                      key={subj}
                      onClick={() => setSelectedSubject(subj)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                        effectiveSubject === subj
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      <span>{subjectEmojis[subj]}</span>
                      <span className="capitalize">{subj}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Info cards */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="edu-card p-5 rounded-2xl border border-primary/20 bg-primary/5">
                  <Target className="w-8 h-8 text-primary mb-2" />
                  <h4 className="font-bold text-foreground mb-1">Why long mocks?</h4>
                  <p className="text-sm text-muted-foreground">Time pressure and stamina match the real exam.</p>
                </div>
                <div className="edu-card p-5 rounded-2xl border border-border">
                  <BookOpen className="w-8 h-8 text-primary mb-2" />
                  <h4 className="font-bold text-foreground mb-1">What to expect</h4>
                  <p className="text-sm text-muted-foreground capitalize">
                    {effectiveSubject} chapters aligned with your class level.
                  </p>
                </div>
                <div className="edu-card p-5 rounded-2xl border border-border">
                  <Lightbulb className="w-8 h-8 text-primary mb-2" />
                  <h4 className="font-bold text-foreground mb-1">Strategy</h4>
                  <p className="text-sm text-muted-foreground">Flag tough ones and revisit. Use the timer like exam day.</p>
                </div>
              </div>

              <div className="text-center">
                <Button
                  size="lg"
                  className="edu-btn-primary rounded-xl font-bold px-10 py-6 text-lg"
                  onClick={startTest}
                >
                  <ClipboardList className="w-5 h-5 mr-2" />
                  Start mock test
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── TEST VIEW ── */}
          {view === "test" && questions.length > 0 && (
            <motion.div
              key="test"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-4xl mx-auto space-y-4"
            >
              <div className="sticky top-16 z-30 bg-card/95 backdrop-blur border-b border-border rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 font-mono text-lg font-bold">
                  <Clock className="w-5 h-5 text-primary" />
                  <span className={secondsLeft <= 300 ? "text-destructive" : ""}>
                    {formatTime(secondsLeft)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-end max-w-[70%]">
                  {questions.map((q, i) => (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(i)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all ${
                        i === currentIndex
                          ? "bg-primary text-primary-foreground ring-2 ring-primary/40"
                          : q.id in answers
                            ? "bg-muted text-foreground"
                            : flagged.has(q.id)
                              ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                              : "bg-muted/60 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {flagged.has(q.id) ? <Flag className="w-3.5 h-3.5" /> : i + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Button>
                <span className="text-sm font-bold text-muted-foreground">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                  disabled={currentIndex === questions.length - 1}
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>

              <div className="flex gap-2 mb-4">
                <Button
                  variant={flagged.has(questions[currentIndex]?.id) ? "secondary" : "outline"}
                  size="sm"
                  className="rounded-xl"
                  onClick={() => questions[currentIndex] && toggleFlag(questions[currentIndex].id)}
                >
                  <Flag
                    className={`w-4 h-4 mr-1 ${
                      flagged.has(questions[currentIndex]?.id) ? "fill-amber-500" : ""
                    }`}
                  />
                  {flagged.has(questions[currentIndex]?.id) ? "Flagged" : "Flag"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl ml-auto"
                  onClick={() => setSubmitDialogOpen(true)}
                >
                  Submit test
                </Button>
              </div>

              <motion.div
                key={questions[currentIndex]?.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <QuestionCard
                  question={questions[currentIndex]}
                  onNext={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                  mockMode
                  onAnswerSelect={(idx) => handleAnswerSelect(questions[currentIndex].id, idx)}
                />
              </motion.div>

              {currentIndex === questions.length - 1 && questions.length > 0 && (
                <div className="mt-6 p-4 rounded-2xl border-2 border-primary/30 bg-primary/5">
                  <p className="text-sm font-semibold text-foreground mb-2">
                    Last question — ready to submit?
                  </p>
                  <Button
                    size="lg"
                    className="w-full sm:w-auto rounded-xl edu-btn-primary"
                    onClick={() => setSubmitDialogOpen(true)}
                  >
                    Submit test
                  </Button>
                </div>
              )}

              <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
                <DialogContent className="rounded-2xl max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Submit and see results?</DialogTitle>
                    <DialogDescription>
                      You can't change answers after submitting. Your score and time will be shown.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                      variant="outline"
                      onClick={() => setSubmitDialogOpen(false)}
                      className="rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleFinishTest} className="rounded-xl edu-btn-primary">
                      Submit
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </motion.div>
          )}

          {/* ── RESULTS VIEW ── */}
          {view === "results" && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              <div className="edu-page-header text-center">
                <div className="text-6xl mb-4">
                  {correctCount >= questions.length * 0.8
                    ? "🏆"
                    : correctCount >= questions.length * 0.5
                      ? "👍"
                      : "💪"}
                </div>
                <h1 className="edu-page-title text-3xl">Mock test complete</h1>
                <p className="edu-page-desc">
                  {correctCount} / {questions.length} correct
                  {timeTakenSeconds > 0 && ` · ${formatTime(timeTakenSeconds)} taken`}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="edu-card p-4 rounded-2xl text-center">
                  <span className="text-2xl font-extrabold text-edu-green block">{correctCount}</span>
                  <span className="text-xs text-muted-foreground font-bold">Correct</span>
                </div>
                <div className="edu-card p-4 rounded-2xl text-center">
                  <span className="text-2xl font-extrabold text-destructive block">
                    {questions.length - correctCount}
                  </span>
                  <span className="text-xs text-muted-foreground font-bold">Wrong</span>
                </div>
                <div className="edu-card p-4 rounded-2xl text-center">
                  <span className="text-2xl font-extrabold text-primary block">
                    {questions.length
                      ? Math.round((correctCount / questions.length) * 100)
                      : 0}
                    %
                  </span>
                  <span className="text-xs text-muted-foreground font-bold">Score</span>
                </div>
                <div className="edu-card p-4 rounded-2xl text-center">
                  <span className="text-2xl font-extrabold text-foreground block font-mono">
                    {formatTime(timeTakenSeconds)}
                  </span>
                  <span className="text-xs text-muted-foreground font-bold">Time</span>
                </div>
              </div>

              {Object.keys(sectionBreakdown).length > 0 && (
                <div className="edu-card p-6 rounded-2xl">
                  <h3 className="font-display font-bold text-foreground mb-4">By subject</h3>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(sectionBreakdown).map(([subj, { correct, total }]) => (
                      <div
                        key={subj}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/50"
                      >
                        <span>{subjectEmojis[subj as Subject]}</span>
                        <span className="font-bold text-foreground capitalize">{subj}</span>
                        <span className="text-sm text-muted-foreground">
                          {correct}/{total}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="edu-card p-6 rounded-2xl">
                <h3 className="font-display font-bold text-foreground mb-4">Review answers</h3>
                <div className="space-y-3">
                  {questions.map((q) => {
                    const selected = answers[q.id];
                    const correct = selected === q.correctAnswer;
                    const open = expandedReviewId === q.id;
                    return (
                      <div key={q.id} className="border border-border rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpandedReviewId(open ? null : q.id)}
                          className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                        >
                          <span className="shrink-0">
                            {correct ? (
                              <CheckCircle2 className="w-5 h-5 text-edu-green" />
                            ) : (
                              <XCircle className="w-5 h-5 text-destructive" />
                            )}
                          </span>
                          <span className="text-sm font-bold text-foreground line-clamp-1 flex-1">
                            {q.question}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {q.subject} · {q.topic}
                          </span>
                          {open ? (
                            <ChevronUp className="w-4 h-4 shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 shrink-0" />
                          )}
                        </button>
                        {open && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            className="px-4 pb-4 space-y-2 text-sm"
                          >
                            <p className="text-muted-foreground">
                              Your answer:{" "}
                              {selected != null ? q.options[selected] : "—"}
                            </p>
                            {!correct && (
                              <p className="text-edu-green font-medium">
                                Correct: {q.options[q.correctAnswer]}
                              </p>
                            )}
                            <p className="text-foreground/90">{q.solution}</p>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-center">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-xl font-bold"
                  onClick={() => {
                    setView("landing");
                    setQuestions([]);
                    setAnswers({});
                  }}
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Try another mock
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </AppLayout>
    </ProtectedRoute>
  );
}
