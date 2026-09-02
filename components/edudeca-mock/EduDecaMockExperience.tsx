"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import {
  EDUDECA_MOCK_LEVELS,
  type EduDecaMockLevelId,
  type QuizQuestion,
} from "@/lib/edudeca-mock/question-bank";
import { edudecaAppOrigin, edudecaMockReturnUrl } from "@/lib/edudeca-mock/return-url";
import {
  applyHandoffQuery,
  createEmptySession,
  formatSetNumber,
  isApiPaper,
  loadSession,
  parseHandoffQuery,
  saveSession,
  withInProgress,
  type EduDecaMockInProgress,
  type EduDecaMockSession,
} from "@/lib/edudeca-mock/session-store";
import { cn } from "@/lib/utils";

type Screen = "landing" | "quiz" | "results";
type PaperError = "incomplete_lineup" | "missing_discipline" | "auth" | "load";

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function persist(session: EduDecaMockSession): void {
  saveSession(browserStorage(), session);
}

function levelMeta(id: EduDecaMockLevelId) {
  return EDUDECA_MOCK_LEVELS.find((item) => item.id === id) ?? EDUDECA_MOCK_LEVELS[0];
}

function paperErrorCopy(error: PaperError): string {
  switch (error) {
    case "incomplete_lineup":
      return "Pick your 10 disciplines on EduDeca, then come back to start this mock.";
    case "missing_discipline":
      return "This mock set is not available for your 10 disciplines.";
    case "auth":
      return "Sign in to take this EduDeca mock paper.";
    case "load":
      return "Could not load this mock paper. Try again.";
    default: {
      const _never: never = error;
      return _never;
    }
  }
}

