import { COACHING_QUOTE, COACHING_STORIES, COACHING_FEATURES } from "./landing-constants";

export default function PersonaCoachingTab() {
  return (
    <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
      {/* Left: quote + stories */}
      <div>
        {/* Quote block */}
        <div className="border-l-[3px] border-[#1D9E75] bg-[#E1F5EE] rounded-r-lg pl-4 pr-4 py-3 mb-4">
          <p className="text-sm text-[#085041] leading-[1.7] italic">{COACHING_QUOTE.text}</p>
          <p className="text-xs text-[#0F6E56] mt-[6px] font-medium">{COACHING_QUOTE.attr}</p>
        </div>

        {COACHING_STORIES.map((s, i) => (
          <div
            key={i}
            className="flex gap-5 items-start py-5 border-b border-gray-200/60 last:border-b-0"
          >
            <span className="w-9 h-9 rounded-full bg-[#FAECE7] text-[#4A1B0C] flex items-center justify-center text-sm font-medium shrink-0 mt-[2px]">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="text-[15px] font-medium text-gray-900 mb-[5px]">{s.title}</h4>
              <p className="text-sm text-gray-500 leading-[1.75]">{s.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Right: feature cards + CTA box */}
      <div>
        <div className="grid grid-cols-2 gap-[10px] mb-[14px]">
          {COACHING_FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white border border-gray-200/60 rounded-xl p-4"
            >
              <div
                className="w-9 h-9 rounded-[9px] flex items-center justify-center text-[16px] mb-[10px]"
                style={{ background: f.bg }}
              >
                {f.icon}
              </div>
              <h4 className="text-sm font-medium text-gray-900 mb-[5px]">{f.title}</h4>
              <p className="text-sm text-gray-500 leading-[1.7]">{f.text}</p>
            </div>
          ))}
        </div>

        {/* Coral CTA box */}
        <div className="bg-[#FAECE7] rounded-lg p-3 text-sm text-[#4A1B0C] leading-[1.7]">
          <p className="font-medium mb-1">Already at a coaching class? Here is the add-on math:</p>
          <p>
            Coaching covers curriculum. EduBlast adds speed training, peer competition visibility,
            adaptive mocks, spaced revision, and a live community of 38,000 students grinding toward
            the same exam. The student who uses both consistently outperforms the one who uses only
            coaching.
          </p>
        </div>
      </div>
    </div>
  );
}
