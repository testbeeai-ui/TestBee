/* ─── Landing page text content (investor spec, verbatim) ───────────────── */

export const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "For students", href: "#personas" },
  { label: "For teachers", href: "#personas" },
  { label: "For parents", href: "#personas" },
  { label: "Pricing", href: "#pricing" },
  { label: "Testbee", href: "/play" },
];

/** Dark investor landing (matches marketing shell in product screenshots). */
export const INVESTOR_NAV_LINKS = [
  { label: "Home", href: "/auth?role=student" },
  { label: "Features", href: "/auth?role=student" },
  { label: "For Teachers", href: "/auth?role=teacher" },
  { label: "EduFund", href: "/auth?role=student" },
];

export const FOOTER_LINKS = [
  { label: "About", href: "#" },
  { label: "Features", href: "#features" },
  { label: "EduFund", href: "#" },
  { label: "For schools", href: "#" },
  { label: "For teachers", href: "#personas" },
  { label: "Privacy", href: "#" },
  { label: "Terms", href: "#" },
];

export const HERO_STATS = [
  { value: "4,200+", label: "Questions on the AI wall today" },
  { value: "38,000+", label: "Students earning RDM this month" },
  { value: "94%", label: "Students say it is more fun than textbooks" },
  { value: "2.8x", label: "Faster topic retention vs linear study" },
];

export const TRUST_BADGES = [
  { label: "No coaching class needed", color: "#1D9E75" },
  { label: "Works alongside any coaching", color: "#534AB7" },
  { label: "Earn real rewards while learning", color: "#D85A30" },
  { label: "PUC 1 & 2 full syllabus covered", color: "#EF9F27" },
];

export const PROBLEM_OTHER = [
  "Read chapter 1. Do MCQs. Move to chapter 2. Repeat. Fall asleep.",
  "No idea what classmates or competitors are studying right now.",
  "Doubts sit unanswered or require booking a slot with a tutor.",
  "No reward for effort \u2014 just a progress bar nobody looks at.",
  "AI that replaces thinking rather than sharpening it.",
  "One-size-fits-all \u2014 same speed for toppers and struggling students.",
];

export const PROBLEM_EDUBLAST = [
  "A live, social Q&A wall \u2014 you learn from your questions, others\u2019 questions, and the AI answers. Constantly refreshing. Never boring.",
  "Live leaderboards show you exactly where you stand vs. your peers and your competition. Motivation that never sleeps.",
  "Gyan++ AI answers any doubt in under 2 seconds. Teachers add expert commentary and earn RDM too.",
  "Every action \u2014 answering, tagging, upvoting, attending class \u2014 earns RDM tokens that build toward real financial aid (EduFund).",
  "AI sharpens your native speed, accuracy, and stamina \u2014 it never replaces your thinking, it challenges it.",
  "Adaptive \u2014 solo learner, coaching student, or advanced topper \u2014 EduBlast meets you where you are.",
];

/** Investor dark landing — short comparison lines (deck / screenshot spec). */
export const INVESTOR_PROBLEM_OTHER = [
  "Read chapter. Do MCQs. Fall asleep.",
  "No idea what your competition is studying.",
  "Doubts require booking a tutor slot.",
  "No reward for effort. Nobody notices.",
  "Same mock for 200 students. Zero adaptation.",
];

export const INVESTOR_PROBLEM_EDUBLAST = [
  "Live social Q&A wall — refreshing, competitive.",
  "Live state-wide leaderboard — 38,000 students.",
  "Prof-Pi AI — any doubt in under 2 seconds.",
  "Every action earns RDM — real financial aid.",
  "Testbee adapts to your exact weak areas only.",
];

/* ─── Persona Tab: Student ──────────────────────────────────────────────── */

export const STUDENT_STORIES = [
  {
    title: "You are self-studying for PUC II and JEE",
    text: 'No coaching, no study group, and chapter 5 of Thermodynamics feels like a wall. On EduBlast, you open Gyan++ and ask "Why does entropy always increase?" \u2014 and within 2 seconds you have a detailed AI answer. Then you scroll the wall and find 14 other students wrestling with the same doubt, 3 great comments, and a teacher section from Dr. Suresh with an exam tip. You just learned what would have taken 2 hours in a textbook \u2014 in 4 minutes.',
    tag: "+25 RDM earned just for asking",
    tagBg: "#E1F5EE",
    tagColor: "#085041",
  },
  {
    title: "You are not studying in isolation anymore",
    text: "The live leaderboard shows Nidhi K just scored 91% on the Physics mock. That is your signal. You open a Quant Blitz session, answer 12 questions, close the gap by 200 points. EduBlast turns what would have been a lonely Sunday into a competitive, energising experience \u2014 without anyone forcing you.",
    tag: "Eye on your competition \u2014 always",
    tagBg: "#FAEEDA",
    tagColor: "#633806",
  },
  {
    title: "You build speed, accuracy, and stamina \u2014 not just knowledge",
    text: "DailyDose gives you 5 sharp questions every day. Testbee runs adaptive mocks that find your weak spots. MentaMill sharpens your quant speed. Spaced-repetition Instacues mean you never forget what you already learned. This is the triad every JEE topper has \u2014 now built into your daily scroll.",
    tag: "Speed \u00b7 Accuracy \u00b7 Stamina",
    tagBg: "#EEEDFE",
    tagColor: "#3C3489",
  },
];

