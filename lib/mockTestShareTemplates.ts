export type MockTestShareTone = "achievement" | "progress" | "comeback";

export type MockTestShareOutcome = "win" | "lose";

/** Percentage string for display (e.g. "1.11", "100.00"). */
export function formatMockAccuracyPercent(correct: number, total: number): string {
  if (total <= 0) return "0.00";
  return ((correct / total) * 100).toFixed(2);
}

/** Catalog timed paper vs PYQ — drives copy (no "mock" wording on past-paper shares). */
export type SharePaperKind = "catalog_mock" | "past_paper";

export type MockTestSharePayload = {
  examName: string;
  correct: number;
  total: number;
  /** Formatted with two decimal places for cards and share copy. */
  accuracyPct: string;
  timeTakenLabel: string;
  appUrl: string;
  /** Drives which bank of 20 paired templates (community + WhatsApp each) is used. */
  outcome: MockTestShareOutcome;
  /** Default `catalog_mock` when omitted (backward compatible). */
  sharePaperKind?: SharePaperKind;
};

export type MockTestShareTemplate = {
  id: string;
  tone: MockTestShareTone;
  title: string;
  body: string;
  cta: string;
  /**
   * Community feed **body** only (line 2: score/time, line 3: CTA link).
   * Title is stored separately so the UI does not repeat the headline.
   */
  communityContent: string;
  /** @deprecated Prefer `title` + `communityContent` for feed; kept as alias of `communityContent`. */
  text: string;
  waTitle: string;
  waBody: string;
  waCta: string;
  whatsappText: string;
};

type MockTestTemplateDef = {
  id: string;
  tone: MockTestShareTone;
  hook: string;
  bodyPattern: string;
  ctaPattern: string;
  waHook: string;
  waBodyPattern: string;
  waCtaPattern: string;
};

/** Aligns with catalog mock +50 RDM bonus bar (≥60% correct). */
export function getMockShareOutcome(correct: number, total: number): MockTestShareOutcome {
  if (total <= 0) return "lose";
  return correct * 100 >= 60 * total ? "win" : "lose";
}

function fillMockPattern(pattern: string, payload: MockTestSharePayload): string {
  return pattern
    .replaceAll("{examName}", payload.examName)
    .replaceAll("{correct}", String(payload.correct))
    .replaceAll("{total}", String(payload.total))
    .replaceAll("{accuracyPct}", payload.accuracyPct)
    .replaceAll("{timeTakenLabel}", payload.timeTakenLabel)
    .replaceAll("{appUrl}", payload.appUrl);
}

/**
 * Past-paper share strings: remove awkward "mock" wording.
 * Preserves URL paths like `.../mock` (lookbehind skips `/`).
 */
