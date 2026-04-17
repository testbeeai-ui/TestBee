type QuizPerformanceBand = "high" | "mid" | "low";

export interface QuizPostTemplateInput {
  subject: string;
  chapter?: string | null;
  topic?: string | null;
  subtopic?: string | null;
  scorePercent: number;
  correctCount: number;
  wrongCount: number;
  totalQuestions: number;
  hadPreviousAttempt: boolean;
}

export interface QuizPostDraft {
  templateId: string;
  title: string;
  details: string;
  tags: string[];
}

type TemplateDef = {
  id: string;
  bands: QuizPerformanceBand[];
  title: (ctx: QuizPostTemplateInput) => string;
  details: (ctx: QuizPostTemplateInput) => string;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toBand(scorePercent: number): QuizPerformanceBand {
  if (scorePercent >= 75) return "high";
  if (scorePercent >= 45) return "mid";
  return "low";
}

function compact(value?: string | null): string | null {
  if (!value) return null;
  const t = value.trim();
  return t.length ? t : null;
}

function areaLabel(ctx: QuizPostTemplateInput): string {
  return compact(ctx.subtopic) ?? compact(ctx.topic) ?? compact(ctx.chapter) ?? `${ctx.subject} quiz`;
}

function momentumLine(ctx: QuizPostTemplateInput): string {
  if (ctx.hadPreviousAttempt) {
    return "Second attempt energy is different. Staying consistent.";
  }
  if (ctx.scorePercent >= 75) return "Momentum is real right now.";
  if (ctx.scorePercent >= 45) return "Still climbing. Not done yet.";
  return "Tough one, but this is where progress starts.";
}

function scoreLine(ctx: QuizPostTemplateInput): string {
  return `${ctx.scorePercent}% (${ctx.correctCount}/${ctx.totalQuestions})`;
}

function hasPercent(text: string): boolean {
  return /\d{1,3}%/.test(text);
}

function hasCorrectTotal(text: string): boolean {
  return /\b\d+\s*\/\s*\d+\b/.test(text);
}

function withRequiredMetrics(title: string, details: string, ctx: QuizPostTemplateInput): { title: string; details: string } {
  const normalizedTitle = hasPercent(title) ? title : `${title} | ${ctx.scorePercent}%`;
  const detailsWithPct = hasPercent(details) ? details : `${details} Score: ${ctx.scorePercent}%.`;
  const normalizedDetails = hasCorrectTotal(detailsWithPct)
    ? detailsWithPct
    : `${detailsWithPct} Correct/Total: ${ctx.correctCount}/${ctx.totalQuestions}.`;
  return { title: normalizedTitle.trim(), details: normalizedDetails.trim() };
}

function createTemplate(
  id: string,
  bands: QuizPerformanceBand[],
  titleLead: string,
  detailLead: string
): TemplateDef {
  return {
    id,
    bands,
    title: (ctx) => `${titleLead} ${scoreLine(ctx)} · ${areaLabel(ctx)}`,
    details: (ctx) =>
      `${detailLead} Scoreline ${scoreLine(ctx)}. Wrong: ${ctx.wrongCount}. ${momentumLine(ctx)}`,
  };
}

const highTitleLeads = [
  "Pressure test cleared",
  "Rank push successful",
  "Execution stayed clean",
  "Speed + accuracy click",
  "Strong scoreboard update",
  "Lead pack mindset active",
  "Focus block converted",
  "Consistency streak alive",
  "High-intent session won",
  "Distraction-free run delivered",
  "Competitive edge showed up",
  "Clutch attempt completed",
  "Scoreboard moved upward",
  "Precision run confirmed",
  "Peak-mode quiz finish",
  "Challenge accepted and handled",
];

const highDetailLeads = [
  "Posting this to keep pressure on and standards high.",
  "Small errors, strong control, and repeatable process.",
  "This is the benchmark I want to protect daily.",
  "No comfort zone; I want this level every session.",
  "Current plan is working, now I tighten timing.",
  "Staying public keeps the performance honest.",
  "The gap closes when I execute like this.",
  "Turning practice into scoreboard proof.",
  "Carrying this form into the next mock block.",
  "Locked-in approach beat passive revision today.",
  "Target stays aggressive, discipline stays non-negotiable.",
  "I am training for consistency under pressure, not luck.",
  "This standard must become default.",
  "Keeping momentum visible to avoid complacency.",
  "Another rep done, next rep faster.",
  "I am building a profile that holds on hard days too.",
];

const midTitleLeads = [
  "Competitive climb continues",
  "Useful score with upside",
  "Base level secured",
  "Not peak yet, still dangerous",
  "Workmanlike attempt logged",
  "Progress under pressure",
  "Steady scoreboard movement",
  "Mid-pack today, top-pack next",
  "Clear improvement signal",
  "Growth-mode run complete",
  "Better control than last attempt",
  "Structure over emotion",
  "Climb-phase snapshot",
  "Solid rep, higher target",
  "Accuracy foundation building",
  "Stronger than last cycle",
];

const midDetailLeads = [
  "This is a transition score, not a final score.",
  "I can see exactly where marks are leaking.",
  "Next attempt is about conversion, not random effort.",
  "I am keeping the process strict and measurable.",
  "Gaps are visible, which means they are fixable.",
  "This is where consistent competitors separate themselves.",
  "No panic, only targeted refinement.",
  "I am optimizing question selection and review discipline.",
  "Mid score today, high-standard prep tonight.",
  "Each attempt gets more controlled than the previous one.",
  "The plan now is precision on recurring misses.",
  "I am staying accountable until this crosses elite range.",
  "Not satisfied, but definitely improving.",
  "The margin for growth is still large and exciting.",
  "Next rep should show cleaner decision-making.",
  "This is a platform score for the next jump.",
];

const lowTitleLeads = [
  "Scoreboard hit taken",
  "Hard lesson attempt posted",
  "Rough result, real feedback",
  "Setback logged publicly",
  "Comeback phase starts now",
  "Today exposed the cracks",
  "Low score, high accountability",
  "Difficult paper, honest output",
  "Pressure beat me this round",
  "Rebuild attempt initiated",
  "Wake-up call accepted",
  "Missed today, improving tomorrow",
  "Reset mode activated",
  "No excuses performance log",
  "Reality-check attempt complete",
  "I am posting the misses too",
];

const lowDetailLeads = [
  "No hiding from this one; I convert misses into a plan.",
  "This is uncomfortable, and that is exactly why it matters.",
  "I now have a clear correction list for the next run.",
  "Discipline is posting both wins and losses.",
  "I am rebuilding fundamentals before speed returns.",
  "This score is data, not identity.",
  "Weak spots are visible, so execution can improve fast.",
  "The comeback starts with honest diagnostics.",
  "I am keeping this public to force consistency.",
  "Next attempt will be concept-first and cleaner.",
  "Painful result, useful direction.",
  "No shortcuts now, only quality reps.",
  "This is where rank growth usually begins.",
  "I am using this miss as fuel for targeted revision.",
  "Mistakes are now mapped and scheduled.",
  "The only way out is through deliberate practice.",
];

const mixedTitleLeads = [
  "Public accountability check",
  "Competitive learning log",
];

const mixedDetailLeads = [
  "Sharing this run so the process stays visible.",
  "Open to better solving frameworks from the community.",
];

const TEMPLATE_BANK: TemplateDef[] = [
  ...highTitleLeads.map((lead, idx) => createTemplate(`high-${idx + 1}`, ["high"], lead, highDetailLeads[idx]!)),
  ...midTitleLeads.map((lead, idx) => createTemplate(`mid-${idx + 1}`, ["mid"], lead, midDetailLeads[idx]!)),
  ...lowTitleLeads.map((lead, idx) => createTemplate(`low-${idx + 1}`, ["low"], lead, lowDetailLeads[idx]!)),
  ...mixedTitleLeads.map((lead, idx) =>
    createTemplate(`mixed-${idx + 1}`, ["high", "mid", "low"], lead, mixedDetailLeads[idx]!)
  ),
];

function buildTags(ctx: QuizPostTemplateInput, band: QuizPerformanceBand): string[] {
  const tags = new Set<string>();
  tags.add("quiz");
  tags.add(`accuracy-${band}`);
  if (ctx.scorePercent >= 75) {
    tags.add("high-score");
  } else if (ctx.scorePercent < 45) {
    tags.add("comeback");
  }
  return Array.from(tags);
}

export function buildQuizPostDrafts(input: QuizPostTemplateInput): QuizPostDraft[] {
  const safeCorrect = Math.max(0, input.correctCount);
  const safeWrong = Math.max(0, input.wrongCount);
  const safeTotal = Math.max(0, input.totalQuestions, safeCorrect + safeWrong);
  const normalized: QuizPostTemplateInput = {
    ...input,
    scorePercent: clampPercent(input.scorePercent),
    correctCount: safeCorrect,
    wrongCount: safeWrong,
    totalQuestions: safeTotal,
  };
  const band = toBand(normalized.scorePercent);
  const drafts = TEMPLATE_BANK.filter((tpl) => tpl.bands.includes(band)).map((tpl) => {
    const rendered = withRequiredMetrics(tpl.title(normalized), tpl.details(normalized), normalized);
    return {
      templateId: tpl.id,
      title: rendered.title,
      details: rendered.details,
      tags: buildTags(normalized, band),
    };
  });
  return drafts.length
    ? drafts
    : TEMPLATE_BANK.slice(0, 5).map((tpl) => {
        const rendered = withRequiredMetrics(tpl.title(normalized), tpl.details(normalized), normalized);
        return {
          templateId: tpl.id,
          title: rendered.title,
          details: rendered.details,
          tags: buildTags(normalized, band),
        };
      });
}

export function pickRandomQuizPostDraft(
  drafts: QuizPostDraft[],
  usedTemplateIds: Set<string>
): QuizPostDraft {
  const candidates = drafts.filter((draft) => !usedTemplateIds.has(draft.templateId));
  const pool = candidates.length ? candidates : drafts;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index]!;
}

