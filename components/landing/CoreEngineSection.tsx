import { CORE_ENGINES } from "./landing-constants";

export default function CoreEngineSection() {
  return (
    <section id="engine" className="px-5 md:px-10 py-10 border-b border-gray-200/60">
      <div className="max-w-[1200px] mx-auto">
        <p className="text-xs font-medium tracking-[0.06em] text-gray-400 uppercase mb-[6px]">
          Core engine
        </p>
        <h2 className="text-xl md:text-[26px] font-medium text-gray-900 leading-[1.3] mb-7">
          Six systems working together, every day.
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-[14px]">
          {CORE_ENGINES.map((e) => (
            <div
              key={e.title}
              className="bg-white border border-gray-200/60 rounded-xl p-4"
            >
              <div
                className="w-9 h-9 rounded-[9px] flex items-center justify-center text-[16px] mb-[10px]"
                style={{ background: e.bg }}
              >
                {e.icon}
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-[5px]">
                {e.title}
              </h3>
              <p className="text-sm text-gray-500 leading-[1.7]">
                {e.text}
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#633806] bg-[#FAEEDA] rounded-full px-2 py-[2px] mt-2">
                <span className="w-[5px] h-[5px] rounded-full bg-[#EF9F27]" />
                {e.rdm}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
