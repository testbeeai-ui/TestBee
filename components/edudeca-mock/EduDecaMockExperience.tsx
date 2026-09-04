"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import MathText from "@/components/MathText";
import { LevelsBrowserDialog } from "@/components/edudeca-mock/LevelsBrowserDialog";
import {
  ExploreOtherMocksButton,
  OtherMocksDialog,
} from "@/components/edudeca-mock/OtherMocksDialog";
import { useAuth } from "@/hooks/useAuth";
import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import { persistPendingDeepLink } from "@/lib/auth/safeNextPath";
import { OTHER_MOCKS_CTA_LABEL } from "@/lib/edudeca-mock/other-mocks";
import {
  EDUDECA_MOCK_LEVELS,
  type EduDecaMockLevelId,
  type QuizQuestion,
} from "@/lib/edudeca-mock/question-bank";
import {
  edudecaAppOrigin,
  edudecaMockFinishReturnUrl,
  edudecaMockLoginRedirect,
  edudecaMockPaperPath,
  edudecaMockReturnUrl,
} from "@/lib/edudeca-mock/return-url";
import { asMockAnswers } from "@/lib/edudeca-mock/pause-attempt";
import { quizFromPaperAndAnswers } from "@/lib/edudeca-mock/resume-quiz";
import {
  applyHandoffQuery,
  collectPapers,
  createEmptySession,
  formatSetNumber,
  isApiPaper,
  loadSession,
  matchingInProgress,
  mergeAttemptChipStatuses,
  parseHandoffQuery,
  saveSession,
  sessionAfterSelectingSet,
  withInProgress,
  withoutPaper,
  type AttemptChipStatus,
  type EduDecaMockInProgress,
  type EduDecaMockSession,
} from "@/lib/edudeca-mock/session-store";
import { cn } from "@/lib/utils";

type Screen = "landing" | "quiz" | "results";
type PaperError = "incomplete_lineup" | "missing_discipline" | "load";

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
    case "load":
      return "Could not load this mock paper. Try again.";
    default: {
      const _never: never = error;
      return _never;
    }
  }
}

function redirectToMockLogin(level: EduDecaMockLevelId, set: number): void {
  const next = edudecaMockPaperPath(level, set);
  persistPendingDeepLink(next);
  window.location.assign(edudecaMockLoginRedirect(level, set));
}

