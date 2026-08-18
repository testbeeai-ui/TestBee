"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import AppLayout from "@/components/AppLayout";

const SECTION_KICKER =
  "text-[11px] font-bold tracking-[0.14em] text-[#1D9E75] uppercase mb-1.5";
const SECTION_TITLE = "text-xl sm:text-2xl font-extrabold text-[#EAEFF5] tracking-tight";
const CARD = "rounded-2xl border border-[#262E3A] bg-[#151A22]";
const MUTED = "text-[#8B96A5] leading-relaxed";

const FEATURE_LOOPS = [
  {
    step: "01",
    kicker: "Belonging",
    title: "Educational Social Media",
    emoji: "💬",
    iconBg: "bg-[#D4537E]/15",
    hover: "hover:border-[#D4537E]/45",
    body: "Studying alone is where motivation quietly dies. Our Community & Topic Feeds and WA Squads give students peers to share wins, ask doubts, and stay accountable to — the same social pull that makes any habit stick.",
  },
  {
    step: "02",
    kicker: "Curiosity",
    title: "Gyan++",
    emoji: "🧠",
    iconBg: "bg-[#EF9F27]/15",
    hover: "hover:border-[#EF9F27]/45",
    body: "Syllabus builds marks; curiosity builds understanding. Gyan++ surfaces real-world context and “why does this matter” nuggets beyond the textbook, so students stay engaged for reasons that outlast the exam.",
  },
  {
    step: "03",
    kicker: "Reinforcement",
    title: "Micro-rewards (RDM)",
    emoji: "🪙",
    iconBg: "bg-[#1D9E75]/15",
    hover: "hover:border-[#1D9E75]/45",
    body: "Big rewards arrive too late to shape behaviour. RDM rewards every small, honest study action — a flashcard reviewed, a streak kept — the instant it happens, so consistency feels good immediately, not eleven months later.",
  },
  {
    step: "04",
    kicker: "Real value",
    title: "EduFundz",
    emoji: "🚀",
    iconBg: "bg-[#7F77DD]/15",
    hover: "hover:border-[#7F77DD]/45",
    body: "Micro-rewards only matter if they lead somewhere real. Consistently-earned RDM unlocks EduFundz — course credits, scholarships and financial benefits — turning daily discipline into tangible value, and teaching financial responsibility along the way.",
  },
] as const;

const BELIEF_STATS = [
  {
    value: "90-day",
    label: "streaks are where we see the biggest score jumps",
  },
  {
    value: "100%",
    label: "of RDM-earning actions are open to every student, not just toppers",
  },
  {
    value: "4 loops",
    label: "Community, Gyan++, RDM and EduFundz, working as one system",
  },
] as const;

