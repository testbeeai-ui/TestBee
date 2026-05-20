type NumeralsOutcome = "win" | "loss";

export interface NumeralsPostTemplateInput {
  subject: string;
  chapter?: string | null;
  topic?: string | null;
  subtopic?: string | null;
  formulaTitle?: string | null;
  scorePercent: number;
  correctCount: number;
  wrongCount: number;
  totalQuestions: number;
}

export interface NumeralsPostDraft {
  templateId: string;
  title: string;
  details: string;
  tags: string[];
}

type TemplateDef = {
  id: string;
  outcome: NumeralsOutcome;
  titleLead: string;
  detailLead: string;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function compact(value?: string | null): string | null {
  if (!value) return null;
  const t = value.trim();
  return t.length ? t : null;
}

function numeralsAreaLabel(ctx: NumeralsPostTemplateInput): string {
  return (
    compact(ctx.formulaTitle) ??
    compact(ctx.subtopic) ??
    compact(ctx.topic) ??
    compact(ctx.chapter) ??
    `${ctx.subject} numerals`
  );
}

function scoreLine(ctx: NumeralsPostTemplateInput): string {
  return `${ctx.scorePercent}% (${ctx.correctCount}/${ctx.totalQuestions})`;
}

function hasPercent(text: string): boolean {
  return /\d{1,3}%/.test(text);
}

function hasCorrectTotal(text: string): boolean {
  return /\b\d+\s*\/\s*\d+\b/.test(text);
}

function withRequiredMetrics(
  title: string,
  details: string,
  ctx: NumeralsPostTemplateInput
): { title: string; details: string } {
  const normalizedTitle = hasPercent(title) ? title : `${title} | ${ctx.scorePercent}%`;
  const detailsWithPct = hasPercent(details) ? details : `${details} Score: ${ctx.scorePercent}%.`;
  const normalizedDetails = hasCorrectTotal(detailsWithPct)
    ? detailsWithPct
    : `${detailsWithPct} Correct/Total: ${ctx.correctCount}/${ctx.totalQuestions}.`;
  return { title: normalizedTitle.trim(), details: normalizedDetails.trim() };
}

const WIN_TEMPLATES: TemplateDef[] = [
  { id: "win-01", outcome: "win", titleLead: "Numerals speedrun cleared", detailLead: "Formula recall stayed sharp throughout this set." },
  { id: "win-02", outcome: "win", titleLead: "Calculation flow was clean", detailLead: "Units, substitutions, and final values stayed controlled." },
  { id: "win-03", outcome: "win", titleLead: "Confident numerals execution", detailLead: "The key formula triggers came quickly in this run." },
  { id: "win-04", outcome: "win", titleLead: "Time-pressure handling improved", detailLead: "Mental math and approximation choices were on point." },
  { id: "win-05", outcome: "win", titleLead: "Strong numerals checkpoint", detailLead: "This attempt felt stable from first question to last." },
  { id: "win-06", outcome: "win", titleLead: "Formula drill paid off", detailLead: "Revision notes translated directly into better accuracy." },
  { id: "win-07", outcome: "win", titleLead: "Subtopic numerals unlocked", detailLead: "Pattern recognition was faster than the previous attempt." },
  { id: "win-08", outcome: "win", titleLead: "Cleaner than the last run", detailLead: "Fewer rushed mistakes and better value-checking." },
  { id: "win-09", outcome: "win", titleLead: "Numerical confidence rising", detailLead: "Setup decisions were efficient and conversions stayed accurate." },
  { id: "win-10", outcome: "win", titleLead: "Scoreboard moved in my favor", detailLead: "Steady solving rhythm kept the attempt under control." },
  { id: "win-11", outcome: "win", titleLead: "Formula-to-answer pipeline clicked", detailLead: "The right method surfaced quickly on most questions." },
  { id: "win-12", outcome: "win", titleLead: "Numerals rep done right", detailLead: "This was a reliable attempt, not a lucky one." },
  { id: "win-13", outcome: "win", titleLead: "Accuracy held under pace", detailLead: "I stayed patient on tricky arithmetic steps." },
  { id: "win-14", outcome: "win", titleLead: "Quant stamina looked better", detailLead: "No panic, just one clean rep after another." },
  { id: "win-15", outcome: "win", titleLead: "Precision run completed", detailLead: "Checking signs and units made a visible difference." },
  { id: "win-16", outcome: "win", titleLead: "Numerals milestone logged", detailLead: "The process felt repeatable and competition-ready." },
  { id: "win-17", outcome: "win", titleLead: "Solid formula application", detailLead: "Question selection and pacing were much better today." },
  { id: "win-18", outcome: "win", titleLead: "Focused attempt delivered", detailLead: "Better scratch-work discipline reduced unforced errors." },
  { id: "win-19", outcome: "win", titleLead: "Quant mechanics clicked", detailLead: "This session had the right balance of speed and care." },
  { id: "win-20", outcome: "win", titleLead: "Numerals win posted", detailLead: "Sharing this to lock the momentum and keep standards high." },
];

const LOSS_TEMPLATES: TemplateDef[] = [
  { id: "loss-01", outcome: "loss", titleLead: "Numerals round slipped today", detailLead: "I missed the ideal setup on too many questions." },
  { id: "loss-02", outcome: "loss", titleLead: "Accuracy took a hit", detailLead: "Sign checks and unit checks need tighter discipline." },
  { id: "loss-03", outcome: "loss", titleLead: "Formula recall needs work", detailLead: "I hesitated on method selection and lost momentum." },
  { id: "loss-04", outcome: "loss", titleLead: "Tough numerals attempt", detailLead: "Arithmetic slips outweighed good starts in this run." },
  { id: "loss-05", outcome: "loss", titleLead: "Not my best numerals set", detailLead: "Speed pressure caused avoidable calculation mistakes." },
  { id: "loss-06", outcome: "loss", titleLead: "Comeback rep starts here", detailLead: "I am mapping weak spots and fixing them one by one." },
  { id: "loss-07", outcome: "loss", titleLead: "Reality-check score posted", detailLead: "This result is feedback for the next targeted revision block." },
  { id: "loss-08", outcome: "loss", titleLead: "Need cleaner substitutions", detailLead: "I rushed value placement in key steps." },
  { id: "loss-09", outcome: "loss", titleLead: "Numerals consistency broke", detailLead: "Concept recall was fine; execution quality was not." },
  { id: "loss-10", outcome: "loss", titleLead: "Hard lesson from this set", detailLead: "I am rebuilding pace with accuracy-first reps." },
  { id: "loss-11", outcome: "loss", titleLead: "Missed this one", detailLead: "Question filtering and method choice need better control." },
  { id: "loss-12", outcome: "loss", titleLead: "Setback accepted publicly", detailLead: "Posting this keeps me honest about the work ahead." },
  { id: "loss-13", outcome: "loss", titleLead: "Numerical errors exposed", detailLead: "I need more slow, high-quality formula drills first." },
  { id: "loss-14", outcome: "loss", titleLead: "Pace beat precision today", detailLead: "I will reset with cleaner solving and better checks." },
  { id: "loss-15", outcome: "loss", titleLead: "This score is a checkpoint", detailLead: "Mistakes are now visible, so correction is possible." },
  { id: "loss-16", outcome: "loss", titleLead: "Not clearing this rep yet", detailLead: "I am tightening basics before chasing speed again." },
  { id: "loss-17", outcome: "loss", titleLead: "Numerals confidence dipped", detailLead: "Method clarity must improve before the next attempt." },
  { id: "loss-18", outcome: "loss", titleLead: "Rebuild mode on", detailLead: "I am turning this miss into a focused correction plan." },
  { id: "loss-19", outcome: "loss", titleLead: "Performance drop logged", detailLead: "The next run is about discipline, not guesswork." },
  { id: "loss-20", outcome: "loss", titleLead: "Posting the miss too", detailLead: "Wins and losses both belong in the learning log." },
];

const TEMPLATE_BANK: TemplateDef[] = [...WIN_TEMPLATES, ...LOSS_TEMPLATES];

function toOutcome(scorePercent: number): NumeralsOutcome {
  return scorePercent >= 50 ? "win" : "loss";
}

function buildTags(ctx: NumeralsPostTemplateInput, outcome: NumeralsOutcome): string[] {
  const tags = new Set<string>();
  tags.add("numerals");
  tags.add("quiz_post");
  tags.add(outcome === "win" ? "numerals-win" : "numerals-comeback");
  if (ctx.scorePercent >= 75) tags.add("high-score");
  return Array.from(tags);
}

export function buildNumeralsPostDrafts(input: NumeralsPostTemplateInput): NumeralsPostDraft[] {
  const safeCorrect = Math.max(0, input.correctCount);
  const safeWrong = Math.max(0, input.wrongCount);
  const safeTotal = Math.max(0, input.totalQuestions, safeCorrect + safeWrong);
  const normalized: NumeralsPostTemplateInput = {
    ...input,
    scorePercent: clampPercent(input.scorePercent),
    correctCount: safeCorrect,
    wrongCount: safeWrong,
    totalQuestions: safeTotal,
  };
  const outcome = toOutcome(normalized.scorePercent);
  const area = numeralsAreaLabel(normalized);

  return TEMPLATE_BANK.filter((tpl) => tpl.outcome === outcome).map((tpl) => {
    const rendered = withRequiredMetrics(
      `${tpl.titleLead} ${scoreLine(normalized)} · ${area}`,
      `${tpl.detailLead} Scoreline ${scoreLine(normalized)}. Wrong: ${normalized.wrongCount}.`,
      normalized
    );
    return {
      templateId: tpl.id,
      title: rendered.title,
      details: rendered.details,
      tags: buildTags(normalized, outcome),
    };
  });
}

export function pickRandomNumeralsPostDraft(
  drafts: NumeralsPostDraft[],
  usedTemplateIds: Set<string>
): NumeralsPostDraft {
  const candidates = drafts.filter((draft) => !usedTemplateIds.has(draft.templateId));
  const pool = candidates.length ? candidates : drafts;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index]!;
}
