import { PROBLEM_OTHER, PROBLEM_EDUBLAST } from "./landing-constants";

export default function ProblemSection() {
  return (
    <section id="features" className="px-5 md:px-10 py-10 border-b border-gray-200/60">
      <div className="max-w-[1200px] mx-auto">
        <p className="text-xs font-medium tracking-[0.06em] text-gray-400 uppercase mb-[6px]">
          The real problem with EdTech
        </p>
        <h2 className="text-xl md:text-[26px] font-medium text-gray-900 leading-[1.3] mb-2">
          Every other platform puts you to sleep. EduBlast keeps you in the game.
        </h2>
        <p className="text-[15px] text-gray-500 leading-[1.75] max-w-[580px] mb-7">
          Traditional platforms force chapter 1 &rarr; chapter 2 &rarr; chapter 3. Boring. Slow.
          You lose momentum by page 3. EduBlast is built differently &mdash; like the social feed you
          already can&apos;t stop scrolling, but every swipe makes you smarter and earns you points.
        </p>

        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {/* Other EdTech */}
          <div>
            <div className="text-sm font-medium text-[#A32D2D] mb-[10px] px-[10px] py-[6px] bg-[#FCEBEB] rounded-lg">
              How every other EdTech platform works
            </div>
            <div className="space-y-3">
              {PROBLEM_OTHER.map((item, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="w-5 h-5 rounded-full bg-[#FCEBEB] flex items-center justify-center shrink-0 text-xs text-[#A32D2D] mt-[1px]">
                    &times;
                  </span>
                  <span className="text-sm text-gray-500 leading-[1.6]">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* EduBlast */}
          <div>
            <div className="text-sm font-medium text-[#085041] mb-[10px] px-[10px] py-[6px] bg-[#E1F5EE] rounded-lg">
              How EduBlast works
            </div>
            <div className="space-y-3">
              {PROBLEM_EDUBLAST.map((item, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="w-5 h-5 rounded-full bg-[#E1F5EE] flex items-center justify-center shrink-0 text-xs text-[#085041] mt-[1px]">
                    &#10003;
                  </span>
                  <span className="text-sm text-gray-500 leading-[1.6]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