function pastPaperizeShareString(s: string): string {
  let t = s;
  const pairs: [RegExp, string][] = [
    [/Mock test wrap:\s*/gi, "Past paper — "],
    [/Strong mock:\s*/gi, "Strong run: "],
    [/Main-character mock/gi, "Main-character paper"],
    [/Momentum mock/gi, "Momentum paper"],
    [/Institute-style mock W:/gi, "Institute-style paper —"],
    [/Institute-style mock/gi, "Institute-style paper"],
    [/Institute mock/gi, "Institute paper"],
    [/Full-length mock/gi, "Full-length paper"],
    [/Full mock/gi, "Full paper"],
    [/Weekly mock/gi, "Weekly paper"],
    [/Another mock down/gi, "Another paper down"],
    [/Mock result \(honest\)/gi, "Result (honest)"],
    [/Mock archive entry/gi, "Archive entry"],
    [/Mock reality check/gi, "Reality check"],
    [/Mock complete/gi, "Paper complete"],
    [/JEE-style sit \(mock\)/gi, "JEE-style sit"],
    [/PYQ \/ catalog mock/gi, "PYQ / catalog paper"],
    [/JEE-mode mock/gi, "JEE-mode paper"],
    [/Prep \+ mocks/gi, "Past papers"],
    [/Prep \+ Mock/gi, "Prep hub"],
    [/Stack mocks/gi, "Stack papers"],
    [/Catalog mocks/gi, "Catalog papers"],
    [/Community \+ mocks/gi, "Community + papers"],
    [/Log your mock/gi, "Log your paper"],
    [/Practice timed mocks/gi, "Practice timed papers"],
    [/Lock in with mocks/gi, "Lock in with papers"],
    [/Join me on mocks/gi, "Join me on papers"],
    [/Run your own mock/gi, "Run your own paper"],
    [/Open the mock library/gi, "Open the paper library"],
    [/Queue your next mock/gi, "Queue your next paper"],
    [/Mocks live here:/gi, "Papers live here:"],
    [/Ran an institute-style mock/gi, "Ran an institute-style paper"],
    [/Deep work block → mock →/gi, "Deep work block → paper →"],
    [/Deep work → mock →/gi, "Deep work → paper →"],
    [/Flexing a good \{examName\} mock \(respectfully\)/gi, "Flexing a good {examName} run (respectfully)"],
    [/Sharing my \{examName\} mock result/gi, "Sharing my {examName} past-paper result"],
    [/mock W:/gi, "Win:"],
  ];
  for (const [re, rep] of pairs) {
    t = t.replace(re, rep);
  }
  t = t.replace(/(?<!\/)mocks\b/gi, "papers");
  t = t.replace(/(?<!\/)mock\b/gi, "paper");
  t = t.replace(/paper paper/gi, "paper");
  return t;
}

