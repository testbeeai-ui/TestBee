"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronUp,
  Clock,
  FileText,
  LineChart,
  Menu,
  MessageSquare,
  Mic2,
  PieChart,
  Star,
  Timer,
  TrendingUp,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  INVESTOR_PROBLEM_EDUBLAST,
  INVESTOR_PROBLEM_OTHER,
} from "@/components/landing/landing-constants";

/** Order: ends segment with RIGHT NOW so wrap reads …HT NOW ✦ EARN RDM… then exams. */
const HORIZONTAL_TICKER = [
  "1000+ Sessions Open right now",
  "EARN RDM WHILE YOU STUDY",
  "JEE MAIN 2026",
  "JEE ADVANCED",
  "KARNATAKA CET",
  "CBSE BOARD",
  "STATE BOARD KARNATAKA",
  "NEET 2026",
  "MH-CET",
] as const;

/**
 * Section padding tuned for 13–14″ laptops (lg–xl): not oversized; 2xl+ keeps breathing room.
 */
const SEC_PAD =
  "px-4 py-12 sm:px-6 sm:py-14 lg:px-6 lg:py-14 xl:px-8 xl:py-16 2xl:px-10";
const SEC_PAD_SHORT =
  "px-4 py-11 sm:px-6 sm:py-12 lg:px-6 lg:py-12 xl:px-8 xl:py-14 2xl:px-10";
const SEC_PAD_EXAM =
  "px-4 py-8 sm:px-6 sm:py-10 lg:px-6 lg:py-10 xl:px-8 xl:py-11 2xl:px-10";

/** Investor exam row — tinted pill, colored border + dot + label (ref. ticker strip layout). */
const EXAM_COVERAGE_PILLS = [
  {
    label: "CBSE Board",
    dot: "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.45)]",
    pill: "border-sky-400/45 bg-sky-500/[0.12] text-sky-300 hover:border-sky-400/70 hover:bg-sky-500/[0.18]",
  },
  {
    label: "State Board",
    dot: "bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.4)]",
    pill: "border-teal-400/45 bg-teal-500/[0.12] text-teal-300 hover:border-teal-400/70 hover:bg-teal-500/[0.18]",
  },
  {
    label: "JEE Main",
    dot: "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.45)]",
    pill: "border-orange-400/50 bg-orange-500/[0.12] text-orange-300 hover:border-orange-400/75 hover:bg-orange-500/[0.2]",
  },
  {
    label: "JEE Advanced",
    dot: "bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.45)]",
    pill: "border-indigo-400/45 bg-indigo-500/[0.12] text-indigo-300 hover:border-indigo-400/70 hover:bg-indigo-500/[0.18]",
  },
  {
    label: "KCET",
    dot: "bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.4)]",
    pill: "border-lime-400/45 bg-lime-500/[0.1] text-lime-300 hover:border-lime-400/70 hover:bg-lime-500/[0.16]",
  },
  {
    label: "NEET",
    dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.45)]",
    pill: "border-amber-400/50 bg-amber-500/[0.12] text-amber-200 hover:border-amber-400/75 hover:bg-amber-500/[0.18]",
  },
  {
    label: "MH-CET & Others",
    dot: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.45)]",
    pill: "border-rose-500/45 bg-rose-500/[0.12] text-rose-300 hover:border-rose-400/70 hover:bg-rose-500/[0.18]",
  },
] as const;

type FeatureTag = { label: string; className: string };

type SixSystemCard = {
  cat: string;
  catClass: string;
  title: string;
  /** Omit to hide the top-right RDM pill (e.g. Instacue). */
  rdm?: string;
  rdmPillClass?: string;
  desc: string;
  tags: readonly FeatureTag[];
  icon: LucideIcon;
  iconWrapClass: string;
  iconClass: string;
};

const SIX_SYSTEMS: readonly SixSystemCard[] = [
  {
    cat: "Prof-Pi",
    catClass: "text-violet-400",
    title: "AI Q&A Wall – Gyan++",
    rdm: "+5 RDM",
    rdmPillClass: "bg-orange-500/15 text-orange-200 ring-1 ring-orange-400/35",
    desc: "Ask any doubt and get answers in seconds. Teachers add expert commentary.",
    tags: [
      { label: "Quick Response", className: "text-sky-300 ring-sky-400/25" },
      { label: "Peers Study", className: "text-violet-300 ring-violet-400/20" },
      { label: "AI + Teacher", className: "text-violet-200 ring-violet-400/25" },
    ],
    icon: Clock,
    iconWrapClass: "bg-violet-500/20 ring-1 ring-violet-400/40",
    iconClass: "text-violet-200",
  },
  {
    cat: "TESTBEE",
    catClass: "text-emerald-400",
    title: "Adaptive Mocks",
    rdm: "+50 RDM / mock",
    rdmPillClass: "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/35",
    desc: "Adapts to your weak areas. Calibrated for JEE, Board and KCET patterns.",
    tags: [
      { label: "Adaptive AI", className: "text-emerald-300 ring-emerald-400/25" },
      { label: "JEE patterns", className: "text-emerald-200/90 ring-emerald-400/20" },
      { label: "Rank-ready", className: "text-teal-200 ring-teal-400/25" },
    ],
    icon: MessageSquare,
    iconWrapClass: "bg-emerald-500/20 ring-1 ring-emerald-400/40",
    iconClass: "text-emerald-200",
  },
  {
    cat: "INSTACUE",
    catClass: "text-rose-400",
    title: "Spaced Revision",
    desc: "Easy to Use Flash cards. Retention from 40% to 81%. Never forget your concepts or formulae.",
    tags: [
      { label: "Memory science", className: "text-rose-300 ring-rose-400/25" },
      { label: "Auto-scheduled", className: "text-rose-200/90 ring-rose-400/20" },
    ],
    icon: Star,
    iconWrapClass: "bg-rose-500/20 ring-1 ring-rose-400/40",
    iconClass: "text-rose-200",
  },
  {
    cat: "MENTAMILL",
    catClass: "text-amber-400",
    title: "Quant Speed Drill",
    rdm: "+5 RDM per set",
    rdmPillClass: "bg-amber-500/15 text-amber-100 ring-1 ring-amber-400/35",
    desc: "60-second blitzes. Builds the calculation reflex that separates JEE ranks.",
    tags: [
      { label: "Speed training", className: "text-amber-300 ring-amber-400/25" },
      { label: "Game-like", className: "text-amber-200/90 ring-amber-400/20" },
    ],
    icon: LineChart,
    iconWrapClass: "bg-amber-500/20 ring-1 ring-amber-400/40",
    iconClass: "text-amber-200",
  },
  {
    cat: "DAILYDOSE",
    catClass: "text-purple-400",
    title: "15 Questions / Day",
    rdm: "+5 RDM / Day",
    rdmPillClass: "bg-purple-500/15 text-purple-100 ring-1 ring-purple-400/35",
    desc: "Fifteen curated questions. 5 minutes. Builds an unbreakable study habit.",
    tags: [
      { label: "Streak system", className: "text-purple-300 ring-purple-400/25" },
      { label: "5 min / day", className: "text-purple-200/90 ring-purple-400/20" },
    ],
    icon: Timer,
    iconWrapClass: "bg-purple-500/20 ring-1 ring-purple-400/40",
    iconClass: "text-purple-200",
  },
  {
    cat: "EDUFUND",
    catClass: "text-[#34f5a4]",
    title: "Learning Pays",
    rdm: "Up to ₹50,000",
    rdmPillClass: "bg-emerald-500/15 text-emerald-100 ring-1 ring-[#34f5a4]/40",
    desc: "RDM earned while studying unlocks real financial aid. Consistent learners rewarded.",
    tags: [
      { label: "Real grants", className: "text-emerald-300 ring-emerald-400/25" },
      { label: "3 tiers", className: "text-teal-200 ring-teal-400/20" },
      { label: "Scholarships", className: "text-[#7af7c8] ring-[#34f5a4]/25" },
    ],
    icon: TrendingUp,
    iconWrapClass: "bg-emerald-500/20 ring-1 ring-[#34f5a4]/45",
    iconClass: "text-[#34f5a4]",
  },
];

