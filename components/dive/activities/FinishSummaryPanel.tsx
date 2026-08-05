"use client";

type FinishSummaryPanelProps = {
  title: string;
  scorePct: number;
  correct: number;
  total: number;
  /**
   * Honest RDM line for this finish (already credited / need all sets / no reward).
   * Prefer this over implying a credit that has not happened.
   */
  rdmLabel?: string;
  rdmHighlight?: boolean;
  onContinue: () => void;
};

export default function FinishSummaryPanel({
  title,
  scorePct,
  correct,
  total,
  rdmLabel = "—",
  rdmHighlight = false,
  onContinue,
}: FinishSummaryPanelProps) {
  const isHigh = scorePct >= 80;
  const isPass = scorePct >= 60;

  const statusBadge = isHigh
    ? { label: "Outstanding!", emoji: "🎉", bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" }
    : isPass
      ? { label: "Good Effort!", emoji: "👍", bg: "bg-amber-500/10 border-amber-500/30 text-amber-400" }
      : { label: "Keep Practicing!", emoji: "💪", bg: "bg-rose-500/10 border-rose-500/30 text-rose-400" };

  const ringGlow = isHigh
    ? "from-emerald-500/20 via-teal-500/10 to-transparent text-emerald-400 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
    : isPass
      ? "from-amber-500/20 via-yellow-500/10 to-transparent text-amber-400 border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.2)]"
      : "from-rose-500/20 via-pink-500/10 to-transparent text-rose-400 border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.2)]";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center justify-start px-4 py-5 text-center sm:justify-center sm:py-6 max-[640px]:py-4">
      <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-primary sm:mb-2.5">
        <i className="ti ti-trophy text-xs" aria-hidden="true" />
        Assessment Result
      </span>

      <h3 className="mb-1 text-lg font-extrabold text-foreground sm:text-xl">{title}</h3>
      <div className={`mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold sm:mb-5 ${statusBadge.bg}`}>
        <span>{statusBadge.emoji}</span>
        <span>{statusBadge.label}</span>
      </div>

      <div
        className={`relative mb-4 flex h-28 w-28 items-center justify-center rounded-full border bg-gradient-to-b sm:mb-6 sm:h-32 sm:w-32 ${ringGlow}`}
      >
        <div className="flex flex-col items-center justify-center">
          <span className="text-3xl font-black tracking-tight sm:text-4xl">{scorePct}%</span>
          <span className="mt-0.5 text-[10px] font-extrabold uppercase tracking-widest opacity-75">Score</span>
        </div>
      </div>

      <div className="mb-4 grid w-full max-w-sm grid-cols-2 gap-2.5 sm:mb-5 sm:gap-3">
        <div className="flex flex-col items-center rounded-xl border border-border/60 bg-card/40 p-3 shadow-sm">
          <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <i className="ti ti-check text-emerald-400" aria-hidden="true" />
            Accuracy
          </div>
          <span className="text-sm font-bold text-foreground">
            {total > 0 ? `${correct} of ${total} correct` : "Marked complete"}
          </span>
        </div>

        <div className="flex flex-col items-center rounded-xl border border-border/60 bg-card/40 p-3 shadow-sm">
          <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <i className="ti ti-coin text-amber-400" aria-hidden="true" />
            RDM Reward
          </div>
          <span
            className={`text-sm font-bold ${
              rdmHighlight ? "text-amber-400" : "text-muted-foreground"
            }`}
          >
            {rdmLabel}
          </span>
        </div>
      </div>

      <div className="mb-4 flex w-full max-w-sm items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-3.5 py-2.5 text-xs text-muted-foreground sm:mb-6">
        <i className="ti ti-sparkles shrink-0 text-primary" aria-hidden="true" />
        <span>Your Dive hub Completion and Proficiency scores update when you return.</span>
      </div>

      <button
        type="button"
        className="mb-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-lg transition hover:scale-[1.02] hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.98]"
        onClick={onContinue}
      >
        <span>Back to Dive hub</span>
        <i className="ti ti-arrow-right text-sm" aria-hidden="true" />
      </button>
    </div>
  );
}
