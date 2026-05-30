import {
  formatMockAccuracyPercent,
  getMockShareOutcome,
  pickNextMockShareTemplate,
  type MockTestShareTone,
} from "@/lib/mock/mockTestShareTemplates";

export type CbseMcqShareOutcome = "win" | "lose";

export type CbseMcqSharePayload = {
  chapterTitle: string;
  subjectLabel: string;
  classLevel: 11 | 12;
  correct: number;
  total: number;
  answeredCount: number;
  marksLabel: string;
  accuracyPct: string;
  timeTakenLabel: string;
  appUrl: string;
  outcome: CbseMcqShareOutcome;
};

export type CbseMcqShareTemplate = {
  id: string;
  tone: MockTestShareTone;
  title: string;
  communityContent: string;
  whatsappText: string;
};

type CbseMcqTemplateDef = {
  id: string;
  tone: MockTestShareTone;
  hook: string;
  bodyPattern: string;
  ctaPattern: string;
  waHook: string;
  waBodyPattern: string;
  waCtaPattern: string;
};

function fill(pattern: string, p: CbseMcqSharePayload): string {
  return pattern
    .replaceAll("{chapterTitle}", p.chapterTitle)
    .replaceAll("{subjectLabel}", p.subjectLabel)
    .replaceAll("{classLevel}", String(p.classLevel))
    .replaceAll("{correct}", String(p.correct))
    .replaceAll("{total}", String(p.total))
    .replaceAll("{answeredCount}", String(p.answeredCount))
    .replaceAll("{marksLabel}", p.marksLabel)
    .replaceAll("{accuracyPct}", p.accuracyPct)
    .replaceAll("{timeTakenLabel}", p.timeTakenLabel)
    .replaceAll("{appUrl}", p.appUrl);
}

function makeTemplate(def: CbseMcqTemplateDef, p: CbseMcqSharePayload): CbseMcqShareTemplate {
  const title = fill(def.hook, p);
  const body = fill(def.bodyPattern, p);
  const cta = fill(def.ctaPattern, p);
  const communityContent = [body, cta].join("\n\n");
  const waTitle = fill(def.waHook, p);
  const waBody = fill(def.waBodyPattern, p);
  const waCta = fill(def.waCtaPattern, p);
  return {
    id: def.id,
    tone: def.tone,
    title,
    communityContent,
    whatsappText: [waTitle, waBody, waCta].join("\n\n"),
  };
}

