import type { ReferChallengePublicSpec } from "@/lib/referEarnChallenges";

export type ReferShareOutcome = "won" | "lost";

export type ReferChallengeSharePayload = {
  challengeKey: ReferChallengePublicSpec["key"];
  challengeName: string;
  domain: ReferChallengePublicSpec["domain"];
  rewardRdm: number;
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
  text: string;
  waTitle: string;
  waBody: string;
  waCta: string;
  whatsappText: string;
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
  const whatsappText = [waTitle, waBody, waCta].join("\n\n");

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
    charCount: text.length,
  };
}

/** 10 win templates: concise for Community Feed + expressive for WhatsApp. */
const IG_WIN_DEFS: ReferChallengeTemplateDef[] = [
  {
    id: "ig_win_01",
    tone: "achievement",
    hook: "Just locked in a {challengeName} win. 🎯",
    bodyPattern: "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel} on {domainLabel}.",
    ctaPattern: "Think you can beat it? {appUrl}",
    waHook: "OMG I just clutched {challengeName} and my heart is still racing 😭🔥",
    waBodyPattern:
      "Dropped {correct}/{total} ({accuracyPct}%) in {timeTakenLabel} on {domainLabel} and it felt like a boss fight fr.",
    waCtaPattern: "No excuses, pull up rn and beat this score: {appUrl}",
  },
  {
    id: "ig_win_02",
    tone: "achievement",
    hook: "{challengeName} = cleared. ✅",
    bodyPattern: "{accuracyPct}% accuracy ({correct}/{total}) in {timeTakenLabel}.",
    ctaPattern: "Your turn starts here: {appUrl}",
    waHook: "Ayo {challengeName} got folded 😤📚",
    waBodyPattern:
      "{correct}/{total} with {accuracyPct}% in just {timeTakenLabel}... I was LOCKED IN on {domainLabel}.",
    waCtaPattern: "Try it before I go on another streak: {appUrl}",
  },
  {
    id: "ig_win_03",
    tone: "progress",
    hook: "Result drop: won {challengeName}.",
    bodyPattern: "{correct}/{total} correct, {accuracyPct}% overall.",
    ctaPattern: "Attempt now: {appUrl}",
    waHook: "Not me actually speedrunning {challengeName} like a maniac 💀⚡",
    waBodyPattern:
      "Ended with {correct}/{total} and {accuracyPct}% in {timeTakenLabel}. {domainLabel} was throwing heat and I still survived.",
    waCtaPattern: "Come test your luck/skill combo: {appUrl}",
  },
  {
    id: "ig_win_04",
    tone: "achievement",
    hook: "Challenge cleared: {challengeName}.",
    bodyPattern: "{domainLabel} run finished at {correct}/{total} ({accuracyPct}%).",
    ctaPattern: "Take the same challenge: {appUrl}",
    waHook: "I said 'one try' on {challengeName} and then COOKED 🍳🔥",
    waBodyPattern:
      "{correct}/{total} with {accuracyPct}% in {timeTakenLabel}. This run had me talking to my screen ngl.",
    waCtaPattern: "Your move, don't ghost this: {appUrl}",
  },
  {
    id: "ig_win_05",
    tone: "progress",
    hook: "Today’s W: {challengeName}.",
    bodyPattern: "{correct}/{total} • {accuracyPct}% • {timeTakenLabel}.",
    ctaPattern: "See if you can top it: {appUrl}",
    waHook: "Massive student-core W unlocked on {challengeName} 🧠✨",
    waBodyPattern:
      "Went {correct}/{total} ({accuracyPct}%) in {timeTakenLabel} and my confidence just went +100.",
    waCtaPattern: "Tap in and try to outscore me: {appUrl}",
  },
  {
    id: "ig_win_06",
    tone: "achievement",
    hook: "{challengeName} pass bar crossed. 🚀",
    bodyPattern: "{correct}/{total} ({accuracyPct}%) on all questions.",
    ctaPattern: "Jump into the challenge: {appUrl}",
    waHook: "BROOO I beat {challengeName} and almost screamed in class 😭📈",
    waBodyPattern:
      "Final was {correct}/{total}, {accuracyPct}% in {timeTakenLabel}. Felt like exam revenge mode.",
    waCtaPattern: "Don't just react, run it: {appUrl}",
  },
  {
    id: "ig_win_07",
    tone: "achievement",
    hook: "{challengeName} win secured on EduBlast.",
    bodyPattern: "{domainLabel}: {correct}/{total} and {accuracyPct}% in {timeTakenLabel}.",
    ctaPattern: "Try this run: {appUrl}",
    waHook: "Lowkey shook... I actually cleared {challengeName} 😮‍💨🏆",
    waBodyPattern:
      "{correct}/{total}, {accuracyPct}% in {timeTakenLabel}. Brain was buffering at first then boom, flow state.",
    waCtaPattern: "Get in here and challenge me: {appUrl}",
  },
  {
    id: "ig_win_08",
    tone: "progress",
    hook: "Consistency check passed: {challengeName}.",
    bodyPattern: "Finished {correct}/{total} with {accuracyPct}% accuracy.",
    ctaPattern: "Ready for your run? {appUrl}",
    waHook: "Another day, another academic anime arc completed with {challengeName} ⚔️📘",
    waBodyPattern:
      "{correct}/{total}, {accuracyPct}% in {timeTakenLabel}. The comeback montage music was playing in my head fr.",
    waCtaPattern: "Join the storyline: {appUrl}",
  },
  {
    id: "ig_win_09",
    tone: "achievement",
    hook: "{challengeName} done and delivered.",
    bodyPattern: "Scoreline: {correct}/{total} ({accuracyPct}%) in {timeTakenLabel}.",
    ctaPattern: "Can you beat it? {appUrl}",
    waHook: "I'm not saying I'm a genius but {challengeName} just got handled 😌🔥",
    waBodyPattern:
      "{correct}/{total} with {accuracyPct}% in {timeTakenLabel} on {domainLabel}. This felt illegal.",
    waCtaPattern: "Try to humble me here: {appUrl}",
  },
  {
    id: "ig_win_10",
    tone: "progress",
    hook: "Win shared: {challengeName}.",
    bodyPattern: "{correct}/{total} and {accuracyPct}% completed in {timeTakenLabel}.",
    ctaPattern: "Play now: {appUrl}",
    waHook: "Main character moment: I cleared {challengeName} and the aura is unmatched ✨😤",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. If you beat this, respect++.",
    waCtaPattern: "Prove it here: {appUrl}",
  },
];