const RDM_WAYS = [
  {
    icon: "?",
    title: "Ask/Upload a question",
    desc: "Post a doubt on the Gyan ++ Wall. AI answers instantly.",
    rdm: "+5 RDM",
  },
  {
    icon: "👍",
    title: "Comment on Q&A",
    desc: "Add a useful peer comment that gets upvoted.",
    rdm: "+5 RDM / upvote",
  },
  {
    icon: "📝",
    title: "Complete a mock & post",
    desc: "Finish a full Testbee mock test.",
    rdm: "+50 RDM",
  },
  {
    icon: "★",
    title: "DailyDose streak",
    desc: "Answer all 15 daily questions. Every streak milestone — bonus.",
    rdm: "+15 RDM/ Streak",
  },
  {
    icon: "🔥",
    title: "Instacue revision",
    desc: "Complete a spaced revision session on your saved cards.",
    rdm: "+5 RDM",
  },
  {
    icon: "⚡",
    title: "MentaMill blitz",
    desc: "Correct answer in quant speed drill session.",
    rdm: "+5 RDM / Set",
  },
  {
    icon: "👥",
    title: "Attend live class",
    desc: "Join a live teacher session on EduBlast.",
    rdm: "+30 RDM",
  },
  {
    icon: "🤝",
    title: "Refer a friend",
    desc: "Invite a classmate who signs up and studies.",
    rdm: "+100 RDM",
  },
] as const;

