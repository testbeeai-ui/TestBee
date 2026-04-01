import { FOOTER_LINKS } from "./landing-constants";

export default function LandingFooter() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200/60 px-5 md:px-10 py-7">
      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-[15px] font-medium text-gray-900">
            Edu<span className="text-[#1D9E75]">Blast</span>
            <span className="text-gray-400 font-normal"> &middot; powered by Testbee AI</span>
          </p>
          <p className="text-xs text-gray-400 max-w-[300px] leading-relaxed mt-1">
            EduFund is a genuine financial aid programme. Grants are disbursed to eligible need-based
            students who meet RDM and activity thresholds.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {FOOTER_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