const CBSE_WIN_DEFS: CbseMcqTemplateDef[] = [
  {
    id: "cbse_win_01",
    tone: "achievement",
    hook: "CBSE chapter cleared — {chapterTitle}",
    bodyPattern:
      "{subjectLabel} · Class {classLevel} · {marksLabel} ({accuracyPct}%) in {timeTakenLabel}. NCERT MCQ grind paying off.",
    ctaPattern: "Run the same chapter on EduBlast: {appUrl}",
    waHook: "Chapter W: {chapterTitle} ({subjectLabel})",
    waBodyPattern:
      "Scored {marksLabel} — {accuracyPct}% in {timeTakenLabel}. Answered {answeredCount}/{total} before submit.",
    waCtaPattern: "CBSE MCQ's tab: {appUrl}",
  },
  {
    id: "cbse_win_02",
    tone: "achievement",
    hook: "Locked in — {chapterTitle}",
    bodyPattern: "Class {classLevel} {subjectLabel} NCERT MCQs: {marksLabel} · {timeTakenLabel}.",
    ctaPattern: "Post your score from Prep + Mock → CBSE MCQ's: {appUrl}",
    waHook: "{chapterTitle} done and the scoreline slaps",
    waBodyPattern: "{correct}/{total} correct ({accuracyPct}%) · {timeTakenLabel}.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "cbse_win_03",
    tone: "achievement",
    hook: "NCERT flex — {subjectLabel} · {chapterTitle}",
    bodyPattern: "{marksLabel} on chapter MCQs · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Challenge me on the same paper: {appUrl}",
    waHook: "Sharing my CBSE chapter quiz ({chapterTitle})",
    waBodyPattern: "Got {marksLabel} in {timeTakenLabel}. Who's running it next?",
    waCtaPattern: "Tab=mcq: {appUrl}",
  },
  {
    id: "cbse_win_04",
    tone: "progress",
    hook: "Chapter quiz log — {chapterTitle}",
    bodyPattern:
      "Class {classLevel} · {subjectLabel} · {marksLabel} · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Community + CBSE MCQ bank: {appUrl}",
    waHook: "Daily NCERT block → {chapterTitle}",
    waBodyPattern: "Numbers: {marksLabel} ({accuracyPct}%) in {timeTakenLabel}.",
    waCtaPattern: "Join: {appUrl}",
  },
  {
    id: "cbse_win_05",
    tone: "progress",
    hook: "Strong run — {chapterTitle}",
    bodyPattern: "{marksLabel} · answered {answeredCount}/{total} · {timeTakenLabel}.",
    ctaPattern: "Open CBSE MCQ's: {appUrl}",
    waHook: "Chapter MCQ session wrapped ({subjectLabel})",
    waBodyPattern: "{chapterTitle}: {marksLabel} at {accuracyPct}%.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "cbse_win_06",
    tone: "achievement",
    hook: "Bar raised on {chapterTitle}",
    bodyPattern: "{subjectLabel} Class {classLevel}: {marksLabel} ({accuracyPct}%).",
    ctaPattern: "Your turn — chapter quiz mode: {appUrl}",
    waHook: "Finally a clean {chapterTitle} scoreline",
    waBodyPattern: "{correct}/{total} in {timeTakenLabel}. Feels earned.",
    waCtaPattern: "Prep + Mock: {appUrl}",
  },
  {
    id: "cbse_win_07",
    tone: "progress",
    hook: "Institute-style chapter sit — {chapterTitle}",
    bodyPattern: "CBSE MCQ quiz · {marksLabel} · {timeTakenLabel}.",
    ctaPattern: "{appUrl}",
    waHook: "Ran NCERT MCQs for {chapterTitle}",
    waBodyPattern: "Score {marksLabel} ({accuracyPct}%). Dropping it for accountability.",
    waCtaPattern: "Same flow: {appUrl}",
  },
  {
    id: "cbse_win_08",
    tone: "achievement",
    hook: "Main-character chapter — {chapterTitle}",
    bodyPattern: "{marksLabel} · {accuracyPct}% · Class {classLevel} {subjectLabel}.",
    ctaPattern: "Stack chapters on EduBlast: {appUrl}",
    waHook: "W on {chapterTitle} (CBSE MCQ mode)",
    waBodyPattern: "{marksLabel} in {timeTakenLabel}. Let's go.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "cbse_win_09",
    tone: "progress",
    hook: "Honest share — {chapterTitle}",
    bodyPattern: "Chapter quiz complete: {marksLabel} · {timeTakenLabel}.",
    ctaPattern: "Log yours on the feed via {appUrl}",
    waHook: "Posting my {subjectLabel} chapter result",
    waBodyPattern: "{chapterTitle} → {marksLabel} ({accuracyPct}%).",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "cbse_win_10",
    tone: "achievement",
    hook: "NCERT chapter W — {chapterTitle}",
    bodyPattern: "{marksLabel} in {timeTakenLabel} · {subjectLabel} · Class {classLevel}.",
    ctaPattern: "CBSE MCQ's library: {appUrl}",
    waHook: "Chapter quiz numbers 📊 {chapterTitle}",
    waBodyPattern: "{correct}/{total} ({accuracyPct}%).",
    waCtaPattern: "{appUrl}",
  },
];

