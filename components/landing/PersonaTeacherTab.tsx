import { TEACHER_STORIES, TEACHER_MOCK_FEED } from "./landing-constants";

export default function PersonaTeacherTab() {
  return (
    <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
      {/* Left: stories */}
      <div>
        {TEACHER_STORIES.map((s, i) => (
          <div
            key={i}
            className="flex gap-5 items-start py-5 border-b border-gray-200/60 last:border-b-0"
          >
            <span className="w-9 h-9 rounded-full bg-[#EEEDFE] text-[#26215C] flex items-center justify-center text-sm font-medium shrink-0 mt-[2px]">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="text-[15px] font-medium text-gray-900 mb-[5px]">{s.title}</h4>
              <p className="text-sm text-gray-500 leading-[1.75]">{s.text}</p>
              {s.rdm && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[#633806] bg-[#FAEEDA] rounded-full px-2 py-[3px] mt-2">
                  <span className="w-[5px] h-[5px] rounded-full bg-[#EF9F27]" />
                  {s.rdm}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Right: teacher dashboard mock + stats */}
      <div>
        {/* Mock feed */}
        <div className="bg-gray-50 border border-gray-200/60 rounded-xl p-[14px_16px] mb-[10px]">
          <p className="text-xs font-medium text-gray-400 mb-2">Teacher dashboard snapshot</p>
          {TEACHER_MOCK_FEED.map((item, i) => (
            <div
              key={i}
              className="flex gap-2 items-start py-2 border-b border-gray-200/60 last:border-b-0"
            >
              <span className="w-6 h-6 rounded-full bg-[#1D9E75] text-white flex items-center justify-center text-[9px] font-medium shrink-0">
                {item.initials}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500 leading-[1.5]">{item.text}</p>
                <p className="text-[11px] text-gray-400 mt-[2px]">{item.meta}</p>
                {item.actions && (
                  <div className="flex gap-[5px] mt-1">
                    {item.actions.map((a) => (
                      <span
                        key={a}
                        className={`text-[11px] border rounded-[5px] px-[6px] py-[2px] ${
                          a.includes("RDM")
                            ? "border-[#1D9E75] text-[#085041]"
                            : "border-gray-300 text-gray-400"
                        }`}
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-[10px] mt-[10px]">
          <div className="bg-white border border-gray-200/60 rounded-xl p-4">
            <p className="text-sm font-medium text-gray-900">Students helped</p>
            <p className="text-2xl font-medium text-[#085041] mt-1">312</p>
            <p className="text-sm text-gray-500 mt-[2px]">this month via Gyan++</p>
          </div>
          <div className="bg-white border border-gray-200/60 rounded-xl p-4">
            <p className="text-sm font-medium text-gray-900">RDM earned this week</p>
            <p className="text-2xl font-medium text-[#EF9F27] mt-1">+420</p>
            <p className="text-sm text-gray-500 mt-[2px]">from teacher sections</p>
          </div>
        </div>
      </div>
    </div>
  );
}
