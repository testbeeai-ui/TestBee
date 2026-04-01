import Link from "next/link";

export default function FinalCtaSection() {
  return (
    <section className="text-center px-5 md:px-10 py-14 border-b border-gray-200/60">
      <div className="max-w-[1200px] mx-auto">
        <span className="inline-flex items-center gap-[6px] bg-[#E1F5EE] text-[#085041] text-xs font-medium px-3 py-1 rounded-full mb-5">
          <span className="w-[6px] h-[6px] rounded-full bg-[#1D9E75]" />
          The best time to start was yesterday. The second best time is right now.
        </span>

        <h2 className="text-2xl md:text-[26px] font-medium text-gray-900 leading-[1.3] mb-[10px]">
          Stop studying. Start blasting.
        </h2>

        <p className="text-[15px] text-gray-500 max-w-[440px] mx-auto mb-7 leading-[1.75]">
          38,000 students are on the wall right now &mdash; asking questions, earning RDM,
          climbing leaderboards, and closing in on the rank you want. The question is
          whether you are there with them.
        </p>

        <div className="flex flex-wrap gap-[10px] justify-center mb-5">
          <Link
            href="/auth"
            className="bg-[#1D9E75] text-white rounded-lg px-7 py-3 text-[15px] font-medium hover:bg-[#178d68] transition-colors"
          >
            Join EduBlast free &mdash; takes 2 minutes &rarr;
          </Link>
          <button className="border border-gray-300 rounded-lg px-7 py-3 text-[15px] text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
            See how it works first
          </button>
        </div>

        <p className="text-sm text-gray-400">
          No credit card &middot; No coaching class needed &middot; Works alongside any coaching &middot; PUC 1 &amp; 2 PCM full syllabus
        </p>
      </div>
    </section>
  );
}