/** Strip "Mock …" from catalog-style paper titles when sharing a PYQ attempt. */
export function formatExamNameForPastPaperShare(examName: string): string {
  return examName
    .replace(/\bMock\s+/gi, "")
    .replace(/\bmocks\b/gi, "papers")
    .replace(/\bmock\b/gi, "paper")
    .replace(/\bpaper\s+paper\b/gi, "paper")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cloneDefForPastPaper(def: MockTestTemplateDef): MockTestTemplateDef {
  return {
    id: def.id.replace(/^mock_/, "past_"),
    tone: def.tone,
    hook: pastPaperizeShareString(def.hook),
    bodyPattern: pastPaperizeShareString(def.bodyPattern),
    ctaPattern: pastPaperizeShareString(def.ctaPattern),
    waHook: pastPaperizeShareString(def.waHook),
    waBodyPattern: pastPaperizeShareString(def.waBodyPattern),
    waCtaPattern: pastPaperizeShareString(def.waCtaPattern),
  };
}

function makeMockTemplate(def: MockTestTemplateDef, payload: MockTestSharePayload): MockTestShareTemplate {
  const title = fillMockPattern(def.hook, payload);
  const body = fillMockPattern(def.bodyPattern, payload);
  const cta = fillMockPattern(def.ctaPattern, payload);
  /** Feed body: score line + CTA only (title is separate — avoids duplicate headline). */
  const communityContent = [body, cta].join("\n\n");

  const waTitle = fillMockPattern(def.waHook, payload);
  const waBody = fillMockPattern(def.waBodyPattern, payload);
  const waCta = fillMockPattern(def.waCtaPattern, payload);
  const whatsappText = [waTitle, waBody, waCta].join("\n\n");

  return {
    id: def.id,
    tone: def.tone,
    title,
    body,
    cta,
    communityContent,
    text: communityContent,
    waTitle,
    waBody,
    waCta,
    whatsappText,
  };
}

/** 20 win pairs: each slot = 1 community caption + 1 separate WhatsApp message (40 strings). */
const MOCK_WIN_DEFS: MockTestTemplateDef[] = [
  {
    id: "mock_win_01",
    tone: "achievement",
    hook: "Strong mock: {examName}",
    bodyPattern: "Locked {accuracyPct}% ({correct}/{total}) in {timeTakenLabel}.",
    ctaPattern: "Prep + mocks on EduBlast: {appUrl}",
    waHook: "W on {examName} today — numbers attached 🔥",
    waBodyPattern:
      "Hit {correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Felt locked in the whole paper.",
    waCtaPattern: "Run the same flow: {appUrl}",
  },
  {
    id: "mock_win_02",
    tone: "achievement",
    hook: "Bar cleared — {examName}",
    bodyPattern: "Scoreline {correct}/{total} · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Your turn: {appUrl}",
    waHook: "Bar cleared on {examName} and I'm hyped",
    waBodyPattern: "{correct}/{total} at {accuracyPct}% in {timeTakenLabel}. Consistency paying off.",
    waCtaPattern: "Try to beat this: {appUrl}",
  },
  {
    id: "mock_win_03",
    tone: "progress",
    hook: "Practice paying off — {examName}",
    bodyPattern: "{correct}/{total} correct · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Stack mocks here: {appUrl}",
    waHook: "Practice arc update: {examName}",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Small reps, big shift.",
    waCtaPattern: "Join the grind: {appUrl}",
  },
  {
    id: "mock_win_04",
    tone: "achievement",
    hook: "Full sit done right — {examName}",
    bodyPattern: "Final: {correct}/{total} · {accuracyPct}% · clock {timeTakenLabel}.",
    ctaPattern: "Open Prep + Mock: {appUrl}",
    waHook: "Full mock cleared with energy: {examName}",
    waBodyPattern:
      "Closed {correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Exam mode activated.",
    waCtaPattern: "Same paper path: {appUrl}",
  },
  {
    id: "mock_win_05",
    tone: "progress",
    hook: "Syllabus signal — {examName}",
    bodyPattern: "{accuracyPct}% accuracy ({correct}/{total}) · {timeTakenLabel}.",
    ctaPattern: "Benchmark: {appUrl}",
    waHook: "{examName} syllabus check: green zone",
    waBodyPattern:
      "{correct}/{total} with {accuracyPct}% in {timeTakenLabel}. Weak spots shrinking.",
    waCtaPattern: "Measure yourself: {appUrl}",
  },
  {
    id: "mock_win_06",
    tone: "achievement",
    hook: "Institute mock — {examName}",
    bodyPattern: "Scorecard {correct}/{total} · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Catalog mocks: {appUrl}",
    waHook: "Institute-style mock W: {examName}",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. PYQ energy hits different.",
    waCtaPattern: "Pick a paper: {appUrl}",
  },
  {
    id: "mock_win_07",
    tone: "achievement",
    hook: "Timer + accuracy locked — {examName}",
    bodyPattern: "{timeTakenLabel} · {correct}/{total} · {accuracyPct}%.",
    ctaPattern: "Train pacing: {appUrl}",
    waHook: "Timer discipline + accuracy on {examName}",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) inside {timeTakenLabel}. Two skills, one session.",
    waCtaPattern: "Timed practice: {appUrl}",
  },
  {
    id: "mock_win_08",
    tone: "progress",
    hook: "Weekly win — {examName}",
    bodyPattern: "{correct}/{total} ({accuracyPct}%) · {timeTakenLabel}.",
    ctaPattern: "Keep streak: {appUrl}",
    waHook: "Weekly mock receipt (W edition): {examName}",
    waBodyPattern:
      "{correct}/{total} at {accuracyPct}% in {timeTakenLabel}. Showing up matters.",
    waCtaPattern: "Stay consistent: {appUrl}",
  },
  {
    id: "mock_win_09",
    tone: "achievement",
    hook: "JEE-style run — {examName}",
    bodyPattern: "{correct}/{total} · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Prep + Mock hub: {appUrl}",
    waHook: "JEE-mode mock: positive delta on {examName}",
    waBodyPattern:
      "Scoreline {correct}/{total} ({accuracyPct}%) with {timeTakenLabel} on the clock.",
    waCtaPattern: "Run yours: {appUrl}",
  },
  {
    id: "mock_win_10",
    tone: "achievement",
    hook: "Solid paper — {examName}",
    bodyPattern: "Performance: {correct}/{total} · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Share + retry: {appUrl}",
    waHook: "Solid outing on {examName}",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Room still exists, but trend is up.",
    waCtaPattern: "Challenge this score: {appUrl}",
  },
  {
    id: "mock_win_11",
    tone: "progress",
    hook: "Data day — {examName}",
    bodyPattern: "{correct}/{total} · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Log your mock: {appUrl}",
    waHook: "Data day: {examName}",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Charts don't lie.",
    waCtaPattern: "Add your point: {appUrl}",
  },
  {
    id: "mock_win_12",
    tone: "achievement",
    hook: "Main-character mock — {examName}",
    bodyPattern: "{accuracyPct}% ({correct}/{total}) · {timeTakenLabel}.",
    ctaPattern: "Community + mocks: {appUrl}",
    waHook: "Main character energy on {examName}",
    waBodyPattern:
      "Dropped {correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Aura intact.",
    waCtaPattern: "Pull up: {appUrl}",
  },
  {
    id: "mock_win_13",
    tone: "progress",
    hook: "Exam simulation win — {examName}",
    bodyPattern: "{correct}/{total} marks-line vibe · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Simulate again: {appUrl}",
    waHook: "Simulation W: {examName}",
    waBodyPattern:
      "Walked out {correct}/{total} ({accuracyPct}%) after {timeTakenLabel}. Nerves handled.",
    waCtaPattern: "Simulate here: {appUrl}",
  },
  {
    id: "mock_win_14",
    tone: "achievement",
    hook: "Focused block — {examName}",
    bodyPattern: "{correct}/{total} correct · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "{appUrl}",
    waHook: "Deep work → mock → {examName} W",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Focus translated to marks.",
    waCtaPattern: "Tap in: {appUrl}",
  },
  {
    id: "mock_win_15",
    tone: "achievement",
    hook: "Cleared the 60% bar — {examName}",
    bodyPattern: "{correct}/{total} · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Prep + mocks: {appUrl}",
    waHook: "Crossed the prep bar on {examName}",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Eligible energy for bonuses where rules apply.",
    waCtaPattern: "Check rules + run: {appUrl}",
  },
  {
    id: "mock_win_16",
    tone: "progress",
    hook: "Momentum mock — {examName}",
    bodyPattern: "{correct}/{total} · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Next paper: {appUrl}",
    waHook: "Momentum check: {examName}",
    waBodyPattern:
      "{correct}/{total} at {accuracyPct}% in {timeTakenLabel}. Stack another tomorrow.",
    waCtaPattern: "Queue next: {appUrl}",
  },
  {
    id: "mock_win_17",
    tone: "achievement",
    hook: "PYQ win — {examName}",
    bodyPattern: "Result {correct}/{total} · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Browse PYQs: {appUrl}",
    waHook: "PYQ session hit on {examName}",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Old papers still teach.",
    waCtaPattern: "Open library: {appUrl}",
  },
  {
    id: "mock_win_18",
    tone: "achievement",
    hook: "Clean run — {examName}",
    bodyPattern: "{accuracyPct}% · {correct}/{total} · {timeTakenLabel}.",
    ctaPattern: "Share run: {appUrl}",
    waHook: "Clean enough run on {examName}",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Errors noted, wins counted.",
    waCtaPattern: "Send your score: {appUrl}",
  },
  {
    id: "mock_win_19",
    tone: "progress",
    hook: "Prep receipt — {examName}",
    bodyPattern: "{correct}/{total} · {accuracyPct}% · {timeTakenLabel} · Prep + Mock.",
    ctaPattern: "{appUrl}",
    waHook: "Prep receipt (green): {examName}",
    waBodyPattern:
      "Logged {correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Receipts over excuses.",
    waCtaPattern: "Mocks live here: {appUrl}",
  },
  {
    id: "mock_win_20",
    tone: "achievement",
    hook: "Community flex — {examName}",
    bodyPattern: "{correct}/{total} ({accuracyPct}%) · {timeTakenLabel}.",
    ctaPattern: "Post yours from /mock-test-library: {appUrl}",
    waHook: "Flexing a good {examName} mock (respectfully)",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. If you beat it, teach me.",
    waCtaPattern: "Run it: {appUrl}",
  },
];