export const STUDENT_MOCK_FEED = [
  {
    initials: "AI",
    bg: "#534AB7",
    color: "#fff",
    rounded: true,
    name: "Gyan++ Bot \u00b7 AI-generated",
    text: "What is the physical significance of the Boltzmann constant?",
    meta: "Physics \u00b7 Thermodynamics \u00b7 answered in 1.8s",
    actions: ["\u25b2 22", "\u2605 Revision", "Comment (+5 RDM)"],
    rdm: "+25",
  },
  {
    initials: "NK",
    bg: "#AFA9EC",
    color: "#26215C",
    name: "Nidhi K \u00b7 student",
    text: "Just scored 91% on Physics Mock #2! Integration by parts practice daily = it becomes muscle memory.",
    meta: "34 boosts \u00b7 8 comments",
    actions: ["\u25b2 Boost", "Reply"],
  },
  {
    initials: "PM",
    bg: "#9FE1CB",
    color: "#04342C",
    name: "Priya M \u00b7 student",
    text: "New Instacue: SN1 vs SN2 reactions in 5 bullets \u2014 save it before the chem mock.",
    meta: "218 saves \u00b7 trending",
    actions: ["Save (+2 RDM)", "View"],
  },
];

export const STUDENT_LEADERBOARD = [
  { rank: "\ud83c\udfc5", initials: "NK", bg: "#FAC775", color: "#412402", name: "Nidhi K", pts: "4,820 pts", pct: 96 },
  { rank: "\ud83c\udfc6", initials: "AK", bg: "#AFA9EC", color: "#26215C", name: "Arjun K", pts: "4,310 pts", pct: 86 },
  { rank: "14", initials: "You", bg: "#C0DD97", color: "#173404", name: "You \u2014 310 pts to top 10", pts: "1,740 pts", pct: 35, isYou: true },
];

/* ─── Persona Tab: Coaching ─────────────────────────────────────────────── */

export const COACHING_QUOTE = {
  text: "\u201cI go to FIITJEE every day. But EduBlast is where I actually figure out what I don\u2019t understand \u2014 and then I walk into class already knowing what questions to ask.\u201d",
  attr: "\u2014 Arjun K, JEE aspirant, Bengaluru",
};

export const COACHING_STORIES = [
  {
    title: "EduBlast is a power-up, not a replacement",
    text: "Your coaching class gives you structure. EduBlast gives you the edge. While classmates go home and stare at notes, you are on the Gyan++ wall asking sharper questions, reviewing Instacues on the bus, and playing Quant Blitz before dinner. You arrive at tomorrow\u2019s class sharper than everyone else.",
  },
  {
    title: "You see what your competitors across Karnataka are doing",
    text: "The leaderboard is not your class rank \u2014 it is the state rank. You can see students from other coaching institutes, self-studiers, and toppers from Mysuru and Mangaluru. This is the competitive visibility that no coaching class gives you. And it is live, every day.",
  },
  {
    title: "Testbee mocks adapt to your actual weaknesses",
    text: "Your coaching class runs the same mock for 200 students. Testbee runs a different mock for you \u2014 harder on the topics you fumble, easier on what you have mastered. The AI knows your exact weak spots and targets them. No coaching class AI does this.",
  },
];

export const COACHING_FEATURES = [
  { icon: "?", bg: "#FAECE7", title: "Gyan++ AI wall", text: "Ask anything between classes. Get answers in 2 seconds. Browse 4,000+ peer questions. Teachers add exam tips." },
  { icon: "\u2714", bg: "#EEEDFE", title: "Testbee adaptive mocks", text: "Mocks that adapt to your exact weak areas \u2014 not the same paper your whole class writes." },
  { icon: "\u25cf", bg: "#EAF3DE", title: "MentaMill quant speed", text: "60-second speed rounds build the calculation reflex that wins JEE \u2014 speed most coaching classes ignore." },
  { icon: "\u2605", bg: "#E6F1FB", title: "Instacue revision", text: "AI-scheduled spaced repetition so you never forget what your coaching class covered three weeks ago." },
];

/* ─── Persona Tab: Teacher ──────────────────────────────────────────────── */

