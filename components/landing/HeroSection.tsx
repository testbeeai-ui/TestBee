import Link from "next/link";
import { HERO_STATS, TRUST_BADGES } from "./landing-constants";

export default function HeroSection() {
  return (
    <section className="px-5 md:px-10 pt-14 pb-12 border-b border-gray-200/60">
      <div className="max-w-[1200px] mx-auto">
        {/* Kicker */}
        <span className="inline-flex items-center gap-[6px] bg-[#E1F5EE] text-[#085041] text-xs font-medium px-3 py-1 rounded-full mb-5">
          <span className="w-[6px] h-[6px] rounded-full bg-[#1D9E75]" />
          PUC 1 &amp; 2 &middot; PCM &middot; JEE &middot; NEET &middot; Board prep
        </span>

        {/* Headline */}
        <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-medium text-gray-900 leading-[1.25] max-w-[640px] mb-3 tracking-tight">
          Learning that feels like{" "}
          <span className="text-[#1D9E75]">scrolling</span> &mdash; but builds an{" "}
          <span className="text-[#D85A30] font-medium">exam winner.</span>
        </h1>

        {/* Subtitle */}
        <p className="text-base text-gray-500 leading-[1.75] max-w-[560px] mb-7">
          EduBlast is India&apos;s first AI-powered learning social network. Ask questions, earn rewards,
          watch live leaderboards, and become the student who every coaching peer looks up to &mdash; all
          without ever feeling like you&apos;re studying.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap gap-[10px] mb-9">
          <Link
            href="/auth"
            className="bg-[#1D9E75] text-white rounded-lg px-7 py-3 text-[15px] font-medium hover:bg-[#178d68] transition-colors"
          >
            Start for free &mdash; it is free &rarr;
          </Link>
          <button className="border border-gray-300 rounded-lg px-7 py-3 text-[15px] text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
            Watch a 2-min demo
          </button>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 mb-9">
          {TRUST_BADGES.map((b) => (
            <div key={b.label} className="flex items-center gap-[6px] text-sm text-gray-400">
              <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: b.color }} />
              {b.label}
            </div>
          ))}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[10px] pt-7 border-t border-gray-200/60">
          {HERO_STATS.map((s) => (
            <div key={s.label} className="bg-gray-50 rounded-lg px-[14px] py-3">
              <div className="text-2xl font-medium text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