/** 20 loss pairs: each slot = 1 community caption + 1 separate WhatsApp message (40 strings). */
const MOCK_LOSS_DEFS: MockTestTemplateDef[] = [
  {
    id: "mock_loss_01",
    tone: "comeback",
    hook: "Mock test wrap: {examName}",
    bodyPattern: "Score: {correct}/{total} ({accuracyPct}%) · Time: {timeTakenLabel}.",
    ctaPattern: "Prep + mocks on EduBlast: {appUrl}",
    waHook: "Just wrapped {examName} on EduBlast and the score is in 📊",
    waBodyPattern:
      "I finished at {correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Mixed feelings but data is data.",
    waCtaPattern: "Run your own mock here: {appUrl}",
  },
  {
    id: "mock_loss_02",
    tone: "progress",
    hook: "Practice log — {examName}",
    bodyPattern: "{correct}/{total} correct ({accuracyPct}%) · {timeTakenLabel} on the clock.",
    ctaPattern: "Same engine, your turn: {appUrl}",
    waHook: "Another mock down: {examName}",
    waBodyPattern:
      "Landed {correct}/{total} ({accuracyPct}%) with {timeTakenLabel} total time. Consistency > vibes.",
    waCtaPattern: "Join me on mocks: {appUrl}",
  },
  {
    id: "mock_loss_03",
    tone: "comeback",
    hook: "Not my best paper — {examName}",
    bodyPattern: "Today: {correct}/{total} ({accuracyPct}%). Next sit will be sharper.",
    ctaPattern: "Redo lane: {appUrl}",
    waHook: "{examName} humbled me a bit today ngl",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Taking the L as a data point, not an identity.",
    waCtaPattern: "Rematch when you're free: {appUrl}",
  },
  {
    id: "mock_loss_04",
    tone: "progress",
    hook: "Full-length mock — {examName}",
    bodyPattern: "Final line: {correct}/{total} · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Open Prep + Mock: {appUrl}",
    waHook: "Full mock energy for {examName}",
    waBodyPattern:
      "Closed at {correct}/{total} ({accuracyPct}%) after {timeTakenLabel}. Exam hall simulation complete.",
    waCtaPattern: "Try the same paper flow: {appUrl}",
  },
  {
    id: "mock_loss_05",
    tone: "progress",
    hook: "Syllabus check — {examName}",
    bodyPattern: "Accuracy {accuracyPct}% ({correct}/{total}) · {timeTakenLabel}.",
    ctaPattern: "Benchmark yourself: {appUrl}",
    waHook: "Using {examName} as a syllabus thermometer 🌡️",
    waBodyPattern:
      "Reading {correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Gaps are visible; that's the win.",
    waCtaPattern: "Measure yours: {appUrl}",
  },
  {
    id: "mock_loss_06",
    tone: "comeback",
    hook: "Mock result (honest): {examName}",
    bodyPattern: "{correct}/{total} ({accuracyPct}%) — comeback loading.",
    ctaPattern: "Stack attempts: {appUrl}",
    waHook: "Plot twist: {examName} said 'study harder'",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. I'm already scheduling the redemption arc.",
    waCtaPattern: "Pull up for round two: {appUrl}",
  },
  {
    id: "mock_loss_07",
    tone: "progress",
    hook: "Institute-style mock — {examName}",
    bodyPattern: "Scorecard: {correct}/{total} · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Catalog + timed mode: {appUrl}",
    waHook: "Ran an institute-style mock ({examName}) and here's the receipt 🧾",
    waBodyPattern:
      "{correct}/{total} with {accuracyPct}% accuracy, clocked {timeTakenLabel}. Felt like the real deal.",
    waCtaPattern: "Pick a paper and run it: {appUrl}",
  },
  {
    id: "mock_loss_08",
    tone: "progress",
    hook: "Timer discipline test — {examName}",
    bodyPattern: "{timeTakenLabel} total · {correct}/{total} ({accuracyPct}%).",
    ctaPattern: "Train pacing: {appUrl}",
    waHook: "Timer discipline check for {examName} ⏱️",
    waBodyPattern:
      "Used {timeTakenLabel} and scored {correct}/{total} ({accuracyPct}%). Pacing is a skill too.",
    waCtaPattern: "Practice timed mocks: {appUrl}",
  },
  {
    id: "mock_loss_09",
    tone: "comeback",
    hook: "Mock archive entry — {examName}",
    bodyPattern: "{correct}/{total} ({accuracyPct}%) — logging for next review.",
    ctaPattern: "Review + retry: {appUrl}",
    waHook: "Adding {examName} to the 'before' folder in my prep drive 📁",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. The 'after' screenshot comes next week.",
    waCtaPattern: "Start your log: {appUrl}",
  },
  {
    id: "mock_loss_10",
    tone: "progress",
    hook: "Push on {examName}",
    bodyPattern: "{accuracyPct}% ({correct}/{total}) · {timeTakenLabel}.",
    ctaPattern: "Share your run: {appUrl}",
    waHook: "Okay {examName} — mixed bag today",
    waBodyPattern:
      "Bagged {correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Not perfect, but directionally noted.",
    waCtaPattern: "Beat my line or send yours: {appUrl}",
  },
  {
    id: "mock_loss_11",
    tone: "progress",
    hook: "PYQ / catalog mock — {examName}",
    bodyPattern: "Result: {correct}/{total} · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Browse papers: {appUrl}",
    waHook: "PYQ grind update: {examName}",
    waBodyPattern:
      "Finished {correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Old papers still hit different.",
    waCtaPattern: "Open the mock library: {appUrl}",
  },
  {
    id: "mock_loss_12",
    tone: "comeback",
    hook: "Mock reality check — {examName}",
    bodyPattern: "{correct}/{total} correct out of {total} · {accuracyPct}%.",
    ctaPattern: "Back to drills: {appUrl}",
    waHook: "Reality check from {examName} 📉",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. The syllabus is not joking around.",
    waCtaPattern: "Lock in with mocks: {appUrl}",
  },
  {
    id: "mock_loss_13",
    tone: "progress",
    hook: "JEE-style sit (mock) — {examName}",
    bodyPattern: "{correct}/{total} · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Prep + Mock hub: {appUrl}",
    waHook: "JEE-mode mock completed: {examName}",
    waBodyPattern:
      "Scoreline {correct}/{total} ({accuracyPct}%) with {timeTakenLabel} on the timer. Adrenaline was real.",
    waCtaPattern: "Run yours on EduBlast: {appUrl}",
  },
  {
    id: "mock_loss_14",
    tone: "progress",
    hook: "Weekly mock drop — {examName}",
    bodyPattern: "{correct}/{total} ({accuracyPct}%) · {timeTakenLabel}.",
    ctaPattern: "Keep the streak: {appUrl}",
    waHook: "Weekly mock receipt: {examName}",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Small steps, same destination.",
    waCtaPattern: "Stay consistent: {appUrl}",
  },
  {
    id: "mock_loss_15",
    tone: "comeback",
    hook: "Tough paper — {examName}",
    bodyPattern: "Logged {correct}/{total} ({accuracyPct}%).",
    ctaPattern: "One more attempt: {appUrl}",
    waHook: "{examName} cooked me gently today 🍳",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Taking notes, not excuses.",
    waCtaPattern: "Retry when ready: {appUrl}",
  },
  {
    id: "mock_loss_16",
    tone: "progress",
    hook: "Mock complete — {examName}",
    bodyPattern: "Performance: {correct}/{total} · {accuracyPct}% · Time {timeTakenLabel}.",
    ctaPattern: "Community + mocks: {appUrl}",
    waHook: "Mock complete for {examName} — posting the stats publicly 📣",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. If you top this, respect.",
    waCtaPattern: "Challenge the paper: {appUrl}",
  },
  {
    id: "mock_loss_17",
    tone: "progress",
    hook: "Exam simulation — {examName}",
    bodyPattern: "{correct}/{total} marks-line equivalent · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Simulate again: {appUrl}",
    waHook: "Exam hall simulation: {examName}",
    waBodyPattern:
      "Walked out with {correct}/{total} ({accuracyPct}%) after {timeTakenLabel}. Muscle memory loading...",
    waCtaPattern: "Simulate on: {appUrl}",
  },
  {
    id: "mock_loss_18",
    tone: "comeback",
    hook: "Reset + reload — {examName}",
    bodyPattern: "{correct}/{total} ({accuracyPct}%) this round.",
    ctaPattern: "Next paper: {appUrl}",
    waHook: "Reset mode after {examName}",
    waBodyPattern:
      "{correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. The grind continues tomorrow morning.",
    waCtaPattern: "Queue your next mock: {appUrl}",
  },
  {
    id: "mock_loss_19",
    tone: "progress",
    hook: "Focused block — {examName}",
    bodyPattern: "{correct}/{total} correct · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Share to community from /mock-test-library: {appUrl}",
    waHook: "Deep work block → mock → {examName}",
    waBodyPattern:
      "Numbers: {correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Energy high, errors noted.",
    waCtaPattern: "Tap in: {appUrl}",
  },
  {
    id: "mock_loss_20",
    tone: "progress",
    hook: "Community share — {examName}",
    bodyPattern: "{correct}/{total} · {accuracyPct}% · {timeTakenLabel} · Prep + Mock.",
    ctaPattern: "{appUrl}",
    waHook: "Sharing my {examName} mock result with the squad",
    waBodyPattern:
      "I got {correct}/{total} ({accuracyPct}%) in {timeTakenLabel}. Drop your score if you run the same paper.",
    waCtaPattern: "Mocks live here: {appUrl}",
  },
];

const PAST_WIN_DEFS: MockTestTemplateDef[] = MOCK_WIN_DEFS.map(cloneDefForPastPaper);
const PAST_LOSS_DEFS: MockTestTemplateDef[] = MOCK_LOSS_DEFS.map(cloneDefForPastPaper);

export function buildMockShareTemplates(payload: MockTestSharePayload): MockTestShareTemplate[] {
  const kind: SharePaperKind = payload.sharePaperKind ?? "catalog_mock";
  const payloadForTemplates: MockTestSharePayload =
    kind === "past_paper"
      ? { ...payload, examName: formatExamNameForPastPaperShare(payload.examName) }
      : payload;
  const defs =
    kind === "past_paper"
      ? payload.outcome === "win"
        ? PAST_WIN_DEFS
        : PAST_LOSS_DEFS
      : payload.outcome === "win"
        ? MOCK_WIN_DEFS
        : MOCK_LOSS_DEFS;
  return defs.map((def) => makeMockTemplate(def, payloadForTemplates));
}

export function pickNextMockShareTemplate(currentIndex: number, templateCount: number): number {
  if (templateCount <= 1) return 0;
  return (currentIndex + 1) % templateCount;
}