function TickerStrip() {
  const doubled = [...HORIZONTAL_TICKER, ...HORIZONTAL_TICKER];
  return (
    <div className="overflow-hidden border-y border-white/10 bg-[#070b14] py-3.5">
      <div className="investor-marquee-x flex w-max gap-10 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-200/95 antialiased sm:text-xs sm:tracking-[0.18em] [text-shadow:0_0_24px_rgba(255,255,255,0.06),0_1px_0_rgba(0,0,0,0.5)]">
        {doubled.map((t, i) => (
          <span key={`${t}-${i}`} className="inline-flex items-center gap-10">
            <span className="text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.45)]">✦</span>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function ExamCoverageStrip() {
  return (
    <section
      className={`border-b border-white/10 bg-[#050505] ${SEC_PAD_EXAM}`}
      aria-labelledby="exam-coverage-heading"
    >
      <div className="mx-auto max-w-6xl">
        <p
          id="exam-coverage-heading"
          className="text-center text-sm font-semibold tracking-tight text-slate-400 sm:text-base"
        >
          Covers Exams you are preparing for
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2.5 sm:mt-6 sm:gap-3">
          {EXAM_COVERAGE_PILLS.map((e) => (
            <span
              key={e.label}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12px] font-semibold tracking-tight transition-colors sm:px-4 sm:text-[13px] ${e.pill}`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${e.dot}`} aria-hidden />
              {e.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

const TEACHER_STEPS = [
  {
    step: "1",
    title: "Apply and verify",
    desc: "Submit your subject expertise and credentials. Approved in 48 hours. Physics, Chemistry or Mathematics.",
    reward: "",
  },
  {
    step: "2",
    title: "Add Teacher Sections",
    desc: "Comment on any Gyan+ Q&A with exam tips and insight. Every upvoted comment earns you RDM instantly.",
    reward: "+10 RDM / upvoted comment",
  },
  {
    step: "3",
    title: "Run live classes",
    desc: "List a session — students across India join. Recordings earn views and RDM long after you finish.",
    reward: "+10 RDM / attendee",
  },
  {
    step: "4",
    title: "Earn and grow",
    desc: "RDM converts to Real Rewards. Your profile builds national reputation beyond your home institute.",
    reward: "",
  },
] as const;

const TEACHER_TOOLKIT = [
  {
    icon: MessageSquare,
    iconWrap: "bg-indigo-500/16 ring-indigo-400/30",
    iconClass: "text-indigo-200",
    title: "Teacher Sections",
    desc: "Comment on any live Gyan+ Q&A. Your answer appears as a verified Teacher Section — clearly distinguished from AI and peer responses. Students upvote, you earn.",
    point: "+10 RDM per upvoted comment",
  },
  {
    icon: CalendarDays,
    iconWrap: "bg-sky-500/16 ring-sky-400/30",
    iconClass: "text-sky-200",
    title: "Live and Recorded Classes",
    desc: "Schedule and broadcast live topic sessions. Students across PUC India join. Every session is recorded and earns views permanently in your class library.",
    point: "+10 RDM per attendee",
  },
  {
    icon: Mic2,
    iconWrap: "bg-violet-500/16 ring-violet-400/30",
    iconClass: "text-violet-200",
    title: "Podcast and Content",
    desc: "Co-host EduBlast podcast episodes on exam strategy, subject deep-dives, and student mindset. Build your personal brand beyond your classroom.",
    point: "Revenue share on views",
  },
  {
    icon: PieChart,
    iconWrap: "bg-emerald-500/16 ring-emerald-400/30",
    iconClass: "text-emerald-200",
    title: "Earnings Dashboard",
    desc: "Track RDM in real time. See which comments resonated, which topic students struggle with most, and monitor your history and upcoming milestones.",
    point: "Live earnings analytics",
  },
  {
    icon: FileText,
    iconWrap: "bg-amber-500/16 ring-amber-400/30",
    iconClass: "text-amber-200",
    title: "Co-create Exam Content",
    desc: "Write Testbee mock questions, Instacue revision cards, and DailyDose questions with the EduBlast curriculum team. Revenue share on all content created.",
    point: "Revenue share on content",
  },
  {
    icon: BadgeCheck,
    iconWrap: "bg-fuchsia-500/16 ring-fuchsia-400/30",
    iconClass: "text-fuchsia-200",
    title: "Selected Faculty Profile",
    desc: "Your verified profile appears on the EduBlast platform, brochures and marketing. Students see your ratings, classes and commentary reputation — nationwide.",
    point: "National visibility",
  },
] as const;

function TeacherInvestorSections() {
  return (
    <>
      <section className={`border-b border-white/10 bg-[#080910] ${SEC_PAD_SHORT}`}>
        <div className="mx-auto max-w-6xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-[#34f5a4]">
            How it works · 4 steps
          </p>
          <h2
            className="mt-3 text-[1.66rem] font-semibold leading-[1.08] text-white sm:text-[1.9rem] lg:text-[2.08rem] xl:text-[3.05rem]"
            style={{ fontFamily: "var(--font-landing-serif), ui-serif, Georgia, serif" }}
          >
            From zero to <span className="text-[#34f5a4] italic">national reach</span> in one week.
          </h2>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {TEACHER_STEPS.map((x) => (
              <div
                key={x.title}
                className="group/step flex min-h-[200px] flex-col items-center rounded-2xl border border-indigo-500/22 bg-gradient-to-b from-[#111525] to-[#0a0d16] px-5 py-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-indigo-400/40 hover:shadow-[0_18px_34px_-16px_rgba(79,70,229,0.45)]"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-indigo-400/35 bg-indigo-500/10 text-[10px] font-bold text-indigo-200 transition-all duration-300 group-hover/step:scale-105 group-hover/step:border-indigo-300/50 group-hover/step:text-indigo-100">
                  {x.step}
                </span>
                <h3 className="mt-4 text-[0.95rem] font-semibold leading-tight text-white transition-colors duration-300 group-hover/step:text-indigo-100 sm:text-[1.02rem] lg:text-[1.1rem]">
                  {x.title}
                </h3>
                <p className="mt-2.5 text-[11px] leading-snug text-zinc-400 transition-colors duration-300 group-hover/step:text-zinc-300">{x.desc}</p>
                {x.reward ? (
                  <p className="mt-auto rounded-full bg-amber-500/12 px-3 py-0.5 text-[10px] font-bold text-amber-300 transition-all duration-300 group-hover/step:bg-amber-500/18 group-hover/step:text-amber-200">
                    {x.reward}
                  </p>
                ) : (
                  <div className="mt-auto" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`border-b border-white/10 bg-[#090a12] ${SEC_PAD_SHORT}`}>
        <div className="mx-auto max-w-6xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#34f5a4]">
            Your teacher toolkit
          </p>
          <h2
            className="mt-3 whitespace-nowrap text-[1.42rem] font-semibold text-white sm:text-[1.68rem] lg:text-[1.86rem] xl:text-[2.75rem]"
            style={{ fontFamily: "var(--font-landing-serif), ui-serif, Georgia, serif" }}
          >
            Everything a great teacher needs to{" "}
            <span className="text-[#34f5a4] italic">reach, teach and earn.</span>
          </h2>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {TEACHER_TOOLKIT.map((x) => {
              const Icon = x.icon;
              return (
                <div
                  key={x.title}
                className="group/toolkit relative min-h-[228px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#12162a] to-[#0d1020] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-400/35 hover:shadow-[0_20px_36px_-18px_rgba(99,102,241,0.4)]"
              >
                <div className="pointer-events-none absolute inset-x-4 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-indigo-400/70 to-transparent opacity-0 transition-opacity duration-300 group-hover/toolkit:opacity-100" />
                <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 transition-all duration-300 group-hover/toolkit:scale-105 ${x.iconWrap}`}>
                  <Icon className={`h-[18px] w-[18px] ${x.iconClass}`} strokeWidth={2.2} />
                </div>
                <h3
                  className="mt-4 text-[1.48rem] font-semibold leading-none text-white transition-colors duration-300 group-hover/toolkit:text-indigo-100"
                  style={{ fontFamily: "var(--font-landing-serif), ui-serif, Georgia, serif" }}
                >
                  {x.title}
                </h3>
                <p className="mt-3 text-[12px] leading-relaxed text-zinc-400 transition-colors duration-300 group-hover/toolkit:text-zinc-300">{x.desc}</p>
                <p className="mt-4 text-[10px] font-bold text-amber-300 transition-colors duration-300 group-hover/toolkit:text-amber-200">⚡ {x.point}</p>
              </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className={`border-b border-white/10 bg-[#080910] ${SEC_PAD_SHORT}`}>
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2 lg:items-start lg:gap-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#34f5a4]">
              Your dashboard · live
            </p>
            <h2
              className="mt-3 text-[1.48rem] font-semibold leading-[1.15] text-white sm:text-[1.72rem] lg:text-[1.86rem]"
              style={{ fontFamily: "var(--font-landing-serif), ui-serif, Georgia, serif" }}
            >
              We do the grunt work. <br />
              You add the <span className="text-[#34f5a4] italic">wisdom.</span>
            </h2>
            <p className="mt-4 max-w-lg text-[13px] leading-relaxed text-zinc-400 sm:text-[13px]">
              On Gyan+, we handle repetitive student doubts instantly. You step in with exam insight,
              strategy and mentorship where it matters.
            </p>
            <ul className="mt-5 space-y-2.5 text-[14px] text-zinc-300">
              {[
                "Doubts answered before you even open the app",
                "You add exam strategy, mnemonics and psychology",
                "Students upvote expertise — you earn RDM",
              ].map((line) => (
                <li key={line} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-b from-[#111425] to-[#0c0f1d] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-400/30 hover:shadow-[0_18px_34px_-20px_rgba(99,102,241,0.35)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <p className="text-[14px] font-semibold text-white">Dr. Suresh · Physics Faculty</p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                Verified Faculty
              </span>
            </div>

            {/* Integrated 2x2 stat board (with lines, like investor ref) */}
            <div className="relative mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/15">
              <span className="pointer-events-none absolute left-5 right-5 top-1/2 h-px -translate-y-1/2 bg-white/10" aria-hidden />
              <span className="pointer-events-none absolute bottom-5 top-5 left-1/2 w-px -translate-x-1/2 bg-white/10" aria-hidden />
              <div className="grid grid-cols-2">
                {[
                  ["312", "students helped this month", "text-emerald-300"],
                  ["+420", "RDM earned this week", "text-amber-300"],
                  ["4.9★", "live class rating", "text-white"],
                  ["4.2k", "profile reach", "text-indigo-300"],
                ].map(([v, l, tone], i) => (
                  <div
                    key={l}
                    className={`p-2.5 transition-colors duration-300 hover:bg-indigo-500/[0.05] ${
                      i < 2 ? "pb-4" : "pt-4"
                    } ${i % 2 === 0 ? "pr-4" : "pl-4"}`}
                  >
                    <p className={`text-[1.62rem] font-semibold leading-none ${tone}`}>{v}</p>
                    <p className="mt-1 text-[9px] uppercase tracking-wide text-zinc-500">{l}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                Recent Teacher Sections
              </p>
              <div className="mt-2 divide-y divide-white/10 rounded-xl border border-white/10 bg-black/18">
                <div className="px-3 py-2.5 transition-colors duration-300 hover:bg-indigo-500/[0.05]">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/18 text-[10px] font-bold text-emerald-300">
                      DS
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-white">Physics · Newton&apos;s Laws</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                        Draw force-displacement angle explicitly — examiners award partial marks for each step shown.
                      </p>
                      <p className="mt-1 text-[11px] font-bold text-amber-300">+30 RDM · 41 upvotes</p>
                    </div>
                  </div>
                </div>

                <div className="px-3 py-2.5 transition-colors duration-300 hover:bg-indigo-500/[0.05]">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md bg-indigo-500/18 text-[10px] font-bold text-indigo-300">
                      DS
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-white">Live class · Mechanics</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                        61 students attended · 4.9★ · 312 recorded views
                      </p>
                      <p className="mt-1 text-[11px] font-bold text-amber-300">+1,830 RDM earned</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#070810] px-4 py-12 sm:px-6 lg:px-6 xl:px-8 2xl:px-10">
        <div className="mx-auto max-w-6xl rounded-3xl border border-indigo-500/25 bg-gradient-to-r from-[#10152b] to-[#0a0d1a] p-6 transition-all duration-300 hover:border-indigo-400/40 hover:shadow-[0_24px_44px_-20px_rgba(99,102,241,0.45)] sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-indigo-300">
                Ready to reach students all over India?
              </p>
              <h3
                className="mt-3 text-[1.7rem] font-semibold leading-[1.1] text-white sm:text-[2rem]"
                style={{ fontFamily: "var(--font-landing-serif), ui-serif, Georgia, serif" }}
              >
                Get paid for the expertise
                <br />
                you already have.
              </h3>
              <p className="mt-3 text-sm text-zinc-300">
                Paid role · National reach · Content revenue share · Selected Faculty Profile.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/auth?role=teacher"
                className="inline-flex items-center gap-2 rounded-full bg-[#6f71ff] px-7 py-3 text-sm font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#5f62f7] hover:shadow-[0_12px_26px_-10px_rgba(111,113,255,0.6)]"
              >
                Apply as teacher ambassador <ArrowUpRight className="h-4 w-4" />
              </Link>
              <button
                type="button"
                className="rounded-full border border-white/25 px-7 py-3 text-sm font-semibold text-zinc-200 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/45 hover:bg-white/[0.04]"
              >
                Back to home
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default function EduBlastInvestorLanding() {
  const searchParams = useSearchParams();
  const initialPersona = searchParams.get("persona") === "teacher" ? "teacher" : "student";
  const [persona, setPersona] = useState<"student" | "teacher">(initialPersona);

  return (
    <div className="overflow-x-hidden bg-[#050505] text-zinc-100">
      {/* —— Hero: investor shell (ref. marketing mockups) —— */}
      <section className="border-b border-white/10 bg-[#050505] px-4 pb-10 pt-4 sm:px-6 sm:pb-11 lg:px-6 lg:pb-12 xl:px-8 2xl:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-col items-center gap-3 pt-12 sm:mb-7 sm:pt-14 lg:mb-8">
            <div className="fixed left-1/2 top-[68px] z-40 inline-flex w-fit max-w-[calc(100%-1rem)] -translate-x-1/2 flex-col rounded-full border border-white/12 bg-zinc-950/90 p-1 text-[11px] font-bold shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_8px_24px_-12px_rgba(0,0,0,0.65)] backdrop-blur sm:max-w-full sm:flex-row sm:text-xs">
              <button
                type="button"
                onClick={() => setPersona("student")}
                className={`rounded-full px-4 py-2.5 transition-colors sm:px-5 lg:px-6 ${
                  persona === "student"
                    ? "bg-[#34f5a4] text-neutral-950 shadow-[0_0_20px_rgba(52,245,164,0.25)]"
                    : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                For Students
              </button>
              <button
                type="button"
                onClick={() => setPersona("teacher")}
                className={`rounded-full px-4 py-2.5 transition-colors sm:px-5 lg:px-6 ${
                  persona === "teacher"
                    ? "bg-[#34f5a4] text-neutral-950 shadow-[0_0_20px_rgba(52,245,164,0.25)]"
                    : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                For Teachers
              </button>
            </div>
            {persona === "teacher" && (
              <p className="max-w-md text-center text-xs text-zinc-500">
                Teacher tools, live cohorts, and paid ambassador tracks — same wall, national reach.
              </p>
            )}
          </div>

          <div className="mb-6 flex justify-center">
            <span
              className={`mx-auto inline-flex max-w-[min(100%,40rem)] flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full px-3 py-2 text-center text-[9px] font-bold uppercase leading-snug tracking-[0.18em] sm:px-4 sm:text-[10px] sm:tracking-[0.24em] lg:tracking-[0.26em] ${
                persona === "teacher"
                  ? "border-indigo-400/45 bg-indigo-500/[0.09] text-indigo-200"
                  : "border-emerald-400/45 bg-emerald-500/[0.07] text-emerald-300/95"
              }`}
            >
              <span className={`shrink-0 ${persona === "teacher" ? "text-indigo-300" : "text-emerald-400"}`} aria-hidden>
                ✦
              </span>
              <span className="text-balance">
                {persona === "teacher"
                  ? "For PCM teachers · PUC 1 & 2"
                  : "India&apos;s first AI-powered learning social network"}
              </span>
            </span>
          </div>

          <h1
            className="mx-auto max-w-5xl text-center text-[1.75rem] font-semibold leading-[1.18] tracking-tight text-white sm:text-[2rem] sm:leading-[1.15] md:text-[2.2rem] md:leading-[1.13] lg:text-[2.35rem] lg:leading-[1.12] xl:text-[2.55rem] xl:leading-[1.11] 2xl:text-[3rem] 2xl:leading-[1.1]"
            style={{ fontFamily: "var(--font-landing-serif), ui-serif, Georgia, serif" }}
          >
            {persona === "teacher" ? (
              <>
                <span className="block font-semibold text-white">Your expertise should earn you</span>
                <span className="mt-1 block text-[2.25rem] font-semibold italic leading-[0.9] text-[#6f71ff] sm:text-[2.8rem] md:text-[3.2rem] lg:text-[3.45rem] xl:text-[3.8rem]">
                  income,
                </span>
                <span className="block font-semibold text-white">
                  not just{" "}
                  <span className="inline-block text-[2.25rem] font-semibold italic leading-[0.9] text-[#34f5a4] sm:text-[2.8rem] md:text-[3.2rem] lg:text-[3.45rem] xl:text-[3.8rem]">
                    respect.
                  </span>
                </span>
              </>
            ) : (
              <>
                <span className="font-semibold text-white">Learning that feels like </span>
                <br className="sm:hidden" />
                <span
                  className="inline-block text-[2.15rem] font-bold leading-[0.95] text-[#34f5a4] sm:text-[2.6rem] md:text-[3rem] lg:text-[3.15rem] xl:text-[3.65rem] 2xl:text-[4.35rem]"
                  style={{ fontFamily: "var(--font-landing-script), cursive" }}
                >
                  scrolling
                </span>
                <span className="font-semibold text-white"> —</span>
                <br className="hidden sm:block" />
                <span className="font-semibold text-white"> but builds an </span>
                <span className="mt-1 inline-block font-semibold italic text-[1.75rem] text-[#e8735a] sm:mt-0 sm:text-[2rem] md:text-[2.2rem] lg:text-[2.35rem] xl:text-[2.55rem] 2xl:text-[3rem]">
                  exam winner.
                </span>
              </>
            )}
          </h1>

          <p className="mx-auto mt-6 max-w-lg text-center text-sm leading-relaxed text-zinc-500 sm:text-[15px]">
            {persona === "teacher"
              ? "Stop limiting your impact to 30 students in a room. EduBlast puts your knowledge in front of 1000's of students across India — and pays you for every insight you share."
              : "Ask. Earn. Rank. Repeat. The social feed that makes you sharper — every single day."}
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href={persona === "teacher" ? "/auth?role=teacher" : "/auth?role=student"}
              className={`inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-bold shadow-[0_0_32px_rgba(52,245,164,0.3)] transition ${
                persona === "teacher"
                  ? "bg-[#6f71ff] text-white hover:bg-[#5f62f7]"
                  : "bg-[#34f5a4] text-neutral-950 hover:bg-[#2ee89a]"
              }`}
            >
              {persona === "teacher" ? "Apply as teacher" : "Join free — 2 minutes"}{" "}
              <ArrowUpRight className="h-4 w-4 shrink-0" strokeWidth={2.5} />
            </Link>
            <button
              type="button"
              className="rounded-full border border-white/30 bg-transparent px-8 py-3.5 text-sm font-semibold text-white transition hover:border-white/50 hover:bg-white/[0.04]"
            >
              {persona === "teacher" ? "Watch teacher demo" : "Watch demo"}
            </button>
          </div>

          {persona === "teacher" ? (
            <div className="mx-auto mt-7 grid w-full max-w-3xl grid-cols-4 gap-3 text-center sm:mt-8">
              {[
                { v: "420+", l: "TOP TEACHER RDM / WEEK", c: "text-amber-300" },
                { v: "312", l: "STUDENTS HELPED / MONTH", c: "text-[#34f5a4]" },
                { v: "4.9★", l: "AVG LIVE CLASS RATING", c: "text-white" },
                { v: "+10", l: "RDM PER UPVOTED COMMENT", c: "text-[#6f71ff]" },
              ].map((s) => (
                <div key={s.l} className="min-w-0">
                  <p className={`text-[1.55rem] font-semibold leading-none sm:text-[1.8rem] ${s.c}`}>{s.v}</p>
                  <p className="mt-1 text-[8.5px] uppercase tracking-[0.12em] text-zinc-600 sm:text-[9px]">{s.l}</p>
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className="mx-auto mt-6 max-w-2xl px-2 text-center text-balance text-sm font-medium leading-snug tracking-wide text-zinc-400 sm:text-[15px]">
                1000+ Sessions Open right now
              </p>

              <div className="mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-3 sm:mt-10 sm:grid-cols-4 lg:mt-11">
                {[
                  { v: "150+", l: "Q & A on the Gyan ++ Wall" },
                  { v: "94%", l: "MORE FUN THAN TEXTBOOKS" },
                  { v: "2.8x", l: "FASTER RETENTION" },
                  { v: "₹50k", l: "MAX EDUFUND GRANT" },
                ].map((s) => (
                  <div
                    key={s.l}
                    className="rounded-2xl border border-white/[0.08] bg-zinc-900/50 px-4 py-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:px-5 sm:py-6"
                  >
                    <div className="text-xl font-bold tracking-tight text-white sm:text-2xl lg:text-[1.5rem] xl:text-[1.65rem]">
                      {s.v}
                    </div>
                    <div className="mt-2 text-[9px] font-bold uppercase leading-snug tracking-[0.2em] text-zinc-500">
                      {s.l}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
      {persona === "student" ? (
      <>
          <TickerStrip />

          <ExamCoverageStrip />

      {/* —— Six systems (investor cards) —— */}
      <section
        id="investor-features"
        className={`scroll-mt-20 border-b border-white/10 bg-[#0a0a0a] ${SEC_PAD}`}
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center lg:mb-12 lg:text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#34f5a4]">
              Six AI systems · one mission
            </p>
            <h2 className="mt-4 max-w-4xl text-[1.65rem] font-semibold leading-tight tracking-tight text-white sm:text-[1.85rem] lg:mx-0 lg:max-w-3xl lg:text-[2rem] xl:text-3xl 2xl:text-4xl">
              Every feature built to make you{" "}
              <span
                className="bg-gradient-to-r from-[#34f5a4] via-emerald-300 to-cyan-300 bg-clip-text font-semibold italic text-transparent"
                style={{ fontFamily: "var(--font-landing-serif), ui-serif, Georgia, serif" }}
              >
                rank higher.
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3 xl:gap-6">
            {SIX_SYSTEMS.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.title} className="group/card relative">
                  {/* Hover: outer glow + gradient hairline (investor spec) */}
                  <div
                    className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-all duration-500 group-hover/card:opacity-100"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(167,139,250,0.55), rgba(52,245,164,0.45))",
                      filter: "blur(10px)",
                    }}
                  />
                  <div
                    className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-[#121318] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-300 group-hover/card:-translate-y-0.5 group-hover/card:border-white/[0.18] group-hover/card:bg-[#161a22] group-hover/card:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65),0_0_0_1px_rgba(167,139,250,0.12),0_0_40px_-8px_rgba(52,245,164,0.08)] xl:p-6"
                  >
                    {/* Bottom gradient bar on hover (purple → teal) */}
                    <div
                      className="pointer-events-none absolute bottom-0 left-5 right-5 h-[2px] rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-teal-400 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
                      aria-hidden
                    />

                    <div className="relative flex items-start justify-between gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c.iconWrapClass}`}
                      >
                        <Icon className={`h-5 w-5 ${c.iconClass}`} strokeWidth={2} />
                      </div>
                      {c.rdm != null && c.rdm !== "" && c.rdmPillClass ? (
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide ${c.rdmPillClass}`}
                        >
                          {c.rdm}
                        </span>
                      ) : null}
                    </div>

                    <p
                      className={`relative mt-5 text-[10px] font-bold uppercase tracking-[0.2em] ${c.catClass}`}
                    >
                      {c.cat}
                    </p>
                    <h3
                      className="relative mt-1.5 text-lg font-semibold text-white sm:text-xl"
                      style={{ fontFamily: "var(--font-landing-serif), ui-serif, Georgia, serif" }}
                    >
                      {c.title}
                    </h3>
                    <p className="relative mt-3 flex-1 text-[12px] leading-relaxed text-zinc-500 sm:text-[13px]">
                      {c.desc}
                    </p>
                    <div className="relative mt-5 flex flex-wrap gap-2">
                      {c.tags.map((t) => (
                        <span
                          key={t.label}
                          className={`rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset ${t.className}`}
                        >
                          {t.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* —— Magic Wall (investor mockup: Prof-Pi + rich feed card) —— */}
      <section className={`border-b border-white/10 bg-[#050505] ${SEC_PAD}`}>
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2 lg:items-start lg:gap-10 xl:gap-12 2xl:gap-14">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/50 bg-violet-500/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-200">
              ⭐ New · Prof-Pi Gyan++ Wall
            </span>
            <h2
              className="mt-5 text-2xl font-semibold leading-[1.15] tracking-tight text-white sm:text-[1.65rem] md:text-[1.8rem] lg:text-[1.95rem] lg:leading-tight xl:text-[2.1rem] 2xl:text-[2.35rem]"
              style={{ fontFamily: "var(--font-landing-serif), ui-serif, Georgia, serif" }}
            >
              Where multiple minds ask, answer and{" "}
              <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-indigo-300 bg-clip-text font-semibold italic text-transparent">
                accelerate
              </span>{" "}
              together.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-zinc-300 sm:text-base">
              The <span className="font-semibold text-white">Prof-Pi Gyan++ Wall</span> is
              EduBlast&apos;s live social feed — a constantly refreshing river of questions,
              AI answers, teacher commentary, peer insights and revision cards. Every time
              you open it, something new has been added. Interactions earn you RDM.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2.5 sm:max-w-md">
              {(
                [
                  { Icon: Clock, label: "Quick answers" },
                  { Icon: LineChart, label: "Live leaderboard" },
                  { Icon: Star, label: "Teacher value-adds" },
                  { Icon: Menu, label: "Trending by subject" },
                ] as const
              ).map(({ Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-zinc-900/70 px-3 py-2.5 text-[12px] font-medium text-zinc-200 shadow-sm"
                >
                  <Icon className="h-4 w-4 shrink-0 text-zinc-400" strokeWidth={2} />
                  {label}
                </span>
              ))}
            </div>
            <Link
              href="/magic-wall"
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-[#34f5a4] px-7 py-3.5 text-sm font-bold text-neutral-950 shadow-[0_0_28px_rgba(52,245,164,0.25)] transition hover:bg-[#2ee89a]"
            >
              Enter the Gyan ++ Wall <span aria-hidden>→</span>
            </Link>
          </div>

          <div className="min-w-0 rounded-2xl border border-violet-500/30 bg-gradient-to-b from-[#161022] via-[#0e0c14] to-[#08060c] p-1 shadow-[0_0_48px_rgba(139,92,246,0.14)]">
            <div className="rounded-[14px] border border-white/[0.07] bg-[#0c0a10]/95 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                <span className="flex items-center gap-2 text-[11px] font-bold text-white sm:text-xs">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                  Prof-Pi Gyan++ Wall · Physics
                </span>
                <span className="text-[10px] font-medium text-zinc-500 sm:text-[11px]">
                  150+ Q&A on the Gyan ++ Wall today
                </span>
              </div>

              <div className="mt-4 flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/40 to-fuchsia-600/30 text-xs font-bold text-white ring-1 ring-white/10">
                  NK
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-zinc-200 sm:text-xs">
                    Nidhi K <span className="font-normal text-zinc-500">·</span> PUC 2{" "}
                    <span className="font-normal text-zinc-500">·</span> Bengaluru
                  </p>
                  <p className="mt-2 text-[13px] leading-snug text-zinc-200 sm:text-sm">
                    Why does a capacitor block DC current but allow AC current to pass?
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] text-zinc-400 sm:text-[11px]">
                      Physics <span className="text-zinc-600">·</span> Electrostatics{" "}
                      <span className="text-zinc-600">·</span>{" "}
                      <span className="text-zinc-500">3 min ago</span>
                    </p>
                    <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-300 ring-1 ring-orange-400/30">
                      +5 RDM earned
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 font-semibold text-zinc-400">
                      <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                      31
                    </span>
                    <span className="text-violet-400/90">Prof-Pi AI answered ↓</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/[0.06] p-3 sm:p-4">
                <p className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-emerald-300/95">
                  <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                  Prof-Pi AI · answered in 1.8s
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-zinc-200 sm:text-[13px]">
                  Capacitive reactance{" "}
                  <span className="font-mono text-[11px] text-emerald-200/90">X_C = 1/(2πfC)</span>{" "}
                  is infinite at DC (f = 0), so no steady current flows — but AC keeps
                  reversing, so the capacitor repeatedly charges and discharges and AC
                  &quot;gets through&quot; as a displacement current in the circuit.
                </p>
              </div>

              <div className="mt-3 rounded-xl border border-sky-500/35 bg-sky-500/[0.07] p-3 sm:p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-sky-200/95">
                  Dr. Suresh · Physics faculty · Teacher section
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-sky-100/90 sm:text-[13px]">
                  <span className="font-semibold text-sky-200">JEE tip:</span> When f → 0,
                  treat <span className="font-mono text-[11px]">X_C → ∞</span> — state that
                  first, then connect to open circuit for DC. Examiners reward that limiting
                  case before the formula grind.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* —— RDM + EduFund intro (investor: golden RDM + hover cards) —— */}
      <section className={`border-b border-white/10 bg-[#050505] ${SEC_PAD}`}>
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.35em] text-[#34f5a4]">
            Earn while you learn
          </p>
          <h2
            className="mx-auto mt-5 max-w-4xl text-center text-[1.5rem] font-bold leading-[1.3] tracking-tight text-white sm:text-[1.75rem] sm:leading-[1.26] md:text-[1.9rem] md:leading-[1.22] lg:text-[2rem] xl:text-[2.2rem] 2xl:text-[2.45rem] 2xl:leading-[1.2]"
            style={{ fontFamily: "var(--font-landing-serif), ui-serif, Georgia, serif" }}
          >
            <span className="block">
              Every action earns you{" "}
              <span className="text-[#eab308] italic">RDM</span>.
            </span>
            <span className="mt-1.5 block font-bold not-italic text-white sm:mt-2">
              RDM earns you real money.
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-center text-[15px] leading-relaxed text-zinc-300 sm:text-base">
            RDM is the currency of EduBlast. Every meaningful action on the platform earns
            you RDM — and enough RDM unlocks real financial grants through EduFund.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
            {RDM_WAYS.map((w) => (
              <div key={w.title} className="group/rdm relative">
                <div
                  className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-all duration-500 group-hover/rdm:opacity-100"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(251,191,36,0.35), rgba(167,139,250,0.25))",
                    filter: "blur(10px)",
                  }}
                />
                <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#181424] to-[#0f0d14] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-300 group-hover/rdm:-translate-y-0.5 group-hover/rdm:border-amber-400/25 group-hover/rdm:from-[#1c1828] group-hover/rdm:to-[#121018] group-hover/rdm:shadow-[0_22px_44px_-14px_rgba(0,0,0,0.55),0_0_0_1px_rgba(251,191,36,0.1),0_0_36px_-10px_rgba(167,139,250,0.08)]">
                  <div
                    className="pointer-events-none absolute inset-x-4 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-amber-400/60 to-transparent opacity-0 transition-opacity duration-300 group-hover/rdm:opacity-100"
                    aria-hidden
                  />
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/35 text-lg ring-1 ring-white/10 transition-colors group-hover/rdm:bg-black/50 group-hover/rdm:ring-amber-400/15">
                    {w.icon}
                  </div>
                  <h3 className="mt-3 text-sm font-bold tracking-tight text-white">
                    {w.title}
                  </h3>
                  <p className="mt-2 flex-1 text-xs leading-relaxed text-zinc-400 transition-colors group-hover/rdm:text-zinc-300">
                    {w.desc}
                  </p>
                  <p className="mt-4 text-xs font-bold tracking-wide text-amber-200">
                    {w.rdm}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* —— EduFund tiers + centered CTA (ref. screen 6) —— */}
      <section
        id="investor-edufund"
        className={`scroll-mt-20 border-b border-white/10 ${SEC_PAD_SHORT}`}
      >
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.35em] text-[#34f5a4]">
            EduFund tiers · unlock real financial aid
          </p>
          <h2
            className="mx-auto mt-3 max-w-3xl text-center text-[1.6rem] font-bold text-white sm:text-[1.75rem] lg:text-2xl xl:text-3xl 2xl:text-4xl"
            style={{ fontFamily: "var(--font-landing-serif), ui-serif, Georgia, serif" }}
          >
            Consistent study.{" "}
            <span className="text-[#34f5a4]">Real rewards.</span>
          </h2>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              {
                title: "Sprout",
                icon: "🌱",
                pts: "Earn 1000 RDM to unlock",
                amt: "₹3,000",
                amtClass: "text-emerald-400",
                desc: "Device funding, study material grants, mock pack access. For students who show up consistently.",
                ring: "border-emerald-500/25",
              },
              {
                title: "Scholar",
                icon: "📚",
                pts: "Earn 3000 RDM to unlock",
                amt: "₹12,000",
                amtClass: "text-violet-300",
                desc: "College fee support, coaching fee grants, education loan pathway, JEE-linked scholarship nominations.",
                ring: "border-violet-500/25",
              },
              {
                title: "Champion",
                icon: "🏆",
                pts: "Earn 8000 RDM to unlock",
                amt: "₹50,000",
                amtClass: "text-orange-400",
                desc: "Full education grants, abroad pathways, startup seed funding, personal EduFund advisor. Elite achievers only.",
                ring: "border-orange-500/25",
              },
            ].map((tier) => (
              <div
                key={tier.title}
                className={`flex min-w-0 flex-col rounded-2xl border ${tier.ring} bg-gradient-to-b from-zinc-900/90 to-[#08080c] p-5 shadow-[0_0_32px_rgba(0,0,0,0.45)] xl:p-6`}
              >
                <div className="flex items-center gap-2 text-xl sm:text-2xl">
                  <span>{tier.icon}</span>
                  <h3 className="font-serif text-lg font-semibold text-white sm:text-xl">
                    {tier.title}
                  </h3>
                </div>
                <span className="mt-3 inline-flex w-fit max-w-full rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-bold leading-snug tracking-wide text-zinc-200 sm:text-[10px]">
                  {tier.pts}
                </span>
                <p className={`mt-4 text-2xl font-bold sm:text-3xl ${tier.amtClass}`}>
                  {tier.amt}
                </p>
                <p className="mt-3 flex-1 text-xs leading-relaxed text-zinc-500">
                  {tier.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <Link
              href="/auth?role=student"
              className="inline-flex items-center gap-2 rounded-full bg-[#34f5a4] px-8 py-3.5 text-sm font-bold text-neutral-950 shadow-[0_0_32px_rgba(52,245,164,0.25)] transition hover:bg-[#2ee89a]"
            >
              Start earning RDM Today <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <p className="mt-6 text-center text-[11px] text-zinc-500">
            Free to join · No minimum purchase · Real grants for need-based
            eligible students
          </p>
        </div>
      </section>

      {/* —— Live wall (investor: hero + Prof-Pi live feed rows) —— */}
      <section className={`border-b border-white/10 bg-[#0a0b10] ${SEC_PAD}`}>
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2 lg:items-start lg:gap-10 xl:gap-12 2xl:gap-14">
          <div className="min-w-0 lg:pt-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#34f5a4]">
              Live right now
            </p>
            <h2
              className="mt-4 text-2xl font-bold leading-[1.15] tracking-tight text-white sm:text-[1.65rem] md:text-[1.8rem] lg:text-[1.95rem] lg:leading-[1.12] xl:text-[2.1rem] 2xl:text-[2.35rem]"
              style={{ fontFamily: "var(--font-landing-serif), ui-serif, Georgia, serif" }}
            >
              Multiple Students are on the wall.{" "}
              <span className="text-[#34f5a4] italic">Are you?</span>
            </h2>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-zinc-200 sm:text-base">
              EduBlast is where India&apos;s sharpest PUC students compete and earn every hour
              of every day. Not a textbook. A living learning network.
            </p>
            <Link
              href="/magic-wall"
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-[#34f5a4] px-7 py-3.5 text-sm font-bold text-neutral-950 shadow-[0_0_28px_rgba(52,245,164,0.22)] transition hover:bg-[#2ee89a]"
            >
              See the live wall <ArrowUpRight className="h-4 w-4 shrink-0" strokeWidth={2.5} />
            </Link>
          </div>

          <div className="min-w-0 rounded-2xl border border-white/[0.09] bg-[#0e0e14] p-1 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
            <div className="rounded-[14px] border border-white/[0.06] bg-[#101018]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs">
                  Prof-Pi · live feed
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#34f5a4]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/50" />
                    <span className="relative h-2 w-2 rounded-full bg-[#34f5a4]" />
                  </span>
                  Live
                </span>
              </div>

              <div className="divide-y divide-white/[0.06]">
                {/* Row 1 — AI / Prof-Pi Chemistry + RDM pill */}
                <div className="group/feed flex gap-3 px-4 py-4 transition-colors hover:bg-white/[0.025]">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[10px] font-bold text-white shadow-lg ring-1 ring-white/10">
                    AI
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">Prof-Pi · Chemistry</p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-300">
                      Hybridization of carbon in benzene — quick recap with diagram logic.
                    </p>
                    <p className="mt-2 text-[10px] font-medium text-zinc-500">
                      answered in 1.6s · 22 peers
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-zinc-900/90 px-2.5 py-1 text-[10px] font-semibold text-zinc-300">
                        <ChevronUp className="h-3 w-3" strokeWidth={2.5} />
                        15
                      </span>
                      <span className="rounded-full border border-white/10 bg-zinc-900/90 px-2.5 py-1 text-[10px] font-semibold text-zinc-300">
                        Comment +5
                      </span>
                      <span className="rounded-full border border-orange-400/40 bg-gradient-to-b from-orange-500/25 to-amber-900/30 px-2.5 py-1 text-[10px] font-bold leading-none text-orange-200 shadow-[0_0_12px_rgba(251,146,60,0.18)]">
                        +5
                      </span>
                    </div>
                  </div>
                </div>

                {/* Row 2 — Arjun */}
                <div className="group/feed flex gap-3 px-4 py-4 transition-colors hover:bg-white/[0.025]">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-700 text-[10px] font-bold text-white ring-1 ring-white/10">
                    AR
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">Arjun R · PUC 2</p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-300">
                      Mock #4 done — 87%! Mechanics finally clicking… Testbee kept pushing
                      Integration by parts. Feeling dangerous.
                    </p>
                    <p className="mt-2 text-[10px] font-medium text-zinc-500">
                      29 boosts · 11 comments
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-zinc-900/90 px-2.5 py-1 text-[10px] font-semibold text-zinc-300">
                        <ChevronUp className="h-3 w-3" strokeWidth={2.5} />
                        Boost
                      </span>
                      <span className="rounded-full border border-white/10 bg-zinc-900/90 px-2.5 py-1 text-[10px] font-semibold text-zinc-300">
                        Reply
                      </span>
                    </div>
                  </div>
                </div>

                {/* Row 3 — Sneha */}
                <div className="group/feed flex gap-3 px-4 py-4 transition-colors hover:bg-white/[0.025]">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-700 text-[10px] font-bold text-white ring-1 ring-white/10">
                    SM
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">Sneha M · student</p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-300">
                      New Instacue: Kirchhoff&apos;s laws in 4 bullets — save before Physics mock.
                    </p>
                    <p className="mt-2 text-[10px] font-medium text-zinc-500">
                      183 saves · trending
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 bg-zinc-900/90 px-2.5 py-1 text-[10px] font-semibold text-zinc-300">
                        Save +2 RDM
                      </span>
                      <span className="rounded-full border border-white/10 bg-zinc-900/90 px-2.5 py-1 text-[10px] font-semibold text-zinc-300">
                        View
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* —— Comparison (investor: THE REAL DIFFERENCE + dual panels) —— */}
      <section className={`border-b border-white/10 bg-[#050505] ${SEC_PAD}`}>
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.32em] text-[#34f5a4]">
            The real difference
          </p>
          <h2
            className="mx-auto mt-4 max-w-4xl text-center text-[1.6rem] font-bold leading-snug tracking-tight text-white sm:text-[1.8rem] sm:leading-tight lg:text-[1.95rem] xl:text-3xl 2xl:text-4xl"
            style={{ fontFamily: "var(--font-landing-serif), ui-serif, Georgia, serif" }}
          >
            <span className="block sm:inline">Every other platform puts you to sleep.</span>{" "}
            <span className="mt-1 block text-[#34f5a4] italic sm:mt-0 sm:inline">
              EduBlast keeps you in the game.
            </span>
          </h2>

          <div className="mt-8 grid grid-cols-1 gap-5 sm:mt-10 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-stretch lg:gap-4 xl:gap-6">
            {/* Every other EdTech */}
            <div className="group/compare-left min-w-0 rounded-2xl border border-orange-900/40 bg-gradient-to-b from-[#1a100c] to-[#0c0806] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all duration-300 hover:border-orange-500/55 hover:shadow-[0_0_0_1px_rgba(234,88,12,0.12),0_24px_48px_-20px_rgba(0,0,0,0.55)] sm:p-6 xl:p-7">
              <span className="inline-flex rounded-full bg-orange-950/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-orange-300 ring-1 ring-orange-500/30">
                Every other EdTech
              </span>
              <ul className="mt-6 space-y-4">
                {INVESTOR_PROBLEM_OTHER.map((line) => (
                  <li key={line} className="flex gap-3 text-[13px] leading-snug text-zinc-200 sm:text-[14px]">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 shadow-sm ring-1 ring-red-400/40">
                      <X className="h-3 w-3 text-white" strokeWidth={3} />
                    </span>
                    <span className="min-w-0 break-words">{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="flex items-center justify-center py-1 lg:px-1 lg:py-0"
              aria-hidden
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#0a0a0f] text-[11px] font-medium italic tracking-wide text-zinc-400 shadow-[0_0_24px_rgba(0,0,0,0.6)]">
                v/s
              </div>
            </div>

            {/* EduBlast */}
            <div className="group/compare-right min-w-0 rounded-2xl border border-emerald-800/45 bg-gradient-to-b from-[#0c1814] to-[#060a08] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all duration-300 hover:border-[#34f5a4]/45 hover:shadow-[0_0_0_1px_rgba(52,245,164,0.12),0_24px_48px_-20px_rgba(0,0,0,0.55)] sm:p-6 xl:p-7">
              <span className="inline-flex rounded-full bg-emerald-950/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#34f5a4] ring-1 ring-[#34f5a4]/35">
                EduBlast
              </span>
              <ul className="mt-6 space-y-4">
                {INVESTOR_PROBLEM_EDUBLAST.map((line) => (
                  <li key={line} className="flex gap-3 text-[13px] leading-snug text-zinc-200 sm:text-[14px]">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 shadow-sm ring-1 ring-emerald-400/45">
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    </span>
                    <span className="min-w-0 break-words">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* —— Recruiting (ref. screen 9) —— */}
      <section
        id="investor-teachers"
        className={`scroll-mt-20 border-b border-white/10 ${SEC_PAD_SHORT}`}
      >
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-emerald-400">
            Now recruiting · April 2026
          </p>
          <h2
            className="mx-auto mt-3 max-w-3xl text-[1.6rem] font-semibold text-white sm:text-[1.85rem] lg:text-2xl xl:text-3xl 2xl:text-4xl"
            style={{ fontFamily: "var(--font-landing-serif), ui-serif, Georgia, serif" }}
          >
            Join the founding cohort. Build EduBlast{" "}
            <span className="text-emerald-400">with us.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400">
            We are looking for paid Student and Teacher Ambassadors who want to
            shape India&apos;s most exciting EdTech platform from the ground up.
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-5xl gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-b from-[#1a1028] to-[#0c0812] p-6 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-200">
                Student Ambassador · Paid
              </span>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                10 spots only
              </span>
            </div>
            <h3 className="mt-4 font-serif text-xl font-semibold text-white">
              For curious, creative PUC students
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-zinc-300">
              {[
                "Paid role — earn while you learn",
                "First access to all new platform features",
                "Weekly sync with product team",
                "Build public portfolio of content + leadership",
                "Direct path to Champion-tier EduFund consideration",
              ].map((x) => (
                <li key={x} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                  {x}
                </li>
              ))}
            </ul>
            <Link
              href="/auth?role=student"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-violet-500 py-3 text-sm font-bold text-white transition hover:bg-violet-600"
            >
              Apply as Student Ambassador <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-[#0c1a14] to-[#060a08] p-6 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-200">
                Teacher Ambassador · Paid
              </span>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                5 spots only
              </span>
            </div>
            <h3 className="mt-4 font-serif text-xl font-semibold text-white">
              For PCM teachers who want national reach
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-zinc-300">
              {[
                "Paid teaching and mentoring role",
                "Host your own live webinar series",
                "National student visibility beyond your city",
                "RDM + cash compensation for verified contributions",
                "Shape syllabus-aligned content that ships to thousands",
              ].map((x) => (
                <li key={x} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  {x}
                </li>
              ))}
            </ul>
            <Link
              href="/auth?role=teacher"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#34f5a4] py-3 text-sm font-bold text-neutral-950 transition hover:bg-[#2ee89a]"
            >
              See Teacher Page <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* —— Final CTA (investor ref: centered hero, serif stack, mint “Are you?”) —— */}
      <section className="border-b border-white/10 bg-black px-4 py-14 sm:px-6 sm:py-16 lg:px-6 lg:py-16 xl:px-8 xl:py-20 2xl:px-10 2xl:py-24">
        <div className="mx-auto max-w-3xl text-center xl:max-w-4xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#34f5a4] sm:text-[11px]">
            Stop waiting
          </p>
          <h2
            className="mt-4 text-center text-[1.45rem] font-semibold leading-[1.14] tracking-tight text-white [font-variant-numeric:lining-nums] sm:mt-5 sm:text-[1.6rem] md:text-[1.75rem] lg:text-[1.85rem] xl:text-[2.05rem] 2xl:text-[2.35rem]"
            style={{ fontFamily: "var(--font-landing-serif), ui-serif, Georgia, serif" }}
          >
            <span className="block">Multiple Students are on the wall right now.</span>
            <span
              className="mt-1.5 block text-[1.85rem] font-bold leading-[0.95] text-[#34f5a4] sm:mt-2 sm:text-[2.05rem] md:text-[2.2rem] lg:text-[2.35rem] xl:text-[2.55rem] 2xl:text-[2.85rem]"
              style={{ fontFamily: "var(--font-landing-script), cursive" }}
            >
              Are you?
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[14px] leading-relaxed text-zinc-400 sm:mt-6 sm:text-[15px]">
            The rank you want comes from doing this every day — with other students pushing you from
            behind.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href="/auth?role=student"
              className="inline-flex items-center gap-2 rounded-full bg-[#34f5a4] px-8 py-3.5 text-sm font-bold text-neutral-950 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] transition hover:bg-[#2ee89a]"
            >
              Join EduBlast free →
            </Link>
            <Link
              href="/auth?role=teacher"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-transparent px-8 py-3.5 text-sm font-semibold text-white transition hover:border-white/50 hover:bg-white/[0.04]"
            >
              I am a teacher →
            </Link>
          </div>
          <p className="mt-6 text-[11px] leading-relaxed text-zinc-500">
            No credit card · PUC 1 &amp; 2 PCM · Works alongside any coaching ·
            Free to start
          </p>
        </div>
      </section>

          <TickerStrip />
      </>
      ) : (
        <TeacherInvestorSections />
      )}
    </div>
  );
}
