import { STUDENT_STORIES, STUDENT_MOCK_FEED, STUDENT_LEADERBOARD } from "./landing-constants";

export default function PersonaStudentTab() {
  return (
    <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
      {/* Left: stories */}
      <div>
        {STUDENT_STORIES.map((s, i) => (
          <div
            key={i}
            className="flex gap-5 items-start py-5 border-b border-gray-200/60 last:border-b-0"
          >
            <span className="w-9 h-9 rounded-full bg-[#E1F5EE] text-[#085041] flex items-center justify-center text-sm font-medium shrink-0 mt-[2px]">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="text-[15px] font-medium text-gray-900 mb-[5px]">{s.title}</h4>
              <p className="text-sm text-gray-500 leading-[1.75]">{s.text}</p>
              <span
                className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-[3px] mt-2"
                style={{ background: s.tagBg, color: s.tagColor }}
              >
                {s.tag}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Right: mock feed + leaderboard + EduFund */}
      <div>
        {/* Mock live wall */}
        <div className="bg-gray-50 border border-gray-200/60 rounded-xl p-[14px_16px] mb-[10px]">
          <p className="text-xs font-medium text-gray-400 mb-2">
            Live wall &mdash; what your peers are asking right now
          </p>
          {STUDENT_MOCK_FEED.map((item, i) => (
            <div
              key={i}
              className="flex gap-2 items-start py-2 border-b border-gray-200/60 last:border-b-0"
            >
              <span
                className={`w-6 h-6 flex items-center justify-center text-[9px] font-medium shrink-0 ${
                  item.rounded ? "rounded-[7px]" : "rounded-full"
                }`}
                style={{ background: item.bg, color: item.color }}
              >
                {item.initials}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500 leading-[1.5]">{item.text}</p>
                <p className="text-[11px] text-gray-400 mt-[2px]">{item.meta}</p>
                <div className="flex gap-[5px] mt-1">
                  {item.actions.map((a) => (
                    <span
                      key={a}
                      className="text-[11px] border border-gray-300 rounded-[5px] px-[6px] py-[2px] text-gray-400"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
              {item.rdm && (
                <span className="inline-flex items-center gap-[3px] text-[11px] font-medium text-[#633806] bg-[#FAEEDA] rounded-full px-[6px] py-[2px] shrink-0">
                  <span className="w-[4px] h-[4px] rounded-full bg-[#EF9F27]" />
                  {item.rdm}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Leaderboard */}
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-900 mb-[6px]">
            Your leaderboard position this week
          </p>
          {STUDENT_LEADERBOARD.map((l) => (
            <div
              key={l.name}
              className={`flex items-center gap-2 px-[10px] py-[7px] border rounded-lg mb-[6px] ${
                l.isYou
                  ? "border-[#1D9E75] bg-[#E1F5EE]"
                  : "border-gray-200/60"
              }`}
            >
              <span className="text-xs w-5 text-center shrink-0">{l.rank}</span>
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0"
                style={{ background: l.bg, color: l.color }}
              >
                {l.initials}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${l.isYou ? "text-[#085041]" : "text-gray-900"}`}>
                  {l.name}
                </p>
                <div className="bg-gray-200 rounded-full h-[5px] overflow-hidden mt-[2px]">
                  <div
                    className="h-full rounded-full bg-[#1D9E75]"
                    style={{ width: `${l.pct}%` }}
                  />
                </div>
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${l.isYou ? "text-[#085041]" : "text-gray-900"}`}>
                {l.pts}
              </span>
            </div>
          ))}
        </div>

        {/* EduFund note */}
        <div className="bg-[#FAEEDA] rounded-lg p-[10px_12px] text-sm text-[#412402] leading-relaxed">
          <span className="font-medium">EduFund:</span> Your 1,740 RDM is already past the Sprout
          threshold. Keep going for Scholar (3,000 RDM) to unlock financial aid &mdash; up to
          &#8377;12,000 in grants for eligible students.
        </div>
      </div>
    </div>
  );
}
