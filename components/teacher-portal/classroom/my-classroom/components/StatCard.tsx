"use client";

export function StatCard(props: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#15162b] p-2.5 sm:p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{props.label}</div>
      <div className={`mt-1 font-serif text-2xl sm:text-3xl ${props.accent}`}>{props.value}</div>
      <div className="text-xs text-slate-400">{props.sub}</div>
    </div>
  );
}
