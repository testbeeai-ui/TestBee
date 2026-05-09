import type { ReferChallengePublicSpec } from "@/lib/referEarnChallenges";

export type ReferShareOutcome = "won" | "lost";

export type ReferChallengeSharePayload = {
  challengeKey: ReferChallengePublicSpec["key"];
  challengeName: string;
  domain: ReferChallengePublicSpec["domain"];
  /** Win RDM (pass bar) — used in templates as {rewardRdm} */
  rewardRdm: number;
  /** Share bonus RDM after verified share */
  shareRdm: number;
  correct: number;
  attempted: number;
  total: number;
  /** Percent correct out of all questions in the challenge: round(correct / total * 100). Not “of attempted only”. */
  accuracyPct: number;
  timeTakenLabel: string;
  neededCorrect: number;
  outcome: ReferShareOutcome;
  appUrl: string;
  shareDateIso: string;
};

export type ReferChallengeShareTemplate = {
  id: string;
  platform: "instagram";
  tone: "achievement" | "progress" | "comeback";
  title: string;
  body: string;
  cta: string;
  /** Full caption (title + body + cta) for copy/preview — do not repeat `title` in community `content`. */
  text: string;
  waTitle: string;
  waBody: string;
  waCta: string;
  whatsappText: string;
  /** One line for UI under share actions; also appended to WhatsApp message. */
  shareBonusNote: string;
  charCount: number;
};

type ReferChallengeTemplateDef = {
  id: string;
  tone: "achievement" | "progress" | "comeback";
  hook: string;
  bodyPattern: string;
  ctaPattern: string;
  waHook: string;
  waBodyPattern: string;
  waCtaPattern: string;
};

export function buildReferSharePayload(input: {
  spec: ReferChallengePublicSpec;
  correct: number;
  attempted: number;
  total: number;
  accuracyPct: number;
  timeTakenLabel: string;
  neededCorrect: number;
  outcome: ReferShareOutcome;
  appUrl: string;
  shareDateIso?: string;
}): ReferChallengeSharePayload {
  return {
    challengeKey: input.spec.key,
    challengeName: input.spec.name,
    domain: input.spec.domain,
    rewardRdm: input.spec.winRdm,
    shareRdm: input.spec.shareRdm,
    correct: input.correct,
    attempted: input.attempted,
    total: input.total,
    accuracyPct: input.accuracyPct,
    timeTakenLabel: input.timeTakenLabel,
    neededCorrect: input.neededCorrect,
    outcome: input.outcome,
    appUrl: input.appUrl,
    shareDateIso: input.shareDateIso ?? new Date().toISOString().slice(0, 10),
  };
}

function fillPattern(pattern: string, payload: ReferChallengeSharePayload): string {
  const domainLabel = payload.domain === "academic" ? "Academic Arena" : "Funbrain";
  return pattern
    .replaceAll("{challengeName}", payload.challengeName)
    .replaceAll("{domainLabel}", domainLabel)
    .replaceAll("{rewardRdm}", String(payload.rewardRdm))
    .replaceAll("{shareRdm}", String(payload.shareRdm))
    .replaceAll("{correct}", String(payload.correct))
    .replaceAll("{attempted}", String(payload.attempted))
    .replaceAll("{total}", String(payload.total))
    .replaceAll("{accuracyPct}", String(payload.accuracyPct))
    .replaceAll("{timeTakenLabel}", payload.timeTakenLabel)
    .replaceAll("{neededCorrect}", String(payload.neededCorrect))
    .replaceAll("{appUrl}", payload.appUrl);
}