export function EduDecaMockExperience() {
  const searchParams = useSearchParams();
  const [session, setSession] = useState<EduDecaMockSession>(createEmptySession);
  const [screen, setScreen] = useState<Screen>("landing");
  const [quiz, setQuiz] = useState<EduDecaMockInProgress | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [paperError, setPaperError] = useState<PaperError | null>(null);
  const [loadingPaper, setLoadingPaper] = useState(false);
  const [serverScore, setServerScore] = useState<{
    correct: number;
    total: number;
    scorePct: number;
  } | null>(null);

  useEffect(() => {
    const stored = loadSession(browserStorage());
    const query = parseHandoffQuery(new URLSearchParams(searchParams.toString()));
    const next = applyHandoffQuery(stored, query);
    const resume = next.inProgress;
    const usableResume = Boolean(
      resume &&
        resume.level === next.lastLevel &&
        resume.set === next.lastSet &&
        isApiPaper(resume.questions),
    );
    persist(usableResume ? next : withInProgress(next, undefined));

    queueMicrotask(() => {
      setSession(usableResume ? next : withInProgress(next, undefined));
      if (usableResume && resume) {
        setQuiz(resume);
        setPicked(resume.pickedIndex ?? null);
        setScreen("quiz");
      }
      setHydrated(true);
    });
  }, [searchParams]);

  const selected = levelMeta(session.lastLevel);
  const setNo = formatSetNumber(session.lastSet);
  const matchingResume =
    session.inProgress &&
    session.inProgress.level === session.lastLevel &&
    session.inProgress.set === session.lastSet &&
    isApiPaper(session.inProgress.questions)
      ? session.inProgress
      : null;

  function updateSession(next: EduDecaMockSession) {
    setSession(next);
    persist(next);
  }

  function selectLevel(id: EduDecaMockLevelId) {
    updateSession({ ...session, lastLevel: id });
  }

  async function startQuiz(resume?: EduDecaMockInProgress) {
    if (resume && isApiPaper(resume.questions)) {
      setPaperError(null);
      setQuiz(resume);
      setPicked(resume.pickedIndex ?? null);
      setScreen("quiz");
      updateSession(withInProgress({ ...session, lastLevel: resume.level, lastSet: resume.set }, resume));
      return;
    }

    setLoadingPaper(true);
    setPaperError(null);
    try {
      const res = await fetch(
        `/api/edudeca-mock/paper?level=${session.lastLevel}&set=${session.lastSet}`,
        { credentials: "include", cache: "no-store" },
      );
      if (res.status === 401) {
        setPaperError("auth");
        return;
      }
      if (res.status === 409) {
        setPaperError("incomplete_lineup");
        return;
      }
      if (res.status === 422) {
        setPaperError("missing_discipline");
        return;
      }
      if (!res.ok) {
        setPaperError("load");
        return;
      }
      const body = (await res.json()) as { questions?: QuizQuestion[] };
      if (!Array.isArray(body.questions) || !isApiPaper(body.questions)) {
        setPaperError("load");
        return;
      }
      const nextQuiz: EduDecaMockInProgress = {
        level: session.lastLevel,
        set: session.lastSet,
        idx: 0,
        score: 0,
        questions: body.questions,
        answers: {},
      };
      setQuiz(nextQuiz);
      setPicked(null);
      setScreen("quiz");
      updateSession(withInProgress({ ...session, lastLevel: nextQuiz.level, lastSet: nextQuiz.set }, nextQuiz));
    } catch {
      setPaperError("load");
    } finally {
      setLoadingPaper(false);
    }
  }

  function saveQuiz(nextQuiz: EduDecaMockInProgress) {
    setQuiz(nextQuiz);
    updateSession(withInProgress(session, nextQuiz));
  }

  function pickOption(index: number) {
    if (!quiz || picked != null) return;
    const question = quiz.questions[quiz.idx];
    if (!question) return;
    const nextQuiz = {
      ...quiz,
      score: index === question.correctIndex ? quiz.score + 1 : quiz.score,
      answered: true,
      pickedIndex: index,
      answers: { ...quiz.answers, [question.id]: question.options[index] ?? "" },
    };
    setPicked(index);
    saveQuiz(nextQuiz);
  }

  function nextQuestion() {
    if (!quiz) return;
    if (quiz.idx < quiz.questions.length - 1) {
      const nextQuiz = { ...quiz, idx: quiz.idx + 1, answered: false, pickedIndex: null };
      setPicked(null);
      saveQuiz(nextQuiz);
      return;
    }
    void finishQuiz(quiz);
  }

  async function finishQuiz(current: EduDecaMockInProgress) {
    const cleared = withInProgress(session, undefined);
    updateSession(cleared);
    setQuiz(current);
    setScreen("results");
    try {
      const res = await fetch("/api/edudeca-mock/complete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: current.level,
          set: current.set,
          answers: current.answers ?? {},
        }),
      });
      if (!res.ok) return;
      const body = (await res.json()) as {
        correct?: number;
        total?: number;
        scorePct?: number;
      };
      if (
        typeof body.correct === "number" &&
        typeof body.total === "number" &&
        typeof body.scorePct === "number"
      ) {
        setServerScore({
          correct: body.correct,
          total: body.total,
          scorePct: body.scorePct,
        });
      }
    } catch {
      // Keep the on-screen tally; Back URL still uses whatever score we have.
    }
  }

  function exitQuiz() {
    if (!quiz) {
      setScreen("landing");
      return;
    }
    const ok = window.confirm("Leave this test? Your progress will be saved so you can resume later.");
    if (!ok) return;
    updateSession(withInProgress(session, quiz));
    setScreen("landing");
  }

  const results = useMemo(() => {
    if (!quiz || screen !== "results") return null;
    if (serverScore) return serverScore;
    const total = quiz.questions.length;
    const pct = total > 0 ? Math.round((quiz.score / total) * 100) : 0;
    return { total, scorePct: pct, correct: quiz.score };
  }, [quiz, screen, serverScore]);

  const completedReturnUrl =
    quiz && results
      ? edudecaMockReturnUrl({
          level: quiz.level,
          set: quiz.set,
          status: "completed",
          scorePct: results.scorePct,
          correct: results.correct,
          total: results.total,
        })
      : null;
  const pausedReturnUrl = matchingResume
    ? edudecaMockReturnUrl({
        level: matchingResume.level,
        set: matchingResume.set,
        status: "inprogress",
      })
    : `${edudecaAppOrigin()}/mock-test`;

  if (!hydrated) {
    return <div className="min-h-[40vh]" />;
  }

  const question = quiz?.questions[quiz.idx];
  const letters = ["A", "B", "C", "D"] as const;

  return (
    <div className="mx-auto w-full max-w-[900px] px-5 pb-20 pt-2 sm:px-10">
      {screen === "landing" ? (
        <section>
          <div className="px-1 pb-2 pt-8 text-center">
            <p className="mb-4 inline-flex items-center rounded-full border border-[rgba(34,211,166,0.35)] bg-[rgba(34,211,166,0.1)] px-4 py-1.5 text-[11.5px] font-extrabold tracking-[0.5px] text-[#22D3A6]">
              Welcome from EduDeca
            </p>
            <h1 className="mb-2.5 text-[28px] font-extrabold text-[#EAEFF5]">EduDeca Mock Test</h1>
            <p className="mx-auto max-w-[520px] text-sm leading-[1.6] text-[#8B96A5]">
              Take a free-play mock paper in the same format as the EduDeca Challenge. Use the
              EduBlast menu anytime to explore Prep, Learn Hub, Play, and the rest of the site.
            </p>
            <p
              className="mt-6 text-center"
              aria-label={`Level ${session.lastLevel} · Set ${setNo}`}
            >
              <span className="block text-[13px] font-bold text-[#8B96A5]">
                Level {session.lastLevel}
              </span>
              <span className="mt-1 block text-[40px] font-extrabold leading-[1.05] tracking-[-0.6px] text-[#EAEFF5]">
                Set <span className="text-[#22D3A6]">{setNo}</span>
              </span>
            </p>
          </div>

          {matchingResume ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgba(239,159,39,0.4)] bg-[rgba(239,159,39,0.1)] px-4 py-3 text-[12.5px] text-[#EAEFF5]">
              <span>
                <b className="text-[#EF9F27]">Paused</b> at question {matchingResume.idx + 1}/
                {matchingResume.questions.length}
              </span>
              <button
                type="button"
                onClick={() => void startQuiz(matchingResume)}
                className="rounded-lg bg-[#EF9F27] px-3.5 py-1.5 text-xs font-extrabold text-[#2b1c00]"
              >
                Resume
              </button>
            </div>
          ) : null}

          {paperError ? (
            <div className="mt-6 rounded-xl border border-[rgba(212,83,126,0.4)] bg-[rgba(212,83,126,0.1)] px-4 py-3 text-center text-[12.5px] text-[#EAEFF5]">
              <p>{paperErrorCopy(paperError)}</p>
              {paperError === "incomplete_lineup" ? (
                <a
                  href={edudecaAppOrigin()}
                  className="mt-2 inline-block text-xs font-extrabold text-[#22D3A6]"
                >
                  Open EduDeca to pick disciplines
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {EDUDECA_MOCK_LEVELS.map((item) => {
              const active = item.id === session.lastLevel;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectLevel(item.id)}
                  className={cn(
                    "rounded-2xl border-[1.5px] px-[18px] py-[22px] text-center transition-transform hover:-translate-y-0.5",
                    active
                      ? "border-[#1D9E75] bg-[rgba(29,158,117,0.07)] shadow-[0_0_0_1px_rgba(29,158,117,0.3)]"
                      : "border-[#262E3A] bg-[#151A22]",
                  )}
                >
                  <span
                    className="mx-auto mb-3 flex size-[46px] items-center justify-center rounded-xl text-[19px] font-extrabold text-[#04140E]"
                    style={{ background: item.color }}
                  >
                    {item.id}
                  </span>
                  <span className="block text-[15px] font-extrabold text-[#EAEFF5]">{item.name}</span>
                  <span className="mt-1 block text-[11.5px] text-[#5C6675]">{item.meta}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-7 flex flex-col items-center gap-3">
            <button
              type="button"
              disabled={loadingPaper}
              onClick={() => void startQuiz(matchingResume ?? undefined)}
              className="inline-flex items-center justify-center rounded-xl bg-[#1D9E75] px-[26px] py-3.5 text-[14.5px] font-bold text-[#04140E] hover:brightness-110 disabled:opacity-50"
            >
              {loadingPaper ? "Loading paper…" : matchingResume ? "Resume Test" : "Start Test"}
            </button>
            <Link href="/mock" className="text-sm font-semibold text-[#8B96A5] hover:text-[#EAEFF5]">
              Explore other EduBlast mocks
            </Link>
          </div>
        </section>
      ) : null}

      {screen === "quiz" && quiz && question ? (
        <section>
          <div className="flex items-center gap-3 pt-[18px]">
            <button
              type="button"
              onClick={exitQuiz}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#262E3A] bg-[#151A22] text-base text-[#EAEFF5]"
              aria-label="Exit quiz"
            >
              ←
            </button>
            <span
              className="whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-extrabold"
              style={{
                background: `${selected.color}22`,
                color: selected.color,
                border: `1px solid ${selected.color}55`,
              }}
            >
              EduDeca · {selected.name} · Set {formatSetNumber(quiz.set)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex justify-between text-[11px] text-[#5C6675]">
                <span>
                  Question {quiz.idx + 1} of {quiz.questions.length}
                </span>
                <span>{quiz.score} correct</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full border border-[#262E3A] bg-[#1B212B]">
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${(quiz.idx / quiz.questions.length) * 100}%`,
                    background: selected.color,
                  }}
                />
              </div>
            </div>
          </div>

          <span
            className="mt-[22px] inline-block rounded-full px-3 py-1 text-[10.5px] font-extrabold"
            style={{ background: `${selected.color}1a`, color: selected.color }}
          >
            {question.tag}
          </span>
          <h2 className="mb-[22px] mt-3.5 text-[19px] font-bold leading-[1.4] text-[#EAEFF5]">{question.q}</h2>
          <div className="mb-6 flex flex-col gap-[11px]">
            {question.options.map((option, index) => {
              const isPicked = picked === index;
              const isCorrect = index === question.correctIndex;
              const showCorrect = picked != null && isCorrect;
              const showWrong = picked != null && isPicked && !isCorrect;
              return (
                <button
                  key={`${question.id}-${option}-${index}`}
                  type="button"
                  disabled={picked != null}
                  onClick={() => pickOption(index)}
                  className={cn(
                    "flex items-center gap-[13px] rounded-[13px] border-[1.5px] px-4 py-3.5 text-left",
                    showCorrect && "border-[#1D9E75] bg-[rgba(29,158,117,0.12)]",
                    showWrong && "border-[#D4537E] bg-[rgba(212,83,126,0.1)]",
                    picked == null && "border-[#262E3A] bg-[#151A22] hover:border-[#5C6675]",
                    picked != null && !showCorrect && !showWrong && "border-[#262E3A] bg-[#151A22]",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-lg border-[1.5px] text-[12.5px] font-extrabold",
                      showCorrect && "border-[#1D9E75] bg-[#1D9E75] text-[#04140E]",
                      showWrong && "border-[#D4537E] bg-[#D4537E] text-white",
                      !showCorrect && !showWrong && "border-[#262E3A] bg-[#1B212B] text-[#EAEFF5]",
                    )}
                  >
                    {letters[index]}
                  </span>
                  <span className="text-sm font-semibold text-[#EAEFF5]">{option}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={picked == null}
            onClick={nextQuestion}
            className="inline-flex w-full items-center justify-center rounded-xl bg-[#1D9E75] px-[26px] py-3.5 text-[14.5px] font-bold text-[#04140E] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {quiz.idx === quiz.questions.length - 1 ? "Finish" : "Next"}
          </button>
        </section>
      ) : null}

      {screen === "results" && quiz && results ? (
        <section className="px-1 py-10 text-center">
          <div className="mb-3 text-[52px]" aria-hidden>
            {results.scorePct >= 80 ? "🏆" : results.scorePct >= 50 ? "🎉" : "💪"}
          </div>
          <h2 className="mb-1.5 text-[22px] font-extrabold text-[#EAEFF5]">
            {results.scorePct >= 80 ? "Outstanding!" : results.scorePct >= 50 ? "Test complete!" : "Nice effort!"}
          </h2>
          <p className="mb-6 text-[13.5px] text-[#8B96A5]">
            Here&apos;s how you did on EduDeca · {levelMeta(quiz.level).name} · Set{" "}
            {formatSetNumber(quiz.set)}
          </p>
          <p className="mb-8 text-[40px] font-extrabold text-[#EAEFF5]">
            {results.correct}
            <span className="text-base font-semibold text-[#5C6675]">/{results.total} correct</span>
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={completedReturnUrl ?? pausedReturnUrl}
              className="inline-flex items-center justify-center rounded-xl bg-[#1D9E75] px-[26px] py-3.5 text-[14.5px] font-bold text-[#04140E]"
            >
              Back to EduDeca
            </a>
            <Link
              href="/mock"
              className="inline-flex items-center justify-center rounded-xl border-[1.5px] border-[#262E3A] px-[26px] py-3.5 text-[14.5px] font-bold text-[#EAEFF5]"
            >
              Explore EduBlast mocks
            </Link>
          </div>
        </section>
      ) : null}

      {screen === "landing" ? (
        <div className="mt-10 text-center">
          <a href={pausedReturnUrl} className="text-sm font-semibold text-[#5C6675] hover:text-[#8B96A5]">
            Back to EduDeca without finishing
          </a>
        </div>
      ) : null}
    </div>
  );
}