export const TEACHER_STORIES = [
  {
    title: "Your expertise earns you income, not just respect",
    text: "Every time you add a Teacher Section commentary to a Gyan++ Q&A, you earn +30 RDM. When students upvote your expert comment, you earn more. The top teacher this week earned 420 RDM \u2014 that is real value you can convert. Your knowledge should pay you, not just the institution.",
    rdm: "+30 RDM per expert comment",
  },
  {
    title: "Run live classes to a national student base",
    text: "Your classes are no longer limited to the 30 students in your room. List a live session on EduBlast, and students across Karnataka join. Your reputation grows beyond your city. Recorded sessions continue earning engagement long after you finish.",
  },
  {
    title: "The AI does the heavy lifting, you add the wisdom",
    text: "Gyan++ AI handles 95% of student doubts instantly. You step in with the exam insight, the mnemonics, the \u201cthis is how the examiner thinks\u201d perspective that no AI can replace. Your value goes up \u2014 not down \u2014 with AI doing the grunt work.",
  },
];

export const TEACHER_MOCK_FEED = [
  {
    initials: "DS",
    name: "Dr. Suresh \u00b7 Physics \u00b7 Teacher section",
    text: "Always draw the force-displacement angle explicitly \u2014 examiners give partial marks for each step shown.",
    meta: "41 student upvotes \u00b7 12 \u201csaved for revision\u201d",
    actions: ["\u25b2 41", "+30 RDM earned"],
  },
  {
    initials: "DS",
    name: "Live class \u2014 Mechanics \u00b7 Newton\u2019s Laws deep dive",
    text: "61 students attended \u00b7 4.9 \u2605 rating \u00b7 312 recorded views",
    meta: "+30 RDM per attendee \u00b7 top-rated this week",
  },
];

/* ─── Persona Tab: Parent ───────────────────────────────────────────────── */

export const PARENT_STORIES = [
  {
    title: "You know exactly how your child is studying \u2014 not just if",
    text: 'The parent dashboard shows you daily active time, RDM earned, leaderboard position, mock scores, and which subjects need more attention. No more "yes I studied" with zero evidence. You see the data, not just the promise.',
  },
  {
    title: "EduFund means learning can earn real financial aid",
    text: "Every time your child studies on EduBlast \u2014 attends a class, answers a doubt, completes a mock \u2014 they earn RDM. Accumulate enough and they become eligible for EduFund grants of up to \u20b950,000. Consistent, genuine learning is literally rewarded. This is not a gimmick \u2014 it is accountability with a return.",
    tag: "Sprout \u20b93,000 \u2014 Scholar \u20b912,000 \u2014 Champion \u20b950,000",
    tagBg: "#E1F5EE",
    tagColor: "#085041",
  },
  {
    title: "AI enhances \u2014 it does not replace your child\u2019s thinking",
    text: "EduBlast is designed to make students smarter, not dependent. The AI answers doubts but always encourages students to engage, comment, and think. Accuracy, speed, and stamina improve through active practice \u2014 not passive watching. Teachers verify, challenge, and add the human layer that pure AI cannot provide.",
  },
];

export const PARENT_ACTIVITY = [
  { label: "Active days", value: "6 / 7" },
  { label: "RDM earned", value: "+940", color: "#EF9F27" },
  { label: "Mock avg score", value: "78%", color: "#1D9E75" },
  { label: "Leaderboard rank", value: "#14" },
];

export const PARENT_ATTENTION = [
  { label: "Chemistry \u2014 58% accuracy", color: "amber" as const },
  { label: "Electrochemistry mock due", color: "coral" as const },
];

/* ─── Feature Comparison Table ──────────────────────────────────────────── */

export const FEATURE_TABLE_ROWS = [
  { feature: "Doubt solving", typical: "Book a tutor slot, wait 24h", ours: "Gyan++ AI answers in 2s \u00b7 teacher expert layer", why: "Doubts cleared in real time = no momentum lost" },
  { feature: "Study approach", typical: "Linear chapter \u2192 chapter", ours: "Social wall, questions, discovery \u2014 non-linear", why: "Active recall beats passive reading 3:1 for retention" },
  { feature: "Peer visibility", typical: "None \u2014 you study in a bubble", ours: "Live leaderboard, feed, community of 38,000", why: "Competitive awareness drives 2.8x faster improvement" },
  { feature: "Mock tests", typical: "Same paper for all students", ours: "Testbee adaptive \u2014 targets your exact weak spots", why: "Targeted drilling closes gaps faster than broad review" },
  { feature: "Revision", typical: "Reread notes before exam", ours: "AI spaced-repetition Instacues \u2014 scheduled optimally", why: "81% retention vs 40% from passive rereading" },
  { feature: "Speed & stamina", typical: "Not trained systematically", ours: "MentaMill \u00b7 DailyDose \u00b7 Quant Blitz daily habits", why: "JEE rewards speed + accuracy equally, not just knowledge" },
  { feature: "Motivation", typical: "Progress bar nobody checks", ours: "RDM rewards \u00b7 EduFund grants \u00b7 live leaderboards", why: "Consistent daily study is the single biggest predictor of rank" },
  { feature: "Teacher interaction", typical: "Scheduled classes only", ours: "Teacher sections on any live Q&A \u00b7 anytime", why: "Contextual expert commentary sticks better than lectures" },
];

