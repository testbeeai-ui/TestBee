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
  charCount: number;
};

type ReferChallengeTemplateDef = {
  id: string;
  tone: "achievement" | "progress" | "comeback";
  hook: string;
  bodyPattern: string;
  ctaPattern: string;
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
    rewardRdm: input.spec.rdm,
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

function makeTemplate(def: ReferChallengeTemplateDef, payload: ReferChallengeSharePayload): ReferChallengeShareTemplate {
  const title = fillPattern(def.hook, payload);
  const body = fillPattern(def.bodyPattern, payload);
  const cta = fillPattern(def.ctaPattern, payload);
  const text = [title, body, cta].join("\n\n");
  return {
    id: def.id,
    platform: "instagram",
    tone: def.tone,
    title,
    body,
    cta,
    text,
    charCount: text.length,
  };
}

/** 10 win captions — Gen Z / 11th–12th energy, long-form for IG. */
const IG_WIN_DEFS: ReferChallengeTemplateDef[] = [
  {
    id: "ig_win_01",
    tone: "achievement",
    hook: "🔥 MAIN CHARACTER ENERGY JUST DROPPED 🔥",
    bodyPattern:
      "11th/12th brainrot officially LOST today because I CLEARED {challengeName} on EduBlast.\n\n📊 THE RECEIPTS:\n✅ {correct}/{total} locked in\n✅ {accuracyPct}% correct on all questions (we don’t miss)\n⏱ {timeTakenLabel} on the clock\n🎯 Bar smashed — +{rewardRdm} RDM target in the bag (when tracking goes live)\n\n{domainLabel} mode had me in a chokehold but I STILL cooked. Boards/JEE energy: one session, one win, zero excuses.\n\nIf you’re still doom-scrolling instead of drilling — this is your sign to touch grass… then touch questions.",
    ctaPattern: "📲 Pull up the same run: {appUrl}\n\n#studygram #jee #boards #class12 #class11 #edublast #grindset",
  },
  {
    id: "ig_win_02",
    tone: "achievement",
    hook: "✨ SHE/HE/THEY PASSED… IT WAS ME ✨",
    bodyPattern:
      "POV: you’re in {challengeName} and the timer is staring you down like your tuition teacher.\n\nI STILL cleared it.\n\n🧠 Score: {correct}/{total}\n📈 % correct (all questions): {accuracyPct}%\n⏳ Session time: {timeTakenLabel}\n\nThis is the kind of win that hits different when you’re juggling PCM + backlogs + “5 min break” that turns into 2 hours.\n\nSmall daily reps > one panic night before the exam. I’m not gatekeeping — EduBlast is literally built for this chaos.",
    ctaPattern: "🔗 Run it yourself: {appUrl}\n\n#studywithme #pcm #studyreels #edublast",
  },
  {
    id: "ig_win_03",
    tone: "progress",
    hook: "🫡 REPORTING LIVE FROM THE GRIND (WIN EDITION) 🫡",
    bodyPattern:
      "Day whatever of pretending I have my life together — but {challengeName} says otherwise because I PASSED.\n\n📌 {correct}/{total}\n📌 {accuracyPct}% correct (all questions)\n📌 {timeTakenLabel} total focus time\n\n{domainLabel} had me sweating but I kept my composure like it’s the last 10 minutes of the paper.\n\nFor everyone in 11th/12th who thinks “I’ll start Monday” — start with ONE timed run. Momentum is fake until you feel it once.",
    ctaPattern: "🎯 Start here: {appUrl}\n\n#studytok #examseason #edublast",
  },
  {
    id: "ig_win_04",
    tone: "achievement",
    hook: "🏆 LOCKED IN. BAR CLEARED. EGO +100. 🏆",
    bodyPattern:
      "Tell your group chat you’re busy — {challengeName} needed full focus and I delivered.\n\n🧾 Stats that matter:\n• {correct}/{total} correct\n• {accuracyPct}% correct (all questions)\n• {timeTakenLabel} deep work\n\nThis wasn’t luck. It was reps + timing discipline + refusing to panic-click answers like it’s a BuzzFeed quiz.\n\nIf you’re prepping for boards or JEE — treat every timed set like a match. You lose fast, you learn faster, you come back stronger.",
    ctaPattern: "⚡ Same challenge format: {appUrl}\n\n#jee2026 #boards2026 #studygram #edublast",
  },
  {
    id: "ig_win_05",
    tone: "progress",
    hook: "📚 ACADEMIC ARC UPDATE: WE WINNING 📚",
    bodyPattern:
      "Character development unlocked: I cleared {challengeName} today.\n\n🎮 Run stats:\n{correct}/{total} | {accuracyPct}% correct (all questions) | {timeTakenLabel}\n\n{domainLabel} is basically the boss level of my study routine. Every mistake is data, every pass is proof the system works.\n\nShoutout to every 11th/12th student running on chai, guilt, and last-minute motivation — you’re not alone. Build the habit anyway.",
    ctaPattern: "🔗 Tap in: {appUrl}\n\n#studymotivation #class12 #class11 #edublast",
  },
  {
    id: "ig_win_06",
    tone: "achievement",
    hook: "🚨 ATTENTION: I DID THE THING 🚨",
    bodyPattern:
      "Not me clearing {challengeName} while half my class is still asking “is this in syllabus?”\n\n📊 {correct}/{total}\n📊 {accuracyPct}% correct (all questions)\n⏱ {timeTakenLabel}\n\nThis is the energy I’m bringing into exam season. Controlled speed > random guessing. Calm brain > chaotic tabs.\n\nIf your revision plan is “I’ll wing it” — no you won’t. You’ll cry in the hall. Fix it in small timed chunks instead.",
    ctaPattern: "📲 Practice link: {appUrl}\n\n#studywithme #edublast #examready",
  },
  {
    id: "ig_win_07",
    tone: "achievement",
    hook: "💅 THAT’S HOT. (IT’S MY SCORE.) 💅",
    bodyPattern:
      "EduBlast said {challengeName} — I said BET.\n\n✅ {correct}/{total}\n✅ {accuracyPct}% correct (all questions)\n✅ {timeTakenLabel} of pure focus (minus the 2 seconds I debated life choices)\n\nWinning here feels like winning in the exam hall: same pressure, same timer, same “don’t throw away easy marks” rule.\n\nTag someone who needs to stop saying “kal se pakka” and actually start today.",
    ctaPattern: "🎯 Link: {appUrl}\n\n#studygram #pcm #edublast",
  },
  {
    id: "ig_win_08",
    tone: "progress",
    hook: "🧠 BRAIN ON SPORT MODE 🧠",
    bodyPattern:
      "Trained like an athlete today — {challengeName} cleared.\n\n🏃‍♂️ Performance split:\n• Output: {correct}/{total}\n• % correct (all questions): {accuracyPct}%\n• Tempo: {timeTakenLabel}\n\n{domainLabel} is not “extra” work. It’s the same skill stack as competitive exams: read fast, decide clean, move on.\n\nIf you’re in 11th/12th, your biggest flex is consistency. Not one 8-hour myth. Daily reps that don’t lie.",
    ctaPattern: "🔗 Train here: {appUrl}\n\n#jee #boards #edublast #studyreels",
  },
  {
    id: "ig_win_09",
    tone: "achievement",
    hook: "🎉 CANON EVENT: I PASSED {challengeName} 🎉",
    bodyPattern:
      "Every student movie has that montage — mine is just EduBlast runs and iced coffee.\n\n📌 {correct}/{total}\n📌 {accuracyPct}% correct (all questions)\n📌 {timeTakenLabel}\n\nThis pass hits harder because it’s measurable. Not vibes. Not “I studied a lot”. Numbers.\n\nIf you’re scrolling at 2am — close the app, run ONE timed set, come back and flex in the comments. Future you is literally begging.",
    ctaPattern: "⚡ Start: {appUrl}\n\n#studygram #edublast #class12",
  },
  {
    id: "ig_win_10",
    tone: "progress",
    hook: "✅ W + COPIED TO CLIPBOARD ENERGY (IN MY HEAD) ✅",
    bodyPattern:
      "Officially clearing {challengeName} today — posting so the universe holds me accountable tomorrow too.\n\n🧾 {correct}/{total}\n🧾 {accuracyPct}% correct (all questions)\n🧾 {timeTakenLabel}\n\n{domainLabel} grind is boring until it isn’t. Then it’s addictive.\n\nDrop a 🔥 if you’re also trying to survive PCM + sanity. We’re literally in the same group project called life.",
    ctaPattern: "📲 Join the run: {appUrl}\n\n#studywithme #edublast #boards",
  },
];

/** 10 loss / comeback captions — still hype, honest, Gen Z. */
const IG_LOSS_DEFS: ReferChallengeTemplateDef[] = [
  {
    id: "ig_loss_01",
    tone: "comeback",
    hook: "💀 VILLAIN ARC LOADING… DIDN’T CLEAR {challengeName} 💀",
    bodyPattern:
      "Okay real talk — I did NOT pass today. And I’m posting anyway because hiding Ls is cringe.\n\n📉 The damage report:\n• Score: {correct}/{total}\n• % correct (all questions): {accuracyPct}%\n• Needed: {neededCorrect}/{total} to actually win\n⏱ Time in the arena: {timeTakenLabel}\n\nThis is the part nobody posts — but it’s where growth lives. One bad run ≠ one bad student. It means the exam found a leak in my process BEFORE the real paper did.\n\n11th/12th is literally built different — we fail loud, fix fast, run it back.",
    ctaPattern: "🔁 Retry energy here: {appUrl}\n\n#studygram #comeback #jee #boards #edublast",
  },
  {
    id: "ig_loss_02",
    tone: "comeback",
    hook: "🎬 CANON EVENT: I TOOK AN L (AND I’M FINE… MOSTLY) 🎬",
    bodyPattern:
      "POV: {challengeName} humbled me today.\n\n📊 {correct}/{total}\n📊 {accuracyPct}% correct (all questions)\n🎯 Needed {neededCorrect}/{total}\n\nIt stings — but I’d rather take the L in practice than in the hall.\n\n{domainLabel} runs teach you where you panic, where you rush, and where your brain goes blank under pressure. That data is GOLD.\n\nIf you’re also “smart but inconsistent” — welcome. We’re fixing that one rep at a time.",
    ctaPattern: "📲 Same format, better me: {appUrl}\n\n#studywithme #edublast #class12",
  },
  {
    id: "ig_loss_03",
    tone: "progress",
    hook: "📉 SCOREBOARD SAYS NO… BRAIN SAYS “WATCH ME” 📉",
    bodyPattern:
      "Not every day is a win day. Today {challengeName} said “try again”.\n\n🧾 {correct}/{total}\n🧾 {accuracyPct}% correct (all questions)\n⏱ {timeTakenLabel}\n\nI’m not romanticizing failure — I’m logging it like a lab experiment. What broke? Timing? Silly mistakes? Overthinking?\n\nExams don’t care about your story. They care about execution. So I’m converting this L into a patch note for tomorrow’s session.",
    ctaPattern: "🔗 Back on EduBlast: {appUrl}\n\n#studymotivation #edublast #pcm",
  },
  {
    id: "ig_loss_04",
    tone: "comeback",
    hook: "🫠 I FUMBLED… BUT THE GRIND RECEIPT IS STILL REAL 🫠",
    bodyPattern:
      "If you think I’m only posting wins — no. I got cooked in {challengeName} today.\n\n📌 {correct}/{total}\n📌 {accuracyPct}% correct (all questions)\n📌 Bar: {neededCorrect}/{total}\n\nBut listen: showing up under a timer when you’re tired is still elite behavior. Most people won’t even start.\n\nThis is for every 11th/12th student who feels behind: you’re not “dumb”, you’re under-trained on pressure. Fix that, not your self-worth.",
    ctaPattern: "⚡ Run again: {appUrl}\n\n#studygram #edublast #boards",
  },
  {
    id: "ig_loss_05",
    tone: "comeback",
    hook: "⚠️ HEARTBREAK RUN ⚠️ (STILL POSTING BECAUSE I’M BRAVE)",
    bodyPattern:
      "EduBlast said {challengeName} — I said “I got this” — the universe said “not today bestie”.\n\n💔 {correct}/{total}\n💔 {accuracyPct}% correct (all questions)\n⏱ {timeTakenLabel}\n\nBut here’s the plot twist: I still learned something expensive for free.\n\nPressure reveals truth. And truth is how you rebuild faster than people who only practice when they feel motivated (aka never).",
    ctaPattern: "📲 Retry arc: {appUrl}\n\n#studywithme #edublast #jee",
  },
  {
    id: "ig_loss_06",
    tone: "progress",
    hook: "🧪 EXPERIMENT FAILED… DATA COLLECTED 🧪",
    bodyPattern:
      "Science students know: a failed experiment is still data.\n\nToday’s {challengeName} data:\n• {correct}/{total}\n• {accuracyPct}% correct (all questions)\n• Needed {neededCorrect}/{total}\n\n{domainLabel} is basically forcing me to confront my weak spots without the delulu “I’ll revise later” mindset.\n\nIf you’re prepping for competitive exams — get comfortable being wrong in practice. It’s cheaper than being wrong on paper.",
    ctaPattern: "🔗 Practice lab: {appUrl}\n\n#pcm #studygram #edublast",
  },
  {
    id: "ig_loss_07",
    tone: "comeback",
    hook: "🫡 RESPECTFULLY… I GOT RATIO’D BY THE TIMER 🫡",
    bodyPattern:
      "Me vs {challengeName} today: 0-1.\n\n📉 {correct}/{total}\n📉 {accuracyPct}% correct (all questions)\n⏱ {timeTakenLabel}\n\nBut I’m not quitting the storyline. I’m just entering the training arc.\n\nIf your brain freezes when the clock ticks — SAME. That’s exactly why timed reps exist.\n\nTag your study bestie who needs to hear this: progress is ugly before it looks aesthetic.",
    ctaPattern: "📲 Next attempt: {appUrl}\n\n#studyreels #edublast #class11",
  },
  {
    id: "ig_loss_08",
    tone: "comeback",
    hook: "🎮 GG… RUN IT BACK 🎮",
    bodyPattern:
      "Lost the match, not the season.\n\n{challengeName} stats:\n{correct}/{total} | {accuracyPct}% correct (all questions) | {timeTakenLabel}\nGoal was {neededCorrect}/{total} — we pack it up and queue next game.\n\nThis is the Gen Z version of discipline: post the L, analyze like a streamer reviewing VOD, come back cracked.\n\nYour future self doesn’t need motivation — they need receipts. Start collecting them.",
    ctaPattern: "⚡ EduBlast run: {appUrl}\n\n#studygram #edublast #boards",
  },
  {
    id: "ig_loss_09",
    tone: "progress",
    hook: "📓 DEAR DIARY… TODAY WAS MID 📓",
    bodyPattern:
      "Day summary (brutally honest):\n{challengeName} — NOT cleared.\n\n📌 {correct}/{total}\n📌 {accuracyPct}% correct (all questions)\n📌 Needed {neededCorrect}/{total}\n\nBut mid days are part of the syllabus of life. Especially in 11th/12th when everyone pretends they’re fine.\n\nI’m choosing consistency over perfection theater. One bad run doesn’t erase the habit — it tests if you’ll show up again tomorrow.",
    ctaPattern: "🔗 Show up here: {appUrl}\n\n#studywithme #edublast #mentalhealthmatters",
  },
  {
    id: "ig_loss_10",
    tone: "comeback",
    hook: "🔁 RESET. RELOAD. RISE. (YES I’M STILL POSTING) 🔁",
    bodyPattern:
      "If you wanted a perfect highlight reel — wrong account.\n\n{challengeName} today: didn’t pass.\n\n📉 {correct}/{total}\n📉 {accuracyPct}% correct (all questions)\n⏱ {timeTakenLabel}\n\nBut I’m treating this like a sports season: you take losses on the road and still win the championship if your process is tight.\n\nNext run: slower panic, faster decisions, fewer silly mistakes. Let’s cook.",
    ctaPattern: "📲 Run it back: {appUrl}\n\n#comeback #studygram #edublast #jee",
  },
];

export function renderTemplate(def: ReferChallengeTemplateDef, payload: ReferChallengeSharePayload): ReferChallengeShareTemplate {
  return makeTemplate(def, payload);
}

/** All Instagram share captions for the current outcome (10 win or 10 loss). */
export function buildReferShareTemplates(payload: ReferChallengeSharePayload): ReferChallengeShareTemplate[] {
  const defs = payload.outcome === "won" ? IG_WIN_DEFS : IG_LOSS_DEFS;
  return defs.map((def) => renderTemplate(def, payload));
}

export function pickNextTemplate(currentIndex: number, templateCount: number): number {
  if (templateCount <= 1) return 0;
  return (currentIndex + 1) % templateCount;
}