export function EduDecaMockExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const didAutoOpenResume = useRef(false);
  const [session, setSession] = useState<EduDecaMockSession>(createEmptySession);
  const [screen, setScreen] = useState<Screen>("landing");
  const [quiz, setQuiz] = useState<EduDecaMockInProgress | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [paperError, setPaperError] = useState<PaperError | null>(null);
  const [loadingPaper, setLoadingPaper] = useState(false);
  const [otherMocksOpen, setOtherMocksOpen] = useState(false);
  const [levelsBrowserOpen, setLevelsBrowserOpen] = useState(false);
  const [remoteAttemptStatuses, setRemoteAttemptStatuses] = useState<
    Array<{ level: number; set: number; status: AttemptChipStatus }>
  >([]);
  const [serverScore, setServerScore] = useState<{
    correct: number;
    total: number;
    scorePct: number;
  } | null>(null);

  useEffect(() => {
    const stored = loadSession(browserStorage());
    const query = parseHandoffQuery(new URLSearchParams(searchParams.toString()));
    const next = applyHandoffQuery(stored, query);
    persist(next);

    queueMicrotask(() => {
      setSession(next);
      const resume = matchingInProgress(next);
      if (!didAutoOpenResume.current && resume) {
        didAutoOpenResume.current = true;
        setQuiz(resume);
        setPicked(resume.pickedIndex ?? null);
        setScreen("quiz");
      }
      setHydrated(true);
    });
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void fetchWithClientAuth("/api/edudeca-mock/attempts", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as {
          attempts?: Array<{ level: number; set: number; status: AttemptChipStatus }>;
        };
        if (cancelled || !Array.isArray(body.attempts)) return;
        setRemoteAttemptStatuses(
          body.attempts.filter(
            (row) => row.status === "completed" || row.status === "inprogress",
          ),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  const selected = levelMeta(session.lastLevel);
  const setNo = formatSetNumber(session.lastSet);
  const matchingResume = matchingInProgress(session);
  const pausedAttempt =
    (session.inProgress && isApiPaper(session.inProgress.questions) ? session.inProgress : null) ??
    matchingResume;
  const attemptStatuses = mergeAttemptChipStatuses(collectPapers(session), remoteAttemptStatuses);

  function updateSession(next: EduDecaMockSession) {
    setSession(next);
    persist(next);
  }

  function persistPausedAttempt(current: EduDecaMockInProgress): Promise<void> {
    if (!user) return Promise.resolve();
    return fetchWithClientAuth("/api/edudeca-mock/pause", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: current.level,
        set: current.set,
        answers: current.answers ?? {},
      }),
    }).then(() => undefined, () => {
      // localStorage already holds the pause; still return to EduDeca.
    });
  }

  function persistOtherPapers(
    from: EduDecaMockSession,
    keepLevel: number,
    keepSet: number,
  ): Promise<void> {
    const jobs = Object.values(collectPapers(from))
      .filter((paper) => paper.level !== keepLevel || paper.set !== keepSet)
      .map((paper) => persistPausedAttempt(paper));
    return Promise.all(jobs).then(() => undefined);
  }

  async function refreshAttemptStatuses() {
    if (!user) return;
    try {
      const res = await fetchWithClientAuth("/api/edudeca-mock/attempts", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as {
        attempts?: Array<{ level: number; set: number; status: AttemptChipStatus }>;
      };
      if (!Array.isArray(body.attempts)) return;
      setRemoteAttemptStatuses(
        body.attempts.filter(
          (row) => row.status === "completed" || row.status === "inprogress",
        ),
      );
    } catch {
      // Chip colors can still use locally paused papers.
    }
  }

  function selectFeaturedSet(level: EduDecaMockLevelId, set: number) {
    setPaperError(null);
    const live = screen === "quiz" ? quiz : null;
    const next = sessionAfterSelectingSet(session, level, set, live);
    didAutoOpenResume.current = true;
    updateSession(next);
    void persistOtherPapers(next, level, set).then(() => {
      void refreshAttemptStatuses();
    });
    if (live && (live.level !== level || live.set !== set)) {
      setScreen("landing");
      setPicked(null);
    }
    router.replace(edudecaMockPaperPath(level, set), { scroll: false });
    setLevelsBrowserOpen(false);
  }

  async function startQuiz(resume?: EduDecaMockInProgress) {
    await persistOtherPapers(session, session.lastLevel, session.lastSet);

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
      if (!user) {
        redirectToMockLogin(session.lastLevel, session.lastSet);
        return;
      }
      const res = await fetchWithClientAuth(
        `/api/edudeca-mock/paper?level=${session.lastLevel}&set=${session.lastSet}`,
        { cache: "no-store" },
      );
      if (res.status === 401) {
        redirectToMockLogin(session.lastLevel, session.lastSet);
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
      const body = (await res.json()) as {
        questions?: QuizQuestion[];
        attempt?: { status?: string; answers?: unknown };
      };
      if (!Array.isArray(body.questions) || !isApiPaper(body.questions)) {
        setPaperError("load");
        return;
      }

      const savedAnswers = asMockAnswers(body.attempt?.answers);
      const nextQuiz: EduDecaMockInProgress =
        body.attempt?.status === "inprogress" && Object.keys(savedAnswers).length > 0
          ? quizFromPaperAndAnswers(session.lastLevel, session.lastSet, body.questions, savedAnswers)
          : {
              level: session.lastLevel,
              set: session.lastSet,
              idx: 0,
              score: 0,
              questions: body.questions,
              answers: {},
            };
      setQuiz(nextQuiz);
      setPicked(nextQuiz.pickedIndex ?? null);
      setScreen("quiz");
      updateSession(withInProgress({ ...session, lastLevel: nextQuiz.level, lastSet: nextQuiz.set }, nextQuiz));
      void refreshAttemptStatuses();
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
    setServerScore(null);
    updateSession(withoutPaper(session, current.level, current.set));
    setQuiz(current);
    setScreen("results");
    try {
      const res = await fetchWithClientAuth("/api/edudeca-mock/complete", {
        method: "POST",
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
      void refreshAttemptStatuses();
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
    void persistPausedAttempt(quiz);
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
    quiz
      ? edudecaMockFinishReturnUrl({
          level: quiz.level,
          set: quiz.set,
          serverScore,
        })
      : null;
  const pausedReturnUrl = pausedAttempt
    ? edudecaMockReturnUrl({
        level: pausedAttempt.level,
        set: pausedAttempt.set,
        status: "inprogress",
      })
    : `${edudecaAppOrigin()}/mock-test`;

  useEffect(() => {
    if (screen !== "quiz" || !quiz) return;
    const onHide = () => {
      saveSession(browserStorage(), withInProgress(session, quiz));
      void persistPausedAttempt(quiz);
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [quiz, screen, session]);

  if (!hydrated) {
    return <div className="min-h-[40vh]" />;
  }

  const question = quiz?.questions[quiz.idx];
  const letters = ["A", "B", "C", "D"] as const;

  return (
    <div className="mx-auto w-full max-w-[900px] px-5 pb-20 pt-2 sm:px-10">
      {screen === "landing" ? (
        <section>
          <div className="px-1 pb-2 pt-11 text-center">
            <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[rgba(34,211,166,0.35)] bg-[rgba(34,211,166,0.1)] px-[15px] py-1.5 text-[11.5px] font-extrabold tracking-[0.5px] text-[#22D3A6]">
              🎉 Welcome from EduDeca
            </p>
            <h1 className="mb-2.5 text-[28px] font-extrabold text-[#EAEFF5]">EduDeca Mock Test</h1>
            <p className="mx-auto max-w-[520px] text-sm leading-[1.6] text-[#8B96A5]">
              Take a free-play mock paper in the same format as the EduDeca Challenge.
            </p>
          </div>

          {matchingResume ? (
            <div className="mt-[22px] text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(239,159,39,0.4)] bg-[rgba(239,159,39,0.1)] px-4 py-2 text-[12.5px] font-bold text-[#EF9F27]">
                ⏸ Paused at question&nbsp;{matchingResume.idx + 1}/{matchingResume.questions.length}
              </span>
            </div>
          ) : null}

          <div
            className="mt-[30px] text-center"
            aria-label={`${selected.name} · Set ${setNo}`}
          >
            <p className="mb-0.5 text-base font-bold text-[#8B96A5]">{selected.name}</p>
            <p className="text-[64px] font-extrabold leading-[1.05] tracking-[-1px] text-[#EAEFF5]">
              Set <span className="text-[#22D3A6]">{setNo}</span>
            </p>
          </div>

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

          <div className="mt-8 text-center">
            <button
              type="button"
              disabled={loadingPaper || authLoading}
              onClick={() => void startQuiz(matchingResume ?? undefined)}
              className="inline-flex items-center justify-center rounded-xl bg-[#1D9E75] px-11 py-4 text-base font-bold text-[#04140E] hover:brightness-110 disabled:opacity-50"
            >
              {loadingPaper ? "Loading paper…" : "Start Test →"}
            </button>
          </div>

          <div className="mt-[34px] flex flex-wrap items-center justify-center gap-3.5">
            <a
              href={pausedReturnUrl}
              onClick={(event) => {
                if (!pausedAttempt) return;
                event.preventDefault();
                void persistPausedAttempt(pausedAttempt).finally(() => {
                  window.location.assign(pausedReturnUrl);
                });
              }}
              className="inline-flex items-center justify-center rounded-xl border-[1.5px] border-[#262E3A] bg-transparent px-5 py-3.5 text-[13px] font-bold text-[#EAEFF5] hover:border-[#5C6675]"
            >
              Back to EduDeca without finishing
            </a>
            <button
              type="button"
              onClick={() => {
                void refreshAttemptStatuses();
                setLevelsBrowserOpen(true);
              }}
              className="inline-flex items-center justify-center rounded-xl border-[1.5px] border-[#262E3A] bg-transparent px-5 py-3.5 text-[13px] font-bold text-[#EAEFF5] hover:border-[#5C6675]"
            >
              Show me other EduDeca Levels &amp; Sets
            </button>
            <button
              type="button"
              onClick={() => setOtherMocksOpen(true)}
              className="inline-flex items-center justify-center rounded-xl border-[1.5px] border-[rgba(127,119,221,0.5)] bg-transparent px-5 py-3.5 text-[13px] font-bold text-[#7F77DD] hover:border-[#7F77DD]"
            >
              {OTHER_MOCKS_CTA_LABEL}
            </button>
          </div>
        </section>
      ) : null}

      {screen === "quiz" && quiz && question ? (
        <section>
          <div className="flex flex-wrap items-center gap-3 pt-[18px]">
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
            <div className="min-w-[140px] flex-1">
              <div className="mb-1 text-[11px] text-[#5C6675]">
                Question {quiz.idx + 1} of {quiz.questions.length}
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
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <span className="whitespace-nowrap text-[11px] text-[#EAEFF5]">{quiz.score} correct</span>
              <button
                type="button"
                onClick={() => {
                  saveQuiz(quiz);
                  void persistPausedAttempt(quiz);
                  void refreshAttemptStatuses();
                  setLevelsBrowserOpen(true);
                }}
                className="whitespace-nowrap rounded-full border border-[#262E3A] bg-[#151A22] px-3 py-1 text-[11px] font-bold text-[#EAEFF5] hover:border-[#5C6675]"
              >
                Other Levels &amp; Sets
              </button>
              <ExploreOtherMocksButton
                onClick={() => {
                  saveQuiz(quiz);
                  persistPausedAttempt(quiz);
                  setOtherMocksOpen(true);
                }}
              />
            </div>
          </div>

          <span
            className="mt-[22px] inline-block rounded-full px-3 py-1 text-[10.5px] font-extrabold"
            style={{ background: `${selected.color}1a`, color: selected.color }}
          >
            {question.tag}
          </span>
          <h2 className="mb-[22px] mt-3.5 text-[19px] font-bold leading-[1.4] text-[#EAEFF5]">
            <MathText className="[&_.katex]:!text-[#EAEFF5]" weight="bold">
              {question.q}
            </MathText>
          </h2>
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
                  <span className="min-w-0 text-sm font-semibold text-[#EAEFF5]">
                    <MathText className="[&_.katex]:!text-[#EAEFF5]" weight="semibold">
                      {option}
                    </MathText>
                  </span>
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
              className="inline-flex items-center justify-center rounded-xl border-[1.5px] border-[#EAEFF5]/80 px-[22px] py-3.5 text-[14.5px] font-bold text-[#EAEFF5]"
            >
              Back to EduDeca Mock Test
            </a>
            <button
              type="button"
              onClick={() => setOtherMocksOpen(true)}
              className="inline-flex items-center justify-center rounded-xl bg-[#1D9E75] px-[22px] py-3.5 text-[14.5px] font-bold text-[#04140E] hover:brightness-110"
            >
              {OTHER_MOCKS_CTA_LABEL} →
            </button>
          </div>
        </section>
      ) : null}

      <LevelsBrowserDialog
        open={levelsBrowserOpen}
        onClose={() => setLevelsBrowserOpen(false)}
        activeLevel={session.lastLevel}
        activeSet={session.lastSet}
        statuses={attemptStatuses}
        onSelect={selectFeaturedSet}
      />
      <OtherMocksDialog open={otherMocksOpen} onClose={() => setOtherMocksOpen(false)} />
    </div>
  );
}