/* ─── Core Engine ───────────────────────────────────────────────────────── */

export const CORE_ENGINES = [
  {
    icon: "?",
    bg: "#FAECE7",
    title: "Gyan++ \u2014 the AI Q&A wall",
    text: "Ask any doubt. The AI answers in 2 seconds. Teachers add expert commentary. 38,000 peers ask their own questions \u2014 and you learn from every single one. The more you engage, the more RDM you earn.",
    rdm: "Ask, answer, tag, comment = RDM",
  },
  {
    icon: "\u2714",
    bg: "#E6F1FB",
    title: "Testbee \u2014 adaptive mocks",
    text: "Full PUC 1 & 2 PCM mock engine. Every test adapts to your performance history \u2014 harder on weak areas, calibrated for JEE and Board patterns. Know your exact rank-readiness before exam day.",
    rdm: "+50 RDM per mock completed",
  },
  {
    icon: "\u26a1",
    bg: "#EEEDFE",
    title: "Instacue \u2014 spaced revision",
    text: "Capture a concept in 3 lines. AI schedules when you review it \u2014 based on memory science. Tap Easy / Hard / Forgot. Retention climbs from 40% to 81%. Never walk into an exam having forgotten Chapter 2.",
    rdm: "+40 RDM per revision session",
  },
  {
    icon: "\u25cf",
    bg: "#EAF3DE",
    title: "MentaMill \u2014 quant speed",
    text: "60-second arithmetic blitzes, DI sprints, ratio puzzles. Builds the calculation speed that separates 95-percentile from 99-percentile JEE scorers. Feels like a game. Works like a drill.",
    rdm: "+5 RDM per correct answer",
  },
  {
    icon: "\u2605",
    bg: "#FAEEDA",
    title: "DailyDose \u2014 5 questions a day",
    text: "Five curated questions every morning. Takes 8 minutes. Builds an unbreakable study habit without overwhelming you. Streak milestones unlock bonus RDM. Miss a day and your streak resets \u2014 simple accountability.",
    rdm: "+15 RDM for full dose daily",
  },
  {
    icon: "\u2713",
    bg: "#E1F5EE",
    title: "EduFund \u2014 learning pays",
    text: "Every RDM you earn studying is a step toward real financial aid. Sprout \u2192 Scholar \u2192 Champion tiers unlock grants from \u20b93,000 to \u20b950,000. Consistent genuine learners are rewarded. Not toppers only \u2014 consistent learners.",
    rdm: "Sprout \u00b7 Scholar \u00b7 Champion tiers",
  },
];

/* ─── Pricing ───────────────────────────────────────────────────────────── */

export const PRICING_PLANS = [
  {
    name: "Free",
    price: "\u20b90",
    sub: "forever \u00b7 no card needed",
    features: [
      "Gyan++ AI wall \u2014 unlimited",
      "DailyDose \u2014 5 Qs daily",
      "Explore & social feed",
      "Leaderboard visibility",
      "RDM accumulation for EduFund",
      "Basic Instacue (20 cards)",
    ],
    cta: "Start free",
    variant: "outline" as const,
  },
  {
    name: "Scholar",
    price: "\u20b9499",
    sub: "per month \u00b7 or \u20b93,999/year",
    badge: "Most popular",
    featured: true,
    features: [
      "Everything in Free",
      "Testbee \u2014 unlimited adaptive mocks",
      "MentaMill quant training",
      "Full Instacue library (unlimited)",
      "Calendar \u2014 smart study planner",
      "Live classes + recorded library",
      "EduFund Scholar tier eligibility",
    ],
    cta: "Start Scholar",
    variant: "green" as const,
  },
  {
    name: "Champion",
    price: "\u20b9899",
    sub: "per month \u00b7 or \u20b96,999/year",
    features: [
      "Everything in Scholar",
      "Priority Gyan++ routing \u2014 answers first",
      "Mentor booking \u2014 IIT alumni",
      "Personal EduFund advisor",
      "Champion tier EduFund eligibility",
      "Parent dashboard \u2014 full access",
      "School / coaching batch tools",
    ],
    cta: "Start Champion",
    variant: "coral" as const,
  },
];