function makeTemplate(
  def: ReferChallengeTemplateDef,
  payload: ReferChallengeSharePayload
): ReferChallengeShareTemplate {
  const title = fillPattern(def.hook, payload);
  const body = fillPattern(def.bodyPattern, payload);
  const cta = fillPattern(def.ctaPattern, payload);
  const text = [title, body, cta].join("\n\n");

  const waTitle = fillPattern(def.waHook, payload);
  const waBody = fillPattern(def.waBodyPattern, payload);
  const waCta = fillPattern(def.waCtaPattern, payload);
  const shareBonusNote = `Sharing can earn you +${payload.shareRdm} RDM once your share is verified (Earn & Learn).`;
  const whatsappText = [waTitle, waBody, waCta, shareBonusNote].join("\n\n");

  return {
    id: def.id,
    platform: "instagram",
    tone: def.tone,
    title,
    body,
    cta,
    text,
    waTitle,
    waBody,
    waCta,
    whatsappText,
    shareBonusNote,
    charCount: text.length,
  };
}

/**
 * Win templates — public + WhatsApp aligned with competence, clarity, and calm pride.
 * Avoid hype slang; invite peers without pressure or “trash talk.”
 */
const IG_WIN_DEFS: ReferChallengeTemplateDef[] = [
  {
    id: "ig_win_01",
    tone: "achievement",
    hook: "Passed {challengeName} on EduBlast.",
    bodyPattern:
      "{correct}/{total} correct ({accuracyPct}%) in {timeTakenLabel}. Track: {domainLabel}.",
    ctaPattern: "Try the same challenge: {appUrl}",
    waHook: "I cleared {challengeName} on EduBlast today.",
    waBodyPattern:
      "{correct}/{total} correct ({accuracyPct}%) in {timeTakenLabel} on {domainLabel}. Posting in case friends want to try the same timed run.",
    waCtaPattern: "Link: {appUrl}",
  },
  {
    id: "ig_win_02",
    tone: "achievement",
    hook: "Met the pass bar: {challengeName}.",
    bodyPattern: "{accuracyPct}% across all {total} questions ({correct}/{total}) · {timeTakenLabel}.",
    ctaPattern: "See how you compare: {appUrl}",
    waHook: "Met the pass bar on {challengeName}.",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) with the full question set, finished in {timeTakenLabel}. Happy to swap prep tips if anyone is practicing {domainLabel}.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "ig_win_03",
    tone: "progress",
    hook: "{challengeName} — session complete.",
    bodyPattern: "{domainLabel} · {correct}/{total} · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Start your attempt: {appUrl}",
    waHook: "Finished a clean run on {challengeName}.",
    waBodyPattern:
      "{domainLabel} session: {correct}/{total} correct, {accuracyPct}%, clock {timeTakenLabel}. Sharing for accountability and to invite others to practice.",
    waCtaPattern: "EduBlast Earn & Learn: {appUrl}",
  },
  {
    id: "ig_win_04",
    tone: "achievement",
    hook: "Earn & Learn: {challengeName} cleared.",
    bodyPattern: "Result: {correct}/{total} ({accuracyPct}%) in {timeTakenLabel}.",
    ctaPattern: "Join the challenge: {appUrl}",
    waHook: "Earn & Learn update — I passed {challengeName}.",
    waBodyPattern:
      "Numbers: {correct}/{total}, {accuracyPct}%, time {timeTakenLabel}. If you are building daily study habits, this is a solid timed drill on {domainLabel}.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "ig_win_05",
    tone: "progress",
    hook: "Timed challenge done: {challengeName}.",
    bodyPattern: "{correct}/{total} correct · {accuracyPct}% · {timeTakenLabel} on the clock.",
    ctaPattern: "Practice here: {appUrl}",
    waHook: "Wrapped {challengeName} under time pressure.",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. The timer keeps it honest — good rehearsal for exam-style pacing on {domainLabel}.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "ig_win_06",
    tone: "achievement",
    hook: "{challengeName}: pass confirmed.",
    bodyPattern: "Accuracy {accuracyPct}% ({correct}/{total}) · {domainLabel}.",
    ctaPattern: "Take the challenge: {appUrl}",
    waHook: "Pass confirmed on {challengeName}.",
    waBodyPattern:
      "{accuracyPct}% accuracy ({correct}/{total}), {domainLabel} content. Sharing so classmates can benchmark against the same item bank.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "ig_win_07",
    tone: "achievement",
    hook: "Personal best logged — {challengeName}.",
    bodyPattern: "{correct}/{total} · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Try it on EduBlast: {appUrl}",
    waHook: "Logging a strong run on {challengeName}.",
    waBodyPattern:
      "{correct}/{total} correct, {accuracyPct}%, {timeTakenLabel}. I am treating this as a baseline to beat next week — join if you like structured quizzes.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "ig_win_08",
    tone: "progress",
    hook: "Study streak fuel: cleared {challengeName}.",
    bodyPattern: "{domainLabel} · {correct}/{total} correct · {accuracyPct}%.",
    ctaPattern: "Build your streak: {appUrl}",
    waHook: "Small win on {challengeName} for the study streak.",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) on {domainLabel}. Consistency matters more than one perfect day — still nice to see the bar turn green.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "ig_win_09",
    tone: "achievement",
    hook: "{challengeName} — all questions reviewed.",
    bodyPattern: "Final: {correct}/{total} ({accuracyPct}%) · {timeTakenLabel}.",
    ctaPattern: "Challenge a friend: {appUrl}",
    waHook: "Completed {challengeName} with the full question set.",
    waBodyPattern:
      "{correct}/{total}, {accuracyPct}%, {timeTakenLabel}. If you want a respectful head-to-head on the same format, the link is below.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "ig_win_10",
    tone: "progress",
    hook: "Checked off {challengeName} today.",
    bodyPattern: "{correct}/{total} · {accuracyPct}% · {domainLabel} · {timeTakenLabel}.",
    ctaPattern: "Open EduBlast: {appUrl}",
    waHook: "Checked off {challengeName} on today’s list.",
    waBodyPattern:
      "{correct}/{total} correct, {accuracyPct}%, {timeTakenLabel}. Nothing flashy — just showing that short, focused reps on {domainLabel} add up.",
    waCtaPattern: "{appUrl}",
  },
];

