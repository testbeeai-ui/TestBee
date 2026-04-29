"use client";

import PlayQuestionMarkdown from "@/components/PlayQuestionMarkdown";

export type GeneratedMcqReviewQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number | null;
};

export default function GeneratedMcqReview({
  questions,
  answers,
  total,
  submitted,
  showCorrectAnswers,
  onSelectAnswer,
}: {
  questions: GeneratedMcqReviewQuestion[];
  answers: number[];
  total: number;
  submitted: boolean;
  showCorrectAnswers: boolean;
  onSelectAnswer?: (questionIndex: number, optionIndex: number) => void;
}) {
  return (
    <div className="space-y-3">
      {questions.map((q, qIdx) => {
        const selected = answers[qIdx] ?? -1;
        return (
          <div
            key={q.id}
            className="rounded-xl border border-white/10 bg-[#0b1020] p-3 sm:p-4"
          >
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Question {qIdx + 1} of {total}
            </div>
            <PlayQuestionMarkdown
              source={q.question}
              variant="stem"
              className="mb-3 break-words text-[15px] font-semibold leading-snug text-slate-100"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {q.options.map((opt, optIdx) => {
                const selectedHere = selected === optIdx;
                const isCorrect = q.correctAnswerIndex === optIdx;
                const isWrongSelected = submitted && showCorrectAnswers && selectedHere && !isCorrect;
                const isCorrectRevealed = submitted && showCorrectAnswers && isCorrect;

                return (
                  <button
                    key={`${q.id}-${optIdx}`}
                    type="button"
                    disabled={submitted || !onSelectAnswer}
                    onClick={() => onSelectAnswer?.(qIdx, optIdx)}
                    className={[
                      "group min-w-0 overflow-hidden rounded-xl border px-3 py-2.5 text-left text-sm transition-all duration-200",
                      submitted || !onSelectAnswer
                        ? "cursor-default opacity-95"
                        : "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg",
                      isCorrectRevealed
                        ? "border-emerald-400/60 bg-emerald-500/20 shadow-emerald-500/10 shadow-lg text-emerald-50 break-words"
                        : isWrongSelected
                          ? "border-rose-400/60 bg-rose-500/20 shadow-rose-500/10 shadow-lg text-rose-50 break-words"
                          : selectedHere
                            ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-50 shadow-emerald-500/10 shadow-md break-words"
                            : "border-white/[0.15] bg-white/[0.04] text-slate-200 hover:border-white/40 hover:bg-white/[0.08] hover:text-white shadow-sm hover:shadow-md",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={[
                          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors",
                          isCorrectRevealed
                            ? "bg-emerald-500/30 text-emerald-300 border border-emerald-400/40"
                            : isWrongSelected
                              ? "bg-rose-500/30 text-rose-300 border border-rose-400/40"
                              : selectedHere
                                ? "bg-emerald-500/25 text-emerald-300 border border-emerald-400/30"
                                : "bg-white/[0.08] text-slate-400 border border-white/[0.1] group-hover:bg-white/[0.14] group-hover:text-slate-300",
                        ].join(" ")}
                      >
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <PlayQuestionMarkdown
                        source={opt}
                        variant="option"
                        className="min-w-0 break-words text-sm leading-snug"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
            {submitted && showCorrectAnswers ? (
              <div className="mt-2 text-xs text-slate-400">
                Your answer:{" "}
                {selected >= 0 ? String.fromCharCode(65 + selected) : "Not answered"}
                {" · "}
                Correct answer:{" "}
                {typeof q.correctAnswerIndex === "number"
                  ? String.fromCharCode(65 + q.correctAnswerIndex)
                  : "N/A"}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

