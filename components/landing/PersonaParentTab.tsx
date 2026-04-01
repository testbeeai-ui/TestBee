import { PARENT_STORIES, PARENT_ACTIVITY, PARENT_ATTENTION } from "./landing-constants";

const TAG_COLORS = {
  amber: { bg: "#FAEEDA", color: "#633806" },
  coral: { bg: "#FAECE7", color: "#712B13" },
} as const;

export default function PersonaParentTab() {
  return (
    <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
      {/* Left: stories */}
      <div>
        {PARENT_STORIES.map((s, i) => (
          <div
            key={i}
            className="flex gap-5 items-start py-5 border-b border-gray-200/60 last:border-b-0"
          >
            <span className="w-9 h-9 rounded-full bg-[#FAEEDA] text-[#412402] flex items-center justify-center text-sm font-medium shrink-0 mt-[2px]">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="text-[15px] font-medium text-gray-900 mb-[5px]">{s.title}</h4>
              <p className="text-sm text-gray-500 leading-[1.75]">{s.text}</p>
              {s.tag && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-[3px] mt-2"
                  style={{ background: s.tagBg, color: s.tagColor }}
                >
                  {s.tag}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Right: activity dashboard + EduFund */}
      <div>
        {/* Activity grid */}
        <div className="bg-gray-50 border border-gray-200/60 rounded-xl p-[14px_16px] mb-3">
          <p className="text-xs font-medium text-gray-400 mb-2">
            Parent view &mdash; your child&apos;s activity this week
          </p>
          <div className="grid grid-cols-2 gap-2 mb-[10px]">
            {PARENT_ACTIVITY.map((a) => (
              <div
                key={a.label}
                className="bg-white border border-gray-200/60 rounded-lg p-[8px_10px]"
              >
                <p className="text-xs text-gray-400">{a.label}</p>
                <p
                  className="text-lg font-medium mt-[1px]"
                  style={{ color: a.color ?? "#111" }}
                >
                  {a.value}
                </p>
              </div>
            ))}
          </div>

          <p className="text-xs font-medium text-gray-900 mb-1">Needs attention</p>
          <div className="flex flex-wrap gap-[6px]">
            {PARENT_ATTENTION.map((a) => {
              const c = TAG_COLORS[a.color];
              return (
                <span
                  key={a.label}
                  className="text-xs font-medium rounded-full px-[7px] py-[2px]"
                  style={{ background: c.bg, color: c.color }}
                >
                  {a.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* EduFund progress note */}
        <div className="bg-[#FAEEDA] rounded-lg p-3 text-sm text-[#412402] leading-[1.7]">
          <p className="font-medium mb-1">EduFund progress</p>
          <p>
            1,740 RDM accumulated &middot; Sprout threshold met &middot; 1,260 RDM to Scholar tier
            &middot; Projected grant eligibility: April 20, 2026. Your child is on track for up to
            &#8377;12,000 in educational financial aid &mdash; simply by studying consistently.
          </p>
        </div>
      </div>
    </div>
  );
}