/**
 * Loss templates — growth mindset: normalize effort, protect self-image, clear next step.
 * Language avoids shame; frames outcome as data + learning, not identity.
 */
const IG_LOSS_DEFS: ReferChallengeTemplateDef[] = [
  {
    id: "ig_loss_01",
    tone: "comeback",
    hook: "Still working toward {challengeName} — this round did not pass.",
    bodyPattern: "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Pass bar: {neededCorrect}/{total}.",
    ctaPattern: "Practice on EduBlast: {appUrl}",
    waHook: "Honest update: I did not pass {challengeName} this time.",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}; needed {neededCorrect}/{total} to earn the win RDM. Treating it as feedback, not a verdict — retry planned.",
    waCtaPattern: "Same challenge here if you want to study together: {appUrl}",
  },
  {
    id: "ig_loss_02",
    tone: "comeback",
    hook: "{challengeName}: attempt logged, bar not met yet.",
    bodyPattern: "Score {correct}/{total} · {accuracyPct}% · target {neededCorrect}/{total}.",
    ctaPattern: "Next session: {appUrl}",
    waHook: "Logged a {challengeName} attempt that stopped short of the pass bar.",
    waBodyPattern:
      "{correct}/{total}, {accuracyPct}%. The platform needs {neededCorrect}/{total} correct to count as a pass. I am reviewing mistakes before the next run.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "ig_loss_03",
    tone: "progress",
    hook: "Learning curve: {challengeName} on {domainLabel}.",
    bodyPattern: "{correct}/{total} correct · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Try when you are ready: {appUrl}",
    waHook: "Sharing a {domainLabel} practice round ({challengeName}) that did not pass.",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Posting so others know these drills are hard — persistence beats one-off scores.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "ig_loss_04",
    tone: "comeback",
    hook: "Progress note — {challengeName}.",
    bodyPattern: "{correct}/{total} | {accuracyPct}% | pass threshold {neededCorrect}/{total}.",
    ctaPattern: "Compare or retry: {appUrl}",
    waHook: "Progress note from {challengeName}.",
    waBodyPattern:
      "Today: {correct}/{total} ({accuracyPct}%). Pass rule is {neededCorrect}/{total} correct. Open to swapping what tripped me up if anyone else is prepping.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "ig_loss_05",
    tone: "comeback",
    hook: "{challengeName} — paused before the pass line.",
    bodyPattern: "{correct}/{total} at {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Resume practice: {appUrl}",
    waHook: "Paused short of a pass on {challengeName}.",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) with {timeTakenLabel} on the timer. I am focusing on accuracy first, then speed — will rerun when ready.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "ig_loss_06",
    tone: "progress",
    hook: "Today’s practice data: {challengeName}.",
    bodyPattern: "{correct}/{total}, {accuracyPct}% (clear bar {neededCorrect}/{total}).",
    ctaPattern: "Open Earn & Learn: {appUrl}",
    waHook: "Treating {challengeName} like a practice test today.",
    waBodyPattern:
      "{correct}/{total} and {accuracyPct}%; bar {neededCorrect}/{total}. Numbers go in the notebook — next step is targeted review, not self-criticism.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "ig_loss_07",
    tone: "comeback",
    hook: "Consistent effort on {challengeName}; outcome still “in progress.”",
    bodyPattern: "{domainLabel}: {correct}/{total} ({accuracyPct}%).",
    ctaPattern: "Retry with me: {appUrl}",
    waHook: "Still “in progress” on {challengeName} — that is OK.",
    waBodyPattern:
      "{correct}/{total} at {accuracyPct}% on {domainLabel}. Showing up counts; I will adjust study blocks and try again.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "ig_loss_08",
    tone: "comeback",
    hook: "{challengeName} — not this session, still on track.",
    bodyPattern: "{correct}/{total} ({accuracyPct}%), needed {neededCorrect}/{total} to pass.",
    ctaPattern: "Schedule your run: {appUrl}",
    waHook: "Not this session for {challengeName}, still on track long-term.",
    waBodyPattern:
      "{correct}/{total}, {accuracyPct}%, need {neededCorrect}/{total}. Short-term miss, long-term habit intact — sharing for transparency.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "ig_loss_09",
    tone: "progress",
    hook: "Session complete on {challengeName} — pass pending.",
    bodyPattern: "{correct}/{total}, {accuracyPct}% vs. {neededCorrect}/{total} required.",
    ctaPattern: "Back for another round: {appUrl}",
    waHook: "Finished a session on {challengeName}; pass still pending.",
    waBodyPattern:
      "Result {correct}/{total} ({accuracyPct}%). Requirement {neededCorrect}/{total}. If you are also building exam stamina, we can hold each other accountable.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "ig_loss_10",
    tone: "comeback",
    hook: "Baseline captured — {challengeName}.",
    bodyPattern: "{correct}/{total} at {accuracyPct}% in {timeTakenLabel}.",
    ctaPattern: "Improve from here: {appUrl}",
    waHook: "Captured a baseline on {challengeName} to beat next time.",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Growth charts need a starting point — this is mine.",
    waCtaPattern: "{appUrl}",
  },
];

export function renderTemplate(
  def: ReferChallengeTemplateDef,
  payload: ReferChallengeSharePayload
): ReferChallengeShareTemplate {
  return makeTemplate(def, payload);
}

/** All share captions for the current outcome (10 win or 10 loss). */
export function buildReferShareTemplates(
  payload: ReferChallengeSharePayload
): ReferChallengeShareTemplate[] {
  const defs = payload.outcome === "won" ? IG_WIN_DEFS : IG_LOSS_DEFS;
  return defs.map((def) => renderTemplate(def, payload));
}

export function pickNextTemplate(currentIndex: number, templateCount: number): number {
  if (templateCount <= 1) return 0;
  return (currentIndex + 1) % templateCount;
}