const CBSE_LOSS_DEFS: CbseMcqTemplateDef[] = [
  {
    id: "cbse_loss_01",
    tone: "comeback",
    hook: "Reality check — {chapterTitle}",
    bodyPattern:
      "{subjectLabel} · Class {classLevel} · {marksLabel} ({accuracyPct}%) · {timeTakenLabel}. Back to theory + retry.",
    ctaPattern: "Same chapter, fresh attempt: {appUrl}",
    waHook: "Rough {chapterTitle} run — sharing anyway",
    waBodyPattern: "{marksLabel} in {timeTakenLabel}. Notes time.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "cbse_loss_02",
    tone: "progress",
    hook: "Chapter grind continues — {chapterTitle}",
    bodyPattern:
      "CBSE MCQ quiz: {marksLabel} · answered {answeredCount}/{total} · {timeTakenLabel}.",
    ctaPattern: "Community accountability: {appUrl}",
    waHook: "Not my best {chapterTitle} score",
    waBodyPattern: "{correct}/{total} ({accuracyPct}%). Retake tomorrow.",
    waCtaPattern: "CBSE MCQ's: {appUrl}",
  },
  {
    id: "cbse_loss_03",
    tone: "comeback",
    hook: "Honest NCERT log — {chapterTitle}",
    bodyPattern: "Class {classLevel} {subjectLabel}: {marksLabel} · {timeTakenLabel}.",
    ctaPattern: "Drop your chapter score: {appUrl}",
    waHook: "Chapter MCQ done ({chapterTitle})",
    waBodyPattern: "Scoreline {marksLabel}. Fixing weak spots.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "cbse_loss_04",
    tone: "progress",
    hook: "Building base — {chapterTitle}",
    bodyPattern: "{marksLabel} on chapter MCQs · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "Prep + Mock → CBSE MCQ's: {appUrl}",
    waHook: "Slow day on {subjectLabel} — {chapterTitle}",
    waBodyPattern: "{marksLabel} in {timeTakenLabel}. Progress > perfection.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "cbse_loss_05",
    tone: "comeback",
    hook: "Comeback loading — {chapterTitle}",
    bodyPattern: "{subjectLabel} · Class {classLevel} · {marksLabel}.",
    ctaPattern: "Run it again: {appUrl}",
    waHook: "Chapter quiz wrapped — score needs work",
    waBodyPattern: "{chapterTitle}: {marksLabel} ({accuracyPct}%).",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "cbse_loss_06",
    tone: "progress",
    hook: "Community share — {chapterTitle}",
    bodyPattern: "{marksLabel} · {timeTakenLabel} · NCERT MCQ mode.",
    ctaPattern: "{appUrl}",
    waHook: "Sharing my CBSE chapter attempt",
    waBodyPattern: "{marksLabel} on {chapterTitle}. Who beat this?",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "cbse_loss_07",
    tone: "comeback",
    hook: "Chapter archive entry — {chapterTitle}",
    bodyPattern: "Quiz result: {marksLabel} · {answeredCount}/{total} answered.",
    ctaPattern: "Open chapter list: {appUrl}",
    waHook: "Logged {chapterTitle} ({subjectLabel})",
    waBodyPattern: "{marksLabel} in {timeTakenLabel}.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "cbse_loss_08",
    tone: "progress",
    hook: "Focused block — {chapterTitle}",
    bodyPattern: "Class {classLevel} · {marksLabel} · {accuracyPct}% · {timeTakenLabel}.",
    ctaPattern: "CBSE MCQ's on EduBlast: {appUrl}",
    waHook: "Deep work → chapter MCQs → {chapterTitle}",
    waBodyPattern: "Got {marksLabel}. Energy ok, accuracy not.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "cbse_loss_09",
    tone: "comeback",
    hook: "Reset tomorrow — {chapterTitle}",
    bodyPattern: "{subjectLabel} NCERT MCQs: {marksLabel} · {timeTakenLabel}.",
    ctaPattern: "Post + retry from: {appUrl}",
    waHook: "Chapter score posted ({chapterTitle})",
    waBodyPattern: "{marksLabel} ({accuracyPct}%). Reviewing solutions.",
    waCtaPattern: "{appUrl}",
  },
  {
    id: "cbse_loss_10",
    tone: "progress",
    hook: "Squad check — {chapterTitle}",
    bodyPattern: "{marksLabel} · Class {classLevel} · {subjectLabel}.",
    ctaPattern: "Your chapter run: {appUrl}",
    waHook: "Who's grinding {chapterTitle} this week?",
    waBodyPattern: "I hit {marksLabel} in {timeTakenLabel}.",
    waCtaPattern: "{appUrl}",
  },
];

export function getCbseMcqShareOutcome(correct: number, total: number): CbseMcqShareOutcome {
  return getMockShareOutcome(correct, total);
}

export function buildCbseMcqShareTemplates(payload: CbseMcqSharePayload): CbseMcqShareTemplate[] {
  const defs = payload.outcome === "win" ? CBSE_WIN_DEFS : CBSE_LOSS_DEFS;
  return defs.map((def) => makeTemplate(def, payload));
}

export { formatMockAccuracyPercent, pickNextMockShareTemplate as pickNextCbseMcqShareTemplate };
