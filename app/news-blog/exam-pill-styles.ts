import type { ExamId } from "./types";

export function examBrowsePillClass(id: ExamId): string {
  switch (id) {
    case "board":
      return "border-violet-500/45 text-violet-200 bg-violet-950/25 hover:bg-violet-950/40";
    case "jee-main":
      return "border-sky-500/45 text-sky-200 bg-sky-950/20 hover:bg-sky-950/35";
    case "jee-advanced":
      return "border-blue-500/45 text-blue-200 bg-blue-950/25 hover:bg-blue-950/40";
    case "state-cet":
      return "border-orange-500/40 text-orange-200 bg-orange-950/20 hover:bg-orange-950/35";
    case "bitsat":
      return "border-amber-500/45 text-amber-200 bg-amber-950/25 hover:bg-amber-950/40";
    case "mht-cet":
      return "border-rose-500/40 text-rose-200 bg-rose-950/20 hover:bg-rose-950/35";
    case "other":
      return "border-slate-600 text-slate-300 bg-[#182233] hover:bg-[#1e2a3d]";
    case "all":
      return "border-slate-600 text-slate-300 bg-[#182233] hover:bg-[#1e2a3d]";
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}