/** 10 loss/comeback templates: concise for Community Feed + expressive for WhatsApp. */
const IG_LOSS_DEFS: ReferChallengeTemplateDef[] = [
  {
    id: "ig_loss_01",
    tone: "comeback",
    hook: "Took an L on {challengeName} today, but progress logged. 🧪",
    bodyPattern: "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}.",
    ctaPattern: "Running it back soon: {appUrl}",
    waHook: "Nahhh {challengeName} actually humbled me today 💀📉",
    waBodyPattern:
      "I got {correct}/{total} ({accuracyPct}%) in {timeTakenLabel} and this run had no mercy.",
    waCtaPattern: "I'm reloading tomorrow, pull up too: {appUrl}",
  },
  {
    id: "ig_loss_02",
    tone: "comeback",
    hook: "{challengeName} wasn't cleared this round.",
    bodyPattern: "{correct}/{total} ({accuracyPct}%), needed {neededCorrect}/{total}.",
    ctaPattern: "Comeback attempt: {appUrl}",
    waHook: "Brooo {challengeName} said 'not today' and I felt that 😭",
    waBodyPattern:
      "Ended at {correct}/{total}, {accuracyPct}% (needed {neededCorrect}/{total}). Character development arc activated.",
    waCtaPattern: "Next run is personal: {appUrl}",
  },
  {
    id: "ig_loss_03",
    tone: "progress",
    hook: "No clear on {challengeName}, still learning.",
    bodyPattern: "{domainLabel}: {correct}/{total} and {accuracyPct}% in {timeTakenLabel}.",
    ctaPattern: "Practice with me: {appUrl}",
    waHook: "I got cooked by {challengeName} but we don't quit around here 😤",
    waBodyPattern:
      "{correct}/{total}, {accuracyPct}% in {timeTakenLabel}. Low score, high comeback energy.",
    waCtaPattern: "Let's run it together: {appUrl}",
  },
  {
    id: "ig_loss_04",
    tone: "comeback",
    hook: "Progress post: {challengeName} attempt.",
    bodyPattern: "{correct}/{total} | {accuracyPct}% | target {neededCorrect}/{total}.",
    ctaPattern: "Try it and compare: {appUrl}",
    waHook: "Okay listen... {challengeName} jumped me out of nowhere 🤡📚",
    waBodyPattern:
      "Only {correct}/{total} ({accuracyPct}%) this time, but the rematch is already scheduled in my head.",
    waCtaPattern: "Come watch the redemption run: {appUrl}",
  },
  {
    id: "ig_loss_05",
    tone: "comeback",
    hook: "Close run, no finish on {challengeName}.",
    bodyPattern: "{correct}/{total} at {accuracyPct}% in {timeTakenLabel}.",
    ctaPattern: "Next attempt here: {appUrl}",
    waHook: "I just got plot-twisted by {challengeName} and I need revenge asap 😵‍💫",
    waBodyPattern:
      "Finished with {correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Painful? yes. Over? never.",
    waCtaPattern: "Join the revenge mission: {appUrl}",
  },
  {
    id: "ig_loss_06",
    tone: "progress",
    hook: "Today's data point: {challengeName}.",
    bodyPattern: "{correct}/{total}, {accuracyPct}% (bar: {neededCorrect}/{total}).",
    ctaPattern: "Attempt your run: {appUrl}",
    waHook: "Current status: academically bruised by {challengeName} but still standing 🫡",
    waBodyPattern: "{correct}/{total} and {accuracyPct}% today. Not my final form.",
    waCtaPattern: "Catch me on the comeback run: {appUrl}",
  },
  {
    id: "ig_loss_07",
    tone: "comeback",
    hook: "Missed clear on {challengeName}, staying consistent.",
    bodyPattern: "{domainLabel} score: {correct}/{total} ({accuracyPct}%).",
    ctaPattern: "Retry with me: {appUrl}",
    waHook: "{challengeName} really tested my patience and won this round 😮‍💨",
    waBodyPattern:
      "Got {correct}/{total} at {accuracyPct}% in {timeTakenLabel}. Next one is comeback cinema.",
    waCtaPattern: "Slide in for round two: {appUrl}",
  },
  {
    id: "ig_loss_08",
    tone: "comeback",
    hook: "GG for now on {challengeName}.",
    bodyPattern: "{correct}/{total} ({accuracyPct}%), needed {neededCorrect}/{total}.",
    ctaPattern: "Queue next run: {appUrl}",
    waHook: "GGs only... {challengeName} packed me up today 😂📦",
    waBodyPattern:
      "{correct}/{total}, {accuracyPct}% in {timeTakenLabel}. I blinked and the timer vanished.",
    waCtaPattern: "Rematch lobby is open: {appUrl}",
  },
  {
    id: "ig_loss_09",
    tone: "progress",
    hook: "Day summary: {challengeName} attempt complete.",
    bodyPattern: "{correct}/{total}, {accuracyPct}% with clear bar at {neededCorrect}/{total}.",
    ctaPattern: "Back tomorrow: {appUrl}",
    waHook: "Today's episode: I fought {challengeName} and lost by stats 😵",
    waBodyPattern:
      "Result was {correct}/{total} ({accuracyPct}%), needed {neededCorrect}/{total}. Training arc starts now.",
    waCtaPattern: "Try it and send your score: {appUrl}",
  },
  {
    id: "ig_loss_10",
    tone: "comeback",
    hook: "Reset mode on: {challengeName}.",
    bodyPattern: "{correct}/{total} at {accuracyPct}% in {timeTakenLabel}.",
    ctaPattern: "Join the next attempt: {appUrl}",
    waHook: "I got folded by {challengeName} but the comeback tweet drafts are ready 😤📲",
    waBodyPattern:
      "{correct}/{total}, {accuracyPct}% in {timeTakenLabel}. This is the 'before' screenshot.",
    waCtaPattern: "Watch the glow-up run: {appUrl}",
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
