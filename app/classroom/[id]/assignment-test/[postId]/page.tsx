"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { safeGetSession } from "@/lib/safeSession";
import GeneratedMcqReview from "@/components/classroom/GeneratedMcqReview";

type Question = {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number | null;
};

type Attempt = {
  answers: number[];
  score: number;
  total: number;
  submittedAt: string | null;
};

type Payload = {
  testTitle: string;
  taskId: string | null;
  isTeacher: boolean;
  progressAvailable: boolean;
  reviewingAs: string | null;
  questions: Question[];
  attempt: Attempt | null;
};

async function authedFetch(url: string, init?: RequestInit) {
  const { session } = await safeGetSession();
  const headers = new Headers(init?.headers ?? {});
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  return fetch(url, { ...init, headers, credentials: "include" });
}

export default function ClassroomAssignmentTestPage() {
  const params = useParams<{ id: string; postId: string }>();
  const classroomId = params?.id ?? "";
  const postId = params?.postId ?? "";
  const searchParams = useSearchParams();
  const reviewAs = searchParams.get("reviewAs");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [showReview, setShowReview] = useState(false);

  const loadTestData = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!classroomId || !postId) return false;
      setLoading(true);
      setError(null);
      try {
        const apiUrl = `/api/classroom/${classroomId}/posts/${postId}/generated-test-attempt${reviewAs ? `?reviewAs=${reviewAs}` : ""}`;
        const res = await authedFetch(apiUrl);
        const data = (await res.json()) as Payload & { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Could not load assignment test.");
          return false;
        }
        setPayload(data);
        const nextAnswers = data.attempt?.answers ?? new Array(data.questions.length).fill(-1);
        setAnswers(nextAnswers);
        const isSubmitted = Boolean(data.attempt?.submittedAt);
        setSubmitted(isSubmitted);
        setScore(isSubmitted ? (data.attempt?.score ?? 0) : null);
        setShowReview(isSubmitted);
        if (isSubmitted && !opts?.silent) {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        return isSubmitted;
      } catch {
        setError("Network error while loading assignment test.");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [classroomId, postId, reviewAs]
  );

  useEffect(() => {
    void loadTestData();
  }, [loadTestData]);

  const total = payload?.questions.length ?? 0;
  const answeredCount = useMemo(() => answers.filter((a) => a >= 0).length, [answers]);

  const updateAnswer = (questionIndex: number, optionIndex: number) => {
    if (submitted) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[questionIndex] = optionIndex;
      return next;
    });
  };

  const submitAttempt = async () => {
    if (!payload || submitted) return;
    setSaving(true);
    setError(null);
    try {
      const res = await authedFetch(
        `/api/classroom/${classroomId}/posts/${postId}/generated-test-attempt`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers, submit: true }),
        }
      );
      const data = (await res.json()) as {
        error?: string;
        score?: number;
        total?: number;
        submittedAt?: string | null;
      };
      if (!res.ok) {
        setError(data.error ?? "Failed to submit test.");
        return;
      }
      // Re-fetch from server to confirm the row actually persisted
      const verified = await loadTestData({ silent: true });
      if (!verified) {
        setError("Submission could not be verified. Please refresh the page.");
      }
    } catch {
      setError("Network error while submitting test.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <main className="min-h-screen overflow-x-hidden bg-[#070b16] px-4 py-6 text-slate-100 sm:px-6">
        <div className="mx-auto w-full max-w-4xl">
          {loading ? (
            <div className="flex min-h-[45vh] items-center justify-center gap-2 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading assignment test...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              {error}
            </div>
          ) : payload ? (
            <div className="space-y-4">
              <header className="rounded-2xl border border-white/[0.1] bg-[#0f1428] p-4 sm:p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Classroom Assignment
                </div>
                <h1 className="mt-1 break-words font-serif text-xl tracking-tight text-slate-50 sm:text-2xl md:text-3xl">
                  {payload.testTitle}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                    {total} Questions
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                    {answeredCount}/{total} answered
                  </span>
                </div>
                {payload?.reviewingAs ? (
                  <div className="mt-4 flex items-center gap-3 rounded-xl border border-sky-400/20 bg-sky-500/10 p-3 sm:p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-sky-400/40 bg-sky-500/20 text-sm font-bold text-sky-300">
                      R
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-sky-200">
                        Reviewing student answers
                      </div>
                      <div className="text-xs text-sky-400/70">
                        You are viewing this student&apos;s submitted attempt.
                      </div>
                    </div>
                  </div>
                ) : null}
                {submitted && score !== null ? (
                  <div className="mt-4 flex items-center gap-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 sm:p-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-emerald-400/40 bg-emerald-500/20 text-lg font-bold text-emerald-300 sm:h-16 sm:w-16 sm:text-xl">
                      {Math.round((score / total) * 100)}%
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-emerald-200">
                        Score: {score} / {total}
                      </div>
                      <div className="text-xs text-emerald-400/70">
                        {score >= total * 0.8
                          ? "Excellent work!"
                          : score >= total * 0.6
                            ? "Good effort — review mistakes above."
                            : score >= total * 0.4
                              ? "Keep practicing — check correct answers."
                              : "Needs more practice — review all answers."}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        Submitted. You cannot change answers now.
                      </div>
                    </div>
                  </div>
                ) : null}
                {submitted ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowReview((prev) => !prev)}
                      className="inline-flex h-10 items-center gap-1.5 rounded-full border border-sky-400/35 bg-sky-500/20 px-4 text-sm font-semibold text-sky-100"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {showReview ? "Hide correct answers" : "Show correct answers"}
                    </button>
                  </div>
                ) : null}
              </header>

              <section className="space-y-3">
                <GeneratedMcqReview
                  questions={payload.questions}
                  answers={answers}
                  total={total}
                  submitted={submitted}
                  showCorrectAnswers={showReview}
                  onSelectAnswer={submitted ? undefined : updateAnswer}
                />
              </section>

              {!submitted ? (
                <div className="sticky bottom-3 z-10 rounded-xl border border-white/[0.1] bg-[#0f1428]/95 p-3 backdrop-blur">
                  <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-400">
                      Submit to lock your responses and view score.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        void submitAttempt();
                      }}
                      disabled={saving}
                      className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-500 px-5 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? "Submitting..." : "Submit answers"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </main>
    </ProtectedRoute>
  );
}