export default function AboutUsClient() {
  return (
    <AppLayout>
      <div className="flex min-h-full flex-1 flex-col bg-[#0E1117] text-[#EAEFF5] font-sans antialiased selection:bg-[#1D9E75]/30 selection:text-[#1D9E75]">
        <div className="mx-auto w-full max-w-[1080px] px-4 sm:px-6 lg:px-8">
          <section className="relative overflow-hidden py-8 text-center sm:py-10">
            <div className="pointer-events-none absolute -top-16 left-1/2 h-[280px] w-[min(100%,640px)] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(29,158,117,0.14),transparent_65%)]" />

            <div className="relative z-10 mb-4 inline-flex items-center gap-2 rounded-full border border-[#1D9E75]/30 bg-[#1D9E75]/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#1D9E75] backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 animate-pulse text-[#1D9E75]" />
              <span>Our story</span>
            </div>

            <h1 className="relative z-10 mx-auto mb-3 max-w-3xl text-[1.65rem] font-extrabold leading-[1.2] text-[#EAEFF5] sm:text-4xl lg:text-[2.6rem]">
              We didn&apos;t build another app. We built a{" "}
              <span className="whitespace-nowrap bg-gradient-to-r from-[#1D9E75] to-[#378ADD] bg-clip-text text-transparent">
                habit engine
              </span>{" "}
              for learning.
            </h1>

            <p className={`relative z-10 mx-auto max-w-2xl text-sm sm:text-base ${MUTED}`}>
              EduBlast exists because talent is common, but consistency is rare — and it&apos;s
              consistency, not raw ability, that decides who actually gets there. Here&apos;s why we
              built it this way, and what we believe.
            </p>
          </section>

          <section className="space-y-4 border-t border-[#262E3A] py-8">
            <div>
              <div className={SECTION_KICKER}>From the founder</div>
              <h2 className={SECTION_TITLE}>A note from Sankar</h2>
            </div>

            <div className={`${CARD} grid grid-cols-1 items-start gap-5 p-5 shadow-xl sm:gap-6 sm:p-6 md:grid-cols-[auto_minmax(0,1fr)] md:p-7`}>
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7F77DD] to-[#378ADD] text-3xl font-black text-[#0E1117] shadow-lg sm:h-28 sm:w-28 sm:text-4xl md:h-32 md:w-32">
                SK
              </div>

              <div className="min-w-0 space-y-3 text-left">
                <div>
                  <h3 className="text-lg font-extrabold text-white sm:text-xl">
                    Sankar Narayan Lakshmanan
                  </h3>
                  <div className="mt-1 text-xs font-semibold text-[#1D9E75] sm:text-sm">
                    Founder, EduBlast · IIT Kharagpur · INSEAD MBA
                  </div>
                </div>

                <blockquote className="border-l-4 border-[#1D9E75] py-0.5 pl-3 text-sm italic leading-relaxed text-[#EAEFF5] sm:pl-4">
                  &ldquo;I spent thirty years building the systems that move money reliably, at
                  scale, for millions of people who never see the engine underneath. What struck me,
                  again and again, was that reliability never came from a single brilliant
                  transaction — it came from thousands of small, boring, consistent ones. Learning
                  works exactly the same way.&rdquo;
                </blockquote>

                <p className={`text-xs sm:text-sm ${MUTED}`}>
                  Before EduBlast, Sankar spent three decades in senior technology and payments
                  leadership — CTO, CIO, CPO and MD roles across WadzPay, Hitachi Payments, Tata
                  Group, FSS, NCR and Oracle Financial Services — designing systems built for scale,
                  resilience and trust. EduBlast started from a simple, personal observation: the
                  students who struggle most in Class XI–XII are rarely the least capable ones.
                  They&apos;re the ones without a structure that makes showing up, every single day,
                  easier than giving up. EduBlast is that structure.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t border-[#262E3A] py-8">
            <div>
              <div className={SECTION_KICKER}>What drives us</div>
              <h2 className={SECTION_TITLE}>Mission &amp; Vision</h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
              <div className={`${CARD} space-y-2.5 border-t-4 border-t-[#1D9E75] p-5 shadow-md transition-colors hover:border-[#1D9E75]/40 sm:p-6`}>
                <div className="text-2xl" aria-hidden>
                  🎯
                </div>
                <h3 className="text-base font-bold text-white sm:text-lg">Our Mission</h3>
                <p className={`text-xs sm:text-sm ${MUTED}`}>
                  To make deep, consistent learning the default daily habit for every Class XI–XII
                  student in India — not a special discipline reserved for the naturally gifted or
                  the already well-supported.
                </p>
              </div>

              <div className={`${CARD} space-y-2.5 border-t-4 border-t-[#EF9F27] p-5 shadow-md transition-colors hover:border-[#EF9F27]/40 sm:p-6`}>
                <div className="text-2xl" aria-hidden>
                  🔭
                </div>
                <h3 className="text-base font-bold text-white sm:text-lg">Our Vision</h3>
                <p className={`text-xs sm:text-sm ${MUTED}`}>
                  A generation of students who don&apos;t just clear an exam once, but carry a
                  lifelong habit of curiosity, discipline and follow-through — the same qualities
                  that decide success long after the exam is over.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t border-[#262E3A] py-8">
            <div>
              <div className={SECTION_KICKER}>Why we built what we built</div>
              <h2 className={SECTION_TITLE}>Every feature exists to close one loop</h2>
              <p className={`mt-2 max-w-2xl text-xs sm:text-sm ${MUTED}`}>
                Motivation fades. Syllabus alone doesn&apos;t build curiosity. And rewards that only
                arrive at the final exam come far too late to shape a daily habit. So we engineered
                a loop that rewards students <strong className="text-white">while</strong> they&apos;re
                building the habit — not just after.
              </p>
            </div>

            <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4">
              {FEATURE_LOOPS.map((feature) => (
                <article
                  key={feature.step}
                  className={`${CARD} flex h-full flex-col gap-3 p-4 transition-colors sm:p-5 ${feature.hover}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${feature.iconBg}`}
                      aria-hidden
                    >
                      {feature.emoji}
                    </div>
                    <div className="text-[10.5px] font-extrabold tracking-wider text-[#8B96A5]">
                      {feature.step}
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col gap-1.5">
                    <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8B96A5]">
                      {feature.kicker}
                    </div>
                    <h4 className="text-[15px] font-bold leading-snug text-white">
                      {feature.title}
                    </h4>
                    <p className={`text-xs ${MUTED}`}>{feature.body}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="rounded-xl border border-[#262E3A] bg-[#1B212B] px-4 py-3 text-xs leading-relaxed text-[#8B96A5] sm:text-sm">
              🔗{" "}
              <strong className="text-[#EAEFF5]">The loop, end to end:</strong> Community keeps
              students showing up &rarr; Gyan++ keeps them curious &rarr; RDM rewards every honest
              action instantly &rarr; EduFundz turns sustained consistency into something real. Break
              any one link, and habits don&apos;t form. Build all four, and they compound.
            </div>
          </section>

          <section className="space-y-5 border-t border-[#262E3A] py-8">
            <div>
              <div className={SECTION_KICKER}>Our core belief</div>
              <h2 className={SECTION_TITLE}>Why we reward consistency over raw talent</h2>
            </div>

            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2 lg:gap-6">
              <div className={`space-y-3 text-xs sm:text-sm ${MUTED}`}>
                <p>
                  Most edtech is built to reward the{" "}
                  <strong className="text-[#EAEFF5]">correct answer</strong>. EduBlast is built to
                  reward the <strong className="text-[#EAEFF5]">act of showing up</strong> — because
                  that&apos;s the variable that actually separates students over a two-year prep
                  window, not innate ability.
                </p>
                <p>
                  An average student who shows up for 10 focused minutes a day, every day, compounds
                  far more understanding than a &ldquo;topper&rdquo; who studies in erratic bursts.
                  Streaks, DailyDose and RDM aren&apos;t gimmicks — they&apos;re deliberately
                  engineered to make the daily habit easier to keep than to break.
                </p>
                <p>
                  This is also why EduBlast doesn&apos;t gate its best features behind being a
                  topper already. <strong className="text-[#EAEFF5]">Every</strong> action —
                  attending a class, flipping an InstaCue, finishing a quiz — earns RDM, because the
                  goal isn&apos;t to reward the students who already had it figured out. It&apos;s
                  to transform the ones who didn&apos;t.
                </p>
              </div>

              <div className={`${CARD} space-y-4 p-4 shadow-md sm:p-5`}>
                <div className="flex flex-col gap-3 border-b border-[#262E3A] pb-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="w-full shrink-0 rounded-lg bg-[#1D9E75]/15 py-1.5 text-center text-[11px] font-black text-[#1D9E75] sm:w-24">
                    CONSISTENT
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="text-xs font-bold text-white">
                      Average student · 10 min/day, every day
                    </div>
                    <div className="h-2 overflow-hidden rounded-full border border-[#262E3A] bg-[#1B212B]">
                      <div className="h-full w-[86%] rounded-full bg-gradient-to-r from-[#1D9E75] to-[#378ADD]" />
                    </div>
                    <div className="text-[11px] text-[#8B96A5]">
                      Illustrative — steady compounding over a 90-day streak
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="w-full shrink-0 rounded-lg bg-[#D4537E]/15 py-1.5 text-center text-[11px] font-black text-[#D4537E] sm:w-24">
                    SPORADIC
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="text-xs font-bold text-white">
                      Strong student · occasional long cram sessions
                    </div>
                    <div className="h-2 overflow-hidden rounded-full border border-[#262E3A] bg-[#1B212B]">
                      <div className="h-full w-[47%] rounded-full bg-gradient-to-r from-[#D4537E] to-[#EF9F27]" />
                    </div>
                    <div className="text-[11px] text-[#8B96A5]">
                      Illustrative — same total hours, irregular spacing
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {BELIEF_STATS.map((stat) => (
                <div
                  key={stat.value}
                  className="rounded-xl border border-[#262E3A] bg-[#1B212B] p-4"
                >
                  <div className="text-xl font-extrabold text-[#1D9E75] sm:text-2xl">
                    {stat.value}
                  </div>
                  <div className={`mt-1 text-xs ${MUTED}`}>{stat.label}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="pb-8 pt-2 sm:pb-10">
            <div className="relative overflow-hidden rounded-2xl border border-[#262E3A] bg-[radial-gradient(circle_at_15%_20%,rgba(29,158,117,0.14),transparent_55%),radial-gradient(circle_at_85%_80%,rgba(127,119,221,0.14),transparent_55%),#151A22] px-5 py-7 text-center shadow-2xl sm:px-8 sm:py-8">
              <h2 className="text-xl font-extrabold text-white sm:text-2xl">
                Consistency is a skill. We help you build it.
              </h2>
              <p className={`mx-auto mt-2 max-w-lg text-xs sm:text-sm ${MUTED}`}>
                Start with one small habit today — a DailyDose, a Dive, a single InstaCue. The rest
                compounds from there.
              </p>

              <div className="mt-5 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/dive"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1D9E75] px-5 py-3 text-sm font-extrabold text-[#04140E] shadow-md transition-transform hover:brightness-110 active:scale-95"
                >
                  <span>Start today&apos;s DailyDose</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  href="/edufund"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#262E3A] bg-transparent px-5 py-3 text-sm font-bold text-[#EAEFF5] transition-colors hover:border-[#8B96A5]"
                >
                  <span>See how EduFundz works</span>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
