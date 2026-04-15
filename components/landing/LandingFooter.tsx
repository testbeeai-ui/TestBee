import { FOOTER_LINKS } from "./landing-constants";

export default function LandingFooter({ variant = "light" }: { variant?: "light" | "dark" }) {
  const isDark = variant === "dark";
  return (
    <footer
      className={
        isDark
          ? "border-t border-white/10 bg-[#050505] px-5 md:px-10 py-8"
          : "bg-gray-50 border-t border-gray-200/60 px-5 md:px-10 py-7"
      }
    >
      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className={isDark ? "text-[15px] font-medium text-white" : "text-[15px] font-medium text-gray-900"}>
            Edu<span className="text-[#34f5a4]">Blast</span>
            <span className={isDark ? "text-zinc-500 font-normal" : "text-gray-400 font-normal"}>
              {" "}
              &times; Testbee
            </span>
          </p>
          <p
            className={
              isDark
                ? "text-xs text-zinc-500 max-w-[320px] leading-relaxed mt-1"
                : "text-xs text-gray-400 max-w-[300px] leading-relaxed mt-1"
            }
          >
            EduFund is a genuine financial aid programme. Grants are disbursed to eligible need-based
            students who meet RDM and activity thresholds.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {FOOTER_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className={
                isDark
                  ? "text-sm text-zinc-500 hover:text-zinc-200 transition-colors"
                  : "text-sm text-gray-400 hover:text-gray-700 transition-colors"
              }
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
